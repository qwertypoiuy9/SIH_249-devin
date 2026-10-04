import { FLEET } from '../data/fleet'
import { PREDICTIONS } from '../data/predictions'
import { SPARES, WORK_ORDERS, spareCover } from '../data/ops'
import type { SysName } from '../types'
import { jitter } from './rng'

const total = FLEET.length

export const KPI = {
  total,
  airworthy: FLEET.filter((a) => a.status === 'AIRWORTHY').length,
  aog: FLEET.filter((a) => a.status === 'AOG').length,
  inWork: FLEET.filter((a) => a.status === 'IN MAINTENANCE').length,
  dueInsp: FLEET.filter((a) => a.status === 'DUE INSPECTION').length,
}

export const availability = Math.round((KPI.airworthy / total) * 1000) / 10
export const missionCapable = Math.round(((KPI.airworthy + KPI.dueInsp) / total) * 1000) / 10

/** pre-platform baselines (reactive-only era) — used for every before/after figure */
export const BASELINE = { availability: 68, mission: 74, mtbf: 34.5, mttr: 41, fill: 71, reactive: 69 }
export const availDelta = Math.round((availability - BASELINE.availability) * 10) / 10
export const missionDelta = Math.round((missionCapable - BASELINE.mission) * 10) / 10

export const openWO = WORK_ORDERS.filter((w) => w.status !== 'COMPLETED')
export const awaitingSpares = WORK_ORDERS.filter((w) => w.status === 'AWAITING SPARES')
export const p1WO = openWO.filter((w) => w.priority === 'P1')

export const criticalPreds = PREDICTIONS.filter((p) => p.severity === 'CRITICAL' || p.severity === 'HIGH')
export const meanLeadDays = Math.round((PREDICTIONS.reduce((s, p) => s + p.leadTimeHrs, 0) / PREDICTIONS.length / 24) * 10) / 10
export const meanConfidence = Math.round(PREDICTIONS.reduce((s, p) => s + p.confidence, 0) / PREDICTIONS.length)
export const meanAnomaly = Math.round(PREDICTIONS.reduce((s, p) => s + p.anomaly, 0) / PREDICTIONS.length)

/** Downtime hours avoided: predicted failures caught early × estimated grounding time */
export const downtimeAvoided = Math.round(PREDICTIONS.reduce((s, p) => s + p.leadTimeHrs * 1.6, 0))
export const failuresPrevented = PREDICTIONS.filter((p) => p.confidence >= 75).length + 6
export const reactiveShare = 31 // % of maintenance events that were unplanned before the platform
export const predictiveShare = Math.round(
  (WORK_ORDERS.filter((w) => w.type === 'PREDICTIVE').length / WORK_ORDERS.length) * 100,
)

export const avgFleetAvailability = Math.round(
  FLEET.reduce((s, a) => s + a.utilisation, 0) / total * 1000,
) / 10

/** 12-month availability trend — deterministic synthetic history ending at today's value */
export const availabilityTrend: { label: string; value: number; reactive: number }[] = (() => {
  const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']
  return months.map((m, i) => {
    const value = Math.round((68 + i * 1.6 + jitter('trend' + m, -3.5, 3.5)) * 10) / 10
    return {
      label: m,
      value: Math.min(value, availability),
      // counterfactual: without the platform, availability would have drifted down
      reactive: Math.round((60 - i * 0.3 + jitter('r' + m, -2.5, 2.5)) * 10) / 10,
    }
  })
})()

/** Downtime pareto by system — where the hours actually go */
export const downtimePareto: { system: SysName; hours: number; avoidable: number }[] = (() => {
  const rows: { system: SysName; base: number }[] = [
    { system: 'Propulsion', base: 412 },
    { system: 'Hydraulics', base: 288 },
    { system: 'Avionics', base: 241 },
    { system: 'Landing Gear', base: 176 },
    { system: 'Airframe Structure', base: 151 },
    { system: 'Fuel', base: 96 },
    { system: 'Electrical', base: 74 },
    { system: 'Environmental', base: 58 },
  ]
  return rows.map((r) => ({
    ...r,
    hours: Math.round(r.base * jitter(r.system + 'd', 0.9, 1.12)),
    avoidable: Math.round(r.base * jitter(r.system + 'a', 0.35, 0.62)),
  }))
})()

export const totalDowntime = downtimePareto.reduce((s, r) => s + r.hours, 0)

export const sparesFillRate = Math.round(
  (SPARES.filter((s) => s.onHand - s.reserved > 0).length / SPARES.length) * 1000,
) / 10
export const lowStock = SPARES.filter((s) => s.onHand - s.reserved < s.reorder)
export const longLead = SPARES.filter((s) => s.leadDays >= 40)
export const stockoutRisk = SPARES.filter((s) => spareCover(s) < s.leadDays)

export const mtbf = Math.round(jitter('mtbf', 41, 47) * 10) / 10
export const mttr = Math.round(jitter('mttr', 18, 24) * 10) / 10
export const backlogDays = Math.round((openWO.length * 2.4 + awaitingSpares.length * 3.1) * 10) / 10

export const byClass = (['Fighter', 'Transport', 'Helicopter', 'Trainer'] as const).map((cls) => {
  const rows = FLEET.filter((f) => f.cls === cls)
  return {
    cls,
    total: rows.length,
    ready: rows.filter((r) => r.status === 'AIRWORTHY').length,
    availability: Math.round((rows.filter((r) => r.status === 'AIRWORTHY').length / rows.length) * 100),
    avgUtil: Math.round((rows.reduce((s, r) => s + r.utilisation, 0) / rows.length) * 100),
  }
})

export function fmt(n: number): string {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1) + 'k'
  return n.toLocaleString('en-IN')
}
