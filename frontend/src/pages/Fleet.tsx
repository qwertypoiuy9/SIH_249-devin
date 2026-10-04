import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AircraftRow, type Status } from "../api";
import { useData } from "../hooks";
import { ErrorBox, fmt, HealthBar, Loading, PageHeader, StatusBadge } from "../components/ui";

type Key = keyof AircraftRow;

export default function Fleet() {
  const { data, error } = useData(api.aircraft);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status | "ALL">("ALL");
  const [sort, setSort] = useState<{ k: Key; asc: boolean }>({ k: "min_rul", asc: true });

  const rows = useMemo(() => {
    if (!data) return [];
    const f = data.filter((a) => (status === "ALL" || a.status === status) &&
      `${a.tail} ${a.type} ${a.base} ${a.limiting_component}`.toLowerCase().includes(q.toLowerCase()));
    return [...f].sort((a, b) => {
      const x = a[sort.k], y = b[sort.k];
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.asc ? c : -c;
    });
  }, [data, q, status, sort]);

  const th = (k: Key, label: string) => (
    <th className="cursor-pointer select-none hover:text-slate-200" onClick={() => setSort((s) => ({ k, asc: s.k === k ? !s.asc : true }))}>
      {label}{sort.k === k ? (sort.asc ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div>
      <PageHeader title="Aircraft Digital Twins"
        subtitle="Every tail number has a live twin: engines driven by NASA C-MAPSS telemetry and an ML RUL model, subsystems by health-indicator trend models, and the wing-root structure by a Paris-law crack-growth model." />
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="input w-64" placeholder="Search tail, type, base, component" value={q} onChange={(e) => setQ(e.target.value)} />
        {(["ALL", "FMC", "FMC-WATCH", "NMC-MAINT", "NMC-AOG"] as const).map((s) => (
          <button key={s} className={`btn ${status === s ? "btn-primary" : ""}`} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>
      {error ? <ErrorBox error={error} /> : !data ? <Loading /> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr>
              {th("tail", "Tail")}{th("type", "Type")}{th("base", "Base")}{th("status", "Status")}{th("health", "Health")}
              {th("min_rul", "Min safe RUL")}{th("limiting_component", "Limiting component")}{th("sorties", "Sorties")}{th("flight_hours", "FH")}{th("open_work_orders", "WOs")}
            </tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.tail}>
                  <td><Link to={`/aircraft/${a.tail}`} className="mono font-semibold text-sky-300 hover:underline">{a.tail}</Link></td>
                  <td>{a.type}</td><td>{a.base}</td><td><StatusBadge s={a.status} /></td>
                  <td><HealthBar value={a.health} /></td>
                  <td className={`mono ${a.min_rul < 10 ? "text-rose-300" : a.min_rul < 30 ? "text-amber-300" : ""}`}>{a.min_rul.toFixed(0)} sorties</td>
                  <td className="text-slate-300">{a.limiting_component}</td>
                  <td className="mono">{fmt(a.sorties)}</td><td className="mono">{fmt(a.flight_hours)}</td><td className="mono">{a.open_work_orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
