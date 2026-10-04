import type { ReactNode } from 'react'

export function Card({
  title,
  subtitle,
  right,
  children,
  className = '',
  pad = true,
}: {
  title?: string
  subtitle?: string
  right?: ReactNode
  children: ReactNode
  className?: string
  pad?: boolean
}) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <header className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          {right && <div className="card-right">{right}</div>}
        </header>
      )}
      <div className={pad ? 'card-body' : 'card-body flush'}>{children}</div>
    </section>
  )
}

export function Kpi({
  label,
  value,
  unit,
  delta,
  tone = 'neutral',
  foot,
}: {
  label: string
  value: string | number
  unit?: string
  delta?: string
  tone?: 'ok' | 'warn' | 'bad' | 'neutral' | 'info'
  foot?: string
}) {
  return (
    <div className={`kpi tone-${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      <div className="kpi-foot">
        {delta && <span className={`kpi-delta tone-${tone}`}>{delta}</span>}
        {foot && <span className="muted">{foot}</span>}
      </div>
    </div>
  )
}

const TONE_MAP: Record<string, string> = {
  AIRWORTHY: 'ok',
  COMPLETED: 'ok',
  SYNCED: 'ok',
  STABLE: 'ok',
  CRITICAL: 'bad',
  AOG: 'bad',
  'IN MAINTENANCE': 'warn',
  'DUE INSPECTION': 'warn',
  'AWAITING SPARES': 'warn',
  STALE: 'warn',
  DRIFT: 'bad',
  MONITOR: 'warn',
  HIGH: 'warn',
  MODERATE: 'info',
  LOW: 'muted',
  P1: 'bad',
  P2: 'warn',
  P3: 'info',
}

export function Tag({ children, tone }: { children: string; tone?: string }) {
  const t = tone ?? TONE_MAP[children] ?? 'info'
  return <span className={`tag tag-${t}`}>{children}</span>
}

export function Pill({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button className={`pill ${active ? 'on' : ''}`} onClick={onClick} type="button">
      {children}
    </button>
  )
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o} type="button" className={o === value ? 'on' : ''} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

export function Table({
  head,
  children,
  dense,
}: {
  head: (string | ReactNode)[]
  children: ReactNode
  dense?: boolean
}) {
  return (
    <div className="table-wrap">
      <table className={dense ? 'table dense' : 'table'}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>
}
