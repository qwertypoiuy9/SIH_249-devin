import { useEffect, useState } from 'react'
import { PlatformProvider } from './lib/platform'
import Overview from './pages/Overview'
import Fleet from './pages/Fleet'
import Twin from './pages/Twin'
import Predictions from './pages/Predictions'
import Maintenance from './pages/Maintenance'
import Spares from './pages/Spares'
import DataHub from './pages/DataHub'
import Analytics from './pages/Analytics'
import { PREDICTIONS } from './data/predictions'
import { WORK_ORDERS } from './data/ops'
import { KPI } from './lib/metrics'

type PageKey = 'overview' | 'fleet' | 'twin' | 'predictions' | 'maintenance' | 'spares' | 'data' | 'analytics'

interface NavDef {
  group: string
  items: { key: PageKey; label: string; icon: string; badge?: number }[]
}

const NAV: NavDef[] = [
  {
    group: 'Operations',
    items: [
      { key: 'overview', label: 'Fleet overview', icon: '◎' },
      { key: 'fleet', label: 'Aircraft inventory', icon: '✈' },
      { key: 'twin', label: 'Digital twin', icon: '⧉' },
    ],
  },
  {
    group: 'Intelligence',
    items: [
      { key: 'predictions', label: 'Predictive faults', icon: '⚠', badge: PREDICTIONS.filter((p) => p.severity === 'CRITICAL' || p.severity === 'HIGH').length },
      { key: 'analytics', label: 'Maintenance analytics', icon: '📈' },
    ],
  },
  {
    group: 'Sustenance',
    items: [
      { key: 'maintenance', label: 'Work control', icon: '🔧', badge: WORK_ORDERS.filter((w) => w.priority === 'P1' && w.status !== 'COMPLETED').length },
      { key: 'spares', label: 'Spares & stores', icon: '📦' },
      { key: 'data', label: 'Data integration', icon: '⛁' },
    ],
  },
]

const TITLES: Record<PageKey, string> = {
  overview: 'Fleet overview',
  fleet: 'Aircraft inventory',
  twin: 'Digital twin',
  predictions: 'Predictive fault detection',
  maintenance: 'Maintenance planning & work control',
  spares: 'Spares & inventory',
  data: 'Data integration hub',
  analytics: 'Maintenance analytics',
}

export default function App() {
  const [page, setPage] = useState<PageKey>('overview')
  const [navOpen, setNavOpen] = useState(() => window.innerWidth > 860)
  const [aircraftId, setAircraftId] = useState('AC-02')
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const openAircraft = (id: string) => {
    setAircraftId(id)
    setPage('twin')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const go = (k: PageKey) => {
    setPage(k)
    if (window.innerWidth <= 860) setNavOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <PlatformProvider>
    <div className={`shell${navOpen ? '' : ' nav-closed'}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AP</div>
          <div>
            <div className="brand-name">AIRPOWER</div>
            <div className="brand-sub">Maint. Analytics</div>
          </div>
          <button
            type="button"
            className="nav-toggle"
            title="Close sidebar"
            aria-label="Close sidebar"
            onClick={() => setNavOpen(false)}
          >
            ✕
          </button>
        </div>

        {NAV.map((g) => (
          <div key={g.group}>
            <div className="nav-group">{g.group}</div>
            {g.items.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${page === item.key ? 'on' : ''}`}
                onClick={() => go(item.key)}
              >
                <span className="ico">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
              </button>
            ))}
          </div>
        ))}

      </aside>

      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}

      <div className="main">
        <header className="topbar">
          {!navOpen && (
            <button
              type="button"
              className="nav-toggle dark"
              title="Open sidebar"
              aria-label="Open sidebar"
              onClick={() => setNavOpen(true)}
            >
              ☰
            </button>
          )}
          <div>
            <div className="crumb">Air Power · {TITLES[page]}</div>
            <h1>{TITLES[page]}</h1>
          </div>
          <span className="live">
            <span className="dot" />
            LIVE IoT FEED
          </span>
          <div className="topbar-right">
            <span className="mono">{now.toLocaleTimeString('en-IN', { hour12: false })} IST</span>
            <span className="chip">
              {KPI.airworthy}/{KPI.total} ready
            </span>
            <div className="avatar">SQ</div>
          </div>
        </header>

        {page === 'overview' && <Overview onOpenAircraft={openAircraft} />}
        {page === 'fleet' && <Fleet onOpenAircraft={openAircraft} />}
        {page === 'twin' && <Twin aircraftId={aircraftId} onSelectAircraft={setAircraftId} />}
        {page === 'predictions' && <Predictions onOpenAircraft={openAircraft} />}
        {page === 'maintenance' && <Maintenance onOpenAircraft={openAircraft} />}
        {page === 'spares' && <Spares />}
        {page === 'data' && <DataHub />}
        {page === 'analytics' && <Analytics />}
      </div>
    </div>
    </PlatformProvider>
  )
}
