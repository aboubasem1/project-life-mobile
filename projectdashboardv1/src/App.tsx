import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  Activity,
  BarChart3,
  BatteryLow,
  Bell,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Cloud,
  Coffee,
  Crown,
  Dumbbell,
  Focus,
  Heart,
  Home,
  Leaf,
  ListTodo,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Snowflake,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useEntries } from './hooks/useEntries'
import type { DashboardEntry } from './types/DashboardEntry'
import { createDefaultEntry } from './types/DashboardEntry'
import { calculateScore } from './lib/score'
import './launch.css'

type View = 'today' | 'plan' | 'checkin' | 'progress'
type ThemePreference = 'light' | 'dark' | 'system'
type EnergyLevel = NonNullable<DashboardEntry['energyLevel']>
type RoutineKey =
  | 'breathingDone' | 'coldShower' | 'proteinShake'
  | 'pushupsDone' | 'squatsDone' | 'wallsitDone' | 'plankDone'
  | 'gratitudeDone' | 'focusDone' | 'winnerModeDone'
  | 'journalDone' | 'familyTimeDone'

type AppSettings = {
  name: string
  theme: ThemePreference
  focusMinutes: number
  proteinGoal: number
  calorieGoal: number
  activeHabits: string[]
}

type FocusSession = {
  title: string
  minutes: number
  taskIndex?: number
  routineKey?: RoutineKey
}

type ToastState = {
  message: string
  actionLabel?: string
  onAction?: () => void
} | null

const SETTINGS_KEY = 'life-os-v1-settings'

// ── Data from projectbaby ────────────────────────────────────────────────────
const QUOTES = [
  'Kleine Aktionen heute = massive Ergebnisse morgen.',
  'Du bist der Hauptcharakter. Handle dementsprechend.',
  'Discipline is the ultimate superpower.',
  'Dein zukünftiges Ich dankt dir.',
  'Momentum entsteht durch Handlung — nicht Denken.',
  'Ein Prozent besser jeden Tag. Das ist alles.',
  'Der beste Zeitpunkt war gestern. Jetzt ist Platz 2.',
  'Dein Gehirn liebt Dopamin. Gib ihm Checkmarks.',
] as const

const DEF_TASKS = [
  'Morning Routine abschließen',
  'Training · 45 Min Workout',
  '2L Wasser trinken',
  'Deep Work Block · 90 Min',
  'Supplements einnehmen',
  '3 Todos aus Projekt',
  'Abend-Check-in · Reflektion',
] as const

const LVLS = ['Rookie', 'Starter', 'Focused', 'Grinder', 'Achiever', 'Warrior', 'Elite', 'Legend', 'Master', 'Godmode'] as const
const XPT  = [0, 500, 1100, 1900, 3000, 4400, 6200, 8600, 11600, 15600] as const

type HabitDef = {
  id: RoutineKey
  label: string
  category: string
  icon: React.ComponentType<{ size?: number }>
}

const DAILY_HABITS: HabitDef[] = [
  { id: 'breathingDone',   label: '11 Min. Atmung',    category: 'Mind', icon: Brain    },
  { id: 'coldShower',      label: 'Cold Shower',       category: 'Body', icon: Snowflake },
  { id: 'proteinShake',    label: 'Protein Shake',     category: 'Body', icon: Coffee   },
  { id: 'pushupsDone',     label: '50 Pushups',        category: 'Body', icon: Dumbbell },
  { id: 'squatsDone',      label: '50 Squats',         category: 'Body', icon: Dumbbell },
  { id: 'wallsitDone',     label: '50s Wallsit',       category: 'Body', icon: Timer    },
  { id: 'plankDone',       label: '50s Plank',         category: 'Body', icon: Timer    },
  { id: 'gratitudeDone',   label: 'Dankbarkeit',       category: 'Mind', icon: Sparkles },
  { id: 'focusDone',       label: 'Deep Focus',        category: 'Mind', icon: Focus    },
  { id: 'winnerModeDone',  label: 'Winner Mode',       category: 'Mind', icon: Crown    },
  { id: 'journalDone',     label: 'Journal schreiben', category: 'Mind', icon: BookOpen },
  { id: 'familyTimeDone',  label: 'Familienzeit',      category: 'Main', icon: Users    },
]

function getDailyQuote(): string {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000)
  return QUOTES[dayOfYear % QUOTES.length]
}

function getLevelFromScore(totalScore: number): string {
  let level = 0
  for (let i = XPT.length - 1; i >= 0; i--) {
    if (totalScore >= XPT[i]) { level = i; break }
  }
  return LVLS[level]
}

const DEFAULT_ACTIVE_HABITS = ['breathingDone', 'coldShower', 'proteinShake', 'pushupsDone', 'gratitudeDone']

const DEFAULT_SETTINGS: AppSettings = {
  name: 'Elias',
  theme: 'system',
  focusMinutes: 25,
  proteinGoal: 150,
  calorieGoal: 3500,
  activeHabits: DEFAULT_ACTIVE_HABITS,
}

const NAV_ITEMS: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: 'today', label: 'Heute', icon: Home },
  { id: 'plan', label: 'Plan', icon: ListTodo },
  { id: 'checkin', label: 'Check-in', icon: Heart },
  { id: 'progress', label: 'Verlauf', icon: BarChart3 },
]

const ENERGY_OPTIONS: Array<{
  value: EnergyLevel
  label: string
  description: string
}> = [
  { value: 'low', label: 'Niedrig', description: 'Nur das Nötigste' },
  { value: 'okay', label: 'Okay', description: 'Ruhiger Standardtag' },
  { value: 'high', label: 'Gut', description: 'Mehr Fokus möglich' },
]

const MOODS = ['Ruhig', 'Gut', 'Neutral', 'Müde', 'Gestresst']
const SLEEP_QUALITY = ['Schlecht', 'Okay', 'Gut', 'Sehr gut']
const SLEEP_DURATION = ['5h', '6h', '6.5h', '7h', '7.5h', '8h', '9h']

function loadSettings(): AppSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<AppSettings>
    const theme: ThemePreference = ['light', 'dark', 'system'].includes(stored.theme ?? '')
      ? stored.theme as ThemePreference
      : DEFAULT_SETTINGS.theme

    return {
      name: typeof stored.name === 'string' ? stored.name.slice(0, 40) : DEFAULT_SETTINGS.name,
      theme,
      focusMinutes: clampNumber(Number(stored.focusMinutes) || DEFAULT_SETTINGS.focusMinutes, 5, 120),
      proteinGoal: clampNumber(Number(stored.proteinGoal) || DEFAULT_SETTINGS.proteinGoal, 50, 400),
      calorieGoal: clampNumber(Number(stored.calorieGoal) || DEFAULT_SETTINGS.calorieGoal, 1000, 8000),
      activeHabits: Array.isArray(stored.activeHabits) ? stored.activeHabits : DEFAULT_ACTIVE_HABITS,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromDateKey(key: string): Date {
  return new Date(`${key}T12:00:00`)
}

function addDays(key: string, amount: number): string {
  const date = fromDateKey(key)
  date.setDate(date.getDate() + amount)
  return dateKey(date)
}

function formatLongDate(key: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fromDateKey(key))
}

function formatShortDate(key: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
  }).format(fromDateKey(key))
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 11) return 'Guten Morgen'
  if (hour < 18) return 'Guten Tag'
  return 'Guten Abend'
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function plural(count: number, singular: string, pluralWord: string): string {
  return count === 1 ? singular : pluralWord
}

function useModalBehavior(onClose: () => void) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
  className = '',
}: {
  label: string
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function ProgressRing({ value, size = 72 }: { value: number; size?: number }) {
  const safeValue = clampNumber(Math.round(value), 0, 100)
  return (
    <div
      className="progress-ring"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--accent) ${safeValue * 3.6}deg, var(--track) 0deg)`,
      }}
      aria-label={`${safeValue} Prozent Fortschritt`}
      role="img"
    >
      <div className="progress-ring__inner">
        <strong>{safeValue}%</strong>
        <span>heute</span>
      </div>
    </div>
  )
}

function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}

function EmptyState({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Leaf size={22} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

function App() {
  const { entries, syncStatus, saveEntry } = useEntries()
  const [view, setView] = useState<View>('today')
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()))
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [taskEditor, setTaskEditor] = useState<{ index: number | null; value: string } | null>(null)
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null)
  const [toast, setToast] = useState<ToastState>(null)

  const today = dateKey(new Date())
  const entry = useMemo(
    () => entries.find(item => item.date === selectedDate) ?? createDefaultEntry(selectedDate),
    [entries, selectedDate],
  )

  const score = clampNumber(calculateScore(entry), 0, 100)
  const anchors = entry.anchors ?? []
  const anchorsDone = entry.anchorsDone ?? []
  const completedAnchors = anchors.filter((_, index) => Boolean(anchorsDone[index])).length

  const updateEntry = (patch: Partial<DashboardEntry>) => {
    void saveEntry({ ...entry, ...patch })
  }

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const resolved = settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme
      root.dataset.theme = resolved
      root.style.colorScheme = resolved
    }

    applyTheme()
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [settings.theme])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const showToast = (message: string, actionLabel?: string, onAction?: () => void) => {
    setToast({ message, actionLabel, onAction })
  }

  const setAnchors = (nextAnchors: string[], nextDone: boolean[]) => {
    const normalizedDone = nextAnchors.map((_, index) => Boolean(nextDone[index]))
    updateEntry({
      anchors: nextAnchors,
      anchorsDone: normalizedDone,
      tasksDone: normalizedDone.filter(Boolean).length,
    })
  }

  const toggleAnchor = (index: number) => {
    const nextDone = anchors.map((_, itemIndex) =>
      itemIndex === index ? !anchorsDone[itemIndex] : !!anchorsDone[itemIndex],
    )
    setAnchors(anchors, nextDone)
  }

  const saveTask = (value: string, index: number | null) => {
    const clean = value.trim()
    if (!clean) return

    if (index === null) {
      if (anchors.length >= 5) {
        showToast('Maximal fünf Tagesanker halten den Tag übersichtlich.')
        return
      }
      setAnchors([...anchors, clean], [...anchorsDone, false])
      showToast('Aufgabe hinzugefügt.')
    } else {
      const next = anchors.map((item, itemIndex) => (itemIndex === index ? clean : item))
      setAnchors(next, anchors.map((_, itemIndex) => Boolean(anchorsDone[itemIndex])))
      showToast('Aufgabe aktualisiert.')
    }
    setTaskEditor(null)
  }

  const deleteTask = (index: number) => {
    const deleted = anchors[index]
    const wasDone = Boolean(anchorsDone[index])
    const nextAnchors = anchors.filter((_, itemIndex) => itemIndex !== index)
    const nextDone = anchorsDone.filter((_, itemIndex) => itemIndex !== index)
    setAnchors(nextAnchors, nextDone)
    showToast('Aufgabe entfernt.', 'Rückgängig', () => {
      const restoredAnchors = [...nextAnchors]
      const restoredDone = [...nextDone]
      restoredAnchors.splice(index, 0, deleted)
      restoredDone.splice(index, 0, wasDone)
      setAnchors(restoredAnchors, restoredDone)
    })
  }

  const moveTask = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= anchors.length) return
    const nextAnchors = [...anchors]
    const nextDone = anchors.map((_, itemIndex) => Boolean(anchorsDone[itemIndex]))
    ;[nextAnchors[index], nextAnchors[target]] = [nextAnchors[target], nextAnchors[index]]
    ;[nextDone[index], nextDone[target]] = [nextDone[target], nextDone[index]]
    setAnchors(nextAnchors, nextDone)
  }

  const openFocus = (title: string, taskIndex?: number, routineKey?: RoutineKey) => {
    setFocusSession({
      title,
      minutes: clampNumber(settings.focusMinutes, 5, 120),
      taskIndex,
      routineKey,
    })
  }

  const finishFocus = () => {
    if (!focusSession) return
    if (typeof focusSession.taskIndex === 'number') {
      const index = focusSession.taskIndex
      const nextDone = anchors.map((_, itemIndex) =>
        itemIndex === index ? true : Boolean(anchorsDone[itemIndex]),
      )
      setAnchors(anchors, nextDone)
    }
    updateEntry({
      focusDone: true,
      ...(focusSession.routineKey ? { [focusSession.routineKey]: true } : {}),
    } as Partial<DashboardEntry>)
    setFocusSession(null)
    showToast('Fokusblock abgeschlossen.')
  }

  const resolvedTheme = document.documentElement.dataset.theme ?? 'light'
  const quickToggleTheme = () => {
    setSettings(current => ({
      ...current,
      theme: resolvedTheme === 'dark' ? 'light' : 'dark',
    }))
  }

  const currentViewLabel = NAV_ITEMS.find(item => item.id === view)?.label ?? 'Heute'
  const navigateTo = (nextView: View) => {
    setView(nextView)
    if (nextView === 'today') setSelectedDate(today)
  }

  return (
    <div className="life-app">
      <aside className="sidebar" aria-label="Hauptnavigation">
        <div className="brand">
          <div className="brand__mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <strong>Life OS</strong>
            <span>Version 1</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-group-label">Übersicht</span>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            return (
              <button
                type="button"
                key={item.id}
                className={view === item.id ? 'nav-item is-active' : 'nav-item'}
                onClick={() => navigateTo(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-status">
          <div className="sidebar-status__top">
            <span>Heute</span>
            <strong>{score}%</strong>
          </div>
          <div className="mini-progress" aria-hidden="true">
            <span style={{ width: `${score}%` }} />
          </div>
          <p>
            {completedAnchors} von {anchors.length} {plural(anchors.length, 'Anker', 'Ankern')} erledigt
          </p>
        </div>

        <div className="sidebar-actions">
          <button type="button" className="nav-item" onClick={quickToggleTheme}>
            {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{resolvedTheme === 'dark' ? 'Heller Modus' : 'Dunkler Modus'}</span>
          </button>
          <button type="button" className="nav-item" onClick={() => setSettingsOpen(true)}>
            <Settings size={18} />
            <span>Einstellungen</span>
          </button>
        </div>
      </aside>

      <div className="app-stage">
        <header className="mobile-header">
          <div className="brand brand--mobile">
            <div className="brand__mark" aria-hidden="true"><span /></div>
            <strong>Life OS</strong>
          </div>
          <div className="mobile-header__actions">
            <IconButton label="Theme wechseln" onClick={quickToggleTheme}>
              {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
            <IconButton label="Einstellungen öffnen" onClick={() => setSettingsOpen(true)}>
              <Settings size={18} />
            </IconButton>
          </div>
        </header>

        <main className="app-main" id="main-content">
          <div className="desktop-topbar">
            <div>
              <span className="eyebrow">{currentViewLabel}</span>
              <h1>{greeting()}, {settings.name.trim() || 'Elias'}.</h1>
            </div>
            <div className="topbar-actions">
              <span className={`sync-pill sync-pill--${syncStatus}`}>
                <Cloud size={14} />
                {syncStatus === 'syncing' ? 'Speichert …' : 'Lokal gespeichert'}
              </span>
              <IconButton label="Einstellungen öffnen" onClick={() => setSettingsOpen(true)}>
                <Settings size={18} />
              </IconButton>
            </div>
          </div>

          {view === 'today' && (
            <TodayView
              entry={entry}
              date={selectedDate}
              today={today}
              score={score}
              settings={settings}
              anchors={anchors}
              anchorsDone={anchorsDone}
              onDateChange={setSelectedDate}
              onUpdate={updateEntry}
              onToggleAnchor={toggleAnchor}
              onEditTask={(index, value) => setTaskEditor({ index, value })}
              onAddTask={() => setTaskEditor({ index: null, value: '' })}
              onOpenFocus={openFocus}
              onOpenPlan={() => navigateTo('plan')}
              onOpenCheckin={() => navigateTo('checkin')}
              showToast={showToast}
            />
          )}

          {view === 'plan' && (
            <PlanView
              date={selectedDate}
              today={today}
              anchors={anchors}
              anchorsDone={anchorsDone}
              focusMinutes={settings.focusMinutes}
              onDateChange={setSelectedDate}
              onAddTask={() => setTaskEditor({ index: null, value: '' })}
              onAddSuggestion={text => saveTask(text, null)}
              onEditTask={(index, value) => setTaskEditor({ index, value })}
              onDeleteTask={deleteTask}
              onMoveTask={moveTask}
              onToggleTask={toggleAnchor}
              onOpenFocus={openFocus}
              onFocusMinutesChange={minutes => setSettings(current => ({ ...current, focusMinutes: minutes }))}
            />
          )}

          {view === 'checkin' && (
            <CheckinView
              entry={entry}
              date={selectedDate}
              today={today}
              settings={settings}
              onDateChange={setSelectedDate}
              onUpdate={updateEntry}
              showToast={showToast}
            />
          )}

          {view === 'progress' && (
            <ProgressView entries={entries} today={today} />
          )}
        </main>

        <nav className="mobile-nav" aria-label="Mobile Navigation">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            return (
              <button
                type="button"
                key={item.id}
                className={view === item.id ? 'mobile-nav__item is-active' : 'mobile-nav__item'}
                onClick={() => navigateTo(item.id)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {taskEditor && (
        <TaskEditor
          initialValue={taskEditor.value}
          isEditing={taskEditor.index !== null}
          onClose={() => setTaskEditor(null)}
          onSave={value => saveTask(value, taskEditor.index)}
        />
      )}

      {focusSession && (
        <FocusModal
          session={focusSession}
          onChangeMinutes={minutes => setFocusSession(current => current ? { ...current, minutes } : current)}
          onClose={() => setFocusSession(null)}
          onFinish={finishFocus}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span>{toast.message}</span>
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.()
                setToast(null)
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function DateStrip({
  selected,
  today,
  maxDate,
  onChange,
}: {
  selected: string
  today: string
  maxDate?: string
  onChange: (date: string) => void
}) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(selected, index - 3))
  return (
    <div className="date-strip-wrap">
      <IconButton label="Vorheriger Tag" onClick={() => onChange(addDays(selected, -1))}>
        <ChevronLeft size={18} />
      </IconButton>
      <div className="date-strip" role="list" aria-label="Wochenauswahl">
        {days.map(day => {
          const date = fromDateKey(day)
          const isSelected = day === selected
          const isToday = day === today
          const isDisabled = Boolean(maxDate && day > maxDate)
          return (
            <button
              type="button"
              role="listitem"
              key={day}
              className={`date-chip${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
              onClick={() => onChange(day)}
              aria-pressed={isSelected}
              aria-label={formatLongDate(day)}
              disabled={isDisabled}
            >
              <span>{new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(date).replace('.', '')}</span>
              <strong>{date.getDate()}</strong>
            </button>
          )
        })}
      </div>
      <IconButton
        label="Nächster Tag"
        onClick={() => onChange(addDays(selected, 1))}
        disabled={Boolean(maxDate && selected >= maxDate)}
      >
        <ChevronRight size={18} />
      </IconButton>
    </div>
  )
}

function TodayView({
  entry,
  date,
  today,
  score,
  settings,
  anchors,
  anchorsDone,
  onDateChange,
  onUpdate,
  onToggleAnchor,
  onEditTask,
  onAddTask,
  onOpenFocus,
  onOpenPlan,
  onOpenCheckin,
  showToast,
}: {
  entry: DashboardEntry
  date: string
  today: string
  score: number
  settings: AppSettings
  anchors: string[]
  anchorsDone: boolean[]
  onDateChange: (date: string) => void
  onUpdate: (patch: Partial<DashboardEntry>) => void
  onToggleAnchor: (index: number) => void
  onEditTask: (index: number, value: string) => void
  onAddTask: () => void
  onOpenFocus: (title: string, taskIndex?: number, routineKey?: RoutineKey) => void
  onOpenPlan: () => void
  onOpenCheckin: () => void
  showToast: (message: string) => void
}) {
  const [capture, setCapture] = useState('')
  const energy = entry.energyLevel
  const routineItems = DAILY_HABITS
    .filter(h => settings.activeHabits.includes(h.id))
    .map(h => ({
      key: h.id,
      label: h.label,
      icon: h.icon,
      done: Boolean(entry[h.id as keyof DashboardEntry]),
    }))

  const routineDone = routineItems.filter(item => item.done).length
  const nextTaskIndex = anchors.findIndex((_, index) => !anchorsDone[index])
  const nextRoutine = routineItems.find(item => !item.done)
  const isLowEnergy = energy === 'low'
  const focusTitle = nextTaskIndex >= 0
    ? anchors[nextTaskIndex]
    : nextRoutine?.label ?? 'Tagesabschluss'

  const completeNext = () => {
    if (nextTaskIndex >= 0) {
      onToggleAnchor(nextTaskIndex)
      return
    }
    if (nextRoutine) {
      onUpdate({ [nextRoutine.key]: true } as Partial<DashboardEntry>)
    }
  }

  const parkThought = (event: FormEvent) => {
    event.preventDefault()
    const clean = capture.trim()
    if (!clean) return
    const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date())
    const nextText = entry.journalText ? `${entry.journalText}\n${time} — ${clean}` : `${time} — ${clean}`
    onUpdate({ journalText: nextText })
    setCapture('')
    showToast('Gedanke geparkt.')
  }

  return (
    <div className="view-stack">
      <DateStrip selected={date} today={today} onChange={onDateChange} />

      <section className="hero-card">
        <div className="hero-card__content">
          <div className="hero-card__meta">
            <span>{date === today ? 'Heute' : formatLongDate(date)}</span>
            <ProgressRing value={score} size={78} />
          </div>
          <div className="hero-card__copy">
            <span className="eyebrow">Dein nächster Schritt</span>
            <h2>{focusTitle}</h2>
            <p>
              {nextTaskIndex >= 0
                ? 'Nur diese eine Aufgabe. Der Rest darf kurz warten.'
                : nextRoutine
                  ? 'Ein kleiner Anker bringt wieder Ruhe in den Tag.'
                  : getDailyQuote()}
            </p>
          </div>
          <div className="hero-card__actions">
            {(nextTaskIndex >= 0 || nextRoutine) && (
              <button
                type="button"
                className="primary-button"
                onClick={() => onOpenFocus(
                  focusTitle,
                  nextTaskIndex >= 0 ? nextTaskIndex : undefined,
                  nextTaskIndex < 0 ? nextRoutine?.key : undefined,
                )}
              >
                <Play size={17} fill="currentColor" />
                Fokus starten
                <span>{settings.focusMinutes} Min.</span>
              </button>
            )}
            {(nextTaskIndex >= 0 || nextRoutine) && (
              <button type="button" className="secondary-button" onClick={completeNext}>
                <Check size={17} />
                Erledigt
              </button>
            )}
          </div>
          {nextTaskIndex >= 0 && (
            <div className="hero-card__next">
              <span>Danach</span>
              <strong>{anchors.find((_, index) => index > nextTaskIndex && !anchorsDone[index]) ?? 'Kurze Pause'}</strong>
            </div>
          )}
        </div>
        <div className="calm-visual" aria-hidden="true">
          <span className="calm-visual__orb calm-visual__orb--one" />
          <span className="calm-visual__orb calm-visual__orb--two" />
          <span className="calm-visual__orb calm-visual__orb--three" />
          <div className="calm-visual__glass">
            <Leaf size={26} />
            <span>{isLowEnergy ? 'Sanfter Tag' : 'Ruhiger Fokus'}</span>
          </div>
        </div>
      </section>

      {!energy && (
        <section className="card energy-card">
          <SectionTitle eyebrow="Kurz einchecken" title="Wie viel Energie ist heute da?" />
          <div className="energy-grid">
            {ENERGY_OPTIONS.map(option => (
              <button
                type="button"
                key={option.value}
                className="energy-option"
                onClick={() => onUpdate({ energyLevel: option.value })}
              >
                <span className={`energy-dot energy-dot--${option.value}`} />
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {energy && (
        <div className="status-row">
          <span className={`energy-pill energy-pill--${energy}`}>
            {energy === 'low' ? <BatteryLow size={15} /> : <Activity size={15} />}
            Energie: {ENERGY_OPTIONS.find(option => option.value === energy)?.label}
          </span>
          <button type="button" className="text-button" onClick={() => onUpdate({ energyLevel: undefined })}>
            Ändern
          </button>
        </div>
      )}

      <div className="dashboard-grid">
        <section className="card tasks-card">
          <SectionTitle
            eyebrow="Tagesanker"
            title={isLowEnergy ? 'Heute reicht wenig' : 'Was heute zählt'}
            action={
              <button type="button" className="small-button" onClick={onAddTask}>
                <Plus size={15} /> Aufgabe
              </button>
            }
          />
          {anchors.length === 0 ? (
            <EmptyState
              title="Noch keine Aufgaben"
              text="Lege ein bis drei klare Anker fest. Mehr muss heute nicht sein."
              action={<button type="button" className="secondary-button" onClick={onAddTask}><Plus size={16} /> Erste Aufgabe</button>}
            />
          ) : (
            <div className="task-list">
              {anchors.map((task, index) => {
                const done = Boolean(anchorsDone[index])
                return (
                  <div className={done ? 'task-row is-done' : 'task-row'} key={`${task}-${index}`}>
                    <button
                      type="button"
                      className="task-check"
                      onClick={() => onToggleAnchor(index)}
                      aria-label={done ? `${task} als offen markieren` : `${task} erledigen`}
                      aria-pressed={done}
                    >
                      {done ? <Check size={16} /> : <Circle size={16} />}
                    </button>
                    <button type="button" className="task-title" onClick={() => onOpenFocus(task, index)}>
                      <strong>{task}</strong>
                      <span>{done ? 'Erledigt' : `${settings.focusMinutes} Minuten Fokus`}</span>
                    </button>
                    <IconButton label={`${task} bearbeiten`} onClick={() => onEditTask(index, task)}>
                      <Pencil size={15} />
                    </IconButton>
                  </div>
                )
              })}
            </div>
          )}
          {anchors.length > 0 && (
            <button type="button" className="card-link" onClick={onOpenPlan}>
              Plan bearbeiten <ChevronRight size={16} />
            </button>
          )}
        </section>

        <section className="card routine-card">
          <SectionTitle
            eyebrow="Rhythmus"
            title="Sanfte Routine"
            action={<span className="counter-pill">{routineDone}/{routineItems.length}</span>}
          />
          <div className="routine-list">
            {routineItems.map(item => {
              const Icon = item.icon
              return (
                <button
                  type="button"
                  key={item.key}
                  className={item.done ? 'routine-item is-done' : 'routine-item'}
                  onClick={() => onUpdate({ [item.key]: !item.done } as Partial<DashboardEntry>)}
                  aria-pressed={item.done}
                >
                  <span className="routine-item__icon"><Icon size={18} /></span>
                  <span>{item.label}</span>
                  <span className="routine-item__state">{item.done ? <Check size={16} /> : <ChevronRight size={16} />}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="card checkin-summary">
          <SectionTitle eyebrow="Körper & Kopf" title="Kurzer Check-in" />
          <div className="metric-summary-grid">
            <div>
              <span>Schlaf</span>
              <strong>{entry.sleepDuration || '—'}</strong>
            </div>
            <div>
              <span>Protein</span>
              <strong>{entry.proteinGrams ? `${entry.proteinGrams} g` : '—'}</strong>
            </div>
            <div>
              <span>Kalorien</span>
              <strong>{entry.calories ? entry.calories.toLocaleString('de-DE') : '—'}</strong>
            </div>
          </div>
          <button type="button" className="secondary-button secondary-button--full" onClick={onOpenCheckin}>
            <Heart size={16} /> Check-in öffnen
          </button>
        </section>

        <section className="card capture-card">
          <SectionTitle eyebrow="Kopf frei" title="Gedanke parken" />
          <p>Schreib ihn kurz auf und geh zurück zu dem, was gerade wichtig ist.</p>
          <form className="capture-form" onSubmit={parkThought}>
            <input
              value={capture}
              onChange={event => setCapture(event.target.value)}
              placeholder="Was darf aus dem Kopf?"
              maxLength={240}
              aria-label="Gedanke notieren"
            />
            <button type="submit" className="send-button" aria-label="Gedanke speichern" disabled={!capture.trim()}>
              <Plus size={18} />
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

function PlanView({
  date,
  today,
  anchors,
  anchorsDone,
  focusMinutes,
  onDateChange,
  onAddTask,
  onAddSuggestion,
  onEditTask,
  onDeleteTask,
  onMoveTask,
  onToggleTask,
  onOpenFocus,
  onFocusMinutesChange,
}: {
  date: string
  today: string
  anchors: string[]
  anchorsDone: boolean[]
  focusMinutes: number
  onDateChange: (date: string) => void
  onAddTask: () => void
  onAddSuggestion: (text: string) => void
  onEditTask: (index: number, value: string) => void
  onDeleteTask: (index: number) => void
  onMoveTask: (index: number, direction: -1 | 1) => void
  onToggleTask: (index: number) => void
  onOpenFocus: (title: string, taskIndex?: number) => void
  onFocusMinutesChange: (minutes: number) => void
}) {
  const done = anchors.filter((_, index) => Boolean(anchorsDone[index])).length
  const availableSuggestions = DEF_TASKS.filter(t => !anchors.includes(t))
  return (
    <div className="view-stack">
      <DateStrip selected={date} today={today} onChange={onDateChange} />
      <section className="page-intro">
        <div>
          <span className="eyebrow">Plan</span>
          <h2>Ein klarer Tag braucht wenig.</h2>
          <p>Ordne nur die Aufgaben, die heute wirklich zählen. Maximal fünf.</p>
        </div>
        <button type="button" className="primary-button" onClick={onAddTask} disabled={anchors.length >= 5}>
          <Plus size={17} /> Neue Aufgabe
        </button>
      </section>

      <div className="plan-layout">
        <section className="card plan-list-card">
          <SectionTitle
            eyebrow={formatLongDate(date)}
            title="Tagesanker"
            action={<span className="counter-pill">{done}/{anchors.length}</span>}
          />
          {anchors.length === 0 ? (
            <EmptyState
              title="Der Plan ist noch leer"
              text="Beginne mit einer einzigen Aufgabe, die den Tag spürbar besser macht."
              action={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 400 }}>
                  <button type="button" className="primary-button" onClick={onAddTask}><Plus size={16} /> Eigene Aufgabe</button>
                  <p style={{ margin: '8px 0 6px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>Schnell hinzufügen:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {availableSuggestions.slice(0, 5 - anchors.length).map(t => (
                      <button key={t} type="button" className="small-button" onClick={() => onAddSuggestion(t)}>
                        <Plus size={12} /> {t}
                      </button>
                    ))}
                  </div>
                </div>
              }
            />
          ) : (
            <div className="editable-task-list">
              {anchors.map((task, index) => {
                const isDone = Boolean(anchorsDone[index])
                return (
                  <div className={isDone ? 'editable-task is-done' : 'editable-task'} key={`${task}-${index}`}>
                    <button
                      type="button"
                      className="task-check"
                      onClick={() => onToggleTask(index)}
                      aria-pressed={isDone}
                      aria-label={isDone ? `${task} als offen markieren` : `${task} erledigen`}
                    >
                      {isDone ? <Check size={17} /> : <Circle size={17} />}
                    </button>
                    <div className="editable-task__content">
                      <strong>{task}</strong>
                      <span>Position {index + 1}</span>
                    </div>
                    <div className="editable-task__actions">
                      <IconButton label="Nach oben" onClick={() => onMoveTask(index, -1)} disabled={index === 0}>
                        <ChevronUp size={15} />
                      </IconButton>
                      <IconButton label="Nach unten" onClick={() => onMoveTask(index, 1)} disabled={index === anchors.length - 1}>
                        <ChevronDown size={15} />
                      </IconButton>
                      <IconButton label="Fokus starten" onClick={() => onOpenFocus(task, index)}>
                        <Play size={15} />
                      </IconButton>
                      <IconButton label="Bearbeiten" onClick={() => onEditTask(index, task)}>
                        <Pencil size={15} />
                      </IconButton>
                      <IconButton label="Löschen" onClick={() => onDeleteTask(index)} className="icon-button--danger">
                        <Trash2 size={15} />
                      </IconButton>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <aside className="plan-side">
          <section className="card focus-settings-card">
            <div className="soft-icon"><Focus size={20} /></div>
            <h3>Fokusdauer</h3>
            <p>Wähle eine Dauer, die sich leicht genug zum Starten anfühlt.</p>
            <div className="duration-grid">
              {[10, 25, 45].map(minutes => (
                <button
                  type="button"
                  key={minutes}
                  className={focusMinutes === minutes ? 'duration-button is-active' : 'duration-button'}
                  onClick={() => onFocusMinutesChange(minutes)}
                  aria-pressed={focusMinutes === minutes}
                >
                  <strong>{minutes}</strong>
                  <span>Min.</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card calming-note">
            <div className="calming-note__art" aria-hidden="true"><span /></div>
            <h3>Weniger Reibung</h3>
            <p>Eine Aufgabe darf klein formuliert sein. „10 Minuten anfangen“ zählt.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}

function NumberField({
  label,
  value,
  unit,
  step,
  min = 0,
  max,
  placeholder,
  onChange,
}: {
  label: string
  value: number
  unit?: string
  step?: number
  min?: number
  max?: number
  placeholder?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          value={value || ''}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          onChange={event => onChange(Number(event.target.value) || 0)}
        />
        {unit && <strong>{unit}</strong>}
      </div>
    </label>
  )
}

function CheckinView({
  entry,
  date,
  today,
  settings,
  onDateChange,
  onUpdate,
  showToast,
}: {
  entry: DashboardEntry
  date: string
  today: string
  settings: AppSettings
  onDateChange: (date: string) => void
  onUpdate: (patch: Partial<DashboardEntry>) => void
  showToast: (message: string) => void
}) {
  const [journal, setJournal] = useState(entry.journalText ?? '')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJournal(entry.journalText ?? '')
  }, [entry.date, entry.journalText])

  const saveJournal = () => {
    onUpdate({ journalText: journal, journalDone: Boolean(journal.trim()) })
    showToast('Notiz gespeichert.')
  }

  return (
    <div className="view-stack">
      <DateStrip selected={date} today={today} maxDate={today} onChange={onDateChange} />
      <section className="page-intro">
        <div>
          <span className="eyebrow">Check-in</span>
          <h2>Kurz wahrnehmen, nicht bewerten.</h2>
          <p>Nur die Daten, die dir später wirklich helfen.</p>
        </div>
      </section>

      <div className="checkin-layout">
        <section className="card checkin-card">
          <SectionTitle eyebrow="Kopf" title="Wie geht es dir?" />
          <div className="choice-grid choice-grid--mood">
            {MOODS.map(mood => (
              <button
                type="button"
                key={mood}
                className={entry.mood === mood ? 'choice-button is-active' : 'choice-button'}
                onClick={() => onUpdate({ mood })}
                aria-pressed={entry.mood === mood}
              >
                {mood}
              </button>
            ))}
          </div>
        </section>

        <section className="card checkin-card">
          <SectionTitle eyebrow="Erholung" title="Schlaf" />
          <label className="select-field">
            <span>Qualität</span>
            <select value={entry.sleepQuality} onChange={event => onUpdate({ sleepQuality: event.target.value })}>
              <option value="">Nicht eingetragen</option>
              {SLEEP_QUALITY.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="select-field">
            <span>Dauer</span>
            <select value={entry.sleepDuration} onChange={event => onUpdate({ sleepDuration: event.target.value })}>
              <option value="">Nicht eingetragen</option>
              {SLEEP_DURATION.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <NumberField
            label="Meditation"
            value={entry.meditationMinutes}
            unit="Min."
            step={5}
            max={180}
            onChange={meditationMinutes => onUpdate({ meditationMinutes })}
          />
        </section>

        <section className="card checkin-card checkin-card--wide">
          <SectionTitle eyebrow="Ernährung" title="Körper versorgen" />
          <div className="form-grid">
            <NumberField
              label={`Protein · Ziel ${settings.proteinGoal} g`}
              value={entry.proteinGrams}
              unit="g"
              step={5}
              max={500}
              onChange={proteinGrams => onUpdate({
                proteinGrams,
                proteinReached: proteinGrams >= settings.proteinGoal,
              })}
            />
            <NumberField
              label={`Kalorien · Ziel ${settings.calorieGoal.toLocaleString('de-DE')}`}
              value={entry.calories}
              unit="kcal"
              step={50}
              max={10000}
              onChange={calories => onUpdate({
                calories,
                caloriesReached: calories >= settings.calorieGoal,
              })}
            />
            <NumberField
              label="Gewicht"
              value={entry.weightKg}
              unit="kg"
              step={0.1}
              min={35}
              max={200}
              placeholder="65.0"
              onChange={weightKg => onUpdate({ weightKg })}
            />
            <NumberField
              label="Deep Work"
              value={entry.deepWorkHours}
              unit="Std."
              step={0.25}
              max={16}
              onChange={deepWorkHours => onUpdate({ deepWorkHours })}
            />
          </div>
        </section>

        <section className="card checkin-card checkin-card--wide">
          <SectionTitle eyebrow="Abschluss" title="Eine kurze Notiz" />
          <textarea
            className="journal-field"
            value={journal}
            onChange={event => setJournal(event.target.value)}
            placeholder="Was war heute wichtig? Was darf für morgen losgelassen werden?"
            rows={6}
            maxLength={2000}
          />
          <div className="form-actions">
            <span>{journal.length}/2000</span>
            <button type="button" className="primary-button" onClick={saveJournal}>
              <Check size={17} /> Notiz speichern
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function ProgressView({ entries, today }: { entries: DashboardEntry[]; today: string }) {
  const lastSeven = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6)).map(date => {
    const entry = entries.find(item => item.date === date) ?? createDefaultEntry(date)
    return { date, score: clampNumber(calculateScore(entry), 0, 100), entry }
  })
  const average = Math.round(lastSeven.reduce((sum, item) => sum + item.score, 0) / lastSeven.length)
  const best = Math.max(...lastSeven.map(item => item.score))

  let streak = 0
  for (let index = lastSeven.length - 1; index >= 0; index -= 1) {
    if (lastSeven[index].score > 0) streak += 1
    else break
  }

  const habitStats = [
    { label: 'Proteinshake', count: lastSeven.filter(item => item.entry.proteinShake).length, icon: Coffee },
    { label: 'Dankbarkeit', count: lastSeven.filter(item => item.entry.gratitudeDone).length, icon: Sparkles },
    { label: 'Fokus', count: lastSeven.filter(item => item.entry.focusDone).length, icon: Focus },
    { label: 'Bewegung', count: lastSeven.filter(item => item.entry.pushupsDone || item.entry.squatsDone).length, icon: Dumbbell },
  ]

  return (
    <div className="view-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">Verlauf</span>
          <h2>Fortschritt ohne Druck.</h2>
          <p>Sieh auf den Rhythmus der Woche, nicht auf einen einzelnen schwierigen Tag.</p>
        </div>
      </section>

      <div className="kpi-grid">
        <div className="kpi-card"><span>Wochenschnitt</span><strong>{average}%</strong><small>letzte 7 Tage</small></div>
        <div className="kpi-card"><span>Bester Tag</span><strong>{best}%</strong><small>diese Woche</small></div>
        <div className="kpi-card"><span>Rhythmus</span><strong>{streak}</strong><small>{plural(streak, 'Tag', 'Tage')} · {getLevelFromScore(lastSeven.reduce((s, i) => s + i.score, 0))}</small></div>
      </div>

      <div className="progress-layout">
        <section className="card chart-card">
          <SectionTitle eyebrow="Woche" title="Tagesverlauf" />
          <div className="bar-chart" role="img" aria-label="Tageswerte der letzten sieben Tage">
            {lastSeven.map(item => (
              <div className="bar-column" key={item.date}>
                <span className="bar-value">{item.score}</span>
                <div className="bar-track">
                  <span style={{ height: `${Math.max(item.score, 4)}%` }} />
                </div>
                <strong>{new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(fromDateKey(item.date)).replace('.', '')}</strong>
                <small>{formatShortDate(item.date)}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="card rhythm-card">
          <SectionTitle eyebrow="Gewohnheiten" title="Was trägt dich?" />
          <div className="rhythm-list">
            {habitStats.map(stat => {
              const Icon = stat.icon
              return (
                <div className="rhythm-row" key={stat.label}>
                  <span className="rhythm-row__icon"><Icon size={17} /></span>
                  <div>
                    <strong>{stat.label}</strong>
                    <span>{stat.count} von 7 Tagen</span>
                  </div>
                  <div className="radial-mini" style={{ '--value': `${(stat.count / 7) * 360}deg` } as CSSProperties}>
                    <span>{stat.count}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

function TaskEditor({
  initialValue,
  isEditing,
  onClose,
  onSave,
}: {
  initialValue: string
  isEditing: boolean
  onClose: () => void
  onSave: (value: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  useModalBehavior(onClose)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSave(value)
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <form className="modal modal--small" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
        <div className="modal-header">
          <div>
            <span className="eyebrow">Tagesanker</span>
            <h2 id="task-editor-title">{isEditing ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</h2>
          </div>
          <IconButton label="Schließen" onClick={onClose}><X size={18} /></IconButton>
        </div>
        <label className="text-field">
          <span>Aufgabe</span>
          <input autoFocus value={value} onChange={event => setValue(event.target.value)} maxLength={120} placeholder="Zum Beispiel: Creatine bestellen" />
        </label>
        <p className="field-hint">Formuliere so klein, dass du ohne Nachdenken anfangen kannst.</p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="primary-button" disabled={!value.trim()}><Check size={17} /> Speichern</button>
        </div>
      </form>
    </div>
  )
}

function FocusModal({
  session,
  onChangeMinutes,
  onClose,
  onFinish,
}: {
  session: FocusSession
  onChangeMinutes: (minutes: number) => void
  onClose: () => void
  onFinish: () => void
}) {
  const [secondsLeft, setSecondsLeft] = useState(session.minutes * 60)
  const [running, setRunning] = useState(false)
  useModalBehavior(onClose)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSecondsLeft(session.minutes * 60)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRunning(false)
  }, [session.minutes])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setSecondsLeft(current => {
        if (current <= 1) {
          window.clearInterval(timer)
          setRunning(false)
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Fokusblock beendet', { body: session.title })
          }
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running, session.title])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const progress = 1 - secondsLeft / (session.minutes * 60)

  return (
    <div className="focus-overlay" role="dialog" aria-modal="true" aria-labelledby="focus-title">
      <div className="focus-noise" aria-hidden="true" />
      <div className="focus-topbar">
        <div className="brand brand--focus"><div className="brand__mark"><span /></div><strong>Life OS</strong></div>
        <IconButton label="Fokusmodus schließen" onClick={onClose}><X size={19} /></IconButton>
      </div>
      <div className="focus-content">
        <span className="eyebrow">Nur jetzt</span>
        <h1 id="focus-title">{session.title}</h1>
        <div
          className="focus-timer"
          style={{ '--focus-progress': `${progress * 360}deg` } as CSSProperties}
        >
          <div>
            <strong>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</strong>
            <span>{running ? 'Bleib bei diesem Schritt' : secondsLeft === 0 ? 'Zeit ist um' : 'Bereit, wenn du es bist'}</span>
          </div>
        </div>
        <div className="focus-duration-row">
          {[10, 25, 45].map(value => (
            <button type="button" key={value} className={session.minutes === value ? 'is-active' : ''} onClick={() => onChangeMinutes(value)} disabled={running}>
              {value} Min.
            </button>
          ))}
        </div>
        <div className="focus-controls">
          <button type="button" className="secondary-button" onClick={() => { setRunning(false); setSecondsLeft(session.minutes * 60) }}>
            <RotateCcw size={17} /> Reset
          </button>
          <button type="button" className="focus-play" onClick={() => setRunning(current => !current)}>
            {running ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
          </button>
          <button type="button" className="primary-button" onClick={onFinish}>
            <Check size={17} /> Fertig
          </button>
        </div>
      </div>
    </div>
  )
}

function SettingsModal({
  settings,
  onChange,
  onClose,
}: {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
  onClose: () => void
}) {
  useModalBehavior(onClose)

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <div className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-header">
          <div><span className="eyebrow">Life OS</span><h2 id="settings-title">Einstellungen</h2></div>
          <IconButton label="Schließen" onClick={onClose}><X size={18} /></IconButton>
        </div>

        <div className="settings-section">
          <h3>Tägliche Gewohnheiten</h3>
          <p style={{ margin: '-6px 0 12px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Aktive Habits erscheinen täglich in der Routine-Karte.
          </p>
          <div className="choice-grid">
            {DAILY_HABITS.map(h => {
              const active = settings.activeHabits.includes(h.id)
              return (
                <button
                  type="button"
                  key={h.id}
                  className={active ? 'choice-button is-active' : 'choice-button'}
                  onClick={() => onChange({
                    ...settings,
                    activeHabits: active
                      ? settings.activeHabits.filter(id => id !== h.id)
                      : [...settings.activeHabits, h.id],
                  })}
                  aria-pressed={active}
                >
                  {h.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="settings-section">
          <h3>Darstellung</h3>
          <div className="theme-segment" role="group" aria-label="Farbschema">
            {(['light', 'dark', 'system'] as ThemePreference[]).map(theme => (
              <button
                type="button"
                key={theme}
                className={settings.theme === theme ? 'is-active' : ''}
                onClick={() => onChange({ ...settings, theme })}
                aria-pressed={settings.theme === theme}
              >
                {theme === 'light' ? <Sun size={16} /> : theme === 'dark' ? <Moon size={16} /> : <Sparkles size={16} />}
                {theme === 'light' ? 'Hell' : theme === 'dark' ? 'Dunkel' : 'System'}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section settings-grid">
          <label className="text-field"><span>Name</span><input value={settings.name} onChange={event => onChange({ ...settings, name: event.target.value })} /></label>
          <label className="text-field"><span>Standard-Fokus</span><input type="number" min="5" max="120" step="5" value={settings.focusMinutes} onChange={event => onChange({ ...settings, focusMinutes: clampNumber(Number(event.target.value) || 25, 5, 120) })} /></label>
          <label className="text-field"><span>Proteinziel in g</span><input type="number" min="50" max="400" step="5" value={settings.proteinGoal} onChange={event => onChange({ ...settings, proteinGoal: clampNumber(Number(event.target.value) || 150, 50, 400) })} /></label>
          <label className="text-field"><span>Kalorienziel</span><input type="number" min="1000" max="8000" step="50" value={settings.calorieGoal} onChange={event => onChange({ ...settings, calorieGoal: clampNumber(Number(event.target.value) || 3500, 1000, 8000) })} /></label>
        </div>

        <div className="settings-note">
          <Bell size={18} />
          <p>Benachrichtigungen werden nie ungefragt angefordert. Ein Timer-Hinweis erscheint nur, wenn du die Berechtigung bereits erteilt hast.</p>
        </div>
        <div className="modal-actions"><button type="button" className="primary-button" onClick={onClose}><Check size={17} /> Fertig</button></div>
      </div>
    </div>
  )
}

export default App
