import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Spare, WorkOrder } from '../types'
import { PREDICTIONS } from '../data/predictions'

export type LogKind = 'ack' | 'wo' | 'indent' | 'anomaly' | 'system'

export interface LogEvent {
  id: string
  at: number
  kind: LogKind
  text: string
}

export interface Indent {
  id: string
  part: string
  name: string
  qty: number
  reason: string
  at: number
  etaDays: number
  status: 'RAISED' | 'APPROVED' | 'RECEIVED'
}

interface Persisted {
  acked: Record<string, number>
  raisedWOs: WorkOrder[]
  indents: Indent[]
  log: LogEvent[]
}

const KEY = 'airpower.state.v1'

const EMPTY: Persisted = { acked: {}, raisedWOs: [], indents: [], log: [] }

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<Persisted>
    return { ...EMPTY, ...parsed }
  } catch {
    return EMPTY
  }
}

interface PlatformApi extends Persisted {
  ack: (predId: string, tail: string) => void
  raiseWO: (predId: string) => void
  indent: (predId: string, spare: Pick<Spare, 'part' | 'name' | 'leadDays'>, qty?: number) => void
  advanceIndent: (id: string) => void
  pushLog: (kind: LogKind, text: string) => void
  reset: () => void
}

const Ctx = createContext<PlatformApi | null>(null)

let seq = 0
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}`

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(() => (typeof localStorage === 'undefined' ? EMPTY : load()))

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* storage full or unavailable — the session still works in memory */
    }
  }, [state])

  const pushLog = useCallback((kind: LogKind, text: string) => {
    setState((s) => ({ ...s, log: [{ id: uid('ev'), at: Date.now(), kind, text }, ...s.log].slice(0, 60) }))
  }, [])

  const ack = useCallback((predId: string, tail: string) => {
    setState((s) => {
      if (s.acked[predId]) return s
      const ev: LogEvent = { id: uid('ev'), at: Date.now(), kind: 'ack', text: `${tail}: alert ${predId} acknowledged by maint. controller` }
      return { ...s, acked: { ...s.acked, [predId]: Date.now() }, log: [ev, ...s.log].slice(0, 60) }
    })
  }, [])

  const raiseWO = useCallback((predId: string) => {
    const pred = PREDICTIONS.find((p) => p.id === predId)
    if (!pred) return
    setState((s) => {
      if (s.raisedWOs.some((w) => w.sourcePred === predId)) return s
      const wo: WorkOrder = {
        id: `WO-${Math.floor(9000 + Math.random() * 900)}`,
        aircraftId: pred.aircraftId,
        tail: pred.tail,
        system: pred.system,
        title: `${pred.component.split(' · ')[1]} — ${pred.failureMode}`,
        type: 'PREDICTIVE',
        priority: pred.severity === 'CRITICAL' ? 'P1' : pred.severity === 'HIGH' ? 'P2' : 'P3',
        status: 'SCHEDULED',
        agency: 'Squadron Flight Line',
        opened: new Date().toISOString(),
        tatDays: Math.max(1, Math.round(pred.rulDays * 0.55)),
        progress: 0,
        sourcePred: predId,
      }
      const ev: LogEvent = {
        id: uid('ev'),
        at: Date.now(),
        kind: 'wo',
        text: `${wo.id} raised for ${pred.tail} from alert ${predId} (RUL ${pred.rulDays.toFixed(1)} d)`,
      }
      return { ...s, raisedWOs: [wo, ...s.raisedWOs], log: [ev, ...s.log].slice(0, 60) }
    })
  }, [])

  const indent = useCallback((predId: string, spare: Pick<Spare, 'part' | 'name' | 'leadDays'>, qty = 1) => {
    const pred = PREDICTIONS.find((p) => p.id === predId)
    setState((s) => {
      if (s.indents.some((i) => i.reason === predId)) return s
      const ind: Indent = {
        id: uid('IND'),
        part: spare.part,
        name: spare.name,
        qty,
        reason: predId,
        at: Date.now(),
        etaDays: spare.leadDays,
        status: 'RAISED',
      }
      const ev: LogEvent = {
        id: uid('ev'),
        at: Date.now(),
        kind: 'indent',
        text: `Indent ${ind.id} raised — ${qty} × ${spare.name} for ${pred ? pred.tail : predId}, ETA ${spare.leadDays} d`,
      }
      return { ...s, indents: [ind, ...s.indents], log: [ev, ...s.log].slice(0, 60) }
    })
  }, [])

  const advanceIndent = useCallback((id: string) => {
    setState((s) => {
      const ind = s.indents.find((i) => i.id === id)
      if (!ind) return s
      const next: Indent['status'] = ind.status === 'RAISED' ? 'APPROVED' : 'RECEIVED'
      const ev: LogEvent = { id: uid('ev'), at: Date.now(), kind: 'indent', text: `Indent ${ind.id} → ${next}` }
      return {
        ...s,
        indents: s.indents.map((i) => (i.id === id ? { ...i, status: next } : i)),
        log: [ev, ...s.log].slice(0, 60),
      }
    })
  }, [])

  const reset = useCallback(() => setState(EMPTY), [])

  const api = useMemo<PlatformApi>(
    () => ({ ...state, ack, raiseWO, indent, advanceIndent, pushLog, reset }),
    [state, ack, raiseWO, indent, advanceIndent, pushLog, reset],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function usePlatform(): PlatformApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePlatform must be used inside PlatformProvider')
  return v
}
