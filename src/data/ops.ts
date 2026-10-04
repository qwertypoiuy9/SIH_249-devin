import type { DataAsset, ModelCard, Spare, SysName, TechRecord, WorkOrder } from '../types'
import { FLEET } from './fleet'
import { PREDICTIONS } from './predictions'
import { jitter } from '../lib/rng'

/* ---------------------------------------------------------------- work orders */

const AGENCIES = [
  'No. 51 Base Repair Depot',
  'No. 17 Base Repair Depot',
  'HAL (OEM)',
  'Squadron Flight Line',
  'EME Workshop',
  'Third-party NDT vendor',
]

const WO_TITLES: Record<string, [string, WorkOrder['system']]> = {
  'HPT stage-2 blisk': ['Hot-section borescope + blisk NDT', 'Propulsion'],
  'Engine-driven hydraulic pump B': ['Replace hyd pump B, system pressure test', 'Hydraulics'],
  'MLG actuator seal kit': ['MLG actuator seal kit replacement', 'Landing Gear'],
  'Fuel boost pump LP-2': ['Replace fuel boost pump LP-2', 'Fuel'],
  'Radar processor card': ['Radar processor card bench test / swap', 'Avionics'],
  'Wing root fatigue bay-3': ['Wing root NDT — bay-3 crack check', 'Airframe Structure'],
  'ECS bleed air valve': ['ECS bleed valve function check', 'Environmental'],
  'Generator CSD unit': ['CSD load share test & filter change', 'Electrical'],
}

const pad = (n: number) => String(n).padStart(4, '0')

function buildWorkOrders(): WorkOrder[] {
  const out: WorkOrder[] = []
  let i = 0

  // 1. every open AI prediction converts into a predictive work order
  for (const p of PREDICTIONS) {
    i++
    const [title, system] = WO_TITLES['HPT stage-2 blisk']
    void title
    const entry = Object.entries(WO_TITLES).find(([k]) => p.component.includes(k))
    const status: WorkOrder['status'] =
      p.severity === 'CRITICAL'
        ? 'IN WORK'
        : p.severity === 'HIGH'
          ? jitter(p.id + 's', 0, 1) > 0.5
            ? 'AWAITING SPARES'
            : 'SCHEDULED'
          : 'SCHEDULED'
    out.push({
      id: `WO-${pad(7300 + i)}`,
      aircraftId: p.aircraftId,
      tail: p.tail,
      system: entry ? entry[1][1] : system,
      title: entry ? entry[1][0] : `Address ${p.component} anomaly`,
      type: 'PREDICTIVE',
      priority: p.severity === 'CRITICAL' ? 'P1' : p.severity === 'HIGH' ? 'P2' : 'P3',
      status,
      agency: AGENCIES[Math.floor(jitter(p.id + 'ag', 0, AGENCIES.length)) % AGENCIES.length],
      opened: new Date(Date.now() - jitter(p.id + 'o', 0.2, 9) * 86400e3).toISOString(),
      tatDays: Math.max(1, Math.round(p.rulDays * 0.55)),
      progress:
        status === 'IN WORK'
          ? Math.round(jitter(p.id + 'p', 25, 85))
          : status === 'AWAITING SPARES'
            ? Math.round(jitter(p.id + 'p', 5, 30))
            : status === 'SCHEDULED'
              ? 0
              : 100,
    })
  }

  // 2. preventive / due-inspection work from the schedule
  const preventive = FLEET.filter((a) => a.status !== 'AIRWORTHY' || a.nextInspDays < 15)
  for (const a of preventive) {
    i++
    const isInsp = a.nextInspDays < 15
    out.push({
      id: `WO-${pad(7300 + i)}`,
      aircraftId: a.id,
      tail: a.tail,
      system: isInsp ? 'Airframe Structure' : 'Propulsion',
      title: isInsp ? `${a.type} — scheduled phase inspection (${a.nextInspDays}d)` : `${a.type} — 250fh servicing`,
      type: 'PREVENTIVE',
      priority: isInsp ? 'P2' : 'P3',
      status: a.status === 'AOG' ? 'IN WORK' : a.status === 'IN MAINTENANCE' ? 'IN WORK' : 'SCHEDULED',
      agency: a.status === 'AOG' ? 'Squadron Flight Line' : AGENCIES[Math.floor(jitter(a.id + 'pa', 0, 5)) % 5],
      opened: new Date(Date.now() - jitter(a.id + 'po', 0.5, 6) * 86400e3).toISOString(),
      tatDays: isInsp ? 6 : 3,
      progress: a.status === 'AOG' ? Math.round(jitter(a.id + 'pp', 35, 70)) : 0,
    })
  }

  // 3. corrective backlog from tech records
  const correctiveSeed = [
    ['AC-01', 'Radar mode-4 intermittent drop-out', 'Avionics', 'P2', 'HAL (OEM)'],
    ['AC-03', 'Engine #2 oil streaking on nozzle', 'Propulsion', 'P2', 'No. 51 Base Repair Depot'],
    ['AC-05', 'APU start failure on 2nd attempt', 'Propulsion', 'P3', 'Squadron Flight Line'],
    ['AC-08', 'Nose-wheel steering shimmy', 'Landing Gear', 'P3', 'EME Workshop'],
    ['AC-09', 'HYD system-A reservoir low warning', 'Hydraulics', 'P2', 'Squadron Flight Line'],
    ['AC-11', 'Weather radar scan asymmetry', 'Avionics', 'P3', 'HAL (OEM)'],
    ['AC-13', 'Galley O2 bottle pressure low', 'Environmental', 'P3', 'Squadron Flight Line'],
    ['AC-15', 'Tail rotor vibration above limit', 'Airframe Structure', 'P1', 'No. 17 Base Repair Depot'],
    ['AC-17', 'Flap position indicator intermittent', 'Avionics', 'P3', 'EME Workshop'],
    ['AC-18', 'Canopy seal leak at high alt', 'Environmental', 'P3', 'Third-party NDT vendor'],
    ['AC-20', 'Brake wear pin at limit', 'Landing Gear', 'P2', 'Squadron Flight Line'],
    ['AC-02', 'Main generator CSD overheat light', 'Electrical', 'P1', 'No. 51 Base Repair Depot'],
  ] as const
  for (const [acId, title, system, priority, agency] of correctiveSeed) {
    i++
    const ac = FLEET.find((f) => f.id === acId)!
    const st: WorkOrder['status'] =
      priority === 'P1' ? 'IN WORK' : jitter(acId + title, 0, 1) > 0.65 ? 'AWAITING SPARES' : jitter(acId + title, 0, 1) > 0.5 ? 'QA HOLD' : 'SCHEDULED'
    out.push({
      id: `WO-${pad(7300 + i)}`,
      aircraftId: ac.id,
      tail: ac.tail,
      system: system as WorkOrder['system'],
      title,
      type: 'CORRECTIVE',
      priority: priority as WorkOrder['priority'],
      status: st,
      agency,
      opened: new Date(Date.now() - jitter(acId + title + 'o', 1, 24) * 86400e3).toISOString(),
      tatDays: Math.round(jitter(acId + title + 't', 2, 11)),
      progress: st === 'IN WORK' ? Math.round(jitter(acId + title + 'p', 30, 90)) : st === 'QA HOLD' ? 100 : 0,
      spare: st === 'AWAITING SPARES' ? 'Awaiting indent release' : undefined,
    })
  }
  return out
}

export const WORK_ORDERS: WorkOrder[] = buildWorkOrders()

/* ---------------------------------------------------------------- spares */

function buildSpares(): Spare[] {
  const rows: Omit<Spare, 'onHand' | 'reserved'>[] = [
    { part: '41A-9001-02', name: 'HPT stage-2 blisk set', reorder: 2, leadDays: 140, criticality: 'A', supplier: 'OEM (aero engines)', demand30: 3 },
    { part: '29B-3310-07', name: 'Hyd pump B assembly', reorder: 3, leadDays: 45, criticality: 'A', supplier: 'HAL', demand30: 4 },
    { part: '52C-1140-01', name: 'MLG actuator seal kit', reorder: 6, leadDays: 14, criticality: 'A', supplier: 'OEM landing gear', demand30: 6 },
    { part: '65A-2208-11', name: 'Fuel boost pump LP-2', reorder: 4, leadDays: 30, criticality: 'A', supplier: 'HAL', demand30: 5 },
    { part: '70A-4412-03', name: 'Radar processor card', reorder: 2, leadDays: 90, criticality: 'A', supplier: 'OEM avionics', demand30: 2 },
    { part: '53A-6702-09', name: 'Brake wear pack', reorder: 8, leadDays: 21, criticality: 'B', supplier: 'Domestic L1', demand30: 11 },
    { part: '72A-1150-04', name: 'Generator CSD unit', reorder: 2, leadDays: 75, criticality: 'A', supplier: 'OEM electrical', demand30: 2 },
    { part: '36A-2040-06', name: 'ECS bleed air valve', reorder: 3, leadDays: 40, criticality: 'B', supplier: 'HAL', demand30: 3 },
    { part: '21A-0330-12', name: 'Engine oil filter element', reorder: 12, leadDays: 7, criticality: 'C', supplier: 'Domestic L1', demand30: 18 },
    { part: '16A-5501-08', name: 'Hyd filter / chip detector', reorder: 10, leadDays: 9, criticality: 'B', supplier: 'Domestic L1', demand30: 14 },
    { part: '25A-7788-02', name: 'Tyre 900×200 (main)', reorder: 6, leadDays: 18, criticality: 'B', supplier: 'Domestic L1', demand30: 9 },
    { part: '79A-1002-15', name: 'Canopy seal set', reorder: 4, leadDays: 26, criticality: 'C', supplier: 'OEM airframe', demand30: 2 },
  ]
  return rows.map((r) => {
    const usage = r.demand30 / 30
    const cover = jitter(r.part, 2, 46)
    const onHand = Math.max(0, Math.round(usage * cover))
    return {
      ...r,
      onHand,
      reserved: Math.round(onHand * jitter(r.part + 'r', 0.05, 0.4)),
    }
  })
}

export const SPARES: Spare[] = buildSpares()

export const spareCover = (s: Spare) => {
  const net = s.onHand - s.reserved
  const daily = Math.max(0.05, s.demand30 / 30)
  return Math.round((net / daily) * 10) / 10
}

/** the part an alert for a given system would indent first */
const SPARE_FOR: Record<SysName, string> = {
  Propulsion: '41A-9001-02',
  Hydraulics: '29B-3310-07',
  'Landing Gear': '52C-1140-01',
  Fuel: '65A-2208-11',
  Avionics: '70A-4412-03',
  'Airframe Structure': '79A-1002-15',
  Environmental: '36A-2040-06',
  Electrical: '72A-1150-04',
}

export const spareForSystem = (sys: SysName): Spare =>
  SPARES.find((s) => s.part === SPARE_FOR[sys]) ?? SPARES[0]

/* ---------------------------------------------------------------- technical records */

function buildRecords(): TechRecord[] {
  const seeds: [string, TechRecord['kind'], string, boolean, string][] = [
    ['AC-02', 'DEFECT', 'ENG 1: EGT margin reduced to 28°C, vibration 6.1 mm/s on last sortie. FAULT 5218 raised.', false, 'Health Monitor'],
    ['AC-06', 'DEFECT', 'Hyd sys-B pressure dropped to 2,180 psi during retraction. AOG declared 03 Oct.', false, 'Tech Logbook'],
    ['AC-12', 'DEFECT', 'No.2 engine FOD — 3 compressor blades damaged. Engine removed to depot.', false, 'Tech Logbook'],
    ['AC-16', 'INSPECTION', 'Phase inspection due in 3 cycles — crack gauge bay-3 showing 1.7 mm growth.', false, 'Tech Logbook'],
    ['AC-19', 'COMPONENT CARD', 'CSD unit swapped, old unit P/N 72A-1150-04 sent for bench test.', true, 'Component Cards'],
    ['AC-01', 'FLIGHT LOG', 'Sortie 4.2h, 3 low-level profiles, 1 night landing. No defects.', true, 'Flight Ops'],
    ['AC-03', 'ENGINE TREND', 'EDMU trend: fuel flow +1.9% vs baseline across last 10 sorties.', false, 'Health Monitor'],
    ['AC-04', 'INSPECTION', 'Pre-flight A-check opened. 14 defects carried forward from last period.', false, 'Tech Logbook'],
    ['AC-07', 'DEFECT', 'Radar BIT fault 0x2A intermittent — avionics bay card reseated.', true, 'Health Monitor'],
    ['AC-10', 'ENGINE TREND', 'Oil debris 4.8 mg/L, ferrous content rising — filter change scheduled.', false, 'Health Monitor'],
    ['AC-14', 'DEFECT', 'Flap asymmetric indication on final approach. Aircraft grounded for check.', false, 'Tech Logbook'],
    ['AC-05', 'FLIGHT LOG', 'Sortie 1.4h, 6 touch-and-go. APU start anomaly noted.', false, 'Flight Ops'],
    ['AC-17', 'COMPONENT CARD', 'Radar processor card RMA raised with OEM, TAT 45 days.', false, 'Component Cards'],
    ['AC-20', 'DEFECT', 'Brake wear pin at limit after 96 landings. Wear pack change pending.', false, 'Tech Logbook'],
    ['AC-13', 'FLIGHT LOG', 'Sortie 6.1h, 2 airdrops. Serviceable.', true, 'Flight Ops'],
    ['AC-15', 'DEFECT', 'Tail rotor vibration 0.42 IPS above limit. Attention required.', false, 'Health Monitor'],
    ['AC-09', 'INSPECTION', 'Weekly hydraulic leak check — trace seepage at actuator B-2.', false, 'Tech Logbook'],
    ['AC-11', 'FLIGHT LOG', 'Sortie 3.3h high-altitude load. No defects.', true, 'Flight Ops'],
    ['AC-08', 'ENGINE TREND', 'N2 vibration trend flat at 2.6 mm/s. Nominal.', true, 'Health Monitor'],
    ['AC-18', 'FLIGHT LOG', 'Training sortie 1.1h, 12 circuits. Serviceable.', true, 'Flight Ops'],
  ]
  return seeds.map((s, i) => ({
    id: `TR-${String(9000 + i)}`,
    tail: FLEET.find((f) => f.id === s[0])!.tail,
    kind: s[1],
    text: s[2],
    closed: s[3],
    source: s[4],
    date: new Date(Date.now() - (i * 9 + 2) * 3600e3).toISOString(),
  }))
}

export const TECH_RECORDS: TechRecord[] = buildRecords()

/* ---------------------------------------------------------------- data integration assets */

export const DATA_ASSETS: DataAsset[] = [
  {
    key: 'hm',
    name: 'Aircraft health monitoring (onboard IoT)',
    sourceSystem: 'ACMS / health monitor',
    records: 1_284_402,
    synced: '42s ago',
    state: 'SYNCED',
    health: 97,
    note: 'Sensor streams: vibration, EGT, hyd, pressure, structural gauges',
  },
  {
    key: 'tr',
    name: 'Technical records & logbooks',
    sourceSystem: 'Digitised tech logbook',
    records: 96_318,
    synced: '3m ago',
    state: 'SYNCED',
    health: 92,
    note: 'Flight logs, defect entries, component cards, inspection sheets',
  },
  {
    key: 'sp',
    name: 'Spares & inventory',
    sourceSystem: 'Stores ERP',
    records: 41_770,
    synced: '8m ago',
    state: 'SYNCING',
    health: 84,
    note: 'On-hand, reservations, indents, supplier lead times',
  },
  {
    key: 'ag',
    name: 'Maintenance agencies & depots',
    sourceSystem: 'Partner / depot feed',
    records: 12_946,
    synced: '26m ago',
    state: 'STALE',
    health: 68,
    note: 'Work-order status from HAL, EME workshops, third-party NDT vendors',
  },
  {
    key: 'fx',
    name: 'Flight ops & utilisation',
    sourceSystem: 'Ops scheduling',
    records: 218_005,
    synced: '2m ago',
    state: 'SYNCED',
    health: 95,
    note: 'Sortie hours, cycles, taskings, mission-capable windows',
  },
]

/* ---------------------------------------------------------------- model registry */

export const MODELS: ModelCard[] = [
  {
    key: 'rul',
    name: 'RUL regressor (GBM-RUL v4.2)',
    task: 'Remaining useful life, hours per LRU',
    algo: 'Gradient-boosted trees + physics priors',
    metrics: [
      { label: 'MAE', value: '6.4 h' },
      { label: 'R²', value: '0.91' },
      { label: 'Recall@7d', value: '0.94' },
      { label: 'Coverage', value: '86%' },
    ],
    drift: 'STABLE',
    trained: '28 Sep 2026',
  },
  {
    key: 'iso',
    name: 'Anomaly detector (Isolation Forest v3.1)',
    task: 'Multivariate sensor anomaly on live streams',
    algo: 'Isolation Forest, per-system ensembles',
    metrics: [
      { label: 'Precision', value: '0.88' },
      { label: 'Recall', value: '0.83' },
      { label: 'F1', value: '0.85' },
      { label: 'Alerts/day', value: '11' },
    ],
    drift: 'MONITOR',
    trained: '21 Sep 2026',
  },
  {
    key: 'ae',
    name: 'Autoencoder envelope (v3.4)',
    task: 'Unsupervised deviation from healthy signature',
    algo: 'Denoising autoencoder, 32-d latent',
    metrics: [
      { label: 'AUC-ROC', value: '0.96' },
      { label: 'FPR', value: '2.1%' },
      { label: 'Latency', value: '38 ms' },
      { label: 'Sensors', value: '64' },
    ],
    drift: 'STABLE',
    trained: '30 Sep 2026',
  },
  {
    key: 'surv',
    name: 'Survival model (Weibull v2.0)',
    task: 'Failure hazard curves for seals, pumps, tyres',
    algo: 'Weibull / Cox proportional hazards',
    metrics: [
      { label: 'C-index', value: '0.79' },
      { label: 'Calibration', value: '0.93' },
      { label: 'Horizon', value: '90 d' },
      { label: 'LRUs', value: '48' },
    ],
    drift: 'DRIFT',
    trained: '12 Sep 2026',
  },
]
