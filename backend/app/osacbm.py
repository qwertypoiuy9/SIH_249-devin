"""ISO 13374 / MIMOSA OSA-CBM six-block processing trace for a single component."""
from __future__ import annotations

import numpy as np

from .components import A_CRIT, PARIS_M
from .rul_model import RUL_CAP, SENSOR_INFO, SENSORS, WINDOW

CHART_SENSORS = ["s4", "s3", "s7", "s11", "s9", "s12"]


def _r(x, n=2):
    return None if x is None else round(float(x), n)


def trace(sim, ac: dict, comp) -> dict:
    p = comp.pred
    adv = next((a for a in sim.advisories() if a["id"] == f"{ac['tail']}:{comp.id}"), None)
    src, lead = sim.lead_for(ac["base"], comp.sku)
    if comp.kind == "engine":
        blocks, series = _engine_blocks(comp)
    elif comp.kind == "trend":
        blocks, series = _trend_blocks(comp)
    else:
        blocks, series = _paris_blocks(comp)
    days = p["rul_safe"] / ac["sortie_rate"]
    blocks.append({"block": "PA", "name": "Prognostic Assessment",
                   "summary": f"RUL {p['rul']:.0f} sorties (~{p['rul'] * 1.5:.0f} FH); 90% interval "
                              f"{p['rul_lo']:.0f}-{p['rul_hi']:.0f}; safety-biased {p['rul_safe']:.0f}",
                   "data": {"rul_sorties": _r(p["rul"], 1), "rul_lo": _r(p["rul_lo"], 1), "rul_hi": _r(p["rul_hi"], 1),
                            "rul_safe": _r(p["rul_safe"], 1), "rul_flight_hours": _r(p["rul"] * 1.5, 1),
                            "p_fail_10_sorties": _r(_p_fail(p, 10), 3), "p_fail_25_sorties": _r(_p_fail(p, 25), 3),
                            "p_fail_50_sorties": _r(_p_fail(p, 50), 3), "ground_truth_rul_sim": comp.true_rul()}})
    pr = sim.priority_of(comp)
    blocks.append({"block": "AG", "name": "Advisory Generation",
                   "summary": (f"{pr}: {comp.spec['action']} within {days:.0f} days" if pr else
                               "No action required; continue monitoring") ,
                   "data": {"priority": pr or "NONE", "action": comp.spec["action"] if pr else "Monitor",
                            "action_within_days": _r(days, 1), "spare_sku": comp.sku, "spare_source": src,
                            "spare_lead_days": lead, "supply_risk": bool(lead > days),
                            "work_order": adv["work_order"] if adv else None}})
    return {"tail": ac["tail"], "component": sim.component_view(ac, comp), "blocks": blocks, "series": series,
            "prediction_history": [{k: _r(v, 1) for k, v in h.items() if k in ("age", "rul", "rul_lo", "rul_hi", "rul_safe", "true_rul")}
                                   for h in comp.pred_history]}


def _p_fail(p, horizon):
    from math import erf, sqrt
    sd = max((p["rul_hi"] - p["rul_lo"]) / 3.29, 1.0)
    return 0.5 * (1 + erf((horizon - p["rul"]) / (sd * sqrt(2))))


def _engine_blocks(c):
    raw_last = c.raw[c.age - 1]
    clean_last = c.clean[c.age - 1]
    st = c.state()
    lo = max(0, c.age - 150)
    series = [{"t": i + 1, **{f"{s}_raw": _r(c.raw[i, SENSORS.index(s)], 3) for s in CHART_SENSORS},
               **{s: _r(c.clean[i, SENSORS.index(s)], 3) for s in CHART_SENSORS}} for i in range(lo, c.age)]
    diag = "Fan degradation" if st["fan_score"] > st["hpc_score"] + 0.5 else "HPC degradation"
    sep = abs(st["fan_score"] - st["hpc_score"])
    return [
        {"block": "DA", "name": "Data Acquisition",
         "summary": f"{len(SENSORS)} engine parameters at cycle {c.age} (C-MAPSS replay unit {c.unit_key}, via AID / MIL-STD-1553)",
         "data": {SENSOR_INFO[s][0]: _r(v, 3) for s, v in zip(SENSORS, raw_last)}},
        {"block": "DM", "name": "Data Manipulation",
         "summary": f"Causal median-3 de-spiking; {WINDOW}-cycle window features (mean, EWM, slope, std) = {4 * len(SENSORS) + 2} features",
         "data": {SENSOR_INFO[s][0]: _r(v, 3) for s, v in zip(SENSORS, clean_last)}},
        {"block": "SD", "name": "State Detection",
         "summary": (f"{len(st['flags'])} sensors beyond 3σ of healthy baseline" +
                     (" -> CORROBORATED anomaly" if len(st["flags"]) >= 3 else " -> normal / uncorroborated") +
                     (f"; {len(st['transients'])} single-sensor transient(s) suppressed" if st["transients"] else "")),
         "data": {"z_scores": {SENSOR_INFO[s][0]: _r(v) for s, v in st["z"].items()},
                  "flags": [SENSOR_INFO[s][0] for s in st["flags"]],
                  "suppressed_transients": [SENSOR_INFO[s][0] for s in st["transients"]]}},
        {"block": "HA", "name": "Health Assessment",
         "summary": f"Health index {c.health_index():.0f}/100; likely mode: {diag}",
         "data": {"health_index": _r(c.health_index(), 1), "failure_mode": diag,
                  "fan_signature": _r(st["fan_score"]), "hpc_signature": _r(st["hpc_score"]),
                  "diagnostic_confidence": _r(min(0.5 + sep / 6, 0.97))}},
    ], series


def _trend_blocks(c):
    s = c.spec
    fit = c.pred.get("fit") or {}
    ages = c.ages[-150:]
    obs = c.obs[-150:]
    series = [{"t": a, "obs": _r(o, 3)} for a, o in zip(ages, obs)]
    if fit:
        horizon = int(min(c.pred["rul_hi"] + 10, 2 * s["life"][1]))
        for t in list(range(ages[0], c.age + 1, 3)) + list(range(c.age + 3, c.age + horizon, 3)):
            pt = next((x for x in series if x["t"] == t), None)
            val = _r(s["baseline"] + fit["B"] * np.exp(t / fit["tau"]), 3)
            if pt:
                pt["fit"] = val
            else:
                series.append({"t": t, "fit": val})
    for x in series:
        x["threshold"] = s["baseline"] + s["span"]
    series.sort(key=lambda x: x["t"])
    cur = fit.get("current", obs[-1] if obs else s["baseline"])
    return [
        {"block": "DA", "name": "Data Acquisition", "summary": f"{s['sensor']} = {obs[-1]:.2f} {s['unit']} (sortie {c.age})",
         "data": {s["sensor"]: _r(obs[-1], 3), "unit": s["unit"], "samples": len(c.obs)}},
        {"block": "DM", "name": "Data Manipulation", "summary": "Exponential degradation model fit (grid over τ, least-squares amplitude)",
         "data": {"tau_sorties": _r(fit.get("tau"), 1), "amplitude": _r(fit.get("B"), 5), "smoothed_value": _r(cur, 3)}},
        {"block": "SD", "name": "State Detection",
         "summary": "Degraded (fitted indicator > 60% of span)" if c.health_index() < 40 else "Within normal envelope",
         "data": {"baseline": s["baseline"], "failure_threshold": s["baseline"] + s["span"],
                  "degradation_pct": _r(100 - c.health_index(), 1)}},
        {"block": "HA", "name": "Health Assessment", "summary": f"Health index {c.health_index():.0f}/100",
         "data": {"health_index": _r(c.health_index(), 1), "failure_mode": f"Progressive wear ({s['sensor']} drift)"}},
    ], series


def _paris_blocks(c):
    fit = c.pred.get("fit") or {}
    series = [{"t": a, "obs": _r(m, 3), "critical": A_CRIT * 1000} for a, m in zip(c.ages[-150:], c.meas[-150:])]
    if fit:
        z = (fit["crack_mm"] / 1000) ** (1 - PARIS_M / 2)
        k = (PARIS_M / 2 - 1) * fit["C_est"] * (1.12 * np.sqrt(np.pi)) ** PARIS_M * fit["load_per_sortie"]
        for t in range(c.age, c.age + int(min(c.pred["rul_hi"] + 10, 2500)), 5):
            zz = z - k * (t - c.age)
            if zz <= 0:
                break
            series.append({"t": t, "fit": _r(min(zz ** (1 / (1 - PARIS_M / 2)) * 1000, 14), 3), "critical": A_CRIT * 1000})
    return [
        {"block": "DA", "name": "Data Acquisition", "summary": f"CVM crack sensor reading {c.meas[-1]:.2f} mm; load spectrum from g-meter",
         "data": {"crack_mm_reading": _r(c.meas[-1], 3), "load_damage_last_sortie": _r(c.dS[-1], 0)}},
        {"block": "DM", "name": "Data Manipulation", "summary": "Transform z = a^(-1/2), regress on cumulative ΣΔσ^m (Paris-law linearisation)",
         "data": {"C_estimated": fit.get("C_est"), "C_nominal": fit.get("C_nominal"), "m": PARIS_M}},
        {"block": "SD", "name": "State Detection",
         "summary": "Crack beyond 6.6 mm inspection limit" if c.health_index() < 50 else "Crack within allowable",
         "data": {"crack_mm_estimate": _r(fit.get("crack_mm")), "critical_mm": A_CRIT * 1000}},
        {"block": "HA", "name": "Health Assessment", "summary": f"Structural health index {c.health_index():.0f}/100",
         "data": {"health_index": _r(c.health_index(), 1), "failure_mode": "Fatigue crack growth at wing root"}},
    ], sorted(series, key=lambda x: x["t"])
