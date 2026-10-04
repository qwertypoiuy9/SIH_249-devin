import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Play } from "lucide-react";
import { api, type Strategy as S } from "../api";
import { CHART, ErrorBox, fmt, PageHeader, Spinner } from "../components/ui";

const POL = { reactive: { label: "Reactive (run-to-failure)", color: "#fb7185" }, preventive: { label: "Preventive (hard-time)", color: "#fbbf24" }, predictive: { label: "Predictive (AI RUL)", color: "#34d399" } } as const;
type P = keyof typeof POL;

export default function Strategy() {
  const [form, setForm] = useState({ days: 365, n_aircraft: 24, sortie_rate: 1.2, threshold: 15 });
  const [data, setData] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setErr(null);
    try { setData(await api.strategy(new URLSearchParams(Object.entries(form).map(([k, v]) => [k, String(v)])).toString())); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  const field = (k: keyof typeof form, label: string, step = 1) => (
    <label className="text-xs text-slate-400">{label}
      <input type="number" step={step} className="input mt-1 block w-32" value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} />
    </label>
  );
  const pols = Object.keys(POL) as P[];
  const bars = data ? [
    { metric: "Ao %", ...Object.fromEntries(pols.map((p) => [p, data.policies[p].ao])) },
    { metric: "Life used %", ...Object.fromEntries(pols.map((p) => [p, data.policies[p].life_used_pct ?? 0])) },
    { metric: "Cost index", ...Object.fromEntries(pols.map((p) => [p, data.policies[p].cost_index])) },
  ] : [];

  return (
    <div className="space-y-5">
      <PageHeader title="Maintenance Strategy Comparison"
        subtitle="Monte Carlo fleet simulation with common random numbers. Component lives are drawn from the NASA C-MAPSS run-to-failure distribution; the predictive policy acts on the RUL model's real held-out prediction errors. Outputs are simulation estimates for comparison, not operational claims." />
      <div className="card flex flex-wrap items-end gap-4 p-4">
        {field("days", "Horizon (days)")}{field("n_aircraft", "Aircraft")}{field("sortie_rate", "Sorties / aircraft / day", 0.1)}{field("threshold", "PdM RUL threshold (sorties)")}
        <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? <Spinner /> : <Play size={14} />}Run simulation</button>
      </div>
      {err && <ErrorBox error={err} />}
      {!data && !busy && <div className="card p-8 text-center text-sm text-slate-500">Set parameters and run the simulation.</div>}
      {data && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {pols.map((p) => {
              const r = data.policies[p];
              return (
                <div key={p} className="card p-4" style={{ borderColor: `${POL[p].color}55` }}>
                  <div className="text-sm font-semibold" style={{ color: POL[p].color }}>{POL[p].label}</div>
                  <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs">
                    <span className="text-slate-400">Availability</span><span className="mono text-right text-lg text-slate-100">{r.ao}%</span>
                    <span className="text-slate-400">Unscheduled failures</span><span className="mono text-right">{fmt(r.unscheduled_failures, 1)}</span>
                    <span className="text-slate-400">Removals</span><span className="mono text-right">{fmt(r.removals, 1)}</span>
                    <span className="text-slate-400">Avg life used</span><span className="mono text-right">{r.life_used_pct ?? "-"}%</span>
                    <span className="text-slate-400">Downtime (aircraft-days)</span><span className="mono text-right">{fmt(r.downtime_days, 0)}</span>
                    <span className="text-slate-400">Cost index (preventive = 100)</span><span className="mono text-right">{r.cost_index}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="card p-4 xl:col-span-2">
              <h2 className="mb-2 text-sm font-semibold text-slate-200">Fleet availability over time</h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.series}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} />
                  <YAxis stroke={CHART.axis} fontSize={11} domain={["auto", 100]} unit="%" />
                  <Tooltip {...CHART.tooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {pols.map((p) => <Line key={p} dataKey={p} name={POL[p].label} stroke={POL[p].color} dot={false} strokeWidth={1.5} isAnimationActive={false} />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-200">Key metrics</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={bars}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="metric" stroke={CHART.axis} fontSize={11} />
                  <YAxis stroke={CHART.axis} fontSize={11} />
                  <Tooltip {...CHART.tooltip} />
                  {pols.map((p) => <Bar key={p} dataKey={p} name={POL[p].label} fill={POL[p].color} radius={[3, 3, 0, 0]} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card p-4 text-xs text-slate-400">
            <h2 className="mb-2 text-sm font-semibold text-slate-200">Assumptions</h2>
            <ul className="list-disc space-y-1 pl-5">{Object.entries(data.assumptions).map(([k, v]) => <li key={k}><span className="text-slate-300">{k.replace(/_/g, " ")}:</span> {v}</li>)}</ul>
          </div>
        </>
      )}
    </div>
  );
}
