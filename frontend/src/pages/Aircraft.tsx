import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Wrench } from "lucide-react";
import { api } from "../api";
import { useData, useSim } from "../hooks";
import { ErrorBox, fmt, healthColor, Kpi, Loading, PageHeader, PriorityBadge, RulBar, StatusBadge } from "../components/ui";
import { OsaCbmPipeline, TraceCharts } from "../components/TraceView";

export default function AircraftPage() {
  const { tail = "" } = useParams();
  const { refresh } = useSim();
  const { data: ac, error } = useData(() => api.aircraftDetail(tail), [tail]);
  const [picked, setPicked] = useState<{ tail: string; cid: string } | null>(null);
  const [note, setNote] = useState<{ tail: string; text: string } | null>(null);
  const cid = picked?.tail === tail ? picked.cid : null;
  const setCid = (c: string) => setPicked({ tail, cid: c });
  const msg = note?.tail === tail ? note.text : null;
  const setMsg = (text: string | null) => setNote(text ? { tail, text } : null);
  const sel = cid ?? (ac ? [...ac.components].sort((a, b) => a.rul_safe - b.rul_safe)[0]?.id : null);
  const trace = useData(() => (sel ? api.trace(tail, sel) : Promise.resolve(null)), [tail, sel]);

  if (error) return <ErrorBox error={error} />;
  if (!ac) return <Loading />;

  const raiseWo = async (id: string) => {
    setMsg(null);
    try { const wo = await api.createWorkOrder(tail, id); setMsg(`Work order ${wo.id} raised; spare from ${wo.source} ETA ${wo.parts_eta_date}`); await refresh(); }
    catch (e) { setMsg((e as Error).message); }
  };
  const t = trace.data;
  const openFor = new Set(ac.work_orders.filter((w) => w.phase !== "done").map((w) => w.component_id));

  return (
    <div className="space-y-5">
      <Link to="/fleet" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"><ArrowLeft size={12} />All aircraft</Link>
      <PageHeader title={`${ac.tail} · ${ac.type}`} subtitle={`Base ${ac.base} · ${ac.engine} · ${ac.radar} · last mission: ${ac.last_mission ?? "none"}`}
        right={<StatusBadge s={ac.status} />} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Aircraft health" value={ac.health.toFixed(0)} sub="min component index" />
        <Kpi label="Min safe RUL" value={`${ac.min_rul.toFixed(0)}`} sub={ac.limiting_component} tone={ac.min_rul < 10 ? "bad" : ac.min_rul < 30 ? "warn" : "good"} />
        <Kpi label="Sorties" value={fmt(ac.sorties)} sub={`${ac.sortie_rate}/day planned`} />
        <Kpi label="Flight hours" value={fmt(ac.flight_hours)} />
        <Kpi label="Open WOs" value={ac.open_work_orders} />
      </div>

      <div className="card overflow-x-auto">
        <div className="card-h"><span className="card-t">Component digital twins</span><span className="text-xs text-slate-500">click a row for its OSA-CBM trace</span></div>
        <table className="tbl">
          <thead><tr><th>Component</th><th>Model</th><th>Health</th><th>RUL (sorties) · 90% PI · safety</th><th>~FH</th><th>Act within</th><th>Priority</th><th /></tr></thead>
          <tbody>
            {ac.components.map((c) => (
              <tr key={c.id} onClick={() => setCid(c.id)} className={`cursor-pointer ${sel === c.id ? "bg-sky-500/5" : ""}`}>
                <td><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: healthColor(c.health) }} />
                  <span className={sel === c.id ? "text-sky-200" : ""}>{c.name}</span>{c.alert && <span className="text-[10px] text-amber-300">ALERT</span>}</div></td>
                <td className="text-xs text-slate-400">{c.kind === "engine" ? "ML + CQR" : c.kind === "paris" ? "Physics (Paris law)" : "Trend + bootstrap"}</td>
                <td className="mono">{c.health.toFixed(0)}</td>
                <td><div className="flex items-center gap-2"><RulBar lo={c.rul_lo} hi={c.rul_hi} rul={c.rul} safe={c.rul_safe} max={Math.max(150, c.rul_hi)} />
                  <span className="mono text-xs">{c.rul.toFixed(0)} <span className="text-slate-500">[{c.rul_lo.toFixed(0)}-{c.rul_hi.toFixed(0)}]</span> <span className="text-amber-300">{c.rul_safe.toFixed(0)}</span></span></div></td>
                <td className="mono text-xs">{fmt(c.rul_fh)}</td>
                <td className="mono text-xs">{c.days.toFixed(0)} d</td>
                <td><PriorityBadge p={c.priority} /></td>
                <td>{openFor.has(c.id) ? <span className="text-xs text-sky-300">WO open</span> :
                  <button className="btn py-1 text-xs" onClick={(e) => { e.stopPropagation(); raiseWo(c.id); }}><Wrench size={12} />Raise WO</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {msg && <div className="border-t border-ink-700 px-4 py-2 text-xs text-sky-200">{msg}</div>}
      </div>

      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-200">ISO 13374 / OSA-CBM processing trace{t ? ` · ${t.component.name}` : ""}</h2>
          {t && <span className="text-xs text-slate-500">{t.component.method}</span>}
        </div>
        {trace.error ? <ErrorBox error={trace.error} /> : !t ? <Loading /> : (
          <div className="space-y-5"><OsaCbmPipeline t={t} /><TraceCharts t={t} /></div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Work orders</h2>
          {ac.work_orders.length === 0 ? <div className="text-xs text-slate-500">None</div> : ac.work_orders.map((w) => (
            <div key={w.id} className="mb-1 flex flex-wrap gap-3 rounded bg-ink-850 px-3 py-2 text-xs">
              <span className="mono text-sky-300">{w.id}</span><span>{w.component}</span><span className="text-slate-400">{w.kind}</span>
              <span className="text-slate-400">{w.phase}</span>{w.life_used_pct !== undefined && <span className="text-slate-400">life used {w.life_used_pct}%</span>}
            </div>
          ))}
        </div>
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Technical log</h2>
          <div className="max-h-56 space-y-1 overflow-auto text-xs">
            {ac.tech_log.length === 0 ? <div className="text-slate-500">No entries</div> : ac.tech_log.map((e, i) => (
              <div key={i} className="flex gap-3"><span className="mono shrink-0 text-slate-500">{e.date}</span><span className="shrink-0 text-slate-400">{e.kind}</span><span className="text-slate-300">{e.text}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
