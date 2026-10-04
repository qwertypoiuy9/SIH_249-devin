import { Database, Lock, Radio, Server, Workflow } from "lucide-react";
import { api } from "../api";
import { useData } from "../hooks";
import { fmt, Kpi, Loading, PageHeader } from "../components/ui";

const LAYERS = [
  { icon: Radio, title: "Edge: Aircraft Interface Device", items: ["MIL-STD-1553 / ARINC 429 bus tap", "On-board DA + DM + SD (de-spiking, window features, 3σ corroboration)", "Transmits compact health metadata, not raw waveforms (EMCON friendly)", "Target: DO-178C / DO-326A"] },
  { icon: Lock, title: "Cross-domain & Zero Trust", items: ["One-way diode from classified flight network", "Identity + device + app verification on every call", "Micro-segmented services, MFA, signed model artefacts", "Air-gap capable deployment"] },
  { icon: Database, title: "Data lakehouse (open formats)", items: ["Telemetry, tech log (e-MMS), ERP (IMMOLS), MRO in one governed store", "Open table format (Iceberg/Delta) - no vendor lock-in", "Domain-owned data products (data mesh)", "Prototype: in-memory twin store"] },
  { icon: Workflow, title: "Analytics: OSA-CBM (ISO 13374)", items: ["HA: diagnosis + health index", "PA: ML (C-MAPSS GBM + CQR), trend, physics (Paris law)", "AG: safety-biased priority vs spare lead time", "Plug-and-play models via standard block interfaces"] },
  { icon: Server, title: "Decision support & logistics", items: ["Fleet Ao / SGR dashboard", "Work orders, MRO slots, auto-scheduling", "MEIO: prognostic demand -> pre-positioning", "Human-in-the-loop approval of every action"] },
];

export default function Architecture() {
  const { data } = useData(api.integration);
  return (
    <div className="space-y-5">
      <PageHeader title="Integrated Platform Architecture"
        subtitle="Open, standards-based architecture designed to avoid the monolithic vendor lock-in seen with ALIS: each OSA-CBM block is a replaceable service, and all four maintenance data silos feed one analytics layer." />
      <div className="grid gap-3 lg:grid-cols-5">
        {LAYERS.map(({ icon: Icon, title, items }, i) => (
          <div key={title} className="card p-4">
            <div className="mb-2 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded bg-sky-500/15 text-sky-300"><Icon size={15} /></span>
              <span className="text-[11px] text-slate-500">L{i + 1}</span></div>
            <div className="text-sm font-semibold text-slate-100">{title}</div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-400">{items.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        ))}
      </div>

      {!data ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Raw telemetry / sortie" value={`${data.edge.raw_mb_per_sortie} MB`} sub="high-rate vibration + engine params" />
            <Kpi label="Edge metadata / sortie" value={`${data.edge.edge_kb_per_sortie} KB`} tone="good" sub="health features + alerts" />
            <Kpi label="Bandwidth reduction" value={`${data.edge.reduction_pct.toFixed(3)}%`} tone="info" />
            <Kpi label="Fleet to date" value={`${fmt(data.edge.raw_gb_total, 1)} GB → ${fmt(data.edge.edge_mb_total, 2)} MB`} sub="raw vs transmitted" />
          </div>
          <div className="card overflow-x-auto">
            <div className="card-h"><span className="card-t">Integrated data sources (live counts from the twin)</span></div>
            <table className="tbl">
              <thead><tr><th>Source</th><th>Domain</th><th>Records</th><th>Detail</th></tr></thead>
              <tbody>{data.sources.map((s) => <tr key={s.name}><td>{s.name}</td><td className="text-slate-400">{s.domain}</td><td className="mono">{fmt(s.records)}</td><td className="text-xs text-slate-400">{s.detail}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}

      <div className="card p-4 text-xs text-slate-400">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Alarm-fatigue controls</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>State detection requires at least 3 corroborating sensors beyond 3σ of the healthy baseline; single-sensor spikes are logged as suppressed transients.</li>
          <li>Median de-spiking before feature extraction removes impulsive sensor noise.</li>
          <li>Advisories carry calibrated CQR intervals and failure probabilities, so commanders weigh risk rather than binary alarms.</li>
          <li>Priority uses the safety-biased RUL and spare lead time, so actions are raised only when they matter for availability.</li>
        </ul>
      </div>
    </div>
  );
}
