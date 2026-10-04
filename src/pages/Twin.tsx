import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Card, Kpi, Tag, Table, Pill } from '../components/ui'
import { HealthBar, LineChart, type LineSeries } from '../components/charts'
import { CLASS_COLORS, FLEET, byId } from '../data/fleet'
import { byAircraft } from '../data/predictions'
import { TECH_RECORDS, WORK_ORDERS } from '../data/ops'
import { avgHealth, band, seedSeries, tick, type Series } from '../data/telemetry'
import { initState, update, type DetectorState } from '../lib/detector'
import { usePlatform } from '../lib/platform'
import type { Aircraft, SysName } from '../types'

/* Callout layout: the dot sits on the airframe, the label lives in the top or
   bottom margin, and a thin leader line joins them — nothing overlaps. */
interface Callout {
  node: [number, number]
  lx: number
  side: 'top' | 'bottom'
}

const OX = 60 // craft offset inside the label canvas
const OY = 25

const SYS_LAYOUT: Record<SysName, Callout> = {
  Avionics: { node: [45, 85], lx: 70, side: 'top' },
  Hydraulics: { node: [120, 80], lx: 155, side: 'top' },
  'Airframe Structure': { node: [145, 85], lx: 245, side: 'top' },
  Electrical: { node: [210, 85], lx: 320, side: 'top' },
  Environmental: { node: [75, 85], lx: 75, side: 'bottom' },
  Fuel: { node: [120, 110], lx: 165, side: 'bottom' },
  'Landing Gear': { node: [130, 128], lx: 250, side: 'bottom' },
  Propulsion: { node: [190, 85], lx: 330, side: 'bottom' },
}

function healthColor(h: number) {
  return h >= 80 ? '#34d399' : h >= 60 ? '#fbbf24' : '#f87171'
}

function labelColor(h: number) {
  return h >= 80 ? '#0b8f66' : h >= 60 ? '#b4740a' : '#d13535'
}

function Silhouette({
  aircraft,
  selected,
  onSelect,
}: {
  aircraft: Aircraft
  selected: SysName
  onSelect: (s: SysName) => void
}) {
  return (
    <svg viewBox="0 0 360 214" className="twin-svg">
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#20304f" />
          <stop offset="100%" stopColor="#121c31" />
        </linearGradient>
      </defs>
      {/* top-down silhouette */}
      <g
        transform={`translate(${OX},${OY})`}
        stroke="#3b5478"
        strokeWidth="1.2"
        fill="url(#body)"
        opacity={0.95}
      >
        <path d="M20 85 C40 74, 70 70, 108 70 L176 70 C196 70, 210 76, 220 85 C210 94, 196 100, 176 100 L108 100 C70 100, 40 96, 20 85 Z" />
        <path d="M96 74 L138 30 L156 30 L134 74 Z" />
        <path d="M96 96 L138 140 L156 140 L134 96 Z" />
        <path d="M186 74 L206 52 L214 52 L204 78 Z" />
        <path d="M186 96 L206 118 L214 118 L204 92 Z" />
        <line
          x1="20"
          y1="85"
          x2="220"
          y2="85"
          stroke="#4cc2ff"
          strokeWidth="0.6"
          opacity="0.4"
          strokeDasharray="3 5"
          fill="none"
        />
      </g>
      {/* system callouts */}
      {aircraft.systems.map((s) => {
        const L = SYS_LAYOUT[s.name]
        const nx = L.node[0] + OX
        const ny = L.node[1] + OY
        const col = healthColor(s.health)
        const on = selected === s.name
        const nameY = L.side === 'top' ? 25 : 184
        const valY = L.side === 'top' ? 40 : 199
        const leader =
          L.side === 'top'
            ? `M ${L.lx},48 L ${L.lx},${ny - 24} L ${nx},${ny - 9}`
            : `M ${L.lx},172 L ${L.lx},${ny + 22} L ${nx},${ny + 9}`
        return (
          <g key={s.name} className="twin-node" onClick={() => onSelect(s.name)}>
            <path
              d={leader}
              fill="none"
              stroke={on ? col : '#8ba3c4'}
              strokeWidth={on ? 1.4 : 1}
              strokeDasharray={on ? undefined : '4 4'}
            />
            <text x={L.lx} y={nameY} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#33507f">
              {s.name}
            </text>
            <text
              x={L.lx}
              y={valY}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill={labelColor(s.health)}
            >
              {s.health.toFixed(0)}% health
            </text>
            <circle cx={nx} cy={ny} r={on ? 12 : 9} fill={col} opacity={0.18} />
            <circle cx={nx} cy={ny} r={on ? 7 : 5.5} fill={col} stroke="#ffffff" strokeWidth="1.2" className="core" />
            {on && <circle cx={nx} cy={ny} r={15} fill="none" stroke={col} strokeWidth="1.3" strokeDasharray="3 3" />}
          </g>
        )
      })}
    </svg>
  )
}

export default function Twin({
  aircraftId,
  onSelectAircraft,
}: {
  aircraftId: string
  onSelectAircraft: (id: string) => void
}) {
  const aircraft = byId(aircraftId)
  const [sysName, setSysName] = useState<SysName>('Propulsion')
  const [clock, setClock] = useState(() => Date.now())

  const sysSensors = useMemo(() => {
    const names: Record<SysName, string[]> = {
      Propulsion: ['egt', 'vib', 'oilpt'],
      Avionics: ['cpu', 'bus'],
      Hydraulics: ['hydp', 'hydt'],
      Fuel: ['ff', 'pmp'],
      'Landing Gear': ['shk', 'brk'],
      Environmental: ['cabin', 'bleed'],
      'Airframe Structure': ['fat', 'cyc'],
      Electrical: ['gen', 'busv'],
    }
    const keys = names[sysName]
    return aircraft.sensors.filter((s) => keys.includes(s.key))
  }, [aircraft, sysName])

  const [series, setSeries] = useState<Series[]>([])
  const seriesRef = useRef<Series[]>([])
  const detRef = useRef<Record<string, DetectorState>>({})
  const [zs, setZs] = useState<Record<string, { z: number; score: number }>>({})
  const [liveEvents, setLiveEvents] = useState<{ key: number; sensor: string; z: number; value: number; unit: string; at: number }[]>([])
  const { pushLog, acked } = usePlatform()

  // (re)seed whenever aircraft or system changes — the detector baseline is
  // learned from the seeded window, so the first live sample is already scored
  useEffect(() => {
    const start = Date.now()
    const seeded = sysSensors.map((sensor) => ({ sensor, points: seedSeries(aircraft, sensor, start) }))
    const baselines: Record<string, DetectorState> = {}
    for (const s of seeded) {
      let st = initState()
      for (const p of s.points) st = update(st, p.v).state
      baselines[`${aircraft.id}:${sysName}:${s.sensor.key}`] = { ...st, cusum: 0 }
    }
    seriesRef.current = seeded
    detRef.current = baselines
    setSeries(seeded)
    setZs({})
    setLiveEvents([])
    setClock(start)
  }, [aircraft, sysName, sysSensors])

  // live IoT stream + online anomaly detection (EWMA baseline → z-score → CUSUM)
  useEffect(() => {
    const id = window.setInterval(() => {
      const prev = seriesRef.current
      if (!prev.length) return
      const now = Date.now()
      const nextZs: Record<string, { z: number; score: number }> = {}
      const fired: typeof liveEvents = []
      const next = prev.map((s) => {
        const points = tick(aircraft, s.sensor, s.points, now)
        const value = points[points.length - 1].v
        const key = `${aircraft.id}:${sysName}:${s.sensor.key}`
        const res = update(detRef.current[key] ?? initState(), value)
        detRef.current[key] = res.state
        nextZs[s.sensor.key] = { z: res.z, score: res.score }
        if (res.fired) {
          fired.push({ key: now + s.sensor.key.length, sensor: s.sensor.label, z: res.z, value, unit: s.sensor.unit, at: now })
        }
        return { ...s, points }
      })
      seriesRef.current = next
      setSeries(next)
      setZs(nextZs)
      setClock(now)
      if (fired.length) {
        setLiveEvents((e) => [...fired, ...e].slice(0, 4))
        for (const f of fired) {
          pushLog('anomaly', `${aircraft.tail}: live anomaly on ${f.sensor} (z ${f.z > 0 ? '+' : ''}${f.z}, ${f.value} ${f.unit})`)
        }
      }
    }, 2000)
    return () => window.clearInterval(id)
  }, [aircraft, sysName, pushLog])

  const preds = byAircraft(aircraft.id)
  const wos = WORK_ORDERS.filter((w) => w.aircraftId === aircraft.id && w.status !== 'COMPLETED')
  const records = TECH_RECORDS.filter((r) => r.tail === aircraft.tail)
  const health = avgHealth(aircraft)

  const seriesForChart = (s: Series): LineSeries[] => [
    { name: s.sensor.label, color: '#4cc2ff', values: s.points.map((p) => p.v) },
  ]

  const stats: [string, string][] = [
    ['Flight hours', aircraft.hours.toLocaleString()],
    ['Cycles', aircraft.cycles.toLocaleString()],
    ['Engine hours', `${aircraft.engineHours.toLocaleString()} fh`],
    ['Utilisation (30d)', `${Math.round(aircraft.utilisation * 100)}%`],
    ['Since last svc', `${aircraft.lastSvcDays} d`],
    ['Next inspection', `${aircraft.nextInspDays} d`],
  ]

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h2>Digital twin — {aircraft.tail}</h2>
          <p>
            Live virtual replica of the airframe: structural life, LRU condition and streaming IoT telemetry merged with
            the technical record and the AI fault model.
          </p>
        </div>
        <div className="spacer" />
        <Tag>{aircraft.status}</Tag>
        <span className="chip" style={{ borderColor: CLASS_COLORS[aircraft.cls] }}>
          {aircraft.cls}
        </span>
      </div>

      <div className="row wrap" style={{ gap: 8 }}>
        {FLEET.map((a) => (
          <Pill key={a.id} active={a.id === aircraft.id} onClick={() => onSelectAircraft(a.id)}>
            <span className="mono">{a.tail}</span>
          </Pill>
        ))}
      </div>

      <div className="stat-strip card" style={{ padding: '14px 18px' }}>
        {stats.map(([k, v]) => (
          <div className="stat" key={k}>
            <b>{v}</b>
            <span>{k}</span>
          </div>
        ))}
      </div>

      <div className="grid g4">
        <Kpi label="Overall condition" value={health.toFixed(1)} unit="%" tone={health > 80 ? 'ok' : health > 60 ? 'warn' : 'bad'} foot={`${aircraft.type} · ${aircraft.sqn}`} />
        <Kpi label="Open AI predictions" value={preds.length} tone={preds.length ? 'warn' : 'ok'} foot={preds.length ? `min RUL ${Math.min(...preds.map((p) => p.rulDays)).toFixed(1)} d` : 'no anomalies'} />
        <Kpi label="Open work orders" value={wos.length} tone="neutral" foot={wos.length ? wos[0].title : 'none'} />
        <Kpi label="Hours since servicing" value={aircraft.lastSvcDays * 3.4} unit=" fh" tone="neutral" foot={`${aircraft.lastSvcDays} days ago`} />
      </div>

      <div className="twin-layout">
        <div className="grid" style={{ gap: 16 }}>
          <Card
            title="Twin state — airframe & life-limited parts"
            subtitle="Click a node on the replica to switch the telemetry panel"
            right={
              <span className="chip">
                stream <span style={{ color: '#34d399' }}>●</span> {new Date(clock).toLocaleTimeString('en-IN')}
              </span>
            }
          >
            <div className="twin-craft">
              <Silhouette aircraft={aircraft} selected={sysName} onSelect={setSysName} />
            </div>
            <div className="twin-life" style={{ marginTop: 14 }}>
              {aircraft.twin.map((t) => (
                <div className="life-item" key={t.key}>
                  <div className="lb">{t.label}</div>
                  <div className="vl">{t.value}</div>
                  <div className={`health ${t.pct >= 80 ? 'bad' : t.pct >= 55 ? 'warn' : 'ok'}`}>
                    <div className="health-fill" style={{ width: `${t.pct}%` }} />
                  </div>
                  <div className="dim" style={{ fontSize: 10.5, marginTop: 4 }}>
                    life used {t.pct}%
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Sub-system condition" subtitle="Health index per system with governing LRU" pad={false}>
            <div className="sys-grid" style={{ padding: 14 }}>
              {aircraft.systems.map((s) => (
                <div
                  key={s.name}
                  className={`sys-tile ${sysName === s.name ? 'on' : ''}`}
                  onClick={() => setSysName(s.name)}
                >
                  <div className="name">{s.name}</div>
                  <div className="val" style={{ color: healthColor(s.health) }}>
                    {s.health.toFixed(1)}
                  </div>
                  <HealthBar value={s.health} />
                  <div className="lru" title={s.lru}>
                    {s.lru}
                  </div>
                  <div className="dim" style={{ fontSize: 10.5 }}>
                    trend {s.trend > 0 ? '▲' : '▼'} {Math.abs(s.trend)}/fl
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <Card
            title={`Live telemetry — ${sysName}`}
            subtitle="Onboard IoT channels scored online by the anomaly detector (EWMA baseline → z-score → CUSUM)"
            right={
              <span className="chip">
                {liveEvents.length ? (
                  <span style={{ color: '#d13535' }}>● {liveEvents.length} live anomal{liveEvents.length > 1 ? 'ies' : 'y'}</span>
                ) : (
                  <span style={{ color: '#0b8f66' }}>● detector nominal</span>
                )}{' '}
                · {sysSensors.length} channels
              </span>
            }
          >
            {liveEvents.length > 0 && (
              <div className="list" style={{ marginBottom: 14 }}>
                {liveEvents.map((e) => (
                  <div key={e.key} className="alert sev-CRITICAL" style={{ padding: '8px 12px' }}>
                    <Tag tone="bad">LIVE</Tag>
                    <div className="alert-sub" style={{ color: 'var(--text)' }}>
                      <b>{e.sensor}</b> deviated {e.z > 0 ? '+' : ''}
                      {e.z}σ from its learned baseline — {e.value} {e.unit}
                    </div>
                    <span className="dim mono" style={{ fontSize: 11 }}>
                      {new Date(e.at).toLocaleTimeString('en-IN', { hour12: false })}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="grid" style={{ gap: 16 }}>
              {series.map((s) => {
                const last = s.points[s.points.length - 1]
                const state = band(s.sensor, last.v)
                const det = zs[s.sensor.key]
                return (
                  <div key={s.sensor.key}>
                    <div className="row tight" style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 620 }}>{s.sensor.label}</span>
                      <Tag tone={state === 'crit' ? 'bad' : state === 'warn' ? 'warn' : 'ok'}>
                        {state.toUpperCase()}
                      </Tag>
                      {det && (
                        <span
                          className="chip mono"
                          title={`z-score vs learned baseline · detector score ${det.score}/100`}
                          style={{
                            color: Math.abs(det.z) >= 2.5 ? '#d13535' : Math.abs(det.z) >= 1.6 ? '#b4740a' : '#46628a',
                          }}
                        >
                          z {det.z > 0 ? '+' : ''}
                          {det.z}
                        </span>
                      )}
                      <span className="spacer mono" style={{ fontSize: 13 }}>
                        {last.v} {s.sensor.unit}
                      </span>
                    </div>
                    <LineChart
                      series={seriesForChart(s)}
                      height={116}
                      warn={s.sensor.warn}
                      crit={s.sensor.crit}
                      unit={s.sensor.unit}
                      yFormat={(v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1))}
                    />
                    <div className="row tight" style={{ marginTop: 4 }}>
                      <span className="dim" style={{ fontSize: 10.5, flex: 1 }}>
                        warn {s.sensor.warn} {s.sensor.unit} · crit {s.sensor.crit} {s.sensor.unit}
                      </span>
                      {det && (
                        <span className="meter" style={{ width: 64 }} title="detector score">
                          <i style={{ width: `${det.score}%`, background: det.score > 80 ? '#d13535' : undefined }} />
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
              {!series.length && <div className="empty">Waiting for stream…</div>}
            </div>
          </Card>

          <Card title="AI predictions for this airframe" subtitle="Failure modes forecast from the live stream">
            <div className="list">
              {preds.map((p) => (
                <div key={p.id} className={`alert sev-${p.severity}`}>
                  <div
                    className="ring"
                    style={{
                      ['--p' as string]: p.confidence,
                      ['--c' as string]: healthColor(100 - p.anomaly),
                    } as CSSProperties}
                  >
                    <span>{p.confidence}%</span>
                  </div>
                  <div>
                    <div className="alert-title">
                      {p.component.split(' · ')[1]} — {p.failureMode}
                    </div>
                    <div className="alert-sub">
                      {p.id} · {p.model} · anomaly {p.anomaly}/100 · raised{' '}
                      {new Date(p.raisedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="alert-sub" style={{ color: 'var(--text)' }}>
                      Action: {p.recommendation}
                    </div>
                    <div className="row tight wrap" style={{ marginTop: 6 }}>
                      {acked[p.id] && <Tag tone="ok">ACKNOWLEDGED</Tag>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 17, fontWeight: 700 }}>
                      {p.rulDays.toFixed(1)} d
                    </div>
                    <div className="dim" style={{ fontSize: 11 }}>
                      {p.rulHours.toFixed(0)} fh RUL
                    </div>
                  </div>
                </div>
              ))}
              {!preds.length && <div className="empty">No open predictions — airframe nominal.</div>}
            </div>
          </Card>

          <Card title="Technical record" subtitle="Unified log for this tail number" pad={false}>
            <Table dense head={['When', 'Type', 'Source', 'Entry']}>
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(r.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <Tag tone={r.kind === 'DEFECT' && !r.closed ? 'bad' : 'info'}>{r.kind}</Tag>
                  </td>
                  <td className="dim">{r.source}</td>
                  <td>
                    {r.text}{' '}
                    <span className="dim" style={{ fontSize: 11 }}>
                      {r.closed ? '· closed' : '· open'}
                    </span>
                  </td>
                </tr>
              ))}
              {!records.length && (
                <tr>
                  <td colSpan={4} className="empty">
                    No recent entries for this tail.
                  </td>
                </tr>
              )}
            </Table>
          </Card>
        </div>
      </div>
    </div>
  )
}
