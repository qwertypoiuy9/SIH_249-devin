# AirPower — Video Narration Script (7–10 minutes)

> **Purpose:** a record-while-you-speak script for a screen-recording video that explains problem statement **26249 — Air Power: Predictive Maintenance & Fleet Availability** and demos the live prototype.
> **Target length:** ~8 min 45 s (comfortably inside 7–10 min). Spoken text ≈ 1,250 words at a natural ~145 wpm.
> **Site:** https://airpower-predictive-maintenance.vercel.app (or `npm run dev` locally)
> **Companion doc:** [detailed_explanation.md](detailed_explanation.md) — full architecture, PPT blueprint, judge Q&A.

### How to read this file

Each scene has:

- **⏱ Timecode** — cumulative running time on the clock.
- **🖥 On screen** — exactly what you click/point at while speaking.
- **🎤 Say** — the words, verbatim (adapt phrasing freely, keep the numbers).
- **✍ Note** — pacing, emphasis, what not to do.

---

## 0 · Pre-flight checklist (do this BEFORE hitting record)

1. **Fresh state:** open the site → DevTools (F12) → Application → Local Storage → clear `airpower` keys → reload. This makes the "raise work order / indent spare" moment produce a clean `raised by you · PRD-xxxx` tag.
2. **Warm the digital twin:** visit Digital twin once, pick a tail, wait ~15 s so the telemetry traces are already drawn when you start filming that scene.
3. **Clean window:** F11 fullscreen (or hide bookmarks bar), close mail/WhatsApp/Slack, enable Do Not Disturb, browser zoom 100%, window ≥1440×900.
4. **Mic check** + a glass of water. Record at 1080p.
5. **Optional prop:** keep a small ACMS-style CSV on the desktop for the Data-integration import moment (Scene 8). Skip it live if short on time — there's a trim note.
6. **Numbers card** — keep this open on a second screen so you never misquote:

   | Number | Value |
   |---|---|
   | Availability | **75% (▲7 pts)** vs 68% baseline |
   | Mission capable | **80% (▲6)** |
   | MTBF / MTTR | **34.5 → 42.3 fh** / **41 → 21.9 h** |
   | Spares fill rate | **71% → 100%** |
   | Reactive share of work | **69% → 31%** |
   | Mean early warning | **5.3 days** |
   | Downtime hours avoided | **5,957 h** (rolling 30 d) · **25 failures averted** |
   | Scale | 20 airframes · 340 sensor channels · 29 predictions · 51 work orders · 5 data sources · 4 ML models · 8 pages |

---

## 1 · Timing overview (adjust to taste)

| # | Scene | Clock | ~Words |
|---|---|---|---|
| 1 | Cold open — the problem statement | 0:00–0:45 | 105 |
| 2 | Why it happens — the root-cause chain | 0:45–1:35 | 125 |
| 3 | The idea in one loop | 1:35–2:05 | 75 |
| 4 | Fleet overview — "can we fly today?" | 2:05–3:05 | 135 |
| 5 | Digital twin — IoT + live detection | 3:05–4:20 | 170 |
| 6 | Predictive faults — the closed loop ★ | 4:20–5:50 | 195 |
| 7 | Work control + Spares — the write-back | 5:50–6:30 | 105 |
| 8 | Data integration — the real root cause | 6:30–7:15 | 115 |
| 9 | Maintenance analytics — before vs after | 7:15–7:55 | 105 |
| 10 | Honesty, roadmap, close | 7:55–8:45 | 130 |

**To hit exactly 7:00** — merge Scene 3 into Scene 2 and cut Scene 8's CSV paragraph.
**To stretch to 10:00** — add a stop at **Aircraft inventory** (filters + utilisation table) between Scenes 4 and 5, let the twin run until a LIVE anomaly banner actually fires (~30 s), and do the CSV import live in Scene 8.

---

## 2 · The script

---

### Scene 1 — 0:00–0:45 · Cold open: the problem statement

**🖥 On screen:** Live site already loaded on **Fleet overview**. Sit still for the first 3 seconds — let the page be seen. Then slowly sweep the cursor across the top KPI row.

**🎤 Say:**

> This is AirPower — a predictive maintenance and fleet availability platform for the air fleet, built for problem statement 26249 from the Ministry of Defence, Defence Services Staff College.
>
> The problem statement says this, in one sentence: *"Low aircraft availability due to fragmented and largely reactive maintenance practices across the air fleet. Maintenance data from aircraft health-monitoring systems, technical records, spares and maintenance agencies is not adequately integrated — resulting in delayed fault prediction, avoidable aircraft downtime, and sub-optimal utilisation of critical assets."*
>
> In plain words: aircraft are on the ground more than they should be, because the people who maintain them are looking at four different systems that never talk to each other — and so they find out about a fault *after* it grounds the aircraft, not before.

**✍ Note:** Slow down on the four italics — *fragmented*, *reactive*, *delayed*, *avoidable*. Don't click anything yet; this scene is about the problem, not the product.

---

### Scene 2 — 0:45–1:35 · Why it happens: the root-cause chain

**🖥 On screen:** Still on Fleet overview. Point the cursor at the **availability KPI (75%)**, then move to the **downtime pareto chart**, circling the "avoidable" portion.

**🎤 Say:**

> Let's break that sentence into a chain, because the chain *is* the story.
>
> Four data sources live in silos: the onboard health-monitoring system knows the engine is degrading; the tech record knows the last three defects; stores knows the spare is out of stock; the depot knows its repair queue. Nobody sees all four at once. So faults are discovered late — maintenance becomes reactive: work starts only when a pilot reports a symptom or a red light comes on. By then the aircraft is already on the ground, unannounced. Then you wait for a part with a 45-day lead time that should have been ordered a month ago. The result is avoidable downtime, wasted flying hours, and the headline symptom — low fleet availability.
>
> Our thesis in one line: **integrate the four sources → predict days earlier → act before the aircraft is grounded → availability goes up.** Everything you're about to see is that arrow chain, turned into software.

**✍ Note:** Point at the pareto when you say "avoidable downtime". Pause half a second after the thesis line — it's the sentence judges remember.

---

### Scene 3 — 1:35–2:05 · The idea: a closed loop, not a model

**🖥 On screen:** Move the cursor down the left sidebar, touching each nav item as you name the loop: Predictive faults → Work control → Spares & stores.

**🎤 Say:**

> One important design decision: the problem is *not* "we lack AI". Prediction is worthless if its output never reaches the person who schedules the work and the person who orders the part. So we built AirPower as a **closed loop**, not a dashboard: detect → predict → recommend → acknowledge → raise a work order → indent the spare → audit every step.
>
> The platform has eight pages covering that loop, and I'll walk you through the seven that matter. Live, at the deployed URL.

**✍ Note:** Keep it to 30 seconds. This scene exists purely to frame the demo that follows.

---

### Scene 4 — 2:05–3:05 · Fleet overview — "can we fly today?"

**🖥 On screen:** Already here. Point at each KPI as you say it: **Fleet availability 75% ▲7**, **Mission capable 80% ▲6**, mean early warning, downtime hours avoided. Then the **AOG banner** (red), the **12-month availability trend** (solid line vs dashed reactive baseline), and finally the **5-source health strip**.

**🎤 Say:**

> This is the screen a duty controller opens at 06:00. Four numbers answer the only question that matters: *can we fly today?*
>
> Fleet availability: **75 percent, up 7 points** against the pre-platform baseline of 68. Mission-capable: **80 percent**. Mean early warning: **5.3 days** — that's how far ahead of a failure the system now speaks, when before, the crew found out when the light came on. And downtime hours avoided: **5,957 hours** in the rolling 30 days, with 25 failures averted.
>
> The red AOG banner is the exception that must never be normal — click any row and it drills straight into that aircraft.
>
> Behind the numbers: the 12-month trend shows this platform's approach against a reactive-only baseline — same fleet, same missions, different maintenance strategy. The Pareto shows where the downtime hours actually go, and the striped portion is the *avoidable* share — that's exactly what a predictive platform attacks first. And the source-health strip along the bottom reminds us this whole picture is only as good as the five feeds underneath it — which I'll show you in a moment.

**✍ Note:** Speak the numbers slower than the prose. If the trend chart legend is small, hover it so the tooltip shows.

---

### Scene 5 — 3:05–4:20 · Digital twin — IoT health monitoring + live detection

**🖥 On screen:** Click **Digital twin** in the sidebar. Pick a tail (default is fine). Wait for the traces to start scrolling. Point at: the airframe replica with its 8 labelled system callouts → click a **system node** → the **life-limited parts** panel (fatigue, engine life, brakes, tyres) → then the **live telemetry** panel: 17 channels, updating every 2 seconds, with the z-score / detector score chip visible.

**🎤 Say:**

> This is the digital twin — one airframe, its own record. The replica shows every major system with its health percentage; the callouts are positioned so nothing overlaps, and clicking a node switches the subsystem below.
>
> Down here are the life-limited parts — fatigue usage, engine life remaining, brakes, tyres — the items that quietly decide when an aircraft must hang up its tyres whether it feels sick or not.
>
> And this is the IoT part: **17 sensor channels per airframe — 340 across the fleet — streaming at 2-second resolution.** EGT margin, vibration, hydraulic pressure, crack-gauge, oil temperature. Every sample is scored against *this aircraft's own learned baseline* by a real online detector — EWMA baseline, z-score, then a CUSUM accumulator. Watch the score chip: a slow, sustained shift that never crosses a hard threshold still accumulates and fires. When it does, you get a LIVE anomaly banner and an audit event.
>
> That matters because *delayed fault prediction* — the problem statement's exact words — happens precisely when a small drift sits under the threshold of everyone's attention.

**✍ Note:** Give the stream ~10 seconds of near-silence so viewers *see* it tick — that's your IoT proof shot. If a LIVE anomaly banner appears, stop and point at it: free drama, take it.

---

### Scene 6 — 4:20–5:50 · Predictive faults — the closed loop ★ (the climax)

**🖥 On screen:** Click **Predictive faults**. Point at the alert count (29 active) and severity badges. Select the **top CRITICAL alert**. Show: predicted RUL + confidence, the **feature-contribution bars** (why the model fired), recommended action, and the outcome log. Then — deliberately, one at a time — click **Acknowledge**, then **Raise work order**, then **Indent spare**. Let each click visibly register. Finally scroll to the **audit log** and point at the new entries.

**🎤 Say:**

> Here is the heart of the platform: 29 active AI predictions, most urgent first. Pick one and you don't just get a red flag — you get the *why*. Feature contributions show which channels drove this alert: EGT margin erosion, vibration trend, cycles accumulated. Predicted remaining useful life: **days, with a confidence band**, and a recommended action with the part already identified. And every alert carries an outcome — caught early, false positive, missed — because a model you can't audit is a model you can't trust.
>
> Now watch the loop close. Three buttons.
>
> **Acknowledge** — a human says *yes, this is real*. **Raise work order** — done: a predictive job now exists, and I'll show you where it landed in ten seconds. **Indent spare** — the part is reserved *before* the aircraft is down, with an ETA.
>
> Each click wrote to shared state and stamped the audit log — timestamped, attributable, and it survives a reload. That's the difference between a slide deck and a working prototype. Detect → predict → decide → act → prove, all on one screen.

**✍ Note:** This is where judges lean in — click slowly, one button per sentence, and *wait* for the toast/state change before continuing. Never rush these three clicks.

---

### Scene 7 — 5:50–6:30 · Work control + Spares — the write-back

**🖥 On screen:** Click **Work control** — point at the job tagged `raised by you · PRD-xxxx`. Then click **Spares & stores** — point at **Live indents** showing your indent at `RAISED`, and click through `APPROVED → RECEIVED` if you want the motion. Point at a risk-flagged line (cover-days < lead time).

**🎤 Say:**

> The work order I just raised is right here — 51 orders on the board, agency load and turnaround times visible, a 14-day window to schedule against. Because the alert arrived five days early, this job gets slotted into servicing that had to happen anyway — *that* is where the downtime saving comes from, not from working faster.
>
> And stores sees the same thing: the indent I raised is now in Live indents, advancing RAISED → APPROVED → RECEIVED. The ledger also flags every line whose cover-days are shorter than the supplier's lead time — eleven of twelve lines today — so long-lead parts get ordered *before* the aircraft is on jacks.

**✍ Note:** 40 seconds each, tops. If time is tight, do Spares only and gesture at Work control.

---

### Scene 8 — 6:30–7:15 · Data integration — the actual root cause

**🖥 On screen:** Click **Data integration**. Point at the **5 source feeds** (IoT/ACMS, tech records, stores ERP, agency/depot, flight ops) with sync states — note one is deliberately **STALE**, one **SYNCING** — then the **312 schema mappings**, the **5 data-quality guards**, and the **20 unified tech records** cross-tagged by source. Optional: scroll to **Bring your own sensor data (CSV)** and drop a file; the same detector reports alarms per sample.

**🎤 Say:**

> Now the page that answers the problem statement head-on, because integration — not AI — is the actual root cause. Five feeds: aircraft health monitoring, technical records, stores ERP, the maintenance agencies, flight operations. Each shows its sync state, freshness and record count — and yes, one is deliberately stale, because pretending every feed is perfect is how rot starts in real systems.
>
> 312 schema mappings turn four dialects into one canonical aircraft record; five quality guards quarantine bad records instead of feeding them to the models; and the twenty unified tech records below are cross-tagged with their source — one aircraft, one truth.
>
> Best part: this detector isn't demo-only. Drop a real sensor export into *Bring your own data*, and the same EWMA-z-CUSUM code learns its baseline and reports alarms per sample.

**✍ Note:** If you do the CSV drop, keep it under 20 seconds — start the upload while talking and point at the result line ("N anomalies, first alarm at sample X").

---

### Scene 9 — 7:15–7:55 · Maintenance analytics — before vs after

**🖥 On screen:** Click **Maintenance analytics**. Show the **six-metric before/after table** row by row, then wave at the **model registry** (4 models with MAE/precision/drift) and the **risk horizon**.

**🎤 Say:**

> Command's screen: before versus after, on every metric the problem statement names. Availability 68 → 75. Mission capable 74 → 80. MTBF 34.5 → 42.3 flight hours. Time to repair 41 → 21.9 hours. Spares fill rate 71 → 100 percent. And the one that defines the cultural shift: **reactive share of work, 69 percent down to 31 percent.**
>
> Every figure here derives from a single baseline constant — the KPI cards, the trend chart and this table can never disagree. And the model registry shows all four models with their accuracy and drift status, because models decay quietly if nobody watches them.

**✍ Note:** Read the six rows with rhythm — one beat each. Don't paraphrase the numbers.

---

### Scene 10 — 7:55–8:45 · Honesty, roadmap, close

**🖥 On screen:** Click back to **Fleet overview** so the video ends where it began. Hold the frame steady for the closing line.

**🎤 Say:**

> Let me be honest about what's real, because judges always ask. The **detection algorithm is real** — online, stateful, and it scores imported files. The **actions are real** — persisted, auditable, they survive a reload. The **integration logic is real** — mappings, guards, unified records. What's simulated in this MVP is the data source itself and the RUL model's training: in production these plug into an ACMS or MQTT gateway, three years of fleet history, and write-back into the MRO and ERP with role-based access — ATA iSpec 2200 for records, MIMOSA for condition data.
>
> The roadmap: 30 days for a live connector and authentication; 90 days for trained RUL models and MRO write-back; 180 days for multi-fleet rollout.
>
> The result you're looking at: **75% availability, 5,957 downtime hours avoided, and a fleet that goes for maintenance because we decided it — not because it broke.**
>
> That's AirPower. Integrated data → days of warning → aircraft that fly when the mission says so.

**✍ Note:** Deliver the last sentence slower than anything else in the video, then stop recording after 2 seconds of stillness. Say the "simulated" part with confidence — owning the boundary is what separates a prototype from a bluff.

---

## 3 · Delivery tips

- **Pace:** ~140–150 wpm. The script runs ~8:45 at that pace; if you naturally speak faster, pause 2 beats after every number.
- **Cursor = your finger.** Circle what you're naming, stop moving while a sentence lands, never wiggle idly.
- **One idea per click.** If a sentence doesn't match what's on screen, cut the sentence — not the click.
- **Fail-safe take:** record Scene 6 (the closed loop) as a standalone first take; it's the highest-stakes 90 seconds, and you can stitch takes if needed.
- **Recording tools:** OBS (free) for screen + mic, or Loom if you want it fast — either is fine at 1080p.
- **If you blank:** say the thesis line — *"integrate, predict, act, prove"* — it's always true and buys you a second.

## 4 · One-line summary (pin this at the top of your script)

> **AirPower integrates the fleet's four data silos into one aircraft record, predicts failures 5.3 days early with a real online detector, and closes the loop by raising the work order and spare part itself — turning 69% reactive maintenance into 69% planned, and availability from 68% to 75%.**
