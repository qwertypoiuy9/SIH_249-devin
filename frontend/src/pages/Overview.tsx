import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, BellOff, Plane, ShieldCheck, Timer, Wrench } from "lucide-react";
import { api, type Status } from "../api";
import { useData, useSim } from "../hooks";
import { CHART, ErrorBox, fmt, Kpi, Loading, PageHeader, PriorityBadge, RulBar, STATUS_COLOR, StatusBadge } from "../components/ui";

export default function Overview() {
  const { summary: s } = useSim();
  const adv = useData(api.advisories);
  const ev = useData(api.events);
  if (!s) return <Loading label="Connecting to fleet twin" />;

  const pie = (Object.keys(s.by_status) as Status[]).map((k) => ({ name: k, value: s.by_status[k] })).filter((x) => x.value > 0);
  return (
    <div className="space-y-5">
      <PageHeader title="Fleet Availability Overview"
        subtitle="Integrated view fusing aircraft health monitoring, technical records, spares ERP and MRO pipeline. Advance the simulation clock to watch the fleet degrade, and toggle auto-scheduling to compare reactive vs predictive operations." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Operational Availability" value={`${s.ao.toFixed(0)}%`} tone={s.ao >= 85 ? "good" : s.ao >= 70 ? "warn" : "bad"} icon={<ShieldCheck size={14} />}
          sub={s.ao_avg !== null ? `period avg ${s.ao_avg}%` : "FMC + FMC-watch / fleet"} />
        <Kpi label="Sortie Gen. Rate" value={s.sgr ?? "-"} sub="sorties/day (7-day)" icon={<Plane size={14} />} />
        <Kpi label="Critical / High" value={`${s.advisories.CRITICAL} / ${s.advisories.HIGH}`} tone={s.advisories.CRITICAL ? "bad" : "warn"}
          sub={`${s.advisories.MEDIUM} medium advisories`} icon={<AlertTriangle size={14} />} />
        <Kpi label="Unscheduled Failures" value={s.unscheduled_failures} tone={s.unscheduled_failures ? "bad" : "good"}
          sub={`${s.scheduled_removals} predictive removals`} icon={<Wrench size={14} />} />
        <Kpi label="Supply Risk" value={s.supply_risk} tone={s.supply_risk ? "warn" : "good"} sub={`${s.open_work_orders} open work orders`} icon={<Timer size={14} />} />
        <Kpi label="Alerts suppressed" value={s.alerts_suppressed} tone="info" sub={`${s.alerts_corroborated} corroborated (multi-sensor)`} icon={<BellOff size={14} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card p-4 xl:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Availability trend</h2>
            <span className="text-xs text-slate-500">{fmt(s.sorties_total)} sorties, {fmt(s.flight_hours_total)} FH flown</span>
          </div>
          {s.history.length < 2 ? (
            <div className="grid h-64 place-items-center text-sm text-slate-500">Advance the simulation clock (top right) to build history.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={s.history}>
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} tickFormatter={(d) => `D${d}`} />
                <YAxis stroke={CHART.axis} fontSize={11} allowDecimals={false} />
                <Tooltip {...CHART.tooltip} labelFormatter={(d) => `Day ${d}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="stepAfter" dataKey="fmc" name="Mission capable" stackId="1" stroke="#34d399" fill="#34d39933" />
                <Area type="stepAfter" dataKey="nmc_maint" name="NMC maintenance" stackId="1" stroke="#38bdf8" fill="#38bdf833" />
                <Area type="stepAfter" dataKey="nmc_aog" name="NMC AOG (spares)" stackId="1" stroke="#fb7185" fill="#fb718533" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Fleet status</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2} stroke="none">
                {pie.map((p) => <Cell key={p.name} fill={STATUS_COLOR[p.name]} />)}
              </Pie>
              <Tooltip {...CHART.tooltip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {(Object.keys(s.by_status) as Status[]).map((k) => (
              <div key={k} className="flex items-center justify-between rounded bg-ink-800 px-2 py-1.5"><StatusBadge s={k} /><span className="mono text-slate-200">{s.by_status[k]}</span></div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Availability by base</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={s.by_base}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke={CHART.axis} fontSize={11} />
              <YAxis stroke={CHART.axis} fontSize={11} domain={[0, 100]} unit="%" />
              <Tooltip {...CHART.tooltip} formatter={(v) => `${v}%`} />
              <Bar dataKey="ao" name="Ao" radius={[4, 4, 0, 0]}>
                {s.by_base.map((b) => <Cell key={b.name} fill={b.ao >= 85 ? "#34d399" : b.ao >= 70 ? "#fbbf24" : "#fb7185"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
            {s.by_type.map((t) => <span key={t.name} className="rounded bg-ink-800 px-2 py-1">{t.name}: <span className="mono text-slate-200">{t.fmc}/{t.total}</span></span>)}
          </div>
        </div>
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Top maintenance advisories</h2>
            <Link to="/advisories" className="text-xs text-sky-300 hover:underline">All advisories</Link>
          </div>
          {adv.error ? <ErrorBox error={adv.error} /> : !adv.data ? <Loading /> : (
            <table className="tbl">
              <thead><tr><th>Priority</th><th>Tail</th><th>Component</th><th>RUL (sorties)</th><th>Act by</th></tr></thead>
              <tbody>
                {adv.data.slice(0, 7).map((a) => (
                  <tr key={a.id}>
                    <td><PriorityBadge p={a.priority} /></td>
                    <td><Link className="text-sky-300 hover:underline mono" to={`/aircraft/${a.tail}`}>{a.tail}</Link></td>
                    <td className="max-w-[180px] truncate">{a.component}</td>
                    <td><div className="flex items-center gap-2"><RulBar lo={a.rul_lo} hi={a.rul_hi} rul={a.rul} safe={a.rul_safe} max={120} /><span className="mono text-xs">{a.rul_safe.toFixed(0)}</span></div></td>
                    <td className="mono text-xs">{a.action_by}</td>
                  </tr>
                ))}
                {adv.data.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500">No advisories</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Integrated event log (tech log / ERP / MRO)</h2>
        <div className="max-h-64 space-y-1 overflow-auto text-xs">
          {ev.data?.slice(0, 40).map((e, i) => (
            <div key={i} className="flex gap-3 rounded px-2 py-1 hover:bg-ink-800">
              <span className="mono w-20 shrink-0 text-slate-500">{e.date}</span>
              <span className={`w-24 shrink-0 font-semibold ${SEV[e.severity] ?? "text-sky-300"}`}>{e.kind}</span>
              {e.tail && <Link to={`/aircraft/${e.tail}`} className="mono w-14 shrink-0 text-sky-300 hover:underline">{e.tail}</Link>}
              <span className="text-slate-300">{e.text}</span>
            </div>
          ))}
          {ev.data?.length === 0 && <div className="text-slate-500">No events yet. Advance the clock.</div>}
        </div>
      </div>
    </div>
  );
}

const SEV: Record<string, string> = { critical: "text-rose-300", warning: "text-amber-300", success: "text-emerald-300" };
