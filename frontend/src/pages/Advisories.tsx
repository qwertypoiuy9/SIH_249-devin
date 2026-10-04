import { useState } from "react";
import { Link } from "react-router-dom";
import { Wrench } from "lucide-react";
import { api, type WorkOrder } from "../api";
import { useData, useSim } from "../hooks";
import { Badge, ErrorBox, Loading, PageHeader, PriorityBadge, RulBar } from "../components/ui";

const PHASE: Record<WorkOrder["phase"], string> = {
  awaiting_parts: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  in_work: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  done: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

export default function Advisories() {
  const { refresh } = useSim();
  const adv = useData(api.advisories);
  const wos = useData(api.workOrders);
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM">("ALL");
  const [msg, setMsg] = useState<string | null>(null);

  const raise = async (tail: string, cid: string) => {
    try { const wo = await api.createWorkOrder(tail, cid); setMsg(`${wo.id} raised for ${tail}; spare from ${wo.source}, ETA ${wo.parts_eta_date}`); await refresh(); }
    catch (e) { setMsg((e as Error).message); }
  };
  const list = adv.data?.filter((a) => filter === "ALL" || a.priority === filter) ?? [];
  const open = wos.data?.filter((w) => w.phase !== "done") ?? [];
  const done = wos.data?.filter((w) => w.phase === "done") ?? [];

  return (
    <div className="space-y-5">
      <PageHeader title="Advisory Generation & Work Orders"
        subtitle="OSA-CBM advisory block output. Priorities are driven by the safety-biased RUL (lower conformal quantile) against spare lead time, and only multi-sensor corroborated anomalies are raised, to limit alarm fatigue. Raising a work order reserves a spare from the nearest echelon (ERP) and books an MRO slot." />
      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "CRITICAL", "HIGH", "MEDIUM"] as const).map((f) => (
          <button key={f} className={`btn ${filter === f ? "btn-primary" : ""}`} onClick={() => setFilter(f)}>
            {f} {adv.data && <span className="mono text-xs opacity-70">{f === "ALL" ? adv.data.length : adv.data.filter((a) => a.priority === f).length}</span>}
          </button>
        ))}
        {msg && <span className="ml-2 text-xs text-sky-200">{msg}</span>}
      </div>
      {adv.error ? <ErrorBox error={adv.error} /> : !adv.data ? <Loading /> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Priority</th><th>Tail</th><th>Base</th><th>Component</th><th>RUL · 90% PI · safety</th><th>Act by</th><th>Recommended action</th><th>Spare</th><th /></tr></thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td><PriorityBadge p={a.priority} /></td>
                  <td><Link to={`/aircraft/${a.tail}`} className="mono text-sky-300 hover:underline">{a.tail}</Link><div className="text-[11px] text-slate-500">{a.type}</div></td>
                  <td>{a.base}</td>
                  <td className="max-w-[200px] truncate" title={a.component}>{a.component}</td>
                  <td><div className="flex items-center gap-2"><RulBar lo={a.rul_lo} hi={a.rul_hi} rul={a.rul} safe={a.rul_safe} max={Math.max(120, a.rul_hi)} />
                    <span className="mono text-xs">{a.rul.toFixed(0)} <span className="text-amber-300">{a.rul_safe.toFixed(0)}</span></span></div></td>
                  <td className="mono text-xs">{a.action_by}<div className="text-slate-500">{a.days_to_action.toFixed(0)} d</div></td>
                  <td className="max-w-[260px] truncate text-xs text-slate-300" title={a.action}>{a.action}</td>
                  <td className="text-xs"><span className="mono">{a.source}</span> · {a.lead_days}d{a.supply_risk && <Badge className="ml-1 border-rose-500/40 text-rose-300">RISK</Badge>}</td>
                  <td>{a.work_order ? <span className="mono text-xs text-sky-300">{a.work_order}</span> :
                    <button className="btn py-1 text-xs" onClick={() => raise(a.tail, a.component_id)}><Wrench size={12} />Raise WO</button>}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-slate-500">No advisories in this category</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <WoTable title={`Open work orders (${open.length})`} rows={open} />
        <WoTable title={`Completed (${done.length})`} rows={done.slice(0, 30)} />
      </div>
    </div>
  );
}

function WoTable({ title, rows }: { title: string; rows: WorkOrder[] }) {
  return (
    <div className="card overflow-x-auto">
      <div className="card-h"><span className="card-t">{title}</span></div>
      <table className="tbl">
        <thead><tr><th>WO</th><th>Tail</th><th>Component</th><th>Type</th><th>Phase</th><th>Parts</th><th>Life used</th></tr></thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.id}>
              <td className="mono text-xs text-sky-300">{w.id}</td>
              <td><Link to={`/aircraft/${w.tail}`} className="mono text-sky-300 hover:underline">{w.tail}</Link></td>
              <td className="max-w-[180px] truncate text-xs">{w.component}</td>
              <td><Badge className={w.kind === "unscheduled" ? "border-rose-500/40 text-rose-300" : "border-emerald-500/40 text-emerald-300"}>{w.kind}</Badge></td>
              <td><Badge className={PHASE[w.phase]}>{w.phase.replace("_", " ")}</Badge></td>
              <td className="mono text-xs">{w.source} · {w.parts_eta_date}</td>
              <td className="mono text-xs">{w.life_used_pct !== undefined ? `${w.life_used_pct}%` : "-"}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-slate-500">None</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
