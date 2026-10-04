"""Digital-twin component models and their prognostic (RUL) estimators.

Three prognostic families are used, matching the asset type:
  * EngineComponent    - data-driven ML on C-MAPSS turbofan telemetry (replayed live).
  * TrendComponent     - health-indicator trend extrapolation (exponential degradation).
  * StructureComponent - physics-based Paris-law crack growth calibrated online to SHM data.
All RUL values are expressed in sorties (1 sortie == 1 engine cycle).
"""
from __future__ import annotations

import numpy as np

from .rul_model import RUL_CAP, SENSORS, window_features

PARIS_M = 3.0
PARIS_Y = 1.12
PARIS_C_NOMINAL = 9.6e-11  # m/cycle, (MPa*sqrt(m))^-m  (7xxx Al alloy order of magnitude)
STRESS_PER_G = 22.0        # MPa per g at wing root
LOAD_CYCLES_PER_SORTIE = 30
A_CRIT = 0.012             # 12 mm critical crack length
GEOM = (PARIS_Y * np.sqrt(np.pi)) ** PARIS_M


def causal_median3(x: np.ndarray) -> np.ndarray:
    out = x.copy()
    if len(x) >= 3:
        out[2:] = np.median(np.stack([x[:-2], x[1:-1], x[2:]]), axis=0)
    return out


def usage_factor(rng, n: int) -> np.ndarray:
    """Future-usage uncertainty: sortie mix / load severity may deviate ~12% from the recent past."""
    return rng.lognormal(0.0, 0.12, n)


class Component:
    kind = "generic"

    def __init__(self, cid: str, name: str, sku: str, spec: dict):
        self.id, self.name, self.sku, self.spec = cid, name, sku, spec
        self.pred: dict = {}
        self.pred_history: list[dict] = []
        self.installs = 1

    def record_prediction(self, pred: dict):
        self.pred = {**pred, "true_rul": float(self.true_rul()), "age": int(self.age)}
        self.pred_history.append(self.pred)
        self.pred_history = self.pred_history[-160:]

    def health_index(self) -> float:
        return 100.0


class EngineComponent(Component):
    kind = "engine"

    def __init__(self, cid, name, sku, spec, traj: np.ndarray, unit_key: str, start: int, rng, stats):
        super().__init__(cid, name, sku, spec)
        self.unit_key = unit_key
        noise = np.zeros_like(traj)
        spikes = rng.random(len(traj)) < 0.03
        cols = rng.integers(0, traj.shape[1], len(traj))
        noise[np.where(spikes)[0], cols[spikes]] = rng.choice([-1, 1], spikes.sum()) * 7 * stats["std"][cols[spikes]]
        self.raw = traj + noise
        self.clean = causal_median3(self.raw)
        self.age = int(start)
        self.stats = stats

    @property
    def life(self) -> int:
        return len(self.raw)

    def true_rul(self) -> int:
        return self.life - self.age

    def step(self, mission: dict) -> bool:
        self.age += 1
        return self.age >= self.life

    def features(self) -> np.ndarray:
        return window_features(self.clean[: max(self.age, 1)], max(self.age, 1))

    def state(self) -> dict:
        hist = self.clean[: self.age]
        ewm = hist[-10:].mean(axis=0)
        z = (ewm - self.stats["mean"]) / self.stats["std"] * self.stats["direction"]
        raw_z = np.abs(self.raw[self.age - 1] - self.stats["mean"]) / self.stats["std"]
        flags = [SENSORS[i] for i in np.where(z > 3)[0]]
        transients = [SENSORS[i] for i in np.where((raw_z > 5) & (np.abs(z) < 3))[0]]
        fan = float(np.mean(z[[SENSORS.index(s) for s in ("s8", "s13", "s15")]]))
        hpc = float(np.mean(z[[SENSORS.index(s) for s in ("s3", "s7", "s11", "s12")]]))
        return {"z": {s: float(v) for s, v in zip(SENSORS, z)}, "flags": flags, "transients": transients,
                "fan_score": fan, "hpc_score": hpc}

    def health_index(self) -> float:
        return float(np.clip(self.pred.get("rul", RUL_CAP) / RUL_CAP, 0, 1) * 100)


class TrendComponent(Component):
    kind = "trend"
    TAUS = np.geomspace(25, 900, 18)

    def __init__(self, cid, name, sku, spec, life: int, age: int, rng):
        super().__init__(cid, name, sku, spec)
        self.L = int(life)
        self.tau = self.L / rng.uniform(2.5, 5.0)
        self.rng = rng
        self.age = 0
        self.ages: list[int] = []
        self.obs: list[float] = []
        for _ in range(age):
            self.step(None)

    def degradation(self, t) -> np.ndarray:
        return (np.exp(np.asarray(t) / self.tau) - 1) / (np.exp(self.L / self.tau) - 1)

    def true_rul(self) -> int:
        return self.L - self.age

    def step(self, mission) -> bool:
        self.age += 1
        s = self.spec
        self.ages.append(self.age)
        self.obs.append(float(s["baseline"] + s["span"] * self.degradation(self.age) + self.rng.normal(0, s["noise"])))
        if len(self.obs) > 400:
            self.ages, self.obs = self.ages[-400:], self.obs[-400:]
        return self.age >= self.L

    def prognose(self) -> dict:
        s = self.spec
        t = np.array(self.ages[-150:], float)
        r = np.array(self.obs[-150:]) - s["baseline"]
        if len(t) < 5:
            return {"rul": float(self.L), "rul_lo": 0.0, "rul_hi": float(2 * self.L), "rul_safe": 0.0, "fit": None}
        E = np.exp(t[None, :] / self.TAUS[:, None])                      # (k, n)
        B = (E * r).sum(1) / (E * E).sum(1)
        sse = ((r[None, :] - B[:, None] * E) ** 2).sum(1)
        k = int(np.argmin(sse))
        fitted = B[k] * E[k]
        resid = r - fitted
        nb = 40
        boot = fitted[None, :] + self.rng.choice(resid, size=(nb, len(t)))
        EE = (E * E).sum(1)
        Bb = boot @ E.T / EE[None]                                         # (nb, k)
        sseb = (boot * boot).sum(1)[:, None] - Bb**2 * EE[None]
        kb = np.argmin(sseb, 1)
        Bsel = np.maximum(Bb[np.arange(nb), kb], 1e-9)
        tb = self.TAUS[kb] * np.log(np.maximum(s["span"] / Bsel, 1e-9))
        rul = self._t_star(B[k], self.TAUS[k]) - self.age
        cap = 2.0 * self.spec["life"][1]
        rb = np.clip((tb - self.age) * usage_factor(self.rng, nb), 0, cap)
        rul = float(np.clip(rul, 0, cap))
        lo, hi = float(np.percentile(rb, 5)), float(np.percentile(rb, 95))
        return {"rul": rul, "rul_lo": min(lo, rul), "rul_hi": max(hi, rul),
                "rul_safe": float(min(np.percentile(rb, 30), rul)),
                "fit": {"tau": float(self.TAUS[k]), "B": float(B[k]), "current": float(fitted[-1] + s["baseline"]),
                        "threshold": s["baseline"] + s["span"]}}

    def _t_star(self, B: float, tau: float) -> float:
        if B <= 1e-9:
            return 1e9
        return float(tau * np.log(max(self.spec["span"] / B, 1e-9)))

    def health_index(self) -> float:
        cur = (self.pred.get("fit") or {}).get("current", self.spec["baseline"])
        return float(np.clip(1 - (cur - self.spec["baseline"]) / self.spec["span"], 0, 1) * 100)


class StructureComponent(Component):
    """Wing-root fatigue crack governed by Paris' law: da/dN = C (dK)^m, dK = Y dS sqrt(pi a).

    Closed form (m != 2):  a^(1-m/2) = a0^(1-m/2) + (1-m/2) C (Y sqrt(pi))^m * sum(dS^m)
    so the transformed SHM measurement z = a^(-1/2) is linear in cumulative load damage S.
    The slope gives a per-airframe estimate of C, which is then used to project RUL.
    """
    kind = "paris"

    def __init__(self, cid, name, sku, spec, age: int, rng, c_factor: float):
        super().__init__(cid, name, sku, spec)
        self.rng = rng
        self.C = PARIS_C_NOMINAL * c_factor
        self.a = 0.001 * rng.uniform(0.8, 1.2)
        self.age = 0
        self.S = 0.0
        self.ages: list[int] = []
        self.cumS: list[float] = []
        self.dS: list[float] = []
        self.meas: list[float] = []
        self.failed = False
        mission = {"g_mean": 4.7, "g_sd": 0.9}
        for _ in range(age):
            self.step(mission)
            if self.failed:
                break

    def _expected_s(self) -> float:
        return float(np.mean(self.dS[-60:])) if self.dS else 3.5e7

    def true_rul(self) -> int:
        z_now, z_c = self.a ** (1 - PARIS_M / 2), A_CRIT ** (1 - PARIS_M / 2)
        k = (PARIS_M / 2 - 1) * self.C * GEOM
        return int(max((z_now - z_c) / (k * self._expected_s()), 0))

    def step(self, mission) -> bool:
        mission = mission or {"g_mean": 4.7, "g_sd": 0.9}
        g = np.clip(self.rng.normal(mission["g_mean"], mission["g_sd"], LOAD_CYCLES_PER_SORTIE), 1.5, 9.0)
        dS = float(np.sum((STRESS_PER_G * g) ** PARIS_M))
        z = self.a ** (1 - PARIS_M / 2) - (PARIS_M / 2 - 1) * self.C * GEOM * dS
        self.age += 1
        self.S += dS
        if z <= A_CRIT ** (1 - PARIS_M / 2) or z <= 0:
            self.a = A_CRIT
            self.failed = True
        else:
            self.a = z ** (1 / (1 - PARIS_M / 2))
        self.ages.append(self.age)
        self.cumS.append(self.S)
        self.dS.append(dS)
        self.meas.append(float(max(self.a * 1000 + self.rng.normal(0, 0.05), 0.2)))
        if len(self.meas) > 400:
            self.ages, self.cumS, self.dS, self.meas = (x[-400:] for x in (self.ages, self.cumS, self.dS, self.meas))
        return self.failed

    def prognose(self) -> dict:
        S = np.array(self.cumS[-300:])
        z = (np.array(self.meas[-300:]) / 1000) ** (1 - PARIS_M / 2)
        if len(S) < 10:
            return {"rul": 1e3, "rul_lo": 0.0, "rul_hi": 2e3, "rul_safe": 0.0, "fit": None}
        X = np.stack([np.ones_like(S), S - S[-1]], 1)
        coef, *_ = np.linalg.lstsq(X, z, rcond=None)
        resid = z - X @ coef
        z_c = A_CRIT ** (1 - PARIS_M / 2)
        rate = self._expected_s()
        cap = 2.0 * self.spec["life"][1]

        def rul_of(c):
            slope = -c[1]
            return float(np.clip((c[0] - z_c) / (slope * rate), 0, cap)) if slope > 0 else cap

        boot = (X @ coef)[None, :] + self.rng.choice(resid, size=(60, len(S)))
        cb = np.linalg.lstsq(X, boot.T, rcond=None)[0].T
        slopes = -cb[:, 1]
        rb = np.where(slopes > 0, (cb[:, 0] - z_c) / (np.maximum(slopes, 1e-30) * rate), cap)
        rb = np.clip(rb * usage_factor(self.rng, len(cb)), 0, cap)
        rul = rul_of(coef)
        c_est = float(-coef[1] / ((PARIS_M / 2 - 1) * GEOM))
        a_est = float(max(coef[0], z_c) ** (1 / (1 - PARIS_M / 2)) * 1000)
        return {"rul": rul, "rul_lo": float(min(np.percentile(rb, 5), rul)), "rul_hi": float(max(np.percentile(rb, 95), rul)),
                "rul_safe": float(min(np.percentile(rb, 30), rul)),
                "fit": {"C_est": c_est, "C_nominal": PARIS_C_NOMINAL, "crack_mm": a_est,
                        "critical_mm": A_CRIT * 1000, "m": PARIS_M, "load_per_sortie": rate}}

    def health_index(self) -> float:
        a = (self.pred.get("fit") or {}).get("crack_mm", self.a * 1000)
        return float(np.clip(1 - (a - 1.0) / (A_CRIT * 1000 - 1.0), 0, 1) * 100)
