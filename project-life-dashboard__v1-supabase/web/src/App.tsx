import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { createSupabaseClient, getEnvConfig } from './supabaseClient'
import type { SupabaseConfig } from './supabaseClient'

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

type SyncStatus = 'idle' | 'loading' | 'syncing' | 'synced' | 'error' | 'disabled'

type FieldItem =
  | { key: keyof DashboardEntry; label: string; type: 'boolean'; value: boolean }
  | { key: keyof DashboardEntry; label: string; type: 'number'; value: number }
  | { key: keyof DashboardEntry; label: string; type: 'text' | 'date' | 'select'; value: string }

const tableName = 'dashboard_entries'
const configStorageKey = 'project-life-supabase-config'

const getToday = () => new Date().toISOString().slice(0, 10)

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
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig | null>(() => {
    const stored = window.localStorage.getItem(configStorageKey)
    if (stored) {
      try {
        return JSON.parse(stored) as SupabaseConfig
      } catch {
        return getEnvConfig()
      }
    }
    return getEnvConfig()
  })
  const supabase = useMemo(() => createSupabaseClient(supabaseConfig), [supabaseConfig])
  const isSupabaseReady = Boolean(supabase)

  const [entry, setEntry] = useState<DashboardEntry>(() => createDefaultEntry(getToday()))
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    isSupabaseReady ? 'idle' : 'disabled'
  )
  const [isHydrated, setIsHydrated] = useState(false)

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
    setSyncStatus(isSupabaseReady ? 'idle' : 'disabled')
  }, [isSupabaseReady])

  useEffect(() => {
    const activeSupabase = supabase

    if (!activeSupabase || !isSupabaseReady) {
      setSyncStatus('disabled')
      setIsHydrated(true)
      return
    }

    const loadEntry = async () => {
      setSyncStatus('loading')
      const { data, error } = await activeSupabase
        .from(tableName)
        .select('*')
        .eq('entry_date', entry.date)
        .maybeSingle()

      if (error) {
        setSyncStatus('error')
        setIsHydrated(true)
        return
      }

      if (data) {
        setEntry((prev) => ({
          ...prev,
          date: data.entry_date ?? prev.date,
          mood: data.mood ?? '',
          sleepQuality: data.sleep_quality ?? 0,
          sleepDuration: data.sleep_duration ?? '',
          meditationMinutes: data.meditation_minutes ?? 0,
          coldShower: data.cold_shower ?? false,
          proteinShake: data.protein_shake ?? false,
          pushupsDone: data.pushups_done ?? false,
          squatsDone: data.squats_done ?? false,
          wallsitDone: data.wallsit_done ?? false,
          plankDone: data.plank_done ?? false,
          gratitudeDone: data.gratitude_done ?? false,
          focusDone: data.focus_done ?? false,
          winnerModeDone: data.winner_mode_done ?? false,
          proteinGrams: data.protein_grams ?? 0,
          calories: data.calories ?? 0,
          tasksDone: data.tasks_done ?? 0,
          journalDone: data.journal_done ?? false,
          familyTimeDone: data.family_time_done ?? false,
        }))
      }

      setSyncStatus('synced')
      setIsHydrated(true)
    }

    setIsHydrated(false)
    loadEntry()
  }, [entry.date])

  useEffect(() => {
    const activeSupabase = supabase

    if (!activeSupabase || !isSupabaseReady || !isHydrated) {
      return
    }

    const handler = window.setTimeout(async () => {
      setSyncStatus('syncing')

      const payload = {
        entry_date: entry.date,
        mood: entry.mood,
        sleep_quality: entry.sleepQuality,
        sleep_duration: entry.sleepDuration,
        meditation_minutes: entry.meditationMinutes,
        cold_shower: entry.coldShower,
        protein_shake: entry.proteinShake,
        pushups_done: entry.pushupsDone,
        squats_done: entry.squatsDone,
        wallsit_done: entry.wallsitDone,
        plank_done: entry.plankDone,
        gratitude_done: entry.gratitudeDone,
        focus_done: entry.focusDone,
        winner_mode_done: entry.winnerModeDone,
        protein_grams: entry.proteinGrams,
        calories: entry.calories,
        tasks_done: entry.tasksDone,
        journal_done: entry.journalDone,
        family_time_done: entry.familyTimeDone,
      }

      const { error } = await activeSupabase
        .from(tableName)
        .upsert(payload, { onConflict: 'entry_date' })

      if (error) {
        setSyncStatus('error')
        return
      }

      setSyncStatus('synced')
    }, 800)

    return () => window.clearTimeout(handler)
  }, [entry, isHydrated])

  const updateEntry = (partial: Partial<DashboardEntry>) => {
    setEntry((prev) => ({ ...prev, ...partial }))
  }

  const updateConfig = (partial: Partial<SupabaseConfig>) => {
    setSupabaseConfig((prev) => {
      const nextConfig = { ...(prev ?? { url: '', anonKey: '' }), ...partial }
      window.localStorage.setItem(configStorageKey, JSON.stringify(nextConfig))
      return nextConfig
    })
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
          <p className="subtle">✓ Bereit</p>
        </div>
        <div className={`status-pill status-${syncStatus}`}>
          {syncStatus === 'disabled' && '⚠️ Supabase nicht konfiguriert'}
          {syncStatus === 'loading' && '⏳ Lade Daten'}
          {syncStatus === 'syncing' && '🔄 Sync läuft'}
          {syncStatus === 'synced' && '✅ Sync OK'}
          {syncStatus === 'error' && '⚠️ Sync Fehler'}
          {syncStatus === 'idle' && '✅ Bereit'}
        </div>
      </header>

      <section className="panel config-panel">
        <div className="panel-header">
          <span className="chip">SUPABASE</span>
        </div>
        <div className="metric-grid">
          <label className="metric-card">
            <span>Supabase URL</span>
            <div className="metric-value">
              <input
                type="text"
                value={supabaseConfig?.url ?? ''}
                onChange={(event) => updateConfig({ url: event.target.value })}
                placeholder="https://xxxxx.supabase.co"
              />
            </div>
          </label>
          <label className="metric-card">
            <span>Supabase Anon Key</span>
            <div className="metric-value">
              <input
                type="text"
                value={supabaseConfig?.anonKey ?? ''}
                onChange={(event) => updateConfig({ anonKey: event.target.value })}
                placeholder="eyJhbGci..."
              />
            </div>
          </label>
        </div>
      </section>

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
