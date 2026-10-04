"""Static reference data: bases, supply echelons, aircraft types and spare parts."""
from __future__ import annotations

BASES = [
    {"id": "PUN", "name": "AFS Pune (Lohegaon)", "lat": 18.58, "lon": 73.92},
    {"id": "BRY", "name": "AFS Bareilly", "lat": 28.42, "lon": 79.45},
    {"id": "TEZ", "name": "AFS Tezpur", "lat": 26.71, "lon": 92.78},
    {"id": "JDH", "name": "AFS Jodhpur", "lat": 26.25, "lon": 73.05},
    {"id": "SUL", "name": "AFS Sulur", "lat": 11.01, "lon": 77.16},
    {"id": "GWL", "name": "AFS Gwalior", "lat": 26.29, "lon": 78.23},
    {"id": "AMB", "name": "AFS Ambala", "lat": 30.37, "lon": 76.82},
]

# Multi-echelon supply network (flight-line stores -> regional depots -> central / OEM).
DEPOTS = [
    {"id": "BRD-N", "name": "Base Repair Depot (North)", "echelon": "regional", "lat": 28.6, "lon": 77.2},
    {"id": "BRD-S", "name": "Base Repair Depot (South)", "echelon": "regional", "lat": 17.4, "lon": 78.5},
    {"id": "HAL-K", "name": "HAL Koraput / Nashik (central MRO)", "echelon": "central", "lat": 18.8, "lon": 82.7},
]

TRANSFER_DAYS = {"base": 2, "regional": 3, "central": 6}
PROCUREMENT_DAYS = 30

AIRCRAFT_TYPES = {
    "Su-30MKI": {"engines": 2, "engine": "AL-31FP", "radar": "N011M Bars / Virupaksha AESA", "sortie_rate": 1.1},
    "Tejas Mk1": {"engines": 1, "engine": "F404-GE-IN20", "radar": "EL/M-2032", "sortie_rate": 1.3},
    "Mirage 2000": {"engines": 1, "engine": "M53-P2", "radar": "RDY-2", "sortie_rate": 1.0},
    "Rafale": {"engines": 2, "engine": "M88-2", "radar": "RBE2-AA AESA", "sortie_rate": 1.2},
}

# (type, base, count, tail prefix)
ROSTER = [
    ("Su-30MKI", "PUN", 4, "SB"),
    ("Su-30MKI", "BRY", 3, "SB"),
    ("Su-30MKI", "TEZ", 3, "SB"),
    ("Su-30MKI", "JDH", 2, "SB"),
    ("Tejas Mk1", "SUL", 5, "LA"),
    ("Mirage 2000", "GWL", 4, "KF"),
    ("Rafale", "AMB", 4, "RB"),
]

MISSIONS = {
    "Training": {"g_mean": 4.5, "g_sd": 0.8, "fh": 1.2, "weight": 0.5},
    "Air Defence / CAP": {"g_mean": 3.8, "g_sd": 0.6, "fh": 2.0, "weight": 0.3},
    "Strike / Ground Attack": {"g_mean": 6.0, "g_sd": 1.0, "fh": 1.6, "weight": 0.2},
}

# Non-engine tracked subsystems. "trend" = health-indicator trend extrapolation,
# "paris" = physics-based Paris-law crack growth calibrated to SHM measurements.
SUBSYSTEMS = [
    {"key": "HYD", "name": "Hydraulic pump (System 1)", "method": "trend", "sensor": "Case-drain flow",
     "unit": "L/min", "baseline": 1.2, "span": 2.3, "noise": 0.06, "life": (260, 520), "repair_days": 1,
     "scheduled_days": 1, "tat": 10, "action": "Replace hydraulic pump and flush System 1"},
    {"key": "MLG", "name": "Main landing gear actuator", "method": "trend", "sensor": "Retraction time",
     "unit": "s", "baseline": 6.0, "span": 2.2, "noise": 0.08, "life": (400, 800), "repair_days": 2,
     "scheduled_days": 1, "tat": 12, "action": "Replace MLG retraction actuator seals / actuator"},
    {"key": "RAD", "name": "Radar transmitter (T/R) module", "method": "trend", "sensor": "T/R module failure fraction",
     "unit": "%", "baseline": 0.5, "span": 9.5, "noise": 0.25, "life": (350, 900), "repair_days": 2,
     "scheduled_days": 1, "tat": 15, "action": "Swap radar transmitter LRU; send to depot for repair"},
    {"key": "STR", "name": "Wing-root spar (SHM monitored)", "method": "paris", "sensor": "Crack length (CVM sensor)",
     "unit": "mm", "life": (900, 2200), "repair_days": 6, "scheduled_days": 4, "tat": 0,
     "action": "Blend-out crack and install structural doubler at wing root"},
]

ENGINE_SPEC = {"repair_days": 5, "scheduled_days": 3, "tat": 25, "action": "Engine change; send removed engine to MRO for hot-section overhaul"}


def part_sku(ac_type: str, key: str) -> str:
    if key == "ENG":
        return f"ENG-{AIRCRAFT_TYPES[ac_type]['engine']}"
    return f"{key}-{ac_type.split()[0].upper().replace('-', '')}"


def part_name(ac_type: str, key: str) -> str:
    if key == "ENG":
        return f"{AIRCRAFT_TYPES[ac_type]['engine']} engine"
    sub = next(s for s in SUBSYSTEMS if s["key"] == key)
    return f"{sub['name']} ({ac_type})"


def all_locations() -> list[dict]:
    return [{**b, "echelon": "base"} for b in BASES] + DEPOTS
