import type { Aircraft, SensorDef } from '../types'
import { mulberry32 } from '../lib/rng'

export interface Point {
  t: number
  v: number
}

export interface Series {
  sensor: SensorDef
  points: Point[]
}

/** How many samples we keep per sensor window. */
const WINDOW = 60

function drift(sensor: SensorDef, stress: number, phase: number): number {
  const span = Math.abs(sensor.crit - sensor.base)
  const dir = sensor.crit > sensor.base ? 1 : -1
  // slow sinusoidal drift + noise, biased toward the critical band when the system is degraded
  return Math.sin(phase) * span * 0.08 + dir * stress * span * 0.35
}

export function seedSeries(ac: Aircraft, sensor: SensorDef, startMs: number): Point[] {
  const rnd = mulberry32(Math.floor(Math.random() * 1e9))
  const sys = ac.systems.find(() => true)
  const stress = sys ? 1 - avgHealth(ac) / 100 : 0.3
  const pts: Point[] = []
  for (let i = WINDOW - 1; i >= 0; i--) {
    const t = startMs - i * 5000
    const phase = (WINDOW - i) / 7 + stress * 3
    const noise = (rnd() - 0.5) * 2 * sensor.noise
    pts.push({ t, v: round(sensor.base + drift(sensor, stress, phase) + noise) })
  }
  return pts
}

export function avgHealth(ac: Aircraft): number {
  return ac.systems.reduce((s, x) => s + x.health, 0) / ac.systems.length
}

export function tick(ac: Aircraft, sensor: SensorDef, prev: Point[], nowMs: number): Point[] {
  const last = prev[prev.length - 1]
  const stress = 1 - avgHealth(ac) / 100
  const phase = nowMs / 1000 / 6 + stress * 3
  const target = sensor.base + drift(sensor, stress, phase)
  const noise = (Math.random() - 0.5) * 2 * sensor.noise
  // mean-reverting step toward target so the trace looks alive but stable
  const v = last ? last.v + (target - last.v) * 0.35 + noise : target + noise
  const next = [...prev, { t: nowMs, v: round(v) }]
  if (next.length > WINDOW) next.shift()
  return next
}

function round(v: number): number {
  return Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10
}

export function band(sensor: SensorDef, v: number): 'nominal' | 'warn' | 'crit' {
  const rising = sensor.crit > sensor.base
  if (rising) {
    if (v >= sensor.crit) return 'crit'
    if (v >= sensor.warn) return 'warn'
    return 'nominal'
  }
  if (v <= sensor.crit) return 'crit'
  if (v <= sensor.warn) return 'warn'
  return 'nominal'
}
