import { useState, useEffect } from 'react'
import './App.css'
import { useEntries } from './hooks/useEntries'
import { DashboardView } from './views/DashboardView'
import { StatsView } from './views/StatsView'
import { SyncStatusBadge } from './components/ui/SyncStatusBadge'
import { AchievementToast } from './components/ui/AchievementToast'
import { LandingView } from './views/LandingView'
import { checkAchievements } from './lib/achievements'
import type { Achievement } from './lib/achievements'

type View = 'landing' | 'dashboard' | 'stats'

export default function App() {
  const [view, setView] = useState<View>('landing')
  const { entries, syncStatus, saveEntry, reloadAll } = useEntries()
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([])

  useEffect(() => {
    if (entries.length > 0) {
      const unlocked = checkAchievements(entries)
      if (unlocked.length > 0) setNewAchievements(unlocked)
    }
  }, [entries])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [])

  if (view === 'landing') {
    return <LandingView onEnter={() => setView('dashboard')} onStats={() => setView('stats')} />
  }

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
      {newAchievements.length > 0 && (
        <AchievementToast
          achievements={newAchievements}
          onDismiss={() => setNewAchievements([])}
        />
      )}
    </div>
  )
}
