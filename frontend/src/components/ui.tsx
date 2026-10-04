import clsx from "clsx";
import type { ReactNode } from "react";
import type { Priority, Status } from "../api";

export const STATUS_STYLE: Record<Status, string> = {
  FMC: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "FMC-WATCH": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "NMC-MAINT": "bg-sky-500/15 text-sky-300 border-sky-500/30",
  "NMC-AOG": "bg-rose-500/15 text-rose-300 border-rose-500/30",
};
export const STATUS_COLOR: Record<Status, string> = { FMC: "#34d399", "FMC-WATCH": "#fbbf24", "NMC-MAINT": "#38bdf8", "NMC-AOG": "#fb7185" };
const PRIORITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  HIGH: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  MEDIUM: "bg-yellow-500/10 text-yellow-200 border-yellow-500/30",
};

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={clsx("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide", className)}>{children}</span>;
}
export const StatusBadge = ({ s }: { s: Status }) => <Badge className={STATUS_STYLE[s]}>{s}</Badge>;
export const PriorityBadge = ({ p }: { p: Priority }) =>
  p ? <Badge className={PRIORITY_STYLE[p]}>{p}</Badge> : <span className="text-xs text-slate-500">-</span>;

export function Kpi({ label, value, sub, tone = "default", icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "default" | "good" | "warn" | "bad" | "info"; icon?: ReactNode }) {
  const toneCls = { default: "text-slate-100", good: "text-emerald-300", warn: "text-amber-300", bad: "text-rose-300", info: "text-sky-300" }[tone];
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">{label}{icon}</div>
      <div className={clsx("mt-1 text-2xl font-semibold mono", toneCls)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function healthColor(h: number) {
  return h >= 70 ? "#34d399" : h >= 40 ? "#fbbf24" : h >= 20 ? "#fb923c" : "#fb7185";
}
export function HealthBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded bg-ink-700 overflow-hidden">
        <div className="h-full rounded" style={{ width: `${Math.max(2, value)}%`, background: healthColor(value) }} />
      </div>
      <span className="mono text-xs text-slate-300 w-8">{value.toFixed(0)}</span>
    </div>
  );
}

/** Horizontal RUL interval: 90% prediction interval band, point estimate, safety-biased marker. */
export function RulBar({ lo, hi, rul, safe, max = 150, truth }: { lo: number; hi: number; rul: number; safe: number; max?: number; truth?: number }) {
  const pct = (v: number) => `${Math.min(100, (Math.max(0, v) / max) * 100)}%`;
  return (
    <div className="relative h-4 w-44 rounded bg-ink-800" title={`90% PI ${lo}-${hi}, point ${rul}, safety-biased ${safe}`}>
      <div className="absolute top-1 h-2 rounded bg-sky-500/30" style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }} />
      <div className="absolute top-0 h-4 w-0.5 bg-sky-300" style={{ left: pct(rul) }} />
      <div className="absolute top-0.5 h-3 w-0.5 bg-amber-400" style={{ left: pct(safe) }} />
      {truth !== undefined && <div className="absolute -top-0.5 h-5 w-px bg-white/40" style={{ left: pct(truth) }} />}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <div className={clsx("h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-sky-400", className)} />;
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return <div className="flex items-center gap-2 p-8 text-slate-400"><Spinner />{label}...</div>;
}

export function ErrorBox({ error }: { error: string }) {
  return <div className="card border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>;
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-50">{title}</h1>
        {subtitle && <p className="mt-1 max-w-4xl text-sm text-slate-400">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export const fmt = (n: number | null | undefined, d = 0) => (n === null || n === undefined ? "-" : n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }));

export const CHART = {
  grid: "#1c2940",
  axis: "#64748b",
  tooltip: { contentStyle: { background: "#0b111c", border: "1px solid #2a3a57", borderRadius: 8, fontSize: 12 }, labelStyle: { color: "#cbd5e1" } },
};
