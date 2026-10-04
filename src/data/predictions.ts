import type { Prediction } from '../types'
import { FLEET } from './fleet'
import { jitter } from '../lib/rng'

interface Template {
  sys: Prediction['system']
  component: string
  mode: string
  model: string
  rec: string
  drivers: string[]
}

const MODES: Template[] = [
  {
    sys: 'Propulsion',
    component: 'HPT stage-2 blisk',
    mode: 'Thermal fatigue cracking (blade creep)',
    model: 'GBM-RUL v4.2 + Isolation Forest',
    rec: 'Schedule borescope inspection at next turnaround; stage spare LPT module.',
    drivers: ['EGT margin erosion', 'N2 vibration RMS', 'Cycles since hot-section visit', 'Oil debris trend'],
  },
  {
    sys: 'Hydraulics',
    component: 'Engine-driven hydraulic pump B',
    mode: 'Internal wear → pressure decay',
    model: 'Isolation Forest v3.1',
    rec: 'Replace pump B at next 48h slot; carry over redundancy watch.',
    drivers: ['Sys-B pressure ripple', 'Hyd oil temp rise', 'Filter chip counts', 'Actuator response lag'],
  },
  {
    sys: 'Landing Gear',
    component: 'MLG actuator seal kit',
    mode: 'Seal degradation → strut leakage',
    model: 'Survival / Weibull v2.0',
    rec: 'Order seal kit now (14d lead); plan retraction test during A-check.',
    drivers: ['Shock strut pressure decay', 'Retraction cycle time', 'Ambient temp cycles', 'Brake temp differential'],
  },
  {
    sys: 'Fuel',
    component: 'Fuel boost pump LP-2',
    mode: 'Motor bearing spallation',
    model: 'Autoencoder anomaly v3.4',
    rec: 'Swap LP-2 pump; vibration signature crossed learned envelope.',
    drivers: ['Boost pump current ripple', 'LP pressure oscillation', 'Fuel flow delta', 'Vibration envelope kurtosis'],
  },
  {
    sys: 'Avionics',
    component: 'Radar processor card',
    mode: 'Intermittent bus CRC errors',
    model: 'Isolation Forest v3.1',
    rec: 'Pull card for bench test; MTBF model shows 71% 30-day failure chance.',
    drivers: ['1553 bus error rate', 'Card case temperature', 'Supply ripple', 'Bit-error logs'],
  },
  {
    sys: 'Airframe Structure',
    component: 'Wing root fatigue bay-3',
    mode: 'Crack-gauge growth beyond threshold',
    model: 'Physics-informed RUL v2.5',
    rec: 'Open structural NDT task; restrict to Category-B manoeuvres until inspected.',
    drivers: ['Fatigue crack gauge', 'Accumulated g-cycles', 'Flight hours since last NDT', 'Load factor spectrum'],
  },
  {
    sys: 'Environmental',
    component: 'ECS bleed air valve',
    mode: 'Valve position lag / sticking',
    model: 'GBM-RUL v4.2',
    rec: 'Function-check valve; replace if position error >8% on test.',
    drivers: ['Bleed valve position error', 'Cabin press diff', 'Bleed duct temp', 'Cycle count'],
  },
  {
    sys: 'Electrical',
    component: 'Generator CSD unit',
    mode: 'Constant-speed drive slipping',
    model: 'Autoencoder anomaly v3.4',
    rec: 'CSD load test this week; keep standby generator config.',
    drivers: ['Gen load share imbalance', 'DC bus voltage dip', 'CSD oil temp', 'Start cycles'],
  },
]

const CRIT_AIRCRAFT = ['AC-02', 'AC-06', 'AC-12', 'AC-16', 'AC-19', 'AC-04', 'AC-07', 'AC-10', 'AC-14']

function severity(days: number): Prediction['severity'] {
  if (days <= 3) return 'CRITICAL'
  if (days <= 10) return 'HIGH'
  if (days <= 25) return 'MODERATE'
  return 'LOW'
}

function build(): Prediction[] {
  const out: Prediction[] = []
  let n = 0
  for (const ac of FLEET) {
    const worst = [...ac.systems].sort((a, b) => a.health - b.health)
    const critical = CRIT_AIRCRAFT.includes(ac.id)
    const count = critical ? 2 : ac.status === 'AIRWORTHY' ? 1 : 1
    for (let i = 0; i < count; i++) {
      const sysName = worst[i].name
      const tpl = MODES.find((m) => m.sys === sysName) ?? MODES[0]
      const health = worst[i].health
      const rulDays =
        health < 50
          ? jitter(ac.id + i + 'rul', 1, 6)
          : health < 70
            ? jitter(ac.id + i + 'rul', 5, 22)
            : jitter(ac.id + i + 'rul', 18, 74)
      const confidence = Math.round(
        (health < 50 ? jitter(ac.id + i + 'c', 0.86, 0.97) : jitter(ac.id + i + 'c', 0.62, 0.93)) * 100,
      )
      const anomaly = Math.round(
        (health < 50 ? jitter(ac.id + i + 'a', 0.82, 0.98) : jitter(ac.id + i + 'a', 0.55, 0.9)) * 100,
      )
      n++
      out.push({
        id: `PRD-${String(4100 + n)}`,
        aircraftId: ac.id,
        tail: ac.tail,
        system: sysName,
        component: `${ac.type} · ${tpl.component}`,
        failureMode: tpl.mode,
        rulDays: Math.round(rulDays * 10) / 10,
        rulHours: Math.round(rulDays * 4.5 * 10) / 10,
        confidence,
        severity: severity(rulDays),
        anomaly,
        leadTimeHrs: Math.round(jitter(ac.id + n + 'l', 36, 216)),
        drivers: tpl.drivers.map((d, k) => ({
          feature: d,
          contrib: Math.round((jitter(ac.id + n + d, k === 0 ? 0.28 : 0.05, k === 0 ? 0.42 : 0.24)) * 100),
        })),
        recommendation: tpl.rec,
        model: tpl.model,
        raisedAt: new Date(Date.now() - jitter(ac.id + n + 'ts', 0.5, 40) * 3600e3).toISOString(),
      })
    }
  }
  return out.sort((a, b) => a.rulDays - b.rulDays)
}

export const PREDICTIONS: Prediction[] = build()

export const byAircraft = (id: string) => PREDICTIONS.filter((p) => p.aircraftId === id)
