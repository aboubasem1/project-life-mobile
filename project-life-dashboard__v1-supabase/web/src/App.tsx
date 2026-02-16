import { useEffect, useMemo, useState } from 'react'
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
  const [selectedDate, setSelectedDate] = useState<string>(getToday())
  const [entry, setEntry] = useState<DashboardEntry>(() => createDefaultEntry(getToday()))
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
  const [availableDates] = useState<string[]>(getPastDays(7))

  const moodOptions = ['😊 Motiviert', '🙂 Gut', '😐 Neutral', '😔 Müde', '😤 Gestresst']
  const sleepQualityOptions = ['Sehr schlecht', 'Schlecht', 'Okay', 'Gut', 'Sehr gut']

  const morningRoutine = useMemo<FieldItem[]>(
    () =>
      [
      { key: 'date', label: 'Datum', type: 'date' as const, value: entry.date },
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
      try {
        const response = await fetch(`${API_URL}?date=${selectedDate}`)
        const result = await response.json()
        
        if (result.data) {
          setEntry(result.data)
        } else {
          setEntry(createDefaultEntry(selectedDate))
        }
        setSyncStatus('synced')
      } catch (error) {
        console.error('Load error:', error)
        setEntry(createDefaultEntry(selectedDate))
        setSyncStatus('error')
      }
    }
    
    loadEntry()
  }, [selectedDate])

  useEffect(() => {
    if (syncStatus === 'loading') return
    
    const handler = window.setTimeout(async () => {
      setSyncStatus('syncing')
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        })
        
        if (!response.ok) throw new Error('Save failed')
        setSyncStatus('synced')
      } catch (error) {
        console.error('Save error:', error)
        setSyncStatus('error')
      }
    }, 500)

    return () => window.clearTimeout(handler)
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

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Project Life Dashboard</p>
          <h1>PROJECT LIFE DASHBOARD</h1>
          <p className="subtle">✓ Online Speicherung</p>
        </div>
        <div className={`status-pill status-${syncStatus}`}>
          {syncStatus === 'loading' && '⏳ Lade...'}
          {syncStatus === 'syncing' && '💾 Speichere...'}
          {syncStatus === 'synced' && '✅ Gespeichert'}
          {syncStatus === 'error' && '⚠️ Fehler'}
        </div>
      </header>

      <nav className="date-tabs">
        {availableDates.map((date) => {
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
    </div>
  )
}

export default App
