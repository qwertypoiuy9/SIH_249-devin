import { useMemo, useState } from 'react'
import { Card, Kpi, Table, Tag, Pill } from '../components/ui'
import { FLEET, CLASS_COLORS } from '../data/fleet'
import { PREDICTIONS } from '../data/predictions'
import { WORK_ORDERS } from '../data/ops'
import type { AircraftStatus, AirframeClass } from '../types'

type Filter = 'All' | AirframeClass | AircraftStatus

const FILTERS: Filter[] = [
  'All',
  'Fighter',
  'Transport',
  'Helicopter',
  'Trainer',
  'AIRWORTHY',
  'IN MAINTENANCE',
  'DUE INSPECTION',
  'AOG',
]

export default function Fleet({ onOpenAircraft }: { onOpenAircraft: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>('All')
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    return FLEET.filter((a) => {
      const matchFilter =
        filter === 'All' || a.cls === filter || a.status === (filter as AircraftStatus)
      const matchQ =
        !q ||
        a.tail.toLowerCase().includes(q.toLowerCase()) ||
        a.type.toLowerCase().includes(q.toLowerCase()) ||
        a.sqn.toLowerCase().includes(q.toLowerCase()) ||
        a.base.toLowerCase().includes(q.toLowerCase())
      return matchFilter && matchQ
    })
  }, [filter, q])

  const avgAvail = Math.round(
    (FLEET.filter((a) => a.status === 'AIRWORTHY').length / FLEET.length) * 100,
  )

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h2>Fleet inventory</h2>
          <p>
            Every airframe carries one unified record — technical log, sensor health, utilisation and open work — instead
            of the four disconnected systems that used to exist.
          </p>
        </div>
        <div className="spacer" />
        <input
          className="search"
          placeholder="Search tail, type, squadron, base…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="grid g4">
        <Kpi label="Airframes" value={FLEET.length} tone="neutral" foot="4 classes · 9 types" />
        <Kpi label="Available now" value={avgAvail} unit="%" tone="ok" foot={`${FLEET.filter((a) => a.status === 'AIRWORTHY').length} airworthy`} />
        <Kpi
          label="Grounded (AOG + maintenance)"
          value={FLEET.filter((a) => a.status === 'AOG' || a.status === 'IN MAINTENANCE').length}
          tone="bad"
          foot="recoverable within 14 days"
        />
        <Kpi
          label="Open AI alerts on fleet"
          value={PREDICTIONS.length}
          tone="warn"
          foot={`${PREDICTIONS.filter((p) => p.severity === 'CRITICAL').length} critical`}
        />
      </div>

      <Card
        title="Airframes"
        subtitle={`${rows.length} of ${FLEET.length} shown`}
        right={
          <div className="row tight wrap">
            {FILTERS.map((f) => (
              <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>
                {f.replace('IN MAINTENANCE', 'In maint.').replace('DUE INSPECTION', 'Due insp.')}
              </Pill>
            ))}
          </div>
        }
        pad={false}
      >
        <Table
          head={[
            'Tail',
            'Type',
            'Class',
            'Squadron / base',
            'Status',
            'Health',
            'RUL alert',
            'Hours',
            'Cycles',
            'Util.',
            'Open WOs',
            '',
          ]}
        >
          {rows.map((a) => {
            const preds = PREDICTIONS.filter((p) => p.aircraftId === a.id)
            const worst = [...a.systems].sort((x, y) => x.health - y.health)[0]
            const health =
              a.systems.reduce((s, x) => s + x.health, 0) / a.systems.length
            const wos = WORK_ORDERS.filter(
              (w) => w.aircraftId === a.id && w.status !== 'COMPLETED',
            )
            return (
              <tr key={a.id} className="clickable" onClick={() => onOpenAircraft(a.id)}>
                <td className="mono">
                  <b>{a.tail}</b>
                </td>
                <td>{a.type}</td>
                <td>
                  <span className="chip" style={{ borderColor: CLASS_COLORS[a.cls] }}>
                    {a.cls}
                  </span>
                </td>
                <td className="dim">
                  {a.sqn}
                  <div className="dim" style={{ fontSize: 11 }}>
                    {a.base}
                  </div>
                </td>
                <td>
                  <Tag>{a.status}</Tag>
                </td>
                <td style={{ width: 110 }}>
                  <div className="row tight">
                    <div
                      className={`health ${health >= 80 ? 'ok' : health >= 60 ? 'warn' : 'bad'}`}
                      style={{ flex: 1 }}
                    >
                      <div className="health-fill" style={{ width: `${health}%` }} />
                    </div>
                    <span className="mono" style={{ fontSize: 12 }}>
                      {health.toFixed(0)}
                    </span>
                  </div>
                  <div className="dim" style={{ fontSize: 11 }}>
                    weakest: {worst.name}
                  </div>
                </td>
                <td>
                  {preds.length ? (
                    <span className="mono">
                      <Tag>{preds[0].severity}</Tag>{' '}
                      <span className="dim">{preds[0].rulDays.toFixed(1)}d</span>
                    </span>
                  ) : (
                    <span className="dim">—</span>
                  )}
                </td>
                <td className="mono num">{a.hours.toLocaleString()}</td>
                <td className="mono num">{a.cycles.toLocaleString()}</td>
                <td className="mono num">{Math.round(a.utilisation * 100)}%</td>
                <td className="mono num">{wos.length}</td>
                <td className="num dim">→</td>
              </tr>
            )
          })}
        </Table>
        {!rows.length && <div className="empty">No aircraft match this filter.</div>}
      </Card>

      <div className="grid g-2-1">
        <Card title="Utilisation vs availability" subtitle="Idle airframes in maintenance are lost flying hours">
          <Table dense head={['Tail', 'Type', 'Status', 'Utilisation', 'Available hours (30d)']}>
            {[...FLEET]
              .sort((a, b) => a.utilisation - b.utilisation)
              .slice(0, 8)
              .map((a) => (
                <tr key={a.id} className="clickable" onClick={() => onOpenAircraft(a.id)}>
                  <td className="mono">{a.tail}</td>
                  <td>{a.type}</td>
                  <td>
                    <Tag>{a.status}</Tag>
                  </td>
                  <td style={{ width: 150 }}>
                    <div className="row tight">
                      <div className="health ok" style={{ flex: 1 }}>
                        <div
                          className="health-fill"
                          style={{
                            width: `${a.utilisation * 100}%`,
                            background:
                              a.utilisation < 0.5
                                ? 'linear-gradient(90deg,#ef4444,#f87171)'
                                : a.utilisation < 0.65
                                  ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                                  : 'linear-gradient(90deg,#10b981,#34d399)',
                          }}
                        />
                      </div>
                      <span className="mono" style={{ fontSize: 12 }}>
                        {Math.round(a.utilisation * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="mono num">{Math.round(a.utilisation * 30 * 24)} h</td>
                </tr>
              ))}
          </Table>
        </Card>

        <Card title="How to read this table" subtitle="Status definitions">
          <div className="list" style={{ fontSize: 12.5 }}>
            <div className="row tight">
              <Tag>AIRWORTHY</Tag>
              <span className="muted">Released to fly, no open Category-1 defect.</span>
            </div>
            <div className="row tight">
              <Tag>DUE INSPECTION</Tag>
              <span className="muted">Serviceable but inspection window closes within 7 days.</span>
            </div>
            <div className="row tight">
              <Tag>IN MAINTENANCE</Tag>
              <span className="muted">Work in progress at squadron or depot.</span>
            </div>
            <div className="row tight">
              <Tag>AOG</Tag>
              <span className="muted">Grounded — awaiting part, tooling or specialist agency.</span>
            </div>
          </div>
          <div className="note">
            Status is computed continuously from tech-log defects, sensor condition and open work orders — it no longer
            depends on someone updating a spreadsheet.
          </div>
        </Card>
      </div>
    </div>
  )
}
