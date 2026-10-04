import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Trace } from "../api";
import { CHART } from "./ui";

const BLOCK_COLOR: Record<string, string> = { DA: "#38bdf8", DM: "#818cf8", SD: "#fbbf24", HA: "#fb923c", PA: "#f472b6", AG: "#34d399" };
const ENGINE_SENSORS = [["s4", "T50 LPT outlet temp"], ["s3", "T30 HPC outlet temp"], ["s11", "Ps30 HPC static pressure"], ["s7", "P30 HPC outlet pressure"]];

function val(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "none";
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${x}`).join("  ");
  if (typeof v === "number") return Math.abs(v) < 1e-3 && v !== 0 ? v.toExponential(2) : String(v);
  return String(v);
}

export function OsaCbmPipeline({ t }: { t: Trace }) {
  return (
    <div className="grid gap-2 lg:grid-cols-6">
      {t.blocks.map((b, i) => (
        <div key={b.block} className="relative rounded-lg border bg-ink-850 p-3" style={{ borderColor: `${BLOCK_COLOR[b.block]}55` }}>
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-8 place-items-center rounded text-[11px] font-bold text-ink-950" style={{ background: BLOCK_COLOR[b.block] }}>{b.block}</span>
            <span className="text-xs font-semibold text-slate-200">{i + 1}. {b.name}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">{b.summary}</p>
          <details className="mt-2 text-[11px] text-slate-400">
            <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-300">data</summary>
            <div className="mt-1 max-h-40 space-y-0.5 overflow-auto mono">
              {Object.entries(b.data).map(([k, v]) => <div key={k} className="break-all"><span className="text-slate-500">{k}</span> {val(v)}</div>)}
            </div>
          </details>
        </div>
      ))}
    </div>
  );
}

export function TraceCharts({ t }: { t: Trace }) {
  const kind = t.component.kind;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {kind === "engine" ? "Engine telemetry (raw vs de-spiked)" : kind === "paris" ? "Crack length (mm): SHM reading and Paris-law projection" : "Health indicator: observations and exponential fit"}
        </h3>
        {kind === "engine" ? (
          <div className="grid grid-cols-2 gap-2">
            {ENGINE_SENSORS.map(([s, label]) => (
              <div key={s}>
                <div className="text-[11px] text-slate-500">{label}</div>
                <ResponsiveContainer width="100%" height={110}>
                  <ComposedChart data={t.series}>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="t" stroke={CHART.axis} fontSize={10} />
                    <YAxis stroke={CHART.axis} fontSize={10} domain={["auto", "auto"]} width={48} />
                    <Tooltip {...CHART.tooltip} />
                    <Line dataKey={`${s}_raw`} stroke="#475569" dot={false} strokeWidth={1} isAnimationActive={false} name="raw" />
                    <Line dataKey={s} stroke="#38bdf8" dot={false} strokeWidth={1.5} isAnimationActive={false} name="filtered" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={t.series}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} stroke={CHART.axis} fontSize={11} />
              <YAxis stroke={CHART.axis} fontSize={11} domain={["auto", "auto"]} width={48} />
              <Tooltip {...CHART.tooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="obs" name="observed" stroke="#38bdf8" dot={false} strokeWidth={1} isAnimationActive={false} connectNulls />
              <Line dataKey="fit" name="model / projection" stroke="#f472b6" dot={false} strokeDasharray="5 3" isAnimationActive={false} connectNulls />
              <Line dataKey={kind === "paris" ? "critical" : "threshold"} name="failure limit" stroke="#fb7185" dot={false} isAnimationActive={false} />
              <ReferenceLine x={t.component.age} stroke="#94a3b8" strokeDasharray="2 2" label={{ value: "now", fill: "#94a3b8", fontSize: 10 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">RUL prediction history with 90% conformal interval</h3>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={t.prediction_history.map((h) => ({ ...h, band: [h.rul_lo, h.rul_hi] }))}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
            <XAxis dataKey="age" stroke={CHART.axis} fontSize={11} />
            <YAxis stroke={CHART.axis} fontSize={11} width={40} />
            <Tooltip {...CHART.tooltip} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area dataKey="band" name="90% interval" stroke="none" fill="#38bdf833" isAnimationActive={false} />
            <Line dataKey="rul" name="predicted RUL" stroke="#38bdf8" dot={false} isAnimationActive={false} />
            <Line dataKey="rul_safe" name="safety-biased" stroke="#fbbf24" dot={false} isAnimationActive={false} />
            <Line dataKey="true_rul" name="simulated ground truth" stroke="#94a3b8" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
