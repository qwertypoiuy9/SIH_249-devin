import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Card, Kpi, Table, Tag, Segmented } from '../components/ui'
import { BarRow } from '../components/charts'
import { SPARES, spareCover, WORK_ORDERS } from '../data/ops'
import { usePlatform } from '../lib/platform'
import { longLead, lowStock, sparesFillRate, stockoutRisk } from '../lib/metrics'
import type { Spare } from '../types'

function risk(s: Spare): 'STOCKOUT' | 'LEAD RISK' | 'OK' {
  if (spareCover(s) < s.leadDays) return 'STOCKOUT'
  if (s.onHand - s.reserved < s.reorder) return 'LEAD RISK'
  return 'OK'
}

export default function Spares() {
  const [crit, setCrit] = useState('All')
  const { indents, advanceIndent } = usePlatform()

  const rows = useMemo(
    () => SPARES.filter((s) => crit === 'All' || s.criticality === crit),
    [crit],
  )

  const awaiting = WORK_ORDERS.filter((w) => w.status === 'AWAITING SPARES')
  const valueOnHand = SPARES.reduce((sum, s) => sum + s.onHand * (s.criticality === 'A' ? 480000 : s.criticality === 'B' ? 95000 : 22000), 0)

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h2>Spares & inventory</h2>
          <p>
            Stock levels joined with live predictions: the platform indents the part before the aircraft is declared
            AOG, instead of discovering the shortage after grounding.
          </p>
        </div>
        <div className="spacer" />
        <Segmented options={['All', 'A', 'B', 'C']} value={crit} onChange={setCrit} />
      </div>

      <div className="grid g4">
        <Kpi label="Fill rate" value={sparesFillRate} unit="%" tone={sparesFillRate > 85 ? 'ok' : 'warn'} foot="first-pull demand met" />
        <Kpi label="Lines below reorder" value={lowStock.length} tone={lowStock.length ? 'warn' : 'ok'} foot={`of ${SPARES.length} tracked SKUs`} />
        <Kpi label="Stockout risk now" value={stockoutRisk.length} tone={stockoutRisk.length ? 'bad' : 'ok'} foot="cover < supplier lead" />
        <Kpi label="Orders held on spares" value={awaiting.length} tone="warn" foot="work stopped, waiting parts" />
      </div>

      <div className="grid g-2-1">
        <Card title="Inventory ledger" subtitle={`${rows.length} line items · ranked by risk`} pad={false}>
          <Table
            dense
            head={['Risk', 'Part no.', 'Description', 'Crit.', 'On hand', 'Reserved', 'Net', 'Cover', 'Lead', 'Reorder', 'Demand/30d', 'Supplier']}
          >
            {[...rows]
              .sort((a, b) => {
                const order = { STOCKOUT: 0, 'LEAD RISK': 1, OK: 2 }
                return order[risk(a)] - order[risk(b)]
              })
              .map((s) => {
                const net = s.onHand - s.reserved
                const r = risk(s)
                return (
                  <tr key={s.part}>
                    <td>
                      <Tag tone={r === 'STOCKOUT' ? 'bad' : r === 'LEAD RISK' ? 'warn' : 'ok'}>{r}</Tag>
                    </td>
                    <td className="mono">{s.part}</td>
                    <td>{s.name}</td>
                    <td>
                      <span className="chip">{s.criticality}</span>
                    </td>
                    <td className="mono num">{s.onHand}</td>
                    <td className="mono num dim">{s.reserved}</td>
                    <td className="mono num">{net}</td>
                    <td className="mono num" style={{ color: spareCover(s) < s.leadDays ? '#f87171' : undefined }}>
                      {spareCover(s)} d
                    </td>
                    <td className="mono num">{s.leadDays} d</td>
                    <td className="mono num dim">{s.reorder}</td>
                    <td className="mono num">{s.demand30}</td>
                    <td className="dim" style={{ fontSize: 12 }}>
                      {s.supplier}
                    </td>
                  </tr>
                )
              })}
          </Table>
        </Card>

        <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
          <Card title="Long-lead critical parts" subtitle="Order these before the alert, not after the failure">
            <div className="list">
              {longLead
                .sort((a, b) => b.leadDays - a.leadDays)
                .map((s) => (
                  <div key={s.part} className="row tight">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 620 }}>{s.name}</div>
                      <div className="dim mono" style={{ fontSize: 11 }}>
                        {s.part} · {s.supplier}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontWeight: 700 }}>
                        {s.leadDays} d
                      </div>
                      <div className="dim" style={{ fontSize: 11 }}>
                        cover {spareCover(s)} d
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            <div className="note">
              Inventory value ≈ ₹{(valueOnHand / 1e7).toFixed(1)} Cr. {stockoutRisk.length} lines need indent release
              today.
            </div>
          </Card>

          <Card title="Cover vs lead time" subtitle="Days of stock on hand against supplier delivery time">
            {[...SPARES]
              .sort((a, b) => spareCover(a) - spareCover(b))
              .slice(0, 8)
              .map((s) => {
                const cover = spareCover(s)
                const bad = cover < s.leadDays
                return (
                  <BarRow
                    key={s.part}
                    label={s.name}
                    value={cover}
                    max={Math.max(s.leadDays * 1.4, cover)}
                    color={bad ? '#f87171' : cover < s.reorder ? '#fbbf24' : '#34d399'}
                    right={`${cover} d`}
                  />
                )
              })}
            <div className="note">Red bars: supply runs out before the replacement arrives — auto-indent required.</div>
          </Card>

          <Card
            title="Live indents"
            subtitle="Parts reserved from AI alerts — advance each one through approval to receipt"
            pad={false}
          >
            <div style={{ padding: '10px 14px', display: 'grid', gap: 10 }}>
              {indents.length === 0 && (
                <div className="empty" style={{ padding: 18 }}>
                  No indents raised yet — open Predictive faults and indent a part for an alert.
                </div>
              )}
              {indents.map((i) => (
                <div key={i.id} className="alert" style={{ padding: '10px 12px' }}>
                  <div className="ring" style={{ ['--p' as string]: i.status === 'RECEIVED' ? 100 : i.status === 'APPROVED' ? 55 : 25, ['--c' as string]: i.status === 'RECEIVED' ? '#0b8f66' : '#1d7ae0' } as CSSProperties}>
                    <span>{i.qty}×</span>
                  </div>
                  <div>
                    <div className="alert-title">{i.name}</div>
                    <div className="alert-sub mono">
                      {i.id} · {i.part} · from alert {i.reason} · ETA {i.etaDays} d
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Tag tone={i.status === 'RECEIVED' ? 'ok' : i.status === 'APPROVED' ? 'info' : 'warn'}>
                      {i.status}
                    </Tag>
                    {i.status !== 'RECEIVED' && (
                      <div>
                        <button className="pill" style={{ marginTop: 6 }} onClick={() => advanceIndent(i.id)}>
                          {i.status === 'RAISED' ? 'Approve →' : 'Mark received →'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Automatic spares trigger" subtitle="Prediction → indent without human hand-off">
            <div className="timeline">
              <div className="tl-item bad">
                <div className="tl-time">prediction raised</div>
                <div className="tl-text">RUL shorter than supplier lead time + margin</div>
              </div>
              <div className="tl-item warn">
                <div className="tl-time">+2 min</div>
                <div className="tl-text">Indent drafted with part, quantity and required-by date</div>
              </div>
              <div className="tl-item ok">
                <div className="tl-time">+10 min</div>
                <div className="tl-text">Stores ERP reserved stock or released purchase indent</div>
              </div>
              <div className="tl-item">
                <div className="tl-time">arrival</div>
                <div className="tl-text">Part arrives before AOG — aircraft never leaves the line</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
