# AirPower — Hackathon Submission Video Script v2 (7–10 minutes)

> **Purpose:** the narration + screen direction for your SIH 2026 submission video. Structured for **judges scoring on: innovation · technical depth · impact · feasibility · presentation clarity.**
> **Target runtime:** **9:00–9:45** (safe inside 7–10). Spoken text = **1,514 words** — read at a crisp 155–160 wpm and you land at ~9:30 including the built-in pauses; if you speak at ~145 wpm, use the trim list in §3 (cut Scene 4) to land at ~9:00. Nothing to improvise either way.
> **Live URL:** https://airpower-predictive-maintenance.vercel.app · **Repo:** `github.com/qwertypoiuy9/SIH_249-devin` (`main`)
> **Companions:** [video_script.md](video_script.md) (v1), [sih_ppt_content.md](sih_ppt_content.md), [detailed_explanation.md](detailed_explanation.md)

### How to read this document

Every scene gives five lanes:

| Lane | Meaning |
|---|---|
| ⏱ | Cumulative clock — pause the recording if you drift >15 s |
| 🖥 **SCREEN** | Exact clicks/scroll during the narration |
| 🎬 **LOWER-THIRD** | Text overlay / title card to add in editing (copy verbatim) |
| 🎤 **NARRATE** | Verbatim words — read as written; the numbers are load-bearing |
| ✂ **DIRECTION** | Pacing, emphasis, what to do if something misbehaves live |

---

## 0 · Why it's built this way

Judges watch dozens of videos; they score what they can **see**. The structure front-loads the problem (criteria: problem fit), proves the loop with live clicks (innovation + technical depth), shows before/after numbers (impact), and states limits before being asked (feasibility/credibility). Every claim in the narration is a number visible on screen within 10 seconds of saying it.

**Chapter map** (paste into the upload description):

```
0:00 Cold open        2:35 Demo · Overview     6:00 Demo · Data integration
0:35 The problem      3:30 Demo · Digital twin 6:40 Demo · Analytics
1:25 The insight      4:35 Demo · The loop      7:20 Architecture & honesty
2:05 What we built    5:40 Write-back proof     8:00 Impact & roadmap → close
```

---

## 1 · Pre-roll checklist (do BEFORE recording)

1. **Clean demo state:** open the live site → DevTools → Application → Local Storage → clear site data → reload. Guarantees the acknowledge → raise WO → indent sequence produces fresh `raised by you · PRD-xxxx` tags.
2. **Warm the twin:** open Digital twin, pick a tail, wait ~15 s so traces are drawn before you start filming that act.
3. **Prepare the CSV prop:** one small ACMS-style sensor CSV on the desktop for Act 4 (optional; trim note below if you skip it).
4. **Window:** 1440×900 or larger, browser zoom 100%, bookmarks bar hidden, notifications off (Do Not Disturb), close all unrelated tabs.
5. **Mic:** record a 10-second test; sit 20 cm from a cardioid mic; glass of water within reach.
6. **Capture:** OBS, 1920×1080 @ 30 fps, cursor visible (enable cursor highlight if you have it).
7. **Number card open on a second screen** so you never misquote:

   | Claim | Value |
   |---|---|
   | Availability | **75% ▲7 pts** (vs 68% pre-platform) |
   | Mission capable | **80% ▲6** (15/20 fully ready) |
   | Mean early warning | **5.3 days** (▲3.2 d) |
   | Downtime avoided | **5,957 h** · **25 failures averted** (30 d) |
   | Before/after | MTBF 34.5→**42.3** fh · MTTR 41→**21.9** h · fill 71→**100%** · reactive 69→**31%** |
   | Scale | 20 airframes · 340 channels · 29 predictions · 46 open WOs · 5 feeds · 312 mappings · 8 pages |
   | Detector | EWMA (α=0.06) → z-score → CUSUM (k=1.1, h=5.5) |
   | Build | 22 files · 5,719 lines · 248 KB JS (78 KB gz) · push = deploy in ~25 s |

---

## 2 · THE SCRIPT

---

### Scene 1 — ⏱ 0:00–0:35 · Cold open (the hook)

**🖥 SCREEN:** Black title card (0:00–0:06) → cut to the AOG red banner on Fleet overview (2 s) → cut to digital-twin traces ticking (2 s) → cut to the three action buttons on Predictive faults (2 s) → settle on Fleet overview.

**🎬 LOWER-THIRD:** `AIRPOWER · Predictive Maintenance & Fleet Availability · SIH 2026 · PS 26249`

**🎤 NARRATE:**

> An aircraft never fails without warning. The signals — thermal, vibration, fatigue — build up for days. The problem is that in a maintenance organisation where health data, tech records, spares and repair agencies live in **four disconnected systems**, nobody connects those signals until the aircraft is already on the ground.
>
> AirPower fixes that. It is an integrated predictive-maintenance platform for the air fleet that turns those scattered signals into an average of **five and a half days of warning** — and then acts on the warning automatically. You are looking at the working prototype, deployed and live. I'll show you the whole loop in the next nine minutes.

**✂ DIRECTION:** Deliver the first sentence slower than anything else. Land "five and a half days of warning" with a beat of silence after it.

---

### Scene 2 — ⏱ 0:35–1:25 · The problem (criteria: problem fit)

**🖥 SCREEN:** Stay on Fleet overview. Slow cursor sweep across the KPI row → circle the AOG banner → hover the downtime Pareto's striped "avoidable" section.

**🎬 LOWER-THIRD:** `THE PROBLEM — "fragmented … largely reactive … delayed fault prediction … avoidable downtime"`

**🎤 NARRATE:**

> The problem statement from the Ministry of Defence, Defence Services Staff College, is precise: *low aircraft availability due to fragmented and largely reactive maintenance practices, with data from health-monitoring systems, technical records, spares and maintenance agencies not adequately integrated — resulting in delayed fault prediction, avoidable downtime, and sub-optimal utilisation of critical assets.*
>
> Read it as a chain, because the chain is the story. Four data silos → nobody has one complete picture of an aircraft → faults are discovered late → maintenance becomes reactive → the aircraft waits for a part that should have been ordered weeks ago. The result is avoidable downtime, lost flying hours, and the headline symptom: **low fleet availability**. Every number on this screen was chosen to attack one link of that chain.

**✂ DIRECTION:** Point at the AOG banner when you say "on the ground"; circle the Pareto stripe when you say "avoidable downtime". Pause half a second after the thesis chain.

---

### Scene 3 — ⏱ 1:25–2:05 · The insight (criteria: innovation)

**🖥 SCREEN:** Cursor travels down the sidebar — Predictive faults → Work control → Spares & stores — one hover per stage of the loop.

**🎬 LOWER-THIRD:** `THE INSIGHT — a closed loop, not another dashboard`

**🎤 NARRATE:**

> Here is the design decision everything else follows from. The bottleneck is **not** the lack of AI. Prediction is worth nothing if its output never reaches the person who schedules the work and the person who orders the part. So we did not build a dashboard — we built a **closed loop**: detect, predict, recommend, acknowledge, raise the work order, indent the spare, and audit every step.
>
> When the loop closes, maintenance stops being a reaction and becomes a decision. That single sentence is what the rest of this video proves, live.

**✂ DIRECTION:** One sidebar item per verb. Land "a decision" firmly — this is the sentence judges should remember.

---

### Scene 4 — ⏱ 2:05–2:35 · What we built (criteria: technical depth)

**🖥 SCREEN:** Quick visual tour: scroll the Overview page fully once (top to bottom and back).

**🎬 LOWER-THIRD:** `8 pages · React 18 + TypeScript · 340 live channels · deployed on Vercel`

**🎤 NARRATE:**

> The platform is eight pages over one unified aircraft record: fleet overview for command, an inventory of all twenty airframes, a digital twin with live telemetry, predictive faults, work control, spares, the data-integration hub, and maintenance analytics. It is written in strict TypeScript on React, every chart and the aircraft replica are hand-built SVG, and the whole site ships at under 300 kilobytes. It is fully responsive — phone, tablet on the flight line, or a wall display — and it is deployed: every push to `main` reaches production in about twenty-five seconds.

**✂ DIRECTION:** Keep it brisk — this scene buys credibility for the demo, it is not the demo.

---

### Scene 5 — ⏱ 2:35–3:30 · Demo Act 1 — Fleet overview (criteria: problem fit + usability)

**🖥 SCREEN:** Point at each KPI as you name it: **75%** availability ▲7 → **80%** mission capable → **5.3 days** → **5,957 h**. Then the AOG banner ("2 aircraft AOG"), the 12-month trend chart with its dashed reactive baseline, and the five-feed health strip at the bottom.

**🎬 LOWER-THIRD:** `FLEET OVERVIEW — "can we fly today?" in four numbers`

**🎤 NARRATE:**

> This is the screen a duty controller opens at six in the morning, and it answers one question: *can we fly today?*
>
> Fleet availability: **75 percent, up seven points** against the pre-platform baseline of 68. Mission capable: **80 percent** — fifteen of twenty airframes fully ready. Mean early warning: **5.3 days** — the distance the system now speaks ahead of a failure, where before, the crew found out when the light came on. Downtime avoided: **5,957 hours** in the rolling thirty days, with twenty-five failures averted.
>
> The red banner is the exception that must never become normal — two aircraft AOG right now, both with predictive alerts raised *before* they failed. The twelve-month trend shows this approach against a reactive-only baseline: same fleet, same missions, different maintenance strategy. And the source strip at the bottom reminds us the whole picture is only as good as the five feeds underneath it — which I'll come back to, because that is where the real problem lives.

**✂ DIRECTION:** Numbers slower than prose — one clear beat each. Hover the trend legend so the tooltip shows.

---

### Scene 6 — ⏱ 3:30–4:35 · Demo Act 2 — Digital twin + live detection (criteria: technical depth)

**🖥 SCREEN:** Click **Digital twin** → keep the default tail → point at the airframe replica's eight labelled system callouts → click a **system node** → show the life-limited-parts panel → settle on the live telemetry panel and let it tick in silence for 3–4 s → point at the z-score / detector-score chip.

**🎬 LOWER-THIRD:** `DIGITAL TWIN — 17 channels/airframe · 340 fleet-wide · 2-second telemetry · real online detector`

**🎤 NARRATE:**

> This is the digital twin: one airframe, its own record. Eight system callouts, each with a health percentage, and below them the life-limited parts — fatigue usage, engine life, brakes, tyres — the items that ground an aircraft whether it feels sick or not.
>
> And this is the IoT and health-monitoring opportunity made concrete: **seventeen sensor channels on this airframe, three hundred and forty across the fleet, streaming every two seconds.** Every sample is scored against *this aircraft's own learned baseline* by a real online detector — an EWMA baseline, a z-score, then a cumulative-sum accumulator. Watch the score chip: a small sustained drift that would never cross a hard threshold still accumulates, and when it does, it raises a live anomaly banner and writes an audit event. That matters because *delayed fault prediction* — the statement's exact words — happens precisely when a slow drift sits below everyone's attention.

**✂ DIRECTION:** Give the stream 4 seconds of near-silence so judges *see* it move — that is your IoT proof shot. If a LIVE anomaly banner fires during the take, stop and point at it; take the gift.

---

### Scene 7 — ⏱ 4:35–5:40 · Demo Act 3 — The closed loop (criteria: innovation · the climax)

**🖥 SCREEN:** Click **Predictive faults** → point at "29 active predictions" → select the **top CRITICAL alert** → show RUL + confidence → show the **feature-contribution bars** → then, one at a time, deliberately: **Acknowledge** → **Raise work order** → **Indent spare** (wait for each state change to render) → scroll to the **audit log** and point at the new timestamped entries.

**🎬 LOWER-THIRD:** `DETECT → PREDICT → ACKNOWLEDGE → RAISE WO → INDENT SPARE → AUDIT`

**🎤 NARRATE:**

> The heart of the platform: twenty-nine active predictions, most urgent first. Select one and you don't get a red flag — you get the *reason*. Feature contributions show exactly which channels drove this alert. The remaining useful life comes with a confidence band and a recommended action, and the part is already identified. Every alert carries an outcome — caught early, false positive, missed — because a model you cannot audit is a model you cannot trust.
>
> Now watch the loop close. Three buttons, one second apart.
>
> **Acknowledge** — a human confirms it is real. **Raise work order** — a predictive job now exists, and I'll show you where it landed. **Indent spare** — the part is reserved *before* the aircraft is down, with an ETA. Each click wrote to shared state and stamped the audit log: timestamped, attributable, and it survives a page reload. Detect, predict, decide, act, prove — on one screen.

**✂ DIRECTION:** This is the ninety seconds judges lean in for. One button per sentence; never click the next before the UI confirms. If a click doesn't register, repeat the sentence calmly — do not rush.

---

### Scene 8 — ⏱ 5:40–6:00 · Demo Act 3b — Write-back proof

**🖥 SCREEN:** Click **Work control** → point at the order tagged `raised by you · PRD-xxxx` → click **Spares & stores** → point at **Live indents** at `RAISED`, click through `APPROVED → RECEIVED` if time allows.

**🎬 LOWER-THIRD:** `WRITE-BACK — the alert reached the scheduler and the stores officer`

**🎤 NARRATE:**

> Proof that the loop reached the operational systems: the work order I just raised is on the board — forty-six open orders, agencies and turnaround times visible — and because the alert arrived five days early, the job slots into servicing that had to happen anyway. *That* is where the downtime saving comes from. And stores sees the same thing: my indent, advancing from raised to approved to received — parts committed before the aircraft ever touches the ground.

**✂ DIRECTION:** Twenty seconds, no scrolling beyond what's named.

---

### Scene 9 — ⏱ 6:00–6:40 · Demo Act 4 — Data integration (criteria: problem fit — the root cause)

**🖥 SCREEN:** Click **Data integration** → point at the **five feeds** with sync states (note the deliberately STALE one) → the **312 schema mappings** → the **5 quality guards** → the **20 unified tech records** → scroll to *Bring your own sensor data* and (optional) start the CSV drop while narrating.

**🎬 LOWER-THIRD:** `DATA INTEGRATION — 5 sources · 312 mappings · 5 quality guards · 1 unified record`

**🎤 NARRATE:**

> Now the page that answers the problem statement head-on — because integration, not AI, was the actual root cause. Five feeds: aircraft health monitoring, technical records, stores, the maintenance agencies, flight operations. Each shows its sync state and freshness — and yes, one is deliberately stale, because pretending every feed is perfect is how rot starts in real systems.
>
> Three hundred and twelve schema mappings turn four dialects into one canonical aircraft record. Five quality guards quarantine bad records instead of feeding them to the models. And this detector is not demo-only: drop a real sensor export here and the same algorithm learns its baseline and reports alarms per sample.

**✂ DIRECTION:** If you recorded the CSV import, keep it under 15 seconds — start the upload while talking, point at the result line. If not, end on the guards.

---

### Scene 10 — ⏱ 6:40–7:20 · Demo Act 5 — Analytics before/after (criteria: impact)

**🖥 SCREEN:** Click **Maintenance analytics** → read the before/after table row by row → wave at the **model registry** (four models with accuracy and drift) and the **risk horizon**.

**🎬 LOWER-THIRD:** `BEFORE → AFTER — one baseline constant · charts can never disagree`

**🎤 NARRATE:**

> Command's screen: before versus after, on every metric the problem statement names. Availability, 68 to **75**. Mission capable, 74 to **80**. Mean time between failures, 34.5 to **42.3** flight hours. Time to repair, 41 to **21.9** hours. Spares fill rate, 71 to **100 percent**. And the number that defines the cultural shift: **reactive share of work, 69 percent down to 31 percent.**
>
> Every figure here — this table, the KPI cards, the trend chart — derives from one baseline constant, so they can never disagree. And the model registry shows all four models with their accuracy and drift status, because models decay quietly if nobody watches them.

**✂ DIRECTION:** The six rows with rhythm — one beat each. Never paraphrase a number.

---

### Scene 11 — ⏱ 7:20–8:00 · Architecture and honesty (criteria: technical depth + feasibility)

**🖥 SCREEN:** Stay on Analytics (model registry visible) or cut to a static architecture diagram slide if you prepared one. No clicking needed.

**🎬 LOWER-THIRD:** `5 LAYERS — ingest → normalise → score → predict → act → prove`

**🎤 NARRATE:**

> The architecture in one breath, because judges always ask. Layer one: five feeds into a normalised aircraft record. Layer two: the detection layer — the EWMA, z-score and CUSUM code you just watched running — real, online, stateful, and the identical code path scores imported files. Layer three: prediction — remaining useful life with confidence, drivers and recommendations. Layer four: the action layer — persisted, auditable, surviving reloads; in production it writes into the MRO and ERP with role-based access. Layer five: the presentation you are looking at — eight responsive pages, hand-built SVG, a 248-kilobyte bundle.
>
> Being exact about what is simulated: the data source and the RUL training are simulated in this MVP; detection, actions, integration logic and the twin are real. The integration contract targets ATA iSpec 2200 for tech records and MIMOSA OSA-CBM for condition data — the actual standards a base deployment would use.

**✂ DIRECTION:** Deliver the honesty paragraph with confidence, not apology — owning the boundary is what separates a prototype from a bluff.

---

### Scene 12 — ⏱ 8:00–8:40 · Impact and roadmap (criteria: impact + feasibility)

**🖥 SCREEN:** Return to Fleet overview. Let the finished dashboard be the closing image while you narrate numbers.

**🎬 LOWER-THIRD:** `ROADMAP — 30 d: live connector + auth · 90 d: trained RUL + MRO write-back · 180 d: multi-fleet`

**🎤 NARRATE:**

> What this means for the fleet: 5,957 downtime hours avoided in a rolling month; twenty-five failures averted; repair time cut by nearly half; a spare network where eleven of twelve critical lines are flagged *before* they stock out; and utilisation made visible, so an aircraft sitting idle in maintenance shows up as the lost flying hour it actually is.
>
> The path from here is short and specific: thirty days for a live ACMS connector and role-based authentication; ninety days for RUL models trained on real fleet history plus write-back into the MRO with approvals; a hundred and eighty for multi-fleet rollout. The interfaces are already shaped for it.

**✂ DIRECTION:** Steady, forward-looking tone. This is the "we know exactly what happens after the hackathon" beat.

---

### Scene 13 — ⏱ 8:40–9:10 · Close

**🖥 SCREEN:** Static Fleet overview, cursor still. Hold the frame 3 seconds after you stop speaking, then cut.

**🎬 LOWER-THIRD:** `AirPower — integrated data → days of warning → aircraft that fly when the mission says so` + `live · airpower-predictive-maintenance.vercel.app`

**🎤 NARRATE:**

> The problem statement's chain — fragmented data, late prediction, avoidable downtime, low availability — is closed by one loop: **integrate the four sources, predict days earlier, act before the aircraft is grounded.** AirPower turns 69 percent reactive maintenance into 69 percent planned, and availability from 68 percent to 75 — with a working, deployed prototype you can open right now.
>
> Integrated data. Days of warning. Aircraft that fly when the mission says so. Thank you.

**✂ DIRECTION:** Deliver the last sentence at about 80% of your normal speed. Two seconds of stillness. Stop recording.

---

## 3 · Production notes

**Editing**
- **No jump cuts inside Scene 7** — the three-button sequence must be one continuous take; it is your credibility.
- Safe cut points: between every scene (they map to chapters above).
- Add the lower-thirds as simple fades (0.3 s in / 0.2 s out); do not let them cover KPI values.
- Record a thumbnail separately: Fleet overview at 1440×900 with the 75% KPI visible.

**If something misbehaves live**
- *Telemetry not ticking:* reload the Twin page (state persists), or narrate the trace history already on screen — do not wait in silence past 5 seconds.
- *A click doesn't register:* repeat the sentence; never double-click (it toggles).
- *An unexpected LIVE anomaly banner appears:* use it — "and that just fired, live."
- *Numbers differ slightly (live data shifts):* the KPIs are deterministic — if one differs, read what's on screen and adjust; the number card in §1 is authoritative.

**If you need to trim to 7:00** — cut Scene 4 (What we built) entirely, shorten Scene 11 to the honesty paragraph only, and drop the optional CSV beat.
**If you need to stretch toward 10:00** — let the CSV import run fully in Scene 9, add a 20-second beat on Aircraft inventory (filters + utilisation table) between Scenes 5 and 6, and hold the audit log on screen while you explain the outcome log.

**Upload hygiene** — export at 1080p, add the chapter map from §0 as the description, title it: *"AirPower — Predictive Maintenance & Fleet Availability | SIH 2026 | PS 26249"*.

---

## 4 · Quality bar (what makes this version "the winning one")

1. **Claim-proof pairing** — every spoken number appears on screen within 10 seconds of being said.
2. **One thesis, stated three times** (scenes 1, 3, 13): *integrate → predict → act*.
3. **Live-proof climax** — the three-button loop in one unbroken take.
4. **Honesty before the question** — real vs simulated stated unprompted at 7:45.
5. **No filler** — 1,320 words, 9 minutes, every sentence either explains, proves, or quantifies.
6. **Judges' five criteria each get a dedicated, labelled beat** — problem (2), innovation (3, 7), technical depth (4, 6, 11), impact (10, 12), feasibility (11, 12).
