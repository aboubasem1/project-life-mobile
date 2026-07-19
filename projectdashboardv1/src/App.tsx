import { useState, useEffect } from 'react'
import { useEntries } from './hooks/useEntries'
import { TodayView } from './views/TodayView'
import type { AppView } from './views/TodayView'
import { PlanView } from './views/PlanView'
import { StatsView } from './views/StatsView'
import { BottomNav } from './components/layout/BottomNav'
import { AchievementToast } from './components/ui/AchievementToast'
import { FocusMode } from './components/FocusMode'
import { checkAchievements } from './lib/achievements'
import type { Achievement } from './lib/achievements'

export default function App() {
  const [view, setView]                       = useState<AppView>('today')
  const [focusTask, setFocusTask]             = useState<string | null>(null)
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([])
  const { entries, syncStatus, saveEntry, reloadAll } = useEntries()

  useEffect(() => {
    if (entries.length > 0) {
      const unlocked = checkAchievements(entries)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (unlocked.length > 0) setNewAchievements(unlocked)
    }
  }, [entries])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [])

  // App-level FocusMode overlay sits above bottom nav (z-index 200)
  if (focusTask !== null) {
    return (
      <FocusMode
        task={focusTask}
        onDone={() => setFocusTask(null)}
        onClose={() => setFocusTask(null)}
      />
    )
  }

  return (
    <div className="app">
      <main className="app-main" id="main-content">
        {view === 'today' && (
          <TodayView
            entries={entries}
            syncStatus={syncStatus}
            onSave={saveEntry}
          />
        )}
        {view === 'plan' && (
          <PlanView
            entries={entries}
            onSave={saveEntry}
            onOpenFocus={task => setFocusTask(task)}
          />
        )}
        {view === 'verlauf' && (
          <StatsView
            entries={entries}
            onReload={reloadAll}
          />
        )}
      </main>

      <BottomNav current={view} onChange={setView} />

      {newAchievements.length > 0 && (
        <AchievementToast
          achievements={newAchievements}
          onDismiss={() => setNewAchievements([])}
        />
      )}
    </div>
  )
}
