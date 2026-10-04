import type { ReactNode } from 'react'

/* ------------------------------------------------------------------ helpers */

function scale(points: number[], min?: number, max?: number) {
  const lo = min ?? Math.min(...points)
  const hi = max ?? Math.max(...points)
  const span = hi - lo || 1
  return { lo, hi, norm: (v: number) => (v - lo) / span }
}

function path(values: number[], w: number, h: number, pad: number, s: { norm: (v: number) => number }) {
  if (values.length < 2) return ''
  const step = (w - pad * 2) / (values.length - 1)
  return values
    .map((v, i) => {
      const x = pad + i * step
      const y = h - pad - s.norm(v) * (h - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/* ------------------------------------------------------------------ line chart */

export interface LineSeries {
  name: string
  color: string
  values: number[]
  dashed?: boolean
}

export function LineChart({
  series,
  height = 200,
  min,
  max,
  warn,
  crit,
  unit = '',
  yFormat = (v: number) => v.toFixed(0),
  labels,
}: {
  series: LineSeries[]
  height?: number
  min?: number
  max?: number
  warn?: number
  crit?: number
  unit?: string
  yFormat?: (v: number) => string
  labels?: string[]
}) {
  const all = series.flatMap((s) => s.values)
  if (!all.length) return null
  const { lo, hi } = scale(all, min, max)
  const w = 640
  const h = height
  const pad = 26
  const ticks = 4
  const gridY = Array.from({ length: ticks + 1 }, (_, i) => lo + ((hi - lo) * i) / ticks)

  const yFor = (v: number) => h - pad - ((v - lo) / (hi - lo || 1)) * (h - pad * 2)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img">
      {gridY.map((g, i) => (
        <g key={i}>
          <line x1={pad} x2={w - 6} y1={yFor(g)} y2={yFor(g)} className="grid" />
          <text x={4} y={yFor(g) + 3} className="axis">
            {yFormat(g)}
          </text>
        </g>
      ))}
      {crit !== undefined && (
        <line x1={pad} x2={w - 6} y1={yFor(crit)} y2={yFor(crit)} className="thresh crit" />
      )}
      {warn !== undefined && (
        <line x1={pad} x2={w - 6} y1={yFor(warn)} y2={yFor(warn)} className="thresh warn" />
      )}
      {series.map((s) => (
        <path
          key={s.name}
          d={path(s.values, w - 6 + pad - pad, h, pad, { norm: (v) => (v - lo) / (hi - lo || 1) })}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          strokeDasharray={s.dashed ? '5 4' : undefined}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {labels?.map((l, i) => (
        <text
          key={l + i}
          x={pad + (i * (w - pad - 6)) / Math.max(1, labels.length - 1)}
          y={h - 6}
          className="axis"
          textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}
        >
          {l}
        </text>
      ))}
      <text x={w - 6} y={12} className="axis unit" textAnchor="end">
        {unit}
      </text>
    </svg>
  )
}

/* ------------------------------------------------------------------ sparkline */

export function Spark({ values, color = '#4cc2ff', height = 34 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return <svg viewBox={`0 0 100 ${height}`} className="chart" />
  const { lo, hi } = scale(values)
  const w = 100
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = height - 3 - ((v - lo) / (hi - lo || 1)) * (height - 6)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="chart spark" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/* ------------------------------------------------------------------ gauge */

export function Gauge({
  value,
  label,
  sub,
  size = 168,
  color,
}: {
  value: number
  label: string
  sub?: string
  size?: number
  color?: string
}) {
  const v = Math.max(0, Math.min(100, value))
  const r = 70
  const cx = 90
  const cy = 90
  const start = -Math.PI * 0.75
  const end = Math.PI * 0.75
  const arc = (from: number, to: number) => {
    const x1 = cx + r * Math.cos(from)
    const y1 = cy + r * Math.sin(from)
    const x2 = cx + r * Math.cos(to)
    const y2 = cy + r * Math.sin(to)
    return `M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${to - from > Math.PI ? 1 : 0} 1 ${x2.toFixed(1)},${y2.toFixed(1)}`
  }
  const frac = v / 100
  const col = color ?? (v >= 80 ? '#34d399' : v >= 65 ? '#fbbf24' : '#f87171')
  return (
    <div className="gauge" style={{ width: size }}>
      <svg viewBox="0 0 180 160" width={size}>
        <path d={arc(start, end)} className="gauge-track" fill="none" strokeWidth={13} strokeLinecap="round" />
        <path
          d={arc(start, start + (end - start) * frac)}
          fill="none"
          stroke={col}
          strokeWidth={13}
          strokeLinecap="round"
        />
        <text x={90} y={92} textAnchor="middle" className="gauge-value">
          {v.toFixed(1)}%
        </text>
        <text x={90} y={116} textAnchor="middle" className="gauge-label">
          {label}
        </text>
      </svg>
      {sub && <div className="gauge-sub">{sub}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ bars */

export function BarRow({
  label,
  value,
  max,
  color = '#4cc2ff',
  suffix = '',
  right,
}: {
  label: string
  value: number
  max: number
  color?: string
  suffix?: string
  right?: string
}) {
  const pct = Math.max(2, (value / (max || 1)) * 100)
  return (
    <div className="barrow">
      <div className="barrow-label">{label}</div>
      <div className="barrow-track">
        <div className="barrow-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="barrow-value">
        {right ?? `${value}${suffix}`}
      </div>
    </div>
  )
}

export function HealthBar({ value }: { value: number }) {
  const col = value >= 80 ? 'ok' : value >= 60 ? 'warn' : 'bad'
  return (
    <div className={`health ${col}`} title={`${value.toFixed(0)}%`}>
      <div className="health-fill" style={{ width: `${Math.max(4, value)}%` }} />
    </div>
  )
}

/* ------------------------------------------------------------------ donut */

export function Donut({
  segments,
  size = 140,
  center,
  caption,
}: {
  segments: { label: string; value: number; color: string }[]
  size?: number
  center?: ReactNode
  caption?: string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const R = 60
  const C = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="donut">
      <svg viewBox="0 0 160 160" width={size} height={size}>
        <g transform="rotate(-90 80 80)">
          {segments.map((s) => {
            const len = (s.value / total) * C
            const el = (
              <circle
                key={s.label}
                cx={80}
                cy={80}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={16}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            )
            offset += len
            return el
          })}
        </g>
        {center && (
          <text x={80} y={86} textAnchor="middle" className="donut-center">
            {center}
          </text>
        )}
      </svg>
      {caption && <div className="donut-caption">{caption}</div>}
      <div className="legend">
        {segments.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} /> {s.label} · {s.value}
          </span>
        ))}
      </div>
    </div>
  )
}
