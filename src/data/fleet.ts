import type {
  Aircraft,
  AircraftStatus,
  AirframeClass,
  SensorDef,
  SysName,
  SystemHealth,
} from '../types'
import { clamp, jitter } from '../lib/rng'

interface Seed {
  id: string
  tail: string
  type: string
  cls: AirframeClass
  sqn: string
  base: string
  status: AircraftStatus
  hours: number
  cycles: number
  util: number
  health: number
  svcDays: number
  inspDays: number
}

const SEEDS: Seed[] = [
  { id: 'AC-01', tail: 'SB-0417', type: 'Su-30MKI', cls: 'Fighter', sqn: 'No. 220 Sqn', base: 'Tezpur', status: 'AIRWORTHY', hours: 2140, cycles: 1682, util: 0.74, health: 0.91, svcDays: 12, inspDays: 34 },
  { id: 'AC-02', tail: 'SB-0533', type: 'Su-30MKI', cls: 'Fighter', sqn: 'No. 220 Sqn', base: 'Tezpur', status: 'IN MAINTENANCE', hours: 2612, cycles: 2044, util: 0.52, health: 0.63, svcDays: 3, inspDays: 9 },
  { id: 'AC-03', tail: 'KB-0091', type: 'Rafale B', cls: 'Fighter', sqn: 'No. 17 Sqn', base: 'Ambala', status: 'AIRWORTHY', hours: 986, cycles: 812, util: 0.81, health: 0.95, svcDays: 21, inspDays: 47 },
  { id: 'AC-04', tail: 'KB-0144', type: 'Rafale B', cls: 'Fighter', sqn: 'No. 17 Sqn', base: 'Ambala', status: 'DUE INSPECTION', hours: 1174, cycles: 964, util: 0.68, health: 0.78, svcDays: 31, inspDays: 4 },
  { id: 'AC-05', tail: 'KH-3081', type: 'LCA Tejas Mk1', cls: 'Fighter', sqn: 'No. 45 Sqn', base: 'Coimbatore', status: 'AIRWORTHY', hours: 742, cycles: 688, util: 0.77, health: 0.88, svcDays: 8, inspDays: 26 },
  { id: 'AC-06', tail: 'KH-3119', type: 'LCA Tejas Mk1', cls: 'Fighter', sqn: 'No. 45 Sqn', base: 'Coimbatore', status: 'AOG', hours: 813, cycles: 751, util: 0.31, health: 0.44, svcDays: 1, inspDays: 15 },
  { id: 'AC-07', tail: 'UG-2017', type: 'MiG-29UPG', cls: 'Fighter', sqn: 'No. 47 Sqn', base: 'Una', status: 'AIRWORTHY', hours: 1893, cycles: 1502, util: 0.7, health: 0.72, svcDays: 11, inspDays: 24 },
  { id: 'AC-08', tail: 'UG-2044', type: 'MiG-29UPG', cls: 'Fighter', sqn: 'No. 47 Sqn', base: 'Una', status: 'AIRWORTHY', hours: 1655, cycles: 1331, util: 0.72, health: 0.86, svcDays: 17, inspDays: 38 },
  { id: 'AC-09', tail: 'DT-3021', type: 'Mirage 2000', cls: 'Fighter', sqn: 'No. 1 Sqn', base: 'Gwalior', status: 'AIRWORTHY', hours: 2287, cycles: 1793, util: 0.7, health: 0.83, svcDays: 26, inspDays: 41 },
  { id: 'AC-10', tail: 'DT-3116', type: 'Mirage 2000', cls: 'Fighter', sqn: 'No. 1 Sqn', base: 'Gwalior', status: 'AIRWORTHY', hours: 2411, cycles: 1865, util: 0.66, health: 0.79, svcDays: 34, inspDays: 18 },
  { id: 'AC-11', tail: 'K-2571', type: 'AN-32', cls: 'Transport', sqn: 'No. 33 Sqn', base: 'Agra', status: 'AIRWORTHY', hours: 3402, cycles: 2611, util: 0.66, health: 0.8, svcDays: 14, inspDays: 22 },
  { id: 'AC-12', tail: 'K-2688', type: 'AN-32', cls: 'Transport', sqn: 'No. 33 Sqn', base: 'Agra', status: 'AOG', hours: 3776, cycles: 2884, util: 0.28, health: 0.41, svcDays: 2, inspDays: 11 },
  { id: 'AC-13', tail: 'ZZ-3417', type: 'C-130J-30', cls: 'Transport', sqn: 'No. 77 Sqn', base: 'Panagarh', status: 'AIRWORTHY', hours: 2954, cycles: 1507, util: 0.79, health: 0.9, svcDays: 19, inspDays: 30 },
  { id: 'AC-14', tail: 'ZZ-3502', type: 'C-130J-30', cls: 'Transport', sqn: 'No. 77 Sqn', base: 'Panagarh', status: 'IN MAINTENANCE', hours: 3110, cycles: 1622, util: 0.49, health: 0.6, svcDays: 4, inspDays: 8 },
  { id: 'AC-15', tail: 'TZ-5774', type: 'Mi-17 V5', cls: 'Helicopter', sqn: 'No. 157 Sqn', base: 'Srinagar', status: 'AIRWORTHY', hours: 1987, cycles: 3120, util: 0.73, health: 0.84, svcDays: 11, inspDays: 19 },
  { id: 'AC-16', tail: 'TZ-5812', type: 'Mi-17 V5', cls: 'Helicopter', sqn: 'No. 157 Sqn', base: 'Srinagar', status: 'AIRWORTHY', hours: 2240, cycles: 3489, util: 0.64, health: 0.77, svcDays: 29, inspDays: 21 },
  { id: 'AC-17', tail: 'IA-6031', type: 'Dhruv ALH', cls: 'Helicopter', sqn: 'No. 302 Sqn', base: 'Jodhpur', status: 'AIRWORTHY', hours: 1421, cycles: 2405, util: 0.76, health: 0.89, svcDays: 9, inspDays: 28 },
  { id: 'AC-18', tail: 'IV-7708', type: 'Hawk Mk132', cls: 'Trainer', sqn: 'No. 210 Sqn', base: 'Bidar', status: 'AIRWORTHY', hours: 2766, cycles: 2990, util: 0.82, health: 0.87, svcDays: 16, inspDays: 33 },
  { id: 'AC-19', tail: 'IV-7741', type: 'Hawk Mk132', cls: 'Trainer', sqn: 'No. 210 Sqn', base: 'Bidar', status: 'AIRWORTHY', hours: 2894, cycles: 3140, util: 0.71, health: 0.74, svcDays: 14, inspDays: 27 },
  { id: 'AC-20', tail: 'DT-3244', type: 'Mirage 2000', cls: 'Fighter', sqn: 'No. 9 Sqn', base: 'Gwalior', status: 'AIRWORTHY', hours: 2101, cycles: 1704, util: 0.69, health: 0.82, svcDays: 23, inspDays: 36 },
]

export const SYS_ORDER: SysName[] = [
  'Propulsion',
  'Avionics',
  'Hydraulics',
  'Fuel',
  'Landing Gear',
  'Environmental',
  'Airframe Structure',
  'Electrical',
]

const LRU_BY_SYS: Record<SysName, string> = {
  Propulsion: 'Engine FADEC / HPT stage-2 blisk',
  Avionics: 'Multi-function radar processor',
  Hydraulics: 'Engine-driven hydraulic pump B',
  Fuel: 'Fuel boost pump LP-2',
  'Landing Gear': 'MLG actuator seal kit',
  Environmental: 'ECS bleed air valve',
  'Airframe Structure': 'Wing root fatigue bay-3',
  Electrical: 'Generator CSD unit',
}

const SENSOR_TEMPLATES: Record<SysName, SensorDef[]> = {
  Propulsion: [
    { key: 'egt', label: 'EGT margin', unit: '°C', base: 712, noise: 9, warn: 760, crit: 790, sens: 1 },
    { key: 'vib', label: 'N2 vibration', unit: 'mm/s', base: 2.4, noise: 0.35, warn: 5.5, crit: 7.5, sens: 1.4 },
    { key: 'oilpt', label: 'Engine oil press', unit: 'psi', base: 88, noise: 3, warn: 62, crit: 52, sens: -1.2, },
  ],
  Avionics: [
    { key: 'cpu', label: 'Radar CPU temp', unit: '°C', base: 54, noise: 3, warn: 74, crit: 85, sens: 1 },
    { key: 'bus', label: 'MIL-STD-1553 bus errors', unit: '/min', base: 1.2, noise: 0.8, warn: 6, crit: 12, sens: 1.5 },
  ],
  Hydraulics: [
    { key: 'hydp', label: 'Hyd sys-B press', unit: 'psi', base: 3010, noise: 70, warn: 2400, crit: 2100, sens: -1.3 },
    { key: 'hydt', label: 'Hyd oil temp', unit: '°C', base: 74, noise: 4, warn: 96, crit: 108, sens: 1.1 },
  ],
  Fuel: [
    { key: 'ff', label: 'Fuel flow delta', unit: '%', base: 0.8, noise: 0.5, warn: 3.5, crit: 5.5, sens: 1.2 },
    { key: 'pmp', label: 'Boost pump amps', unit: 'A', base: 11.5, noise: 0.7, warn: 15.5, crit: 17.5, sens: 1.1 },
  ],
  'Landing Gear': [
    { key: 'shk', label: 'MLG shock strut press', unit: 'psi', base: 1850, noise: 45, warn: 1550, crit: 1400, sens: -1.2 },
    { key: 'brk', label: 'Brake temp diff', unit: '°C', base: 46, noise: 12, warn: 130, crit: 165, sens: 1.3 },
  ],
  Environmental: [
    { key: 'cabin', label: 'Cabin press diff', unit: 'psi', base: 8.4, noise: 0.3, warn: 6.2, crit: 5.4, sens: -1.1 },
    { key: 'bleed', label: 'Bleed air valve pos', unit: '%', base: 96, noise: 2, warn: 78, crit: 68, sens: -1 },
  ],
  'Airframe Structure': [
    { key: 'fat', label: 'Wing root strain', unit: 'με', base: 410, noise: 35, warn: 620, crit: 700, sens: 1.2 },
    { key: 'cyc', label: 'Fatigue crack gauge', unit: 'mm', base: 0.4, noise: 0.1, warn: 1.6, crit: 2.2, sens: 1.6 },
  ],
  Electrical: [
    { key: 'gen', label: 'Gen load', unit: '%', base: 68, noise: 6, warn: 92, crit: 98, sens: 1.1 },
    { key: 'busv', label: 'DC bus voltage', unit: 'V', base: 28.3, noise: 0.4, warn: 25.5, crit: 24.5, sens: -1.4 },
  ],
}

function buildSystems(id: string, health: number): SystemHealth[] {
  return SYS_ORDER.map((name) => {
    const h = clamp(health * 100 + jitter(id + name, -14, 12), 28, 99)
    return {
      name,
      health: Math.round(h * 10) / 10,
      trend: Math.round(jitter(id + name + 't', -1.6, 0.7) * 10) / 10,
      lru: LRU_BY_SYS[name],
    }
  })
}

function buildSensors(id: string, systems: SystemHealth[]): SensorDef[] {
  const out: SensorDef[] = []
  for (const sys of systems) {
    for (const tpl of SENSOR_TEMPLATES[sys.name]) {
      const stress = 1 - sys.health / 100
      out.push({
        ...tpl,
        base:
          Math.round(
            tpl.base *
              (1 + stress * tpl.sens * 0.09) *
              (1 + jitter(id + tpl.key, -0.02, 0.02)) *
              10,
          ) / 10,
        noise: Math.round((tpl.noise * (1 + stress * 0.8)) * 100) / 100,
        warn: tpl.warn,
        crit: tpl.crit,
      })
    }
  }
  return out
}

function buildTwin(a: Aircraft, systems: SystemHealth[]) {
  const worst = [...systems].sort((x, y) => x.health - y.health)[0]
  const airframeLife = clamp(100 - (a.cycles / 6000) * 100, 12, 100)
  return [
    { key: 'eng', label: 'Engine life-used (LPT)', pct: Math.round(clamp((a.engineHours / 4200) * 100, 8, 98)), value: `${a.engineHours} of 4200 fh` },
    { key: 'fat', label: 'Airframe fatigue life', pct: Math.round(100 - airframeLife), value: `${a.cycles.toLocaleString()} of 6,000 cyc` },
    { key: 'brk', label: 'Brake wear pack', pct: Math.round(jitter(a.id + 'brk', 30, 88)), value: `${Math.round(jitter(a.id + 'brk2', 220, 780))} landings` },
    { key: 'tire', label: 'Tyre wear (main)', pct: Math.round(jitter(a.id + 'tire', 25, 82)), value: `${Math.round(jitter(a.id + 'tire2', 30, 120))} cycles` },
    { key: 'worst', label: `${worst.name} degradation`, pct: Math.round(100 - worst.health), value: `${worst.lru}` },
    { key: 'oil', label: 'Oil filter contamination', pct: Math.round(jitter(a.id + 'oil', 18, 74)), value: `${jitter(a.id + 'oilc', 0.4, 6.2).toFixed(1)} mg/L debris` },
  ]
}

export const FLEET: Aircraft[] = SEEDS.map((s) => {
  const systems = buildSystems(s.id, s.health)
  const ac: Aircraft = {
    id: s.id,
    tail: s.tail,
    type: s.type,
    cls: s.cls,
    sqn: s.sqn,
    base: s.base,
    status: s.status,
    hours: s.hours,
    cycles: s.cycles,
    engineHours: Math.round(s.hours * 0.86),
    lastSvcDays: s.svcDays,
    nextInspDays: s.inspDays,
    utilisation: s.util,
    statusHours: Math.round(jitter(s.id + 'sh', 6, 96)),
    systems,
    sensors: [],
    twin: [],
  }
  ac.sensors = buildSensors(s.id, systems)
  ac.twin = buildTwin(ac, systems)
  return ac
})

export const byId = (id: string): Aircraft => FLEET.find((f) => f.id === id) ?? FLEET[0]

export const CLASS_COLORS: Record<AirframeClass, string> = {
  Fighter: '#4cc2ff',
  Transport: '#a78bfa',
  Helicopter: '#34d399',
  Trainer: '#fbbf24',
}
