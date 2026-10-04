import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Card, Kpi, Segmented, Table, Tag, Pill } from '../components/ui'
import { BarRow } from '../components/charts'
import { PREDICTIONS } from '../data/predictions'
import { WORK_ORDERS, spareForSystem } from '../data/ops'
import { usePlatform } from '../lib/platform'
import {
  criticalPreds,
  failuresPrevented,
  meanAnomaly,
  meanConfidence,
  meanLeadDays,
} from '../lib/metrics'

const SEV_ORDER = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'] as const

export default function Predictions({ onOpenAircraft }: { onOpenAircraft: (id: string) => void }) {
  const [sev, setSev] = useState('All')
  const [sel, setSel] = useState<string | null>(PREDICTIONS[0]?.id ?? null)
  const { acked, raisedWOs, indents, log, ack, raiseWO, indent } = usePlatform()

  const rows = useMemo(
    () =>
      PREDICTIONS.filter((p) => sev === 'All' || p.severity === sev).sort(
        (a, b) => a.rulDays - b.rulDays,
      ),
    [sev],
  )

  const active = PREDICTIONS.find((p) => p.id === sel) ?? rows[0] ?? PREDICTIONS[0]
  const autoWO = WORK_ORDERS.filter((w) => w.type === 'PREDICTIVE')

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h2>Predictive fault detection</h2>
          <p>
            AI models turn the raw IoT stream, historical failures and component cards into remaining-useful-life
            forecasts — so faults are found days before a crew ever sees a warning light.
          </p>
        </div>
        <div className="spacer" />
        <Segmented options={['All', ...SEV_ORDER]} value={sev} onChange={setSev} />
      </div>

      <div className="grid g4">
        <Kpi label="Active predictions" value={PREDICTIONS.length} tone="warn" foot={`${criticalPreds.length} need action ≤10 d`} />
        <Kpi label="Mean confidence" value={meanConfidence} unit="%" tone="ok" foot={`anomaly score avg ${meanAnomaly}`} />
        <Kpi label="Mean early warning" value={meanLeadDays} unit=" d" tone="ok" foot="before predicted failure" />
        <Kpi label="Failures prevented (30d)" value={failuresPrevented} tone="ok" foot="caught & scheduled early" />
      </div>

      <div className="grid g-3-2">
        <Card title="Alert feed" subtitle={`${rows.length} predictions shown · click one for driver analysis`} pad={false}>
          <div style={{ padding: 14, display: 'grid', gap: 10 }}>
            {rows.map((p) => (
              <div
                key={p.id}
                className={`alert sev-${p.severity}`}
                style={active?.id === p.id ? { borderColor: 'rgba(76,194,255,.55)', background: 'rgba(76,194,255,.07)' } : undefined}
                onClick={() => setSel(p.id)}
              >
                <div
                  className="ring"
                  style={
                    {
                      ['--p' as string]: p.confidence,
                      ['--c' as string]:
                        p.severity === 'CRITICAL' ? '#f87171' : p.severity === 'HIGH' ? '#fbbf24' : '#60a5fa',
                    } as CSSProperties
                  }
                >
                  <span>{p.confidence}%</span>
                </div>
                <div>
                  <div className="alert-title">
                    <Tag>{p.severity}</Tag> {p.component.split(' · ')[1]}
                  </div>
                  <div className="alert-sub">
                    {p.tail} · {p.system} · {p.failureMode}
                  </div>
                  <div className="alert-sub">
                    <span className="mono">{p.id}</span> · {p.model} · raised{' '}
                    {new Date(p.raisedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="row tight wrap" style={{ marginTop: 6 }}>
                    {acked[p.id] && <Tag tone="ok">ACKNOWLEDGED</Tag>}
                    {raisedWOs.some((w) => w.sourcePred === p.id) && <Tag tone="info">WO RAISED</Tag>}
                    {indents.some((i) => i.reason === p.id) && <Tag tone="info">SPARE INDENTED</Tag>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 17, fontWeight: 700 }}>
                    {p.rulDays.toFixed(1)} d
                  </div>
                  <div className="dim" style={{ fontSize: 11 }}>
                    {p.leadTimeHrs} h lead
                  </div>
                  <button className="pill" style={{ marginTop: 6 }} onClick={() => onOpenAircraft(p.aircraftId)}>
                    Open twin →
                  </button>
                </div>
              </div>
            ))}
            {!rows.length && <div className="empty">No predictions at this severity.</div>}
          </div>
        </Card>

        <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
          <Card title="Why the model flagged it" subtitle={active ? `${active.id} · ${active.component}` : ''}>
            {active && (
              <>
                <div className="row wrap" style={{ gap: 10, marginBottom: 12 }}>
                  <Tag>{active.severity}</Tag>
                  <span className="chip">anomaly {active.anomaly}/100</span>
                  <span className="chip">confidence {active.confidence}%</span>
                  <span className="chip">{active.model}</span>
                </div>
                <div className="alert-sub" style={{ marginBottom: 10, color: 'var(--text)' }}>
                  {active.failureMode}
                </div>
                {active.drivers.map((d) => (
                  <BarRow
                    key={d.feature}
                    label={d.feature}
                    value={d.contrib}
                    max={50}
                    suffix="%"
                    color={d.contrib >= 30 ? '#f87171' : d.contrib >= 18 ? '#fbbf24' : '#4cc2ff'}
                    right={`${d.contrib}%`}
                  />
                ))}
                <div className="note">Feature contribution (SHAP-style) — how much each signal pushed the score.</div>
              </>
            )}
          </Card>

          <Card title="Recommended action" subtitle="Auto-generated from the failure mode and current stock">
            {active && (
              <>
                <p style={{ margin: 0, fontSize: 13.5 }}>{active.recommendation}</p>
                <div className="stat-strip" style={{ marginTop: 14 }}>
                  <div className="stat">
                    <b>{active.rulDays.toFixed(1)}</b>
                    <span>days RUL</span>
                  </div>
                  <div className="stat">
                    <b>{active.rulHours.toFixed(0)}</b>
                    <span>flight hours</span>
                  </div>
                  <div className="stat">
                    <b>{active.leadTimeHrs}</b>
                    <span>h warning</span>
                  </div>
                </div>
                <div className="row tight wrap" style={{ marginTop: 14 }}>
                  <button className="pill on" onClick={() => onOpenAircraft(active.aircraftId)}>
                    Inspect {active.tail}
                  </button>
                  <button
                    className={`pill ${acked[active.id] ? 'on' : ''}`}
                    disabled={!!acked[active.id]}
                    onClick={() => ack(active.id, active.tail)}
                    title="Maintenance controller confirms the alert is real"
                  >
                    {acked[active.id] ? '✓ Acknowledged' : 'Acknowledge alert'}
                  </button>
                  <button
                    className={`pill ${raisedWOs.some((w) => w.sourcePred === active.id) ? 'on' : ''}`}
                    disabled={raisedWOs.some((w) => w.sourcePred === active.id)}
                    onClick={() => raiseWO(active.id)}
                    title="Creates a real work order that appears in Work control"
                  >
                    {raisedWOs.some((w) => w.sourcePred === active.id) ? '✓ Work order raised' : 'Raise work order'}
                  </button>
                  <button
                    className={`pill ${indents.some((i) => i.reason === active.id) ? 'on' : ''}`}
                    disabled={indents.some((i) => i.reason === active.id)}
                    onClick={() => indent(active.id, spareForSystem(active.system))}
                    title="Reserves the part before the aircraft is grounded"
                  >
                    {indents.some((i) => i.reason === active.id) ? '✓ Spare indented' : `Indent ${spareForSystem(active.system).part}`}
                  </button>
                </div>
                <div className="note">
                  These buttons write to the shared platform state: the work order appears in <b>Work control</b>, the
                  indent appears in <b>Spares</b>, and every action is written to the audit trail below. {autoWO.length}
                  {' '}predictive work orders already exist from automated conversions.
                </div>
              </>
            )}
          </Card>

          <Card title="Action log (audit trail)" subtitle="Who did what, and when — persisted across sessions" pad={false}>
            <div style={{ padding: '10px 14px', display: 'grid', gap: 8 }}>
              {log.length === 0 && (
                <div className="empty" style={{ padding: 16 }}>
                  Nothing yet — acknowledge an alert or raise a work order above.
                </div>
              )}
              {log.slice(0, 8).map((e) => (
                <div key={e.id} className="row tight" style={{ fontSize: 12 }}>
                  <Tag tone={e.kind === 'ack' ? 'ok' : e.kind === 'anomaly' ? 'warn' : 'info'}>
                    {e.kind.toUpperCase()}
                  </Tag>
                  <span style={{ flex: 1 }}>{e.text}</span>
                  <span className="dim mono" style={{ fontSize: 11 }}>
                    {new Date(e.at).toLocaleTimeString('en-IN', { hour12: false })}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card title="Remaining useful life — full prediction table" subtitle="Sorted by urgency" pad={false}>
        <Table
          dense
          head={['ID', 'Aircraft', 'System', 'Component', 'Failure mode', 'Severity', 'RUL', 'Conf.', 'Lead time', 'Model', '']}
        >
          {rows.map((p) => (
            <tr key={p.id} className="clickable" onClick={() => onOpenAircraft(p.aircraftId)}>
              <td className="mono">{p.id}</td>
              <td className="mono">{p.tail}</td>
              <td>{p.system}</td>
              <td>{p.component.split(' · ')[1]}</td>
              <td className="dim">{p.failureMode}</td>
              <td>
                <Tag>{p.severity}</Tag>
              </td>
              <td className="mono num">{p.rulDays.toFixed(1)} d</td>
              <td className="mono num">{p.confidence}%</td>
              <td className="mono num">{p.leadTimeHrs} h</td>
              <td className="dim" style={{ fontSize: 11.5 }}>
                {p.model}
              </td>
              <td className="num dim">→</td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="grid g3">
        <Card title="Detection pipeline" subtitle="How a fault goes from sensor to decision">
          <div className="timeline">
            <div className="tl-item">
              <div className="tl-time">t−lead</div>
              <div className="tl-text">64 IoT channels sampled at 2 s from the health-monitoring system</div>
            </div>
            <div className="tl-item warn">
              <div className="tl-time">t−lead+2 m</div>
              <div className="tl-text">Isolation Forest / autoencoder flags deviation from learned healthy envelope</div>
            </div>
            <div className="tl-item warn">
              <div className="tl-time">t−lead+5 m</div>
              <div className="tl-text">GBM-RUL model estimates remaining life and merges with component history</div>
            </div>
            <div className="tl-item bad">
              <div className="tl-time">t−lead+6 m</div>
              <div className="tl-text">Alert raised, confidence & drivers attached, severity assigned</div>
            </div>
            <div className="tl-item ok">
              <div className="tl-time">t−lead+10 m</div>
              <div className="tl-text">Predictive work order + spare indent created automatically, slot reserved</div>
            </div>
          </div>
        </Card>

        <Card title="Model performance" subtitle="Held-out evaluation on 3 years of fleet history">
          <div className="list">
            <BarRow label="Fault recall @7 days" value={94} max={100} suffix="%" right="94%" color="#34d399" />
            <BarRow label="False alarm rate" value={6} max={100} suffix="%" right="6%" color="#fbbf24" />
            <BarRow label="Precision" value={88} max={100} suffix="%" right="88%" color="#34d399" />
            <BarRow label="Coverage of LRU classes" value={86} max={100} suffix="%" right="86%" color="#4cc2ff" />
            <BarRow label="Mean absolute RUL error" value={64} max={100} right="6.4 h" color="#a78bfa" />
          </div>
          <div className="note">
            Before the platform, faults were confirmed reactively — mean detection lag was 5.8 days of continued
            operation past first precursor.
          </div>
        </Card>

        <Card title="Alert outcome log" subtitle="What happened after each alert (last 30 days)">
          <Table dense head={['Outcome', 'Count']}>
            <tr>
              <td>Caught early, repaired before failure</td>
              <td className="mono num">{failuresPrevented}</td>
            </tr>
            <tr>
              <td>Scheduled inside normal servicing window</td>
              <td className="mono num">{autoWO.filter((w) => w.status === 'SCHEDULED').length + 4}</td>
            </tr>
            <tr>
              <td>Alert superseded by inspection finding</td>
              <td className="mono num">3</td>
            </tr>
            <tr>
              <td>Missed (failure occurred without alert)</td>
              <td className="mono num">1</td>
            </tr>
            <tr>
              <td>False positive confirmed</td>
              <td className="mono num">2</td>
            </tr>
          </Table>
          <div className="note">
            Every alert stays auditable — model version, threshold and outcome are stored with the record.
          </div>
        </Card>
      </div>

      <div className="row wrap" style={{ gap: 8 }}>
        <span className="dim" style={{ fontSize: 12 }}>
          Severity filter:
        </span>
        {SEV_ORDER.map((s) => (
          <Pill key={s} active={sev === s} onClick={() => setSev(s)}>
            {s}
          </Pill>
        ))}
        <Pill active={sev === 'All'} onClick={() => setSev('All')}>
          ALL
        </Pill>
      </div>
    </div>
  )
}
