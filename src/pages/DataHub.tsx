import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { Card, Kpi, Table, Tag, Segmented } from '../components/ui'
import { Spark } from '../components/charts'
import { DATA_ASSETS, TECH_RECORDS } from '../data/ops'
import { fmt } from '../lib/metrics'
import { FLEET } from '../data/fleet'
import { parseSensorCsv, run } from '../lib/detector'
import { usePlatform } from '../lib/platform'

const PIPELINE = [
  { k: 'Ingest', d: 'Connectors pull from ACMS/IoT, digitised logbooks, stores ERP and depot feeds on a schedule', tone: 'ok' },
  { k: 'Normalise', d: 'Units, tail numbers, part numbers and time bases mapped to one canonical schema', tone: 'ok' },
  { k: 'Reconcile', d: 'Defects cross-checked against work orders and stock movements — duplicates merged', tone: 'warn' },
  { k: 'Score', d: 'Condition scoring and RUL models run on the unified record, not on siloed extracts', tone: 'ok' },
  { k: 'Act', d: 'Alerts, work orders and indents written back into the operational systems', tone: 'ok' },
]

export default function DataHub() {
  const [kind, setKind] = useState('All')
  const [imported, setImported] = useState<{
    name: string
    samples: number
    anomalies: number
    values: number[]
    mean: number
    min: number
    max: number
    firstAt: number | null
  } | null>(null)
  const [importErr, setImportErr] = useState<string | null>(null)
  const { pushLog } = usePlatform()

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((text) => {
      const { values, skipped } = parseSensorCsv(text)
      if (values.length < 12) {
        setImported(null)
        setImportErr(`Need at least 12 numeric samples — got ${values.length} (skipped ${skipped} unparseable rows).`)
        return
      }
      const { results, anomalies } = run(values)
      const first = results.findIndex((r) => r.fired)
      const mean = values.reduce((s, v) => s + v, 0) / values.length
      setImportErr(null)
      setImported({
        name: file.name,
        samples: values.length,
        anomalies,
        values,
        mean: Math.round(mean * 100) / 100,
        min: Math.min(...values),
        max: Math.max(...values),
        firstAt: first >= 0 ? first : null,
      })
      pushLog(
        'system',
        `Imported ${file.name}: ${values.length} samples → ${anomalies} anomalies by online detector`,
      )
    })
  }

  const kinds = ['All', 'FLIGHT LOG', 'DEFECT', 'COMPONENT CARD', 'INSPECTION', 'ENGINE TREND']
  const rows = TECH_RECORDS.filter((r) => kind === 'All' || r.kind === kind)
  const totalRecords = DATA_ASSETS.reduce((s, d) => s + d.records, 0)
  const stale = DATA_ASSETS.filter((d) => d.state !== 'SYNCED')

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h2>Data integration hub</h2>
          <p>
            The root cause in the problem statement: health-monitoring data, technical records, spares movements and
            maintenance-agency status used to live apart. This is where they become one aircraft record.
          </p>
        </div>
        <div className="spacer" />
        <span className="chip">{DATA_ASSETS.length - stale.length}/{DATA_ASSETS.length} sources healthy</span>
      </div>

      <div className="grid g4">
        <Kpi label="Unified records" value={fmt(totalRecords)} tone="ok" foot="across 5 source systems" />
        <Kpi label="Sources connected" value={`${DATA_ASSETS.length}`} tone="ok" foot="IoT · tech log · stores · agency · ops" />
        <Kpi label="Sources needing attention" value={stale.length} tone={stale.length ? 'warn' : 'ok'} foot={stale.map((s) => s.name.split(' ')[0]).join(', ') || 'none'} />
        <Kpi label="Schema mappings live" value="312" tone="info" foot="canonical fields + units" />
      </div>

      <Card title="Source systems" subtitle="What is connected, how fresh it is and what it contributes">
        <div className="grid g2" style={{ gap: 12 }}>
          {DATA_ASSETS.map((d, i) => (
            <div className="src-card" key={d.key}>
              <div className="src-icon">{['📡', '📘', '📦', '🛠️', '✈️'][i]}</div>
              <div style={{ flex: 1 }}>
                <div className="row tight">
                  <span className="src-name">{d.name}</span>
                  <Tag tone={d.state === 'SYNCED' ? 'ok' : d.state === 'SYNCING' ? 'info' : 'warn'}>{d.state}</Tag>
                </div>
                <div className="src-note">{d.note}</div>
                <div className="row tight" style={{ marginTop: 8, fontSize: 11.5 }}>
                  <span className="dim mono">{d.sourceSystem}</span>
                  <span className="dim">·</span>
                  <span className="dim mono">{fmt(d.records)} records</span>
                  <span className="dim">·</span>
                  <span className="dim mono">sync {d.synced}</span>
                  <span className="spacer" />
                  <span className="mono">{d.health}%</span>
                </div>
                <div className="meter" style={{ marginTop: 6 }}>
                  <i style={{ width: `${d.health}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
        {stale.length > 0 && (
          <div className="note">
            {stale.map((s) => s.name).join(' and ')} feeds lag — alerting is degraded but sensor + logbook data keeps
            predictions running. This is exactly the “data not adequately integrated” gap being closed.
          </div>
        )}
      </Card>

      <div className="grid g-3-2">
        <Card
          title="Integration pipeline"
          subtitle="From raw feeds to closed-loop action"
          pad={false}
        >
          <div style={{ padding: 14 }}>
            <div className="timeline">
              {PIPELINE.map((p) => (
                <div className={`tl-item ${p.tone === 'warn' ? 'warn' : 'ok'}`} key={p.k}>
                  <div className="tl-time">{p.k}</div>
                  <div className="tl-text">{p.d}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Data quality guards" subtitle="Checks that run before anything reaches a model">
          <div className="list">
            {[
              ['Tail / part number reconciliation', 99.2],
              ['Unit & time-base normalisation', 98.6],
              ['Duplicate defect merging', 94.1],
              ['Sensor channel freshness (≤5 s)', 97.8],
              ['Agency feed completeness', 81.4],
            ].map(([label, pct]) => (
              <div key={label as string} className="row">
                <span style={{ flex: 1, fontSize: 12.5 }}>{label}</span>
                <div className="meter" style={{ width: 110 }}>
                  <i style={{ width: `${pct}%` }} />
                </div>
                <span className="mono" style={{ fontSize: 12, width: 48, textAlign: 'right' }}>
                  {pct}%
                </span>
              </div>
            ))}
          </div>
          <div className="note">
            Failing checks quarantine the record instead of silently poisoning the model — a hard requirement once the
            same table drives safety-relevant predictions.
          </div>
        </Card>
      </div>

      <Card
        title="Bring your own sensor data (CSV)"
        subtitle="Drop an ACMS / health-monitoring export and run the same online detector over it — no code, no schema mapping"
        right={
          <label className="pill" style={{ cursor: 'pointer' }}>
            Choose file…
            <input
              type="file"
              accept=".csv,.txt,text/csv"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
          </label>
        }
      >
        <div className="row wrap" style={{ gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="dim" style={{ fontSize: 12 }}>
              Accepted: any comma/semicolon separated file with one reading per row (an optional header row is
              detected). The last numeric column of each row is treated as the channel value. The detector learns the
              baseline from your first ~8 samples, then scores every sample online.
            </div>
            {importErr && (
              <div className="alert sev-HIGH" style={{ marginTop: 12, padding: '10px 12px' }}>
                <Tag tone="warn">CHECK</Tag>
                <div className="alert-sub" style={{ color: 'var(--text)' }}>
                  {importErr}
                </div>
              </div>
            )}
            {imported && (
              <div className="stat-strip" style={{ marginTop: 12 }}>
                <div className="stat">
                  <b>{imported.samples}</b>
                  <span>samples</span>
                </div>
                <div className="stat" style={{ color: imported.anomalies ? '#d13535' : '#0b8f66' }}>
                  <b>{imported.anomalies}</b>
                  <span>anomalies</span>
                </div>
                <div className="stat">
                  <b>{imported.mean}</b>
                  <span>mean</span>
                </div>
                <div className="stat">
                  <b>
                    {imported.min} – {imported.max}
                  </b>
                  <span>range</span>
                </div>
              </div>
            )}
            {imported && (
              <div className="note">
                File <b>{imported.name}</b> scored end-to-end.
                {imported.firstAt !== null
                  ? ` First detector alarm at sample ${imported.firstAt + 1} of ${imported.samples}.`
                  : ' No sustained deviation above the decision threshold.'}
              </div>
            )}
            {!imported && !importErr && (
              <div className="note">
                Live example running right now: the simulated fleet channels above use exactly this detector. Feeding
                real aircraft data in production is the same call — <b>parse → update(state, sample) → alarm</b>.
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            {imported ? (
              <>
                <div className="row tight" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 620 }}>{imported.name}</span>
                  <Tag tone={imported.anomalies ? 'bad' : 'ok'}>
                    {imported.anomalies ? `${imported.anomalies} ALARMS` : 'NOMINAL'}
                  </Tag>
                </div>
                <Spark values={imported.values} color="#1d7ae0" height={90} />
              </>
            ) : (
              <div className="empty" style={{ padding: 30 }}>
                Import a CSV to see its trace and detector alarms here.
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card
        title="Technical records"
        subtitle={`${rows.length} entries · unified view of logbook, sensor and depot notes`}
        right={<Segmented options={kinds} value={kind} onChange={setKind} />}
        pad={false}
      >
        <Table dense head={['Date', 'Tail', 'Type', 'Source', 'Entry', 'State']}>
          {rows.map((r) => {
            const ac = FLEET.find((f) => f.tail === r.tail)
            return (
              <tr key={r.id}>
                <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                  {new Date(r.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="mono">{r.tail}</td>
                <td>
                  <Tag tone={r.kind === 'DEFECT' && !r.closed ? 'bad' : 'info'}>{r.kind}</Tag>
                </td>
                <td className="dim">{r.source}</td>
                <td>{r.text}</td>
                <td>
                  <Tag tone={r.closed ? 'ok' : 'warn'}>{r.closed ? 'CLOSED' : 'OPEN'}</Tag>
                  <div className="dim" style={{ fontSize: 11 }}>
                    {ac?.type}
                  </div>
                </td>
              </tr>
            )
          })}
        </Table>
      </Card>
    </div>
  )
}
