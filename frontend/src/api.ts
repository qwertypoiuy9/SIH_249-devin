export type Status = "FMC" | "FMC-WATCH" | "NMC-MAINT" | "NMC-AOG";
export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | null;

export interface HistoryPoint { day: number; date: string; ao: number; fmc: number; nmc_maint: number; nmc_aog: number; sorties: number; unscheduled: number; scheduled: number }
export interface Group { name: string; total: number; fmc: number; ao: number }
export interface Summary {
  day: number; date: string; aircraft: number; ao: number; ao_avg: number | null;
  by_status: Record<Status, number>; by_base: Group[]; by_type: Group[];
  sorties_total: number; flight_hours_total: number; unscheduled_failures: number; scheduled_removals: number;
  alerts_corroborated: number; alerts_suppressed: number; life_used_avg_pct: number | null;
  advisories: Record<"CRITICAL" | "HIGH" | "MEDIUM", number>; supply_risk: number; open_work_orders: number;
  sgr: number | null; history: HistoryPoint[]; settings: { auto_schedule: boolean; planning_horizon_days: number };
}
export interface AircraftRow {
  tail: string; type: string; base: string; status: Status; health: number; min_rul: number; limiting_component: string;
  sorties: number; flight_hours: number; sortie_rate: number; open_work_orders: number; engine: string; radar: string;
}
export interface ComponentRow {
  id: string; name: string; kind: "engine" | "trend" | "paris"; sku: string; age: number; installs: number; health: number;
  priority: Priority; rul: number; rul_lo: number; rul_hi: number; rul_safe: number; rul_fh: number; days: number;
  true_rul: number; alert: boolean; method: string;
}
export interface WorkOrder {
  id: string; tail: string; base: string; type: string; component_id: string; component: string; sku: string;
  kind: "scheduled" | "unscheduled"; created_date: string; source: string; lead_days: number; parts_eta_date: string;
  phase: "awaiting_parts" | "in_work" | "done"; work_days: number; completed_date?: string; life_used_pct?: number;
  rul_at_creation: number; action: string;
}
export interface LogEvent { day: number; date: string; kind: string; text: string; tail: string | null; severity: string }
export interface AircraftDetail extends AircraftRow { components: ComponentRow[]; work_orders: WorkOrder[]; tech_log: LogEvent[]; last_mission: string | null }
export interface Advisory {
  id: string; tail: string; type: string; base: string; component_id: string; component: string; method: string;
  priority: Exclude<Priority, null>; rul: number; rul_lo: number; rul_hi: number; rul_safe: number; days_to_action: number;
  action_by: string; action: string; sku: string; source: string; lead_days: number; supply_risk: boolean;
  work_order: string | null; true_rul: number;
}
export interface Block { block: string; name: string; summary: string; data: Record<string, unknown> }
export interface Trace {
  tail: string; component: ComponentRow; blocks: Block[]; series: Record<string, number | null>[];
  prediction_history: { age: number; rul: number; rul_lo: number; rul_hi: number; rul_safe: number; true_rul: number }[];
}
export interface Recommendation {
  base: string; sku: string; expected_demand: number; on_hand: number; shortfall: number; source: string; lead_days: number;
  need_by: string; slack_days: number; status: "ON-TIME" | "AT-RISK"; can_transfer: boolean; tails: string[];
}
export interface Inventory {
  horizon_days: number; skus: string[];
  stock: { id: string; name: string; echelon: string; items: Record<string, number> }[];
  recommendations: Recommendation[];
  needs: { tail: string; base: string; sku: string; component: string; p_need: number; need_by_day: number }[];
  transfers: { sku: string; from: string; to: string; eta_date: string }[];
  repair_pipeline: { sku: string; to: string; ready_day: number; from_tail: string }[];
  awaiting_parts: WorkOrder[];
}
export interface ModelMetrics {
  n_test_units: number; rmse: number; mae: number; nasa_score: number; late_pct: number; safe_rmse: number;
  safe_nasa_score: number; safe_late_pct: number; interval_coverage: number; interval_width: number; cqr_q: number;
  per_fd: Record<string, { rmse: number; score: number }>;
  baselines: { name: string; rmse: number; nasa_score: number }[];
  scatter: { true: number; pred: number; lo: number; hi: number }[];
  sensor_importance: { sensor: string; tag: string; name: string; delta_rmse: number }[];
}
export interface PolicyResult { ao: number; unscheduled_failures: number; removals: number; life_used_pct: number | null; downtime_days: number; cost_index: number }
export interface Strategy {
  days: number; n_aircraft: number; sortie_rate: number; reps: number;
  policies: Record<"reactive" | "preventive" | "predictive", PolicyResult>;
  series: { day: number; reactive: number; preventive: number; predictive: number }[];
  assumptions: Record<string, string>;
}
export interface Integration {
  sources: { name: string; domain: string; records: number; detail: string }[];
  edge: { raw_mb_per_sortie: number; edge_kb_per_sortie: number; reduction_pct: number; raw_gb_total: number; edge_mb_total: number };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined, ...init });
  if (!r.ok) {
    const t = await r.text();
    let msg = t;
    try { msg = JSON.parse(t).detail ?? t; } catch { /* plain text */ }
    throw new Error(msg || r.statusText);
  }
  return r.json() as Promise<T>;
}

export const api = {
  summary: () => req<Summary>("/api/summary"),
  aircraft: () => req<AircraftRow[]>("/api/aircraft"),
  aircraftDetail: (tail: string) => req<AircraftDetail>(`/api/aircraft/${tail}`),
  trace: (tail: string, cid: string) => req<Trace>(`/api/aircraft/${tail}/components/${cid}`),
  advisories: () => req<Advisory[]>("/api/advisories"),
  workOrders: () => req<WorkOrder[]>("/api/workorders"),
  createWorkOrder: (tail: string, component_id: string) =>
    req<WorkOrder>("/api/workorders", { method: "POST", body: JSON.stringify({ tail, component_id }) }),
  inventory: () => req<Inventory>("/api/inventory"),
  transfer: (sku: string, source: string, destination: string) =>
    req("/api/inventory/transfer", { method: "POST", body: JSON.stringify({ sku, source, destination }) }),
  events: () => req<LogEvent[]>("/api/events"),
  integration: () => req<Integration>("/api/integration"),
  metrics: () => req<ModelMetrics>("/api/model/metrics"),
  strategy: (q: string) => req<Strategy>(`/api/strategy?${q}`),
  advance: (days: number) => req<Summary>("/api/sim/advance", { method: "POST", body: JSON.stringify({ days }) }),
  reset: () => req<Summary>("/api/sim/reset", { method: "POST" }),
  settings: (s: Partial<Summary["settings"]>) => req("/api/sim/settings", { method: "POST", body: JSON.stringify(s) }),
  ingest: (f: File) => {
    const fd = new FormData();
    fd.append("file", f);
    return req<{ filename: string; units: number; predictions: { unit: number; last_cycle: number; rul: number; rul_lo: number; rul_hi: number; rul_safe: number }[] }>("/api/ingest/cmapss", { method: "POST", body: fd });
  },
};
