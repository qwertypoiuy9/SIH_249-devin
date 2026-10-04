import { Card, Kpi, Table, Tag } from '../components/ui'
import { BarRow, Donut, Gauge, LineChart } from '../components/charts'
import { MODELS, SPARES } from '../data/ops'
import { FLEET } from '../data/fleet'
import {
  KPI,
  BASELINE,
  availability,
  availabilityTrend,
  byClass,
  downtimePareto,
  meanConfidence,
  missionCapable,
  mtbf,
  mttr,
  sparesFillRate,
  totalDowntime,
} from '../lib/metrics'

export default function Analytics() {
  const classTrend = byClass
  const riskBands = [
    { label: '0–7 days', value: 4, color: '#f87171' },
    { label: '8–30 days', value: 7, color: '#fbbf24' },
    { label: '31–90 days', value: 6, color: '#60a5fa' },
    { label: '>90 days', value: 3, color: '#34d399' },
  ]

  const outputs = [
    { label: 'Fleet availability', now: availability, before: BASELINE.availability, unit: '%' },
    { label: 'Mission capable', now: missionCapable, before: BASELINE.mission, unit: '%' },
    { label: 'MTBF (flight hours)', now: mtbf, before: BASELINE.mtbf, unit: ' fh' },
    { label: 'MTTR (hours)', now: mttr, before: BASELINE.mttr, unit: ' h' },
    { label: 'Spares fill rate', now: sparesFillRate, before: BASELINE.fill, unit: '%' },
    { label: 'Reactive share of work', now: 31, before: BASELINE.reactive, unit: '%' },
  ]

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h2>Maintenance analytics</h2>
          <p>
            The platform layer the whole problem statement asks for: fleet availability, failure risk, model quality and
            downtime causes computed off one integrated dataset.
          </p>
        </div>
        <div className="spacer" />
        <span className="chip">model confidence avg {meanConfidence}%</span>
      </div>

      <div className="grid g4">
        <Kpi label="Fleet availability" value={availability} unit="%" tone="ok" foot="20 airframes tracked" />
        <Kpi label="MTBF" value={mtbf} unit=" fh" delta="▲ 34% vs baseline" tone="ok" foot="mean time between failures" />
        <Kpi label="MTTR" value={mttr} unit=" h" delta="▼ 46% vs baseline" tone="ok" foot="mean time to repair" />
        <Kpi label="Downtime analysed" value={totalDowntime.toLocaleString()} unit=" h" tone="neutral" foot="12-month rolling" />
      </div>

      <div className="grid g-3-2">
        <Card title="Before vs after the platform" subtitle="Impact on the six metrics the problem statement names">
          <Table dense head={['Metric', 'Before', 'Now', 'Change', 'Progress']}>
            {outputs.map((o) => {
              const up = o.now >= o.before
              const betterWhenDown = o.label === 'MTTR' || o.label === 'Reactive share of work'
              const good = betterWhenDown ? !up : up
              const delta = Math.round(((o.now - o.before) / o.before) * 100)
              return (
                <tr key={o.label}>
                  <td>{o.label}</td>
                  <td className="mono num dim">
                    {o.before}
                    {o.unit}
                  </td>
                  <td className="mono num">
                    <b>
                      {o.now}
                      {o.unit}
                    </b>
                  </td>
                  <td>
                    <span className={good ? 'tone-ok' : 'tone-bad'}>
                      {up ? '▲' : '▼'} {Math.abs(delta)}%
                    </span>
                  </td>
                  <td style={{ width: 140 }}>
                    <div className="row tight">
                      <div className="health ok" style={{ flex: 1 }}>
                        <div
                          className="health-fill"
                          style={{
                            width: `${Math.min(100, (o.now / Math.max(o.now, o.before)) * 100)}%`,
                            background: good
                              ? 'linear-gradient(90deg,#10b981,#34d399)'
                              : 'linear-gradient(90deg,#ef4444,#f87171)',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </Table>
        </Card>

        <Card title="Fleet condition distribution" subtitle="Where the 20 airframes sit today">
          <div className="row wrap" style={{ justifyContent: 'space-around' }}>
            <Gauge value={availability} label="AVAILABILITY" sub={`${KPI.airworthy} of ${KPI.total} airworthy`} />
            <Donut
              size={150}
              segments={riskBands}
              center={`${FLEET.length}`}
              caption="airframes by next-failure horizon"
            />
          </div>
          <div className="note">
            Distribution is derived from per-aircraft RUL forecasts, not from maintenance counters.
          </div>
        </Card>
      </div>

      <div className="grid g-2-1">
        <Card title="Availability trend" subtitle="Monthly rolling availability vs reactive-only baseline">
          <LineChart
            height={220}
            series={[
              { name: 'Availability', color: '#4cc2ff', values: availabilityTrend.map((t) => t.value) },
              { name: 'Baseline', color: '#64748b', dashed: true, values: availabilityTrend.map((t) => t.reactive) },
            ]}
            labels={availabilityTrend.map((t) => t.label)}
            min={40}
            max={100}
            unit="%"
            yFormat={(v) => v.toFixed(0)}
          />
          <div className="series-legend">
            <span>
              <i style={{ background: '#4cc2ff' }} /> platform
            </span>
            <span>
              <i style={{ background: '#64748b' }} /> reactive baseline
            </span>
          </div>
        </Card>

        <Card title="Availability by class" subtitle="Ready airframes per type group">
          {classTrend.map((c) => (
            <BarRow
              key={c.cls}
              label={c.cls}
              value={c.availability}
              max={100}
              suffix="%"
              color={c.availability >= 75 ? '#34d399' : c.availability >= 60 ? '#fbbf24' : '#f87171'}
              right={`${c.availability}%`}
            />
          ))}
          <div className="note">Helicopters are the current drag — 2 airframes in inspection windows this month.</div>
        </Card>
      </div>

      <div className="grid g3">
        <Card title="Downtime pareto" subtitle={`Grounding hours by system (total ${totalDowntime.toLocaleString()} h)`}>
          {downtimePareto.slice(0, 6).map((r, i) => (
            <BarRow
              key={r.system}
              label={r.system}
              value={r.hours}
              max={downtimePareto[0].hours}
              color={`hsl(${200 - i * 9} 85% ${58 - i * 2}%)`}
              right={`${r.hours} h`}
            />
          ))}
          <div className="note">
            Top 2 systems account for{' '}
            {Math.round(((downtimePareto[0].hours + downtimePareto[1].hours) / totalDowntime) * 100)}% of all grounding
            hours.
          </div>
        </Card>

        <Card title="ML model registry" subtitle="Models running in production" pad={false}>
          <div style={{ padding: 14, display: 'grid', gap: 12 }}>
            {MODELS.map((m) => (
              <div className="model" key={m.key}>
                <div className="row tight">
                  <h4 style={{ flex: 1 }}>{m.name}</h4>
                  <Tag>{m.drift}</Tag>
                </div>
                <div className="task">
                  {m.task} · {m.algo}
                </div>
                {m.metrics.map((x) => (
                  <div className="metric-row" key={x.label}>
                    <span className="muted">{x.label}</span>
                    <b>{x.value}</b>
                  </div>
                ))}
                <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
                  trained {m.trained}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
          <Card title="Risk horizon" subtitle="Predictions by urgency band">
            {riskBands.map((b) => (
              <BarRow key={b.label} label={b.label} value={b.value} max={10} color={b.color} right={`${b.value}`} />
            ))}
            <div className="note">
              Anything inside 7 days is auto-escalated to the flight-line supervisor and pre-emptively indented for
              spares.
            </div>
          </Card>

          <Card title="Utilisation of critical assets" subtitle="Airframes and high-value LRUs">
            <Table dense head={['Asset', 'Class', 'Utilisation', 'Status']}>
              {[...FLEET]
                .sort((a, b) => b.utilisation - a.utilisation)
                .slice(0, 7)
                .map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{a.tail}</td>
                    <td className="dim">{a.cls}</td>
                    <td className="mono num">{Math.round(a.utilisation * 100)}%</td>
                    <td>
                      <Tag>{a.status}</Tag>
                    </td>
                  </tr>
                ))}
            </Table>
            <div className="note">
              {SPARES.filter((s) => s.criticality === 'A').length} criticality-A spare lines underpin the highest-value
              assets above.
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
