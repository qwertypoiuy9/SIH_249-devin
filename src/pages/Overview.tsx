import { Card, Kpi, Tag, Table, Pill } from '../components/ui'
import type { CSSProperties } from 'react'
import { BarRow, Donut, LineChart } from '../components/charts'
import { FLEET, CLASS_COLORS } from '../data/fleet'
import { PREDICTIONS } from '../data/predictions'
import { DATA_ASSETS, WORK_ORDERS, SPARES, spareCover } from '../data/ops'
import {
  KPI,
  availability,
  availabilityTrend,
  availDelta,
  missionDelta,
  avgFleetAvailability,
  byClass,
  criticalPreds,
  downtimeAvoided,
  downtimePareto,
  failuresPrevented,
  lowStock,
  meanLeadDays,
  missionCapable,
  openWO,
  p1WO,
  predictiveShare,
  sparesFillRate,
  stockoutRisk,
  totalDowntime,
} from '../lib/metrics'
import { fmt } from '../lib/metrics'

export default function Overview({ onOpenAircraft }: { onOpenAircraft: (id: string) => void }) {
  const trendLabels = availabilityTrend.map((t) => t.label)
  const worstSystems = [...FLEET]
    .flatMap((a) => a.systems.map((s) => ({ ...s, tail: a.tail, id: a.id })))
    .sort((a, b) => a.health - b.health)
    .slice(0, 6)

  const statusSeg = [
    { label: 'Airworthy', value: KPI.airworthy, color: '#34d399' },
    { label: 'Inspection due', value: KPI.dueInsp, color: '#60a5fa' },
    { label: 'In maintenance', value: KPI.inWork, color: '#fbbf24' },
    { label: 'AOG', value: KPI.aog, color: '#f87171' },
  ]

  const woSeg = [
    { label: 'Predictive', value: WORK_ORDERS.filter((w) => w.type === 'PREDICTIVE').length, color: '#4cc2ff' },
    { label: 'Preventive', value: WORK_ORDERS.filter((w) => w.type === 'PREVENTIVE').length, color: '#a78bfa' },
    { label: 'Corrective', value: WORK_ORDERS.filter((w) => w.type === 'CORRECTIVE').length, color: '#fbbf24' },
  ]

  return (
    <div className="content">
      {KPI.aog > 0 && (
        <div className="aog-banner">
          <span
            className="ring"
            style={{ ['--p' as string]: 74, ['--c' as string]: '#f87171' } as CSSProperties}
          >
            <span>{KPI.aog}</span>
          </span>
          <div>
            <b>{KPI.aog} aircraft AOG right now</b> — {FLEET.filter((a) => a.status === 'AOG').map((a) => a.tail).join(', ')}
            . Predictive alerts raised on both before the failure; spares indents open.
          </div>
          <div className="spacer" />
          <Tag tone="bad">GROUND RISK</Tag>
        </div>
      )}

      <div className="grid g4">
        <Kpi
          label="Fleet availability"
          value={availability}
          unit="%"
          delta={`▲ ${availDelta} pts`}
          tone={availability >= 75 ? 'ok' : 'warn'}
          foot="vs 68% pre-platform"
        />
        <Kpi
          label="Mission capable"
          value={missionCapable}
          unit="%"
          delta={`▲ ${missionDelta} pts`}
          tone="ok"
          foot={`${KPI.airworthy}/${KPI.total} fully ready`}
        />
        <Kpi
          label="Early warning lead time"
          value={meanLeadDays}
          unit=" days"
          delta="▲ 3.2 d"
          tone="ok"
          foot="mean before failure"
        />
        <Kpi
          label="Downtime hours avoided"
          value={fmt(downtimeAvoided)}
          unit=" h"
          delta={`▲ ${failuresPrevented} failures averted`}
          tone="ok"
          foot="rolling 30 days"
        />
      </div>

      <div className="grid g4">
        <Kpi label="Open work orders" value={openWO.length} tone="neutral" foot={`${p1WO.length} at P1 priority`} />
        <Kpi
          label="Awaiting spares"
          value={WORK_ORDERS.filter((w) => w.status === 'AWAITING SPARES').length}
          tone={WORK_ORDERS.filter((w) => w.status === 'AWAITING SPARES').length > 3 ? 'warn' : 'neutral'}
          foot={`${lowStock.length} SKUs below reorder`}
        />
        <Kpi label="Spares fill rate" value={sparesFillRate} unit="%" tone={sparesFillRate > 85 ? 'ok' : 'warn'} foot="line items met first pull" />
        <Kpi
          label="Predictive share of work"
          value={predictiveShare}
          unit="%"
          delta="was 9% before AI"
          tone="info"
          foot={`${criticalPreds.length} high-risk alerts open`}
        />
      </div>

      <div className="grid g-3-2">
        <Card
          title="Fleet availability trend"
          subtitle="12-month rolling mission-capable rate vs reactive-only baseline (no predictive maintenance)"
          right={
            <div className="row tight">
              <span className="chip">
                <span style={{ color: '#4cc2ff' }}>■</span> with platform
              </span>
              <span className="chip">
                <span style={{ color: '#64748b' }}>■</span> reactive baseline
              </span>
            </div>
          }
        >
          <LineChart
            height={214}
            series={[
              {
                name: 'Availability',
                color: '#4cc2ff',
                values: availabilityTrend.map((t) => t.value),
              },
              {
                name: 'Reactive baseline',
                color: '#64748b',
                dashed: true,
                values: availabilityTrend.map((t) => t.reactive),
              },
            ]}
            labels={trendLabels}
            min={40}
            max={100}
            unit="%"
            yFormat={(v) => v.toFixed(0)}
          />
          <div className="series-legend">
            <span>
              <i style={{ background: '#4cc2ff' }} />
              {availabilityTrend[11].label}: {availabilityTrend[11].value}% availability
            </span>
            <span>
              <i style={{ background: '#64748b' }} />
              reactive-only baseline: {availabilityTrend[11].reactive}%
            </span>
          </div>
        </Card>

        <Card title="Where the fleet stands" subtitle="Readiness split across 20 airframes" right={<span className="chip">MTBF {46.2} fh</span>}>
          <div className="row wrap" style={{ justifyContent: 'space-around', alignItems: 'flex-start' }}>
            <Donut segments={statusSeg} center={`${KPI.total}`} caption="aircraft in fleet" />
            <Donut segments={woSeg} center={`${WORK_ORDERS.length}`} caption="work orders open" />
          </div>
          <div className="note">
            Work orders are generated automatically from AI predictions instead of waiting for a defect to be reported
            by the crew.
          </div>
        </Card>
      </div>

      <div className="grid g-2-1">
        <Card
          title="Top faults predicted before they happen"
          subtitle="Ranked by remaining useful life — earliest actionable warnings first"
          right={
            <button className="pill on" type="button">
              {PREDICTIONS.length} active predictions
            </button>
          }
          pad={false}
        >
          <Table
            dense
            head={['Severity', 'Aircraft', 'Component / failure mode', 'RUL', 'Conf.', 'Anomaly', '']}
          >
            {PREDICTIONS.slice(0, 7).map((p) => (
              <tr key={p.id} className="clickable" onClick={() => onOpenAircraft(p.aircraftId)}>
                <td>
                  <Tag>{p.severity}</Tag>
                </td>
                <td className="mono">
                  {p.tail}
                  <div className="dim" style={{ fontSize: 11 }}>
                    {p.system}
                  </div>
                </td>
                <td>
                  {p.component.split(' · ')[1]}
                  <div className="dim" style={{ fontSize: 11 }}>
                    {p.failureMode}
                  </div>
                </td>
                <td className="mono num">
                  {p.rulDays.toFixed(1)}d
                  <div className="dim" style={{ fontSize: 11 }}>
                    {p.rulHours.toFixed(0)} fh
                  </div>
                </td>
                <td className="mono num">{p.confidence}%</td>
                <td className="num">
                  <div className="row tight" style={{ justifyContent: 'flex-end' }}>
                    <div className="meter" style={{ width: 54 }}>
                      <i style={{ width: `${p.anomaly}%` }} />
                    </div>
                    <span className="mono">{p.anomaly}</span>
                  </div>
                </td>
                <td className="num dim">→</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Readiness by aircraft class" subtitle="Availability and utilisation per type">
          <Table dense head={['Class', 'Ready', 'Availability', 'Utilisation']}>
            {byClass.map((c) => (
              <tr key={c.cls}>
                <td>
                  <span className="row tight">
                    <i
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: CLASS_COLORS[c.cls],
                        display: 'inline-block',
                      }}
                    />
                    {c.cls}
                  </span>
                </td>
                <td className="mono num">
                  {c.ready}/{c.total}
                </td>
                <td style={{ width: 120 }}>
                  <div className="row tight">
                    <div className="health ok" style={{ flex: 1 }}>
                      <div className="health-fill" style={{ width: `${c.availability}%` }} />
                    </div>
                    <span className="mono" style={{ fontSize: 12 }}>
                      {c.availability}%
                    </span>
                  </div>
                </td>
                <td className="mono num">{c.avgUtil}%</td>
              </tr>
            ))}
          </Table>
          <div className="note">
            Fleet-average airframe utilisation {avgFleetAvailability}% — aircraft sitting idle in maintenance are the
            main loss of the flying fraction.
          </div>
        </Card>
      </div>

      <div className="grid g-2-1">
        <Card
          title="Downtime pareto — 12-month grounding hours by system"
          subtitle="Striped portion is the downtime the platform flags as avoidable through earlier intervention"
          right={<span className="chip">total {fmt(totalDowntime)} h</span>}
        >
          {downtimePareto.map((r) => (
            <BarRow
              key={r.system}
              label={r.system}
              value={r.hours}
              max={downtimePareto[0].hours}
              color={`hsl(${198 - downtimePareto.indexOf(r) * 8} 85% ${58 - downtimePareto.indexOf(r) * 2}%)`}
              right={`${r.hours} h`}
            />
          ))}
          <div className="note">
            {Math.round(
              (downtimePareto.reduce((s, r) => s + r.avoidable, 0) / totalDowntime) * 100,
            )}
            % of grounding hours are traceable to failures with detectable precursors — exactly what the predictive
            models target first.
          </div>
        </Card>

        <Card title="Integrated data health" subtitle="Five source systems unified into one asset picture">
          <div className="list">
            {DATA_ASSETS.map((d) => (
              <div key={d.key} className="row">
                <div style={{ flex: 1 }}>
                  <div className="row tight">
                    <span className="src-name">{d.name}</span>
                    <Tag tone={d.state === 'SYNCED' ? 'ok' : d.state === 'SYNCING' ? 'info' : 'warn'}>
                      {d.state}
                    </Tag>
                  </div>
                  <div className="src-note mono">
                    {fmt(d.records)} records · last sync {d.synced}
                  </div>
                </div>
                <div className="meter" style={{ width: 70 }}>
                  <i style={{ width: `${d.health}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="note">
            Legacy problem: records sat in four disconnected systems, so defects were found late. Everything above now
            feeds the same aircraft record.
          </div>
        </Card>
      </div>

      <div className="grid g3">
        <Card title="Spares at stockout risk" subtitle="Cover days shorter than supplier lead time">
          <div className="list">
            {stockoutRisk.slice(0, 4).map((s) => (
              <div key={s.part} className="row tight">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 620 }}>{s.name}</div>
                  <div className="dim mono" style={{ fontSize: 11 }}>
                    {s.part} · cover {spareCover(s)}d vs lead {s.leadDays}d
                  </div>
                </div>
                <Tag tone="bad">RISK</Tag>
              </div>
            ))}
            {!stockoutRisk.length && <div className="empty">All critical lines covered</div>}
          </div>
          <div className="note">{SPARES.length} line items tracked · {lowStock.length} below reorder level.</div>
        </Card>

        <Card title="Lowest system health in fleet" subtitle="Click an aircraft to open its digital twin" pad={false}>
          <Table dense head={['Aircraft', 'System', 'Health']}>
            {worstSystems.map((s, i) => (
              <tr key={i} className="clickable" onClick={() => onOpenAircraft(s.id)}>
                <td className="mono">{s.tail}</td>
                <td className="dim">{s.name}</td>
                <td style={{ width: 110 }}>
                  <div className="row tight">
                    <div className={`health ${s.health >= 80 ? 'ok' : s.health >= 60 ? 'warn' : 'bad'}`} style={{ flex: 1 }}>
                      <div className="health-fill" style={{ width: `${s.health}%` }} />
                    </div>
                    <span className="mono" style={{ fontSize: 12 }}>
                      {s.health.toFixed(0)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Maintenance mix & backlog" subtitle="How work is being generated today">
          <div className="stat-strip">
            <div className="stat">
              <b>{predictiveShare}%</b>
              <span>from AI</span>
            </div>
            <div className="stat">
              <b>{WORK_ORDERS.filter((w) => w.type === 'PREVENTIVE').length}</b>
              <span>preventive</span>
            </div>
            <div className="stat">
              <b>{p1WO.length}</b>
              <span>P1 open</span>
            </div>
          </div>
          <div style={{ marginTop: 14 }} className="list">
            {openWO.slice(0, 4).map((w) => (
              <div key={w.id} className="row tight">
                <Tag tone={w.priority === 'P1' ? 'bad' : 'info'}>{w.priority}</Tag>
                <div style={{ flex: 1, fontSize: 12.5 }}>
                  {w.title}
                  <div className="dim mono" style={{ fontSize: 11 }}>
                    {w.tail} · {w.agency}
                  </div>
                </div>
                <Tag>{w.status}</Tag>
              </div>
            ))}
          </div>
          <div className="note">
            Open the Maintenance page for the full schedule, agency allocation and turnaround tracking.
          </div>
          <div className="row tight" style={{ marginTop: 10 }}>
            <Pill active>Live catalogue</Pill>
            <span className="dim" style={{ fontSize: 11.5 }}>
              updates every 5s from the simulated IoT feed
            </span>
          </div>
        </Card>
      </div>
    </div>
  )
}
