from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

DATA = Path(__file__).resolve().parents[1] / "data" / "cmapss"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        c.post("/api/sim/reset")
        yield c


def test_health_and_summary(client):
    assert client.get("/api/health").json()["status"] == "ok"
    s = client.get("/api/summary").json()
    assert s["aircraft"] == 25
    assert 0 <= s["ao"] <= 100
    assert sum(s["by_status"].values()) == 25


def test_aircraft_and_trace(client):
    rows = client.get("/api/aircraft").json()
    assert len(rows) == 25
    tail = rows[0]["tail"]
    d = client.get(f"/api/aircraft/{tail}").json()
    assert d["components"]
    for c in d["components"]:
        assert c["rul_lo"] <= c["rul"] <= c["rul_hi"]
        assert c["rul_safe"] <= c["rul"] + 1e-6
        t = client.get(f"/api/aircraft/{tail}/components/{c['id']}").json()
        assert [b["block"] for b in t["blocks"]] == ["DA", "DM", "SD", "HA", "PA", "AG"]
    assert client.get("/api/aircraft/NOPE").status_code == 404


def test_advance_workorder_inventory(client):
    s = client.post("/api/sim/advance", json={"days": 5}).json()
    assert s["day"] == 5 and len(s["history"]) >= 5
    adv = client.get("/api/advisories").json()
    target = next((a for a in adv if a["work_order"] is None), None)
    if target:
        wo = client.post("/api/workorders", json={"tail": target["tail"], "component_id": target["component_id"]}).json()
        assert wo["tail"] == target["tail"]
        assert any(w["id"] == wo["id"] for w in client.get("/api/workorders").json())
        dup = client.post("/api/workorders", json={"tail": target["tail"], "component_id": target["component_id"]}).json()
        assert dup["id"] == wo["id"]
    inv = client.get("/api/inventory").json()
    assert inv["stock"] and "recommendations" in inv
    assert client.get("/api/integration").json()["edge"]["reduction_pct"] > 99
    assert client.get("/api/events").status_code == 200


def test_model_metrics(client):
    m = client.get("/api/model/metrics").json()
    assert m["n_test_units"] == 200
    assert m["rmse"] < 20
    assert 80 <= m["interval_coverage"] <= 98
    assert m["safe_nasa_score"] <= m["nasa_score"] * 1.2


def test_strategy(client):
    r = client.get("/api/strategy", params={"days": 120, "n_aircraft": 8}).json()
    p = r["policies"]
    assert p["predictive"]["unscheduled_failures"] <= p["reactive"]["unscheduled_failures"]
    assert p["predictive"]["life_used_pct"] > p["preventive"]["life_used_pct"]


def test_ingest_cmapss(client):
    with open(DATA / "test_FD001.txt", "rb") as f:
        r = client.post("/api/ingest/cmapss", files={"file": ("test_FD001.txt", f, "text/plain")})
    assert r.status_code == 200
    assert r.json()["units"] == 100
    bad = client.post("/api/ingest/cmapss", files={"file": ("x.txt", b"1 2 3", "text/plain")})
    assert bad.status_code == 400
