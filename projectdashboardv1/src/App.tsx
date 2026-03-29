import { useState } from 'react'
import './App.css'
import { useEntries } from './hooks/useEntries'
import { DashboardView } from './views/DashboardView'
import { StatsView } from './views/StatsView'
import { SyncStatusBadge } from './components/ui/SyncStatusBadge'

type View = 'dashboard' | 'stats'

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const { entries, syncStatus, saveEntry, reloadAll } = useEntries()

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-eyebrow">PROJECT LIFE</span>
          <span className="topbar-title">Dashboard</span>
        </div>
        <nav className="topbar-nav">
          <button
            className={`nav-tab ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            Today
          </button>
          <button
            className={`nav-tab ${view === 'stats' ? 'active' : ''}`}
            onClick={() => setView('stats')}
          >
            Stats
          </button>
        </nav>
        <SyncStatusBadge status={syncStatus} />
      </header>
      <main className="main-content">
        {view === 'dashboard' && (
          <DashboardView
            entries={entries}
            syncStatus={syncStatus}
            onSave={saveEntry}
          />
        )}
        {view === 'stats' && (
          <StatsView
            entries={entries}
            onReload={reloadAll}
          />
        )}
      </main>
    </div>
  )
}
