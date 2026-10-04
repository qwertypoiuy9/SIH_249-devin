# VAYU-RAKSHA: AI Predictive Maintenance & Fleet Availability Platform

Prototype for **SIH Problem Statement 26249: Air Power - Predictive Maintenance & Fleet Availability** (MoD / DSSC).

The problem is low aircraft availability caused by reactive maintenance and by health-monitoring data, technical records, spares and maintenance agencies not being connected. This prototype puts those four sources behind one open, ISO 13374 / MIMOSA OSA-CBM analytics layer. It predicts remaining useful life (RUL) with calibrated uncertainty, turns the predictions into prioritised advisories and work orders, and passes the expected parts demand to a multi-echelon spares planner.

> All fleet, inventory and maintenance data is **simulated**. Engine telemetry and lives come from the public **NASA C-MAPSS** turbofan dataset. The figures in the dashboard come from the simulation; they are not operational claims.

## What it does

| Capability | Implementation |
|---|---|
| Engine RUL prognostics | Gradient boosting on 30-cycle window features (mean, EWM, slope, std of 14 sensors) trained on C-MAPSS FD001+FD003 and scored on the 200 official test engines: **RMSE 12.3 cycles, NASA S-score 547** (time-based baseline: RMSE 40.7, S 93,648) |
| Uncertainty | Conformalized Quantile Regression (CQR) gives 90% prediction intervals (**89.5% empirical coverage**). A q0.30 "safety-biased" model drives scheduling, which cuts late predictions from 55% to 42% |
| Digital twins | 25 aircraft (Su-30MKI, Tejas Mk1, Mirage 2000, Rafale) across 7 bases. Each tail has engine twins replaying C-MAPSS telemetry, subsystem twins (hydraulics, landing gear, radar T/R) using exponential health-indicator trends with bootstrap intervals, and a wing-root structure twin using **Paris-law** crack growth calibrated from SHM readings |
| OSA-CBM pipeline | Each component exposes a DA, DM, SD, HA, PA, AG trace (data acquisition through advisory generation) that you can inspect in the UI |
| Alarm-fatigue control | An anomaly is raised only when at least 3 sensors are beyond 3σ of the healthy baseline. Single-sensor transients are logged as suppressed. Median de-spiking is applied before feature extraction |
| Advisories & work orders | Priority comes from the safety-biased RUL compared against spare lead time. Raising a work order reserves a spare from the nearest echelon and books MRO time. Optional auto-scheduling |
| Spares / MEIO | Expected demand per base comes from the RUL distributions and is netted against base, regional depot, central depot and OEM stock. The planner recommends routing (pre-positioning) and runs the repair pipeline for removed rotables |
| Strategy comparison | Monte Carlo simulation of reactive, preventive (hard-time) and predictive policies. Lives are drawn from C-MAPSS; the predictive policy uses the model's actual held-out errors |
| Fleet metrics | Operational availability (Ao), sortie generation rate, mission-capability status, life used at removal, and unscheduled failures |
| Edge processing | Compares the size of raw telemetry with edge-extracted health metadata per sortie, to show what an AID-based architecture saves in bandwidth |

## Architecture

```
 Aircraft (AID / MIL-STD-1553)  -->  Edge DA/DM/SD  -->  one-way CDS  -->  Lakehouse (telemetry + e-MMS + IMMOLS + MRO)
                                                                               |
                                    OSA-CBM analytics: HA -> PA (ML | trend | physics) -> AG
                                                                               |
                         Decision support: fleet Ao/SGR, advisories, work orders, MEIO, strategy  (human in the loop)
```

* `backend/app/rul_model.py`: C-MAPSS loading, feature engineering, GBM + CQR training, NASA score, evaluation
* `backend/app/components.py`: component twins (`EngineComponent`, `TrendComponent`, `StructureComponent`)
* `backend/app/fleet.py`: fleet simulator: sorties, failures, work orders, spares, transfers, MRO, events
* `backend/app/osacbm.py`: ISO 13374 six-block trace per component
* `backend/app/strategy.py`: Monte Carlo maintenance-policy comparison
* `backend/app/main.py`: FastAPI REST API (also serves the built frontend)
* `frontend/`: React + TypeScript + Tailwind + Recharts dashboard

## Running locally

Requirements: Python 3.11+ and Node 20+.

```bash
# backend
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000      # loads artifacts/rul_model.joblib, or trains it (~2 min) if missing

# frontend (second terminal)
cd frontend
npm install
npm run dev                                      # http://localhost:5173 (proxies /api to :8000)
```

To serve everything from a single port, run `npm run build` in `frontend/` and then start uvicorn. FastAPI serves `frontend/dist` at http://localhost:8000.

Retrain the model: `cd backend && python -m app.rul_model`

## Using the dashboard

1. **Fleet Overview**: Ao, SGR, advisories and the event log. Use **+1d / +7d / +30d** in the header to advance the simulation clock.
2. Toggle **Auto-schedule (PdM)** to let the platform raise work orders on its own, then compare the availability trend and unscheduled failures with and without it. Over 120 simulated days in testing, average Ao was 92% with auto-scheduling and 85% without, with 6 unscheduled failures versus 38.
3. **Digital Twins**: open any tail to see component RUL bars (90% interval, point estimate and safety-biased value), the OSA-CBM trace, telemetry, the RUL history compared with ground truth, and the tech log.
4. **Advisories & WOs**: the prioritised queue and one-click work orders.
5. **Spares & MEIO**: shortfall recommendations and pre-positioning transfers.
6. **Strategy Compare**: run the policy Monte Carlo.
7. **Model Lab**: model metrics and baselines. Upload a C-MAPSS-format file (for example `backend/data/cmapss/test_FD001.txt`) to score new engines.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/summary` | Fleet KPIs and history |
| GET | `/api/aircraft`, `/api/aircraft/{tail}` | Twin list / detail |
| GET | `/api/aircraft/{tail}/components/{id}` | OSA-CBM trace |
| GET | `/api/advisories` | Prioritised advisories |
| GET/POST | `/api/workorders` | List / raise work orders |
| GET | `/api/inventory`, POST `/api/inventory/transfer` | MEIO view / transfer |
| GET | `/api/model/metrics`, `/api/strategy` | Model evaluation / policy simulation |
| POST | `/api/sim/advance`, `/api/sim/reset`, `/api/sim/settings` | Simulation control |
| POST | `/api/ingest/cmapss` | Score an uploaded C-MAPSS file |

## Tests

```bash
cd backend && python -m pytest -q
cd frontend && npm run lint && npm run build
```

## Scope and limitations

* Simulated fleet; no classified, IMMOLS or e-MMS data or interfaces. Their integration points are modelled as data sources.
* Gradient boosting stands in for the LSTM / attention / PINN models discussed in the research. The OSA-CBM block interfaces are designed so those models can be swapped in.
* Zero-trust, cross-domain and DO-178C / DO-326A requirements are part of the architecture, not implemented.

Data: A. Saxena, K. Goebel, D. Simon, N. Eklund, "Damage Propagation Modeling for Aircraft Engine Run-to-Failure Simulation", PHM 2008 (NASA C-MAPSS).
