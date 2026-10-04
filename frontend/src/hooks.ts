import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Summary } from "./api";

export interface SimCtx { summary: Summary | null; version: number; refresh: () => Promise<void>; setSummary: (s: Summary) => void }
export const SimContext = createContext<SimCtx>({ summary: null, version: 0, refresh: async () => {}, setSummary: () => {} });
export const useSim = () => useContext(SimContext);

/** Fetch data and re-fetch whenever the simulation clock / state version changes. */
export function useData<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const { version } = useSim();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    fn().then((d) => { setData(d); setError(null); }).catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { data, error, reload: load };
}
