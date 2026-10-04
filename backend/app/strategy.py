"""Monte Carlo comparison of maintenance policies over a planning horizon.

Common random numbers: every policy sees the same component lifetimes, sortie draws and
spare-availability draws, so differences come from the policy alone. Engine lifetimes are the
empirical C-MAPSS run-to-failure lives; predictive-policy errors are the RUL model's actual
residuals on the held-out C-MAPSS test set.
"""
from __future__ import annotations

from functools import lru_cache

import numpy as np

from . import catalog as cat
from .rul_model import load_split

COMPONENTS = [
    {"key": "ENG", "repair": 6, "sched": 3, "cost": 100.0},
    {"key": "HYD", "repair": 2, "sched": 1, "cost": 4.0},
    {"key": "MLG", "repair": 3, "sched": 1, "cost": 6.0},
    {"key": "RAD", "repair": 3, "sched": 1, "cost": 12.0},
]
SUB_LIFE = {s["key"]: s["life"] for s in cat.SUBSYSTEMS}
UNSCHEDULED_PENALTY = 0.5  # secondary damage, troubleshooting, recovery (fraction of part cost)


@lru_cache(maxsize=1)
def engine_lives() -> np.ndarray:
    lives = []
    for fd in ("FD001", "FD003"):
        lives += load_split("train", fd).groupby("unit")["cycle"].max().tolist()
    return np.array(lives)


def _residual_sampler(scatter: list[dict]):
    true = np.array([s["true"] for s in scatter])
    err = np.array([s["pred"] for s in scatter]) - true
    bins = [(0, 25), (25, 60), (60, 1e9)]
    pools = [err[(true >= a) & (true < b)] for a, b in bins]

    def sample(rng, rul):
        for (a, b), pool in zip(bins, pools):
            if a <= rul < b and len(pool):
                return float(rng.choice(pool))
        return 0.0
    return sample


def simulate(model_metrics: dict, days: int = 365, n_aircraft: int = 24, sortie_rate: float = 1.2,
             seed: int = 11, reps: int = 3, threshold: float = 15.0) -> dict:
    sampler = _residual_sampler(model_metrics["scatter"])
    elives = engine_lives()
    results = {}
    for policy in ("reactive", "preventive", "predictive"):
        agg = {"ao": [], "unscheduled": 0, "removals": 0, "life_used": [], "downtime": 0, "cost": 0.0,
               "series": np.zeros(days)}
        for r in range(reps):
            rng = np.random.default_rng(seed + r)
            out = _run(policy, rng, elives, sampler, days, n_aircraft, sortie_rate, threshold)
            agg["series"] += out["series"] / reps
            for k in ("unscheduled", "removals", "downtime", "cost"):
                agg[k] += out[k] / reps
            agg["life_used"] += out["life_used"]
        results[policy] = {"ao": round(float(agg["series"].mean()), 1),
                           "unscheduled_failures": round(agg["unscheduled"], 1),
                           "removals": round(agg["removals"], 1),
                           "life_used_pct": round(100 * float(np.mean(agg["life_used"])), 1) if agg["life_used"] else None,
                           "downtime_days": round(agg["downtime"], 1), "cost_index": agg["cost"],
                           "series": agg["series"]}
    base = results["preventive"]["cost_index"] or 1.0
    series = [{"day": d, **{p: round(float(results[p]["series"][d]), 1) for p in results}} for d in range(0, days, 3)]
    for p in results:
        results[p]["cost_index"] = round(100 * results[p]["cost_index"] / base, 1)
        del results[p]["series"]
    return {"days": days, "n_aircraft": n_aircraft, "sortie_rate": sortie_rate, "reps": reps,
            "policies": results, "series": series,
            "assumptions": {"preventive_interval": "10th percentile of component life (hard-time)",
                            "predictive_trigger": f"predicted RUL <= {threshold:.0f} sorties + spare lead time",
                            "engine_life_source": "NASA C-MAPSS FD001/FD003 run-to-failure lives",
                            "prediction_error_source": "RUL model residuals on held-out C-MAPSS test units",
                            "spares": "50% chance spare on base for unplanned demand, else 2-6 day transfer"}}


def _life(rng, key, elives):
    if key == "ENG":
        return float(rng.choice(elives))
    a, b = SUB_LIFE[key]
    return float(rng.uniform(a, b))


def _run(policy, rng, elives, sampler, days, n_ac, rate, threshold):
    # Pre-draw everything so all policies share the same random streams.
    life_rng = np.random.default_rng(rng.integers(1 << 31))
    fly_rng = np.random.default_rng(rng.integers(1 << 31))
    sup_rng = np.random.default_rng(rng.integers(1 << 31))
    err_rng = np.random.default_rng(rng.integers(1 << 31))
    lives = [[_life(life_rng, c["key"], elives) for c in COMPONENTS] for _ in range(n_ac)]
    age = [[float(life_rng.uniform(0, 0.8)) * lives[a][i] for i in range(len(COMPONENTS))] for a in range(n_ac)]
    intervals = {c["key"]: (np.percentile(elives, 10) if c["key"] == "ENG" else
                            SUB_LIFE[c["key"]][0] + 0.1 * (SUB_LIFE[c["key"]][1] - SUB_LIFE[c["key"]][0]))
                 for c in COMPONENTS}
    down_until = [0] * n_ac
    out = {"unscheduled": 0, "removals": 0, "life_used": [], "downtime": 0, "cost": 0.0, "series": np.zeros(days)}
    for d in range(days):
        avail = 0
        for a in range(n_ac):
            sorties = min(int(fly_rng.poisson(rate)), 3)
            spare_wait = 0 if sup_rng.random() < 0.5 else int(sup_rng.integers(2, 7))
            if d < down_until[a]:
                continue
            avail += 1
            for i, c in enumerate(COMPONENTS):
                key = c["key"]
                rul = lives[a][i] - age[a][i]
                replace, unsched = False, False
                if policy == "preventive" and age[a][i] >= intervals[key]:
                    replace = True
                elif policy == "predictive":
                    err = sampler(err_rng, rul) if key == "ENG" else err_rng.normal(0, 0.1) * rul
                    if rul + err <= threshold + 4 * rate:
                        replace = True
                if not replace and rul <= sorties:
                    replace, unsched = True, True
                if replace:
                    out["removals"] += 1
                    out["life_used"].append(min(age[a][i] / lives[a][i], 1.0))
                    dt = (c["repair"] + 1 + spare_wait) if unsched else c["sched"]
                    out["cost"] += c["cost"] * (1 + (UNSCHEDULED_PENALTY if unsched else 0))
                    out["unscheduled"] += unsched
                    down_until[a] = max(down_until[a], d + dt)
                    out["downtime"] += dt
                    lives[a][i] = _life(life_rng, key, elives)
                    age[a][i] = 0.0
                else:
                    age[a][i] += sorties
        out["series"][d] = 100 * avail / n_ac
    return out
