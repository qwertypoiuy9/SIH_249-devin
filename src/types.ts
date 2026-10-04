export type SysName =
  | 'Propulsion'
  | 'Avionics'
  | 'Hydraulics'
  | 'Fuel'
  | 'Landing Gear'
  | 'Environmental'
  | 'Airframe Structure'
  | 'Electrical'

export type AirframeClass = 'Fighter' | 'Transport' | 'Helicopter' | 'Trainer'

export type AircraftStatus = 'AIRWORTHY' | 'DUE INSPECTION' | 'IN MAINTENANCE' | 'AOG'

export interface SensorDef {
  key: string
  label: string
  unit: string
  base: number
  noise: number
  warn: number
  crit: number
  /** how strongly this sensor degrades when the owning system health drops */
  sens: number
}

export interface SystemHealth {
  name: SysName
  health: number
  trend: number
  /** key of the governing component / LRU */
  lru: string
}

export interface Aircraft {
  id: string
  tail: string
  type: string
  cls: AirframeClass
  sqn: string
  base: string
  status: AircraftStatus
  hours: number
  cycles: number
  engineHours: number
  lastSvcDays: number
  nextInspDays: number
  utilisation: number
  statusHours: number
  systems: SystemHealth[]
  sensors: SensorDef[]
  /** narrative twin state used by the digital twin page */
  twin: { key: string; label: string; value: string; pct: number }[]
}

export interface Prediction {
  id: string
  aircraftId: string
  tail: string
  system: SysName
  component: string
  failureMode: string
  rulDays: number
  rulHours: number
  confidence: number
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'
  anomaly: number
  leadTimeHrs: number
  drivers: { feature: string; contrib: number }[]
  recommendation: string
  model: string
  raisedAt: string
}

export type WorkOrderStatus =
  | 'SCHEDULED'
  | 'IN WORK'
  | 'AWAITING SPARES'
  | 'QA HOLD'
  | 'COMPLETED'

export interface WorkOrder {
  id: string
  aircraftId: string
  tail: string
  system: SysName
  title: string
  type: 'CORRECTIVE' | 'PREVENTIVE' | 'PREDICTIVE'
  priority: 'P1' | 'P2' | 'P3'
  status: WorkOrderStatus
  agency: string
  opened: string
  tatDays: number
  progress: number
  spare?: string
  /** set when the order was raised by a user from an AI alert */
  sourcePred?: string
}

export interface Spare {
  part: string
  name: string
  onHand: number
  reserved: number
  reorder: number
  leadDays: number
  criticality: 'A' | 'B' | 'C'
  supplier: string
  demand30: number
}

export interface TechRecord {
  id:
    string
  tail: string
  date: string
  kind: 'FLIGHT LOG' | 'DEFECT' | 'COMPONENT CARD' | 'INSPECTION' | 'ENGINE TREND'
  source: string
  text: string
  closed: boolean
}

export interface DataAsset {
  key: string
  name: string
  sourceSystem: string
  records: number
  synced: string
  state: 'SYNCED' | 'SYNCING' | 'STALE'
  health: number
  note: string
}

export interface ModelCard {
  key: string
  name: string
  task: string
  algo: string
  metrics: { label: string; value: string }[]
  drift: 'STABLE' | 'MONITOR' | 'DRIFT'
  trained: string
}
