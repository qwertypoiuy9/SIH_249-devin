import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { api, type Summary } from "./api";
import { SimContext } from "./hooks";
import Layout from "./components/Layout";
import Overview from "./pages/Overview";
import Fleet from "./pages/Fleet";
import AircraftPage from "./pages/Aircraft";
import Advisories from "./pages/Advisories";
import Logistics from "./pages/Logistics";
import Strategy from "./pages/Strategy";
import ModelLab from "./pages/ModelLab";
import Architecture from "./pages/Architecture";

export default function App() {
  const [summary, setSummaryState] = useState<Summary | null>(null);
  const [version, setVersion] = useState(0);
  const setSummary = useCallback((s: Summary) => { setSummaryState(s); setVersion((v) => v + 1); }, []);
  const refresh = useCallback(async () => { setSummary(await api.summary()); }, [setSummary]);
  useEffect(() => { refresh().catch(() => setTimeout(() => refresh().catch(() => {}), 2000)); }, [refresh]);

  return (
    <SimContext.Provider value={{ summary, version, refresh, setSummary }}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="fleet" element={<Fleet />} />
            <Route path="aircraft/:tail" element={<AircraftPage />} />
            <Route path="advisories" element={<Advisories />} />
            <Route path="logistics" element={<Logistics />} />
            <Route path="strategy" element={<Strategy />} />
            <Route path="model" element={<ModelLab />} />
            <Route path="architecture" element={<Architecture />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SimContext.Provider>
  );
}
