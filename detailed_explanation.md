# AirPower — Predictive Maintenance & Fleet Availability
### Detailed explanation · Problem statement decoded · MVP architecture · Hackathon PPT pack

> **Problem Statement ID:** 26249 · **Organization:** Ministry of Defence (MoD) · **Department:** Defence Services Staff College · **Category:** Software · **Theme:** Transportation & Logistics
>
> **Live site:** https://airpower-predictive-maintenance.vercel.app
> **Stack:** React 18 + TypeScript + Vite (no runtime dependency besides React), custom SVG charts, Vercel hosting
> **Size:** 22 source files · ~5,400 lines · production bundle 248 KB JS (78 KB gzipped) + 18 KB CSS
> **State:** builds clean (`npm run build`), zero console errors, deployed to production

---

## 1. The problem statement, decoded

### 1.1 Verbatim

> **Problem Statement:** Low aircraft availability due to fragmented and largely reactive maintenance practices across the air fleet. Maintenance data from aircraft health-monitoring systems, technical records, spares and maintenance agencies is not adequately integrated, resulting in delayed fault prediction, avoidable aircraft downtime and sub-optimal utilisation of critical assets.
>
> **Technology Opportunity:** AI/ML-based predictive maintenance, IoT/aircraft health monitoring, digital twins and an integrated maintenance analytics platform.

### 1.2 Plain English — what is actually broken

Four things are broken, and they feed each other:

1. **Data lives in four silos.** The health-monitoring system (onboard sensors) knows the engine is degrading. The paper/digital tech logbook knows the last three defects. The stores ERP knows the spare part is out of stock. The depot/OEM agency knows the repair queue. **Nobody sees all four at once**, so no one can connect "sensor drift + no spare + depot queue" into a decision.
2. **Maintenance is reactive.** Work starts when a pilot reports a symptom or a red light comes on. By then the aircraft is already on the ground, unannounced.
3. **Faults are predicted late (or not at all).** Precursor signals exist days before failure, but they are buried in raw data nobody looks at until it becomes a defect entry.
4. **Assets are mis-utilised.** Aircraft sit idle waiting for parts that were ordered too late; high-value spares are bought after the failure; flying hours are lost that were never planned to be lost.

**The measurable symptom:** low aircraft availability — the fleet can't fly when the mission asks it to fly.

### 1.3 The root-cause chain (this is the story your PPT tells)

```
 4 disconnected data sources
            │
            ▼
 nobody has one picture of the aircraft
            │
            ▼
 faults discovered late (reactive culture)
            │
            ▼
 unannounced grounding + waiting for parts + depot queue
            │
            ▼
 AVOIDABLE DOWNTIME  +  sub-optimal asset use
            │
            ▼
 LOW FLEET AVAILABILITY  ← the headline problem
```

**Our thesis in one line:** *integrate the four sources → predict days earlier → act before the aircraft is grounded → availability goes up.* The whole product is that arrow chain, turned into pages.

### 1.4 Who feels the pain (the four users of the product)

| Persona | Their pain today | The screen that fixes it |
|---|---|---|
| Duty controller / ops officer | "Can we fly today?" needs 4 phone calls | Fleet overview |
| Maintenance engineer | Symptoms seen late, no precursor visibility | Digital twin + live telemetry |
| Maintenance controller | Alerts exist nowhere central; work raised on paper | Predictive faults → work orders |
| Stores officer | Indents raised *after* the aircraft is AOG | Spares & stores |
| Data / ops lead | Four feeds, four truths, stale data | Data integration hub |
| Command / CO | No single availability picture, no before/after proof | Maintenance analytics |

### 1.5 Why it matters (stakes — say this out loud in the pitch)

Every day an aircraft is unexpectedly on the ground is a day of flying hours, readiness and money burned. Reactive maintenance turns a **detectable 5-day precursor** into a **14-day unplanned grounding** plus a part that has a 45-day lead time. Multiply across a fleet and the flying fraction collapses — which is exactly what the problem statement calls "low aircraft availability".

---

## 2. The idea (our solution)

### 2.1 Pitch (say this in 20 seconds)

> **AirPower** is an integrated maintenance analytics platform for the air fleet. It pulls aircraft health-monitoring (IoT) data, technical records, spares and maintenance-agency status into **one aircraft record**, scores every sensor channel **online to predict failures days ahead**, and closes the loop by auto-raising work orders and spare indents — so an aircraft goes for maintenance *because we decided it*, not *because it broke*.

### 2.2 The core insight

The problem is **not** "we lack AI". The problem is that prediction is worthless if its output doesn't reach the person who schedules the work and the person who orders the part. So our MVP is built as a **closed loop**, not a model:

```
 detect → predict → recommend → acknowledge → raise WO → indent spare → audit
```

Every arrow in that chain is a real, clickable, state-persisting action in the app.

### 2.3 What exists today (8 pages, verified live)

| # | Page | What it proves to a judge |
|---|---|---|
| 1 | **Fleet overview** | The headline: 75% availability ▲7 pts, AOG banner, availability trend vs reactive baseline, downtime pareto with *avoidable* share, 5-source health |
| 2 | **Aircraft inventory** | One unified record per airframe (20 tails): status, health, RUL alert, hours, cycles, utilisation, open WOs |
| 3 | **Digital twin** | Replica with 8 labelled system callouts, life-limited parts, **live 2 s telemetry scored by a real detector**, per-aircraft predictions + tech record |
| 4 | **Predictive faults** | 29 AI predictions with RUL/confidence/drivers, acknowledge → raise WO → indent, **audit log** |
| 5 | **Work control** | 51 work orders (predictive/preventive/corrective), agency capacity, 14-day window, your AI-raised WO tagged |
| 6 | **Spares & stores** | 12 lines, cover-days vs lead time, 11 flagged, indents advancing RAISED → APPROVED → RECEIVED |
| 7 | **Data integration** | The 5 source feeds, pipeline, quality guards, 20 unified tech records, **bring-your-own-CSV detector** |
| 8 | **Maintenance analytics** | Before-vs-after on all six named metrics, model registry with drift, risk horizon, asset utilisation |

### 2.4 Differentiators (what makes it more than a dashboard)

1. **Real detection maths** — the anomaly layer is a genuine online algorithm (EWMA baseline → z-score → CUSUM), not a lookup table. It also scores an imported real CSV.
2. **Closed loop with audit trail** — actions write to shared state, survive reload, and are attributable.
3. **Data-integration-first** — the app refuses to pretend data is clean: one feed shows `STALE`, one `SYNCING`, and quality guards quarantine bad records.
4. **Honest before/after** — every impact number derives from one `BASELINE` constant, so the trend chart, KPI deltas and the impact table can never disagree.

---

## 3. Problem → Solution coverage scorecard (audit results)

| # | Problem-statement clause | Status | Where solved | Evidence in the live app |
|---|---|---|---|---|
| 1 | *"fragmented… health-monitoring, technical records, spares, maintenance agencies not adequately integrated"* | ✅ Solved head-on | Data integration page | 5 source feeds with sync state/freshness/counts, 312 schema mappings, 5 data-quality guards, 20 cross-tagged tech records |
| 2 | *"largely reactive maintenance practices"* | ✅ Solved | Predictive faults + Work control | 29 predictions auto-convert to WOs; mix now 69% planned / 31% reactive (was 69% reactive); ack → WO → indent loop with audit |
| 3 | *"delayed fault prediction"* | ✅ Over-delivered | Detector + model cards | Live z-score/CUSUM scoring, **5.3 days mean early warning**, 4 models with MAE/precision/drift, SHAP-style drivers |
| 4 | *"avoidable aircraft downtime"* | ✅ Solved | Overview + Analytics | Downtime pareto with avoidable share called out, **5,957 downtime hours avoided**, MTTR 41 h → 21.9 h |
| 5 | *"sub-optimal utilisation of critical assets"* | ✅ Solved | Fleet + Spares + Analytics | Per-airframe utilisation (idle jets quantified), 11 of 12 spare lines risk-flagged, agency load %, criticality-A cover |
| 6 | *"Low aircraft availability"* (headline) | ✅ Over-delivered | Overview | Availability 75% ▲7, mission-capable 80% ▲6, 12-month trend vs reactive baseline, AOG banner, class readiness |

**Technology opportunity — all four present:**

| Opportunity | Where |
|---|---|
| AI/ML predictive maintenance | RUL/anomaly/survival model registry, 29 live predictions, feature drivers, outcome log |
| IoT / aircraft health monitoring | 17 channels per airframe (340 fleet-wide), 2 s streaming with warn/crit thresholds |
| Digital twins | Replica + life-limited parts + system condition + tech record per tail |
| Integrated maintenance analytics platform | The whole app, anchored by the Data integration hub and the Analytics page |

---

## 4. MVP architecture

### 4.1 System diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER  (simulated in MVP)                  │
│  fleet.ts      telemetry.ts      predictions.ts        ops.ts            │
│  20 airframes  17 ch × 20 =     29 RUL predictions    51 WOs · 12 spares │
│  8 systems     340 channels     8 failure modes        20 tech records    │
│                live tick 2 s                           5 source feeds    │
└───────────────┬──────────────────────────────────────────────────────────┘
                │  (production: MQTT/ACMS gateway · tech-log pull · ERP API · depot feed)
                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         DETECTION LAYER   (REAL)                         │
│  lib/detector.ts — per channel stateful online detector                  │
│    EWMA baseline (α=0.06) → z-score → CUSUM (k=1.1, h=5.5, warm-up 8)   │
│    fires → LIVE anomaly banner + audit event                             │
│    same function runs over an imported CSV (Data integration page)       │
└───────────────┬──────────────────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       PREDICTION LAYER  (mocked outputs)                 │
│  predictions.ts — RUL (days/fh), confidence, severity, anomaly score,    │
│  failure mode, feature contributions, recommended action, model name     │
│  (production: trained GBM-RUL + Isolation Forest + autoencoder + Weibull)│
└───────────────┬──────────────────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    ACTION LAYER  (REAL, persisted)                       │
│  lib/platform.tsx — React context + localStorage                         │
│    acknowledge(pred) · raiseWO(pred) · indent(pred, part) · advanceIndent │
│    → work order lands in Work control, indent lands in Spares,           │
│      every step appended to the audit log (60 events kept)               │
│  (production: writes to MRO/ERP — AMOS / WinAir / Corridor — + RBAC)     │
└───────────────┬──────────────────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                                 │
│  8 pages · custom SVG charts (line, spark, gauge, donut, bars, health)   │
│  twin replica with leader-line callouts · light-blue centre / dark chrome│
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 The data flow (7 steps — use as your PPT "how it works")

1. **Ingest** — sensor channels stream every 2 s; tech records, spares, agency status join on tail/part number.
2. **Normalise** — units, time base and identifiers mapped to one canonical schema (the 312 mappings on the Data page).
3. **Score** — each channel runs through the online detector; sustained deviation raises a live anomaly.
4. **Predict** — anomaly + component history + utilisation feed the RUL layer → an alert with confidence, drivers, recommendation.
5. **Decide** — controller acknowledges (real/false), the system proposes the work window and the part.
6. **Act** — one click raises the work order and the spare indent; both appear in their operational screens instantly.
7. **Prove** — analytics computes availability/downtime/MTBF before-vs-after from the same record; audit log keeps every step.

### 4.3 Tech stack and *why* (a judge will ask)

| Choice | Reason |
|---|---|
| React 18 + TypeScript (strict) | Type-safe domain model (Aircraft, Prediction, WorkOrder, Spare…) — exactly what an aviation data product needs |
| Vite | Instant dev loop; 10 s production builds (the hackathon constraint) |
| **No chart/UI library** | Every chart, gauge, donut and the twin replica is hand-built SVG → 248 KB total bundle, nothing to audit, fully brandable |
| Context + localStorage | Real action persistence with zero backend — the demo survives a reload |
| Vercel | One-command deploys, preview URLs, free tier |

### 4.4 Module map (file → responsibility)

```
src/
├─ App.tsx                 shell, nav, routing, PlatformProvider
├─ types.ts                the whole domain model (9 entities)
├─ pages/
│  ├─ Overview.tsx         KPIs, trend, pareto, top faults, source health
│  ├─ Fleet.tsx            20 airframes, filters, utilisation
│  ├─ Twin.tsx             replica + callouts + live telemetry + detector
│  ├─ Predictions.tsx      alert feed, drivers, actions, audit log, RUL table
│  ├─ Maintenance.tsx      work-order board, agency load, 14-day window
│  ├─ Spares.tsx           ledger, risk, live indents
│  ├─ DataHub.tsx          5 feeds, pipeline, guards, tech records, CSV import
│  └─ Analytics.tsx        before/after, models, trend, risk horizon
├─ data/                   simulation layer (swap for connectors in prod)
├─ lib/
│  ├─ detector.ts          ★ the real algorithm (online EWMA/z/CUSUM + CSV parse)
│  ├─ platform.tsx         ★ closed-loop action store (persisted)
│  ├─ metrics.ts           all KPIs derived from ONE baseline (no contradictions)
│  └─ rng.ts               seeded determinism
└─ components/             charts.tsx (SVG) · ui.tsx (cards/tags/tables)
```

### 4.5 Data model (the 9 entities)

| Entity | Key fields | Purpose |
|---|---|---|
| `Aircraft` | tail, type, class, status, hours, cycles, systems[8], sensors[17], twin[6] | The unified record |
| `SystemHealth` | name, health %, trend, governing LRU | Sub-system condition |
| `SensorDef` | base, noise, warn, crit, sens | Channel definition for stream + thresholds |
| `Prediction` | rulDays, rulHours, confidence, severity, anomaly, drivers[], recommendation, model | The AI output |
| `WorkOrder` | type, priority, status, agency, tatDays, progress, sourcePred | The action |
| `Spare` | onHand, reserved, reorder, leadDays, criticality, demand30 | Inventory + risk |
| `TechRecord` | kind, source, closed | Unified logbook |
| `DataAsset` | records, synced, state, health | Integration status |
| `Indent` / `LogEvent` | status, reason, at | The audit trail |

### 4.6 The algorithms

**Online anomaly detector (real, `lib/detector.ts`)** — the same shape as a deployed condition-monitoring service:

```
baseline:  mean ← mean + α(x − mean),  var ← var + α((x − mean)² − var)     α = 0.06
residual:  z = (x − mean) / √var            (ignored for first 8 samples = warm-up)
accum:     CUSUM ← max(0, CUSUM + max(0, |z| − k))     k = 1.1 (slack)
alarm:     CUSUM > h  →  fire, then reset      h = 5.5
```

Why CUSUM and not a threshold: a *small sustained shift* (slow EGT-margin erosion) never crosses a hard threshold, but accumulates — that's precisely how the "delayed fault prediction" in the problem statement happens today.

**Prediction layer (mocked):** RUL is derived from component health + accumulated cycles with per-failure-mode templates, producing severity bands (≤3 d CRITICAL, ≤10 d HIGH, ≤25 d MODERATE), confidence, anomaly score and feature contributions. In production this is a trained GBM + survival model — the interface (`Prediction`) is already shaped for it.

### 4.7 What is REAL vs SIMULATED (be honest before the judge asks)

| Layer | In this MVP | In production |
|---|---|---|
| Detection | ✅ Real algorithm, online, stateful | Same code, deployed as a stream processor |
| Data ingest | 🟡 Simulated generator + **real CSV import** | MQTT/ACMS gateway, scheduled pulls from logbook/ERP/depot |
| Prediction (RUL) | 🟡 Generated from templates | Trained on 3 yrs of fleet history, retrained on drift |
| Actions (WO/indent) | ✅ Real state, persisted, auditable | REST writes into MRO (AMOS/WinAir) + ERP with RBAC |
| Digital twin | ✅ Functional UI | Same UI fed by the aircraft record (3D optional) |
| Auth / multi-user | ❌ Single session | Role-based: controller / stores / command |

Integration contract to target: **ATA iSpec 2200** (tech records), **MIMOSA/OSA-CBM** (condition data), part master from ERP — exactly what the Data integration page models.

### 4.8 Deployment

```bash
npm run build          # tsc -b && vite build → dist/ (265 KB)
vercel deploy --prod --yes
# → https://airpower-predictive-maintenance.vercel.app  (alias, instant)
```

---

## 5. User flow (how each person uses it — step by step)

**1 · Duty controller opens the day (Fleet overview, ~60 s)**
Reads four numbers that answer *"can we fly?"* — availability 75%, mission-capable 80%, early-warning lead time, downtime hours avoided — plus the red AOG banner. Anything red → click the row → jumps to that aircraft's twin.

**2 · Engineer interrogates one airframe (Digital twin)**
Picks a tail. Sees the replica with every system's health callout, life-limited-part usage (fatigue, engine life, brakes, tyres) and live 2-second telemetry. The detector scores every sample; a sustained deviation raises a **LIVE anomaly** banner and writes it to the audit trail. Click a node to switch subsystem.

**3 · Maintenance controller triages (Predictive faults)**
Works the feed top-down (most urgent first). Selects an alert → reads *why* the model fired (feature contributions), the predicted RUL and the recommended action. Then does one of three things, each writing to shared state:
- **Acknowledge** — "yes, this is real"
- **Raise work order** — appears immediately in Work control
- **Indent spare** — appears immediately in Spares with ETA

**4 · Planner schedules the work (Work control)**
Sees all 51 orders (AI-raised ones tagged `raised by you · PRD-xxxx`), filters by status/priority, checks agency load and the 14-day window. Because the alert arrived days early, the job is slotted into servicing that had to happen anyway — *that is where the downtime saving comes from.*

**5 · Stores chases parts (Spares)**
`Live indents` shows parts reserved from AI alerts, advancing `RAISED → APPROVED → RECEIVED`. The ledger flags lines whose cover-days are shorter than supplier lead time, so long-lead parts are ordered *before* the aircraft is down.

**6 · Data lead closes the loop (Data integration)**
Monitors the five feeds and quality guards, reviews unified tech records, and drops a **real ACMS/sensor CSV** through *Bring your own sensor data* — the same detector runs and reports alarms per sample.

**7 · Command reviews (Maintenance analytics)**
Before/after table, availability trend, downtime pareto, model registry with drift status, risk horizon — all computed from the same integrated record.

---

## 6. Verified impact numbers (quote these in slides)

*All pulled from the live build after the metrics-consistency fix — the KPI cards, the trend chart and the before/after table now derive from one baseline.*

| Metric | Before (reactive era) | Now | Change |
|---|---|---|---|
| Fleet availability | 68% | **75%** | ▲ 7 pts |
| Mission capable | 74% | **80%** | ▲ 6 pts |
| MTBF (flight hours) | 34.5 fh | **42.3 fh** | ▲ 23% |
| MTTR (time to repair) | 41 h | **21.9 h** | ▼ 47% |
| Spares fill rate | 71% | **100%** | ▲ 41% |
| Reactive share of work | 69% | **31%** | ▼ 55% |
| Mean early warning | 0 (find out after failure) | **5.3 days** | new capability |
| Downtime hours avoided | — | **5,957 h** | rolling 30 d |
| Failures averted | — | **25** | rolling 30 d |

**Scale of the demo:** 20 airframes · 4 classes · 340 IoT channels · 29 active predictions · 51 work orders · 12 spare lines (11 risk-flagged) · 5 integrated sources · 4 ML models · 8 pages.

---

## 7. Demo script (6 minutes; also a 90-second version)

| Time | Screen | What you say | What you click |
|---|---|---|---|
| 0:00 | Fleet overview | "Four systems, one picture. 75% availability, up 7 points; the pareto shows which hours were avoidable." | hover pareto, point at AOG banner |
| 0:45 | → Digital twin | "One airframe, live at 2-second resolution, scored against its own baseline — that's the IoT + digital-twin opportunity." | pick a tail, click Propulsion node, wait for z-score chip |
| 1:45 | Predictive faults | "Here's *why* it fired, days before failure — RUL, confidence, drivers." | select top alert, show drivers |
| 2:30 | same | "Now the loop closes." | **Acknowledge → Raise work order → Indent spare** |
| 3:15 | Work control | "The work order I just raised is here, with agency and TAT." | point at `raised by you · PRD-xxxx` |
| 3:45 | Spares | "The part is reserved before the aircraft is down." | **Approve → Mark received** |
| 4:15 | Data integration | "This is the actual root cause — five feeds, one record, quality guards. And I can drop a real export." | show CSV import result |
| 5:00 | Analytics | "Before vs after, on every metric the statement names." | show before/after table |
| 5:30 | — | "What's simulated is the data source and the RUL training; detection, actions and integration logic are real." | close |

**90-second version:** overview → twin (watch it tick) → prediction → three buttons → spares → analytics. Never leave the loop.

---

## 8. PPT blueprint (14 slides — title · bullets · visual · speaker note)

**S1 — Title**
*AirPower: Predictive Maintenance & Fleet Availability* — MoD · DSSC · Problem 26249 · team + college logo.
*Visual:* dark hero, aircraft silhouette. *Note:* one line — "We make aircraft available *by decision*, not by failure."

**S2 — The problem (the chain)**
Four silos → reactive culture → late prediction → avoidable downtime → low availability.
*Visual:* the §1.3 chain diagram. *Note:* "Nobody's data is wrong — it's just in four places."

**S3 — Why it hurts (stakes)**
Flying hours lost, AOG without warning, 45-day part lead times discovered too late.
*Visual:* one photo/quote + 3 stats. *Note:* keep it 30 seconds; pain before solution.

**S4 — Our idea**
One aircraft record · days of warning · closed loop.
*Visual:* the detect → predict → act → prove loop. *Note:* repeat the thesis sentence.

**S5 — Solution architecture**
The 5-layer diagram from §4.1.
*Visual:* architecture diagram. *Note:* name the four opportunities (AI/ML, IoT, twin, analytics) as layers, not buzzwords.

**S6 — Live demo: the twin**
*Screenshot:* Digital twin page (labels + live traces).
*Note:* "17 channels per airframe at 2-second resolution, scored by a real online detector."

**S7 — Live demo: prediction with drivers**
*Screenshot:* Predictive faults with the driver bars visible.
*Note:* "RUL 5.3 days of warning — vs today, the crew finds out when the light comes on."

**S8 — Live demo: closing the loop**
*Screenshot:* the three action buttons + audit log.
*Note:* click them live if time allows — this is the moment judges lean in.

**S9 — Data integration (the real root cause)**
*Screenshot:* Data integration hub with the 5 feeds + quality guards.
*Note:* "Integration is the actual problem statement; the model is the headline."

**S10 — Impact before/after**
*Screenshot:* the six-metric table (68→75, 74→80, 34.5→42.3, 41→21.9, 71→100, 69→31).
*Note:* one sentence per row, no more.

**S11 — Availability trend + downtime pareto**
*Screenshot:* trend chart and pareto with avoidable share.
*Note:* "The striped part of the pareto is what we target first."

**S12 — Architecture in production (honesty slide)**
Real vs simulated table from §4.7 + integration standards (ATA iSpec 2200, MIMOSA/OSA-CBM, MRO/ERP write-back).
*Note:* judges reward this — it converts "prototype" into "credible path".

**S13 — Roadmap**
30 days: real ACMS connector + auth. 90 days: trained RUL models, MRO write-back, notifications. 180 days: multi-fleet, base-level rollout.

**S14 — Closing**
*One line:* "Integrated data → days of warning → aircraft that flies when the mission says so."
Live link + repo QR + team.

**Design notes:** dark chrome + light-blue content is already the app's look — reuse those exact palettes; take screenshots at 1440×900; never put more than 5 bullets on a slide; put numbers in 40 pt+ type.

---

## 9. Likely judge questions (and the answer)

- **"Is the ML real?"** → Detection: yes, a real online EWMA/z-score/CUSUM detector (and it scores imported CSVs). RUL layer: generated from failure-mode templates — the interface is production-shaped and the README documents the training path.
- **"Where does data come from?"** → Today: a simulator + CSV import. Production: MQTT/ACMS gateway, logbook pulls, ERP API, depot feed — mapped to ATA iSpec 2200 / MIMOSA.
- **"Can two people use it?"** → Not yet: single session, localStorage persistence. Auth + RBAC is sprint one of the roadmap.
- **"How is availability calculated?"** → Airworthy/mission-capable over fleet, with every before/after figure derived from a single baseline constant so the charts can't disagree.
- **"What if the model is wrong?"** → Alerts carry confidence + an audit trail with outcomes (caught early / superseded / false positive / missed) — visible on the Predictive faults page.
- **"What's the biggest risk?"** → Data quality at the source; that's why 5 quality guards quarantine bad records instead of feeding the model.

## 10. Limitations (say them before asked) + roadmap

**Limitations:** single-browser persistence, no auth, simulated data source, generated RUL outputs, no push notifications, availability computed from status rather than scheduled-vs-unscheduled hours.

**Roadmap:** ① ACMS/MQTT connector + auth/RBAC ② train RUL models on real history, model monitoring ③ MRO/ERP write-back with approvals ④ P1 escalation (SMS/email) ⑤ base/fleet multi-tenancy + offline tablet mode for flight line.

## 11. Appendix

**Run / rebuild / deploy**
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
vercel deploy --prod --yes
```
**Key files to show if asked for code:** `src/lib/detector.ts` (the algorithm), `src/lib/platform.tsx` (the closed loop), `src/lib/metrics.ts` (single source of truth for numbers), `src/pages/Twin.tsx` (digital twin), `src/pages/DataHub.tsx` (integration + CSV).

**Glossary:** RUL = remaining useful life · AOG = aircraft on ground · MTBF/MTTR = mean time between failures / to repair · LRU = line-replaceable unit · CUSUM = cumulative sum control chart · ACMS = aircraft condition monitoring system · MRO = maintenance, repair & overhaul.
