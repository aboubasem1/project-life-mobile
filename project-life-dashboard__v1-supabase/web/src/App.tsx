import { useEffect, useMemo, useState, useRef } from 'react'
import './App.css'

type DashboardEntry = {
  date: string
  mood: string
  sleepQuality: number
  sleepDuration: string
  meditationMinutes: number
  coldShower: boolean
  proteinShake: boolean
  pushupsDone: boolean
  squatsDone: boolean
  wallsitDone: boolean
  plankDone: boolean
  gratitudeDone: boolean
  focusDone: boolean
  winnerModeDone: boolean
  proteinGrams: number
  calories: number
  tasksDone: number
  journalDone: boolean
  familyTimeDone: boolean
}

type SyncStatus = 'syncing' | 'synced' | 'error' | 'loading'

type FieldItem =
  | { key: keyof DashboardEntry; label: string; type: 'boolean'; value: boolean }
  | { key: keyof DashboardEntry; label: string; type: 'number'; value: number }
  | { key: keyof DashboardEntry; label: string; type: 'text' | 'date' | 'select'; value: string }

const API_URL = '/api/entries'

const getToday = () => new Date().toISOString().slice(0, 10)

const getPastDays = (count: number): string[] => {
  const days: string[] = []
  for (let i = 0; i < count; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    days.push(date.toISOString().slice(0, 10))
  }
  return days
}

const createDefaultEntry = (date: string): DashboardEntry => ({
  date,
  mood: '',
  sleepQuality: 0,
  sleepDuration: '',
  meditationMinutes: 0,
  coldShower: false,
  proteinShake: false,
  pushupsDone: false,
  squatsDone: false,
  wallsitDone: false,
  plankDone: false,
  gratitudeDone: false,
  focusDone: false,
  winnerModeDone: false,
  proteinGrams: 0,
  calories: 0,
  tasksDone: 0,
  journalDone: false,
  familyTimeDone: false,
})

function App() {
  // Aktuelles Datum wird bei jedem Render neu berechnet
  const today = getToday()
  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [entry, setEntry] = useState<DashboardEntry>(() => createDefaultEntry(today))
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
  const [allEntries, setAllEntries] = useState<DashboardEntry[]>([])
  const [showOverview, setShowOverview] = useState(false)

  // Dynamisch aktualisierte Datumsliste - immer aktuelle Tage
  const availableDates = getPastDays(7)
  const saveTimeoutRef = useRef<number | null>(null)
  const lastSavedEntryRef = useRef<string>('')
  
  // Stelle sicher, dass selectedDate auf heute springt, wenn sich das Datum ändert
  useEffect(() => {
    const currentDate = getToday()
    if (selectedDate !== currentDate && !availableDates.includes(selectedDate)) {
      setSelectedDate(currentDate)
    }
  }, [])

  const moodOptions = ['😊 Motiviert', '🙂 Gut', '😐 Neutral', '😔 Müde', '😤 Gestresst']
  const sleepQualityOptions = ['Sehr schlecht', 'Schlecht', 'Okay', 'Gut', 'Sehr gut']

  const morningRoutine = useMemo<FieldItem[]>(
    () =>
      [
      // Datum-Feld entfernt - wird über Tabs gesteuert
      {
        key: 'mood',
        label: 'Stimmung beim Aufwachen',
          type: 'select' as const,
        value: entry.mood,
      },
      {
        key: 'sleepQuality',
        label: 'Schlafqualität',
          type: 'select' as const,
          value: entry.sleepQuality ? sleepQualityOptions[entry.sleepQuality - 1] ?? '' : '',
      },
      {
        key: 'sleepDuration',
        label: 'Schlafdauer',
        type: 'text' as const,
        value: entry.sleepDuration,
      },
      {
        key: 'meditationMinutes',
        label: 'Meditation (Min)',
        type: 'number' as const,
        value: entry.meditationMinutes,
      },
      {
        key: 'coldShower',
        label: 'Cold Shower',
        type: 'boolean' as const,
        value: entry.coldShower,
      },
      {
        key: 'proteinShake',
        label: 'Protein Shake',
        type: 'boolean' as const,
        value: entry.proteinShake,
      },
    ],
    [entry]
  )

  const workoutDaily = useMemo<FieldItem[]>(
    () =>
      [
      { key: 'pushupsDone', label: '50 Pushups', type: 'boolean' as const, value: entry.pushupsDone },
      { key: 'squatsDone', label: '50 Squats', type: 'boolean' as const, value: entry.squatsDone },
      { key: 'wallsitDone', label: '50 Sek Wallsit', type: 'boolean' as const, value: entry.wallsitDone },
      { key: 'plankDone', label: '50 Sek Plank', type: 'boolean' as const, value: entry.plankDone },
    ],
    [entry]
  )

  const mindset = useMemo<FieldItem[]>(
    () =>
      [
      { key: 'gratitudeDone', label: 'Dankbarkeit', type: 'boolean' as const, value: entry.gratitudeDone },
      { key: 'focusDone', label: 'Fokus', type: 'boolean' as const, value: entry.focusDone },
      { key: 'winnerModeDone', label: 'Winner Mode', type: 'boolean' as const, value: entry.winnerModeDone },
    ],
    [entry]
  )

  const eveningRoutine = useMemo<FieldItem[]>(
    () =>
      [
      { key: 'proteinGrams', label: 'Protein (g)', type: 'number' as const, value: entry.proteinGrams },
      { key: 'calories', label: 'Kalorien', type: 'number' as const, value: entry.calories },
      { key: 'tasksDone', label: 'Aufgaben erledigt', type: 'number' as const, value: entry.tasksDone },
      { key: 'journalDone', label: 'Journal', type: 'boolean' as const, value: entry.journalDone },
      { key: 'familyTimeDone', label: 'Family Time', type: 'boolean' as const, value: entry.familyTimeDone },
    ],
    [entry]
  )

  useEffect(() => {
    const loadEntry = async () => {
      setSyncStatus('loading')
      lastSavedEntryRef.current = '' // Reset bei Datumswechsel
      try {
        const response = await fetch(`${API_URL}?date=${selectedDate}`)
        const result = await response.json()
        
        if (result.data) {
          setEntry(result.data)
          lastSavedEntryRef.current = JSON.stringify(result.data)
        } else {
          const defaultEntry = createDefaultEntry(selectedDate)
          setEntry(defaultEntry)
          lastSavedEntryRef.current = JSON.stringify(defaultEntry)
        }
        setSyncStatus('synced')
      } catch (error) {
        console.error('Load error:', error)
        const defaultEntry = createDefaultEntry(selectedDate)
        setEntry(defaultEntry)
        setSyncStatus('error')
      }
    }
    
    loadEntry()
  }, [selectedDate])

  useEffect(() => {
    const loadAllEntries = async () => {
      try {
        const response = await fetch(API_URL)
        const result = await response.json()
        if (result.data) {
          setAllEntries(result.data)
        }
      } catch (error) {
        console.error('Load all entries error:', error)
      }
    }
    
    loadAllEntries()
  }, [syncStatus])

  useEffect(() => {
    if (syncStatus === 'loading') return
    
    const entryString = JSON.stringify(entry)
    
    // Verhindere Save wenn Daten unverändert sind
    if (entryString === lastSavedEntryRef.current) {
      return
    }

    // Clear vorheriges Timeout
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = window.setTimeout(async () => {
      setSyncStatus('syncing')
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: entryString
        })
        
        if (!response.ok) throw new Error('Save failed')
        lastSavedEntryRef.current = entryString
        setSyncStatus('synced')
        
        // Auto-hide "Gespeichert" nach 2 Sekunden
        setTimeout(() => {
          if (syncStatus === 'synced') setSyncStatus('synced')
        }, 2000)
      } catch (error) {
        console.error('Save error:', error)
        setSyncStatus('error')
      }
    }, 800)

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [entry, syncStatus])

  const updateEntry = (partial: Partial<DashboardEntry>) => {
    setEntry((prev) => ({ ...prev, ...partial }))
  }

  const renderField = (item: FieldItem) => {
    if (item.type === 'boolean') {
      return (
        <label key={item.key} className="metric-card metric-toggle">
          <span>{item.label}</span>
          <div className="metric-value">
            <span>{item.value ? 'Done' : 'Offen'}</span>
            <input
              type="checkbox"
              checked={Boolean(item.value)}
              onChange={(event) =>
                updateEntry({ [item.key]: event.target.checked } as Partial<DashboardEntry>)
              }
            />
          </div>
        </label>
      )
    }

    if (item.type === 'select') {
      const options =
        item.key === 'mood'
          ? moodOptions
          : item.key === 'sleepQuality'
            ? sleepQualityOptions
            : []

      return (
        <label key={item.key} className="metric-card">
          <span>{item.label}</span>
          <div className="metric-value">
            <select
              value={item.value}
              onChange={(event) => {
                if (item.key === 'sleepQuality') {
                  const selectedIndex = sleepQualityOptions.indexOf(event.target.value)
                  updateEntry({ [item.key]: selectedIndex >= 0 ? selectedIndex + 1 : 0 } as Partial<
                    DashboardEntry
                  >)
                  return
                }

                updateEntry({ [item.key]: event.target.value } as Partial<DashboardEntry>)
              }}
            >
              <option value="">Bitte wählen</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </label>
      )
    }

    return (
      <label key={item.key} className="metric-card">
        <span>{item.label}</span>
        <div className="metric-value">
          <input
            type={item.type}
            value={item.value}
            onChange={(event) =>
              updateEntry({
                [item.key]: item.type === 'number' ? Number(event.target.value) : event.target.value,
              } as Partial<DashboardEntry>)
            }
          />
        </div>
      </label>
    )
  }

  const calculateTaskProgress = (entry: DashboardEntry) => {
    const tasks = [
      entry.coldShower, entry.proteinShake,
      entry.pushupsDone, entry.squatsDone, entry.wallsitDone, entry.plankDone,
      entry.gratitudeDone, entry.focusDone, entry.winnerModeDone,
      entry.journalDone, entry.familyTimeDone
    ]
    const completed = tasks.filter(Boolean).length
    const total = tasks.length
    const percentage = Math.round((completed / total) * 100)
    return { completed, total, percentage }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Project Life Dashboard</p>
          <h1>PROJECT LIFE DASHBOARD</h1>
          <p className="subtle">✓ Online Speicherung</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            className="overview-btn"
            onClick={() => setShowOverview(!showOverview)}
          >
            {showOverview ? '📝 Dashboard' : '📊 Übersicht'}
          </button>
          <div className={`status-pill status-${syncStatus}`}>
            {syncStatus === 'loading' && '⏳ Lade...'}
            {syncStatus === 'syncing' && '💾 Speichere...'}
            {syncStatus === 'synced' && '✅ Gespeichert'}
            {syncStatus === 'error' && '⚠️ Fehler'}
          </div>
        </div>
      </header>

      {showOverview ? (
        <section className="overview-section">
          <div className="overview-header">
            <h2>Tagesübersicht</h2>
            <p className="overview-subtitle">{allEntries.length} Tage erfasst</p>
          </div>
          
          <div className="overview-grid">
            {availableDates.map((date) => {
              const dayEntry = allEntries.find(e => e.date === date) || createDefaultEntry(date)
              const progress = calculateTaskProgress(dayEntry)
              const dateObj = new Date(date + 'T12:00:00')
              const dayName = dateObj.toLocaleDateString('de-DE', { weekday: 'long' })
              const dayNum = dateObj.getDate()
              const monthName = dateObj.toLocaleDateString('de-DE', { month: 'long' })
              const isToday = date === getToday()
              const hasData = progress.completed > 0

              return (
                <div 
                  key={date}
                  className={`overview-card ${isToday ? 'today' : ''} ${hasData ? 'has-data' : ''}`}
                  onClick={() => {
                    setSelectedDate(date)
                    setShowOverview(false)
                  }}
                >
                  <div className="overview-card-header">
                    <div className="overview-date">
                      <span className="overview-day-name">{dayName}</span>
                      <span className="overview-day-num">{dayNum}. {monthName}</span>
                    </div>
                    {isToday && <span className="today-badge">Heute</span>}
                  </div>

                  <div className="progress-section">
                    <div className="progress-bar-bg">
                      <div 
                        className="progress-bar-fill"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                    <div className="progress-text">
                      {progress.completed} / {progress.total} Tasks ({progress.percentage}%)
                    </div>
                  </div>

                  {hasData && (
                    <div className="overview-details">
                      {dayEntry.mood && <div className="detail-item">🎭 {dayEntry.mood}</div>}
                      {dayEntry.sleepQuality > 0 && (
                        <div className="detail-item">
                          😴 {sleepQualityOptions[dayEntry.sleepQuality - 1]}
                        </div>
                      )}
                      {dayEntry.proteinGrams > 0 && (
                        <div className="detail-item">🍖 {dayEntry.proteinGrams}g Protein</div>
                      )}
                      {dayEntry.calories > 0 && (
                        <div className="detail-item">🔥 {dayEntry.calories} kcal</div>
                      )}
                    </div>
                  )}

                  {!hasData && (
                    <div className="no-data-text">Noch keine Daten</div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <>
          <nav className="date-tabs">{availableDates.map((date) => {
          const dateObj = new Date(date + 'T12:00:00')
          const dayName = dateObj.toLocaleDateString('de-DE', { weekday: 'short' })
          const dayNum = dateObj.getDate()
          const isToday = date === getToday()
          
          return (
            <button
              key={date}
              className={`date-tab ${selectedDate === date ? 'active' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => setSelectedDate(date)}
            >
              <span className="day-name">{dayName}</span>
              <span className="day-num">{dayNum}</span>
            </button>
          )
        })}
      </nav>

      <section className="panel">
        <div className="panel-header">
          <span className="chip">MORGENS</span>
        </div>
        <div className="metric-grid">{morningRoutine.map(renderField)}</div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <span className="chip">DAILY 50</span>
        </div>
        <div className="metric-grid">{workoutDaily.map(renderField)}</div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <span className="chip">MINDSET</span>
        </div>
        <div className="metric-grid">{mindset.map(renderField)}</div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <span className="chip">ABENDS</span>
        </div>
        <div className="metric-grid">{eveningRoutine.map(renderField)}</div>
      </section>
      </>
      )}
    </div>
  )
}

export default App
