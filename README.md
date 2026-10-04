# AirPower — Predictive Maintenance & Fleet Availability

**Problem Statement 26249** · Ministry of Defence — Defence Services Staff College · Category: Software ·
Theme: Transportation & Logistics

An integrated, AI-driven maintenance analytics platform for an air fleet: it unifies the data that used to live in
separate systems, predicts failures before they ground an aircraft, and shows real fleet availability instead of
reactive counters.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
npm run typecheck
```

React + TypeScript + Vite, no runtime dependencies beyond React. All charts, gauges and the digital-twin replica are
hand-built SVG. **All data is simulated** — no operational aircraft connectivity.

## Coverage of the problem statement

| Problem-statement element | Where it is solved in the app |
| --- | --- |
| Maintenance data from health-monitoring systems **not integrated** | **Data integration hub** — five source systems (onboard IoT/ACMS, technical records & logbooks, spares ERP, maintenance agencies/depots, flight ops) with sync state, freshness, record counts, schema-mapping and data-quality guards feeding one aircraft record |
| **Technical records** fragmented | **Technical records** table (flight logs, defects, component cards, inspections, engine-trend notes) with cross-source tagging; also per-aircraft record in the digital twin |
| **Spares** data not integrated | **Spares & stores** page: cover-days vs supplier lead time, reorder levels, reservations, stockout risk; automatic prediction → indent trigger |
| **Maintenance agencies** not integrated | Agency utilisation and work-order allocation inside **Work control**; partner feed health shown in the integration hub |
| **Delayed fault prediction** | **Predictive fault detection** page — AI models (GBM-RUL, Isolation Forest, autoencoder, Weibull survival) produce remaining-useful-life forecasts with confidence, anomaly score, SHAP-style drivers and an auditable alert/outcome log; KPI "mean early warning lead time" |
| **AI/ML-based predictive maintenance** (technology opportunity) | Model registry + live predictions + feature-contribution analysis + detection pipeline from sensor to work order |
| **IoT / aircraft health monitoring** | **Digital twin → live telemetry**: 2-second streaming sensor traces (EGT, vibration, hyd pressure, crack gauge, …) with warn/critical thresholds and live status pills |
| **Digital twins** | **Digital twin** page: top-down airframe replica with per-system health nodes, life-limited-part usage (fatigue, engine life, brakes, tyres, contamination), sub-system condition tiles |
| **Integrated maintenance analytics platform** | **Maintenance analytics** page: before/after impact table, availability trend, downtime pareto, MTBF/MTTR, risk horizon, model performance |
| **Low aircraft availability** | Fleet overview: availability & mission-capable gauges, readiness by class, status donut, 12-month trend vs reactive baseline |
| **Avoidable aircraft downtime** | Downtime pareto with the *avoidable* share called out, downtime-hours-avoided KPI, work-order turnaround (MTTR) tracking |
| **Sub-optimal utilisation of critical assets** | Utilisation tables per airframe (inventory + analytics), criticality-A spares coverage, agency load, idle-airframe flying-hour loss |

## Pages

1. **Fleet overview** — readiness KPIs, availability trend, top predicted faults, downtime pareto, data-source health, spares risks.
2. **Aircraft inventory** — 20 airframes, filters/search, health, RUL alert, utilisation, open work orders.
3. **Digital twin** — replica + live IoT telemetry + life-limited parts + AI predictions + tech record for the selected tail.
4. **Predictive fault detection** — alert feed, driver analysis, recommended action, full RUL table, model performance, outcome log.
5. **Maintenance planning & work control** — 50 work orders (predictive/preventive/corrective), status filters, agency capacity, 14-day schedule, reactive-vs-planned shift.
6. **Spares & stores** — inventory ledger, stockout/lead-time risk, long-lead parts, automatic indent flow.
7. **Data integration hub** — the five feeds, pipeline, quality guards, unified technical records.
8. **Maintenance analytics** — before/after impact, model registry, trend, pareto, risk horizon, asset utilisation.

## User flow — how each person actually uses it

**1. Duty controller opens the day (Fleet overview, ~60 s)**
Reads the four numbers that answer "can we fly?" — fleet availability, mission-capable %, mean early-warning lead
time, downtime hours avoided — plus the AOG banner. If something is red, they click the row; it jumps straight to
that aircraft's digital twin. No logins to four different systems, no phone calls to find out a status.

**2. Engineer interrogates one airframe (Digital twin)**
Picks a tail from the pill row. Sees the replica with every system callout (health % + leader line), life-limited part
usage, and 2-second live telemetry for the selected system. The online detector scores each sample (z-score vs the
learned baseline, CUSUM) — sustained deviation raises a LIVE anomaly banner and writes it to the audit trail. Click a
node to switch subsystem.

**3. Maintenance controller triages (Predictive faults)**
Works the alert feed top-down (most urgent first). Selects an alert and reads *why* the model fired (feature
contributions), the predicted RUL, and the recommended action. Then does one of three things, each of which writes to
shared state:
- **Acknowledge** — "yes, this is real" (audit trail entry)
- **Raise work order** — appears immediately in Work control
- **Indent spare** — appears immediately in Spares with ETA

**4. Planner schedules the work (Work control)**
Sees all orders (the ones just raised from alerts are tagged `raised by you · PRD-xxxx`), filters by status/priority,
checks agency load and the 14-day window. Because the alert arrives days before the failure, the job is slotted into
servicing that had to happen anyway — that is where the downtime saving comes from.

**5. Stores officer chases parts (Spares)**
`Live indents` shows parts reserved from AI alerts; each one advances `RAISED → APPROVED → RECEIVED`. The ledger flags
lines whose cover days are shorter than supplier lead time, so long-lead parts are ordered *before* the aircraft is
down, not after.

**6. Data / ops lead closes the loop (Data integration)**
Checks the five source feeds and quality guards, reviews unified technical records, and can drop a real ACMS/sensor
CSV through **Bring your own sensor data** — the same online detector runs over it and reports alarms per sample.

**7. Command reviews (Maintenance analytics)**
Before/after table (availability, MTBF, MTTR, fill rate, reactive share), availability trend, downtime pareto, model
registry with drift status, and risk horizon — all computed from the same integrated record.

State (acknowledgements, work orders raised, indents, audit log) persists in `localStorage`, so a session survives a
reload.

## Making it work in the real world

The prototype is deliberately built so the *logic* is production-shaped and only the **data source** is simulated:

| Layer | In this prototype | In production |
| --- | --- | --- |
| Ingestion | Seeded generator + `tick()` every 2 s | ACMS/IoT telemetry via MQTT or ARINC gateway; scheduled pulls from tech-logbook, stores ERP, depot/agency feeds |
| Detection | `src/lib/detector.ts` — EWMA baseline, z-score, CUSUM (online, stateful, one sample at a time) | Same algorithm per channel, deployed as a stream processor; trained per airframe/LRU |
| Prediction | Seeded RUL/anomaly model outputs with confidence + drivers | Trained GBM/survival models on historical failures, retrained on drift signal, SHAP for drivers |
| Action | Context store → work order / indent / audit log, persisted in `localStorage` | REST/GraphQL writes into the MRO system (AMOS/WinAir/Corridor) and ERP, with role-based approval |
| Twin | SVG replica + life counters | Same UI fed by the aircraft record; CAD/3D optional |

Integration contract to target: canonical schema mapped from **ATA iSpec 2200** tech records, **MIMOSA/OSA-CBM**
condition data, and stores/ERP part master — exactly what the `Data integration` page models.

## Notes

- Simulation only: seeded pseudo-random data, a live telemetry tick every 2 s, and a wall-clock in the top bar.
- Default target width 1440×900; the layout is responsive down to tablet/mobile.
