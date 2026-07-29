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
  AlertCircle,
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
  Fish,
  Eye,
  EyeOff,
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
  ShoppingBag,
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
import { getDayPolicy, pickNextStep } from './lib/dayPolicy'
import { buildWeekInsights } from './lib/insights'
import { deriveLaborOverview, deriveLaborStats, smartLaborHints } from './lib/laborLive'
import { hashFromView, navigateHash, viewFromHash } from './lib/routing'
import { calculateScore, calculateStreakForHabit, getScoreBreakdown } from './lib/score'
import { calculateHabitStrength, habitStrengthLabel } from './lib/habitStrength'
import { calculateRecovery } from './lib/recovery'
import {
  filterHabitsForDate,
  normalizeHabitSchedules,
  toggleScheduleDay,
  WEEKDAY_LABELS,
  type HabitScheduleMap,
} from './lib/habitSchedule'
import { buildYearHeatmap, eveningPromptForDate } from './lib/heatmap'
import type { HabitKey } from './types/DashboardEntry'
import {
  applyBackupExtras,
  exportBackupBundle,
  getLastBackupAt,
  importBackupFile,
  mergeEntriesByDate,
  saveAllEntries,
} from './lib/storage'
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
  /** Empty / missing = every day. Values 0=Mo … 6=So. */
  habitSchedules: HabitScheduleMap
  dashboardPlusLayout: DashboardPlusLayout
}

type DashboardPlusLayout = {
  order: DashboardPlusSection[]
  hidden: DashboardPlusSection[]
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
  /** Legacy / optional — accent is derived in UI from id/name */
  color?: string
}

const SUPPLEMENT_ACCENTS = [
  'var(--accent)',
  'var(--sage)',
  'var(--blue)',
  'var(--lilac)',
  'var(--warning)',
] as const

function hashSupplementKey(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

function supplementAccent(item: Pick<DashboardPlusSupplement, 'id' | 'name'>, index: number): string {
  const key = item.id || item.name || String(index)
  return SUPPLEMENT_ACCENTS[hashSupplementKey(key) % SUPPLEMENT_ACCENTS.length]
}

function supplementDaysRemaining(stock: number, dailyUse: number): number | null {
  if (dailyUse <= 0) return null
  return Math.floor(stock / dailyUse)
}

type DashboardPlusBoard = {
  id: string
  label: string
  count: number
  tasks: DashboardPlusTask[]
}

type ShoppingIconKey = 'flask' | 'fish' | 'pill' | 'bag' | 'droplet'

type DashboardPlusShoppingItem = {
  id: string
  /** Semantic icon key — never an emoji */
  icon: ShoppingIconKey | string
  name: string
  note: string
  price: number
  done: boolean
  lowStock?: boolean
}

const SHOPPING_ICON_MAP: Record<ShoppingIconKey, typeof ShoppingBag> = {
  flask: FlaskConical,
  fish: Fish,
  droplet: Droplet,
  pill: Pill,
  bag: ShoppingBag,
}

function shoppingIconKey(raw: string): ShoppingIconKey {
  const value = raw.trim().toLowerCase()
  if (value === 'flask' || value === 'fish' || value === 'pill' || value === 'bag' || value === 'droplet') return value
  // Legacy emoji / unknown → bag
  return 'bag'
}

function ShoppingItemIcon({ icon }: { icon: string }) {
  const Icon = SHOPPING_ICON_MAP[shoppingIconKey(icon)]
  return <Icon size={16} />
}

type DashboardPlusBillStatus = 'paid' | 'open' | 'overdue'

type DashboardPlusBill = {
  id: string
  name: string
  subtitle: string
  amount: number
  due: string
  status: DashboardPlusBillStatus
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
  /** @deprecated use takenDate — kept for seed/legacy */
  taken: boolean
  /** YYYY-MM-DD when taken; cleared after midnight by comparing to today */
  takenDate?: string
  color: string
}

function isMedicationTakenToday(item: DashboardPlusMedication, today: string): boolean {
  return item.takenDate === today
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

type FinanceSummary = {
  monthlyFixed: number
  recurringCount: number
  openSum: number
  openCount: number
  overdueSum: number
  overdueCount: number
  hints: string[]
}

function sumBillAmounts(bills: DashboardPlusBill[]): number {
  return bills.reduce((total, bill) => total + (Number.isFinite(bill.amount) ? bill.amount : 0), 0)
}

function deriveFinanceSummary(finances: DashboardPlusState['finances']): FinanceSummary {
  const openBills = finances.openBills.filter(bill => bill.status === 'open')
  const overdueBills = [...finances.recurring, ...finances.openBills].filter(bill => bill.status === 'overdue')
  const monthlyFixed = sumBillAmounts(finances.recurring)
  const openSum = sumBillAmounts(openBills)
  const overdueSum = sumBillAmounts(overdueBills)
  const hints: string[] = []

  if (overdueBills.length > 0) {
    hints.push(
      overdueBills.length === 1
        ? 'Eine Rechnung ist überfällig — zuerst klären, dann weiterplanen.'
        : `${overdueBills.length} Rechnungen sind überfällig — ruhig abarbeiten, bevor Neues dazukommt.`,
    )
  }
  if (monthlyFixed > 0 && openSum + overdueSum > monthlyFixed * 0.45) {
    hints.push('Offene Beträge sind relativ hoch zum Monatsfix — kurz priorisieren.')
  }
  if (hints.length === 0) {
    hints.push('Fixkosten und offene Posten im Blick — ohne den Tagesfokus zu stören.')
  }

  return {
    monthlyFixed,
    recurringCount: finances.recurring.length,
    openSum,
    openCount: openBills.length,
    overdueSum,
    overdueCount: overdueBills.length,
    hints: hints.slice(0, 2),
  }
}

function billStatusLabel(status: DashboardPlusBillStatus): string {
  switch (status) {
    case 'paid':
      return 'Bezahlt'
    case 'open':
      return 'Offen'
    case 'overdue':
      return 'Überfällig'
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
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
      dateLabel: new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()),
      syncStatus: 'Lokal',
      syncTime: 'nur dieses Gerät',
      score: 0,
      habits: 0,
      todos: 0,
      projects: 0,
    },
    focusTodos: [
      { id: 'focus-1', title: 'Creatine bestellen (Lager fast leer)', tag: 'DRINGEND', time: 'heute', done: false, priority: 'p1' },
      { id: 'focus-2', title: 'Morning Routine abschließen', tag: 'PERSONAL', time: '08:15', done: true, priority: 'p2' },
      { id: 'focus-3', title: 'Landing Page copy finalisieren', tag: 'MONDAS', time: '14:00', done: false, priority: 'p3' },
    ],
    supplements: [
      { id: 'supp-1', name: 'Hüttenkäse', brand: '500g Becher', stock: 400, unit: 'g', dailyUse: 200, dailyUnit: 'g' },
      { id: 'supp-2', name: 'Creatine Monohydrate', brand: 'BulkPowders · 500g', stock: 60, unit: 'g', dailyUse: 10, dailyUnit: 'g' },
      { id: 'supp-3', name: 'Haferflocken', brand: 'Naturgut · 1kg', stock: 600, unit: 'g', dailyUse: 80, dailyUnit: 'g' },
      { id: 'supp-4', name: 'Omega-3', brand: 'Optimum · 180 Caps', stock: 63, unit: 'Caps', dailyUse: 2, dailyUnit: 'Caps' },
      { id: 'supp-5', name: 'Vitamin D3 + K2', brand: 'Now Foods · 365 Caps', stock: 299, unit: 'Caps', dailyUse: 1, dailyUnit: 'Caps' },
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
        { id: 'shop-1', icon: 'flask', name: 'Creatine Monohydrate 1kg', note: 'BulkPowders · Bestand kritisch', price: 24.99, done: false, lowStock: true },
        { id: 'shop-2', icon: 'fish', name: 'Omega-3 Nachfüllpack', note: 'Optimum · 300 Caps', price: 34.90, done: false },
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
        { id: 'proj-mondas', name: 'Mondas', percent: 17, color: 'var(--warning)' },
        { id: 'proj-health', name: 'Health', percent: 33, color: 'var(--sage)' },
      ],
    },
    finances: {
      monthlyFixed: 847,
      open: 340,
      overdue: 89,
      recurring: [
        { id: 'bill-rent', name: 'Miete', subtitle: 'Monatlich · 1. jeden Monat', amount: 520, due: 'nächste: 01.06', status: 'open', color: 'var(--accent)' },
        { id: 'bill-power', name: 'Strom · Vattenfall', subtitle: 'Monatlich · 15. jeden Monat', amount: 89, due: 'nächste: 15.06', status: 'open', color: 'var(--blue)' },
        { id: 'bill-internet', name: 'Internet · Telekom', subtitle: 'Monatlich · 20. jeden Monat', amount: 44, due: 'nächste: 20.06', status: 'open', color: 'var(--sage)' },
        { id: 'bill-streaming', name: 'Spotify + Netflix', subtitle: 'Monatlich · 5. jeden Monat', amount: 28, due: 'nächste: 05.06', status: 'open', color: 'var(--lilac)' },
        { id: 'bill-gym', name: 'Gym · McFit', subtitle: 'Monatlich · 1. jeden Monat', amount: 24, due: 'nächste: 01.06', status: 'open', color: 'var(--warning)' },
        { id: 'bill-icloud', name: 'iCloud 200GB', subtitle: 'Monatlich · 12. jeden Monat', amount: 3, due: 'nächste: 12.06', status: 'open', color: 'var(--blue)' },
      ],
      openBills: [
        { id: 'bill-tax', name: 'Steuerberater', subtitle: 'Fällig: 15.05.2026', amount: 89, due: '16 Tage überfällig', status: 'overdue', color: 'var(--danger)' },
        { id: 'bill-design', name: 'Lieferant Design-Assets', subtitle: 'Fällig: 05.06.2026', amount: 149, due: 'in 5 Tagen', status: 'open', color: 'var(--warning)' },
        { id: 'bill-figma', name: 'Software-Lizenz Figma', subtitle: 'Fällig: 15.06.2026', amount: 102, due: 'in 15 Tagen', status: 'open', color: 'var(--warning)' },
        { id: 'bill-vercel', name: 'Hosting · Vercel Pro', subtitle: 'Bezahlt am 01.05.2026', amount: 20, due: 'erledigt', status: 'paid', color: 'var(--success)' },
      ],
    },
  }
}

function stripEmojis(value: string): string {
  return value
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\uFE0F/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function normalizeShoppingItem(item: DashboardPlusShoppingItem): DashboardPlusShoppingItem {
  const legacyMap: Record<string, ShoppingIconKey> = {
    '🧪': 'flask',
    '🐟': 'fish',
    '💊': 'pill',
    '💧': 'droplet',
  }
  const mapped = legacyMap[item.icon] ?? shoppingIconKey(String(item.icon))
  return {
    ...item,
    icon: mapped,
    name: stripEmojis(item.name),
    note: stripEmojis(item.note),
  }
}

// Every array below is rendered with a direct .map() in DashboardPlusView, so
// persisted state that predates a field (or was hand-edited into a bad shape)
// must never reach render as anything but a same-shaped array — otherwise a
// single stale/missing field crashes the whole view (e.g. an unknown
// shopping-item icon, or a field from before it existed in the schema).
// PriorityBadge does PRIORITY_META[priority] with no fallback, so any task
// persisted under the pre-Phase-2 scheme ('red'/'orange'/'blue') or otherwise
// invalid crashes the Todos tab the instant it renders.
function normalizeTaskPriority(task: DashboardPlusTask): DashboardPlusTask {
  const legacyPriority: Record<string, DashboardPlusPriority> = {
    red: 'p1',
    orange: 'p2',
    blue: 'p3',
  }
  const raw = task.priority as string
  const mapped = (legacyPriority[raw] ?? raw) as DashboardPlusPriority
  return PRIORITY_ORDER.includes(mapped) ? { ...task, priority: mapped } : { ...task, priority: 'p3' }
}

function normalizeDashboardPlusState(parsed: Partial<DashboardPlusState> | null | undefined): DashboardPlusState {
  const seed = createDashboardPlusSeed()
  if (!parsed || typeof parsed !== 'object' || !parsed.overview) return seed

  return {
    overview: { ...seed.overview, ...parsed.overview },
    focusTodos: Array.isArray(parsed.focusTodos) ? parsed.focusTodos.map(normalizeTaskPriority) : seed.focusTodos,
    supplements: Array.isArray(parsed.supplements) ? parsed.supplements : seed.supplements,
    medications: Array.isArray(parsed.medications) ? parsed.medications : seed.medications,
    goals: Array.isArray(parsed.goals) ? parsed.goals : seed.goals,
    boards: Array.isArray(parsed.boards)
      ? parsed.boards.map(board => ({
        ...board,
        tasks: Array.isArray(board.tasks) ? board.tasks.map(normalizeTaskPriority) : [],
      }))
      : seed.boards,
    shopping: {
      total: typeof parsed.shopping?.total === 'number' ? parsed.shopping.total : seed.shopping.total,
      items: Array.isArray(parsed.shopping?.items)
        ? parsed.shopping.items.map(item => normalizeShoppingItem({
          ...item,
          icon: typeof item.icon === 'string' ? item.icon : 'flask',
        }))
        : seed.shopping.items,
    },
    stats: {
      ...seed.stats,
      ...parsed.stats,
      weeklyBars: Array.isArray(parsed.stats?.weeklyBars) ? parsed.stats.weeklyBars : seed.stats.weeklyBars,
      heatmap: Array.isArray(parsed.stats?.heatmap) ? parsed.stats.heatmap : seed.stats.heatmap,
      projects: Array.isArray(parsed.stats?.projects) ? parsed.stats.projects : seed.stats.projects,
    },
    finances: {
      ...seed.finances,
      ...parsed.finances,
      recurring: Array.isArray(parsed.finances?.recurring) ? parsed.finances.recurring : seed.finances.recurring,
      openBills: Array.isArray(parsed.finances?.openBills) ? parsed.finances.openBills : seed.finances.openBills,
    },
  }
}

function loadDashboardPlusState(): DashboardPlusState {
  try {
    const stored = localStorage.getItem(DASHBOARD_PLUS_KEY)
    if (!stored) return createDashboardPlusSeed()
    const parsed = JSON.parse(stored) as Partial<DashboardPlusState>
    return normalizeDashboardPlusState(parsed)
  } catch {
    return createDashboardPlusSeed()
  }
}

const DEFAULT_ACTIVE_HABITS = ['breathingDone', 'coldShower', 'proteinShake', 'pushupsDone', 'gratitudeDone']

const DASHBOARD_PLUS_SECTION_IDS = DASHBOARD_PLUS_TABS.map(tab => tab.id)

const DEFAULT_DASHBOARD_PLUS_LAYOUT: DashboardPlusLayout = {
  order: [...DASHBOARD_PLUS_SECTION_IDS],
  hidden: [],
}

const DEFAULT_SETTINGS: AppSettings = {
  name: '',
  theme: 'system',
  focusMinutes: 25,
  proteinGoal: 150,
  calorieGoal: 3500,
  activeHabits: DEFAULT_ACTIVE_HABITS,
  habitSchedules: {},
  dashboardPlusLayout: DEFAULT_DASHBOARD_PLUS_LAYOUT,
}

function normalizeDashboardPlusLayout(raw: unknown): DashboardPlusLayout {
  const candidate = (raw ?? {}) as Partial<DashboardPlusLayout>
  const isSection = (id: unknown): id is DashboardPlusSection =>
    typeof id === 'string' && (DASHBOARD_PLUS_SECTION_IDS as string[]).includes(id)

  const storedOrder = Array.isArray(candidate.order) ? candidate.order.filter(isSection) : []
  const order = [...storedOrder, ...DASHBOARD_PLUS_SECTION_IDS.filter(id => !storedOrder.includes(id))]

  const storedHidden = Array.isArray(candidate.hidden) ? candidate.hidden.filter(isSection) : []
  // Never let every tab be hidden — fall back to "all visible" rather than an unusable Dashboard+.
  const hidden = storedHidden.length >= DASHBOARD_PLUS_SECTION_IDS.length ? [] : storedHidden

  return { order, hidden }
}

const NAV_ITEMS: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: 'today', label: 'Heute', icon: Home },
  { id: 'plan', label: 'Plan', icon: ListTodo },
  { id: 'checkin', label: 'Check-in', icon: Heart },
  { id: 'progress', label: 'Verlauf', icon: BarChart3 },
  { id: 'dashboardPlus', label: 'Labor', icon: Crown },
]

const STREAK_HABIT_KEYS: HabitKey[] = [
  'coldShower', 'proteinShake', 'pushupsDone', 'squatsDone', 'wallsitDone', 'plankDone',
  'gratitudeDone', 'focusDone', 'winnerModeDone', 'journalDone', 'familyTimeDone', 'breathingDone',
]

const ENERGY_OPTIONS: Array<{
  value: EnergyLevel
  label: string
  description: string
}> = [
  { value: 'low', label: 'Niedrig', description: 'Wir reduzieren heute aufs Wichtigste' },
  { value: 'okay', label: 'Okay', description: 'Ein ruhiger, machbarer Tag' },
  { value: 'high', label: 'Gut', description: 'Platz für tieferen Fokus' },
]

function storageStatusLabel(syncStatus: string, isOnline: boolean): string {
  if (syncStatus === 'error') return 'Speichern fehlgeschlagen'
  if (!isOnline || syncStatus === 'offline') return 'Offline · lokal'
  if (syncStatus === 'syncing') return 'Speichert lokal …'
  if (syncStatus === 'synced') return 'Lokal gespeichert'
  return 'Nur dieses Gerät'
}

const MOODS = ['Ruhig', 'Gut', 'Neutral', 'Müde', 'Gestresst']
const SLEEP_QUALITY = ['Schlecht', 'Okay', 'Gut', 'Sehr gut']
const SLEEP_DURATION_PRESETS = ['<5h', '6h', '7h', '7.5h', '8h', '>8h']

/** Parse stored sleep labels ("7.5h", "<5h") into hour/minute drafts. */
function parseSleepDurationParts(raw: string): { hours: string; minutes: string } {
  const value = String(raw ?? '').trim().toLowerCase()
  if (!value) return { hours: '', minutes: '' }
  if (value.startsWith('<')) return { hours: '4', minutes: '30' }
  if (value.startsWith('>')) return { hours: '9', minutes: '0' }
  const match = value.match(/^(\d+(?:[.,]\d+)?)\s*h?$/)
  if (!match) return { hours: '', minutes: '' }
  const total = Number.parseFloat(match[1].replace(',', '.'))
  if (!Number.isFinite(total) || total < 0) return { hours: '', minutes: '' }
  const hours = Math.floor(total)
  const minutes = Math.round((total - hours) * 60)
  return { hours: String(hours), minutes: String(minutes) }
}

function formatSleepDurationLabel(hours: number, minutes: number): string {
  const safeHours = Math.max(0, Math.min(16, Math.floor(hours)))
  const safeMinutes = Math.max(0, Math.min(59, Math.floor(minutes)))
  if (safeHours === 0 && safeMinutes === 0) return ''
  if (safeMinutes === 0) return `${safeHours}h`
  if (safeMinutes === 30) return `${safeHours}.5h`
  const total = Math.round((safeHours + safeMinutes / 60) * 10) / 10
  return `${total}h`
}

function SoftDurationInput({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const [hours, setHours] = useState(() => parseSleepDurationParts(value).hours)
  const [minutes, setMinutes] = useState(() => parseSleepDurationParts(value).minutes)
  const [confirmed, setConfirmed] = useState(() => Boolean(value))
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    const parts = parseSleepDurationParts(value)
    setHours(parts.hours)
    setMinutes(parts.minutes)
    setConfirmed(Boolean(value))
  }, [value])

  const confirm = () => {
    const next = formatSleepDurationLabel(Number(hours) || 0, Number(minutes) || 0)
    onChange(next)
    setConfirmed(Boolean(next))
    if (!next) return
    setPulse(true)
    window.setTimeout(() => setPulse(false), 420)
  }

  return (
    <div
      className={[
        'soft-duration',
        confirmed ? 'is-confirmed' : '',
        pulse ? 'is-pulse' : '',
      ].filter(Boolean).join(' ')}
    >
      <label className="soft-duration__field">
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={hours}
          placeholder="0"
          aria-label="Stunden"
          onChange={event => setHours(event.target.value.replace(/\D/g, '').slice(0, 2))}
          onKeyDown={event => {
            if (event.key === 'Enter') confirm()
          }}
        />
        <span>Std.</span>
      </label>
      <label className="soft-duration__field">
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={minutes}
          placeholder="0"
          aria-label="Minuten"
          onChange={event => {
            const digits = event.target.value.replace(/\D/g, '').slice(0, 2)
            if (digits === '') {
              setMinutes('')
              return
            }
            setMinutes(String(Math.min(59, Number(digits))))
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') confirm()
          }}
        />
        <span>Min.</span>
      </label>
      <button
        type="button"
        className="soft-duration__confirm"
        onClick={confirm}
        aria-label="Dauer bestätigen"
      >
        <Check size={20} strokeWidth={2.5} />
      </button>
    </div>
  )
}

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
      habitSchedules: normalizeHabitSchedules(stored.habitSchedules),
      dashboardPlusLayout: normalizeDashboardPlusLayout(stored.dashboardPlusLayout),
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

function formatShortWeekday(key: string): string {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short' })
    .format(fromDateKey(key))
    .replace('.', '')
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
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.p3
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
  const [view, setView] = useState<View>(() => viewFromHash())
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()))
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [dashboardPlus, setDashboardPlus] = useState<DashboardPlusState>(loadDashboardPlusState)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [taskEditor, setTaskEditor] = useState<{ index: number | null; value: string } | null>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => getLastBackupAt())

  const today = dateKey(new Date())
  const nowHour = new Date().getHours()
  const entry = useMemo(
    () => entries.find(item => item.date === selectedDate) ?? createDefaultEntry(selectedDate),
    [entries, selectedDate],
  )

  const scoreGoals = useMemo(
    () => ({ proteinGoal: settings.proteinGoal, activeHabits: settings.activeHabits }),
    [settings.proteinGoal, settings.activeHabits],
  )
  const score = clampNumber(calculateScore(entry, scoreGoals), 0, 100)
  const anchors = entry.anchors ?? []
  const anchorsDone = entry.anchorsDone ?? []
  const completedAnchors = anchors.filter((_, index) => Boolean(anchorsDone[index])).length
  const habitsDueToday = useMemo(
    () => filterHabitsForDate(settings.activeHabits, selectedDate, settings.habitSchedules),
    [settings.activeHabits, settings.habitSchedules, selectedDate],
  )
  const dayPolicy = useMemo(
    () => getDayPolicy({
      energy: entry.energyLevel,
      activeHabits: habitsDueToday,
      baseFocusMinutes: settings.focusMinutes,
      hour: selectedDate === today ? nowHour : 12,
    }),
    [entry.energyLevel, habitsDueToday, settings.focusMinutes, selectedDate, today, nowHour],
  )

  const streakByKey = useMemo(() => {
    const map: Record<string, number> = {}
    for (const key of STREAK_HABIT_KEYS) {
      map[key] = calculateStreakForHabit(entries, key)
    }
    return map
  }, [entries])

  const laborOpenBoards = useMemo(
    () => dashboardPlus.boards.filter(board => board.tasks.some(task => !task.done)).length,
    [dashboardPlus.boards],
  )

  const laborLive = useMemo(
    () => deriveLaborOverview({
      entries,
      today,
      activeHabits: settings.activeHabits,
      openBoardCount: laborOpenBoards,
      goals: scoreGoals,
    }),
    [entries, today, settings.activeHabits, laborOpenBoards, scoreGoals],
  )

  const laborStats = useMemo(
    () => deriveLaborStats({ entries, today, goals: scoreGoals }),
    [entries, today, scoreGoals],
  )

  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) navigateHash(view, true)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (hashFromView(view) !== window.location.hash) navigateHash(view, true)
  }, [view])

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
    const timer = window.setTimeout(() => setToast(null), toast.actionLabel ? 6000 : 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const showToast = (message: string, actionLabel?: string, onAction?: () => void) => {
    setToast({ message, actionLabel, onAction })
  }

  const updateEntry = (patch: Partial<DashboardEntry>) => {
    const before = loadXP()
    void saveEntry({ ...entry, ...patch }).then(ok => {
      if (!ok) {
        showToast('Speichern fehlgeschlagen — Speicher voll oder blockiert.')
        return
      }
      const after = loadXP()
      const gained = after.totalXP - before.totalXP
      if (after.level > before.level) {
        showToast(`Level ${after.level} · +${gained} XP`)
      } else if (gained > 0) {
        showToast(`+${gained} XP`)
      }
    })
  }

  const saveEntryForDate = async (date: string, patch: Partial<DashboardEntry>) => {
    const base = entries.find(item => item.date === date) ?? createDefaultEntry(date)
    const ok = await saveEntry({ ...base, ...patch })
    if (!ok) showToast('Speichern fehlgeschlagen — Speicher voll oder blockiert.')
    return ok
  }

  const handleExport = () => {
    exportBackupBundle({
      entries,
      settings,
      dashboardPlus,
    })
    setLastBackupAt(new Date().toISOString())
    showToast('Vollständiges Backup exportiert.')
  }

  const handleImport = async (file: File) => {
    try {
      const imported = await importBackupFile(file)
      const normalized = imported.entries.map(item => ({ ...item, dailyScore: calculateScore(item, scoreGoals) }))
      const replaceAll = window.confirm(
        `${imported.entryCount} Tage gefunden (${imported.mode === 'bundle' ? 'Vollbackup' : 'nur Einträge'}).\n\nOK = alles ersetzen\nAbbrechen = nach Datum mergen`,
      )
      const finalEntries = replaceAll ? normalized : mergeEntriesByDate(entries, normalized)

      if (!saveAllEntries(finalEntries)) throw new Error('localStorage unavailable')
      if (imported.mode === 'bundle') {
        applyBackupExtras(imported)
        if (imported.settings) setSettings(loadSettings())
        if (imported.dashboardPlus) setDashboardPlus(loadDashboardPlusState())
      }
      setLastBackupAt(new Date().toISOString())
      await reloadAll()
      showToast(imported.mode === 'bundle' ? 'Vollbackup importiert.' : 'Einträge importiert.')
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
      if (anchors.length >= dayPolicy.maxAnchors) {
        showToast(
          dayPolicy.energy === 'low'
            ? 'Bei niedriger Energie reichen maximal zwei Anker.'
            : dayPolicy.energy === 'okay'
              ? 'Heute maximal drei Anker — hält den Tag machbar.'
              : 'Maximal fünf Tagesanker halten den Tag übersichtlich.',
        )
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
      minutes: clampNumber(overrideMinutes ?? dayPolicy.focusMinutes, 5, 120),
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
      updateEntry({ focusDone: true } as Partial<DashboardEntry>)
    } else if (focusSession.routineKey) {
      updateEntry({
        [focusSession.routineKey]: true,
      } as Partial<DashboardEntry>)
    } else {
      updateEntry({ focusDone: true } as Partial<DashboardEntry>)
    }
    setFocusSession(null)
    showToast('Fokusblock abgeschlossen — erledigt.')
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
    navigateHash(nextView)
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
              <span className={`sync-pill sync-pill--${syncStatus}`} title="Daten bleiben in diesem Browser">
                <Cloud size={14} />
                {storageStatusLabel(syncStatus, isOnline)}
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
              streakByKey={streakByKey}
              onDateChange={setSelectedDate}
              onUpdate={updateEntry}
              onToggleAnchor={toggleAnchor}
              onEditTask={(index, value) => setTaskEditor({ index, value })}
              onAddTask={() => setTaskEditor({ index: null, value: '' })}
              onOpenFocus={openFocus}
              onReorderHabits={ids => setSettings(current => ({ ...current, activeHabits: ids }))}
              onOpenPlan={() => navigateTo('plan')}
              onOpenCheckin={() => navigateTo('checkin')}
              onPromoteThoughtToTomorrow={async text => {
                const tomorrow = addDays(today, 1)
                const tomorrowEntry = entries.find(item => item.date === tomorrow) ?? createDefaultEntry(tomorrow)
                const nextAnchors = [...(tomorrowEntry.anchors ?? [])]
                if (nextAnchors.length >= 5) {
                  showToast('Morgen hat schon fünf Anker.')
                  return
                }
                if (nextAnchors.includes(text)) {
                  showToast('Schon als Morgen-Anker geplant.')
                  return
                }
                await saveEntryForDate(tomorrow, {
                  anchors: [...nextAnchors, text],
                  anchorsDone: [...(tomorrowEntry.anchorsDone ?? []).slice(0, nextAnchors.length), false],
                })
                showToast('Als Morgen-Anker gespeichert.')
              }}
              showToast={showToast}
            />
          )}

          {view === 'plan' && (
            <PlanView
              date={selectedDate}
              today={today}
              anchors={anchors}
              anchorsDone={anchorsDone}
              focusMinutes={dayPolicy.focusMinutes}
              maxAnchors={dayPolicy.maxAnchors}
              energy={entry.energyLevel}
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
            <ProgressView entries={entries} today={today} scoreGoals={scoreGoals} />
          )}

          {view === 'dashboardPlus' && (
            <DashboardPlusView
              dashboard={dashboardPlus}
              onChange={setDashboardPlus}
              onBackToToday={() => navigateTo('today')}
              today={today}
              liveOverview={laborLive}
              liveStats={laborStats}
              energy={entry.energyLevel}
              layout={settings.dashboardPlusLayout}
              onOpenSettings={() => setSettingsOpen(true)}
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

        {view !== 'dashboardPlus' && !(view === 'today' && !entry.energyLevel) && (
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
          lastBackupAt={lastBackupAt}
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
  onPromoteThoughtToTomorrow,
  streakByKey,
  showToast,
}: {
  entry: DashboardEntry
  date: string
  today: string
  score: number
  settings: AppSettings
  anchors: string[]
  anchorsDone: boolean[]
  streakByKey: Record<string, number>
  onDateChange: (date: string) => void
  onUpdate: (patch: Partial<DashboardEntry>) => void
  onToggleAnchor: (index: number) => void
  onEditTask: (index: number, value: string) => void
  onAddTask: () => void
  onOpenFocus: (title: string, taskIndex?: number, routineKey?: RoutineKey, overrideMinutes?: number) => void
  onReorderHabits: (ids: string[]) => void
  onOpenPlan: () => void
  onOpenCheckin: () => void
  onPromoteThoughtToTomorrow: (text: string) => Promise<void>
  showToast: (message: string, actionLabel?: string, onAction?: () => void) => void
}) {
  const [capture, setCapture] = useState('')
  const [dragIdx,     setDragIdx]     = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const touchRef = useRef<{ sourceIdx: number } | null>(null)

  const energy = entry.energyLevel
  const hour = date === today ? new Date().getHours() : 12
  const habitsDue = filterHabitsForDate(settings.activeHabits, date, settings.habitSchedules)
  const policy = getDayPolicy({
    energy,
    activeHabits: habitsDue,
    baseFocusMinutes: settings.focusMinutes,
    hour,
  })
  const dayMode = policy.mode
  const recovery = calculateRecovery({ entry, energy })

  const allRoutineItems = habitsDue
    .map(id => DAILY_HABITS.find(h => h.id === id))
    .filter((h): h is HabitDef => h !== undefined)
    .map(h => ({
      key: h.id,
      label: energy === 'low' ? `${h.label} · 2 Min` : h.label,
      icon: h.icon,
      minutes: energy === 'low' ? 2 : (h.minutes ?? 11),
      done: Boolean(entry[h.id as keyof DashboardEntry]),
    }))

  const routineItems = allRoutineItems.filter(item => policy.primaryHabitIds.includes(item.key))
  const deferredRoutineItems = allRoutineItems.filter(item => policy.deferredHabitIds.includes(item.key))
  const skippedToday = settings.activeHabits.filter(id => !habitsDue.includes(id)).length

  const applyReorder = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return
    // Reorder within the full activeHabits list using primary indices mapped back
    const primaryIds = [...policy.primaryHabitIds]
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= primaryIds.length || toIdx >= primaryIds.length) return
    const [moved] = primaryIds.splice(fromIdx, 1)
    primaryIds.splice(toIdx, 0, moved)
    const deferred = settings.activeHabits.filter(id => !policy.primaryHabitIds.includes(id))
    onReorderHabits([...primaryIds, ...deferred])
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
  const nextStep = pickNextStep({
    anchors,
    anchorsDone,
    habits: routineItems.map(item => ({
      key: item.key,
      label: item.label,
      minutes: item.minutes,
      done: item.done,
    })),
    energy,
    hour,
    streakByKey,
  })
  const focusTitle = nextStep
    ? nextStep.title
    : 'Tagesabschluss'
  const nextTaskIndex = nextStep?.kind === 'anchor' ? nextStep.index : -1
  const focusMinutesForNext = nextStep?.kind === 'habit'
    ? (nextStep.minutes ?? policy.focusMinutes)
    : policy.focusMinutes

  const completeNext = () => {
    if (nextStep?.kind === 'anchor') {
      onToggleAnchor(nextStep.index)
      return
    }
    if (nextStep?.kind === 'habit') {
      onUpdate({ [nextStep.key]: true } as Partial<DashboardEntry>)
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
    showToast('Gedanke geparkt.', 'Morgen-Anker?', () => {
      void onPromoteThoughtToTomorrow(clean)
    })
  }

  const promoteDeferred = (key: string) => {
    const without = settings.activeHabits.filter(id => id !== key)
    const insertAt = Math.min(policy.primaryHabitIds.length, without.length)
    without.splice(insertAt, 0, key)
    onReorderHabits(without)
    showToast('Für heute in die Routine geholt.')
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
              {nextStep?.kind === 'anchor'
                ? 'Nur diese eine Aufgabe. Der Rest darf kurz warten.'
                : nextStep?.kind === 'habit'
                  ? policy.heroHabitCopy
                  : getDailyQuote()}
            </p>
            {nextStep?.streakHint && (
              <span className="streak-hint">{nextStep.streakHint}</span>
            )}
            {dayMode === 'morning' && !energy && (
              <span className="mode-hint">Morgenmodus: erst Energie, dann ein Anker.</span>
            )}
            {dayMode === 'evening' && (
              <span className="mode-hint">Abendmodus: abschließen statt aufblasen.</span>
            )}
          </div>
          <div className="hero-card__actions">
            {nextStep && (
              <button
                type="button"
                className="primary-button"
                onClick={() => onOpenFocus(
                  focusTitle,
                  nextStep.kind === 'anchor' ? nextStep.index : undefined,
                  nextStep.kind === 'habit' ? nextStep.key as RoutineKey : undefined,
                  nextStep.kind === 'habit' ? nextStep.minutes : focusMinutesForNext,
                )}
              >
                <Play size={17} fill="currentColor" />
                Fokus starten
                <span>{focusMinutesForNext} Min.</span>
              </button>
            )}
            {nextStep && (
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
            <span>{policy.badge}</span>
          </div>
        </div>
      </section>

      {!energy && (
        <section className="card energy-card">
          <SectionTitle eyebrow="Kurz einchecken" title="Wie ist deine Energie heute?" />
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
        <div className="status-block">
          <div className="status-row">
            <span className={`energy-pill energy-pill--${energy}`}>
              {energy === 'low' ? <BatteryLow size={15} /> : <Activity size={15} />}
              Energie: {ENERGY_OPTIONS.find(option => option.value === energy)?.label}
            </span>
            <button type="button" className="text-button" onClick={() => onUpdate({ energyLevel: undefined })}>
              Ändern
            </button>
          </div>
          <div className="recovery-row" role="status">
            <div>
              <span className="eyebrow">Recovery</span>
              <strong>{recovery.score}% · {recovery.label}</strong>
              <p>{recovery.note}</p>
            </div>
            {recovery.suggestSoftMode && energy !== 'low' && (
              <button
                type="button"
                className="small-button"
                onClick={() => onUpdate({ energyLevel: 'low' })}
              >
                Soft-Mode
              </button>
            )}
          </div>
          {policy.policyNote && (
            <p className="policy-note" role="status">{policy.policyNote}</p>
          )}
          {skippedToday > 0 && (
            <p className="policy-note">{skippedToday} {plural(skippedToday, 'Habit', 'Habits')} heute laut Plan frei.</p>
          )}
        </div>
      )}

      <div className={`dashboard-grid dashboard-grid--${dayMode}`}>
        <section className="card tasks-card">
          <SectionTitle
            eyebrow="Tagesanker"
            title={policy.anchorTitle}
            action={
              <button type="button" className="small-button" onClick={onAddTask}>
                <Plus size={15} /> Aufgabe
              </button>
            }
          />
          {anchors.length === 0 ? (
            <EmptyState
              title="Noch keine Aufgaben"
              text={policy.emptyAnchorsText}
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
                    <button type="button" className="task-title" onClick={() => onOpenFocus(task, index, undefined, policy.focusMinutes)}>
                      <strong>{task}</strong>
                      <span>{done ? 'Erledigt' : `${policy.focusMinutes} Minuten Fokus`}</span>
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
            title={energy === 'low' ? 'Sanfte Routine' : 'Deine Routine'}
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
                        onOpenFocus(item.label, undefined, item.key as RoutineKey, item.minutes ?? policy.focusMinutes)
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
          {deferredRoutineItems.length > 0 && (
            <div className="deferred-routine">
              <span className="eyebrow">Heute optional</span>
              <div className="routine-list routine-list--deferred">
                {deferredRoutineItems.map(item => {
                  const Icon = item.icon
                  return (
                    <div key={item.key} className={item.done ? 'routine-item is-done is-deferred' : 'routine-item is-deferred'}>
                      <span className="routine-item__icon"><Icon size={18} /></span>
                      <button
                        type="button"
                        className="routine-item__main"
                        onClick={() => {
                          if (!item.done) promoteDeferred(item.key)
                          else onUpdate({ [item.key]: false } as Partial<DashboardEntry>)
                        }}
                      >
                        <span className="routine-item__copy">
                          <span className="routine-item__title">{item.label}</span>
                          <small>{item.done ? 'Erledigt' : 'Tippen zum Aktivieren'}</small>
                        </span>
                      </button>
                      <span className="routine-item__state">
                        {item.done ? <Check size={16} /> : <Plus size={16} />}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
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
  maxAnchors,
  energy,
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
  maxAnchors: number
  energy?: EnergyLevel
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
          <p>
            {energy === 'low'
              ? `Bei niedriger Energie maximal ${maxAnchors} Anker.`
              : energy === 'okay'
                ? `Machbarer Tag: maximal ${maxAnchors} Anker.`
                : `Ordne nur die Aufgaben, die heute wirklich zählen. Maximal ${maxAnchors}.`}
          </p>
        </div>
        <button type="button" className="primary-button" onClick={onAddTask} disabled={anchors.length >= maxAnchors}>
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
                  <button type="button" className="primary-button" onClick={onAddTask} disabled={anchors.length >= maxAnchors}><Plus size={16} /> Eigene Aufgabe</button>
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

          {/* Sleep duration — CollectUI soft duration interaction */}
          <p className="field-hint" style={{ marginBottom: 8 }}>Dauer</p>
          <SoftDurationInput
            value={entry.sleepDuration}
            onChange={next => onUpdate({ sleepDuration: next })}
          />
          <div className="choice-grid soft-duration-presets" style={{ marginTop: 10, marginBottom: 16 }}>
            {SLEEP_DURATION_PRESETS.map(opt => (
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
                  eyebrow="Werte"
                  title={isMorning ? 'Morgen-Protokoll' : 'Körper & Fokus'}
                />
                {isMorning ? (
                  <div className="form-grid">
                    <NumberField
                      label="Gewicht"
                      value={entry.weightKg}
                      unit="kg"
                      step={0.1}
                      min={35}
                      max={200}
                      placeholder="z. B. 65,0"
                      onChange={weightKg => onUpdate({ weightKg })}
                    />
                    <NumberField
                      label="Meditation"
                      value={entry.meditationMinutes}
                      unit="Min."
                      step={1}
                      max={180}
                      placeholder="z. B. 10"
                      onChange={meditationMinutes => onUpdate({ meditationMinutes })}
                    />
                  </div>
                ) : (
                  <div className="form-grid">
                    <NumberField
                      label={`Protein · Ziel ${settings.proteinGoal}`}
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
                      placeholder="z. B. 65,0"
                      onChange={weightKg => onUpdate({ weightKg })}
                    />
                    <NumberField
                      label="Wasser"
                      value={entry.waterLiters}
                      unit="L"
                      step={0.1}
                      max={10}
                      placeholder="z. B. 2,5"
                      onChange={waterLiters => onUpdate({ waterLiters })}
                    />
                    <NumberField
                      label="Deep Work"
                      value={entry.deepWorkHours}
                      unit="Std."
                      step={0.25}
                      max={16}
                      onChange={deepWorkHours => onUpdate({ deepWorkHours })}
                    />
                    <NumberField
                      label="Meditation"
                      value={entry.meditationMinutes}
                      unit="Min."
                      step={1}
                      max={180}
                      placeholder="z. B. 10"
                      onChange={meditationMinutes => onUpdate({ meditationMinutes })}
                    />
                  </div>
                )}
              </>
            )
          })()}
        </section>

        <section className="card checkin-card checkin-card--wide">
          <SectionTitle eyebrow="Abschluss" title="Eine kurze Notiz" />
          <p className="evening-prompt" role="note">{eveningPromptForDate(date)}</p>
          <textarea
            className="journal-field"
            value={journal}
            onChange={event => setJournal(event.target.value)}
            placeholder={eveningPromptForDate(date)}
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

function ProgressView({
  entries,
  today,
  scoreGoals,
}: {
  entries: DashboardEntry[]
  today: string
  scoreGoals: { proteinGoal: number; activeHabits: string[] }
}) {
  const lastSeven = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6)).map(date => {
    const entry = entries.find(item => item.date === date) ?? createDefaultEntry(date)
    return { date, score: clampNumber(calculateScore(entry, scoreGoals), 0, 100), entry }
  })
  const average = Math.round(lastSeven.reduce((sum, item) => sum + item.score, 0) / lastSeven.length)
  const best = Math.max(...lastSeven.map(item => item.score))
  const insights = buildWeekInsights(entries, today)

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
  const breakdown = getScoreBreakdown(todayEntry, scoreGoals)
  const heatmap = buildYearHeatmap(entries, today, e => calculateScore(e, scoreGoals))
  const strengthStats = (['proteinShake', 'gratitudeDone', 'focusDone', 'breathingDone'] as const).map(key => {
    const strength = calculateHabitStrength(entries, key, today)
    const habit = DAILY_HABITS.find(item => item.id === key)
    return {
      key,
      label: habit?.label ?? key,
      icon: habit?.icon ?? Sparkles,
      strength: strength.strength,
      strengthLabel: habitStrengthLabel(strength.strength),
      neverMissTwiceOk: strength.neverMissTwiceOk,
      streak: calculateStreakForHabit(entries, key),
    }
  })

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

      <section className="card insight-card">
        <SectionTitle eyebrow="Muster" title="Was die Woche dir sagt" />
        <div className="insight-list">
          {insights.map(insight => (
            <div className="insight-row" key={insight.id}>
              <strong>{insight.title}</strong>
              <p>{insight.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card heatmap-card">
        <SectionTitle eyebrow="Jahr" title="Beitrag ohne Streak-Druck" />
        <p className="field-hint" style={{ marginTop: -8, marginBottom: 14 }}>
          Helle Felder sind ruhige Tage — kein Reset, nur Rhythmus.
        </p>
        <div className="year-heatmap" role="img" aria-label="Jahres-Heatmap der Tages-Scores">
          {heatmap.map(cell => (
            <span
              key={cell.date}
              className={`year-heatmap__cell level-${cell.level}`}
              title={`${cell.date}: ${cell.score}%`}
            />
          ))}
        </div>
        <div className="year-heatmap__legend">
          <span>Weniger</span>
          <span className="year-heatmap__cell level-0" />
          <span className="year-heatmap__cell level-1" />
          <span className="year-heatmap__cell level-2" />
          <span className="year-heatmap__cell level-3" />
          <span className="year-heatmap__cell level-4" />
          <span>Mehr</span>
        </div>
      </section>

      <section className="card">
        <SectionTitle eyebrow="Stärke" title="Habit Strength" />
        <div className="strength-list">
          {strengthStats.map(item => {
            const Icon = item.icon
            return (
              <div className="strength-row" key={item.key}>
                <span className="soft-icon"><Icon size={16} /></span>
                <div>
                  <strong>{item.label}</strong>
                  <span>
                    {item.strengthLabel} · {item.strength}%
                    {item.neverMissTwiceOk ? ' · Nie 2× hintereinander' : ''}
                  </span>
                </div>
                <div className="mini-progress" aria-hidden="true">
                  <span style={{ width: `${item.strength}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

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
                <strong>{formatShortWeekday(item.date)}</strong>
                <small>{formatShortDate(item.date)}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <SectionTitle eyebrow="Rhythmus" title="Habit-Wochen" />
          <div className="rhythm-list">
            {habitStats.map(item => {
              const Icon = item.icon
              return (
                <div className="rhythm-row" key={item.label}>
                  <div className="rhythm-row__icon"><Icon size={18} /></div>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.count}/7 diese Woche · Streak {item.streak}</span>
                  </div>
                  <div className="radial-mini" style={{ '--value': `${(item.count / 7) * 360}deg` } as CSSProperties}>
                    <span>{item.count}</span>
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
  liveOverview,
  liveStats,
  energy,
  layout,
  onOpenSettings,
}: {
  dashboard: DashboardPlusState
  onChange: Dispatch<SetStateAction<DashboardPlusState>>
  onBackToToday: () => void
  today: string
  liveOverview: ReturnType<typeof deriveLaborOverview>
  liveStats: ReturnType<typeof deriveLaborStats>
  energy?: DashboardEntry['energyLevel']
  layout: DashboardPlusLayout
  onOpenSettings: () => void
}) {
  const [activeSection, setActiveSection] = useState<DashboardPlusSection>('overview')

  const tabsToRender = useMemo(() => {
    const visible = layout.order
      .filter(id => !layout.hidden.includes(id))
      .map(id => DASHBOARD_PLUS_TABS.find(tab => tab.id === id))
      .filter((tab): tab is (typeof DASHBOARD_PLUS_TABS)[number] => Boolean(tab))
    return visible.length > 0 ? visible : DASHBOARD_PLUS_TABS
  }, [layout])

  const currentSection = tabsToRender.some(tab => tab.id === activeSection)
    ? activeSection
    : tabsToRender[0].id
  const [activeBoardId, setActiveBoardId] = useState(dashboard.boards[0]?.id ?? 'personal')
  const openFocusTodos = dashboard.focusTodos.filter(task => !task.done).length
  const lowStockCount = dashboard.supplements.filter(item => item.dailyUse > 0 && item.stock <= item.dailyUse * 7).length
  const hints = smartLaborHints({
    energy,
    score: liveOverview.score,
    openTodos: openFocusTodos,
    lowStockCount,
  })

  useEffect(() => {
    if (!dashboard.boards.some(board => board.id === activeBoardId)) {
      setActiveBoardId(dashboard.boards[0]?.id ?? 'personal')
    }
  }, [activeBoardId, dashboard.boards])

  const activeBoard = dashboard.boards.find(board => board.id === activeBoardId) ?? dashboard.boards[0]
  const financeSummary = useMemo(() => deriveFinanceSummary(dashboard.finances), [dashboard.finances])
  const formatMoney = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 2, minimumFractionDigits: 0 })

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
      supplements: [...current.supplements, { id: crypto.randomUUID(), name: 'Neues Produkt', brand: '', stock: 0, unit: 'g', dailyUse: 0, dailyUnit: 'g' }],
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

  const addShoppingItem = () => {
    onChange(current => ({
      ...current,
      shopping: {
        ...current.shopping,
        items: [
          ...current.shopping.items,
          {
            id: crypto.randomUUID(),
            icon: 'bag',
            name: 'Neuer Artikel',
            note: '',
            price: 0,
            done: false,
          },
        ],
      },
    }))
  }

  const removeShoppingItem = (index: number) => {
    onChange(current => ({
      ...current,
      shopping: {
        ...current.shopping,
        items: current.shopping.items.filter((_, itemIndex) => itemIndex !== index),
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

  const renderBillCard = (
    bill: DashboardPlusBill,
    index: number,
    onPatch: (index: number, patch: Partial<DashboardPlusBill>) => void,
  ) => (
    <div
      className={`bill-card dashboard-plus-bill-card is-${bill.status}`}
      key={bill.id}
    >
      <div className="bill-dot" style={{ background: bill.color }} aria-hidden="true" />
      <div className="bill-body dashboard-plus-bill-body">
        <input
          className="dashboard-plus-input dashboard-plus-input--title dashboard-plus-input--ghost"
          value={bill.name}
          onChange={event => onPatch(index, { name: event.target.value })}
          aria-label="Rechnungsname"
        />
        <input
          className="dashboard-plus-input dashboard-plus-input--ghost"
          value={bill.subtitle}
          onChange={event => onPatch(index, { subtitle: event.target.value })}
          aria-label="Rechnungsdetails"
        />
        <div className="dashboard-plus-bill-meta">
          <select
            className={`bill-status-select is-${bill.status}`}
            value={bill.status}
            onChange={event => onPatch(index, { status: event.target.value as DashboardPlusBillStatus })}
            aria-label="Status"
          >
            <option value="open">Offen</option>
            <option value="overdue">Überfällig</option>
            <option value="paid">Bezahlt</option>
          </select>
          <input
            className="dashboard-plus-input dashboard-plus-input--ghost dashboard-plus-input--due"
            value={bill.due}
            onChange={event => onPatch(index, { due: event.target.value })}
            aria-label="Fälligkeit"
          />
        </div>
      </div>
      <div className="bill-right dashboard-plus-bill-right">
        <label className="bill-amount-field">
          <span className="bill-amount-prefix">€</span>
          <input
            className="dashboard-plus-input dashboard-plus-input--money dashboard-plus-input--ghost"
            type="number"
            min="0"
            value={bill.amount}
            onChange={event => onPatch(index, { amount: Number(event.target.value) || 0 })}
            aria-label="Betrag"
          />
        </label>
        <span className={`bill-status-pill is-${bill.status}`}>{billStatusLabel(bill.status)}</span>
      </div>
    </div>
  )

  return (
    <div className="view-stack dashboard-plus-view">
      <section className="page-intro dashboard-plus-intro">
        <div>
          <span className="eyebrow">Labor</span>
          <h2>Verwaltung ohne Fokus-Diebstahl.</h2>
          <p>
            Bestände, Boards und Listen — angebunden an deinen echten Tageskern. Lokal auf diesem Gerät.
          </p>
        </div>
        <div className="dashboard-plus-intro__actions">
          <button type="button" className="secondary-button" onClick={onBackToToday}>
            <ChevronLeft size={16} /> Zum Tageskern
          </button>
          <button type="button" className="secondary-button" onClick={onOpenSettings}>
            <LayoutGrid size={16} /> Reiter anpassen
          </button>
          <span className="sync-pill sync-pill--synced" title="Kein Cloud-Sync">
            <Cloud size={14} /> Lokal
          </span>
        </div>
      </section>

      <nav className="dashboard-plus-tabbar" role="tablist" aria-label="Dashboard+ Bereiche">
        {tabsToRender.map(tab => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            aria-selected={currentSection === tab.id}
            className={currentSection === tab.id ? 'dashboard-plus-tab active' : 'dashboard-plus-tab'}
            onClick={() => setActiveSection(tab.id)}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {currentSection === 'overview' && (
        <section className="card dashboard-plus-hero">
          <div className="dashboard-plus-hero__meta">
            <div>
              <span className="eyebrow">{liveOverview.dateLabel}</span>
              <h2>Live aus dem Tageskern</h2>
            </div>
            <ProgressRing value={liveOverview.score} size={86} />
          </div>
          <div className="dashboard-plus-hero__stats">
            <div className="kpi-card dashboard-plus-metric">
              <span>Habits</span>
              <strong>{liveOverview.habits}/{liveOverview.habitsTotal || 0}</strong>
              <small>heute erledigt</small>
            </div>
            <div className="kpi-card dashboard-plus-metric">
              <span>Anker</span>
              <strong>{liveOverview.todos}/{liveOverview.todosTotal || 0}</strong>
              <small>heute</small>
            </div>
            <div className="kpi-card dashboard-plus-metric">
              <span>Boards</span>
              <strong>{liveOverview.projects}</strong>
              <small>mit offenen Tasks</small>
            </div>
          </div>
          <div className="labor-hints">
            {hints.map(hint => (
              <p key={hint}>{hint}</p>
            ))}
          </div>
        </section>
      )}

      {currentSection === 'todos' && (
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

      {currentSection === 'stock' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle eyebrow="Supplements" title="Bestände" action={<button type="button" className="small-button" onClick={addSupplement}><Plus size={14} /> Produkt</button>} />
          <div className="dashboard-plus-supplements">
            {dashboard.supplements.map((item, index) => {
              const daysLeft = supplementDaysRemaining(item.stock, item.dailyUse)
              const isLow = daysLeft !== null && daysLeft <= 7
              const accent = supplementAccent(item, index)
              return (
                <div
                  className={`supp-card dashboard-plus-supp-card${isLow ? ' is-low' : ''}`}
                  style={{ ['--supp-accent' as string]: accent }}
                  key={item.id}
                >
                  <input
                    className="dashboard-plus-input dashboard-plus-input--title"
                    value={item.name}
                    onChange={event => updateSupplement(index, { name: event.target.value })}
                    aria-label="Produktname"
                  />
                  <input
                    className="dashboard-plus-input"
                    value={item.brand}
                    onChange={event => updateSupplement(index, { brand: event.target.value })}
                    placeholder="Marke / Info"
                    aria-label="Marke oder Info"
                  />
                  <div className="dashboard-plus-supp-fields">
                    <label className="dashboard-plus-supp-field">
                      <span className="dashboard-plus-supp-label">Bestand</span>
                      <div className="dashboard-plus-inline-row">
                        <input
                          className="dashboard-plus-input"
                          type="number"
                          min="0"
                          value={item.stock}
                          onChange={event => updateSupplement(index, { stock: Number(event.target.value) || 0 })}
                          aria-label="Bestand"
                        />
                        <input
                          className="dashboard-plus-input dashboard-plus-input--unit"
                          value={item.unit}
                          onChange={event => updateSupplement(index, { unit: event.target.value })}
                          aria-label="Bestand Einheit"
                          placeholder="Einheit"
                        />
                      </div>
                    </label>
                    <label className="dashboard-plus-supp-field">
                      <span className="dashboard-plus-supp-label">Tagesdosis</span>
                      <div className="dashboard-plus-inline-row">
                        <input
                          className="dashboard-plus-input"
                          type="number"
                          min="0"
                          value={item.dailyUse}
                          onChange={event => updateSupplement(index, { dailyUse: Number(event.target.value) || 0 })}
                          aria-label="Tagesdosis"
                        />
                        <input
                          className="dashboard-plus-input dashboard-plus-input--unit"
                          value={item.dailyUnit}
                          onChange={event => updateSupplement(index, { dailyUnit: event.target.value })}
                          aria-label="Tagesdosis Einheit"
                          placeholder="Einheit"
                        />
                      </div>
                    </label>
                  </div>
                  {isLow && (
                    <p className="dashboard-plus-supp-hint">
                      {daysLeft! <= 0
                        ? 'Bestand leer — nachbestellen'
                        : `Noch ca. ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'} · nachbestellen`}
                    </p>
                  )}
                  <button type="button" className="secondary-button secondary-button--full" onClick={() => removeSupplement(index)}>
                    <Trash2 size={15} /> Entfernen
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </div>
      )}

      {currentSection === 'medications' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle eyebrow="Gesundheit" title="Medikamente" action={<button type="button" className="small-button" onClick={addMedication}><Plus size={14} /> Medikament</button>} />
          <div className="dashboard-plus-supplements">
            {dashboard.medications.map((item, index) => {
              const takenToday = isMedicationTakenToday(item, today)
              return (
              <div className="supp-card dashboard-plus-supp-card" style={{ borderTopColor: item.color }} key={item.id}>
                <div className="dashboard-plus-med-head">
                  <input className="dashboard-plus-input dashboard-plus-input--title" value={item.name} onChange={event => updateMedication(index, { name: event.target.value })} />
                  <button
                    type="button"
                    className={takenToday ? 'status-chip status-chip--good' : 'status-chip'}
                    onClick={() => updateMedication(index, {
                      takenDate: takenToday ? undefined : today,
                      taken: !takenToday,
                    })}
                    aria-pressed={takenToday}
                  >
                    <span className="status-chip__dot" />{takenToday ? 'Heute genommen' : 'Ausstehend'}
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
              )
            })}
          </div>
        </section>
      </div>
      )}

      {currentSection === 'goals' && (
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

      {currentSection === 'shopping' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle
            eyebrow="Kaufliste"
            title="Offen"
            action={<button type="button" className="small-button" onClick={addShoppingItem}><Plus size={14} /> Artikel</button>}
          />
          <div className="shopping-list dashboard-plus-shopping-list">
            {dashboard.shopping.items.length === 0 && (
              <p className="dashboard-plus-empty-hint">Noch keine Artikel — füge den ersten hinzu.</p>
            )}
            {dashboard.shopping.items.map((item, index) => {
              return (
              <div className={item.done ? 'shop-item is-done' : 'shop-item'} key={item.id}>
                <div className="shop-icon" aria-hidden="true">
                  <ShoppingItemIcon icon={item.icon} />
                </div>
                <div className="shop-body dashboard-plus-shop-body">
                  <input className="dashboard-plus-input dashboard-plus-input--title" value={item.name} onChange={event => updateShoppingItem(index, { name: event.target.value })} aria-label="Artikel" placeholder="Artikel" />
                  <input className="dashboard-plus-input" value={item.note} onChange={event => updateShoppingItem(index, { note: event.target.value })} aria-label="Notiz oder Quelle" placeholder="Notiz / Quelle" />
                  {item.lowStock && (
                    <span className="status-chip status-chip--warn"><span className="status-chip__dot" />Bestand kritisch</span>
                  )}
                </div>
                <div className="dashboard-plus-shop-meta">
                  <input className="dashboard-plus-input dashboard-plus-input--money" type="number" min="0" step="0.01" value={item.price} onChange={event => updateShoppingItem(index, { price: Number(event.target.value) || 0 })} aria-label="Preis" />
                  <span className="shop-price">€</span>
                </div>
                <div className="dashboard-plus-shop-actions">
                  <button type="button" className="shop-check" onClick={() => updateShoppingItem(index, { done: !item.done })} aria-pressed={item.done} aria-label={item.done ? 'Als offen markieren' : 'Als erledigt markieren'} />
                  <button type="button" className="icon-button" onClick={() => removeShoppingItem(index)} aria-label="Artikel entfernen">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              )
            })}
          </div>
        </section>
      </div>
      )}

      {currentSection === 'stats' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card">
          <SectionTitle eyebrow="Stats" title="Woche aus dem Kern" />
          <div className="labor-live-stats">
            <div className="kpi-card"><span>Schnitt</span><strong>{liveStats.average}%</strong></div>
            <div className="kpi-card"><span>Best</span><strong>{liveStats.best}%</strong></div>
            <div className="kpi-card"><span>Rhythmus</span><strong>{liveStats.rhythm}</strong><small>Tage</small></div>
            <div className="kpi-card"><span>Gewicht</span><strong>{liveStats.weight ? liveStats.weight.toFixed(1) : '—'}</strong><small>kg</small></div>
          </div>
          <div className="labor-week-bars" aria-hidden="true">
            {liveStats.weeklyBars.map((value, index) => (
              <div key={liveStats.weekDates[index]} className="labor-week-bar">
                <span style={{ height: `${Math.max(value, 4)}%` }} />
                <small>{value}</small>
              </div>
            ))}
          </div>
          <p className="labor-stats-note">Projektfortschritt unten ist Labor-Notiz — der echte Wochenverlauf bleibt unter „Verlauf“.</p>

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

      {currentSection === 'finance' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle eyebrow="Finanzen" title="Rechnungen" />
          <div className="finance-kpi-row">
            <div className="finance-kpi">
              <span className="finance-kpi__label">Monatlich fix</span>
              <strong className="finance-kpi__value">€ {formatMoney(financeSummary.monthlyFixed)}</strong>
              <small className="finance-kpi__meta">{financeSummary.recurringCount} Fixkosten</small>
            </div>
            <div className="finance-kpi">
              <span className="finance-kpi__label">Offen</span>
              <strong className="finance-kpi__value">€ {formatMoney(financeSummary.openSum)}</strong>
              <small className="finance-kpi__meta">{financeSummary.openCount} offen</small>
            </div>
            <div className={`finance-kpi${financeSummary.overdueCount > 0 ? ' is-warning' : ''}`}>
              <span className="finance-kpi__label">Überfällig</span>
              <strong className="finance-kpi__value">€ {formatMoney(financeSummary.overdueSum)}</strong>
              <small className="finance-kpi__meta">{financeSummary.overdueCount} überfällig</small>
            </div>
          </div>

          {financeSummary.hints.length > 0 && (
            <div className="finance-hints">
              {financeSummary.hints.map(hint => (
                <p key={hint}>
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>{hint}</span>
                </p>
              ))}
            </div>
          )}

          <div className="dashboard-plus-finance-columns">
            <div>
              <div className="fin-section-label">
                <CreditCard size={14} aria-hidden="true" />
                <span>Wiederkehrend</span>
              </div>
              <div className="dashboard-plus-bill-list">
                {dashboard.finances.recurring.map((bill, index) => renderBillCard(bill, index, updateRecurringBill))}
              </div>
            </div>

            <div>
              <div className="fin-section-label">
                <Receipt size={14} aria-hidden="true" />
                <span>Offene Rechnungen</span>
              </div>
              <div className="dashboard-plus-bill-list">
                {dashboard.finances.openBills.map((bill, index) => renderBillCard(bill, index, updateOpenBill))}
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
  const finishedRef = useRef(false)
  useModalBehavior(onClose)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSecondsLeft(session.minutes * 60)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRunning(false)
    finishedRef.current = false
  }, [session.minutes])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setSecondsLeft(current => {
        if (current <= 1) {
          window.clearInterval(timer)
          setRunning(false)
          if (!finishedRef.current) {
            finishedRef.current = true
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Fokusblock beendet', { body: session.title })
            }
            window.setTimeout(() => onFinish(), 0)
          }
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running, session.title, onFinish])

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
  lastBackupAt,
  onChange,
  onExport,
  onImport,
  onClose,
}: {
  settings: AppSettings
  lastBackupAt: string | null
  onChange: (settings: AppSettings) => void
  onExport: () => void
  onImport: (file: File) => Promise<void>
  onClose: () => void
}) {
  useModalBehavior(onClose)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const layout = settings.dashboardPlusLayout

  const moveDashboardTab = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= layout.order.length) return
    const nextOrder = [...layout.order]
    const [moved] = nextOrder.splice(index, 1)
    nextOrder.splice(target, 0, moved)
    onChange({ ...settings, dashboardPlusLayout: { ...layout, order: nextOrder } })
  }

  const toggleDashboardTabHidden = (id: DashboardPlusSection) => {
    const isHidden = layout.hidden.includes(id)
    if (!isHidden && layout.hidden.length >= DASHBOARD_PLUS_SECTION_IDS.length - 1) return
    const nextHidden = isHidden ? layout.hidden.filter(hiddenId => hiddenId !== id) : [...layout.hidden, id]
    onChange({ ...settings, dashboardPlusLayout: { ...layout, hidden: nextHidden } })
  }

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
            Aktive Habits erscheinen in der Routine. Wochentage steuern, an welchen Tagen sie fällig sind (leer = jeden Tag).
          </p>
          <div className="habit-settings-list">
            {DAILY_HABITS.map(h => {
              const active = settings.activeHabits.includes(h.id)
              const schedule = settings.habitSchedules[h.id]
              return (
                <div className="habit-settings-row" key={h.id}>
                  <button
                    type="button"
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
                  {active && (
                    <div className="weekday-chip-row" role="group" aria-label={`${h.label} Wochentage`}>
                      {WEEKDAY_LABELS.map(day => {
                        const selected = !schedule || schedule.includes(day.value)
                        return (
                          <button
                            type="button"
                            key={day.value}
                            className={selected ? 'weekday-chip is-active' : 'weekday-chip'}
                            onClick={() => onChange({
                              ...settings,
                              habitSchedules: toggleScheduleDay(settings.habitSchedules, h.id, day.value),
                            })}
                            aria-pressed={selected}
                          >
                            {day.short}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="settings-section">
          <h3>Dashboard+ Reiter</h3>
          <p style={{ margin: '-6px 0 12px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Reihenfolge und Sichtbarkeit der Dashboard+ Bereiche anpassen. Mindestens ein Reiter bleibt sichtbar.
          </p>
          <ul className="reorder-list">
            {layout.order.map((id, index) => {
              const tab = DASHBOARD_PLUS_TABS.find(t => t.id === id)
              if (!tab) return null
              const hidden = layout.hidden.includes(id)
              return (
                <li key={id} className={hidden ? 'reorder-row is-hidden' : 'reorder-row'}>
                  <tab.icon size={16} />
                  <span className="reorder-row__label">{tab.label}</span>
                  <div className="reorder-row__actions">
                    <IconButton
                      label={`${tab.label} nach oben verschieben`}
                      onClick={() => moveDashboardTab(index, -1)}
                      disabled={index === 0}
                    >
                      <ChevronUp size={15} />
                    </IconButton>
                    <IconButton
                      label={`${tab.label} nach unten verschieben`}
                      onClick={() => moveDashboardTab(index, 1)}
                      disabled={index === layout.order.length - 1}
                    >
                      <ChevronDown size={15} />
                    </IconButton>
                    <IconButton
                      label={hidden ? `${tab.label} einblenden` : `${tab.label} ausblenden`}
                      onClick={() => toggleDashboardTabHidden(id)}
                      className={hidden ? '' : 'is-active'}
                    >
                      {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                    </IconButton>
                  </div>
                </li>
              )
            })}
          </ul>
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

        <div className="settings-section">
          <h3>Backup</h3>
          <p className="settings-help">
            Vollbackup enthält Tage, Settings, Labor und XP. Kein Cloud-Sync — nur dieser Browser.
          </p>
          <p className="settings-help">
            Letztes Backup: {lastBackupAt
              ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lastBackupAt))
              : 'noch keines'}
          </p>
          <div className="settings-actions">
            <button type="button" className="secondary-button" onClick={onExport}>
              <ChevronDown size={16} /> Backup exportieren
            </button>
            <button type="button" className="secondary-button" onClick={() => importInputRef.current?.click()}>
              <ChevronUp size={16} /> Backup importieren
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
        </div>

        <div className="settings-note">
          <Bell size={18} />
          <p>Benachrichtigungen werden nie ungefragt angefordert. Timer-Hinweise nur mit bestehender Berechtigung. Daten bleiben lokal — Export regelmäßig machen.</p>
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
