import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ErrorBar, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { Upload } from "lucide-react";
import { api } from "../api";
import { useData } from "../hooks";
import { CHART, ErrorBox, fmt, Kpi, Loading, PageHeader, RulBar, Spinner } from "../components/ui";

type Ingest = Awaited<ReturnType<typeof api.ingest>>;

export default function ModelLab() {
  const { data: m, error } = useData(api.metrics);
  const [res, setRes] = useState<Ingest | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (error) return <ErrorBox error={error} />;
  if (!m) return <Loading />;

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setErr(null);
    try { setRes(await api.ingest(f)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const scatter = m.scatter.map((p) => ({ ...p, err: [p.pred - p.lo, p.hi - p.pred] }));

  return (
    <div className="space-y-5">
      <PageHeader title="Model Lab: Engine RUL Prognostics"
        subtitle="Gradient-boosted regressors on 30-cycle window features (mean, EWM, slope, std of 14 informative sensors), trained on NASA C-MAPSS FD001+FD003, evaluated on the official held-out test units. Conformalized Quantile Regression (CQR) gives calibrated 90% intervals; a q0.30 model provides the safety-biased RUL used for scheduling." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="RMSE (cycles)" value={m.rmse.toFixed(2)} sub={`MAE ${m.mae.toFixed(2)} · ${m.n_test_units} test engines`} />
        <Kpi label="NASA S-score" value={fmt(m.nasa_score, 0)} sub="asymmetric; lower is better" />
        <Kpi label="Late predictions" value={`${m.late_pct.toFixed(0)}%`} tone="warn" sub="point model" />
        <Kpi label="Safety-biased S-score" value={fmt(m.safe_nasa_score, 0)} tone="good" sub={`late ${m.safe_late_pct.toFixed(0)}% · RMSE ${m.safe_rmse.toFixed(1)}`} />
        <Kpi label="90% PI coverage" value={`${m.interval_coverage.toFixed(1)}%`} tone="info" sub={`target 90% · CQR q=${m.cqr_q.toFixed(2)}`} />
        <Kpi label="Mean PI width" value={m.interval_width.toFixed(1)} sub="cycles" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Predicted vs true RUL (held-out test engines, 90% CQR intervals)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
              <XAxis type="number" dataKey="true" name="true RUL" stroke={CHART.axis} fontSize={11} domain={[0, 150]} />
              <YAxis type="number" dataKey="pred" name="predicted" stroke={CHART.axis} fontSize={11} domain={[0, 150]} />
              <ZAxis range={[18, 18]} />
              <Tooltip {...CHART.tooltip} />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 150, y: 150 }]} stroke="#94a3b8" strokeDasharray="4 3" />
              <Scatter data={scatter} fill="#38bdf8"><ErrorBar dataKey="err" direction="y" stroke="#38bdf855" width={0} /></Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-slate-500">Points above the diagonal are late (optimistic) predictions, penalised exponentially by the NASA S-score.</p>
        </div>
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Baselines (NASA S-score, lower is better)</h2>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={m.baselines} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
              <XAxis type="number" stroke={CHART.axis} fontSize={11} scale="log" domain={["auto", "auto"]} />
              <YAxis type="category" dataKey="name" stroke={CHART.axis} fontSize={10} width={180} />
              <Tooltip {...CHART.tooltip} />
              <Bar dataKey="nasa_score" fill="#818cf8" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <table className="tbl mt-2">
            <thead><tr><th>Model</th><th>RMSE</th><th>S-score</th></tr></thead>
            <tbody>{m.baselines.map((b) => <tr key={b.name}><td className="text-xs">{b.name}</td><td className="mono">{b.rmse.toFixed(2)}</td><td className="mono">{fmt(b.nasa_score, 0)}</td></tr>)}
              {Object.entries(m.per_fd).map(([k, v]) => <tr key={k}><td className="text-xs text-slate-400">GBM point on {k}</td><td className="mono">{v.rmse.toFixed(2)}</td><td className="mono">{fmt(v.score, 0)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Sensor importance (permutation ΔRMSE)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={m.sensor_importance} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
              <XAxis type="number" stroke={CHART.axis} fontSize={11} />
              <YAxis type="category" dataKey="tag" stroke={CHART.axis} fontSize={10} width={60} interval={0} />
              <Tooltip {...CHART.tooltip} formatter={(v) => Number(v).toFixed(2)} labelFormatter={(l) => m.sensor_importance.find((s) => s.tag === l)?.name ?? l} />
              <Bar dataKey="delta_rmse" fill="#f472b6" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-200">Score new engine telemetry</h2>
          <p className="mb-3 text-xs text-slate-400">Upload a C-MAPSS format file (unit, cycle, 3 settings, 21 sensors, whitespace separated), e.g. <span className="mono">test_FD001.txt</span>. Each unit's latest window is scored by the deployed model.</p>
          <label className="btn btn-primary cursor-pointer">{busy ? <Spinner /> : <Upload size={14} />}Upload file
            <input type="file" accept=".txt,.csv" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /></label>
          {err && <div className="mt-2"><ErrorBox error={err} /></div>}
          {res && (
            <div className="mt-3 max-h-64 overflow-auto">
              <div className="mb-1 text-xs text-slate-400">{res.filename}: {res.units} units scored</div>
              <table className="tbl"><thead><tr><th>Unit</th><th>Cycle</th><th>RUL · PI · safety</th><th>Values</th></tr></thead>
                <tbody>{res.predictions.map((p) => <tr key={p.unit}><td className="mono">{p.unit}</td><td className="mono">{p.last_cycle}</td>
                  <td><RulBar lo={p.rul_lo} hi={p.rul_hi} rul={p.rul} safe={p.rul_safe} /></td>
                  <td className="mono text-xs">{p.rul.toFixed(0)} [{p.rul_lo.toFixed(0)}-{p.rul_hi.toFixed(0)}] <span className="text-amber-300">{p.rul_safe.toFixed(0)}</span></td></tr>)}</tbody></table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
