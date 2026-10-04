import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import clsx from "clsx";
import { Activity, Boxes, Cpu, FlaskConical, Gauge, LayoutDashboard, Network, Plane, RotateCcw, Scale, Siren, FastForward } from "lucide-react";
import { api } from "../api";
import { useSim } from "../hooks";
import { Spinner } from "./ui";

const NAV = [
  { to: "/", label: "Fleet Overview", icon: LayoutDashboard },
  { to: "/fleet", label: "Digital Twins", icon: Plane },
  { to: "/advisories", label: "Advisories & WOs", icon: Siren },
  { to: "/logistics", label: "Spares & MEIO", icon: Boxes },
  { to: "/strategy", label: "Strategy Compare", icon: Scale },
  { to: "/model", label: "Model Lab", icon: FlaskConical },
  { to: "/architecture", label: "Architecture", icon: Network },
];

export default function Layout() {
  const { summary, setSummary, refresh } = useSim();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setErr(null);
    try { const r = await fn(); if (r && typeof r === "object" && "ao" in r) setSummary(r as never); else await refresh(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-900 md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 text-sky-300"><Gauge size={20} /></div>
          <div>
            <div className="text-sm font-bold tracking-widest text-slate-100">VAYU-RAKSHA</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">PdM & Fleet Availability</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => clsx(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
              isActive ? "bg-sky-500/10 text-sky-200" : "text-slate-400 hover:bg-ink-800 hover:text-slate-200")}>
              <Icon size={16} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="m-3 rounded-lg border border-ink-700 p-3 text-[11px] leading-relaxed text-slate-500">
          <div className="mb-1 flex items-center gap-1 text-slate-400"><Cpu size={12} /> ISO 13374 / OSA-CBM</div>
          Prototype on NASA C-MAPSS + simulated fleet data. Not operational data.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-ink-700 bg-ink-950/90 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-2 text-sm">
            <Activity size={16} className="text-emerald-400" />
            <span className="text-slate-400">Sim clock</span>
            <span className="mono text-slate-100" data-testid="sim-date">{summary ? `${summary.date} (D+${summary.day})` : "..."}</span>
          </div>
          {summary && (
            <div className="hidden items-center gap-2 text-sm lg:flex">
              <span className="text-slate-500">|</span><span className="text-slate-400">Ao</span>
              <span className={clsx("mono font-semibold", summary.ao >= 85 ? "text-emerald-300" : summary.ao >= 70 ? "text-amber-300" : "text-rose-300")}>{summary.ao.toFixed(0)}%</span>
            </div>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {busy && <span className="flex items-center gap-2 text-xs text-slate-400"><Spinner />{busy}</span>}
            {err && <span className="text-xs text-rose-300">{err}</span>}
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300" title="Automatically raise work orders when the safety-biased RUL approaches spare lead time">
              <input type="checkbox" className="accent-sky-500" checked={summary?.settings.auto_schedule ?? false} disabled={!!busy}
                onChange={(e) => run("Updating", () => api.settings({ auto_schedule: e.target.checked }))} />
              Auto-schedule (PdM)
            </label>
            {[1, 7, 30].map((d) => (
              <button key={d} className="btn" disabled={!!busy} onClick={() => run(`Simulating ${d}d`, () => api.advance(d))}>
                <FastForward size={14} />+{d}d
              </button>
            ))}
            <button className="btn btn-ghost" disabled={!!busy} onClick={() => run("Resetting", () => api.reset())} title="Reset simulation"><RotateCcw size={14} /></button>
          </div>
        </header>
        <main className="flex-1 p-6"><Outlet /></main>
      </div>
    </div>
  );
}
