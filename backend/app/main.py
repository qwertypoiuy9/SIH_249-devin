"""FastAPI service for the AI-driven predictive maintenance & fleet availability platform."""
from __future__ import annotations

import io
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import osacbm, strategy
from .fleet import FleetSim
from .rul_model import COLUMNS, RUL_CAP, SENSORS, load_or_train, window_features

STATE: dict = {}
LOCK = threading.Lock()
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    STATE["model"] = load_or_train()
    STATE["sim"] = FleetSim(STATE["model"])
    yield


app = FastAPI(title="Air Power Predictive Maintenance Platform", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def sim() -> FleetSim:
    return STATE["sim"]


def _aircraft(tail: str) -> dict:
    ac = sim().get_aircraft(tail)
    if ac is None:
        raise HTTPException(404, f"Unknown tail number {tail}")
    return ac


class AdvanceReq(BaseModel):
    days: int = Field(1, ge=1, le=365)


class SettingsReq(BaseModel):
    auto_schedule: bool | None = None
    planning_horizon_days: int | None = Field(None, ge=7, le=120)


class WorkOrderReq(BaseModel):
    tail: str
    component_id: str


class TransferReq(BaseModel):
    sku: str
    source: str
    destination: str


@app.get("/api/health")
def health():
    return {"status": "ok", "day": sim().day}


@app.get("/api/summary")
def summary():
    with LOCK:
        return sim().summary()


@app.get("/api/aircraft")
def aircraft_list():
    with LOCK:
        return [sim().aircraft_view(a) for a in sim().aircraft]


@app.get("/api/aircraft/{tail}")
def aircraft_detail(tail: str):
    with LOCK:
        return sim().aircraft_view(_aircraft(tail), detail=True)


@app.get("/api/aircraft/{tail}/components/{cid}")
def component_trace(tail: str, cid: str):
    with LOCK:
        ac = _aircraft(tail)
        comp = next((c for c in ac["components"] if c.id == cid), None)
        if comp is None:
            raise HTTPException(404, f"Unknown component {cid}")
        return osacbm.trace(sim(), ac, comp)


@app.get("/api/advisories")
def advisories():
    with LOCK:
        return sim().advisories()


@app.get("/api/workorders")
def work_orders():
    with LOCK:
        return sim().work_orders[::-1]


@app.post("/api/workorders")
def create_work_order(req: WorkOrderReq):
    with LOCK:
        _aircraft(req.tail)
        try:
            return sim().create_work_order(req.tail, req.component_id)
        except StopIteration:
            raise HTTPException(404, f"Unknown component {req.component_id}")


@app.get("/api/inventory")
def inventory():
    with LOCK:
        return sim().inventory_view()


@app.post("/api/inventory/transfer")
def transfer(req: TransferReq):
    with LOCK:
        try:
            return sim().transfer(req.sku, req.source, req.destination)
        except (ValueError, KeyError) as e:
            raise HTTPException(400, str(e))


@app.get("/api/events")
def events(limit: int = 200):
    with LOCK:
        return sim().events[-limit:][::-1]


@app.get("/api/integration")
def integration():
    with LOCK:
        return sim().integration_view()


@app.get("/api/model/metrics")
def model_metrics():
    return STATE["model"].metrics


@app.get("/api/strategy")
def strategy_compare(days: int = 365, n_aircraft: int = 24, sortie_rate: float = 1.2, threshold: float = 15.0):
    days = int(np.clip(days, 30, 730))
    return strategy.simulate(STATE["model"].metrics, days=days, n_aircraft=int(np.clip(n_aircraft, 4, 60)),
                             sortie_rate=float(np.clip(sortie_rate, 0.3, 3.0)), threshold=float(np.clip(threshold, 0, 60)))


@app.post("/api/sim/advance")
def advance(req: AdvanceReq):
    with LOCK:
        sim().advance(req.days)
        return sim().summary()


@app.post("/api/sim/reset")
def reset():
    with LOCK:
        STATE["sim"] = FleetSim(STATE["model"])
        return sim().summary()


@app.post("/api/sim/settings")
def settings(req: SettingsReq):
    with LOCK:
        for k, v in req.model_dump(exclude_none=True).items():
            sim().settings[k] = v
        return sim().settings


@app.post("/api/ingest/cmapss")
async def ingest_cmapss(file: UploadFile = File(...)):
    """Score an uploaded C-MAPSS-format file (unit, cycle, 3 settings, 21 sensors; whitespace separated)."""
    content = (await file.read()).decode("utf-8", errors="ignore")
    try:
        df = pd.read_csv(io.StringIO(content), sep=r"\s+", header=None)
        df = df.iloc[:, : len(COLUMNS)]
        df.columns = COLUMNS[: df.shape[1]]
        missing = [s for s in SENSORS if s not in df.columns]
        if missing:
            raise ValueError(f"missing sensor columns {missing}")
    except Exception as e:
        raise HTTPException(400, f"Could not parse file as C-MAPSS format: {e}")
    rows, units = [], []
    for unit, g in df.groupby("unit"):
        g = g.sort_values("cycle")
        rows.append(window_features(g[SENSORS].to_numpy(dtype=float), int(g["cycle"].max())))
        units.append((int(unit), int(g["cycle"].max())))
    preds = STATE["model"].predict_batch(np.array(rows))
    return {"filename": file.filename, "units": len(units), "rul_cap": RUL_CAP,
            "predictions": [{"unit": u, "last_cycle": c, **{k: round(v, 1) for k, v in p.items()}}
                            for (u, c), p in zip(units, preds)]}


if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = FRONTEND_DIST / path
        return FileResponse(f if path and f.is_file() else FRONTEND_DIST / "index.html")
