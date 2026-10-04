import { useState } from "react";
import { Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { api } from "../api";
import { useData, useSim } from "../hooks";
import { Badge, ErrorBox, Loading, PageHeader } from "../components/ui";

const ECH: Record<string, string> = { base: "Base", regional: "Regional depot", central: "Central depot" };

export default function Logistics() {
  const { refresh } = useSim();
  const { data: inv, error } = useData(api.inventory);
  const [msg, setMsg] = useState<string | null>(null);
  if (error) return <ErrorBox error={error} />;
  if (!inv) return <Loading />;

  const move = async (sku: string, src: string, dst: string) => {
    try { await api.transfer(sku, src, dst); setMsg(`Transfer of ${sku} ${src} -> ${dst} dispatched`); await refresh(); }
    catch (e) { setMsg((e as Error).message); }
  };
  const skus = inv.skus.length ? inv.skus : Object.keys(inv.stock[0]?.items ?? {}).slice(0, 8);
  const all = Object.keys(inv.stock[0]?.items ?? {});

  return (
    <div className="space-y-5">
      <PageHeader title="Spares & Multi-Echelon Inventory Optimisation"
        subtitle={`Prognostic demand (probability each component needs replacement within ${inv.horizon_days} days, from the RUL distribution) is netted against stock at base, regional and central echelons (IMMOLS-style ERP). Shortfalls are routed from the nearest echelon with stock so the spare lands before the predicted maintenance window.`} />
      {msg && <div className="text-xs text-sky-200">{msg}</div>}

      <div className="card overflow-x-auto">
        <div className="card-h"><span className="card-t">MEIO recommendations</span><span className="text-xs text-slate-500">horizon {inv.horizon_days} days</span></div>
        <table className="tbl">
          <thead><tr><th>Status</th><th>Base</th><th>SKU</th><th>Expected demand</th><th>On hand</th><th>Shortfall</th><th>Source</th><th>Lead</th><th>Need by</th><th>Slack</th><th>Driving tails</th><th /></tr></thead>
          <tbody>
            {inv.recommendations.map((r, i) => (
              <tr key={i}>
                <td><Badge className={r.status === "AT-RISK" ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}>{r.status}</Badge></td>
                <td>{r.base}</td><td className="mono text-xs">{r.sku}</td>
                <td className="mono">{r.expected_demand.toFixed(2)}</td><td className="mono">{r.on_hand}</td><td className="mono text-amber-300">{r.shortfall}</td>
                <td className="mono">{r.source}</td><td className="mono">{r.lead_days} d</td><td className="mono text-xs">{r.need_by}</td>
                <td className={`mono ${r.slack_days < 0 ? "text-rose-300" : ""}`}>{r.slack_days} d</td>
                <td className="text-xs">{r.tails.map((t) => <Link key={t} to={`/aircraft/${t}`} className="mr-1 mono text-sky-300 hover:underline">{t}</Link>)}</td>
                <td>{r.can_transfer && r.source !== "OEM" ? <button className="btn py-1 text-xs" onClick={() => move(r.sku, r.source, r.base)}><Truck size={12} />Pre-position</button> : <span className="text-xs text-slate-500">procure</span>}</td>
              </tr>
            ))}
            {inv.recommendations.length === 0 && <tr><td colSpan={12} className="py-6 text-center text-slate-500">No projected shortfalls in the horizon</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <div className="card-h"><span className="card-t">Stock by echelon</span><span className="text-xs text-slate-500">{all.length} SKUs · showing SKUs with demand first</span></div>
        <table className="tbl">
          <thead><tr><th>Location</th><th>Echelon</th>{[...skus, ...all.filter((s) => !skus.includes(s))].slice(0, 12).map((s) => <th key={s} className="!text-[10px]">{s}</th>)}</tr></thead>
          <tbody>
            {inv.stock.map((l) => (
              <tr key={l.id}>
                <td><span className="mono text-sky-300">{l.id}</span> <span className="text-xs text-slate-500">{l.name}</span></td>
                <td className="text-xs text-slate-400">{ECH[l.echelon] ?? l.echelon}</td>
                {[...skus, ...all.filter((s) => !skus.includes(s))].slice(0, 12).map((s) => {
                  const v = l.items[s] ?? 0;
                  return <td key={s} className={`mono text-center ${v === 0 ? "text-slate-600" : v < 2 ? "text-amber-300" : "text-emerald-300"}`}>{v}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={`Predicted demand (${inv.needs.length})`}>
          {inv.needs.slice(0, 20).map((n, i) => (
            <Row key={i}><Link to={`/aircraft/${n.tail}`} className="mono text-sky-300">{n.tail}</Link><span className="truncate">{n.component}</span><span className="ml-auto mono">p={n.p_need.toFixed(2)}</span><span className="mono text-slate-500">D{n.need_by_day}</span></Row>
          ))}
        </Panel>
        <Panel title={`Transfers in transit (${inv.transfers.length})`}>
          {inv.transfers.map((t, i) => <Row key={i}><span className="mono">{t.sku}</span><span>{t.from} → {t.to}</span><span className="ml-auto mono text-slate-400">ETA {t.eta_date}</span></Row>)}
        </Panel>
        <Panel title={`MRO repair pipeline (${inv.repair_pipeline.length})`}>
          {inv.repair_pipeline.map((r, i) => <Row key={i}><span className="mono">{r.sku}</span><span className="text-slate-400">from {r.from_tail}</span><span className="ml-auto mono text-slate-400">to {r.to} D{r.ready_day}</span></Row>)}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4"><h2 className="mb-2 text-sm font-semibold text-slate-200">{title}</h2>
      <div className="max-h-64 space-y-1 overflow-auto text-xs">{children}</div></div>
  );
}
const Row = ({ children }: { children: React.ReactNode }) => <div className="flex items-center gap-3 rounded bg-ink-850 px-2 py-1.5">{children}</div>;
