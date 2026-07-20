import {
  useEffect,
  useRef,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
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
  CreditCard,
  Crown,
  Droplet,
  Dumbbell,
  FlaskConical,
  Focus,
  GripVertical,
  Heart,
  Home,
  LayoutGrid,
  Leaf,
  ListTodo,
  Moon,
  Package,
  Pause,
  Pencil,
  Pill,
  Play,
  Plus,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingCart,
  Snowflake,
  Sparkles,
  Sun,
  Target,
  Timer,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useEntries } from './hooks/useEntries'
import type { DashboardEntry } from './types/DashboardEntry'
import { createDefaultEntry } from './types/DashboardEntry'
import { calculateScore, calculateStreakForHabit, getScoreBreakdown } from './lib/score'
import { exportJSON, importJSON, saveAllEntries } from './lib/storage'
import { levelProgress, loadXP, xpToNextLevel } from './lib/xp-store'
import './launch.css'

type View = 'today' | 'plan' | 'checkin' | 'progress' | 'dashboardPlus'
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

type DashboardPlusPriority = 'p1' | 'p2' | 'p3' | 'p4'

const PRIORITY_ORDER: DashboardPlusPriority[] = ['p1', 'p2', 'p3', 'p4']

const PRIORITY_META: Record<DashboardPlusPriority, { label: string; color: string }> = {
  p1: { label: 'P1', color: 'var(--danger)' },
  p2: { label: 'P2', color: 'var(--warning)' },
  p3: { label: 'P3', color: 'var(--blue)' },
  p4: { label: 'P4', color: 'var(--text-muted)' },
}

function nextPriority(current: DashboardPlusPriority): DashboardPlusPriority {
  const index = PRIORITY_ORDER.indexOf(current)
  return PRIORITY_ORDER[(index + 1) % PRIORITY_ORDER.length]
}

type DashboardPlusTask = {
  id: string
  title: string
  tag: string
  time: string
  done: boolean
  priority: DashboardPlusPriority
}

type DashboardPlusSupplement = {
  id: string
  name: string
  brand: string
  stock: number
  unit: string
  dailyUse: number
  dailyUnit: string
  color: string
}

type DashboardPlusBoard = {
  id: string
  label: string
  count: number
  tasks: DashboardPlusTask[]
}

type DashboardPlusShoppingIcon = 'flask' | 'droplet' | 'pill'

type DashboardPlusShoppingItem = {
  id: string
  icon: DashboardPlusShoppingIcon
  name: string
  note: string
  price: number
  done: boolean
  lowStock?: boolean
}

const SHOPPING_ICONS: Record<DashboardPlusShoppingIcon, { icon: typeof FlaskConical; tint: string; ink: string }> = {
  flask: { icon: FlaskConical, tint: 'var(--accent-soft)', ink: 'var(--accent-strong)' },
  droplet: { icon: Droplet, tint: 'color-mix(in srgb, var(--blue) 16%, transparent)', ink: 'var(--blue)' },
  pill: { icon: Pill, tint: 'var(--sage-soft)', ink: 'var(--sage)' },
}

type DashboardPlusBill = {
  id: string
  name: string
  subtitle: string
  amount: number
  due: string
  status: 'paid' | 'open' | 'overdue'
  color: string
}

type DashboardPlusMedication = {
  id: string
  name: string
  dosage: string
  time: string
  notes: string
  effect: string
  sideEffects: string
  taken: boolean
  color: string
}

type DashboardPlusGoalTimeframe = 'Jahr' | 'Quartal' | 'Monat' | 'Woche'

type DashboardPlusGoal = {
  id: string
  title: string
  timeframe: DashboardPlusGoalTimeframe
  percent: number
  dueDate: string
  color: string
}

type DashboardPlusState = {
  overview: {
    dateLabel: string
    syncStatus: string
    syncTime: string
    score: number
    habits: number
    todos: number
    projects: number
  }
  focusTodos: DashboardPlusTask[]
  supplements: DashboardPlusSupplement[]
  medications: DashboardPlusMedication[]
  goals: DashboardPlusGoal[]
  boards: DashboardPlusBoard[]
  shopping: {
    total: number
    items: DashboardPlusShoppingItem[]
  }
  stats: {
    average: number
    best: number
    rhythm: number
    weight: number
    weeklyBars: number[]
    heatmap: number[]
    projects: Array<{ id: string; name: string; percent: number; color: string }>
  }
  finances: {
    monthlyFixed: number
    open: number
    overdue: number
    recurring: DashboardPlusBill[]
    openBills: DashboardPlusBill[]
  }
}

const DASHBOARD_PLUS_TABS = [
  { id: 'overview', label: 'Übersicht', icon: LayoutGrid },
  { id: 'todos', label: 'Todos', icon: ListTodo },
  { id: 'stock', label: 'Bestände', icon: Package },
  { id: 'medications', label: 'Medis', icon: Pill },
  { id: 'goals', label: 'Ziele', icon: Target },
  { id: 'shopping', label: 'Kaufliste', icon: ShoppingCart },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'finance', label: 'Finanzen', icon: CreditCard },
] as const

type DashboardPlusSection = (typeof DASHBOARD_PLUS_TABS)[number]['id']

const SETTINGS_KEY = 'life-os-v1-settings'
const DASHBOARD_PLUS_KEY = 'life-os-v1-dashboard-plus'

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

const LVLS = ['Einstieg', 'Aufbau', 'Übung', 'Rhythmus', 'Konstanz', 'Gefestigt', 'Vertieft', 'Verankert', 'Meisterschaft', 'Souverän'] as const

/** Maps the persisted xp-store level (unbounded) onto the LVLS name ladder. */
function levelName(level: number): string {
  return LVLS[Math.min(Math.max(level, 1), LVLS.length) - 1]
}

type HabitDef = {
  id: RoutineKey
  label: string
  category: string
  minutes?: number
  icon: React.ComponentType<{ size?: number }>
}

const DAILY_HABITS: HabitDef[] = [
  { id: 'breathingDone',   label: '11 Min. Atmung',    category: 'Mind', minutes: 11, icon: Brain    },
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

function createDashboardPlusSeed(): DashboardPlusState {
  return {
    overview: {
      dateLabel: 'Sonntag, 1. Jun 2026',
      syncStatus: 'Bereit',
      syncTime: 'gerade eben',
      score: 76,
      habits: 8,
      todos: 5,
      projects: 3,
    },
    focusTodos: [
      { id: 'focus-1', title: 'Creatine bestellen (Lager fast leer)', tag: 'DRINGEND', time: 'heute', done: false, priority: 'p1' },
      { id: 'focus-2', title: 'Morning Routine abschließen', tag: 'PERSONAL', time: '08:15', done: true, priority: 'p2' },
      { id: 'focus-3', title: 'Landing Page copy finalisieren', tag: 'MONDAS', time: '14:00', done: false, priority: 'p3' },
    ],
    supplements: [
      { id: 'supp-1', name: 'Hüttenkäse', brand: '500g Becher', stock: 400, unit: 'g', dailyUse: 200, dailyUnit: 'g', color: '#0a84ff' },
      { id: 'supp-2', name: 'Creatine Monohydrate', brand: 'BulkPowders · 500g', stock: 60, unit: 'g', dailyUse: 10, dailyUnit: 'g', color: '#ff3b30' },
      { id: 'supp-3', name: 'Haferflocken', brand: 'Naturgut · 1kg', stock: 600, unit: 'g', dailyUse: 80, dailyUnit: 'g', color: '#7c7bff' },
      { id: 'supp-4', name: 'Omega-3', brand: 'Optimum · 180 Caps', stock: 63, unit: 'Caps', dailyUse: 2, dailyUnit: 'Caps', color: '#ff9f0a' },
      { id: 'supp-5', name: 'Vitamin D3 + K2', brand: 'Now Foods · 365 Caps', stock: 299, unit: 'Caps', dailyUse: 1, dailyUnit: 'Caps', color: '#5ac8fa' },
    ],
    medications: [
      { id: 'med-1', name: 'Magnesium Bisglycinate', dosage: '400 mg', time: '21:00', notes: 'Mit Abendessen', effect: 'Bessere Schlafqualität', sideEffects: '—', taken: false, color: 'var(--accent)' },
      { id: 'med-2', name: 'Vitamin D3', dosage: '2000 IE', time: '08:00', notes: 'Zum Frühstück', effect: 'Stimmung, Immunsystem', sideEffects: '—', taken: true, color: 'var(--blue)' },
    ],
    goals: [
      { id: 'goal-1', title: '80kg Zielgewicht erreichen', timeframe: 'Quartal', percent: 45, dueDate: '2026-09-30', color: 'var(--accent)' },
      { id: 'goal-2', title: 'Mondas Relaunch abschließen', timeframe: 'Monat', percent: 70, dueDate: '2026-08-15', color: 'var(--blue)' },
      { id: 'goal-3', title: '4x Training diese Woche', timeframe: 'Woche', percent: 50, dueDate: '2026-07-26', color: 'var(--sage)' },
    ],
    boards: [
      {
        id: 'personal',
        label: 'Personal',
        count: 4,
        tasks: [
          { id: 'personal-1', title: 'Morning Routine', tag: '', time: '08:15', done: true, priority: 'p3' },
          { id: 'personal-2', title: 'Training absolviert', tag: '', time: '09:45', done: true, priority: 'p2' },
          { id: 'personal-3', title: 'Creatine bestellen', tag: 'HEUTE', time: '', done: false, priority: 'p1' },
          { id: 'personal-4', title: 'Arzttermin vereinbaren', tag: 'DIESE WOCHE', time: '', done: false, priority: 'p3' },
        ],
      },
      {
        id: 'mondas',
        label: 'Mondas',
        count: 6,
        tasks: [
          { id: 'mondas-1', title: 'Social Media Post geplant', tag: '', time: '10:30', done: true, priority: 'p3' },
          { id: 'mondas-2', title: 'Landing Page copy finalisieren', tag: 'DEADLINE', time: '14:00', done: false, priority: 'p1' },
          { id: 'mondas-3', title: 'Speisekarte für Sommer aktualisieren', tag: 'DIESE WOCHE', time: '', done: false, priority: 'p2' },
          { id: 'mondas-4', title: 'Dienstplan KW 24 erstellen', tag: '', time: '', done: false, priority: 'p3' },
        ],
      },
      {
        id: 'health',
        label: 'Health',
        count: 3,
        tasks: [
          { id: 'health-1', title: 'Training — Brust/Trizeps', tag: '', time: '', done: true, priority: 'p3' },
          { id: 'health-2', title: 'Creatine + Omega-3 nehmen', tag: 'TÄGLICH', time: '', done: false, priority: 'p2' },
          { id: 'health-3', title: 'Protein-Ziel 180g erreichen', tag: '', time: '', done: false, priority: 'p3' },
        ],
      },
      {
        id: 'coding',
        label: 'Coding',
        count: 5,
        tasks: [],
      },
    ],
    shopping: {
      total: 89.90,
      items: [
        { id: 'shop-1', icon: 'flask', name: 'Creatine Monohydrate 1kg', note: 'BulkPowders', price: 24.99, done: false, lowStock: true },
        { id: 'shop-2', icon: 'droplet', name: 'Omega-3 Nachfüllpack', note: 'Optimum · 300 Caps', price: 34.90, done: false },
        { id: 'shop-3', icon: 'pill', name: 'Magnesium Bisglycinate', note: 'Bioptimizers · 240 Caps', price: 34.00, done: false },
      ],
    },
    stats: {
      average: 74,
      best: 12,
      rhythm: 9,
      weight: 76.2,
      weeklyBars: [55, 72, 48, 85, 91, 63, 76],
      heatmap: [1, 2, 3, 4, 3, 2, 1, 0, 2, 3, 4, 4, 3, 2, 2, 3, 1, 0, 1, 3, 4, 3, 2, 1, 0, 2, 3, 4],
      projects: [
        { id: 'proj-personal', name: 'Personal', percent: 50, color: 'var(--accent)' },
        { id: 'proj-mondas', name: 'Mondas', percent: 17, color: 'var(--orange)' },
        { id: 'proj-health', name: 'Health', percent: 33, color: 'var(--green)' },
      ],
    },
    finances: {
      monthlyFixed: 847,
      open: 340,
      overdue: 89,
      recurring: [
        { id: 'bill-rent', name: 'Miete', subtitle: 'Monatlich · 1. jeden Monat', amount: 520, due: 'nächste: 01.06', status: 'open', color: 'var(--accent)' },
        { id: 'bill-power', name: 'Strom · Vattenfall', subtitle: 'Monatlich · 15. jeden Monat', amount: 89, due: 'nächste: 15.06', status: 'open', color: 'var(--teal)' },
        { id: 'bill-internet', name: 'Internet · Telekom', subtitle: 'Monatlich · 20. jeden Monat', amount: 44, due: 'nächste: 20.06', status: 'open', color: 'var(--green)' },
        { id: 'bill-streaming', name: 'Spotify + Netflix', subtitle: 'Monatlich · 5. jeden Monat', amount: 28, due: 'nächste: 05.06', status: 'open', color: '#bf5af2' },
        { id: 'bill-gym', name: 'Gym · McFit', subtitle: 'Monatlich · 1. jeden Monat', amount: 24, due: 'nächste: 01.06', status: 'open', color: 'var(--orange)' },
        { id: 'bill-icloud', name: 'iCloud 200GB', subtitle: 'Monatlich · 12. jeden Monat', amount: 3, due: 'nächste: 12.06', status: 'open', color: 'var(--accent2)' },
      ],
      openBills: [
        { id: 'bill-tax', name: 'Steuerberater', subtitle: 'Fällig: 15.05.2026', amount: 89, due: '16 Tage überfällig', status: 'overdue', color: 'var(--red)' },
        { id: 'bill-design', name: 'Lieferant Design-Assets', subtitle: 'Fällig: 05.06.2026', amount: 149, due: 'in 5 Tagen', status: 'open', color: 'var(--orange)' },
        { id: 'bill-figma', name: 'Software-Lizenz Figma', subtitle: 'Fällig: 15.06.2026', amount: 102, due: 'in 15 Tagen', status: 'open', color: 'var(--orange)' },
        { id: 'bill-vercel', name: 'Hosting · Vercel Pro', subtitle: 'Bezahlt am 01.05.2026', amount: 20, due: 'Bezahlt', status: 'paid', color: 'var(--green)' },
      ],
    },
  }
}

function loadDashboardPlusState(): DashboardPlusState {
  try {
    const stored = localStorage.getItem(DASHBOARD_PLUS_KEY)
    if (!stored) return createDashboardPlusSeed()
    const parsed = JSON.parse(stored) as DashboardPlusState
    if (!parsed || !parsed.overview || !Array.isArray(parsed.focusTodos)) return createDashboardPlusSeed()
    return parsed
  } catch {
    return createDashboardPlusSeed()
  }
}

const DEFAULT_ACTIVE_HABITS = ['breathingDone', 'coldShower', 'proteinShake', 'pushupsDone', 'gratitudeDone']

const DEFAULT_SETTINGS: AppSettings = {
  name: '',
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

function daysUntil(targetKey: string, todayKey: string): number {
  const ms = fromDateKey(targetKey).getTime() - fromDateKey(todayKey).getTime()
  return Math.round(ms / 86_400_000)
}

type QuickAddResult =
  | { kind: 'weight'; value: number }
  | { kind: 'calories'; value: number }
  | { kind: 'water'; value: number }
  | { kind: 'task'; title: string }

/** Deliberately simple pattern matching, no NLP/AI — a handful of unit
 * suffixes route straight into the matching daily metric, everything else
 * becomes a new task. */
function parseQuickAdd(raw: string): QuickAddResult {
  const text = raw.trim()
  const toNumber = (match: string) => Number(match.replace(',', '.'))

  const weight = text.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i)
  if (weight) return { kind: 'weight', value: toNumber(weight[1]) }

  const calories = text.match(/(\d+(?:[.,]\d+)?)\s*kcal\b/i)
  if (calories) return { kind: 'calories', value: toNumber(calories[1]) }

  const water = text.match(/(\d+(?:[.,]\d+)?)\s*(?:l|liter)\b/i)
  if (water) return { kind: 'water', value: toNumber(water[1]) }

  return { kind: 'task', title: text }
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

function BadgeButton({
  label,
  children,
  onClick,
  className = '',
}: {
  label: string
  children: ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      className={`badge-button ${className}`.trim()}
      aria-label={label}
      title={label}
      onClick={onClick}
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

function PriorityBadge({ priority, onCycle }: { priority: DashboardPlusPriority; onCycle: () => void }) {
  const meta = PRIORITY_META[priority]
  return (
    <button
      type="button"
      className="priority-badge"
      style={{ '--priority-color': meta.color } as CSSProperties}
      onClick={onCycle}
      aria-label={`Priorität ${meta.label} — klicken zum Ändern`}
      title={`Priorität ${meta.label}`}
    >
      {meta.label}
    </button>
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
  const { entries, syncStatus, isOnline, saveEntry, reloadAll } = useEntries()
  const [view, setView] = useState<View>('today')
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()))
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [dashboardPlus, setDashboardPlus] = useState<DashboardPlusState>(loadDashboardPlusState)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [taskEditor, setTaskEditor] = useState<{ index: number | null; value: string } | null>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const dashboardPlusRouteLock = useRef<string | null>(null)

  const today = dateKey(new Date())
  const entry = useMemo(
    () => entries.find(item => item.date === selectedDate) ?? createDefaultEntry(selectedDate),
    [entries, selectedDate],
  )

  const score = clampNumber(calculateScore(entry), 0, 100)
  const anchors = entry.anchors ?? []
  const anchorsDone = entry.anchorsDone ?? []
  const completedAnchors = anchors.filter((_, index) => Boolean(anchorsDone[index])).length
  const activeRoutineDefinitions = useMemo(
    () => settings.activeHabits
      .map(id => DAILY_HABITS.find(item => item.id === id))
      .filter((item): item is HabitDef => item !== undefined),
    [settings.activeHabits],
  )
  const dashboardPlusReady = useMemo(() => {
    const routinesComplete = activeRoutineDefinitions.length === 0
      || activeRoutineDefinitions.every(item => Boolean(entry[item.id as keyof DashboardEntry]))
    const anchorsComplete = anchors.length === 0 || anchors.every((_, index) => Boolean(anchorsDone[index]))
    const dreamComplete = entry.dreamed === undefined
      ? false
      : entry.dreamed === false
        ? true
        : Boolean(entry.dreamQuality)
    const needsMorningWeight = selectedDate === today && new Date().getHours() < 12
    const weightComplete = !needsMorningWeight || entry.weightKg > 0

    return Boolean(entry.mood)
      && Boolean(entry.sleepQuality)
      && Boolean(entry.sleepDuration)
      && Boolean(entry.energyLevel)
      && routinesComplete
      && anchorsComplete
      && dreamComplete
      && weightComplete
  }, [activeRoutineDefinitions, anchors, anchorsDone, entry, selectedDate, today])

  const updateEntry = (patch: Partial<DashboardEntry>) => {
    void saveEntry({ ...entry, ...patch })
  }

  useEffect(() => {
    safeLocalStorageSetItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    safeLocalStorageSetItem(DASHBOARD_PLUS_KEY, JSON.stringify(dashboardPlus))
  }, [dashboardPlus])

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

  useEffect(() => {
    if (selectedDate !== today) {
      dashboardPlusRouteLock.current = null
      return
    }

    if (!dashboardPlusReady) return

    if (view !== 'dashboardPlus' && dashboardPlusRouteLock.current !== today) {
      dashboardPlusRouteLock.current = today
      setView('dashboardPlus')
    }
  }, [dashboardPlusReady, selectedDate, today, view])

  const showToast = (message: string, actionLabel?: string, onAction?: () => void) => {
    setToast({ message, actionLabel, onAction })
  }

  const handleExport = () => {
    exportJSON(entries)
    showToast('Backup exportiert.')
  }

  const handleImport = async (file: File) => {
    try {
      const imported = await importJSON(file)
      const normalized = imported.map(entry => ({ ...entry, dailyScore: calculateScore(entry) }))
      if (!saveAllEntries(normalized)) throw new Error('localStorage unavailable')
      await reloadAll()
      showToast('Backup importiert.')
    } catch {
      showToast('Import fehlgeschlagen.')
    }
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

  const quickAddTask = (title: string) => {
    saveTask(title, null)
    setQuickAddOpen(false)
  }

  const quickAddWeight = (value: number) => {
    updateEntry({ weightKg: value })
    setQuickAddOpen(false)
    showToast(`Gewicht gespeichert: ${value} kg`)
  }

  const quickAddCalories = (value: number) => {
    updateEntry({ calories: value, caloriesReached: value >= settings.calorieGoal })
    setQuickAddOpen(false)
    showToast(`Kalorien gespeichert: ${value} kcal`)
  }

  const quickAddWater = (value: number) => {
    updateEntry({ waterLiters: value })
    setQuickAddOpen(false)
    showToast(`Wasser gespeichert: ${value} L`)
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

  const openFocus = (title: string, taskIndex?: number, routineKey?: RoutineKey, overrideMinutes?: number) => {
    setFocusSession({
      title,
      minutes: clampNumber(overrideMinutes ?? settings.focusMinutes, 5, 120),
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
      // task focus block always counts as a focus session
      updateEntry({ focusDone: true } as Partial<DashboardEntry>)
    } else if (focusSession.routineKey) {
      // only mark the specific routine key; only set focusDone if that IS the focus habit
      updateEntry({
        [focusSession.routineKey]: true,
        ...(focusSession.routineKey === 'focusDone' ? {} : {}),
      } as Partial<DashboardEntry>)
    } else {
      updateEntry({ focusDone: true } as Partial<DashboardEntry>)
    }
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

  const currentViewLabel = view === 'dashboardPlus'
    ? 'Dashboard+'
    : NAV_ITEMS.find(item => item.id === view)?.label ?? 'Heute'
  const navigateTo = (nextView: View) => {
    setView(nextView)
    if (nextView === 'today' || nextView === 'dashboardPlus') setSelectedDate(today)
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
            <BadgeButton label="Dashboard+ öffnen" onClick={() => navigateTo('dashboardPlus')} className="badge-button--icon">
              <Crown size={16} />
            </BadgeButton>
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
              <h1>{greeting()}{settings.name.trim() ? `, ${settings.name.trim()}` : ''}.</h1>
            </div>
            <div className="topbar-actions">
              <span className={`sync-pill sync-pill--${syncStatus}`}>
                <Cloud size={14} />
                {isOnline ? (syncStatus === 'syncing' ? 'Speichert …' : 'Bereit') : 'Offline'}
              </span>
              <BadgeButton label="Dashboard+ öffnen" onClick={() => navigateTo('dashboardPlus')} className="badge-button--icon">
                <Crown size={16} />
              </BadgeButton>
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
              onReorderHabits={ids => setSettings(current => ({ ...current, activeHabits: ids }))}
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

          {view === 'dashboardPlus' && (
            <DashboardPlusView
              dashboard={dashboardPlus}
              onChange={setDashboardPlus}
              onBackToToday={() => navigateTo('today')}
              today={today}
            />
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

        {view !== 'dashboardPlus' && (
          <button type="button" className="fab" onClick={() => setQuickAddOpen(true)} aria-label="Schnell hinzufügen">
            <Plus size={22} />
          </button>
        )}
      </div>

      {taskEditor && (
        <TaskEditor
          initialValue={taskEditor.value}
          isEditing={taskEditor.index !== null}
          onClose={() => setTaskEditor(null)}
          onSave={value => saveTask(value, taskEditor.index)}
        />
      )}

      {quickAddOpen && (
        <QuickAddModal
          onClose={() => setQuickAddOpen(false)}
          onSubmitTask={quickAddTask}
          onSubmitWeight={quickAddWeight}
          onSubmitCalories={quickAddCalories}
          onSubmitWater={quickAddWater}
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
          onExport={handleExport}
          onImport={handleImport}
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
  onReorderHabits,
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
  onOpenFocus: (title: string, taskIndex?: number, routineKey?: RoutineKey, overrideMinutes?: number) => void
  onReorderHabits: (ids: string[]) => void
  onOpenPlan: () => void
  onOpenCheckin: () => void
  showToast: (message: string) => void
}) {
  const [capture, setCapture] = useState('')
  const [dragIdx,     setDragIdx]     = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const touchRef = useRef<{ sourceIdx: number } | null>(null)

  const energy = entry.energyLevel
  // Preserve the order from settings.activeHabits
  const routineItems = settings.activeHabits
    .map(id => DAILY_HABITS.find(h => h.id === id))
    .filter((h): h is HabitDef => h !== undefined)
    .map(h => ({
      key: h.id,
      label: h.label,
      icon: h.icon,
      minutes: h.minutes,
      done: Boolean(entry[h.id as keyof DashboardEntry]),
    }))

  const applyReorder = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return
    const next = [...settings.activeHabits]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    onReorderHabits(next)
  }

  const handleDrop = (toIdx: number) => {
    if (dragIdx !== null) applyReorder(dragIdx, toIdx)
    setDragIdx(null)
    setDragOverIdx(null)
  }

  const handleTouchStart = (_e: React.TouchEvent, idx: number) => {
    touchRef.current = { sourceIdx: idx }
    setDragIdx(idx)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchRef.current) return
    e.preventDefault()
    const touch = e.touches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const item = el?.closest('[data-rindex]')
    if (item) {
      const idx = parseInt(item.getAttribute('data-rindex') ?? '-1', 10)
      if (idx >= 0) setDragOverIdx(idx)
    }
  }

  const handleTouchEnd = () => {
    if (touchRef.current !== null && dragOverIdx !== null) {
      applyReorder(touchRef.current.sourceIdx, dragOverIdx)
    }
    touchRef.current = null
    setDragIdx(null)
    setDragOverIdx(null)
  }

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
            {(nextTaskIndex >= 0 || nextRoutine) && (() => {
              const routineMinutes = nextTaskIndex < 0 ? nextRoutine?.minutes : undefined
              const displayMinutes = routineMinutes ?? settings.focusMinutes
              return (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onOpenFocus(
                    focusTitle,
                    nextTaskIndex >= 0 ? nextTaskIndex : undefined,
                    nextTaskIndex < 0 ? nextRoutine?.key : undefined,
                    routineMinutes,
                  )}
                >
                  <Play size={17} fill="currentColor" />
                  Fokus starten
                  <span>{displayMinutes} Min.</span>
                </button>
              )
            })()}
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
            {routineItems.map((item, index) => {
              const Icon = item.icon
              const isDragging = dragIdx === index
              const isOver     = dragOverIdx === index && dragIdx !== index
              return (
                <div
                  key={item.key}
                  data-rindex={String(index)}
                  className={[
                    'routine-item',
                    item.done  ? 'is-done'     : '',
                    isDragging ? 'is-dragging'  : '',
                    isOver     ? 'is-drag-over' : '',
                  ].filter(Boolean).join(' ')}
                  onDragOver={e => { e.preventDefault(); setDragOverIdx(index) }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                >
                  <button
                    type="button"
                    className="drag-handle"
                    draggable
                    aria-label={`Reihenfolge von ${item.label} ändern`}
                    aria-grabbed={dragIdx === index}
                    onDragStart={e => { e.stopPropagation(); setDragIdx(index) }}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                    onTouchStart={e => handleTouchStart(e, index)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onKeyDown={event => {
                      if (event.key === 'ArrowUp') {
                        event.preventDefault()
                        applyReorder(index, Math.max(0, index - 1))
                      }
                      if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        applyReorder(index, Math.min(routineItems.length - 1, index + 1))
                      }
                      if (event.key === 'Home') {
                        event.preventDefault()
                        applyReorder(index, 0)
                      }
                      if (event.key === 'End') {
                        event.preventDefault()
                        applyReorder(index, routineItems.length - 1)
                      }
                    }}
                  >
                    <GripVertical size={13} />
                  </button>
                  <span className="routine-item__icon"><Icon size={18} /></span>
                  <button
                    type="button"
                    className="routine-item__main"
                    onClick={() => {
                      if (!item.done) {
                        onOpenFocus(item.label, undefined, item.key as RoutineKey, item.minutes)
                      } else {
                        onUpdate({ [item.key]: false } as Partial<DashboardEntry>)
                      }
                    }}
                    aria-pressed={item.done}
                  >
                    {item.label}
                  </button>
                  <span className="routine-item__state">
                    {item.done ? <Check size={16} /> : <ChevronRight size={16} />}
                  </span>
                </div>
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

          {/* Sleep quality */}
          <p className="field-hint" style={{ marginBottom: 8 }}>Qualität</p>
          <div className="choice-grid" style={{ marginBottom: 16 }}>
            {SLEEP_QUALITY.map(opt => (
              <button
                type="button"
                key={opt}
                className={entry.sleepQuality === opt ? 'choice-button is-active' : 'choice-button'}
                onClick={() => onUpdate({ sleepQuality: entry.sleepQuality === opt ? '' : opt })}
                aria-pressed={entry.sleepQuality === opt}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* Sleep duration */}
          <p className="field-hint" style={{ marginBottom: 8 }}>Dauer</p>
          <div className="choice-grid" style={{ marginBottom: 16 }}>
            {SLEEP_DURATION.map(opt => (
              <button
                type="button"
                key={opt}
                className={entry.sleepDuration === opt ? 'choice-button is-active' : 'choice-button'}
                onClick={() => onUpdate({ sleepDuration: entry.sleepDuration === opt ? '' : opt })}
                aria-pressed={entry.sleepDuration === opt}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* Dreamed */}
          <p className="field-hint" style={{ marginBottom: 8 }}>Geträumt?</p>
          <div className="choice-grid" style={{ marginBottom: entry.dreamed ? 12 : 0 }}>
            {(['Ja', 'Nein'] as const).map(opt => {
              const active = opt === 'Ja' ? entry.dreamed === true : entry.dreamed === false
              return (
                <button
                  type="button"
                  key={opt}
                  className={active ? 'choice-button is-active' : 'choice-button'}
                  onClick={() => onUpdate({
                    dreamed: opt === 'Ja',
                    dreamQuality: opt === 'Nein' ? undefined : entry.dreamQuality,
                  })}
                  aria-pressed={active}
                >
                  {opt}
                </button>
              )
            })}
          </div>
          {entry.dreamed === true && (
            <div className="choice-grid">
              {(['Gut', 'Schlecht'] as const).map(opt => {
                const val = opt.toLowerCase() as 'gut' | 'schlecht'
                return (
                  <button
                    type="button"
                    key={opt}
                    className={entry.dreamQuality === val ? 'choice-button is-active' : 'choice-button'}
                    onClick={() => onUpdate({ dreamQuality: entry.dreamQuality === val ? undefined : val })}
                    aria-pressed={entry.dreamQuality === val}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="card checkin-card checkin-card--wide">
          {(() => {
            const isMorning = date === today && new Date().getHours() < 12
            return (
              <>
                <SectionTitle
                  eyebrow="Ernährung"
                  title={isMorning ? 'Morgen-Protokoll' : 'Körper versorgen'}
                />
                {isMorning ? (
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
                ) : (
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
                )}
              </>
            )
          })()}
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

  const xp = loadXP()

  const movementStreak = (() => {
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))
    let count = 0
    for (const entry of sorted) {
      if (entry.pushupsDone || entry.squatsDone) count += 1
      else break
    }
    return count
  })()

  const habitStats = [
    { label: 'Proteinshake', count: lastSeven.filter(item => item.entry.proteinShake).length, streak: calculateStreakForHabit(entries, 'proteinShake'), icon: Coffee },
    { label: 'Dankbarkeit', count: lastSeven.filter(item => item.entry.gratitudeDone).length, streak: calculateStreakForHabit(entries, 'gratitudeDone'), icon: Sparkles },
    { label: 'Fokus', count: lastSeven.filter(item => item.entry.focusDone).length, streak: calculateStreakForHabit(entries, 'focusDone'), icon: Focus },
    { label: 'Bewegung', count: lastSeven.filter(item => item.entry.pushupsDone || item.entry.squatsDone).length, streak: movementStreak, icon: Dumbbell },
  ]

  const todayEntry = entries.find(item => item.date === today) ?? createDefaultEntry(today)
  const breakdown = getScoreBreakdown(todayEntry)

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
        <div className="kpi-card"><span>Rhythmus</span><strong>{xp.streakDays}</strong><small>{plural(xp.streakDays, 'Tag', 'Tage')} · {levelName(xp.level)}</small></div>
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
                    <span>{stat.count} von 7 Tagen{stat.streak > 1 ? ` · ${stat.streak}er Serie` : ''}</span>
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

      <section className="card">
        <SectionTitle eyebrow="Gamification" title="Level & Fortschritt" />
        <div className="progress-ring-wrap">
          <div>
            <div className="prog-label">Level {xp.level} · {levelName(xp.level)}</div>
            <div className="prog-sub">{xp.totalXP} XP gesamt</div>
          </div>
          <div className="prog-num">{levelProgress(xp)}%</div>
        </div>
        <div className="mini-progress" aria-hidden="true">
          <span style={{ width: `${levelProgress(xp)}%` }} />
        </div>
        <p className="level-caption">
          Noch {xpToNextLevel(xp)} XP bis Level {xp.level + 1}
          {xp.streakDays > 0 ? ` · ${xp.streakDays} ${plural(xp.streakDays, 'Tag', 'Tage')} Serie (Score ≥ 50)` : ''}
        </p>
      </section>

      <section className="card">
        <SectionTitle eyebrow="Heute" title="Score im Detail" />
        <div className="breakdown-list">
          {breakdown.map(category => (
            <div className="breakdown-row" key={category.category}>
              <div className="breakdown-row__head">
                <strong>{category.category}</strong>
                <span>{category.achieved} / {category.max}</span>
              </div>
              <div className="mini-progress" aria-hidden="true">
                <span style={{ width: `${category.max ? Math.round((category.achieved / category.max) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function DashboardPlusView({
  dashboard,
  onChange,
  onBackToToday,
  today,
}: {
  dashboard: DashboardPlusState
  onChange: Dispatch<SetStateAction<DashboardPlusState>>
  onBackToToday: () => void
  today: string
}) {
  const [activeSection, setActiveSection] = useState<DashboardPlusSection>('overview')
  const [activeBoardId, setActiveBoardId] = useState(dashboard.boards[0]?.id ?? 'personal')

  useEffect(() => {
    if (!dashboard.boards.some(board => board.id === activeBoardId)) {
      setActiveBoardId(dashboard.boards[0]?.id ?? 'personal')
    }
  }, [activeBoardId, dashboard.boards])

  const activeBoard = dashboard.boards.find(board => board.id === activeBoardId) ?? dashboard.boards[0]

  const updateOverview = (patch: Partial<DashboardPlusState['overview']>) => {
    onChange(current => ({ ...current, overview: { ...current.overview, ...patch } }))
  }

  const updateFocusTask = (index: number, patch: Partial<DashboardPlusTask>) => {
    onChange(current => ({
      ...current,
      focusTodos: current.focusTodos.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }))
  }

  const addFocusTask = () => {
    onChange(current => ({
      ...current,
      focusTodos: [...current.focusTodos, { id: crypto.randomUUID(), title: 'Neue Aufgabe', tag: '', time: '', done: false, priority: 'p3' }],
    }))
  }

  const removeFocusTask = (index: number) => {
    onChange(current => ({
      ...current,
      focusTodos: current.focusTodos.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const updateSupplement = (index: number, patch: Partial<DashboardPlusSupplement>) => {
    onChange(current => ({
      ...current,
      supplements: current.supplements.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }))
  }

  const addSupplement = () => {
    onChange(current => ({
      ...current,
      supplements: [...current.supplements, { id: crypto.randomUUID(), name: 'Neues Produkt', brand: '', stock: 0, unit: 'g', dailyUse: 0, dailyUnit: 'g', color: '#7c7bff' }],
    }))
  }

  const removeSupplement = (index: number) => {
    onChange(current => ({
      ...current,
      supplements: current.supplements.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const updateMedication = (index: number, patch: Partial<DashboardPlusMedication>) => {
    onChange(current => ({
      ...current,
      medications: current.medications.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }))
  }

  const addMedication = () => {
    onChange(current => ({
      ...current,
      medications: [...current.medications, { id: crypto.randomUUID(), name: 'Neues Medikament', dosage: '', time: '', notes: '', effect: '', sideEffects: '', taken: false, color: 'var(--accent)' }],
    }))
  }

  const removeMedication = (index: number) => {
    onChange(current => ({
      ...current,
      medications: current.medications.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const updateGoal = (index: number, patch: Partial<DashboardPlusGoal>) => {
    onChange(current => ({
      ...current,
      goals: current.goals.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }))
  }

  const addGoal = () => {
    onChange(current => ({
      ...current,
      goals: [...current.goals, { id: crypto.randomUUID(), title: 'Neues Ziel', timeframe: 'Monat', percent: 0, dueDate: today, color: 'var(--accent)' }],
    }))
  }

  const removeGoal = (index: number) => {
    onChange(current => ({
      ...current,
      goals: current.goals.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const updateBoardTask = (boardId: string, taskIndex: number, patch: Partial<DashboardPlusTask>) => {
    onChange(current => ({
      ...current,
      boards: current.boards.map(board => (
        board.id === boardId
          ? { ...board, tasks: board.tasks.map((task, itemIndex) => (itemIndex === taskIndex ? { ...task, ...patch } : task)) }
          : board
      )),
    }))
  }

  const addBoardTask = (boardId: string) => {
    onChange(current => ({
      ...current,
      boards: current.boards.map(board => (
        board.id === boardId
          ? { ...board, tasks: [...board.tasks, { id: crypto.randomUUID(), title: 'Neue Board-Aufgabe', tag: '', time: '', done: false, priority: 'p3' }] }
          : board
      )),
    }))
  }

  const removeBoardTask = (boardId: string, taskIndex: number) => {
    onChange(current => ({
      ...current,
      boards: current.boards.map(board => (
        board.id === boardId
          ? { ...board, tasks: board.tasks.filter((_, itemIndex) => itemIndex !== taskIndex) }
          : board
      )),
    }))
  }

  const updateShoppingItem = (index: number, patch: Partial<DashboardPlusShoppingItem>) => {
    onChange(current => ({
      ...current,
      shopping: {
        ...current.shopping,
        items: current.shopping.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
      },
    }))
  }

  const updateRecurringBill = (index: number, patch: Partial<DashboardPlusBill>) => {
    onChange(current => ({
      ...current,
      finances: {
        ...current.finances,
        recurring: current.finances.recurring.map((bill, billIndex) => (billIndex === index ? { ...bill, ...patch } : bill)),
      },
    }))
  }

  const updateOpenBill = (index: number, patch: Partial<DashboardPlusBill>) => {
    onChange(current => ({
      ...current,
      finances: {
        ...current.finances,
        openBills: current.finances.openBills.map((bill, billIndex) => (billIndex === index ? { ...bill, ...patch } : bill)),
      },
    }))
  }

  const formatMoney = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 2, minimumFractionDigits: 0 })

  return (
    <div className="view-stack dashboard-plus-view">
      <section className="page-intro dashboard-plus-intro">
        <div>
          <span className="eyebrow">Dashboard+</span>
          <h2>Alles auf einen Blick, aber lebendig editierbar.</h2>
          <p>Das ist die projectbaby-Vorlage in unserem Life-OS-Look. Jedes Feld bleibt direkt anfassbar.</p>
        </div>
        <div className="dashboard-plus-intro__actions">
          <button type="button" className="secondary-button" onClick={onBackToToday}>
            <ChevronLeft size={16} /> Heute
          </button>
          <span className="sync-pill sync-pill--synced">
            <Cloud size={14} /> {dashboard.overview.syncStatus}
          </span>
        </div>
      </section>

      <nav className="dashboard-plus-tabbar" role="tablist" aria-label="Dashboard+ Bereiche">
        {DASHBOARD_PLUS_TABS.map(tab => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            aria-selected={activeSection === tab.id}
            className={activeSection === tab.id ? 'dashboard-plus-tab active' : 'dashboard-plus-tab'}
            onClick={() => setActiveSection(tab.id)}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {activeSection === 'overview' && (
        <section className="card dashboard-plus-hero">
          <div className="dashboard-plus-hero__meta">
            <div>
              <span className="eyebrow">{dashboard.overview.dateLabel}</span>
              <h2>Preview</h2>
            </div>
            <ProgressRing value={dashboard.overview.score} size={86} />
          </div>
          <div className="dashboard-plus-hero__stats">
            <label className="kpi-card dashboard-plus-metric">
              <span>Habits</span>
              <input type="number" min="0" value={dashboard.overview.habits} onChange={event => updateOverview({ habits: Number(event.target.value) || 0 })} />
              <small>aktiv</small>
            </label>
            <label className="kpi-card dashboard-plus-metric">
              <span>Todos</span>
              <input type="number" min="0" value={dashboard.overview.todos} onChange={event => updateOverview({ todos: Number(event.target.value) || 0 })} />
              <small>heute</small>
            </label>
            <label className="kpi-card dashboard-plus-metric">
              <span>Projekte</span>
              <input type="number" min="0" value={dashboard.overview.projects} onChange={event => updateOverview({ projects: Number(event.target.value) || 0 })} />
              <small>Boards</small>
            </label>
          </div>
        </section>
      )}

      {activeSection === 'todos' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle
            eyebrow="Tages-Fokus"
            title="Top Aufgaben"
            action={<button type="button" className="small-button" onClick={addFocusTask}><Plus size={14} /> Aufgabe</button>}
          />
          <div className="editable-task-list">
            {dashboard.focusTodos.map((task, index) => (
              <div className={task.done ? 'editable-task is-done' : 'editable-task'} key={task.id}>
                <button
                  type="button"
                  className="task-check"
                  onClick={() => updateFocusTask(index, { done: !task.done })}
                  aria-pressed={task.done}
                >
                  {task.done ? <Check size={17} /> : <Circle size={17} />}
                </button>
                <div className="editable-task__content dashboard-plus-editable-content">
                  <input
                    className="dashboard-plus-input dashboard-plus-input--title"
                    value={task.title}
                    onChange={event => updateFocusTask(index, { title: event.target.value })}
                    aria-label="Aufgabe"
                  />
                  <div className="dashboard-plus-inline-row">
                    <input
                      className="dashboard-plus-input"
                      value={task.tag}
                      onChange={event => updateFocusTask(index, { tag: event.target.value })}
                      placeholder="Tag"
                      aria-label="Tag"
                    />
                    <input
                      className="dashboard-plus-input"
                      value={task.time}
                      onChange={event => updateFocusTask(index, { time: event.target.value })}
                      placeholder="Zeit"
                      aria-label="Zeit"
                    />
                  </div>
                </div>
                <div className="editable-task__actions">
                  <PriorityBadge priority={task.priority} onCycle={() => updateFocusTask(index, { priority: nextPriority(task.priority) })} />
                  <button type="button" className="icon-button" onClick={() => removeFocusTask(index)} aria-label="Löschen">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle eyebrow="Projekte" title="Boards" />
          <div className="project-tabs dashboard-plus-tabs">
            {dashboard.boards.map(board => (
              <button
                type="button"
                key={board.id}
                className={board.id === activeBoardId ? 'project-tab active' : 'project-tab'}
                onClick={() => setActiveBoardId(board.id)}
              >
                {board.label} <span className="tab-count">{board.count}</span>
              </button>
            ))}
          </div>
          {activeBoard && (() => {
            const doneCount = activeBoard.tasks.filter(task => task.done).length
            const totalCount = activeBoard.tasks.length
            const percent = totalCount ? Math.round((doneCount / totalCount) * 100) : 0
            return (
            <>
              <div className="progress-ring-wrap dashboard-plus-board-summary">
                <div>
                  <div className="prog-label">Heute erledigt</div>
                  <div className="prog-sub">{doneCount} von {totalCount} Aufgaben</div>
                  {percent >= 80 && totalCount > 0 && (
                    <span className="status-chip status-chip--good"><span className="status-chip__dot" />Fast geschafft</span>
                  )}
                </div>
                <div className="prog-num">{percent}%</div>
              </div>
              <div className="editable-task-list">
                {activeBoard.tasks.map((task, index) => (
                  <div className={task.done ? 'editable-task is-done' : 'editable-task'} key={task.id}>
                    <button type="button" className="task-check" onClick={() => updateBoardTask(activeBoard.id, index, { done: !task.done })} aria-pressed={task.done}>
                      {task.done ? <Check size={17} /> : <Circle size={17} />}
                    </button>
                    <div className="editable-task__content dashboard-plus-editable-content">
                      <input className="dashboard-plus-input dashboard-plus-input--title" value={task.title} onChange={event => updateBoardTask(activeBoard.id, index, { title: event.target.value })} aria-label="Board Aufgabe" />
                      <div className="dashboard-plus-inline-row">
                        <input className="dashboard-plus-input" value={task.tag} onChange={event => updateBoardTask(activeBoard.id, index, { tag: event.target.value })} placeholder="Tag" />
                        <input className="dashboard-plus-input" value={task.time} onChange={event => updateBoardTask(activeBoard.id, index, { time: event.target.value })} placeholder="Zeit" />
                      </div>
                    </div>
                    <div className="editable-task__actions">
                      <PriorityBadge priority={task.priority} onCycle={() => updateBoardTask(activeBoard.id, index, { priority: nextPriority(task.priority) })} />
                      <button type="button" className="icon-button" onClick={() => removeBoardTask(activeBoard.id, index)} aria-label="Löschen">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="secondary-button secondary-button--full" onClick={() => addBoardTask(activeBoard.id)}>
                <Plus size={15} /> Aufgabe hinzufügen
              </button>
            </>
            )
          })()}
        </section>
      </div>
      )}

      {activeSection === 'stock' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle eyebrow="Supplements" title="Bestände" action={<button type="button" className="small-button" onClick={addSupplement}><Plus size={14} /> Produkt</button>} />
          <div className="dashboard-plus-supplements">
            {dashboard.supplements.map((item, index) => (
              <div className="supp-card dashboard-plus-supp-card" style={{ borderTopColor: item.color }} key={item.id}>
                <input className="dashboard-plus-input dashboard-plus-input--title" value={item.name} onChange={event => updateSupplement(index, { name: event.target.value })} />
                <input className="dashboard-plus-input" value={item.brand} onChange={event => updateSupplement(index, { brand: event.target.value })} placeholder="Marke / Info" />
                <div className="dashboard-plus-inline-row">
                  <input className="dashboard-plus-input" type="number" min="0" value={item.stock} onChange={event => updateSupplement(index, { stock: Number(event.target.value) || 0 })} />
                  <input className="dashboard-plus-input" value={item.unit} onChange={event => updateSupplement(index, { unit: event.target.value })} />
                </div>
                <div className="dashboard-plus-inline-row">
                  <input className="dashboard-plus-input" type="number" min="0" value={item.dailyUse} onChange={event => updateSupplement(index, { dailyUse: Number(event.target.value) || 0 })} />
                  <input className="dashboard-plus-input" value={item.dailyUnit} onChange={event => updateSupplement(index, { dailyUnit: event.target.value })} />
                </div>
                <input className="dashboard-plus-input dashboard-plus-input--color" value={item.color} onChange={event => updateSupplement(index, { color: event.target.value })} />
                <button type="button" className="secondary-button secondary-button--full" onClick={() => removeSupplement(index)}>
                  <Trash2 size={15} /> Entfernen
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
      )}

      {activeSection === 'medications' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle eyebrow="Gesundheit" title="Medikamente" action={<button type="button" className="small-button" onClick={addMedication}><Plus size={14} /> Medikament</button>} />
          <div className="dashboard-plus-supplements">
            {dashboard.medications.map((item, index) => (
              <div className="supp-card dashboard-plus-supp-card" style={{ borderTopColor: item.color }} key={item.id}>
                <div className="dashboard-plus-med-head">
                  <input className="dashboard-plus-input dashboard-plus-input--title" value={item.name} onChange={event => updateMedication(index, { name: event.target.value })} />
                  <button
                    type="button"
                    className={item.taken ? 'status-chip status-chip--good' : 'status-chip'}
                    onClick={() => updateMedication(index, { taken: !item.taken })}
                    aria-pressed={item.taken}
                  >
                    <span className="status-chip__dot" />{item.taken ? 'Genommen' : 'Ausstehend'}
                  </button>
                </div>
                <div className="dashboard-plus-inline-row">
                  <input className="dashboard-plus-input" value={item.dosage} onChange={event => updateMedication(index, { dosage: event.target.value })} placeholder="Dosierung" aria-label="Dosierung" />
                  <input className="dashboard-plus-input" value={item.time} onChange={event => updateMedication(index, { time: event.target.value })} placeholder="Uhrzeit" aria-label="Uhrzeit" />
                </div>
                <input className="dashboard-plus-input" value={item.notes} onChange={event => updateMedication(index, { notes: event.target.value })} placeholder="Notizen" aria-label="Notizen" />
                <input className="dashboard-plus-input" value={item.effect} onChange={event => updateMedication(index, { effect: event.target.value })} placeholder="Wirkung" aria-label="Wirkung" />
                <input className="dashboard-plus-input" value={item.sideEffects} onChange={event => updateMedication(index, { sideEffects: event.target.value })} placeholder="Nebenwirkungen" aria-label="Nebenwirkungen" />
                <button type="button" className="secondary-button secondary-button--full" onClick={() => removeMedication(index)}>
                  <Trash2 size={15} /> Entfernen
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
      )}

      {activeSection === 'goals' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle eyebrow="Planung" title="Ziele" action={<button type="button" className="small-button" onClick={addGoal}><Plus size={14} /> Ziel</button>} />
          <div className="dashboard-plus-supplements">
            {dashboard.goals.map((goal, index) => {
              const eta = daysUntil(goal.dueDate, today)
              const etaLabel = eta > 0
                ? `Noch ${eta} ${plural(eta, 'Tag', 'Tage')}`
                : eta === 0
                  ? 'Heute fällig'
                  : `${Math.abs(eta)} ${plural(Math.abs(eta), 'Tag', 'Tage')} überfällig`
              return (
                <div className="supp-card dashboard-plus-supp-card" style={{ borderTopColor: goal.color }} key={goal.id}>
                  <div className="dashboard-plus-goal-head">
                    <input className="dashboard-plus-input dashboard-plus-input--title" value={goal.title} onChange={event => updateGoal(index, { title: event.target.value })} aria-label="Ziel" />
                    <button
                      type="button"
                      className="dashboard-plus-goal-timeframe"
                      onClick={() => {
                        const order: DashboardPlusGoalTimeframe[] = ['Woche', 'Monat', 'Quartal', 'Jahr']
                        updateGoal(index, { timeframe: order[(order.indexOf(goal.timeframe) + 1) % order.length] })
                      }}
                    >
                      {goal.timeframe}
                    </button>
                  </div>
                  <div className="dashboard-plus-inline-row">
                    <input className="dashboard-plus-input" type="number" min="0" max="100" value={goal.percent} onChange={event => updateGoal(index, { percent: clampNumber(Number(event.target.value) || 0, 0, 100) })} aria-label="Prozent" />
                    <input className="dashboard-plus-input" type="date" value={goal.dueDate} onChange={event => updateGoal(index, { dueDate: event.target.value })} aria-label="Fällig am" />
                  </div>
                  <div className="mini-progress" aria-hidden="true">
                    <span style={{ width: `${goal.percent}%` }} />
                  </div>
                  <div className="dashboard-plus-goal-eta">{etaLabel} · {goal.percent}%</div>
                  <button type="button" className="secondary-button secondary-button--full" onClick={() => removeGoal(index)}>
                    <Trash2 size={15} /> Entfernen
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </div>
      )}

      {activeSection === 'shopping' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle eyebrow="Kaufliste" title="Offen" />
          <div className="shopping-list dashboard-plus-shopping-list">
            {dashboard.shopping.items.map((item, index) => {
              const shopIcon = SHOPPING_ICONS[item.icon]
              return (
              <label className={item.done ? 'shop-item is-done' : 'shop-item'} key={item.id}>
                <div className="shop-icon" style={{ background: shopIcon.tint, color: shopIcon.ink }}>
                  <shopIcon.icon size={17} />
                </div>
                <div className="shop-body dashboard-plus-shop-body">
                  <input className="dashboard-plus-input dashboard-plus-input--title" value={item.name} onChange={event => updateShoppingItem(index, { name: event.target.value })} />
                  <input className="dashboard-plus-input" value={item.note} onChange={event => updateShoppingItem(index, { note: event.target.value })} />
                  {item.lowStock && (
                    <span className="status-chip status-chip--warn"><span className="status-chip__dot" />Bestand kritisch</span>
                  )}
                </div>
                <div className="dashboard-plus-shop-meta">
                  <input className="dashboard-plus-input dashboard-plus-input--money" type="number" min="0" step="0.01" value={item.price} onChange={event => updateShoppingItem(index, { price: Number(event.target.value) || 0 })} />
                  <span className="shop-price">€ {formatMoney(item.price)}</span>
                </div>
                <button type="button" className="shop-check" onClick={() => updateShoppingItem(index, { done: !item.done })} aria-pressed={item.done} />
              </label>
              )
            })}
          </div>
        </section>
      </div>
      )}

      {activeSection === 'stats' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle eyebrow="Stats" title="Verlauf" />
          <div className="kpi-grid dashboard-plus-stats-grid">
            <label className="kpi-card dashboard-plus-metric">
              <span>Ø Score</span>
              <input type="number" min="0" max="100" value={dashboard.stats.average} onChange={event => onChange(current => ({ ...current, stats: { ...current.stats, average: Number(event.target.value) || 0 } }))} />
              <small>letzte 7 Tage</small>
            </label>
            <label className="kpi-card dashboard-plus-metric">
              <span>Best Tag</span>
              <input type="number" min="0" max="100" value={dashboard.stats.best} onChange={event => onChange(current => ({ ...current, stats: { ...current.stats, best: Number(event.target.value) || 0 } }))} />
              <small>diese Woche</small>
            </label>
            <label className="kpi-card dashboard-plus-metric">
              <span>Rhythmus</span>
              <input type="number" min="0" max="30" value={dashboard.stats.rhythm} onChange={event => onChange(current => ({ ...current, stats: { ...current.stats, rhythm: Number(event.target.value) || 0 } }))} />
              <small>Tage</small>
            </label>
            <label className="kpi-card dashboard-plus-metric">
              <span>Gewicht</span>
              <input type="number" min="0" step="0.1" value={dashboard.stats.weight} onChange={event => onChange(current => ({ ...current, stats: { ...current.stats, weight: Number(event.target.value) || 0 } }))} />
              <small>kg</small>
            </label>
          </div>

          <div className="week-chart dashboard-plus-week-chart">
            <div className="heatmap-title">SCORE — LETZTE 7 TAGE</div>
            <div className="week-bars">
              {dashboard.stats.weeklyBars.map((bar, index) => (
                <div className="week-bar-wrap" key={`${index}-${bar}`}>
                  <input
                    className="dashboard-plus-bar-input"
                    type="number"
                    min="0"
                    max="100"
                    value={bar}
                    onChange={event => onChange(current => ({
                      ...current,
                      stats: {
                        ...current.stats,
                        weeklyBars: current.stats.weeklyBars.map((item, barIndex) => (barIndex === index ? Number(event.target.value) || 0 : item)),
                      },
                    }))}
                  />
                  <div className="week-bar" style={{ height: `${bar}%`, background: 'linear-gradient(180deg,var(--accent),var(--accent2))' }} />
                  <div className="week-day">{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][index] ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="heatmap-wrap dashboard-plus-heatmap">
            <div className="heatmap-title">TODO-ABSCHLUSS — LETZTE 2 WOCHEN</div>
            <div className="heatmap-grid">
              {dashboard.stats.heatmap.map((value, index) => (
                <button
                  type="button"
                  key={`${index}-${value}`}
                  className="heatmap-cell dashboard-plus-heatmap-cell"
                  style={{ background: value === 0 ? 'rgba(255,255,255,0.05)' : `rgba(124,123,255,${Math.min(0.15 + (value * 0.15), 0.85)})` }}
                  onClick={() => onChange(current => ({
                    ...current,
                    stats: {
                      ...current.stats,
                      heatmap: current.stats.heatmap.map((item, cellIndex) => (cellIndex === index ? (item + 1) % 5 : item)),
                    },
                  }))}
                  aria-label={`Heatmap ${index + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="todo-card dashboard-plus-projects">
            {dashboard.stats.projects.map((project, index) => (
              <div className="todo-item dashboard-plus-project-row" key={project.id}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: project.color, flexShrink: 0 }} />
                <div className="todo-body">
                  <input className="dashboard-plus-input dashboard-plus-input--title" value={project.name} onChange={event => onChange(current => ({
                    ...current,
                    stats: {
                      ...current.stats,
                      projects: current.stats.projects.map((item, projectIndex) => (projectIndex === index ? { ...item, name: event.target.value } : item)),
                    },
                  }))} />
                </div>
                <input className="dashboard-plus-input dashboard-plus-input--money dashboard-plus-input--percent" type="number" min="0" max="100" value={project.percent} onChange={event => onChange(current => ({
                  ...current,
                  stats: {
                    ...current.stats,
                    projects: current.stats.projects.map((item, projectIndex) => (projectIndex === index ? { ...item, percent: Number(event.target.value) || 0 } : item)),
                  },
                }))} />
              </div>
            ))}
          </div>
        </section>
      </div>
      )}

      {activeSection === 'finance' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle eyebrow="Finanzen" title="Rechnungen" />
          <div className="kpi-grid dashboard-plus-stats-grid">
            <label className="kpi-card dashboard-plus-metric">
              <span>Monatlich fix</span>
              <input type="number" min="0" value={dashboard.finances.monthlyFixed} onChange={event => onChange(current => ({ ...current, finances: { ...current.finances, monthlyFixed: Number(event.target.value) || 0 } }))} />
              <small>€ {formatMoney(dashboard.finances.monthlyFixed)}</small>
            </label>
            <label className="kpi-card dashboard-plus-metric">
              <span>Offen</span>
              <input type="number" min="0" value={dashboard.finances.open} onChange={event => onChange(current => ({ ...current, finances: { ...current.finances, open: Number(event.target.value) || 0 } }))} />
              <small>3 Rechnungen</small>
            </label>
            <label className="kpi-card dashboard-plus-metric">
              <span>Überfällig</span>
              <input type="number" min="0" value={dashboard.finances.overdue} onChange={event => onChange(current => ({ ...current, finances: { ...current.finances, overdue: Number(event.target.value) || 0 } }))} />
              <small>1 Rechnung</small>
            </label>
          </div>

          <div className="dashboard-plus-finance-columns">
            <div>
              <div className="fin-section-label"><CreditCard size={13} /> Wiederkehrend</div>
              <div className="dashboard-plus-bill-list">
                {dashboard.finances.recurring.map((bill, index) => (
                  <div className="bill-card dashboard-plus-bill-card" key={bill.id} style={{ borderColor: bill.status === 'overdue' ? 'color-mix(in srgb, var(--danger) 30%, transparent)' : undefined }}>
                    <div className="bill-dot" style={{ background: bill.color }} />
                    <div className="bill-body dashboard-plus-bill-body">
                      <input className="dashboard-plus-input dashboard-plus-input--title" value={bill.name} onChange={event => updateRecurringBill(index, { name: event.target.value })} />
                      <input className="dashboard-plus-input" value={bill.subtitle} onChange={event => updateRecurringBill(index, { subtitle: event.target.value })} />
                    </div>
                    <div className="bill-right dashboard-plus-bill-right">
                      <input className="dashboard-plus-input dashboard-plus-input--money" type="number" min="0" value={bill.amount} onChange={event => updateRecurringBill(index, { amount: Number(event.target.value) || 0 })} />
                      {bill.status === 'paid' ? (
                        <span className="status-chip status-chip--good"><span className="status-chip__dot" />Bezahlt</span>
                      ) : (
                        <input className="dashboard-plus-input" value={bill.due} onChange={event => updateRecurringBill(index, { due: event.target.value })} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="fin-section-label"><Receipt size={13} /> Offene Rechnungen</div>
              <div className="dashboard-plus-bill-list">
                {dashboard.finances.openBills.map((bill, index) => (
                  <div className="bill-card dashboard-plus-bill-card" key={bill.id} style={{ borderColor: bill.status === 'overdue' ? 'color-mix(in srgb, var(--danger) 30%, transparent)' : undefined }}>
                    <div className="bill-dot" style={{ background: bill.color }} />
                    <div className="bill-body dashboard-plus-bill-body">
                      <input className="dashboard-plus-input dashboard-plus-input--title" value={bill.name} onChange={event => updateOpenBill(index, { name: event.target.value })} />
                      <input className="dashboard-plus-input" value={bill.subtitle} onChange={event => updateOpenBill(index, { subtitle: event.target.value })} />
                    </div>
                    <div className="bill-right dashboard-plus-bill-right">
                      <input className="dashboard-plus-input dashboard-plus-input--money" type="number" min="0" value={bill.amount} onChange={event => updateOpenBill(index, { amount: Number(event.target.value) || 0 })} />
                      {bill.status === 'paid' ? (
                        <span className="status-chip status-chip--good"><span className="status-chip__dot" />Bezahlt</span>
                      ) : (
                        <input className="dashboard-plus-input" value={bill.due} onChange={event => updateOpenBill(index, { due: event.target.value })} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
      )}

      <div className="dashboard-plus-footer">
        <span>Snapshot: {today}</span>
        <span>Alles ist direkt editierbar und wird in deinem Browser gesichert.</span>
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

function QuickAddModal({
  onClose,
  onSubmitTask,
  onSubmitWeight,
  onSubmitCalories,
  onSubmitWater,
}: {
  onClose: () => void
  onSubmitTask: (title: string) => void
  onSubmitWeight: (value: number) => void
  onSubmitCalories: (value: number) => void
  onSubmitWater: (value: number) => void
}) {
  const [value, setValue] = useState('')
  useModalBehavior(onClose)

  const parsed = parseQuickAdd(value)
  const preview = value.trim() === ''
    ? 'Erkennt automatisch: „74.2kg“ → Gewicht, „3000kcal“ → Kalorien, „2.5l“ → Wasser — sonst wird eine Aufgabe daraus.'
    : parsed.kind === 'weight' ? `→ Gewicht: ${parsed.value} kg`
      : parsed.kind === 'calories' ? `→ Kalorien: ${parsed.value} kcal`
        : parsed.kind === 'water' ? `→ Wasser: ${parsed.value} L`
          : `→ Neue Aufgabe: „${parsed.title}“`

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!value.trim()) return
    if (parsed.kind === 'weight') onSubmitWeight(parsed.value)
    else if (parsed.kind === 'calories') onSubmitCalories(parsed.value)
    else if (parsed.kind === 'water') onSubmitWater(parsed.value)
    else onSubmitTask(parsed.title)
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <form className="modal modal--small" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="quick-add-title">
        <div className="modal-header">
          <div>
            <span className="eyebrow">Quick Add</span>
            <h2 id="quick-add-title">Was gibt's?</h2>
          </div>
          <IconButton label="Schließen" onClick={onClose}><X size={18} /></IconButton>
        </div>
        <label className="text-field">
          <span>Eintrag</span>
          <input autoFocus value={value} onChange={event => setValue(event.target.value)} maxLength={120} placeholder="z. B. „74.2kg“ oder „Zahnarzt anrufen“" />
        </label>
        <p className="field-hint">{preview}</p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="primary-button" disabled={!value.trim()}><Check size={17} /> Hinzufügen</button>
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
  onExport,
  onImport,
  onClose,
}: {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
  onExport: () => void
  onImport: (file: File) => Promise<void>
  onClose: () => void
}) {
  useModalBehavior(onClose)
  const importInputRef = useRef<HTMLInputElement | null>(null)

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
          <label className="text-field"><span>Name</span><input value={settings.name} placeholder="Dein Name" onChange={event => onChange({ ...settings, name: event.target.value })} /></label>
          <label className="text-field"><span>Standard-Fokus</span><input type="number" min="5" max="120" step="5" value={settings.focusMinutes} onChange={event => onChange({ ...settings, focusMinutes: clampNumber(Number(event.target.value) || 25, 5, 120) })} /></label>
          <label className="text-field"><span>Proteinziel in g</span><input type="number" min="50" max="400" step="5" value={settings.proteinGoal} onChange={event => onChange({ ...settings, proteinGoal: clampNumber(Number(event.target.value) || 150, 50, 400) })} /></label>
          <label className="text-field"><span>Kalorienziel</span><input type="number" min="1000" max="8000" step="50" value={settings.calorieGoal} onChange={event => onChange({ ...settings, calorieGoal: clampNumber(Number(event.target.value) || 3500, 1000, 8000) })} /></label>
        </div>

        <div className="settings-section settings-actions">
          <button type="button" className="secondary-button" onClick={onExport}>
            <ChevronDown size={16} /> Export JSON
          </button>
          <button type="button" className="secondary-button" onClick={() => importInputRef.current?.click()}>
            <ChevronUp size={16} /> Import JSON
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) await onImport(file)
            }}
          />
        </div>

        <div className="settings-note">
          <Bell size={18} />
          <p>Benachrichtigungen werden nie ungefragt angefordert. Ein Timer-Hinweis erscheint nur, wenn du die Berechtigung bereits erteilt hast. Daten werden lokal gespeichert.</p>
        </div>
        <div className="modal-actions"><button type="button" className="primary-button" onClick={onClose}><Check size={17} /> Fertig</button></div>
      </div>
    </div>
  )
}

function safeLocalStorageSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export default App
