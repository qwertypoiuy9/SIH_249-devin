import { useMemo, useState } from 'react'
import { Card, Kpi, Table, Tag, Segmented } from '../components/ui'
import { BarRow } from '../components/charts'
import { WORK_ORDERS } from '../data/ops'
import { PREDICTIONS } from '../data/predictions'
import { FLEET } from '../data/fleet'
import { backlogDays, meanLeadDays, mttr, openWO, p1WO } from '../lib/metrics'
import { usePlatform } from '../lib/platform'
import type { WorkOrder } from '../types'

const STATUSES: WorkOrder['status'][] = ['SCHEDULED', 'IN WORK', 'AWAITING SPARES', 'QA HOLD', 'COMPLETED']

const AGENCY_CAPACITY: Record<string, number> = {
  'No. 51 Base Repair Depot': 82,
  'No. 17 Base Repair Depot': 64,
  'HAL (OEM)': 47,
  'Squadron Flight Line': 78,
  'EME Workshop': 71,
  'Third-party NDT vendor': 39,
}

export default function Maintenance({ onOpenAircraft }: { onOpenAircraft: (id: string) => void }) {
  const [status, setStatus] = useState('All')
  const [type, setType] = useState('All')
  const { raisedWOs } = usePlatform()

  const all: WorkOrder[] = useMemo(() => [...raisedWOs, ...WORK_ORDERS], [raisedWOs])

  const rows = useMemo(
    () =>
      all.filter(
        (w) => (status === 'All' || w.status === status) && (type === 'All' || w.type === type),
      ).sort((a, b) => a.priority.localeCompare(b.priority) || b.tatDays - a.tatDays),
    [all, status, type],
  )

  const byStatus = STATUSES.map((s) => ({
    label: s,
    value: all.filter((w) => w.status === s).length,
  }))
  const maxStatus = Math.max(...byStatus.map((b) => b.value))

  const schedule = FLEET.filter((a) => a.status !== 'AIRWORTHY' || a.nextInspDays <= 14)

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h2>Maintenance planning & work control</h2>
          <p>
            One schedule for squadron, depot and OEM work: AI-predicted tasks are slotted in alongside scheduled
            servicing, with spares and agency capacity checked before the aircraft goes on the ramp.
          </p>
        </div>
        <div className="spacer" />
        <Segmented options={['All', 'PREDICTIVE', 'PREVENTIVE', 'CORRECTIVE']} value={type} onChange={setType} />
        <Segmented options={['All', ...STATUSES]} value={status} onChange={setStatus} />
      </div>

      <div className="grid g4">
        <Kpi label="Open work orders" value={openWO.length} tone="neutral" foot={`${WORK_ORDERS.length} total incl. closed`} />
        <Kpi label="P1 priority" value={p1WO.length} tone={p1WO.length ? 'bad' : 'ok'} foot="must clear this week" />
        <Kpi label="Mean turnaround" value={mttr} unit=" h" tone="ok" foot={`was 41 h reactive`} />
        <Kpi label="Predicted lead time" value={meanLeadDays} unit=" d" tone="ok" foot="work can start before failure" />
      </div>

      <div className="grid g-2-1">
        <Card
          title="Work order board"
          subtitle={`${rows.length} orders${raisedWOs.length ? ` · ${raisedWOs.length} raised by you from AI alerts` : ''} · sorted by priority`}
          pad={false}
        >
          <Table
            dense
            head={['WO', 'Priority', 'Aircraft', 'Task', 'Type', 'Status', 'Agency', 'Opened', 'TAT', 'Progress']}
          >
            {rows.map((w) => (
              <tr key={w.id} className="clickable" onClick={() => onOpenAircraft(w.aircraftId)}>
                <td className="mono">{w.id}</td>
                <td>
                  <Tag>{w.priority}</Tag>
                </td>
                <td className="mono">{w.tail}</td>
                <td>
                  {w.title}
                  <div className="dim" style={{ fontSize: 11 }}>
                    {w.system}
                    {w.spare ? ` · ${w.spare}` : ''}
                  </div>
                  {w.sourcePred && (
                    <div style={{ marginTop: 4 }}>
                      <span className="chip" style={{ borderColor: '#1d7ae0', color: '#1673d1' }}>
                        raised by you · {w.sourcePred}
                      </span>
                    </div>
                  )}
                </td>
                <td>
                  <span className="chip">{w.type}</span>
                </td>
                <td>
                  <Tag>{w.status}</Tag>
                </td>
                <td className="dim" style={{ fontSize: 12 }}>
                  {w.agency}
                </td>
                <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                  {new Date(w.opened).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </td>
                <td className="mono num">{w.tatDays}d</td>
                <td style={{ width: 110 }}>
                  <div className="row tight">
                    <div className="progress" style={{ flex: 1 }}>
                      <i style={{ width: `${w.progress}%` }} />
                    </div>
                    <span className="mono" style={{ fontSize: 11 }}>
                      {w.progress}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          {!rows.length && <div className="empty">No work orders match this filter.</div>}
        </Card>

        <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
          <Card title="Backlog by status" subtitle="Where jobs are waiting">
            {byStatus.map((b) => (
              <BarRow
                key={b.label}
                label={b.label}
                value={b.value}
                max={maxStatus}
                color={
                  b.label === 'AWAITING SPARES'
                    ? '#f87171'
                    : b.label === 'IN WORK'
                      ? '#4cc2ff'
                      : b.label === 'QA HOLD'
                        ? '#fbbf24'
                        : b.label === 'COMPLETED'
                          ? '#34d399'
                          : '#a78bfa'
                }
                right={`${b.value}`}
              />
            ))}
            <div className="note">Estimated backlog clearance: {backlogDays} aircraft-days at current throughput.</div>
          </Card>

          <Card title="Maintenance agency utilisation" subtitle="Load on each executing agency">
            {Object.entries(AGENCY_CAPACITY).map(([name, load]) => (
              <BarRow
                key={name}
                label={name}
                value={load}
                max={100}
                suffix="%"
                color={load > 75 ? '#f87171' : load > 55 ? '#fbbf24' : '#34d399'}
                right={`${load}%`}
              />
            ))}
            <div className="note">
              Agencies feed status straight into the platform — the historical 26-minute-late partner feed is the one
              source still flagged stale.
            </div>
          </Card>
        </div>
      </div>

      <div className="grid g-2-1">
        <Card title="Upcoming maintenance window (next 14 days)" subtitle="Inspections and servicings due, with predicted tasks merged in" pad={false}>
          <Table dense head={['Due in', 'Tail', 'Type', 'Event', 'Status', 'Predicted tasks available', 'Window']}>
            {[...schedule]
              .sort((a, b) => a.nextInspDays - b.nextInspDays)
              .map((a) => {
                const preds = PREDICTIONS.filter((p) => p.aircraftId === a.id)
                const window =
                  a.nextInspDays <= 7 ? 'Slot this week' : a.nextInspDays <= 14 ? 'Next week' : 'Later'
                return (
                  <tr key={a.id} className="clickable" onClick={() => onOpenAircraft(a.id)}>
                    <td className="mono">{a.nextInspDays} d</td>
                    <td className="mono">
                      <b>{a.tail}</b>
                    </td>
                    <td>{a.type}</td>
                    <td>
                      {a.status === 'AOG'
                        ? 'AOG recovery — corrective work in progress'
                        : a.nextInspDays < 15
                          ? 'Phase inspection due'
                          : '250 fh servicing'}
                    </td>
                    <td>
                      <Tag>{a.status}</Tag>
                    </td>
                    <td>
                      {preds.length ? (
                        <span className="mono">
                          {preds.length} · next in {Math.min(...preds.map((p) => p.rulDays)).toFixed(1)} d
                        </span>
                      ) : (
                        <span className="dim">none</span>
                      )}
                    </td>
                    <td className="dim">{window}</td>
                  </tr>
                )
              })}
          </Table>
        </Card>

        <Card title="Reactive vs planned" subtitle="Shift in maintenance mix since deployment">
          <div className="list">
            <BarRow label="Planned (pred + prev)" value={100 - 31} max={100} suffix="%" right="69%" color="#34d399" />
            <BarRow label="Reactive (run-to-failure)" value={31} max={100} suffix="%" right="31%" color="#f87171" />
          </div>
          <div className="list" style={{ marginTop: 14 }}>
            <div className="row tight">
              <span className="chip">before</span>
              <span className="muted" style={{ fontSize: 12.5 }}>
                69% reactive · faults found by crews, aircraft grounded without warning
              </span>
            </div>
            <div className="row tight">
              <span className="chip">now</span>
              <span className="muted" style={{ fontSize: 12.5 }}>
                31% reactive · {meanLeadDays} days of warning on average, work slotted into downtime that already had to
                happen
              </span>
            </div>
          </div>
          <div className="note">
            Conversion of prediction → work order is automatic, which removes the “delayed fault prediction” step of the
            original workflow.
          </div>
        </Card>
      </div>
    </div>
  )
}
