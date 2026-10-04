/**
 * Streaming anomaly detection — the same maths a deployed condition-monitoring
 * service runs on ACMS/IoT channels: an adaptive EWMA baseline per channel,
 * a normalised z-score residual, and a CUSUM accumulator that catches small
 * sustained shifts a single threshold would miss.
 *
 * It is stateful and online: feed it one sample at a time (no batch needed),
 * so it works identically on the live simulated stream or on imported real
 * sensor exports.
 */

export interface DetectorState {
  n: number
  mean: number
  m2: number
  cusum: number
  spikes: number
}

export interface DetectorResult {
  z: number
  score: number
  fired: boolean
  state: DetectorState
}

export const initState = (): DetectorState => ({ n: 0, mean: 0, m2: 0, cusum: 0, spikes: 0 })

/** baseline adaptation rate — fast enough to follow seasonal drift, slow enough to keep signal */
const ALPHA = 0.06
/** CUSUM slack (allowed deviation before counting) and decision threshold */
const K = 1.1
const H = 5.5
/** samples before the baseline is trusted */
const WARMUP = 8

export function update(st: DetectorState, x: number): DetectorResult {
  const meanBefore = st.mean
  const m2Before = st.m2
  const n = st.n + 1

  const mean = st.n === 0 ? x : meanBefore + ALPHA * (x - meanBefore)
  const dev = st.n === 0 ? 0 : x - meanBefore
  const m2 = st.n === 0 ? 0 : m2Before + ALPHA * (dev * dev - m2Before)

  if (st.n < WARMUP) {
    return { z: 0, score: 0, fired: false, state: { n, mean, m2, cusum: 0, spikes: st.spikes } }
  }

  const sd = Math.sqrt(Math.max(m2, 1e-9))
  const z = (x - mean) / sd

  // two-sided CUSUM on the absolute normalised residual
  const cusum = Math.max(0, st.cusum + Math.max(0, Math.abs(z) - K))
  const fired = cusum > H

  return {
    z: Math.round(z * 100) / 100,
    score: Math.round(Math.min(100, (cusum / H) * 100)),
    fired,
    state: {
      n,
      mean,
      m2,
      cusum: fired ? 0 : cusum, // reset after an alarm so the next one is independent
      spikes: st.spikes + (fired ? 1 : 0),
    },
  }
}

/** offline helper: run the detector over a whole series (used by CSV import) */
export function run(values: number[]): { results: DetectorResult[]; anomalies: number } {
  let st = initState()
  const results: DetectorResult[] = []
  let anomalies = 0
  for (const v of values) {
    const r = update(st, v)
    st = r.state
    if (r.fired) anomalies++
    results.push(r)
  }
  return { results, anomalies }
}

/** tolerant CSV parsing: last numeric column of each row is the reading */
export function parseSensorCsv(text: string): { values: number[]; rows: number; skipped: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length)
  const values: number[] = []
  let skipped = 0
  let start = 0
  if (lines.length && /[a-df-z]/i.test((lines[0].match(/[a-zA-Z]+/g) ?? []).join(''))) start = 1
  for (let i = start; i < lines.length; i++) {
    const cells = lines[i].split(/[,;\t]/)
    let num: number | null = null
    for (let c = cells.length - 1; c >= 0; c--) {
      const v = Number(cells[c].replace(/[^0-9eE+.\-]/g, ''))
      if (Number.isFinite(v)) {
        num = v
        break
      }
    }
    if (num === null) skipped++
    else values.push(num)
  }
  return { values, rows: lines.length, skipped }
}
