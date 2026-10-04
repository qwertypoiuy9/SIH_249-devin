"""Integrated fleet digital twin: aircraft, components, maintenance work orders and spares.

Fuses the four data domains named in the problem statement into one state model:
  health monitoring (telemetry), technical records (e-MMS style tech log / work orders),
  spares (multi-echelon ERP inventory) and maintenance agencies (MRO repair pipeline).
"""
from __future__ import annotations

import math
from datetime import date, timedelta

import numpy as np
import pandas as pd

from . import catalog as cat
from .components import EngineComponent, StructureComponent, TrendComponent
from .rul_model import SENSORS, RULModel, load_split

START_DATE = date(2026, 10, 4)
PRIORITY_THRESHOLDS = [("CRITICAL", 10), ("HIGH", 25), ("MEDIUM", 50)]


def engine_stats() -> tuple[dict, dict]:
    df = pd.concat([load_split("train", "FD001"), load_split("train", "FD003")])
    healthy = df[df["cycle"] <= 30][SENSORS]
    late = df.groupby(["fd", "unit"]).tail(20)[SENSORS]
    stats = {"mean": healthy.mean().to_numpy(), "std": healthy.std().to_numpy() + 1e-6,
             "direction": np.sign(late.mean().to_numpy() - healthy.mean().to_numpy())}
    trajs = {f"{fd}-{u}": g[SENSORS].to_numpy() for (fd, u), g in df.groupby(["fd", "unit"])}
    return stats, trajs


class FleetSim:
    def __init__(self, model: RULModel, seed: int = 2026):
        self.model = model
        self.seed = seed
        self.rng = np.random.default_rng(seed)
        self.stats, all_trajs = engine_stats()
        self.replay_keys = [f"{fd}-{u}" for fd, u in model.replay_units]
        self.trajs = {k: all_trajs[k] for k in self.replay_keys}
        self.day = 0
        self.settings = {"auto_schedule": False, "planning_horizon_days": 30}
        self.work_orders: list[dict] = []
        self.events: list[dict] = []
        self.history: list[dict] = []
        self.repair_pipeline: list[dict] = []
        self.transfers: list[dict] = []
        self.alert_state: dict[str, bool] = {}
        self.counters = {"sorties": 0, "flight_hours": 0.0, "unscheduled": 0, "scheduled": 0,
                         "suppressed": 0, "corroborated": 0, "life_used": [], "sorties_today": 0}
        self._wo_seq = 0
        self.locations = cat.all_locations()
        self.aircraft = self._build_fleet()
        self.inventory = self._build_inventory()
        self.refresh_predictions()
        self._snapshot()

    # ------------------------------------------------------------------ build
    def _life_fraction(self) -> float:
        return float(0.05 + 0.9 * self.rng.beta(2.0, 1.6))

    def _new_engine(self, cid, name, sku, fresh=False):
        key = self.replay_keys[int(self.rng.integers(len(self.replay_keys)))]
        traj = self.trajs[key]
        start = 5 if fresh else max(5, int(self._life_fraction() * (len(traj) - 2)))
        return EngineComponent(cid, name, sku, cat.ENGINE_SPEC, traj, key, start, self.rng, self.stats)

    def _new_sub(self, sub, ac_type, cid, fresh=False):
        sku = cat.part_sku(ac_type, sub["key"])
        if sub["method"] == "paris":
            cf = float(self.rng.lognormal(0, 0.25))
            age = 5 if fresh else int(self._life_fraction() * 1650 / cf)
            return StructureComponent(cid, sub["name"], sku, sub, age, self.rng, cf)
        life = int(self.rng.integers(*sub["life"]))
        age = 5 if fresh else max(5, int(self._life_fraction() * life))
        return TrendComponent(cid, sub["name"], sku, sub, life, age, self.rng)

    def _build_fleet(self) -> list[dict]:
        fleet, n = [], 0
        for ac_type, base, count, prefix in cat.ROSTER:
            spec = cat.AIRCRAFT_TYPES[ac_type]
            for _ in range(count):
                n += 1
                tail = f"{prefix}{100 + n * 7}"
                comps = []
                for e in range(spec["engines"]):
                    pos = ["LH", "RH"][e] if spec["engines"] == 2 else "No.1"
                    comps.append(self._new_engine(f"ENG{e + 1}", f"{spec['engine']} engine ({pos})", cat.part_sku(ac_type, "ENG")))
                for sub in cat.SUBSYSTEMS:
                    comps.append(self._new_sub(sub, ac_type, sub["key"]))
                hrs = sum(c.age for c in comps if c.kind == "engine") / spec["engines"] * 1.5
                fleet.append({"tail": tail, "type": ac_type, "base": base, "components": comps,
                              "sortie_rate": spec["sortie_rate"], "sorties": 0, "flight_hours": round(hrs, 1),
                              "last_mission": None})
        return fleet

    def _build_inventory(self) -> dict:
        inv = {loc["id"]: {} for loc in self.locations}
        types_at = {}
        for ac in self.aircraft:
            types_at.setdefault(ac["base"], set()).add(ac["type"])
        for base, types in types_at.items():
            for t in types:
                inv[base][cat.part_sku(t, "ENG")] = int(self.rng.random() < 0.3)
                for sub in cat.SUBSYSTEMS:
                    inv[base][cat.part_sku(t, sub["key"])] = int(self.rng.integers(0, 2))
        for t in cat.AIRCRAFT_TYPES:
            for d in cat.DEPOTS:
                central = d["echelon"] == "central"
                inv[d["id"]][cat.part_sku(t, "ENG")] = (2 if central else int(self.rng.integers(0, 2)))
                for sub in cat.SUBSYSTEMS:
                    inv[d["id"]][cat.part_sku(t, sub["key"])] = (3 if central else int(self.rng.integers(1, 3)))
        return inv

    # --------------------------------------------------------------- helpers
    def date_of(self, day: int) -> str:
        return (START_DATE + timedelta(days=day)).isoformat()

    def get_aircraft(self, tail: str) -> dict | None:
        return next((a for a in self.aircraft if a["tail"] == tail), None)

    def open_wos(self, tail: str | None = None) -> list[dict]:
        return [w for w in self.work_orders if w["phase"] != "done" and (tail is None or w["tail"] == tail)]

    def status_of(self, ac: dict) -> str:
        wos = self.open_wos(ac["tail"])
        if any(w["kind"] == "unscheduled" for w in wos):
            return "NMC-AOG"
        if any(w["phase"] == "in_work" for w in wos):
            return "NMC-MAINT"
        # Safety rule: ground the aircraft if a component awaiting spares is about to reach its limit.
        comps = {c.id: c for c in ac["components"]}
        if any(comps[w["component_id"]].pred.get("rul_safe", 99) <= 3 for w in wos):
            return "NMC-MAINT"
        if any(self.priority_of(c, ac) in ("CRITICAL", "HIGH") for c in ac["components"]):
            return "FMC-WATCH"
        return "FMC"

    def priority_of(self, comp, ac=None) -> str | None:
        rs = comp.pred.get("rul_safe")
        if rs is None:
            return None
        for name, thr in PRIORITY_THRESHOLDS:
            if rs <= thr:
                return name
        return None

    def log(self, kind: str, text: str, tail: str | None = None, severity: str = "info"):
        self.events.append({"day": self.day, "date": self.date_of(self.day), "kind": kind, "text": text,
                            "tail": tail, "severity": severity})
        self.events = self.events[-600:]

    # ----------------------------------------------------------- prognostics
    def refresh_predictions(self):
        engines = [c for ac in self.aircraft for c in ac["components"] if c.kind == "engine"]
        if engines:
            X = np.stack([c.features() for c in engines])
            for c, p in zip(engines, self.model.predict_batch(X)):
                c.record_prediction(p)
        for ac in self.aircraft:
            for c in ac["components"]:
                if c.kind != "engine":
                    c.record_prediction(c.prognose())
        self._state_detection()

    def _state_detection(self):
        for ac in self.aircraft:
            for c in ac["components"]:
                key = f"{ac['tail']}:{c.id}"
                if c.kind == "engine":
                    st = c.state()
                    corroborated = len(st["flags"]) >= 3
                    if st["transients"] and not corroborated:
                        self.counters["suppressed"] += len(st["transients"])
                else:
                    corroborated = c.health_index() < 40
                if corroborated and not self.alert_state.get(key):
                    self.counters["corroborated"] += 1
                    self.log("ALERT", f"Corroborated degradation on {c.name}: predicted RUL "
                                      f"{c.pred['rul']:.0f} sorties (90% PI {c.pred['rul_lo']:.0f}-{c.pred['rul_hi']:.0f})",
                             ac["tail"], "warning")
                self.alert_state[key] = corroborated

    # ------------------------------------------------------------ simulation
    def advance(self, days: int = 1):
        for _ in range(max(1, min(days, 365))):
            self.day += 1
            self.counters["sorties_today"] = 0
            self._fly_day()
            self._progress_logistics()
            self._progress_transfers()
            self.refresh_predictions()
            if self.settings["auto_schedule"]:
                self._auto_schedule()
            self._snapshot()

    def _fly_day(self):
        names = list(cat.MISSIONS)
        weights = np.array([cat.MISSIONS[m]["weight"] for m in names])
        for ac in self.aircraft:
            if self.status_of(ac).startswith("NMC"):
                continue
            for _ in range(min(int(self.rng.poisson(ac["sortie_rate"])), 3)):
                mname = names[int(self.rng.choice(len(names), p=weights / weights.sum()))]
                mission = cat.MISSIONS[mname]
                ac["sorties"] += 1
                ac["flight_hours"] = round(ac["flight_hours"] + mission["fh"], 1)
                ac["last_mission"] = mname
                self.counters["sorties"] += 1
                self.counters["sorties_today"] += 1
                self.counters["flight_hours"] += mission["fh"]
                failed = [c for c in ac["components"] if c.step(mission)]
                if failed:
                    for c in failed:
                        self._on_failure(ac, c)
                    break

    def _on_failure(self, ac, comp):
        self.counters["unscheduled"] += 1
        self.log("FAILURE", f"In-service failure: {comp.name}. Aircraft AOG.", ac["tail"], "critical")
        existing = next((w for w in self.open_wos(ac["tail"]) if w["component_id"] == comp.id), None)
        if existing:
            existing["kind"] = "unscheduled"
            existing["work_days"] = comp.spec["repair_days"] + 1
        else:
            self.create_work_order(ac["tail"], comp.id, unscheduled=True)

    def _source_part(self, base: str, sku: str) -> tuple[str, int]:
        if self.inventory[base].get(sku, 0) > 0:
            self.inventory[base][sku] -= 1
            return base, 0
        options = []
        for loc in self.locations:
            if loc["id"] != base and self.inventory[loc["id"]].get(sku, 0) > 0:
                options.append((cat.TRANSFER_DAYS[loc["echelon"]], loc["id"]))
        if options:
            lead, src = min(options)
            self.inventory[src][sku] -= 1
            return src, lead
        return "OEM / production line", cat.PROCUREMENT_DAYS

    def create_work_order(self, tail: str, comp_id: str, unscheduled: bool = False) -> dict:
        ac = self.get_aircraft(tail)
        if ac is None:
            raise KeyError(tail)
        comp = next(c for c in ac["components"] if c.id == comp_id)
        existing = next((w for w in self.open_wos(tail) if w["component_id"] == comp_id), None)
        if existing:
            return existing
        src, lead = self._source_part(ac["base"], comp.sku)
        self._wo_seq += 1
        wo = {"id": f"WO-{self.day:03d}-{self._wo_seq:04d}", "tail": tail, "base": ac["base"], "type": ac["type"],
              "component_id": comp_id, "component": comp.name, "sku": comp.sku,
              "kind": "unscheduled" if unscheduled else "scheduled", "created_day": self.day,
              "created_date": self.date_of(self.day), "source": src, "lead_days": lead,
              "parts_eta_day": self.day + lead, "parts_eta_date": self.date_of(self.day + lead),
              "phase": "in_work" if lead == 0 else "awaiting_parts",
              "work_days": comp.spec["repair_days"] + 1 if unscheduled else comp.spec["scheduled_days"],
              "work_started_day": self.day if lead == 0 else None, "completed_day": None,
              "rul_at_creation": round(comp.pred.get("rul", 0), 1), "action": comp.spec["action"]}
        self.work_orders.append(wo)
        if not unscheduled:
            self.counters["scheduled"] += 1
        where = "from flight-line stores" if lead == 0 else f"from {src}, ETA {lead} d"
        self.log("WORK_ORDER", f"{wo['id']} ({wo['kind']}) for {comp.name}; spare {comp.sku} {where}", tail,
                 "critical" if unscheduled else "info")
        return wo

    def _progress_logistics(self):
        for wo in self.open_wos():
            if wo["phase"] == "awaiting_parts" and self.day >= wo["parts_eta_day"]:
                wo["phase"] = "in_work"
                wo["work_started_day"] = self.day
                self.log("PARTS", f"Spare {wo['sku']} received for {wo['id']}; maintenance started", wo["tail"])
            elif wo["phase"] == "in_work" and self.day - wo["work_started_day"] >= wo["work_days"]:
                self._complete(wo)
        for r in list(self.repair_pipeline):
            if self.day >= r["ready_day"]:
                self.inventory[r["to"]][r["sku"]] = self.inventory[r["to"]].get(r["sku"], 0) + 1
                self.repair_pipeline.remove(r)
                self.log("MRO", f"Repaired {r['sku']} returned to stock at {r['to']}")

    def _complete(self, wo):
        ac = self.get_aircraft(wo["tail"])
        idx = next(i for i, c in enumerate(ac["components"]) if c.id == wo["component_id"])
        old = ac["components"][idx]
        life = old.age + max(old.true_rul(), 0)
        self.counters["life_used"].append(old.age / life if life else 1.0)
        if old.kind == "engine":
            new = self._new_engine(old.id, old.name, old.sku, fresh=True)
        else:
            sub = next(s for s in cat.SUBSYSTEMS if s["key"] == old.id)
            new = self._new_sub(sub, ac["type"], old.id, fresh=True)
        new.installs = old.installs + 1
        ac["components"][idx] = new
        if old.spec.get("tat", 0) > 0:
            depot = "HAL-K" if old.kind == "engine" else ("BRD-N" if self._lat(ac["base"]) > 22 else "BRD-S")
            self.repair_pipeline.append({"sku": old.sku, "to": depot, "ready_day": self.day + old.spec["tat"],
                                         "from_tail": ac["tail"]})
        wo["phase"] = "done"
        wo["completed_day"] = self.day
        wo["completed_date"] = self.date_of(self.day)
        wo["life_used_pct"] = round(100 * old.age / life, 1) if life else 100.0
        self.log("COMPLETE", f"{wo['id']} closed: {old.name} replaced ({wo['life_used_pct']}% of true life used)", ac["tail"])
        new.record_prediction(self.model.predict_batch(new.features()[None, :])[0] if new.kind == "engine" else new.prognose())

    def _lat(self, base_id: str) -> float:
        return next(b["lat"] for b in cat.BASES if b["id"] == base_id)

    def _auto_schedule(self):
        for adv in self.advisories():
            if adv["work_order"] is None and (adv["priority"] == "CRITICAL" or
                                              adv["lead_days"] + 3 >= adv["days_to_action"]):
                self.create_work_order(adv["tail"], adv["component_id"])

    def _snapshot(self):
        statuses = [self.status_of(a) for a in self.aircraft]
        n = len(statuses)
        fmc = sum(s.startswith("FMC") for s in statuses)
        self.history.append({"day": self.day, "date": self.date_of(self.day), "ao": round(100 * fmc / n, 1),
                             "fmc": fmc, "nmc_maint": statuses.count("NMC-MAINT"), "nmc_aog": statuses.count("NMC-AOG"),
                             "sorties": self.counters["sorties_today"], "unscheduled": self.counters["unscheduled"],
                             "scheduled": self.counters["scheduled"]})
        self.history = self.history[-400:]

    # ------------------------------------------------------------------ views
    def lead_for(self, base: str, sku: str) -> tuple[str, int]:
        if self.inventory[base].get(sku, 0) > 0:
            return base, 0
        opts = [(cat.TRANSFER_DAYS[l["echelon"]], l["id"]) for l in self.locations
                if l["id"] != base and self.inventory[l["id"]].get(sku, 0) > 0]
        return (min(opts)[1], min(opts)[0]) if opts else ("OEM / production line", cat.PROCUREMENT_DAYS)

    def advisories(self) -> list[dict]:
        out = []
        for ac in self.aircraft:
            for c in ac["components"]:
                pr = self.priority_of(c)
                if pr is None:
                    continue
                src, lead = self.lead_for(ac["base"], c.sku)
                days = c.pred["rul_safe"] / ac["sortie_rate"]
                wo = next((w for w in self.open_wos(ac["tail"]) if w["component_id"] == c.id), None)
                out.append({"id": f"{ac['tail']}:{c.id}", "tail": ac["tail"], "type": ac["type"], "base": ac["base"],
                            "component_id": c.id, "component": c.name, "method": c.kind, "priority": pr,
                            "rul": round(c.pred["rul"], 1), "rul_lo": round(c.pred["rul_lo"], 1),
                            "rul_hi": round(c.pred["rul_hi"], 1), "rul_safe": round(c.pred["rul_safe"], 1),
                            "days_to_action": round(days, 1), "action_by": self.date_of(self.day + int(days)),
                            "action": c.spec["action"], "sku": c.sku, "source": src, "lead_days": lead,
                            "supply_risk": lead > days, "work_order": wo["id"] if wo else None,
                            "true_rul": c.true_rul()})
        rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}
        return sorted(out, key=lambda a: (rank[a["priority"]], a["rul_safe"]))

    def component_view(self, ac: dict, c) -> dict:
        p = c.pred
        return {"id": c.id, "name": c.name, "kind": c.kind, "sku": c.sku, "age": c.age, "installs": c.installs,
                "health": round(c.health_index(), 1), "priority": self.priority_of(c),
                "rul": round(p.get("rul", 0), 1), "rul_lo": round(p.get("rul_lo", 0), 1),
                "rul_hi": round(p.get("rul_hi", 0), 1), "rul_safe": round(p.get("rul_safe", 0), 1),
                "rul_fh": round(p.get("rul", 0) * 1.5, 1), "days": round(p.get("rul_safe", 0) / ac["sortie_rate"], 1),
                "true_rul": c.true_rul(), "alert": self.alert_state.get(f"{ac['tail']}:{c.id}", False),
                "method": {"engine": "ML (gradient boosting + CQR) on C-MAPSS telemetry",
                           "trend": "Health-indicator exponential trend + bootstrap",
                           "paris": "Physics-based Paris-law crack growth (SHM calibrated)"}[c.kind]}

    def aircraft_view(self, ac: dict, detail: bool = False) -> dict:
        comps = [self.component_view(ac, c) for c in ac["components"]]
        worst = min(comps, key=lambda c: c["rul_safe"])
        v = {"tail": ac["tail"], "type": ac["type"], "base": ac["base"], "status": self.status_of(ac),
             "health": round(min(c["health"] for c in comps), 1), "min_rul": worst["rul_safe"],
             "limiting_component": worst["name"], "sorties": ac["sorties"], "flight_hours": ac["flight_hours"],
             "sortie_rate": ac["sortie_rate"], "open_work_orders": len(self.open_wos(ac["tail"])),
             "engine": cat.AIRCRAFT_TYPES[ac["type"]]["engine"], "radar": cat.AIRCRAFT_TYPES[ac["type"]]["radar"]}
        if detail:
            v["components"] = comps
            v["work_orders"] = [w for w in self.work_orders if w["tail"] == ac["tail"]][-20:]
            v["tech_log"] = [e for e in self.events if e["tail"] == ac["tail"]][-30:][::-1]
            v["last_mission"] = ac["last_mission"]
        return v

    def summary(self) -> dict:
        views = [self.aircraft_view(a) for a in self.aircraft]
        n = len(views)
        by_status = {s: sum(v["status"] == s for v in views) for s in ("FMC", "FMC-WATCH", "NMC-MAINT", "NMC-AOG")}
        groups = {}
        for key in ("base", "type"):
            g = {}
            for v in views:
                d = g.setdefault(v[key], {"name": v[key], "total": 0, "fmc": 0})
                d["total"] += 1
                d["fmc"] += v["status"].startswith("FMC")
            groups[key] = [{**d, "ao": round(100 * d["fmc"] / d["total"], 1)} for d in g.values()]
        lu = self.counters["life_used"]
        hist = self.history
        advs = self.advisories()
        return {"day": self.day, "date": self.date_of(self.day), "aircraft": n,
                "ao": round(100 * (by_status["FMC"] + by_status["FMC-WATCH"]) / n, 1),
                "ao_avg": round(float(np.mean([h["ao"] for h in hist])), 1) if hist else None,
                "by_status": by_status, "by_base": groups["base"], "by_type": groups["type"],
                "sorties_total": self.counters["sorties"], "flight_hours_total": round(self.counters["flight_hours"], 1),
                "unscheduled_failures": self.counters["unscheduled"], "scheduled_removals": self.counters["scheduled"],
                "alerts_corroborated": self.counters["corroborated"], "alerts_suppressed": self.counters["suppressed"],
                "life_used_avg_pct": round(100 * float(np.mean(lu)), 1) if lu else None,
                "advisories": {p: sum(a["priority"] == p for a in advs) for p in ("CRITICAL", "HIGH", "MEDIUM")},
                "supply_risk": sum(a["supply_risk"] for a in advs), "open_work_orders": len(self.open_wos()),
                "sgr": round(float(np.mean([h["sorties"] for h in hist[-7:]])), 1) if len(hist) > 1 else None,
                "history": hist[-120:], "settings": self.settings}

    # ---------------------------------------------------- MEIO / logistics
    def _p_fail_within(self, comp, sorties: float) -> float:
        p = comp.pred
        sd = max((p["rul_hi"] - p["rul_lo"]) / 3.29, 1.0)
        return 0.5 * (1 + math.erf((sorties - p["rul"]) / (sd * math.sqrt(2))))

    def transfer(self, sku: str, src: str, dst: str) -> dict:
        if self.inventory[src].get(sku, 0) <= 0:
            raise ValueError(f"No {sku} in stock at {src}")
        echelon = next(l["echelon"] for l in self.locations if l["id"] == src)
        lead = cat.TRANSFER_DAYS[echelon]
        self.inventory[src][sku] -= 1
        t = {"sku": sku, "from": src, "to": dst, "eta_day": self.day + lead, "eta_date": self.date_of(self.day + lead)}
        self.transfers.append(t)
        self.log("TRANSFER", f"Pre-positioning 1x {sku} {src} -> {dst}, ETA {t['eta_date']}")
        return t

    def _progress_transfers(self):
        for t in list(self.transfers):
            if self.day >= t["eta_day"]:
                self.inventory[t["to"]][t["sku"]] = self.inventory[t["to"]].get(t["sku"], 0) + 1
                self.transfers.remove(t)
                self.log("TRANSFER", f"{t['sku']} arrived at {t['to']}")

    def inventory_view(self) -> dict:
        H = self.settings["planning_horizon_days"]
        demand, needs = {}, []
        for ac in self.aircraft:
            busy = {w["component_id"] for w in self.open_wos(ac["tail"])}
            for c in ac["components"]:
                if c.id in busy:
                    continue
                p = self._p_fail_within(c, H * ac["sortie_rate"])
                demand[(ac["base"], c.sku)] = demand.get((ac["base"], c.sku), 0.0) + p
                if p >= 0.5:
                    needs.append({"tail": ac["tail"], "base": ac["base"], "sku": c.sku, "component": c.name,
                                  "p_need": round(p, 2), "need_by_day": self.day + int(c.pred["rul_safe"] / ac["sortie_rate"])})
        inbound = {}
        for t in self.transfers:
            inbound[(t["to"], t["sku"])] = inbound.get((t["to"], t["sku"]), 0) + 1
        recs = []
        for (base, sku), exp in sorted(demand.items(), key=lambda kv: -kv[1]):
            req = [n for n in needs if n["base"] == base and n["sku"] == sku]
            required = max(int(round(exp)), 1 if req else 0)
            on_hand = self.inventory[base].get(sku, 0) + inbound.get((base, sku), 0)
            if required <= on_hand:
                continue
            opts = [(cat.TRANSFER_DAYS[l["echelon"]], l["id"]) for l in self.locations
                    if l["id"] != base and self.inventory[l["id"]].get(sku, 0) > 0]
            lead, src = min(opts) if opts else (cat.PROCUREMENT_DAYS, "OEM / production line")
            need_by = min((n["need_by_day"] for n in req), default=self.day + H)
            recs.append({"base": base, "sku": sku, "expected_demand": round(exp, 2), "on_hand": on_hand,
                         "shortfall": required - on_hand, "source": src, "lead_days": lead,
                         "need_by": self.date_of(need_by), "slack_days": need_by - self.day - lead,
                         "status": "ON-TIME" if self.day + lead <= need_by else "AT-RISK",
                         "can_transfer": bool(opts), "tails": [n["tail"] for n in req]})
        skus = sorted({s for inv in self.inventory.values() for s in inv})
        return {"horizon_days": H, "skus": skus,
                "stock": [{"id": l["id"], "name": l["name"], "echelon": l["echelon"],
                           "items": {s: self.inventory[l["id"]].get(s, 0) for s in skus}} for l in self.locations],
                "recommendations": recs, "needs": sorted(needs, key=lambda n: n["need_by_day"]),
                "transfers": self.transfers, "repair_pipeline": self.repair_pipeline,
                "awaiting_parts": [w for w in self.open_wos() if w["phase"] == "awaiting_parts"]}

    def integration_view(self) -> dict:
        comps = [c for ac in self.aircraft for c in ac["components"]]
        engine_rows = sum(c.age for c in comps if c.kind == "engine")
        sorties = max(self.counters["sorties"], 1)
        raw_mb = 400 * 16 * 2 * 1.5 * 3600 / 1e6
        edge_kb = 2.0
        return {"sources": [
            {"name": "Aircraft health monitoring (HUMS / AID over MIL-STD-1553)", "domain": "Telemetry",
             "records": engine_rows + sum(len(getattr(c, "obs", getattr(c, "meas", []))) for c in comps if c.kind != "engine"),
             "detail": f"{sum(c.kind == 'engine' for c in comps)} engines x 14 parameters per cycle (NASA C-MAPSS replay); SHM crack + subsystem indicators"},
            {"name": "Technical records (e-MMS style tech log / work orders)", "domain": "Maintenance",
             "records": len(self.events) + len(self.work_orders), "detail": f"{len(self.work_orders)} work orders, {len(self.events)} log entries"},
            {"name": "Spares ERP (IMMOLS style multi-echelon inventory)", "domain": "Supply",
             "records": sum(sum(v.values()) for v in self.inventory.values()),
             "detail": f"{len({s for v in self.inventory.values() for s in v})} SKUs across {len(self.locations)} locations"},
            {"name": "Maintenance agencies (BRD / HAL MRO repair pipeline)", "domain": "MRO",
             "records": len(self.repair_pipeline), "detail": "Repairable rotables in overhaul with return dates"}],
            "edge": {"raw_mb_per_sortie": round(raw_mb, 1), "edge_kb_per_sortie": edge_kb,
                     "reduction_pct": round(100 * (1 - edge_kb / 1000 / raw_mb), 4),
                     "raw_gb_total": round(raw_mb * sorties / 1000, 1), "edge_mb_total": round(edge_kb * sorties / 1000, 2)}}
