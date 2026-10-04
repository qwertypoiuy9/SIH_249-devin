"""Data-driven Remaining Useful Life (RUL) model for turbofan engines.

Trained and validated on the public NASA C-MAPSS FD001 + FD003 benchmark.
Uncertainty is produced with Conformalized Quantile Regression (CQR) and a
safety-biased estimate is reported alongside the point estimate so that
decisions are penalised against late predictions (NASA asymmetric S-score).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "cmapss"
ARTIFACT_PATH = Path(__file__).resolve().parent.parent / "artifacts" / "rul_model.joblib"

COLUMNS = ["unit", "cycle", "op1", "op2", "op3"] + [f"s{i}" for i in range(1, 22)]
SENSORS = ["s2", "s3", "s4", "s7", "s8", "s9", "s11", "s12", "s13", "s14", "s15", "s17", "s20", "s21"]
SENSOR_INFO = {
    "s2": ("T24", "LPC outlet temperature", "°R"),
    "s3": ("T30", "HPC outlet temperature", "°R"),
    "s4": ("T50", "LPT outlet temperature (EGT)", "°R"),
    "s7": ("P30", "HPC outlet pressure", "psia"),
    "s8": ("Nf", "Physical fan speed", "rpm"),
    "s9": ("Nc", "Physical core speed", "rpm"),
    "s11": ("Ps30", "HPC static pressure", "psia"),
    "s12": ("phi", "Fuel flow / Ps30", "pps/psi"),
    "s13": ("NRf", "Corrected fan speed", "rpm"),
    "s14": ("NRc", "Corrected core speed", "rpm"),
    "s15": ("BPR", "Bypass ratio", "-"),
    "s17": ("htBleed", "Bleed enthalpy", "-"),
    "s20": ("W31", "HPT coolant bleed", "lbm/s"),
    "s21": ("W32", "LPT coolant bleed", "lbm/s"),
}
RUL_CAP = 125
WINDOW = 30
ALPHA = 0.10  # 90% prediction intervals
SAFETY_QUANTILE = 0.30


def load_split(name: str, fd: str) -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / f"{name}_{fd}.txt", sep=r"\s+", header=None, names=COLUMNS)
    df["fd"] = fd
    return df


def load_rul(fd: str) -> np.ndarray:
    return pd.read_csv(DATA_DIR / f"RUL_{fd}.txt", header=None)[0].to_numpy()


def window_features(values: np.ndarray, cycle: int) -> np.ndarray:
    """Feature vector for one engine from its most recent sensor history.

    values: (n_cycles, len(SENSORS)) raw sensor readings, oldest first.
    """
    w = values[-WINDOW:]
    n = len(w)
    t = np.arange(n, dtype=float)
    if n > 1:
        t_c = t - t.mean()
        slope = (t_c[:, None] * (w - w.mean(axis=0))).sum(axis=0) / (t_c**2).sum()
    else:
        slope = np.zeros(w.shape[1])
    ewm = w[0].copy()
    for row in w[1:]:
        ewm = 0.8 * ewm + 0.2 * row
    return np.concatenate([w.mean(axis=0), ewm, slope, w.std(axis=0), [cycle, min(n, WINDOW)]])


def build_training_rows(df: pd.DataFrame, stride: int = 1):
    X, y, groups = [], [], []
    for (fd, unit), g in df.groupby(["fd", "unit"]):
        vals = g[SENSORS].to_numpy()
        max_cycle = g["cycle"].max()
        for end in range(5, len(g) + 1, stride):
            X.append(window_features(vals[:end], end))
            y.append(min(max_cycle - end, RUL_CAP))
            groups.append(f"{fd}-{unit}")
    return np.array(X), np.array(y, dtype=float), np.array(groups)


def nasa_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    d = np.asarray(y_pred) - np.asarray(y_true)
    return float(np.sum(np.where(d < 0, np.exp(-d / 13) - 1, np.exp(d / 10) - 1)))


def _hgb(**kw) -> HistGradientBoostingRegressor:
    return HistGradientBoostingRegressor(max_iter=400, learning_rate=0.05, max_leaf_nodes=31,
                                         min_samples_leaf=40, l2_regularization=1.0, random_state=7, **kw)


@dataclass
class RULModel:
    point: HistGradientBoostingRegressor
    lo: HistGradientBoostingRegressor
    hi: HistGradientBoostingRegressor
    safe: HistGradientBoostingRegressor
    cqr_q: float
    metrics: dict = field(default_factory=dict)
    replay_units: list = field(default_factory=list)

    def predict(self, values: np.ndarray, cycle: int) -> dict:
        x = window_features(values, cycle)[None, :]
        p = float(np.clip(self.point.predict(x)[0], 0, RUL_CAP))
        lo = float(np.clip(self.lo.predict(x)[0] - self.cqr_q, 0, RUL_CAP))
        hi = float(np.clip(self.hi.predict(x)[0] + self.cqr_q, 0, RUL_CAP + 40))
        safe = float(np.clip(min(self.safe.predict(x)[0], p), 0, RUL_CAP))
        return {"rul": p, "rul_lo": min(lo, p), "rul_hi": max(hi, p), "rul_safe": max(safe, min(lo, p))}

    def predict_batch(self, X: np.ndarray) -> list[dict]:
        if len(X) == 0:
            return []
        p = np.clip(self.point.predict(X), 0, RUL_CAP)
        lo = np.minimum(np.clip(self.lo.predict(X) - self.cqr_q, 0, RUL_CAP), p)
        hi = np.maximum(np.clip(self.hi.predict(X) + self.cqr_q, 0, RUL_CAP + 40), p)
        safe = np.maximum(np.clip(np.minimum(self.safe.predict(X), p), 0, RUL_CAP), lo)
        return [{"rul": float(a), "rul_lo": float(b), "rul_hi": float(c), "rul_safe": float(d)}
                for a, b, c, d in zip(p, lo, hi, safe)]


def train(save: bool = True, verbose: bool = True) -> RULModel:
    rng = np.random.default_rng(42)
    train_df = pd.concat([load_split("train", "FD001"), load_split("train", "FD003")])
    units = train_df[["fd", "unit"]].drop_duplicates().to_numpy().tolist()
    rng.shuffle(units)
    n = len(units)
    replay = units[: int(0.15 * n)]          # held out: replayed as live fleet telemetry
    calib = units[int(0.15 * n): int(0.30 * n)]  # held out: conformal calibration
    fit = units[int(0.30 * n):]

    def subset(us):
        keys = {(fd, int(u)) for fd, u in us}
        mask = [(fd, int(u)) in keys for fd, u in zip(train_df["fd"], train_df["unit"])]
        return train_df[np.array(mask)]

    Xf, yf, _ = build_training_rows(subset(fit), stride=2)
    Xc, yc, _ = build_training_rows(subset(calib), stride=3)

    point = _hgb(loss="squared_error").fit(Xf, yf)
    lo = _hgb(loss="quantile", quantile=ALPHA / 2).fit(Xf, yf)
    hi = _hgb(loss="quantile", quantile=1 - ALPHA / 2).fit(Xf, yf)
    safe = _hgb(loss="quantile", quantile=SAFETY_QUANTILE).fit(Xf, yf)

    scores = np.maximum(lo.predict(Xc) - yc, yc - hi.predict(Xc))
    k = int(np.ceil((len(yc) + 1) * (1 - ALPHA)))
    cqr_q = float(np.sort(scores)[min(k, len(scores)) - 1])

    model = RULModel(point, lo, hi, safe, cqr_q, replay_units=[(fd, int(u)) for fd, u in replay])
    model.metrics = evaluate(model, Xf, yf)
    if verbose:
        print({k: v for k, v in model.metrics.items() if not isinstance(v, (list, dict))})
    if save:
        ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, ARTIFACT_PATH)
    return model


def evaluate(model: RULModel, Xf: np.ndarray, yf: np.ndarray) -> dict:
    """Official C-MAPSS protocol: predict RUL at the last cycle of each truncated test unit."""
    rows, truth, fds = [], [], []
    for fd in ("FD001", "FD003"):
        test = load_split("test", fd)
        rul = load_rul(fd)
        for i, (unit, g) in enumerate(test.groupby("unit")):
            rows.append(window_features(g[SENSORS].to_numpy(), int(g["cycle"].max())))
            truth.append(min(rul[i], RUL_CAP))
            fds.append(fd)
    X = np.array(rows)
    y = np.array(truth, dtype=float)
    p = np.clip(model.point.predict(X), 0, RUL_CAP)
    lo = np.clip(model.lo.predict(X) - model.cqr_q, 0, None)
    hi = model.hi.predict(X) + model.cqr_q
    safe = np.clip(np.minimum(model.safe.predict(X), p), 0, RUL_CAP)

    baseline = Ridge(alpha=1.0).fit(Xf, yf)
    pb = np.clip(baseline.predict(X), 0, RUL_CAP)
    # Time-based (preventive) baseline: everyone assumed to be at fleet-mean life.
    mean_life = 206.0
    cycles = X[:, -2]
    pt = np.clip(mean_life - cycles, 0, RUL_CAP)

    def rmse(a):
        return float(np.sqrt(np.mean((a - y) ** 2)))

    fd_arr = np.array(fds)
    per_fd = {fd: {"rmse": float(np.sqrt(np.mean((p[fd_arr == fd] - y[fd_arr == fd]) ** 2))),
                   "score": nasa_score(y[fd_arr == fd], p[fd_arr == fd])} for fd in ("FD001", "FD003")}
    return {
        "n_test_units": int(len(y)),
        "rmse": rmse(p),
        "mae": float(np.mean(np.abs(p - y))),
        "nasa_score": nasa_score(y, p),
        "late_pct": float(np.mean(p > y) * 100),
        "safe_rmse": rmse(safe),
        "safe_nasa_score": nasa_score(y, safe),
        "safe_late_pct": float(np.mean(safe > y) * 100),
        "interval_coverage": float(np.mean((y >= lo) & (y <= hi)) * 100),
        "interval_width": float(np.mean(hi - lo)),
        "cqr_q": model.cqr_q,
        "per_fd": per_fd,
        "baselines": [
            {"name": "Time-based (preventive) schedule", "rmse": rmse(pt), "nasa_score": nasa_score(y, pt)},
            {"name": "Linear regression (Ridge)", "rmse": rmse(pb), "nasa_score": nasa_score(y, pb)},
            {"name": "Gradient boosting (point)", "rmse": rmse(p), "nasa_score": nasa_score(y, p)},
            {"name": "Gradient boosting (safety-biased q0.30)", "rmse": rmse(safe), "nasa_score": nasa_score(y, safe)},
        ],
        "scatter": [{"true": float(a), "pred": float(b), "lo": float(c), "hi": float(d)}
                    for a, b, c, d in zip(y, p, lo, hi)],
        "sensor_importance": _importance(model, X, y),
    }


def _importance(model: RULModel, X: np.ndarray, y: np.ndarray) -> list:
    """Permutation importance per sensor (all four features of a sensor permuted together)."""
    rng = np.random.default_rng(0)
    base = np.sqrt(np.mean((model.point.predict(X) - y) ** 2))
    out = []
    for s_idx, s in enumerate(SENSORS):
        cols = [s_idx + k * len(SENSORS) for k in range(4)]
        Xp = X.copy()
        Xp[:, cols] = X[rng.permutation(len(X))][:, cols]
        out.append({"sensor": s, "tag": SENSOR_INFO[s][0], "name": SENSOR_INFO[s][1],
                    "delta_rmse": float(np.sqrt(np.mean((model.point.predict(Xp) - y) ** 2)) - base)})
    return sorted(out, key=lambda r: -r["delta_rmse"])


def load_or_train() -> RULModel:
    if ARTIFACT_PATH.exists():
        try:
            return joblib.load(ARTIFACT_PATH)
        except Exception:
            pass
    return train()


if __name__ == "__main__":
    # Import via the package so the pickled class path is app.rul_model.RULModel, not __main__.
    from app.rul_model import train as _train
    _train()
