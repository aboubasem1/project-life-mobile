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
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Brain,
  CalendarPlus,
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
  Database,
  Droplet,
  Dumbbell,
  Fish,
  Eye,
  EyeOff,
  FlaskConical,
  Focus,
  Home,
  Inbox,
  LayoutGrid,
  Mic,
  Leaf,
  Moon,
  Pause,
  Pencil,
  Pill,
  Play,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Settings,
  Share2,
  ShoppingBag,
  Smartphone,
  Snowflake,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  User,
  Users,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEntries } from './hooks/useEntries'
import { SwipeableRow } from './components/SwipeableRow'
import { ContextMenu, type ContextMenuItem } from './components/ContextMenu'
import type { DashboardEntry } from './types/DashboardEntry'
import { createDefaultEntry } from './types/DashboardEntry'
import { getDayPolicy } from './lib/dayPolicy'
import { buildWeekInsights } from './lib/insights'
import { deriveLaborOverview, deriveLaborStats, smartLaborHints } from './lib/laborLive'
import { searchLabor } from './lib/laborSearch'
import { buildMonthGrid, monthLabel } from './lib/calendarGrid'
import { hashFromView, hashPathOnly, isProgressHubView, labDataSectionFromHash, navigateHash, navigateHashWithId, navigateLabDataSection, peekAppAction, takeAppActionFromLocation, viewFromHash, entityIdFromHash, buildActionUrl, SHORTCUT_RECIPES, VIEW_LABELS, type AppAction, type AppView, type LabDataSection } from './lib/routing'
import {
  LAB_DATA_AREAS,
  LAB_DATA_SECTION_IDS,
  contextLineForSection,
  type LabDataQuickAction,
} from './lib/labDataNav'
import { shareOrDownloadIcs } from './lib/ics'
import { copyText, shareText } from './lib/share'
import { releaseScreenWakeLock, requestScreenWakeLock } from './lib/wakeLock'
import { calculateScore, calculateStreakForHabit, getScoreBreakdown } from './lib/score'
import { calculateHabitStrength, habitStrengthLabel } from './lib/habitStrength'
import {
  filterHabitsForDate,
  normalizeHabitSchedules,
  toggleScheduleDay,
  WEEKDAY_LABELS,
  type HabitScheduleMap,
} from './lib/habitSchedule'
import { buildYearHeatmap, eveningPromptForDate } from './lib/heatmap'
import { buildWeeklyReview, buildWeightSeries } from './lib/weeklyReview'
import {
  averageSleepHours,
  buildWeightInsights,
  formatSleepHoursLabel,
  hoursBetweenTimes,
  macroProgress,
} from './lib/healthMetrics'
import type { HabitKey } from './types/DashboardEntry'
import {
  applyBackupExtras,
  exportBackupBundle,
  getLastBackupAt,
  importBackupFile,
  mergeEntriesByDate,
  saveAllEntries,
} from './lib/storage'
import {
  clearSyncCredentials,
  createDevicePairing,
  isDeviceSyncEnabled,
  joinDevicePairing,
  LIFE_OS_SYNC_EXTRAS_EVENT,
  loadSyncCredentials,
  remoteApplyGenerationNow,
  pushDeviceSync,
  refreshPairCode,
  type DeviceSyncCredentials,
} from './lib/deviceSync'
import { levelProgress, loadXP, recomputeXPFromEntries, xpToNextLevel } from './lib/xp-store'
import {
  dueMedicationReminders,
  isMedTakenToday,
  reminderStorageKey,
} from './lib/medReminders'
import {
  FULLSCREEN_STEP_IDS,
  MORNING_RITUAL_PROGRESS_KEY,
  loadMorningGateSkip,
  loadMorningRitualProgress,
  markRitualStepDone,
  morningRitualMeta,
  morningRitualPhase,
  moveRitualStep,
  nextMorningRitualStep,
  normalizeMorningRitualConfig,
  normalizeSelfcareItems,
  ritualSequence,
  saveMorningGateSkip,
  saveMorningRitualProgress,
  type MorningRitualConfig,
  type MorningRitualProgress,
  type MorningRitualStepId,
} from './lib/morningGate'
import { useLifeOs } from './hooks/useLifeOs'
import {
  LIFE_OS_CHANGE_EVENT,
  buildDeterministicInsights,
  completeReview,
  createCapture,
  createConnectorInstance,
  createId,
  createReviewDraft,
  emitDomainEvent,
  hashSecret,
  interpretInsights,
  nowIso,
  periodForReviewType,
  relatedIds,
  refreshDecisionStatus,
  groupByResolvedArea,
  lifeAreaTransitionEvents,
  matchesAreaFilter,
  parseLifeArea,
  resolveLifeArea,
  type AreaFilter,
  type CaptureTargetType,
  type Decision,
  type DomainEventType,
  type Insight,
  type KnowledgeItem,
  type LifeAreaKey,
  type Review,
  type ReviewType,
} from './lib/lifeos'
import { applyConvertToDashboard } from './lib/lifeos/dashboardBridge'
import {
  applyDecisionBatch,
  decideCaptureInput,
  defaultRoutineMeals,
  previewFromBatch,
  recordDecisionAudits,
  rememberExecutedKeys,
  resolveDecisionFlags,
  type DecisionBatch,
} from './lib/decision-engine'
import { CaptureSheet } from './views/lifeos/CaptureSheet'
import { ChangePreviewSheet } from './components/ChangePreviewSheet'
import { CommandPalette } from './views/lifeos/CommandPalette'
import { DecisionView } from './views/lifeos/DecisionView'
import { GoalDetailView } from './views/lifeos/GoalDetailView'
import { InboxView } from './views/lifeos/InboxView'
import { InsightsView } from './views/lifeos/InsightsView'
import { IntegrationsView } from './views/lifeos/IntegrationsView'
import { KnowledgeView } from './views/lifeos/KnowledgeView'
import { ProjectDetailView } from './views/lifeos/ProjectDetailView'
import { ReviewView } from './views/lifeos/ReviewView'
import { SignalsView } from './views/lifeos/SignalsView'
import { LifeAreaFilter, LifeAreaMark, LifeAreaSelect } from './views/lifeos/lifeosUi'
import { MorningGate } from './components/MorningGate'
import { EveningGate } from './components/EveningGate'
import { ProgressHubNav } from './components/ProgressHubNav'
import { LabDataMobileChrome } from './components/lab/LabDataMobileChrome'
import { RoutineModeSelector } from './components/RoutineModeSelector'
import { PrivateNotesSheet } from './components/PrivateNotesSheet'
import {
  defaultAdaptiveLifeConfig,
  labUiClassNames,
  applyNowDedupePolicy,
  readAdaptiveFromSettings,
  type AdaptiveLifeConfig,
} from './lib/adaptive-core'
import {
  commitSystemChange,
  tryOpenSystemChange,
  undoSystemChange,
  type JoChangeSession,
} from './lib/adaptive-core/jo/system-change'
import { emitAdaptiveEvent } from './lib/adaptive-core/events/store'
import {
  assessDailyProgress,
  completedRitualSteps,
  eveningOwnedHabitKeys,
  eveningRemaining,
  entryHasMeal,
  isHabitRelevantNow,
  isHeadRecoveryDone,
  nowChipLabel,
  overviewSlot,
  ritualOwnedHabitKeys,
  ritualRemaining,
  selectNowItems,
  selectOverviewItems,
  SHAKE_MEAL_ID,
  shouldShowDailyClose,
  syncProteinShakeNutrition,
  weekDateKeys,
  type DaySlot,
  type NowItem,
} from './lib/dailyFlow'
import {
  loadBodyMeasurements,
  selectTodayWeight,
} from './lib/bodyMeasurement'
import { HabitDetailSheet } from './components/HabitDetailSheet'
import { defaultHabitKind, isHabitComplete, isHabitKey } from './lib/habitKinds'
import { moodHabitLine } from './lib/moodHabit'
import { appendJournal, formatNoteLine, mergeQuickNote, parseQuickNote } from './lib/inboundNote'
import {
  assessDayCompleteness,
  EVENING_CLOSE_CHECK_IDS,
  EVENING_CLOSE_CHECK_META,
  normalizeEveningGateConfig,
  type EveningCloseCheckId,
  type EveningGateConfig,
} from './lib/dayClose'
import {
  LIFE_OS_DAILY_EVENTS_EVENT,
  appendDailyEvent,
  buildUndoPatch,
  canUndoEntryPatch,
  canUndoRitualStep,
  capturePreviousValues,
  createEntryPatchEvent,
  createRitualStepEvent,
  DAILY_EVENTS_KEY,
  eventsForDate,
  formatEventTime,
  loadDailyEvents,
  sourceLabel,
  summarizeDailyEvent,
  type DailyEvent,
  type DailyEventSource,
  type EntryPatchEvent,
} from './lib/dailyEvents'
import './launch.css'

type View = AppView
type ThemePreference = 'light' | 'dark' | 'system'
type AccentPreference = 'ice' | 'terracotta' | 'sage' | 'ocean' | 'lilac' | 'amber'

const ACCENT_OPTIONS: Array<{ id: AccentPreference; label: string; swatch: string }> = [
  { id: 'ice', label: 'Ice', swatch: '#CFECF3' },
  { id: 'terracotta', label: 'Terrakotta', swatch: '#c77f6b' },
  { id: 'sage', label: 'Salbei', swatch: '#6f8f7d' },
  { id: 'ocean', label: 'Ozean', swatch: '#6e8db1' },
  { id: 'lilac', label: 'Flieder', swatch: '#a08cb8' },
  { id: 'amber', label: 'Bernstein', swatch: '#b68c4c' },
]

const ACCENT_IDS = ACCENT_OPTIONS.map(option => option.id)
type EnergyLevel = NonNullable<DashboardEntry['energyLevel']>
type RoutineKey =
  | 'breathingDone' | 'coldShower' | 'proteinShake'
  | 'pushupsDone' | 'squatsDone' | 'wallsitDone' | 'plankDone'
  | 'gratitudeDone' | 'focusDone' | 'winnerModeDone'
  | 'journalDone' | 'familyTimeDone'

type AppSettings = {
  name: string
  theme: ThemePreference
  accent: AccentPreference
  focusMinutes: number
  proteinGoal: number
  calorieGoal: number
  fatGoal: number
  carbsGoal: number
  fiberGoal: number
  /** For BMI; 0 = nicht gesetzt. */
  heightCm: number
  /** Target weight; 0 = nicht gesetzt. */
  weightGoalKg: number
  /** Optional baseline for progress; 0 = erster gespeicherter Wert. */
  weightStartKg: number
  activeHabits: string[]
  /** Empty / missing = every day. Values 0=Mo … 6=So. */
  habitSchedules: HabitScheduleMap
  dashboardPlusLayout: DashboardPlusLayout
  /** Opt-in: soft Medis reminders when clock matches (no auto permission ask). */
  medisRemindersEnabled: boolean
  /** First open of the day: complete these widgets before Heute. */
  morningGateEnabled: boolean
  morningRitual: MorningRitualConfig
  eveningGate: EveningGateConfig
  adaptive: AdaptiveLifeConfig
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
  plannedMinutes?: number
  actualMinutes?: number
  lifeArea?: LifeAreaKey
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

type ProjectStatus = 'active' | 'paused' | 'done' | 'archived'

type ProjectMilestone = { id: string; title: string; done: boolean; due?: string }

type DashboardPlusBoard = {
  id: string
  label: string
  count: number
  tasks: DashboardPlusTask[]
  description?: string
  outcome?: string
  status?: ProjectStatus
  priority?: DashboardPlusPriority
  startDate?: string
  targetDate?: string
  nextAction?: string
  nextActionTaskId?: string
  milestones?: ProjectMilestone[]
  goalId?: string
  lastActivityAt?: string
  lifeArea?: LifeAreaKey
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
  /** Soft reminder at `time` when settings.medisRemindersEnabled */
  remind?: boolean
  color: string
}

function isMedicationTakenToday(item: DashboardPlusMedication, today: string): boolean {
  return isMedTakenToday(item, today)
}

function normalizeMedication(item: DashboardPlusMedication, today: string): DashboardPlusMedication {
  if (item.taken && !item.takenDate) {
    return { ...item, takenDate: today, taken: true }
  }
  return item
}

type DashboardPlusGoalTimeframe = 'Jahr' | 'Quartal' | 'Monat' | 'Woche'

type GoalCheckIn = { id: string; at: string; note: string; value?: number }

type DashboardPlusGoal = {
  id: string
  title: string
  timeframe: DashboardPlusGoalTimeframe
  percent: number
  dueDate: string
  color: string
  description?: string
  outcome?: string
  metric?: string
  target?: number
  current?: number
  unit?: string
  status?: 'active' | 'paused' | 'done' | 'dropped'
  checkIns?: GoalCheckIn[]
  lifeArea?: LifeAreaKey
}

type FinanceSummary = {
  monthlyFixed: number
  recurringCount: number
  openSum: number
  openCount: number
  overdueSum: number
  overdueCount: number
  pressure: number
  nextDue: { name: string; due: string; amount: number } | null
  hints: string[]
}

function sumBillAmounts(bills: DashboardPlusBill[]): number {
  return bills.reduce((total, bill) => total + (Number.isFinite(bill.amount) ? bill.amount : 0), 0)
}

function parseBillDueDate(due: string): string | null {
  const value = String(due ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return null
}

function cycleBillStatus(status: DashboardPlusBillStatus): DashboardPlusBillStatus {
  switch (status) {
    case 'open':
      return 'paid'
    case 'paid':
      return 'overdue'
    case 'overdue':
      return 'open'
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function createBillDraft(
  kind: 'recurring' | 'open',
  today: string,
  index: number,
): DashboardPlusBill {
  return {
    id: crypto.randomUUID(),
    name: kind === 'recurring' ? 'Neue Fixkosten' : 'Neue Rechnung',
    subtitle: kind === 'recurring' ? 'monatlich' : '',
    amount: 0,
    due: today,
    status: 'open',
    color: SUPPLEMENT_ACCENTS[index % SUPPLEMENT_ACCENTS.length],
  }
}

function deriveFinanceSummary(finances: DashboardPlusState['finances']): FinanceSummary {
  const unpaidOpen = finances.openBills.filter(bill => bill.status === 'open')
  const overdueBills = [...finances.recurring, ...finances.openBills].filter(bill => bill.status === 'overdue')
  const monthlyFixed = sumBillAmounts(finances.recurring)
  const openSum = sumBillAmounts(unpaidOpen)
  const overdueSum = sumBillAmounts(overdueBills)
  const pressure = monthlyFixed > 0
    ? Math.round(((openSum + overdueSum) / monthlyFixed) * 100)
    : 0

  const nextCandidates = [...finances.recurring, ...finances.openBills]
    .filter(bill => bill.status === 'open' || bill.status === 'overdue')
    .map(bill => {
      const due = parseBillDueDate(bill.due)
      return due ? { name: bill.name || 'Rechnung', due, amount: bill.amount } : null
    })
    .filter((item): item is { name: string; due: string; amount: number } => Boolean(item))
    .sort((a, b) => a.due.localeCompare(b.due))
  const nextDue = nextCandidates[0] ?? null

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

  return {
    monthlyFixed,
    recurringCount: finances.recurring.length,
    openSum,
    openCount: unpaidOpen.length,
    overdueSum,
    overdueCount: overdueBills.length,
    pressure,
    nextDue,
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

type DashboardPlusListKind = 'pack' | 'wishlist' | 'books' | 'recipes' | 'custom'

type DashboardPlusListItem = {
  id: string
  title: string
  note: string
  done: boolean
}

type DashboardPlusList = {
  id: string
  title: string
  kind: DashboardPlusListKind
  items: DashboardPlusListItem[]
}

const LIST_KIND_LABELS: Record<DashboardPlusListKind, string> = {
  pack: 'Packliste',
  wishlist: 'Wunschliste',
  books: 'Bücher',
  recipes: 'Rezepte',
  custom: 'Liste',
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
  lists: DashboardPlusList[]
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

const DASHBOARD_PLUS_TABS = LAB_DATA_AREAS

type DashboardPlusSection = LabDataSection

const SETTINGS_KEY = 'life-os-v1-settings'
/** Stores the date of the last splash so the intro animation only plays on the first open of a day. */
const SPLASH_KEY = 'life-os-splash-day'
const QUICK_NOTE_KEY = 'life-os-quick-note'
const DASHBOARD_PLUS_KEY = 'life-os-v1-dashboard-plus'

function shouldBypassMorningGate(action: AppAction | null): boolean {
  return action?.kind === 'note'
    || action?.kind === 'log'
    || action?.kind === 'add-task'
    || action?.kind === 'focus'
    || action?.kind === 'capture'
}

// ── Data from projectbaby ────────────────────────────────────────────────────
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

function createDashboardPlusSeed(): DashboardPlusState {
  return {
    overview: {
      dateLabel: new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()),
      syncStatus: 'Lokal',
      syncTime: '',
      score: 0,
      habits: 0,
      todos: 0,
      projects: 0,
    },
    focusTodos: [],
    supplements: [],
    medications: [],
    goals: [],
    boards: [
      { id: 'personal', label: 'Personal', count: 0, tasks: [] },
      { id: 'work', label: 'Arbeit', count: 0, tasks: [] },
      { id: 'health', label: 'Health', count: 0, tasks: [] },
    ],
    shopping: { total: 0, items: [] },
    lists: [
      { id: 'pack', title: 'Packliste', kind: 'pack', items: [] },
      { id: 'wishlist', title: 'Wunschliste', kind: 'wishlist', items: [] },
    ],
    stats: {
      average: 0,
      best: 0,
      rhythm: 0,
      weight: 0,
      weeklyBars: [0, 0, 0, 0, 0, 0, 0],
      heatmap: [],
      projects: [],
    },
    finances: {
      monthlyFixed: 0,
      open: 0,
      overdue: 0,
      recurring: [],
      openBills: [],
    },
  }
}

function syncBoardCounts(boards: DashboardPlusBoard[]): DashboardPlusBoard[] {
  return boards.map(board => ({
    ...board,
    count: board.tasks.filter(task => !task.done).length,
  }))
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
  return {
    ...(PRIORITY_ORDER.includes(mapped) ? { ...task, priority: mapped } : { ...task, priority: 'p3' }),
    lifeArea: parseLifeArea(task.lifeArea),
  }
}

function resolveDashboardTaskArea(
  task: DashboardPlusTask,
  board: DashboardPlusBoard | undefined,
  goals: DashboardPlusGoal[],
) {
  const goal = board?.goalId ? goals.find(item => item.id === board.goalId) : undefined
  return resolveLifeArea({ explicit: task.lifeArea, project: board, goal })
}

function normalizeDashboardPlusState(parsed: Partial<DashboardPlusState> | null | undefined): DashboardPlusState {
  const seed = createDashboardPlusSeed()
  if (!parsed || typeof parsed !== 'object' || !parsed.overview) return seed

  return {
    overview: { ...seed.overview, ...parsed.overview },
    focusTodos: Array.isArray(parsed.focusTodos) ? parsed.focusTodos.map(normalizeTaskPriority) : seed.focusTodos,
    supplements: Array.isArray(parsed.supplements) ? parsed.supplements : seed.supplements,
    medications: Array.isArray(parsed.medications)
      ? parsed.medications.map(item => normalizeMedication(item, dateKey(new Date())))
      : seed.medications,
    goals: Array.isArray(parsed.goals) ? parsed.goals.map(goal => ({
      ...goal,
      checkIns: Array.isArray(goal.checkIns) ? goal.checkIns : [],
      lifeArea: parseLifeArea(goal.lifeArea),
    })) : seed.goals,
    boards: Array.isArray(parsed.boards)
      ? syncBoardCounts(parsed.boards.map(board => ({
        ...board,
        lifeArea: parseLifeArea(board.lifeArea),
        tasks: Array.isArray(board.tasks) ? board.tasks.map(normalizeTaskPriority) : [],
        milestones: Array.isArray(board.milestones) ? board.milestones : [],
      })))
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
    lists: Array.isArray(parsed.lists) && parsed.lists.length > 0
      ? parsed.lists.map(list => ({
        id: String(list.id || crypto.randomUUID()),
        title: String(list.title || 'Liste'),
        kind: (['pack', 'wishlist', 'books', 'recipes', 'custom'] as const).includes(list.kind as DashboardPlusListKind)
          ? list.kind as DashboardPlusListKind
          : 'custom',
        items: Array.isArray(list.items)
          ? list.items.map(item => ({
            id: String(item.id || crypto.randomUUID()),
            title: String(item.title || ''),
            note: String(item.note || ''),
            done: Boolean(item.done),
          }))
          : [],
      }))
      : seed.lists,
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

const DASHBOARD_PLUS_SECTION_IDS = [...LAB_DATA_SECTION_IDS]

const DEFAULT_DASHBOARD_PLUS_LAYOUT: DashboardPlusLayout = {
  order: [...DASHBOARD_PLUS_SECTION_IDS],
  hidden: [],
}

const DEFAULT_SETTINGS: AppSettings = {
  name: '',
  theme: 'system',
  accent: 'ice',
  focusMinutes: 25,
  proteinGoal: 150,
  calorieGoal: 3500,
  fatGoal: 70,
  carbsGoal: 250,
  fiberGoal: 30,
  heightCm: 0,
  weightGoalKg: 0,
  weightStartKg: 0,
  activeHabits: DEFAULT_ACTIVE_HABITS,
  habitSchedules: {},
  dashboardPlusLayout: DEFAULT_DASHBOARD_PLUS_LAYOUT,
  medisRemindersEnabled: false,
  morningGateEnabled: true,
  morningRitual: normalizeMorningRitualConfig(undefined),
  eveningGate: normalizeEveningGateConfig(undefined),
  adaptive: defaultAdaptiveLifeConfig(),
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
  { id: 'progress', label: 'Lab', icon: FlaskConical },
]

const STREAK_HABIT_KEYS: HabitKey[] = [
  'coldShower', 'proteinShake', 'pushupsDone', 'squatsDone', 'wallsitDone', 'plankDone',
  'gratitudeDone', 'focusDone', 'winnerModeDone', 'journalDone', 'familyTimeDone', 'breathingDone',
]

function storageStatusLabel(syncStatus: string, isOnline: boolean, deviceSync = false): string {
  if (syncStatus === 'error') return deviceSync ? 'Sync fehlgeschlagen' : 'Speichern fehlgeschlagen'
  if (!isOnline || syncStatus === 'offline') return 'Offline · lokal'
  if (syncStatus === 'syncing') return deviceSync ? 'Synchronisiert …' : 'Speichert lokal …'
  if (syncStatus === 'synced') return deviceSync ? 'Geräte synchron' : 'Lokal gespeichert'
  return deviceSync ? 'Geräte-Sync an' : 'Lokal gespeichert'
}

const MOODS = ['Sehr schlecht', 'Schlecht', 'Okay', 'Gut', 'Sehr gut']
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

    const accent: AccentPreference = ACCENT_IDS.includes(stored.accent as AccentPreference)
      ? stored.accent as AccentPreference
      : DEFAULT_SETTINGS.accent

    return {
      name: typeof stored.name === 'string' ? stored.name.slice(0, 40) : DEFAULT_SETTINGS.name,
      theme,
      accent,
      focusMinutes: clampNumber(Number(stored.focusMinutes) || DEFAULT_SETTINGS.focusMinutes, 5, 120),
      proteinGoal: clampNumber(Number(stored.proteinGoal) || DEFAULT_SETTINGS.proteinGoal, 50, 400),
      calorieGoal: clampNumber(Number(stored.calorieGoal) || DEFAULT_SETTINGS.calorieGoal, 1000, 8000),
      fatGoal: clampNumber(Number(stored.fatGoal) || DEFAULT_SETTINGS.fatGoal, 20, 200),
      carbsGoal: clampNumber(Number(stored.carbsGoal) || DEFAULT_SETTINGS.carbsGoal, 50, 500),
      fiberGoal: clampNumber(Number(stored.fiberGoal) || DEFAULT_SETTINGS.fiberGoal, 10, 80),
      heightCm: clampNumber(Number(stored.heightCm) || 0, 0, 250),
      weightGoalKg: clampNumber(Number(stored.weightGoalKg) || 0, 0, 300),
      weightStartKg: clampNumber(Number(stored.weightStartKg) || 0, 0, 300),
      activeHabits: Array.isArray(stored.activeHabits) ? stored.activeHabits : DEFAULT_ACTIVE_HABITS,
      habitSchedules: normalizeHabitSchedules(stored.habitSchedules),
      dashboardPlusLayout: normalizeDashboardPlusLayout(stored.dashboardPlusLayout),
      medisRemindersEnabled: Boolean(stored.medisRemindersEnabled),
      morningGateEnabled: stored.morningGateEnabled !== false,
      morningRitual: normalizeMorningRitualConfig(
        (stored as Partial<AppSettings> & { morningRitual?: Partial<MorningRitualConfig> }).morningRitual,
      ),
      eveningGate: normalizeEveningGateConfig(
        (stored as Partial<AppSettings> & { eveningGate?: Partial<EveningGateConfig> }).eveningGate,
      ),
      adaptive: readAdaptiveFromSettings(stored),
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
  | { kind: 'protein'; value: number }
  | { kind: 'fat'; value: number }
  | { kind: 'carbs'; value: number }
  | { kind: 'fiber'; value: number }
  | { kind: 'water'; value: number }
  | { kind: 'steps'; value: number }
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

  const protein = text.match(/(\d+(?:[.,]\d+)?)\s*(?:g\s*)?(?:protein|eiwei[sß])\b/i)
    ?? text.match(/(\d+(?:[.,]\d+)?)\s*g\s*p\b/i)
  if (protein) return { kind: 'protein', value: toNumber(protein[1]) }

  const fat = text.match(/(\d+(?:[.,]\d+)?)\s*(?:g\s*)?(?:fett|fat)\b/i)
  if (fat) return { kind: 'fat', value: toNumber(fat[1]) }

  const carbs = text.match(/(\d+(?:[.,]\d+)?)\s*(?:g\s*)?(?:kh|kohlenhydrate|carbs?)\b/i)
  if (carbs) return { kind: 'carbs', value: toNumber(carbs[1]) }

  const fiber = text.match(/(\d+(?:[.,]\d+)?)\s*(?:g\s*)?(?:ballaststoffe?|fiber)\b/i)
  if (fiber) return { kind: 'fiber', value: toNumber(fiber[1]) }

  const water = text.match(/(\d+(?:[.,]\d+)?)\s*(?:l|liter)\b/i)
  if (water) return { kind: 'water', value: toNumber(water[1]) }

  const steps = text.match(/(\d+(?:[.,]\d+)?)\s*(?:schritte|steps)\b/i)
  if (steps) return { kind: 'steps', value: Math.round(toNumber(steps[1])) }

  return { kind: 'task', title: text }
}

function describeQuickAdd(parsed: QuickAddResult): string {
  switch (parsed.kind) {
    case 'weight':
      return `→ Gewicht: ${parsed.value} kg`
    case 'calories':
      return `→ Kalorien: ${parsed.value} kcal`
    case 'protein':
      return `→ Protein: ${parsed.value} g`
    case 'fat':
      return `→ Fett: ${parsed.value} g`
    case 'carbs':
      return `→ Kohlenhydrate: ${parsed.value} g`
    case 'fiber':
      return `→ Ballaststoffe: ${parsed.value} g`
    case 'water':
      return `→ Wasser: ${parsed.value} L`
    case 'steps':
      return `→ Schritte: ${parsed.value}`
    case 'task':
      return `→ Neue Aufgabe: „${parsed.title}“`
    default: {
      const _exhaustive: never = parsed
      return _exhaustive
    }
  }
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

const TASK_FOCUS_DURATIONS = [10, 15, 25, 45, 60] as const

function normalizeAnchorMinutes(
  minutes: unknown,
  length: number,
  fallback: number,
): number[] {
  const raw = Array.isArray(minutes) ? minutes : []
  const safeFallback = clampNumber(Number(fallback) || 25, 5, 120)
  return Array.from({ length }, (_, index) => {
    const value = Number(raw[index])
    return Number.isFinite(value) && value >= 5 ? clampNumber(value, 5, 120) : safeFallback
  })
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
        background: `conic-gradient(var(--accent-strong) ${safeValue * 3.6}deg, var(--track) 0deg)`,
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
  const { entries, syncStatus, isOnline, saveEntry, reloadAll, syncNow } = useEntries()
  const [view, setView] = useState<View>(() => viewFromHash())
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()))
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [dashboardPlus, setDashboardPlus] = useState<DashboardPlusState>(loadDashboardPlusState)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [taskEditor, setTaskEditor] = useState<{ index: number | null; value: string; minutes: number } | null>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [deviceSyncCreds, setDeviceSyncCreds] = useState<DeviceSyncCredentials | null>(() => loadSyncCredentials())
  const actionBridgeRef = useRef<{
    applyAction: (action: AppAction) => void
  } | null>(null)
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => getLastBackupAt())
  const [splashPhase, setSplashPhase] = useState<'visible' | 'leaving' | 'done'>(() => {
    try {
      return localStorage.getItem(SPLASH_KEY) === dateKey(new Date()) ? 'done' : 'visible'
    } catch {
      return 'visible'
    }
  })
  const [gatePreview, setGatePreview] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [gateBypass, setGateBypass] = useState(() => shouldBypassMorningGate(peekAppAction()))
  const [gateSkipped, setGateSkipped] = useState(() => loadMorningGateSkip(dateKey(new Date())))
  const [ritualProgress, setRitualProgress] = useState<MorningRitualProgress>(() => loadMorningRitualProgress(dateKey(new Date())))
  const [dailyEvents, setDailyEvents] = useState<DailyEvent[]>(() => loadDailyEvents())
  const lifeOs = useLifeOs()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [capturePreset, setCapturePreset] = useState('')
  const [captureClassifyAs, setCaptureClassifyAs] = useState<CaptureTargetType | undefined>(undefined)
  const [captureMode, setCaptureMode] = useState<'default' | 'shopping' | 'stock' | 'med-log' | 'goal' | 'finance' | 'list'>('default')
  const [labDataSection, setLabDataSection] = useState<LabDataSection>(() => labDataSectionFromHash())
  const [joChangeSession, setJoChangeSession] = useState<JoChangeSession>(null)
  const [joChangePhase, setJoChangePhase] = useState<'preview' | 'applied' | 'code' | 'error'>('preview')
  const [lastAppliedHistoryId, setLastAppliedHistoryId] = useState<string | null>(null)
  const [adaptiveDevMode] = useState(() => {
    try {
      return localStorage.getItem('life-os-adaptive-dev') === '1'
        || new URLSearchParams(window.location.search).get('adaptiveDev') === '1'
    } catch {
      return false
    }
  })
  const [routineSelectorOpen, setRoutineSelectorOpen] = useState(false)
  const [eveningGateOpen, setEveningGateOpen] = useState(false)
  const [privateNotesOpen, setPrivateNotesOpen] = useState(false)
  const [privateNotePreset, setPrivateNotePreset] = useState('')
  const privateNoteSavedRef = useRef<(() => void) | null>(null)
  const lastCaptureBatchRef = useRef<DecisionBatch | null>(null)
  const [lifeOsEntityId, setLifeOsEntityId] = useState<string | undefined>(() => entityIdFromHash())
  const [reviewType, setReviewType] = useState<ReviewType>('weekly')
  const [reviewDraft, setReviewDraft] = useState<Review | null>(null)

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
  const anchorMinutes = normalizeAnchorMinutes(entry.anchorMinutes, anchors.length, settings.focusMinutes)
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

  const morningGateMeds = useMemo(
    () => dashboardPlus.medications.map(item => ({
      id: item.id,
      name: item.name,
      dosage: item.dosage,
      time: item.time,
      taken: isMedicationTakenToday(item, today),
    })),
    [dashboardPlus.medications, today],
  )

  const ritualSteps = useMemo(
    () => ritualSequence(settings.morningRitual),
    [settings.morningRitual],
  )
  const ritualNext = useMemo(
    () => nextMorningRitualStep({
      enabled: settings.morningGateEnabled,
      skipped: gateSkipped,
      preview: false,
      progress: ritualProgress,
      medications: morningGateMeds,
      proteinShake: Boolean(entry.proteinShake),
      gratitudeDone: Boolean(entry.gratitudeDone),
      energySet: Boolean(entry.energyLevel),
      headRecoveryDone: isHeadRecoveryDone(entry),
      weightSet: typeof entry.weightKg === 'number' && entry.weightKg > 0,
      pushupsDone: Boolean(entry.pushupsDone),
      coldShowerDone: Boolean(entry.coldShower),
      winnerModeDone: Boolean(entry.winnerModeDone),
      config: settings.morningRitual,
    }),
    [
      settings.morningGateEnabled,
      settings.morningRitual,
      gateSkipped,
      ritualProgress,
      morningGateMeds,
      entry.proteinShake,
      entry.gratitudeDone,
      entry.energyLevel,
      entry.weightKg,
      entry.mood,
      entry.sleepQuality,
      entry.sleepDuration,
      entry.bedTime,
      entry.wakeTime,
      entry.pushupsDone,
      entry.coldShower,
      entry.winnerModeDone,
    ],
  )

  const ritualStep = gatePreview
    ? ritualSteps[Math.min(previewIndex, Math.max(0, ritualSteps.length - 1))]
    : ritualNext
  const ritualPhase = ritualStep ? morningRitualPhase(ritualStep) : null
  const showMorningGate = splashPhase === 'done'
    && !gateBypass
    && Boolean(ritualStep)
    && (gatePreview || (ritualStep ? FULLSCREEN_STEP_IDS.includes(ritualStep) : false))
  const ritualHeuteLock = !gatePreview && !gateBypass && splashPhase === 'done' && (ritualPhase === 'heute')
    ? ritualStep
    : null

  const streakByKey = useMemo(() => {
    const map: Record<string, number> = {}
    for (const key of STREAK_HABIT_KEYS) {
      map[key] = calculateStreakForHabit(entries, key, today)
    }
    return map
  }, [entries, today])

  const laborOpenBoards = useMemo(
    () => dashboardPlus.boards.filter(board => board.tasks.some(task => !task.done)).length,
    [dashboardPlus.boards],
  )

  const laborLive = useMemo(
    () => deriveLaborOverview({
      entries,
      today,
      activeHabits: filterHabitsForDate(settings.activeHabits, today, settings.habitSchedules),
      openBoardCount: laborOpenBoards,
      goals: scoreGoals,
      syncLabel: storageStatusLabel(syncStatus, isOnline, Boolean(deviceSyncCreds)),
      syncTime: '',
    }),
    [entries, today, settings.activeHabits, settings.habitSchedules, laborOpenBoards, scoreGoals, syncStatus, isOnline, deviceSyncCreds],
  )

  const laborStats = useMemo(
    () => deriveLaborStats({ entries, today, goals: scoreGoals }),
    [entries, today, scoreGoals],
  )

  useEffect(() => {
    const consumeAction = () => {
      const action = takeAppActionFromLocation()
      if (!action) return
      if (shouldBypassMorningGate(action)) setGateBypass(true)
      window.setTimeout(() => actionBridgeRef.current?.applyAction(action), 0)
    }

    const onHash = () => {
      setView(viewFromHash())
      setLifeOsEntityId(entityIdFromHash())
      setLabDataSection(labDataSectionFromHash())
      consumeAction()
    }

    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) navigateHash(view, true)
    else consumeAction()
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onChange = () => {
      window.setTimeout(() => { void pushDeviceSync().catch(() => {}) }, 600)
    }
    window.addEventListener(LIFE_OS_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(LIFE_OS_CHANGE_EVENT, onChange)
  }, [])

  useEffect(() => {
    if (hashPathOnly(window.location.hash) !== hashFromView(view)) navigateHash(view, true)
  }, [view])

  const settingsHydrated = useRef(false)
  const laborHydrated = useRef(false)
  const ritualProgressHydrated = useRef(false)
  const lastRemoteGenSettings = useRef(0)
  const lastRemoteGenLabor = useRef(0)
  const lastRemoteGenRitual = useRef(0)

  useEffect(() => {
    safeLocalStorageSetItem(SETTINGS_KEY, JSON.stringify(settings))
    if (!settingsHydrated.current) {
      settingsHydrated.current = true
      return
    }
    const gen = remoteApplyGenerationNow()
    if (gen !== lastRemoteGenSettings.current) {
      lastRemoteGenSettings.current = gen
      return
    }
    if (isDeviceSyncEnabled()) {
      window.setTimeout(() => {
        void pushDeviceSync().catch(() => {})
      }, 500)
    }
  }, [settings])

  useEffect(() => {
    safeLocalStorageSetItem(DASHBOARD_PLUS_KEY, JSON.stringify(dashboardPlus))
    if (!laborHydrated.current) {
      laborHydrated.current = true
      return
    }
    const gen = remoteApplyGenerationNow()
    if (gen !== lastRemoteGenLabor.current) {
      lastRemoteGenLabor.current = gen
      return
    }
    if (isDeviceSyncEnabled()) {
      window.setTimeout(() => {
        void pushDeviceSync().catch(() => {})
      }, 500)
    }
  }, [dashboardPlus])

  useEffect(() => {
    saveMorningRitualProgress(ritualProgress)
    if (!ritualProgressHydrated.current) {
      ritualProgressHydrated.current = true
      return
    }
    const gen = remoteApplyGenerationNow()
    if (gen !== lastRemoteGenRitual.current) {
      lastRemoteGenRitual.current = gen
      return
    }
    if (isDeviceSyncEnabled()) {
      window.setTimeout(() => {
        void pushDeviceSync().catch(() => {})
      }, 500)
    }
  }, [ritualProgress])

  useEffect(() => {
    const reloadExtras = () => {
      setSettings(loadSettings())
      setDashboardPlus(loadDashboardPlusState())
      setDeviceSyncCreds(loadSyncCredentials())
      setRitualProgress(loadMorningRitualProgress(today))
      setDailyEvents(loadDailyEvents())
    }
    const reloadEvents = () => setDailyEvents(loadDailyEvents())
    window.addEventListener(LIFE_OS_SYNC_EXTRAS_EVENT, reloadExtras)
    window.addEventListener(LIFE_OS_DAILY_EVENTS_EVENT, reloadEvents)
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === SETTINGS_KEY
        || event.key === DASHBOARD_PLUS_KEY
        || event.key === MORNING_RITUAL_PROGRESS_KEY
        || event.key === DAILY_EVENTS_KEY
        || event.key === null
      ) {
        reloadExtras()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(LIFE_OS_SYNC_EXTRAS_EVENT, reloadExtras)
      window.removeEventListener(LIFE_OS_DAILY_EVENTS_EVENT, reloadEvents)
      window.removeEventListener('storage', onStorage)
    }
  }, [today])

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
    document.documentElement.dataset.accent = settings.accent
  }, [settings.accent])

  useEffect(() => {
    if (splashPhase === 'visible') {
      const timer = window.setTimeout(() => setSplashPhase('leaving'), 2100)
      return () => window.clearTimeout(timer)
    }
    if (splashPhase === 'leaving') {
      const timer = window.setTimeout(() => {
        setSplashPhase('done')
        safeLocalStorageSetItem(SPLASH_KEY, today)
      }, 550)
      return () => window.clearTimeout(timer)
    }
  }, [splashPhase, today])

  const dismissSplash = () => {
    if (splashPhase === 'visible') setSplashPhase('leaving')
  }

  useEffect(() => {
    setGateSkipped(loadMorningGateSkip(today))
    setRitualProgress(loadMorningRitualProgress(today))
  }, [today])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), toast.actionLabel ? 6000 : 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const showToast = (message: string, actionLabel?: string, onAction?: () => void) => {
    setToast({ message, actionLabel, onAction })
  }

  useEffect(() => {
    if (!settings.medisRemindersEnabled) return

    const tick = () => {
      const due = dueMedicationReminders(dashboardPlus.medications, today)
        .filter(item => {
          try {
            return !localStorage.getItem(reminderStorageKey(item.id, today))
          } catch {
            return true
          }
        })
      if (due.length === 0) return

      for (const item of due) {
        try {
          localStorage.setItem(reminderStorageKey(item.id, today), '1')
        } catch { /* ignore */ }
      }

      const label = due.length === 1
        ? `Medikament: ${due[0].name} (${due[0].time})`
        : `Medikamente: ${due.map(item => item.name).join(', ')}`
      setToast({ message: label })

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(due.length === 1 ? 'Medikament' : 'Medikamente', { body: label })
        } catch { /* ignore */ }
      }
    }

    tick()
    const timer = window.setInterval(tick, 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [settings.medisRemindersEnabled, dashboardPlus.medications, today])

  const updateEntry = (
    patch: Partial<DashboardEntry>,
    source: DailyEventSource = 'ui',
    options?: { undoOf?: string; offerUndo?: boolean; toastMessage?: string },
  ) => {
    const nextPatch = 'proteinShake' in patch
      ? {
          ...patch,
          ...syncProteinShakeNutrition(
            entry,
            Boolean(patch.proteinShake),
            settings.morningRitual.shakeMeal,
            settings.proteinGoal,
          ),
        }
      : patch
    const before = loadXP()
    const previous = capturePreviousValues(
      entry as unknown as Record<string, unknown>,
      nextPatch as Record<string, unknown>,
    )
    void saveEntry({ ...entry, ...nextPatch }).then(ok => {
      if (!ok) {
        showToast('Speichern fehlgeschlagen — Speicher voll oder blockiert.')
        return
      }
      const event = createEntryPatchEvent({
        date: entry.date,
        changes: nextPatch as Record<string, unknown>,
        previous,
        source,
        undoOf: options?.undoOf,
      })
      appendDailyEvent(event)
      const after = loadXP()
      const gained = after.totalXP - before.totalXP
      if (options?.undoOf) {
        showToast('Änderung rückgängig gemacht.')
        return
      }
      if (after.level > before.level) {
        showToast(`Level ${after.level} · +${gained} XP`)
        return
      }
      if (gained > 0) {
        showToast(`+${gained} XP`)
        return
      }
      if (options?.offerUndo && event && Object.keys(previous).length > 0) {
        showToast(options.toastMessage ?? 'Gespeichert.', 'Rückgängig', () => {
          undoDailyEvent(event)
        })
        return
      }
      if (options?.toastMessage) showToast(options.toastMessage)
    })
  }

  useEffect(() => {
    if (!entry.proteinShake || entryHasMeal(entry, SHAKE_MEAL_ID)) return
    updateEntry({ proteinShake: true }, 'morning_gate')
  }, [entry.date, entry.proteinShake, entry.appliedMeals])

  const saveEntryForDate = async (
    date: string,
    patch: Partial<DashboardEntry>,
    source: DailyEventSource = 'ui',
    options?: { undoOf?: string },
  ) => {
    const base = entries.find(item => item.date === date) ?? createDefaultEntry(date)
    const previous = capturePreviousValues(
      base as unknown as Record<string, unknown>,
      patch as Record<string, unknown>,
    )
    const ok = await saveEntry({ ...base, ...patch })
    if (!ok) {
      showToast('Speichern fehlgeschlagen — Speicher voll oder blockiert.')
    } else {
      appendDailyEvent(createEntryPatchEvent({
        date,
        changes: patch as Record<string, unknown>,
        previous,
        source,
        undoOf: options?.undoOf,
      }))
    }
    return ok
  }

  const undoDailyEvent = (event: EntryPatchEvent) => {
    if (!canUndoEntryPatch(event, loadDailyEvents())) {
      showToast('Bereits rückgängig oder nicht mehr möglich.')
      return
    }
    const patch = buildUndoPatch(event)
    if (!patch) {
      showToast('Diese Änderung lässt sich nicht rückgängig machen.')
      return
    }
    if (event.date === entry.date) {
      updateEntry(patch as Partial<DashboardEntry>, 'ui', { undoOf: event.id })
      return
    }
    void saveEntryForDate(event.date, patch as Partial<DashboardEntry>, 'ui', { undoOf: event.id }).then(ok => {
      if (ok) showToast('Änderung rückgängig gemacht.')
    })
  }

  const undoRitualEvent = (event: DailyEvent) => {
    if (!canUndoRitualStep(event, loadDailyEvents())) {
      showToast('Bereits rückgängig oder nicht mehr möglich.')
      return
    }
    appendDailyEvent(createRitualStepEvent({
      date: event.date,
      stepId: event.stepId,
      status: 'reopened',
    }))
    if (event.date === today) {
      setRitualProgress(current => {
        const next = {
          ...current,
          done: current.done.filter(step => step !== event.stepId),
        }
        saveMorningRitualProgress(next)
        return next
      })
    }
    showToast('Ritualschritt wieder geöffnet.')
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
      const replaceAll = window.confirm(
        `${imported.entryCount} Tage gefunden (${imported.mode === 'bundle' ? 'Vollbackup' : 'nur Einträge'}).\n\nOK = alles ersetzen\nAbbrechen = nach Datum mergen`,
      )

      // Score with imported goals when present — don't write settings until user confirmed.
      const importedSettings = imported.settings as Partial<AppSettings> | undefined
      const goalsForScore = imported.mode === 'bundle' && importedSettings
        ? {
            proteinGoal: clampNumber(Number(importedSettings.proteinGoal) || scoreGoals.proteinGoal, 50, 400),
            activeHabits: Array.isArray(importedSettings.activeHabits)
              ? importedSettings.activeHabits.map(String)
              : scoreGoals.activeHabits,
          }
        : scoreGoals

      const normalized = imported.entries.map(item => ({
        ...item,
        dailyScore: calculateScore(item, goalsForScore),
      }))
      const finalEntries = replaceAll ? normalized : mergeEntriesByDate(entries, normalized)

      if (!saveAllEntries(finalEntries)) throw new Error('localStorage unavailable')
      if (imported.mode === 'bundle') {
        applyBackupExtras(imported)
        if (imported.settings) setSettings(loadSettings())
        if (imported.dashboardPlus) setDashboardPlus(loadDashboardPlusState())
      }
      recomputeXPFromEntries(finalEntries, today)
      setLastBackupAt(new Date().toISOString())
      await reloadAll()
      showToast(imported.mode === 'bundle' ? 'Vollbackup importiert · XP neu berechnet.' : 'Einträge importiert · XP neu berechnet.')
    } catch {
      showToast('Import fehlgeschlagen.')
    }
  }

  const setAnchors = (nextAnchors: string[], nextDone: boolean[], nextMinutes?: number[]) => {
    const normalizedDone = nextAnchors.map((_, index) => Boolean(nextDone[index]))
    const sourceMinutes = nextMinutes ?? nextAnchors.map((_, index) => anchorMinutes[index] ?? settings.focusMinutes)
    updateEntry({
      anchors: nextAnchors,
      anchorsDone: normalizedDone,
      anchorMinutes: normalizeAnchorMinutes(sourceMinutes, nextAnchors.length, settings.focusMinutes),
      tasksDone: normalizedDone.filter(Boolean).length,
    })
  }

  const toggleAnchor = (index: number) => {
    const nextDone = anchors.map((_, itemIndex) =>
      itemIndex === index ? !anchorsDone[itemIndex] : !!anchorsDone[itemIndex],
    )
    setAnchors(anchors, nextDone, anchorMinutes)
  }

  const saveTask = (value: string, index: number | null, minutes?: number) => {
    const clean = value.trim()
    if (!clean) return
    const taskMinutes = clampNumber(minutes ?? dayPolicy.focusMinutes, 5, 120)

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
      setAnchors([...anchors, clean], [...anchorsDone, false], [...anchorMinutes, taskMinutes])
      showToast('Aufgabe hinzugefügt.')
    } else {
      const next = anchors.map((item, itemIndex) => (itemIndex === index ? clean : item))
      const nextMinutes = anchorMinutes.map((item, itemIndex) => (itemIndex === index ? taskMinutes : item))
      setAnchors(next, anchors.map((_, itemIndex) => Boolean(anchorsDone[itemIndex])), nextMinutes)
      showToast('Aufgabe aktualisiert.')
    }
    setTaskEditor(null)
  }

  const quickAddTask = (title: string) => {
    saveTask(title, null)
    setQuickAddOpen(false)
  }

  const quickAddWeight = (value: number) => {
    updateEntry({ weightKg: value }, 'quick_add', {
      offerUndo: true,
      toastMessage: `Gewicht gespeichert: ${value} kg`,
    })
    setQuickAddOpen(false)
  }

  const quickAddCalories = (value: number) => {
    updateEntry({ calories: value, caloriesReached: value >= settings.calorieGoal }, 'quick_add', {
      offerUndo: true,
      toastMessage: `Kalorien gespeichert: ${value} kcal`,
    })
    setQuickAddOpen(false)
  }

  const quickAddWater = (value: number) => {
    updateEntry({ waterLiters: value }, 'quick_add', {
      offerUndo: true,
      toastMessage: `Wasser gespeichert: ${value} L`,
    })
    setQuickAddOpen(false)
  }

  const quickAddProtein = (value: number) => {
    updateEntry({ proteinGrams: value, proteinReached: value >= settings.proteinGoal }, 'quick_add', {
      offerUndo: true,
      toastMessage: `Protein gespeichert: ${value} g`,
    })
    setQuickAddOpen(false)
  }

  const quickAddFat = (value: number) => {
    updateEntry({ fatGrams: value }, 'quick_add', {
      offerUndo: true,
      toastMessage: `Fett gespeichert: ${value} g`,
    })
    setQuickAddOpen(false)
  }

  const quickAddCarbs = (value: number) => {
    updateEntry({ carbsGrams: value }, 'quick_add', {
      offerUndo: true,
      toastMessage: `Kohlenhydrate gespeichert: ${value} g`,
    })
    setQuickAddOpen(false)
  }

  const quickAddFiber = (value: number) => {
    updateEntry({ fiberGrams: value }, 'quick_add', {
      offerUndo: true,
      toastMessage: `Ballaststoffe gespeichert: ${value} g`,
    })
    setQuickAddOpen(false)
  }

  const quickAddSteps = (value: number) => {
    updateEntry({ steps: value }, 'quick_add', {
      offerUndo: true,
      toastMessage: `Schritte gespeichert: ${value}`,
    })
    setQuickAddOpen(false)
  }

  const deleteTask = (index: number) => {
    const deleted = anchors[index]
    const wasDone = Boolean(anchorsDone[index])
    const deletedMinutes = anchorMinutes[index] ?? settings.focusMinutes
    const nextAnchors = anchors.filter((_, itemIndex) => itemIndex !== index)
    const nextDone = anchorsDone.filter((_, itemIndex) => itemIndex !== index)
    const nextMinutes = anchorMinutes.filter((_, itemIndex) => itemIndex !== index)
    setAnchors(nextAnchors, nextDone, nextMinutes)
    showToast('Aufgabe entfernt.', 'Rückgängig', () => {
      const restoredAnchors = [...nextAnchors]
      const restoredDone = [...nextDone]
      const restoredMinutes = [...nextMinutes]
      restoredAnchors.splice(index, 0, deleted)
      restoredDone.splice(index, 0, wasDone)
      restoredMinutes.splice(index, 0, deletedMinutes)
      setAnchors(restoredAnchors, restoredDone, restoredMinutes)
    })
  }

  const moveTask = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= anchors.length) return
    const nextAnchors = [...anchors]
    const nextDone = anchors.map((_, itemIndex) => Boolean(anchorsDone[itemIndex]))
    const nextMinutes = [...anchorMinutes]
    ;[nextAnchors[index], nextAnchors[target]] = [nextAnchors[target], nextAnchors[index]]
    ;[nextDone[index], nextDone[target]] = [nextDone[target], nextDone[index]]
    ;[nextMinutes[index], nextMinutes[target]] = [nextMinutes[target], nextMinutes[index]]
    setAnchors(nextAnchors, nextDone, nextMinutes)
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
      setAnchors(anchors, nextDone, anchorMinutes)
      updateEntry({ focusDone: true } as Partial<DashboardEntry>, 'focus')
    } else if (focusSession.routineKey) {
      updateEntry({
        [focusSession.routineKey]: true,
      } as Partial<DashboardEntry>, 'focus')
    } else {
      updateEntry({ focusDone: true } as Partial<DashboardEntry>, 'focus')
    }
    setFocusSession(null)
    lifeOs.addActivity({
      title: focusSession.title,
      date: today,
      kind: 'focus',
      plannedDurationMin: focusSession.minutes,
      actualDurationMin: focusSession.minutes,
      source: 'timer',
    })
    showToast('Fokusblock abgeschlossen — erledigt.')
  }

  const resolvedTheme = document.documentElement.dataset.theme ?? 'light'
  const quickToggleTheme = () => {
    setSettings(current => ({
      ...current,
      theme: resolvedTheme === 'dark' ? 'light' : 'dark',
    }))
  }

  const currentViewLabel = VIEW_LABELS[view] ?? NAV_ITEMS.find(item => item.id === view)?.label ?? 'Heute'
  const navigateTo = (nextView: View, entityId?: string) => {
    setView(nextView)
    setLifeOsEntityId(entityId)
    if (entityId) navigateHashWithId(nextView, entityId)
    else navigateHash(nextView)
    if (nextView === 'today' || nextView === 'dashboardPlus') setSelectedDate(today)
    if (nextView === 'checkin' && selectedDate > today) setSelectedDate(today)
  }

  const openUniversalCapture = (options?: {
    raw?: string
    classifyAs?: CaptureTargetType
    mode?: typeof captureMode
  }) => {
    // Morning/Evening overlays sit above the inert app chrome — always allow Jo AI out.
    if (showMorningGate) setGateBypass(true)
    if (eveningGateOpen) setEveningGateOpen(false)
    setCapturePreset(options?.raw ?? '')
    setCaptureClassifyAs(options?.classifyAs)
    setCaptureMode(options?.mode ?? 'default')
    setCaptureOpen(true)
  }

  const handleLabQuickAction = (action: LabDataQuickAction) => {
    switch (action) {
      case 'capture-task':
        openUniversalCapture({ classifyAs: 'task', mode: 'default', raw: '' })
        return
      case 'capture-shopping':
        openUniversalCapture({ mode: 'shopping' })
        return
      case 'capture-stock':
        openUniversalCapture({ mode: 'stock', classifyAs: 'note' })
        return
      case 'capture-med-log':
        openUniversalCapture({ mode: 'med-log', classifyAs: 'note', raw: 'Eingenommen: ' })
        return
      case 'capture-goal':
        openUniversalCapture({ mode: 'goal', classifyAs: 'goal' })
        return
      case 'capture-finance':
        openUniversalCapture({ mode: 'finance', classifyAs: 'note' })
        return
      case 'capture-list':
        openUniversalCapture({ mode: 'list', classifyAs: 'note' })
        return
      default: {
        const _exhaustive: never = action
        return _exhaustive
      }
    }
  }

  const captureDecisionContext = () => ({
    routineMeals: [{
      ...settings.morningRitual.shakeMeal,
      id: settings.morningRitual.shakeMeal.id || SHAKE_MEAL_ID,
      aliases: defaultRoutineMeals()[0]?.aliases,
    }],
    projects: dashboardPlus.boards.map(board => ({ id: board.id, label: board.label })),
  })

  const commitLifeOsCapture = async (input: {
    raw: string
    url?: string
    fileName?: string
    fileKind?: 'file' | 'screenshot'
    fileDataUrl?: string
    fileObjectId?: string
    fileStorageKey?: string
    fileContentType?: string
    fileSize?: number
    classifyAs?: CaptureTargetType
    lifeArea?: LifeAreaKey
    source?: string
    audioRef?: string
    transcriptId?: string
    decisionPreview?: ReturnType<typeof previewFromBatch>
    applyConfirmedDecisions?: boolean
    captureMode?: 'default' | 'shopping' | 'stock' | 'med-log' | 'goal' | 'finance' | 'list'
  }, openInbox = true) => {
    const mode = input.captureMode ?? 'default'
    if (mode === 'shopping') {
      const title = input.raw.trim()
      if (!title) return
      const itemId = crypto.randomUUID()
      setDashboardPlus(current => ({
        ...current,
        shopping: {
          ...current.shopping,
          items: [
            ...current.shopping.items,
            {
              id: itemId,
              icon: 'bag',
              name: title,
              note: '',
              price: 0,
              done: false,
            },
          ],
        },
      }))
      setCapturePreset('')
      setCaptureMode('default')
      setCaptureClassifyAs(undefined)
      navigateLabDataSection('shopping')
      setView('dashboardPlus')
      showToast('Artikel hinzugefügt', 'Rückgängig', () => {
        setDashboardPlus(current => ({
          ...current,
          shopping: {
            ...current.shopping,
            items: current.shopping.items.filter(item => item.id !== itemId),
          },
        }))
      })
      return
    }
    if (mode === 'list') {
      const title = input.raw.trim() || 'Neue Liste'
      setDashboardPlus(current => ({
        ...current,
        lists: [
          ...current.lists,
          {
            id: crypto.randomUUID(),
            title,
            kind: 'custom' as const,
            items: [],
          },
        ],
      }))
      setCapturePreset('')
      setCaptureMode('default')
      setCaptureClassifyAs(undefined)
      navigateLabDataSection('lists')
      setView('dashboardPlus')
      showToast('Liste angelegt')
      return
    }
    if (mode === 'stock') {
      const name = input.raw.trim() || 'Neues Produkt'
      setDashboardPlus(current => ({
        ...current,
        supplements: [
          ...current.supplements,
          { id: crypto.randomUUID(), name, brand: '', stock: 0, unit: 'g', dailyUse: 0, dailyUnit: 'g' },
        ],
      }))
      setCapturePreset('')
      setCaptureMode('default')
      setCaptureClassifyAs(undefined)
      navigateLabDataSection('stock')
      setView('dashboardPlus')
      showToast('Bestand erfasst')
      return
    }
    if (mode === 'goal') {
      const title = input.raw.trim() || 'Neues Ziel'
      setDashboardPlus(current => ({
        ...current,
        goals: [
          ...current.goals,
          {
            id: crypto.randomUUID(),
            title,
            timeframe: 'Monat',
            percent: 0,
            dueDate: today,
            color: 'var(--accent)',
            lifeArea: input.lifeArea,
          },
        ],
      }))
      setCapturePreset('')
      setCaptureMode('default')
      setCaptureClassifyAs(undefined)
      navigateLabDataSection('goals')
      setView('dashboardPlus')
      showToast('Ziel angelegt')
      return
    }
    if (mode === 'finance') {
      const name = input.raw.trim() || 'Neuer Eintrag'
      setDashboardPlus(current => ({
        ...current,
        finances: {
          ...current.finances,
          openBills: [
            ...current.finances.openBills,
            { ...createBillDraft('open', today, current.finances.openBills.length), name },
          ],
        },
      }))
      setCapturePreset('')
      setCaptureMode('default')
      setCaptureClassifyAs(undefined)
      navigateLabDataSection('finance')
      setView('dashboardPlus')
      showToast('Finanzeintrag erfasst')
      return
    }
    if (mode === 'med-log') {
      input = { ...input, classifyAs: 'note', captureMode: 'default' }
    }

    const capture = createCapture(input)
    const classified = input.classifyAs && input.classifyAs !== 'inbox'
      ? { ...capture, targetType: input.classifyAs, status: 'classified' as const }
      : capture
    let nextCapture = classified
    let appliedFromConfirm = false
    try {
      const flags = resolveDecisionFlags()
      const confirmedIds = new Set((input.decisionPreview?.items ?? []).map(item => item.actionId))
      const sourceBatch = lastCaptureBatchRef.current
      const confirmedBatch = input.applyConfirmedDecisions && sourceBatch && confirmedIds.size > 0
        ? {
          ...sourceBatch,
          proposedActions: sourceBatch.proposedActions.filter(action => confirmedIds.has(action.actionId)),
          decisions: sourceBatch.decisions.filter((_decision, index) => {
            const action = sourceBatch.proposedActions[index]
            return action ? confirmedIds.has(action.actionId) : false
          }),
        }
        : null

      const batch = confirmedBatch || input.decisionPreview
        ? null
        : await decideCaptureInput({
          id: classified.id,
          source: input.source === 'voice' ? 'voice' : 'quick_add',
          content: classified.raw,
          timestamp: classified.createdAt,
          context: { currentModule: 'capture' },
        }, {
          flags,
          context: captureDecisionContext(),
        })
      if (batch) lastCaptureBatchRef.current = batch
      nextCapture = {
        ...classified,
        source: input.source ?? 'quick_add',
        audioRef: input.audioRef,
        transcriptId: input.transcriptId,
        decisionPreview: input.decisionPreview ?? (batch ? previewFromBatch(batch) : undefined),
      }
      if (batch) recordDecisionAudits(batch.audits)

      const applyBatch = confirmedBatch ?? (batch && flags.autoActionsEnabled ? batch : null)
      if (applyBatch) {
        const applied = applyDecisionBatch({
          batch: applyBatch,
          lifeOs: lifeOs.state,
          dashboard: {
            focusTodos: dashboardPlus.focusTodos,
            boards: dashboardPlus.boards,
            goals: dashboardPlus.goals,
          },
          entry,
          routineMeals: captureDecisionContext().routineMeals,
          autoActionsEnabled: flags.autoActionsEnabled || Boolean(confirmedBatch),
          confirmedByUser: Boolean(confirmedBatch),
          today,
        })
        if (applied.applied.length > 0) {
          appliedFromConfirm = Boolean(confirmedBatch)
          lifeOs.commit(() => applied.lifeOs)
          setDashboardPlus(current => ({
            ...current,
            focusTodos: applied.dashboard.focusTodos,
            boards: applied.dashboard.boards,
            goals: applied.dashboard.goals,
            shopping: applied.shoppingAdds.length > 0
              ? {
                ...current.shopping,
                items: [
                  ...current.shopping.items,
                  ...applied.shoppingAdds,
                ],
              }
              : current.shopping,
          }))
          if (applied.entry) updateEntry(applied.entry, 'quick_add')
          rememberExecutedKeys(applied.executedKeys)
        }
      }
      if (confirmedBatch) lastCaptureBatchRef.current = null
    } catch {
      nextCapture = classified
    }
    if (!appliedFromConfirm) {
      lifeOs.commit(current => ({
        ...current,
        captures: [nextCapture, ...current.captures],
        events: [...current.events, emitDomainEvent('capture.created', { title: nextCapture.title }, { kind: 'capture', id: nextCapture.id })],
      }))
    }
    if (openInbox) {
      const captureId = nextCapture.id
      navigateTo(appliedFromConfirm ? 'today' : 'inbox', appliedFromConfirm ? undefined : captureId)
      if (appliedFromConfirm) {
        showToast('Gespeichert')
      } else {
        showToast('Gespeichert', 'Rückgängig', () => {
          lifeOs.commit(current => ({
            ...current,
            captures: current.captures.filter(item => item.id !== captureId),
          }))
          showToast('Capture entfernt')
        })
      }
    } else {
      showToast('Als Universal Memo gespeichert.')
    }
  }

  const handleLifeOsCapture = (input: Parameters<typeof commitLifeOsCapture>[0]) => (
    commitLifeOsCapture(input)
  )

  const openPrivateNotes = (text = '', onSaved?: () => void) => {
    setPrivateNotePreset(text)
    privateNoteSavedRef.current = onSaved ?? null
    setPrivateNotesOpen(true)
  }

  const handleConvertCapture = (id: string) => {
    const result = lifeOs.convert(id)
    if (!result) {
      showToast('Umwandeln braucht zuerst einen Typ.')
      return
    }
    if (result.task || result.goal) {
      setDashboardPlus(current => {
        const next = applyConvertToDashboard(current, result, today)
        return { ...current, ...next }
      })
    }
    if (result.decision) navigateTo('decisions', result.decision.id)
    else if (result.knowledge) navigateTo('knowledge', result.knowledge.id)
    else if (result.goal) navigateTo('goal', result.goal.id)
    else if (result.task?.projectId) navigateTo('project', result.task.projectId)
    showToast('Capture umgewandelt')
  }

  const startReview = (type: ReviewType = reviewType) => {
    const period = periodForReviewType(type, today)
    const completedTasks = dashboardPlus.boards.reduce((sum, board) => sum + board.tasks.filter(task => task.done).length, 0)
      + dashboardPlus.focusTodos.filter(task => task.done).length
    const openTasks = dashboardPlus.boards.reduce((sum, board) => sum + board.tasks.filter(task => !task.done).length, 0)
      + dashboardPlus.focusTodos.filter(task => !task.done).length
    const draft = createReviewDraft(type, {
      today,
      periodStart: period.start,
      periodEnd: period.end,
      completedTasks,
      openTasks,
      projects: dashboardPlus.boards,
      goals: dashboardPlus.goals,
      captures: lifeOs.state.captures,
      knowledge: lifeOs.state.knowledge,
      decisions: lifeOs.state.decisions,
      signals: lifeOs.state.signals,
      activities: lifeOs.state.activities,
      focusMinutes: lifeOs.state.activities
        .filter(item => item.kind === 'focus' && item.date >= period.start && item.date <= period.end)
        .reduce((sum, item) => sum + (item.actualDurationMin ?? 0), 0),
    })
    setReviewDraft(draft)
    setReviewType(type)
  }

  const refreshInsights = (): Insight[] => {
    const computed = buildDeterministicInsights({
      today,
      inboxCount: lifeOs.inboxCount,
      projects: dashboardPlus.boards,
      goals: dashboardPlus.goals,
      decisions: lifeOs.state.decisions.map(item => refreshDecisionStatus(item, today)),
      activities: lifeOs.state.activities,
      signals: lifeOs.state.signals,
    })
    const story = interpretInsights(computed)
    const next = story ? [...computed, story] : computed
    lifeOs.commit(current => ({ ...current, insights: next }))
    return next
  }

  const exportTaskToCalendar = async (title: string, minutes: number) => {
    const result = await shareOrDownloadIcs({
      title,
      minutes,
      description: `Tagesanker aus Life OS · ${minutes} Min. Fokus`,
    })
    if (result === 'shared') showToast('Kalender-Share geöffnet — in Kalender sichern.')
    else if (result === 'downloaded') showToast('Kalenderdatei gespeichert (.ics).')
    else showToast('Kalender-Export abgebrochen.')
  }

  actionBridgeRef.current = {
    applyAction: (action: AppAction) => {
      switch (action.kind) {
        case 'today':
          navigateTo('today')
          showToast('Kurzbefehl: Heute')
          break
        case 'checkin':
          navigateTo('today')
          setRoutineSelectorOpen(true)
          showToast('Check-in läuft über deinen Routine Mode.')
          break
        case 'plan':
          navigateTo('plan')
          showToast('Kurzbefehl: Plan')
          break
        case 'note': {
          const text = action.text?.trim()
          navigateTo('today')
          if (text) {
            const line = formatNoteLine(text)
            const entryForNote = entries.find(item => item.date === today) ?? createDefaultEntry(today)
            void saveEntryForDate(today, {
              journalText: appendJournal(entryForNote.journalText ?? '', line),
              journalDone: true,
            })
            const nextNote = mergeQuickNote(parseQuickNote(loadQuickNote()), line)
            safeLocalStorageSetItem(QUICK_NOTE_KEY, JSON.stringify(nextNote))
            window.dispatchEvent(new CustomEvent(LIFE_OS_SYNC_EXTRAS_EVENT))
            if (isDeviceSyncEnabled()) {
              window.setTimeout(() => {
                void pushDeviceSync().catch(() => {})
              }, 400)
            }
          }
          showToast(text ? 'Notiz geparkt.' : 'Kurzbefehl: Kurznotiz')
          break
        }
        case 'add-task':
          navigateTo('dashboardPlus')
          navigateLabDataSection('todos')
          window.setTimeout(() => {
            openUniversalCapture({
              raw: action.title?.trim() ?? '',
              classifyAs: 'task',
            })
          }, 60)
          showToast(action.title?.trim() ? 'Kurzbefehl: Aufgabe erfassen' : 'Kurzbefehl: Aufgabe')
          break
        case 'log': {
          navigateTo('today')
          const patch: Partial<DashboardEntry> = {}
          const parsed = action.text ? parseQuickAdd(action.text) : null
          if (parsed?.kind === 'protein') patch.proteinGrams = parsed.value
          else if (parsed?.kind === 'calories') patch.calories = parsed.value
          else if (parsed?.kind === 'fat') patch.fatGrams = parsed.value
          else if (parsed?.kind === 'carbs') patch.carbsGrams = parsed.value
          else if (parsed?.kind === 'fiber') patch.fiberGrams = parsed.value
          else if (parsed?.kind === 'water') patch.waterLiters = parsed.value
          else if (parsed?.kind === 'steps') patch.steps = parsed.value
          else if (parsed?.kind === 'weight') patch.weightKg = parsed.value
          else if (parsed?.kind === 'task' && parsed.title) {
            openUniversalCapture({ raw: parsed.title, classifyAs: 'task' })
          }
          if (action.protein !== undefined) patch.proteinGrams = action.protein
          if (action.calories !== undefined) patch.calories = action.calories
          if (action.water !== undefined) patch.waterLiters = action.water
          if (action.steps !== undefined) patch.steps = action.steps
          if (action.weight !== undefined) patch.weightKg = action.weight
          if (action.energy) patch.energyLevel = action.energy
          if (action.habit && STREAK_HABIT_KEYS.includes(action.habit as HabitKey)) {
            patch[action.habit as HabitKey] = true
          }
          if (patch.proteinGrams !== undefined) {
            patch.proteinReached = patch.proteinGrams >= settings.proteinGoal
          }
          if (patch.calories !== undefined) {
            patch.caloriesReached = patch.calories >= settings.calorieGoal
          }
          if (Object.keys(patch).length > 0) updateEntry(patch, 'quick_add')
          showToast('Kurzbefehl: Wert gespeichert')
          break
        }
        case 'capture': {
          if (action.text?.trim()) {
            lifeOs.captureQuick(action.text.trim())
            showToast('Capture in Inbox')
          }
          navigateTo('inbox')
          if (!action.text?.trim()) openUniversalCapture()
          break
        }
        case 'focus': {
          navigateTo('today')
          const nextIndex = anchors.findIndex((_, index) => !anchorsDone[index])
          const title = action.title?.trim()
            || (nextIndex >= 0 ? anchors[nextIndex] : 'Fokusblock')
          const minutes = action.minutes
            ?? (nextIndex >= 0 ? anchorMinutes[nextIndex] : dayPolicy.focusMinutes)
          openFocus(
            title,
            nextIndex >= 0 ? nextIndex : undefined,
            undefined,
            minutes,
          )
          showToast('Kurzbefehl: Fokus')
          break
        }
        default: {
          const _exhaustive: never = action.kind
          void _exhaustive
          break
        }
      }
    },
  }

  return (
    <div className={view === 'today' ? 'life-app life-app--heute' : 'life-app'}>
      <aside className="sidebar" aria-label="Hauptnavigation" inert={showMorningGate || eveningGateOpen || privateNotesOpen || undefined}>
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
                className={(item.id === 'today' ? view === 'today' : isProgressHubView(view)) ? 'nav-item is-active' : 'nav-item'}
                onClick={() => navigateTo(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <nav className="sidebar-nav" aria-label="Inbox">
          <span className="nav-group-label">System</span>
          <button
            type="button"
            className={view === 'inbox' ? 'nav-item is-active' : 'nav-item'}
            onClick={() => navigateTo('inbox')}
          >
            <Inbox size={18} />
            <span>Inbox{lifeOs.inboxCount > 0 ? ` (${lifeOs.inboxCount})` : ''}</span>
          </button>
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

      <div className="app-stage" inert={showMorningGate || eveningGateOpen || privateNotesOpen || undefined}>
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
              <h1>{greeting()}{settings.name.trim() ? `, ${settings.name.trim()}` : ''}.</h1>
            </div>
            <div className="topbar-actions">
              <span
                className={`sync-pill sync-pill--${syncStatus}`}
                title={deviceSyncCreds ? 'Automatischer Sync zwischen gekoppelten Geräten' : 'Daten bleiben in diesem Browser'}
              >
                <Cloud size={14} />
                {storageStatusLabel(syncStatus, isOnline, Boolean(deviceSyncCreds))}
              </span>
              <IconButton label="Suchen oder erfassen" onClick={() => setPaletteOpen(true)}>
                <Search size={18} />
              </IconButton>
              <IconButton label="Einstellungen öffnen" onClick={() => setSettingsOpen(true)}>
                <Settings size={18} />
              </IconButton>
            </div>
          </div>

          {isProgressHubView(view) && (
            <ProgressHubNav view={view} onNavigate={navigateTo} />
          )}

          {view === 'today' && (
            <TodayView
              entry={entry}
              entries={entries}
              date={selectedDate}
              today={today}
              settings={settings}
              anchors={anchors}
              anchorsDone={anchorsDone}
              anchorMinutes={anchorMinutes}
              streakByKey={streakByKey}
              onDateChange={setSelectedDate}
              onUpdate={updateEntry}
              onToggleAnchor={toggleAnchor}
              onEditTask={(index, value) => setTaskEditor({
                index,
                value,
                minutes: anchorMinutes[index] ?? dayPolicy.focusMinutes,
              })}
              onAddTask={() => openUniversalCapture({ classifyAs: 'task' })}
              onOpenFocus={openFocus}
              onExportToCalendar={exportTaskToCalendar}
              onReorderHabits={ids => setSettings(current => ({ ...current, activeHabits: ids }))}
              ritualEnabled={settings.morningGateEnabled}
              ritualSkipped={gateSkipped}
              ritualSteps={ritualSteps}
              ritualDoneSteps={completedRitualSteps({
                progress: ritualProgress,
                entry,
                config: settings.morningRitual,
              })}
              onOpenRoutineMode={() => setRoutineSelectorOpen(true)}
              syncLabel={storageStatusLabel(syncStatus, isOnline, Boolean(deviceSyncCreds))}
              syncStatus={syncStatus}
              ritualLock={ritualHeuteLock === 'todos' ? 'todos' : null}
              onReopenMorningGate={() => {
                const done = completedRitualSteps({
                  progress: ritualProgress,
                  entry,
                  config: settings.morningRitual,
                })
                const nextIndex = ritualSteps.findIndex(id => !done.includes(id))
                setGatePreview(true)
                setPreviewIndex(nextIndex >= 0 ? nextIndex : Math.max(0, ritualSteps.length - 1))
              }}
              onOpenEveningGate={() => setEveningGateOpen(true)}
              dailyEvents={dailyEvents}
              onUndoDailyEvent={undoDailyEvent}
              onUndoRitualEvent={undoRitualEvent}
              onContinueRitualTodos={() => {
                setRitualProgress(current => markRitualStepDone(current, 'todos'))
                appendDailyEvent(createRitualStepEvent({ date: today, stepId: 'todos' }))
              }}
            />
          )}

          {view === 'plan' && (
            <PlanView
              date={selectedDate}
              today={today}
              anchors={anchors}
              anchorsDone={anchorsDone}
              anchorMinutes={anchorMinutes}
              focusMinutes={dayPolicy.focusMinutes}
              maxAnchors={dayPolicy.maxAnchors}
              energy={entry.energyLevel}
              onDateChange={setSelectedDate}
              onAddTask={() => openUniversalCapture({ classifyAs: 'task' })}
              onAddSuggestion={text => openUniversalCapture({ raw: text, classifyAs: 'task' })}
              onEditTask={(index, value) => setTaskEditor({
                index,
                value,
                minutes: anchorMinutes[index] ?? dayPolicy.focusMinutes,
              })}
              onDeleteTask={deleteTask}
              onMoveTask={moveTask}
              onToggleTask={toggleAnchor}
              onOpenFocus={openFocus}
              onExportToCalendar={exportTaskToCalendar}
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
            <ProgressView
              entries={entries}
              today={today}
              selectedDate={selectedDate}
              scoreGoals={scoreGoals}
              heightCm={settings.heightCm}
              labClassName={labUiClassNames(settings.adaptive ?? defaultAdaptiveLifeConfig())}
              onSelectDate={date => {
                setSelectedDate(date)
                navigateTo('today')
              }}
            />
          )}

          {view === 'dashboardPlus' && (
            <DashboardPlusView
              dashboard={dashboardPlus}
              onChange={setDashboardPlus}
              onBackToToday={() => navigateTo('today')}
              today={today}
              liveOverview={laborLive}
              liveStats={laborStats}
              layout={settings.dashboardPlusLayout}
              medisRemindersEnabled={settings.medisRemindersEnabled}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenProject={id => navigateTo('project', id)}
              onOpenGoal={id => navigateTo('goal', id)}
              showToast={showToast}
              section={labDataSection}
              onSectionChange={section => {
                setLabDataSection(section)
                navigateLabDataSection(section)
              }}
              onQuickAction={handleLabQuickAction}
            />
          )}
          {view === 'inbox' && (
            <InboxView
              items={lifeOs.inbox}
              projects={dashboardPlus.boards.map(board => ({ id: board.id, label: board.label }))}
              goals={dashboardPlus.goals.map(goal => ({ id: goal.id, title: goal.title }))}
              onCapture={() => openUniversalCapture()}
              onOpen={id => setLifeOsEntityId(id)}
              onClassify={lifeOs.classify}
              onConvert={handleConvertCapture}
              onArchive={lifeOs.archive}
              onDelete={lifeOs.removeCapture}
              onLink={(id, links) => lifeOs.updateCapture(id, links)}
            />
          )}
          {view === 'project' && (
            <ProjectDetailView
              project={dashboardPlus.boards.find(board => board.id === lifeOsEntityId) ?? dashboardPlus.boards[0] ?? null}
              goals={dashboardPlus.goals}
              knowledge={lifeOs.state.knowledge.filter(item => relatedIds(lifeOs.state, 'knowledge', item.id, 'project').includes(lifeOsEntityId ?? '') || lifeOs.state.captures.some(capture => capture.converted?.id === item.id && capture.projectId === lifeOsEntityId))}
              decisions={lifeOs.state.decisions.filter(item => item.projectId === lifeOsEntityId)}
              activities={lifeOs.state.activities.filter(item => item.projectId === lifeOsEntityId)}
              notes={lifeOs.state.captures.filter(item => item.projectId === lifeOsEntityId && item.status === 'converted' && item.converted?.kind === 'knowledge').map(item => item.title)}
              onBack={() => navigateTo('dashboardPlus')}
              onChange={patch => {
                const id = lifeOsEntityId ?? dashboardPlus.boards[0]?.id
                if (!id) return
                setDashboardPlus(current => ({
                  ...current,
                  boards: current.boards.map(board => board.id === id
                    ? {
                      ...board,
                      label: patch.label ?? board.label,
                      description: patch.description ?? board.description,
                      outcome: patch.outcome ?? board.outcome,
                      status: patch.status ?? board.status,
                      priority: patch.priority ?? board.priority,
                      startDate: patch.startDate ?? board.startDate,
                      targetDate: patch.targetDate ?? board.targetDate,
                      nextAction: patch.nextAction ?? board.nextAction,
                      nextActionTaskId: patch.nextActionTaskId ?? board.nextActionTaskId,
                      milestones: patch.milestones ?? board.milestones,
                      goalId: patch.goalId ?? board.goalId,
                      lifeArea: 'lifeArea' in patch ? patch.lifeArea : board.lifeArea,
                      lastActivityAt: nowIso(),
                    }
                    : board),
                }))
                const previous = dashboardPlus.boards.find(board => board.id === id)
                const nextArea = 'lifeArea' in patch ? patch.lifeArea : previous?.lifeArea
                lifeOs.commit(current => ({
                  ...current,
                  events: [
                    ...current.events,
                    emitDomainEvent('project.updated', { id, ...(nextArea ? { lifeArea: nextArea } : {}) }, { kind: 'project', id }),
                    ...lifeAreaTransitionEvents(previous?.lifeArea, nextArea, { kind: 'project', id }),
                  ],
                }))
              }}
              onAddTask={() => {
                openUniversalCapture({ classifyAs: 'task' })
              }}
              onToggleTask={taskId => {
                const id = lifeOsEntityId ?? dashboardPlus.boards[0]?.id
                if (!id) return
                setDashboardPlus(current => ({
                  ...current,
                  boards: current.boards.map(board => board.id === id
                    ? {
                      ...board,
                      lastActivityAt: nowIso(),
                      tasks: board.tasks.map(task => {
                        if (task.id !== taskId) return task
                        const done = !task.done
                        if (done) {
                          lifeOs.commit(state => ({
                            ...state,
                            events: [...state.events, emitDomainEvent('task.completed', { title: task.title }, { kind: 'task', id: task.id })],
                          }))
                        }
                        return { ...task, done }
                      }),
                    }
                    : board),
                }))
              }}
              onPatchTask={(taskId, patch) => {
                const id = lifeOsEntityId ?? dashboardPlus.boards[0]?.id
                if (!id) return
                const previous = dashboardPlus.boards.find(board => board.id === id)?.tasks.find(task => task.id === taskId)
                setDashboardPlus(current => ({
                  ...current,
                  boards: current.boards.map(board => board.id === id
                    ? {
                      ...board,
                      lastActivityAt: nowIso(),
                      tasks: board.tasks.map(task => task.id === taskId
                        ? { ...task, lifeArea: 'lifeArea' in patch ? patch.lifeArea : task.lifeArea }
                        : task),
                    }
                    : board),
                }))
                lifeOs.commit(current => ({
                  ...current,
                  events: [
                    ...current.events,
                    ...lifeAreaTransitionEvents(previous?.lifeArea, patch.lifeArea, { kind: 'task', id: taskId }),
                  ],
                }))
              }}
              onOpenDecision={id => navigateTo('decisions', id)}
              onOpenKnowledge={id => navigateTo('knowledge', id)}
            />
          )}
          {view === 'goal' && (
            <GoalDetailView
              goal={dashboardPlus.goals.find(item => item.id === lifeOsEntityId) ?? dashboardPlus.goals[0] ?? null}
              projects={dashboardPlus.boards}
              onBack={() => navigateTo('dashboardPlus')}
              onChange={patch => {
                const id = lifeOsEntityId ?? dashboardPlus.goals[0]?.id
                if (!id) return
                setDashboardPlus(current => ({
                  ...current,
                  goals: current.goals.map(goal => {
                    if (goal.id !== id) return goal
                    const timeframe = patch.timeframe
                    const nextTimeframe = timeframe === 'Jahr' || timeframe === 'Quartal' || timeframe === 'Monat' || timeframe === 'Woche'
                      ? timeframe
                      : goal.timeframe
                    return { ...goal, ...patch, timeframe: nextTimeframe }
                  }),
                }))
                const previous = dashboardPlus.goals.find(goal => goal.id === id)
                const nextArea = 'lifeArea' in patch ? patch.lifeArea : previous?.lifeArea
                lifeOs.commit(current => ({
                  ...current,
                  events: [
                    ...current.events,
                    emitDomainEvent('goal.updated', { id, ...(nextArea ? { lifeArea: nextArea } : {}) }, { kind: 'goal', id }),
                    ...lifeAreaTransitionEvents(previous?.lifeArea, nextArea, { kind: 'goal', id }),
                  ],
                }))
              }}
              onAddCheckIn={(note, value) => {
                const id = lifeOsEntityId ?? dashboardPlus.goals[0]?.id
                if (!id) return
                setDashboardPlus(current => ({
                  ...current,
                  goals: current.goals.map(goal => goal.id === id
                    ? { ...goal, checkIns: [...(goal.checkIns ?? []), { id: crypto.randomUUID(), at: today, note, value }] }
                    : goal),
                }))
              }}
            />
          )}
          {view === 'knowledge' && (
            <KnowledgeView
              items={lifeOs.state.knowledge}
              selectedId={lifeOsEntityId}
              related={(lifeOsEntityId ? relatedIds(lifeOs.state, 'knowledge', lifeOsEntityId, 'project') : []).map(id => ({
                id,
                kind: 'project',
                title: dashboardPlus.boards.find(board => board.id === id)?.label ?? id,
              }))}
              onSelect={id => setLifeOsEntityId(id)}
              onCreate={() => {
                const id = createId()
                const now = nowIso()
                const item: KnowledgeItem = {
                  id, title: 'Neuer Eintrag', content: '', summary: '', source: '', type: 'thought', topics: [], tags: [], createdAt: now, updatedAt: now,
                }
                lifeOs.commit(current => ({
                  ...current,
                  knowledge: [item, ...current.knowledge],
                  events: [...current.events, emitDomainEvent('knowledge.created', { title: item.title }, { kind: 'knowledge', id })],
                }))
                setLifeOsEntityId(id)
                return id
              }}
              onChange={(id, patch) => {
                lifeOs.commit(current => ({
                  ...current,
                  knowledge: current.knowledge.map(item => item.id === id ? { ...item, ...patch, updatedAt: nowIso() } : item),
                }))
              }}
              onDelete={id => lifeOs.commit(current => ({ ...current, knowledge: current.knowledge.filter(item => item.id !== id) }))}
              onLink={(id, target) => {
                lifeOs.commit(current => ({
                  ...current,
                  relations: [...current.relations, {
                    id: createId(),
                    fromKind: 'knowledge',
                    fromId: id,
                    toKind: target.kind,
                    toId: target.targetId,
                    createdAt: nowIso(),
                  }],
                }))
              }}
            />
          )}
          {view === 'decisions' && (
            <DecisionView
              decisions={lifeOs.state.decisions.map(item => refreshDecisionStatus(item, today))}
              projects={dashboardPlus.boards.map(board => ({ id: board.id, label: board.label }))}
              goals={dashboardPlus.goals}
              selectedId={lifeOsEntityId}
              onSelect={id => setLifeOsEntityId(id)}
              onCreate={() => {
                const id = createId()
                const now = nowIso()
                const decision: Decision = {
                  id,
                  title: 'Neue Entscheidung',
                  decision: '',
                  context: '',
                  reasoning: '',
                  alternatives: '',
                  expectedOutcome: '',
                  decidedAt: today,
                  status: 'active',
                  createdAt: now,
                  updatedAt: now,
                }
                lifeOs.commit(current => ({
                  ...current,
                  decisions: [decision, ...current.decisions],
                  events: [...current.events, emitDomainEvent('decision.created', { title: decision.title }, { kind: 'decision', id })],
                }))
                setLifeOsEntityId(id)
                return id
              }}
              onChange={(id, patch) => {
                lifeOs.commit(current => ({
                  ...current,
                  decisions: current.decisions.map(item => item.id === id ? refreshDecisionStatus({ ...item, ...patch, updatedAt: nowIso() }, today) : item),
                }))
              }}
              onDelete={id => lifeOs.commit(current => ({ ...current, decisions: current.decisions.filter(item => item.id !== id) }))}
            />
          )}
          {view === 'reviews' && (
            <ReviewView
              reviews={[...lifeOs.state.reviews].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))}
              draft={reviewDraft}
              onType={type => {
                setReviewType(type)
                startReview(type)
              }}
              onStart={() => startReview(reviewType)}
              onChange={patch => setReviewDraft(current => current ? { ...current, ...patch, updatedAt: nowIso() } : current)}
              onComplete={() => {
                if (!reviewDraft) return
                const saved = completeReview(reviewDraft, reviewDraft)
                lifeOs.saveReview(saved)
                setReviewDraft(saved)
                showToast('Review gespeichert')
              }}
              onSelect={id => {
                const found = lifeOs.state.reviews.find(item => item.id === id) ?? null
                setReviewDraft(found)
                if (found) setReviewType(found.type)
              }}
            />
          )}
          {view === 'signals' && (
            <SignalsView
              signals={lifeOs.state.signals}
              activities={lifeOs.state.activities}
              onRecord={lifeOs.addSignal}
              onActivity={lifeOs.addActivity}
            />
          )}
          {view === 'insights' && (
            <InsightsView
              insights={lifeOs.state.insights}
              onRefresh={() => {
                refreshInsights()
                showToast('Insights neu berechnet')
              }}
            />
          )}
          {view === 'integrations' && (
            <IntegrationsView
              instances={lifeOs.state.connectors}
              outbound={lifeOs.state.outboundWebhooks}
              logs={lifeOs.state.webhookLogs}
              onConnect={async (connectorId, secret) => {
                const configuration: Record<string, string> = {}
                if (secret) configuration.secretHash = await hashSecret(secret)
                const instance = createConnectorInstance(connectorId, configuration)
                instance.status = 'connected'
                lifeOs.commit(current => ({
                  ...current,
                  connectors: [
                    ...current.connectors.filter(item => item.connectorId !== connectorId),
                    instance,
                  ],
                }))
                showToast(secret ? 'Verbunden. Secret wird nur als Hash gespeichert.' : 'Verbunden')
              }}
              onDisconnect={id => {
                lifeOs.commit(current => ({
                  ...current,
                  connectors: current.connectors.map(item => item.id === id
                    ? { ...item, status: 'disconnected', configuration: {}, updatedAt: nowIso() }
                    : item),
                }))
              }}
              onConfigure={(id, configuration) => {
                lifeOs.commit(current => ({
                  ...current,
                  connectors: current.connectors.map(item => item.id === id
                    ? { ...item, configuration: { ...item.configuration, ...configuration }, updatedAt: nowIso() }
                    : item),
                }))
              }}
              onAddOutbound={(url, events) => {
                lifeOs.commit(current => ({
                  ...current,
                  outboundWebhooks: [...current.outboundWebhooks, {
                    id: createId(),
                    url,
                    events: events as DomainEventType[],
                    enabled: true,
                    createdAt: nowIso(),
                    updatedAt: nowIso(),
                  }],
                }))
              }}
              onToggleOutbound={(id, enabled) => {
                lifeOs.commit(current => ({
                  ...current,
                  outboundWebhooks: current.outboundWebhooks.map(item => item.id === id ? { ...item, enabled, updatedAt: nowIso() } : item),
                }))
              }}
            />
          )}
        </main>

        <nav className="mobile-nav" aria-label="Mobile Navigation">
          <button
            type="button"
            className={view === 'today' ? 'mobile-nav__item is-active' : 'mobile-nav__item'}
            aria-current={view === 'today' ? 'page' : undefined}
            onClick={() => navigateTo('today')}
          >
            <Home size={20} />
            <span>Heute</span>
          </button>
          <button
            type="button"
            className="mobile-nav__item mobile-nav__capture"
            aria-label="Mit Jo AI erfassen"
            onClick={() => openUniversalCapture()}
          >
            <span className="mobile-nav__capture-icon" aria-hidden="true">
              <Mic size={20} />
              <Sparkles className="mobile-nav__capture-spark" size={10} />
            </span>
            <span>Jo AI</span>
          </button>
          <button
            type="button"
            className={isProgressHubView(view) ? 'mobile-nav__item is-active' : 'mobile-nav__item'}
            aria-current={isProgressHubView(view) ? 'page' : undefined}
            onClick={() => navigateTo('progress')}
          >
            <FlaskConical size={20} />
            <span>Lab</span>
          </button>
        </nav>

        {view !== 'dashboardPlus' && view !== 'today' && view !== 'checkin' && view !== 'plan' && view !== 'progress' && !showMorningGate && (
          <button type="button" className="fab" onClick={() => openUniversalCapture()} aria-label="Schnell hinzufügen">
            <Plus size={22} />
          </button>
        )}
      </div>

      {taskEditor && (
        <TaskEditor
          initialValue={taskEditor.value}
          initialMinutes={taskEditor.minutes}
          isEditing={taskEditor.index !== null}
          onClose={() => setTaskEditor(null)}
          onSave={(value, minutes) => saveTask(value, taskEditor.index, minutes)}
        />
      )}

      {quickAddOpen && (
        <QuickAddModal
          onClose={() => setQuickAddOpen(false)}
          onSubmitTask={quickAddTask}
          onSubmitWeight={quickAddWeight}
          onSubmitCalories={quickAddCalories}
          onSubmitProtein={quickAddProtein}
          onSubmitFat={quickAddFat}
          onSubmitCarbs={quickAddCarbs}
          onSubmitFiber={quickAddFiber}
          onSubmitWater={quickAddWater}
          onSubmitSteps={quickAddSteps}
        />
      )}

      {paletteOpen && (
        <CommandPalette
          state={lifeOs.state}
          projects={dashboardPlus.boards}
          goals={dashboardPlus.goals}
          tasks={[
            ...dashboardPlus.focusTodos.map(task => ({ id: task.id, title: task.title, project: 'Fokus', lifeArea: task.lifeArea })),
            ...dashboardPlus.boards.flatMap(board => board.tasks.map(task => ({ id: task.id, title: task.title, project: board.label, lifeArea: task.lifeArea ?? board.lifeArea }))),
          ]}
          onClose={() => setPaletteOpen(false)}
          onNavigate={(next, id) => {
            setPaletteOpen(false)
            navigateTo(next, id)
          }}
          onOpenCapture={preset => {
            setPaletteOpen(false)
            openUniversalCapture({ raw: preset ?? '' })
          }}
          onOpenHit={hit => {
            setPaletteOpen(false)
            if (hit.kind === 'project') navigateTo('project', hit.id)
            else if (hit.kind === 'goal') navigateTo('goal', hit.id)
            else if (hit.kind === 'decision') navigateTo('decisions', hit.id)
            else if (hit.kind === 'knowledge' || hit.kind === 'note') navigateTo('knowledge', hit.id)
            else if (hit.kind === 'capture') navigateTo('inbox', hit.id)
            else navigateTo('inbox')
          }}
        />
      )}

      {routineSelectorOpen && (
        <RoutineModeSelector
          onClose={() => setRoutineSelectorOpen(false)}
          onSelectMorning={() => {
            setRoutineSelectorOpen(false)
            const done = completedRitualSteps({
              progress: ritualProgress,
              entry,
              config: settings.morningRitual,
            })
            const nextIndex = ritualSteps.findIndex(id => !done.includes(id))
            setGatePreview(true)
            setPreviewIndex(nextIndex >= 0 ? nextIndex : Math.max(0, ritualSteps.length - 1))
          }}
          onSelectEvening={() => {
            setRoutineSelectorOpen(false)
            setEveningGateOpen(true)
          }}
        />
      )}

      {captureOpen && (
        <CaptureSheet
          initialRaw={capturePreset}
          initialClassifyAs={captureClassifyAs}
          initialMode={captureMode}
          inactive={privateNotesOpen}
          onClose={() => {
            setCaptureOpen(false)
            setCapturePreset('')
            setCaptureClassifyAs(undefined)
            setCaptureMode('default')
          }}
          onDecide={async input => {
            const changeSession = tryOpenSystemChange(input.content, settings)
            if (changeSession) {
              setJoChangeSession(changeSession)
              setJoChangePhase(
                changeSession.kind === 'code'
                  ? 'code'
                  : changeSession.kind === 'error'
                    ? 'error'
                    : 'preview',
              )
              setCaptureOpen(false)
              setCapturePreset('')
              return undefined
            }
            const batch = await decideCaptureInput({
              source: input.source,
              content: input.content,
              timestamp: new Date().toISOString(),
              context: { currentModule: 'capture' },
            }, {
              flags: resolveDecisionFlags(),
              context: captureDecisionContext(),
            })
            lastCaptureBatchRef.current = batch
            recordDecisionAudits(batch.audits)
            return previewFromBatch(batch)
          }}
          onCapture={input => {
            const changeSession = tryOpenSystemChange(input.raw, settings)
            if (changeSession) {
              setJoChangeSession(changeSession)
              setJoChangePhase(
                changeSession.kind === 'code'
                  ? 'code'
                  : changeSession.kind === 'error'
                    ? 'error'
                    : 'preview',
              )
              setCaptureOpen(false)
              setCapturePreset('')
              return
            }
            return handleLifeOsCapture(input)
          }}
          onOpenPrivateNotes={text => {
            openPrivateNotes(text, () => {
              setCaptureOpen(false)
              setCapturePreset('')
              setCaptureClassifyAs(undefined)
              setCaptureMode('default')
            })
          }}
        />
      )}

      {joChangeSession && (
        <ChangePreviewSheet
          phase={joChangePhase}
          preview={joChangeSession.kind === 'config' ? joChangeSession.pending.preview : null}
          implementationSpec={joChangeSession.kind === 'code' ? joChangeSession.spec : null}
          error={joChangeSession.kind === 'error' ? joChangeSession.message : undefined}
          developerMode={adaptiveDevMode}
          onApply={() => {
            if (joChangeSession.kind !== 'config') return
            const result = commitSystemChange({
              settings,
              proposal: joChangeSession.pending.proposal,
            })
            if (!result.ok) {
              setJoChangeSession({ kind: 'error', message: result.error })
              setJoChangePhase('error')
              return
            }
            const historyId = result.history.id
            const nextSettings: AppSettings = {
              ...settings,
              ...(result.settings.morningRitual
                ? { morningRitual: normalizeMorningRitualConfig(result.settings.morningRitual as Partial<MorningRitualConfig>) }
                : {}),
              ...(result.settings.eveningGate
                ? { eveningGate: normalizeEveningGateConfig(result.settings.eveningGate) }
                : {}),
              adaptive: readAdaptiveFromSettings(result.settings),
            }
            setSettings(nextSettings)
            setLastAppliedHistoryId(historyId)
            setJoChangePhase('applied')
            showToast('LifeOS aktualisiert', 'Rückgängig', () => {
              const undone = undoSystemChange({ settings: nextSettings, historyId })
              if (!undone.ok) {
                showToast(undone.error ?? 'Rückgängig fehlgeschlagen')
                return
              }
              setSettings(current => ({
                ...current,
                ...(undone.settings.morningRitual
                  ? { morningRitual: normalizeMorningRitualConfig(undone.settings.morningRitual as Partial<MorningRitualConfig>) }
                  : {}),
                ...(undone.settings.eveningGate
                  ? { eveningGate: normalizeEveningGateConfig(undone.settings.eveningGate) }
                  : {}),
                adaptive: readAdaptiveFromSettings(undone.settings),
              }))
              setLastAppliedHistoryId(null)
              setJoChangeSession(null)
              setJoChangePhase('preview')
              showToast('Änderung rückgängig gemacht')
            })
          }}
          onCancel={() => {
            setJoChangeSession(null)
            setJoChangePhase('preview')
          }}
          onUndo={() => {
            if (!lastAppliedHistoryId) return
            const result = undoSystemChange({ settings, historyId: lastAppliedHistoryId })
            if (!result.ok) {
              showToast(result.error ?? 'Rückgängig fehlgeschlagen')
              return
            }
            setSettings(current => ({
              ...current,
              ...(result.settings.morningRitual
                ? { morningRitual: normalizeMorningRitualConfig(result.settings.morningRitual as Partial<MorningRitualConfig>) }
                : {}),
              ...(result.settings.eveningGate
                ? { eveningGate: normalizeEveningGateConfig(result.settings.eveningGate) }
                : {}),
              adaptive: readAdaptiveFromSettings(result.settings),
            }))
            setLastAppliedHistoryId(null)
            setJoChangeSession(null)
            setJoChangePhase('preview')
            showToast('Änderung rückgängig gemacht')
          }}
        />
      )}

      {focusSession && (
        <FocusModal
          session={focusSession}
          onChangeMinutes={minutes => setFocusSession(current => current ? { ...current, minutes } : current)}
          onClose={() => setFocusSession(null)}
          onFinish={finishFocus}
          onExportToCalendar={() => {
            void exportTaskToCalendar(focusSession.title, focusSession.minutes)
          }}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          lastBackupAt={lastBackupAt}
          deviceSync={deviceSyncCreds}
          onChange={setSettings}
          onExport={handleExport}
          onImport={handleImport}
          onResetLabor={() => {
            if (!window.confirm('Lab-Daten auf leeren Start zurücksetzen? Todos, Medis, Boards und Finanzen gehen verloren.')) return
            setDashboardPlus(createDashboardPlusSeed())
            showToast('Lab-Daten zurückgesetzt.')
          }}
          onDeviceSyncChange={creds => {
            setDeviceSyncCreds(creds)
            if (creds) void syncNow()
          }}
          onSyncNow={() => {
            void syncNow().then(() => showToast('Sync aktualisiert.'))
          }}
          showToast={showToast}
          onClose={() => setSettingsOpen(false)}
          onPreviewMorningGate={() => {
            setSettingsOpen(false)
            setPreviewIndex(0)
            setGatePreview(true)
            setGateBypass(false)
          }}
          onOpenIntegrations={() => {
            setSettingsOpen(false)
            navigateTo('integrations')
          }}
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

      {showMorningGate && ritualStep && (
        <MorningGate
          step={ritualStep}
          stepIndex={gatePreview ? previewIndex : Math.max(0, ritualSteps.indexOf(ritualStep))}
          stepCount={Math.max(1, ritualSteps.length)}
          steps={ritualSteps.map(id => ({ id, label: morningRitualMeta(id, settings.morningRitual).label }))}
          doneSteps={completedRitualSteps({
            progress: ritualProgress,
            entry,
            config: settings.morningRitual,
          })}
          name={settings.name}
          medications={morningGateMeds}
          proteinShake={Boolean(entry.proteinShake)}
          gratitudeText={settings.morningRitual.gratitudeText}
          mood={entry.mood}
          sleepQuality={entry.sleepQuality}
          sleepDuration={entry.sleepDuration}
          dreamed={entry.dreamed}
          onHeadRecovery={patch => updateEntry(patch, 'morning_gate')}
          config={settings.morningRitual}
          anchors={anchors}
          anchorsDone={anchorsDone}
          pushups={ritualProgress.pushups}
          ko={ritualProgress.ko}
          selfcareChecked={ritualProgress.selfcareChecked}
          onToggleMed={id => {
            const medication = dashboardPlus.medications.find(item => item.id === id)
            const nextTaken = medication ? !isMedicationTakenToday(medication, today) : true
            setDashboardPlus(current => ({
              ...current,
              medications: current.medications.map(item => {
                if (item.id !== id) return item
                const taken = isMedicationTakenToday(item, today)
                return {
                  ...item,
                  takenDate: taken ? undefined : today,
                  taken: !taken,
                }
              }),
            }))
            appendDailyEvent(createRitualStepEvent({
              date: today,
              stepId: 'medsShake',
              status: 'updated',
              details: { medicationId: id, taken: nextTaken },
            }))
          }}
          onConfirmAllMeds={() => {
            setDashboardPlus(current => ({
              ...current,
              medications: current.medications.map(item => ({
                ...item,
                takenDate: today,
                taken: true,
              })),
            }))
            appendDailyEvent(createRitualStepEvent({
              date: today,
              stepId: 'medsShake',
              status: 'updated',
              details: { allMedicationsTaken: true },
            }))
          }}
          onToggleProtein={() => updateEntry({ proteinShake: !entry.proteinShake }, 'morning_gate')}
          onCompleteGratitude={() => {
            const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date())
            const line = `${time} — Dankbarkeit vorgelesen`
            updateEntry({
              gratitudeDone: true,
              journalText: entry.journalText ? `${entry.journalText}\n${line}` : line,
            }, 'morning_gate')
          }}
          onPickEnergy={energy => {
            updateEntry({ energyLevel: energy }, 'morning_gate')
            setRitualProgress(current => markRitualStepDone(current, 'energy'))
            appendDailyEvent(createRitualStepEvent({ date: today, stepId: 'energy' }))
            emitAdaptiveEvent('routine_step.completed', { entityId: 'energy', surface: 'morning_gate', date: today })
            if (gatePreview) setPreviewIndex(value => value + 1)
          }}
          onPickWeight={kg => {
            updateEntry({ weightKg: kg }, 'morning_gate', {
              toastMessage: `Gewicht gespeichert: ${kg} kg`,
            })
            setRitualProgress(current => markRitualStepDone(current, 'weight'))
            appendDailyEvent(createRitualStepEvent({
              date: today,
              stepId: 'weight',
              status: 'updated',
              details: { weightKg: kg },
            }))
            emitAdaptiveEvent('metric.recorded', {
              entityId: 'weight',
              surface: 'morning_gate',
              date: today,
              payload: { value: kg },
            })
            if (gatePreview) setPreviewIndex(value => value + 1)
          }}
          onCompleteTimer={kind => {
            if (kind === 'coldShower') updateEntry({ coldShower: true }, 'morning_gate')
            if (kind === 'winnerPose') updateEntry({ winnerModeDone: true }, 'morning_gate')
            setRitualProgress(current => markRitualStepDone(current, kind))
            appendDailyEvent(createRitualStepEvent({ date: today, stepId: kind }))
            if (kind === 'prayer') navigateTo('today')
            if (gatePreview) setPreviewIndex(value => Math.min(ritualSteps.length - 1, value + 1))
          }}
          onSetPushups={value => {
            appendDailyEvent(createRitualStepEvent({
              date: today,
              stepId: 'workout',
              status: 'updated',
              details: { pushups: value },
            }))
            setRitualProgress(current => {
              const next = { ...current, pushups: value }
              saveMorningRitualProgress(next)
              return next
            })
          }}
          onSetKo={value => {
            appendDailyEvent(createRitualStepEvent({
              date: today,
              stepId: 'workout',
              status: 'updated',
              details: { knockouts: value },
            }))
            setRitualProgress(current => {
              const next = { ...current, ko: value }
              saveMorningRitualProgress(next)
              return next
            })
          }}
          onToggleSelfcare={id => {
            appendDailyEvent(createRitualStepEvent({
              date: today,
              stepId: 'selfcare',
              status: 'updated',
              details: {
                itemId: id,
                checked: !ritualProgress.selfcareChecked.includes(id),
              },
            }))
            setRitualProgress(current => {
              const checked = current.selfcareChecked.includes(id)
                ? current.selfcareChecked.filter(item => item !== id)
                : [...current.selfcareChecked, id]
              const next = { ...current, selfcareChecked: checked }
              saveMorningRitualProgress(next)
              return next
            })
          }}
          onCompleteStep={step => {
            if (step === 'medsShake' && !entry.proteinShake) updateEntry({ proteinShake: true }, 'morning_gate')
            if (step === 'workout') updateEntry({ pushupsDone: true }, 'morning_gate')
            setRitualProgress(current => markRitualStepDone(current, step))
            appendDailyEvent(createRitualStepEvent({ date: today, stepId: step }))
            if (gatePreview) {
              if (previewIndex >= ritualSteps.length - 1) {
                setGatePreview(false)
                setPreviewIndex(0)
                return
              }
              setPreviewIndex(value => value + 1)
            }
            if (step === 'letsGo') {
              setGatePreview(false)
              showToast('LETS GO — ready.')
            }
          }}
          onSkipToday={() => {
            saveMorningGateSkip(today)
            setGateSkipped(true)
            setGatePreview(false)
            showToast('Morgen-Ritual für heute übersprungen.')
          }}
          onOpenCapture={() => openUniversalCapture()}
          onOpenSettings={() => setSettingsOpen(true)}
          onClosePreview={gatePreview ? () => setGatePreview(false) : undefined}
        />
      )}

      {eveningGateOpen && (
        <EveningGate
          initialState={entry.eveningGate}
          inactive={privateNotesOpen}
          onPersist={state => updateEntry({
            eveningGate: state,
            ...(state.done.includes('breathing') ? { breathingDone: true } : {}),
          }, 'evening_gate')}
          onCaptureMemo={text => commitLifeOsCapture({ raw: text, classifyAs: 'note' }, false)}
          onOpenPrivateNotes={openPrivateNotes}
          onFinish={state => {
            updateEntry({
              eveningGate: state,
              breathingDone: true,
              dayClosedAt: state.completedAt ?? new Date().toISOString(),
            }, 'evening_gate', {
              toastMessage: 'Tag abgeschlossen · No Screen.',
            })
            setEveningGateOpen(false)
          }}
          onClose={() => setEveningGateOpen(false)}
        />
      )}

      {privateNotesOpen && (
        <PrivateNotesSheet
          initialText={privateNotePreset}
          onSaved={() => {
            const afterSave = privateNoteSavedRef.current
            privateNoteSavedRef.current = null
            setPrivateNotePreset('')
            afterSave?.()
            void pushDeviceSync().catch(() => undefined)
            showToast('Privater Bereich verschlüsselt aktualisiert.')
          }}
          onClose={() => {
            setPrivateNotesOpen(false)
            setPrivateNotePreset('')
            privateNoteSavedRef.current = null
          }}
        />
      )}

      {splashPhase !== 'done' && (
        <div
          className={splashPhase === 'leaving' ? 'splash-screen is-leaving' : 'splash-screen'}
          role="presentation"
          aria-hidden="true"
          onClick={dismissSplash}
        >
          <div className="splash-screen__orbs">
            <span className="splash-screen__orb splash-screen__orb--one" />
            <span className="splash-screen__orb splash-screen__orb--two" />
            <span className="splash-screen__orb splash-screen__orb--three" />
          </div>
          <div className="splash-screen__content">
            <div className="brand__mark splash-screen__mark"><span /></div>
            <strong className="splash-screen__title">Life OS</strong>
            <p className="splash-screen__greeting">
              {greeting()}{settings.name.trim() ? `, ${settings.name.trim()}` : ''}.
            </p>
            <span className="splash-screen__date">{formatLongDate(today)}</span>
            <div className="splash-screen__loader"><span /></div>
          </div>
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

type QuickNoteState = { text: string; updatedAt: string | null }

function loadQuickNote(): QuickNoteState {
  try {
    const stored = JSON.parse(localStorage.getItem(QUICK_NOTE_KEY) ?? 'null') as Partial<QuickNoteState> | null
    if (!stored || typeof stored.text !== 'string') return { text: '', updatedAt: null }
    return {
      text: stored.text.slice(0, 600),
      updatedAt: typeof stored.updatedAt === 'string' ? stored.updatedAt : null,
    }
  } catch {
    return { text: '', updatedAt: null }
  }
}

function TodayView({
  entry,
  entries,
  date,
  today,
  settings,
  anchors,
  anchorsDone,
  anchorMinutes,
  onDateChange,
  onUpdate,
  onToggleAnchor,
  onOpenFocus,
  ritualLock = null,
  onContinueRitualTodos,
  onReopenMorningGate,
  onOpenRoutineMode,
  ritualEnabled = false,
  ritualSkipped = false,
  ritualSteps = [],
  ritualDoneSteps = [],
  onOpenEveningGate,
  dailyEvents = [],
  onUndoDailyEvent,
  onUndoRitualEvent,
}: {
  entry: DashboardEntry
  entries: DashboardEntry[]
  date: string
  today: string
  settings: AppSettings
  anchors: string[]
  anchorsDone: boolean[]
  anchorMinutes: number[]
  streakByKey: Record<string, number>
  onDateChange: (date: string) => void
  onUpdate: (patch: Partial<DashboardEntry>) => void
  onToggleAnchor: (index: number) => void
  onEditTask: (index: number, value: string) => void
  onAddTask: () => void
  onOpenFocus: (title: string, taskIndex?: number, routineKey?: RoutineKey, overrideMinutes?: number) => void
  onReorderHabits: (ids: string[]) => void
  highlightQuickNote?: boolean
  onQuickNoteHighlightHandled?: () => void
  onExportToCalendar: (title: string, minutes: number) => Promise<void>
  ritualLock?: 'todos' | null
  onContinueRitualTodos?: () => void
  onReopenMorningGate?: () => void
  onOpenRoutineMode?: () => void
  ritualEnabled?: boolean
  ritualSkipped?: boolean
  ritualSteps?: MorningRitualStepId[]
  ritualDoneSteps?: MorningRitualStepId[]
  onOpenEveningGate?: () => void
  dailyEvents?: DailyEvent[]
  onUndoDailyEvent?: (event: EntryPatchEvent) => void
  onUndoRitualEvent?: (event: DailyEvent) => void
  syncLabel?: string
  syncStatus?: string
}) {
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [overviewRange, setOverviewRange] = useState<'today' | 'week' | 'month'>('today')
  const [rangeOpen, setRangeOpen] = useState(false)
  const [protocolOpen, setProtocolOpen] = useState(false)
  const rangeRef = useRef<HTMLDivElement>(null)
  const energy = entry.energyLevel

  useEffect(() => {
    if (!rangeOpen) return
    const onPointer = (event: PointerEvent) => {
      if (rangeRef.current && !rangeRef.current.contains(event.target as Node)) {
        setRangeOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRangeOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [rangeOpen])
  const dayEvents = eventsForDate(dailyEvents, date).slice(0, 12)
  const completeness = assessDayCompleteness({
    entry,
    activeHabits: settings.activeHabits,
    habitSchedules: settings.habitSchedules,
    focusMinutes: settings.focusMinutes,
    hour: date === today ? new Date().getHours() : 20,
    hiddenChecks: [
      ...settings.eveningGate.hiddenChecks,
      ...((settings.adaptive ?? defaultAdaptiveLifeConfig()).surfaces.now.excludeEntities.includes('energy')
        ? ['energy' as const]
        : []),
    ],
  })
  const habitGoals = {
    proteinGoal: settings.proteinGoal,
    focusMinutes: settings.focusMinutes,
    softMinutes: energy === 'low' ? 2 : undefined,
  }
  const hour = date === today ? new Date().getHours() : 12
  const showDailyClose = shouldShowDailyClose(
    date === today ? hour : Math.max(hour, settings.eveningGate.fromHour),
    completeness.closed,
    settings.eveningGate,
  )
  const habitsDue = filterHabitsForDate(settings.activeHabits, date, settings.habitSchedules)

  const allRoutineItems = habitsDue
    .map(id => DAILY_HABITS.find(h => h.id === id))
    .filter((h): h is HabitDef => h !== undefined)
    .map(h => ({
      key: h.id,
      label: h.label.replace(/^\d+(?:[.,]\d+)?\s*(?:Min\.?|Minuten|s)\s+/i, '').trim() || h.label,
      icon: h.icon,
      minutes: energy === 'low' ? 2 : (h.minutes ?? 11),
      done: isHabitKey(h.id)
        ? isHabitComplete(entry, h.id, defaultHabitKind(h.id, habitGoals))
        : Boolean(entry[h.id as keyof DashboardEntry]),
    }))

  const dailyProgress = assessDailyProgress({
    entry,
    activeHabits: habitsDue,
    habitDone: Object.fromEntries(allRoutineItems.map(item => [item.key, item.done])),
    hour,
  })
  const eveningCount = eveningRemaining(entry.eveningGate?.done)
  const eveningComplete = Boolean(entry.eveningGate?.completedAt || completeness.closed)
  const ownedHabitKeys = [
    ...ritualOwnedHabitKeys({
      enabled: ritualEnabled,
      skipped: ritualSkipped,
      steps: ritualSteps,
      doneSteps: ritualDoneSteps,
    }),
    ...eveningOwnedHabitKeys({
      enabled: Boolean(settings.eveningGate.enabled && showDailyClose),
      completed: eveningComplete,
      doneSteps: entry.eveningGate?.done,
    }),
  ]
  const adaptive = settings.adaptive ?? defaultAdaptiveLifeConfig()
  const nowDedupe = applyNowDedupePolicy({
    surface: adaptive.surfaces.now,
    gateOwnedKeys: ownedHabitKeys,
    gateOwnedEntities: [
      ...(ritualEnabled && !ritualSkipped && ritualSteps.includes('energy') ? ['energy' as const] : []),
      ...(ritualEnabled && !ritualSkipped && ritualSteps.includes('headRecovery') ? ['mood' as const, 'sleep' as const] : []),
      ...(ritualEnabled && !ritualSkipped && ritualSteps.includes('weight') ? ['weight' as const] : []),
    ],
    habitKeys: allRoutineItems.map(item => item.key),
  })
  const excludeHabitKeys = [...new Set([...ownedHabitKeys, ...nowDedupe.excludeHabitKeys])]
  const ritualCount = ritualRemaining({ steps: ritualSteps, doneSteps: ritualDoneSteps })
  const nowItems = selectNowItems({
    anchors,
    anchorsDone,
    anchorMinutes,
    habits: allRoutineItems.map(item => ({
      key: item.key,
      label: item.label,
      done: item.done,
      minutes: item.minutes,
    })),
    energy,
    hour,
    excludeHabitKeys,
  })
  const overviewItems = selectOverviewItems({
    anchors,
    anchorsDone,
    anchorMinutes,
    habits: allRoutineItems.map(item => ({
      key: item.key,
      label: item.label,
      done: item.done,
      minutes: item.minutes,
    })),
    excludeHabitKeys,
  })
  const laterItem = overviewItems.find(item => {
    if (item.done || nowItems.some(now => now.id === item.id)) return false
    if (ownedHabitKeys.includes(item.habitKey ?? '')) return false
    if (item.kind === 'habit' && item.habitKey && !isHabitRelevantNow(item.habitKey, hour)) return false
    return true
  })
  const laterChip = laterItem ? nowChipLabel(laterItem) : undefined
  const overviewGroups: Array<{ slot: DaySlot; title: string; items: NowItem[] }> = [
    { slot: 'morning', title: 'Morgen', items: [] },
    { slot: 'day', title: 'Tag', items: [] },
    { slot: 'evening', title: 'Abend', items: [] },
  ]
  for (const item of overviewItems) {
    const group = overviewGroups.find(entry => entry.slot === overviewSlot(item))
    group?.items.push(item)
  }
  const todayWeight = selectTodayWeight({
    date,
    entry,
    measurements: loadBodyMeasurements(),
  })
  const toggleFlowItem = (item: NowItem) => {
    if (item.kind === 'anchor' && item.index != null) onToggleAnchor(item.index)
    if (item.kind === 'habit' && item.habitKey && isHabitKey(item.habitKey)) {
      onUpdate({ [item.habitKey]: !item.done } as Partial<DashboardEntry>)
    }
  }

  const openFlowItem = (item: NowItem) => {
    onOpenFocus(
      item.title,
      item.kind === 'anchor' ? item.index : undefined,
      item.kind === 'habit' && item.habitKey ? item.habitKey as RoutineKey : undefined,
      item.minutes,
    )
  }

  return (
    <div className="view-stack heute-page">
      <header className="heute-head">
        <div className="heute-head__top">
          <span className="heute-head__date">{formatLongDate(date)}</span>
          <button
            type="button"
            className={overviewOpen ? 'heute-overview-toggle is-open' : 'heute-overview-toggle'}
            aria-expanded={overviewOpen}
            onClick={() => setOverviewOpen(open => !open)}
          >
            <LayoutGrid size={15} />
            {overviewOpen ? 'Schließen' : 'Tagesübersicht'}
          </button>
        </div>
        <h2>Now.</h2>
        <p className="heute-head__context">
          {overviewOpen
            ? 'Dein Tageskern auf einen Blick.'
            : ritualEnabled && !ritualSkipped && ritualCount.remaining > 0
              ? 'Morning Gate ist bereit.'
              : showDailyClose && !eveningComplete && eveningCount.remaining > 0
                ? 'Evening Gate ist bereit.'
                : dailyProgress.meaning}
        </p>
        {!overviewOpen && (
          <>
            <div className="heute-head__stats">
              <div>
                <strong>{dailyProgress.total > 0 ? `${dailyProgress.percent}%` : 'Frei'}</strong>
                <span>Tageskern</span>
              </div>
              {todayWeight && (
                <div>
                  <strong>{todayWeight.value.toFixed(1).replace('.', ',')} kg</strong>
                  <span>Gewicht</span>
                </div>
              )}
            </div>
            <div
              className="heute-head__bar"
              role="progressbar"
              aria-label="Tagesfortschritt"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={dailyProgress.percent}
              aria-valuetext={dailyProgress.total > 0
                ? `${dailyProgress.percent} Prozent des Tageskerns erledigt`
                : 'Keine regulären Tagesaufgaben'}
            >
              <span style={{ width: `${dailyProgress.percent}%` }} />
            </div>
          </>
        )}
      </header>

      {ritualLock === 'todos' && energy && (
        <section className="card morning-todos-card">
          <SectionTitle eyebrow="Morgen-Ritual" title="Was heute zählt" />
          <p className="policy-note">Das sind deine Anker. Danach kommt Workout.</p>
          {anchors.length === 0 ? (
            <EmptyState title="Noch keine Todos" text="Lege ein bis drei Anker fest, oder geh weiter zum Workout." />
          ) : (
            <ul className="morning-gate__meds">
              {anchors.map((task, index) => (
                <li key={`${task}-${index}`}>
                  <div className={anchorsDone[index] ? 'morning-gate__med is-taken' : 'morning-gate__med'}>
                    <span className="morning-gate__check">{anchorsDone[index] ? <Check size={16} /> : <span />}</span>
                    <span><strong>{task}</strong></span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="primary-button morning-gate__cta" onClick={onContinueRitualTodos}>
            <Check size={17} />
            Gesehen · Workout
          </button>
        </section>
      )}

      {ritualLock !== 'todos' && !overviewOpen && (
        <section className="heute-now">
          {ritualEnabled && !ritualSkipped && ritualCount.remaining > 0 && (
            <button type="button" className="heute-routine-card" onClick={onReopenMorningGate}>
              <span className="eyebrow">Morning Gate</span>
              <strong>{ritualCount.remaining} {ritualCount.remaining === 1 ? 'Schritt' : 'Schritte'} offen</strong>
              <span>Fortsetzen</span>
            </button>
          )}
          {showDailyClose && !eveningComplete && eveningCount.remaining > 0 && onOpenEveningGate && (
            <button type="button" className="heute-routine-card is-night" onClick={onOpenEveningGate}>
              <span className="eyebrow">Evening Gate</span>
              <strong>{eveningCount.remaining} {eveningCount.remaining === 1 ? 'Schritt' : 'Schritte'} offen</strong>
              <span>{entry.eveningGate?.startedAt ? 'Fortsetzen' : 'Starten'}</span>
            </button>
          )}
          {nowItems.length === 0 && !(ritualEnabled && !ritualSkipped && ritualCount.remaining > 0) && !(showDailyClose && !eveningComplete && eveningCount.remaining > 0) ? (
            <p className="heute-empty">Alles klar. Dein Tageskern ist frei.</p>
          ) : nowItems.length > 0 ? (
            <div className="heute-now__list">
              {nowItems.slice(0, 3).map(item => {
                const chip = nowChipLabel(item)
                return (
                  <div key={item.id} className="heute-pill">
                    <button
                      type="button"
                      className="heute-pill__copy"
                      onClick={() => openFlowItem(item)}
                    >
                      {chip && <em>{chip}</em>}
                      <strong>{item.title}</strong>
                      {item.minutes ? <span>{item.minutes} minuten</span> : null}
                    </button>
                    <button
                      type="button"
                      className="heute-pill__check"
                      onClick={() => toggleFlowItem(item)}
                      aria-label={`${item.title} erledigen`}
                    >
                      <Circle size={20} />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : null}
          {laterItem && !ownedHabitKeys.includes(laterItem.habitKey ?? '') && (
            <div className="heute-next">
              <span className="eyebrow">Als nächstes</span>
              <button type="button" className="heute-next__row" onClick={() => openFlowItem(laterItem)}>
                <span>
                  {laterChip && <em>{laterChip}</em>}
                  <strong>
                    {laterItem.minutes ? `${laterItem.minutes} Minuten ${laterItem.title}` : laterItem.title}
                  </strong>
                </span>
                <ChevronRight size={18} />
              </button>
            </div>
          )}
          {onOpenRoutineMode && (
            <button type="button" className="heute-routine" onClick={onOpenRoutineMode}>
              <Sun size={16} />
              Routine Mode
            </button>
          )}
        </section>
      )}

      {ritualLock !== 'todos' && overviewOpen && (
        <div className="heute-overview">
          <div className="heute-range" ref={rangeRef}>
            <button
              type="button"
              className="heute-range__btn"
              aria-expanded={rangeOpen}
              onClick={() => setRangeOpen(open => !open)}
            >
              {overviewRange === 'today' ? 'Heute' : overviewRange === 'week' ? 'Woche' : 'Monat'}
              <ChevronDown size={15} />
            </button>
            {rangeOpen && (
              <div className="heute-range__menu" role="listbox" aria-label="Zeitraum">
                {(['today', 'week', 'month'] as const).map(range => (
                  <button
                    key={range}
                    type="button"
                    role="option"
                    aria-selected={overviewRange === range}
                    onClick={() => {
                      setOverviewRange(range)
                      setRangeOpen(false)
                    }}
                  >
                    {range === 'today' ? 'Heute' : range === 'week' ? 'Woche' : 'Monat'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {overviewRange === 'today' && overviewGroups.map(group => (
            group.items.length === 0 ? null : (
              <section key={group.slot} className="heute-slot">
                <span className="eyebrow">{group.title}</span>
                <div className="heute-checks">
                  {group.items.map(item => (
                    <div key={item.id} className={item.done ? 'heute-check is-done' : 'heute-check'}>
                      <button
                        type="button"
                        className="heute-check__box"
                        onClick={() => toggleFlowItem(item)}
                        aria-label={`${item.title} ${item.done ? 'als offen markieren' : 'erledigen'}`}
                        aria-pressed={item.done}
                      >
                        {item.done ? <Check size={12} /> : <span />}
                      </button>
                      <button type="button" className="heute-check__copy" onClick={() => openFlowItem(item)}>
                        <strong>{item.title}</strong>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )
          ))}

          {overviewRange === 'week' && (
            <section className="heute-slot">
              <span className="eyebrow">Woche</span>
              <ul className="overview-week">
                {weekDateKeys(date).map(day => {
                  const dayEntry = entries.find(item => item.date === day)
                  const dayAnchors = dayEntry?.anchors ?? []
                  const dayDone = dayEntry?.anchorsDone ?? []
                  return (
                    <li key={day}>
                      <button type="button" className="overview-week__row" onClick={() => onDateChange(day)}>
                        <strong>{new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric' }).format(new Date(`${day}T12:00:00`))}</strong>
                        <span>
                          {dayAnchors.length === 0
                            ? 'Keine Anker'
                            : `${dayDone.filter(Boolean).length}/${dayAnchors.length} Anker`}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {overviewRange === 'month' && (
            <section className="heute-slot">
              <span className="eyebrow">Monat</span>
              <div className="month-grid month-grid--compact">
                {buildMonthGrid({
                  year: new Date(`${date}T12:00:00`).getFullYear(),
                  monthIndex: new Date(`${date}T12:00:00`).getMonth(),
                  today,
                  selected: date,
                  entryDates: new Set(entries.map(item => item.date)),
                  scoresByDate: Object.fromEntries(entries.map(item => [item.date, item.dailyScore])),
                }).map(cell => (
                  <button
                    key={cell.date}
                    type="button"
                    className={[
                      'month-cell',
                      cell.inMonth ? '' : 'is-outside',
                      cell.isToday ? 'is-today' : '',
                      cell.isSelected ? 'is-selected' : '',
                      cell.hasEntry ? 'has-entry' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => onDateChange(cell.date)}
                  >
                    {Number(cell.date.slice(-2))}
                  </button>
                ))}
              </div>
            </section>
          )}

          <button
            type="button"
            className={protocolOpen ? 'heute-protocol is-open' : 'heute-protocol'}
            onClick={() => setProtocolOpen(open => !open)}
            aria-expanded={protocolOpen}
          >
            Protokoll
            <ChevronDown size={16} />
          </button>
          {protocolOpen && dayEvents.length === 0 && (
            <p className="heute-empty">Noch keine Ereignisse für diesen Tag.</p>
          )}
          {protocolOpen && dayEvents.length > 0 && (
            <>
              <ul className="daily-timeline">
                {(timelineOpen ? dayEvents : dayEvents.slice(0, 3)).map(event => {
                  const undoEntry = onUndoDailyEvent != null && canUndoEntryPatch(event, dailyEvents)
                  const undoRitual = onUndoRitualEvent != null && canUndoRitualStep(event, dailyEvents)
                  return (
                    <li key={event.id} className="daily-timeline__row">
                      <div className="daily-timeline__copy">
                        <strong>{summarizeDailyEvent(event)}</strong>
                        <span>
                          {formatEventTime(event.occurredAt)}
                          {' · '}
                          {sourceLabel(event.source)}
                          {event.type === 'entry_patch' && event.undoOf ? ' · rückgängig' : ''}
                          {event.type === 'ritual_step' && event.status === 'reopened' ? ' · wieder geöffnet' : ''}
                        </span>
                      </div>
                      {(undoEntry || undoRitual) && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => {
                            if (undoEntry && canUndoEntryPatch(event, dailyEvents)) onUndoDailyEvent(event)
                            else if (undoRitual && canUndoRitualStep(event, dailyEvents)) onUndoRitualEvent(event)
                          }}
                        >
                          <RotateCcw size={14} />
                          Undo
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
              {dayEvents.length > 3 && (
                <button
                  type="button"
                  className="card-link"
                  onClick={() => setTimelineOpen(open => !open)}
                >
                  {timelineOpen ? 'Weniger zeigen' : `Alle ${dayEvents.length} Einträge`}
                  <ChevronRight size={16} />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function PlanView({
  date,
  today,
  anchors,
  anchorsDone,
  anchorMinutes,
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
  onExportToCalendar,
}: {
  date: string
  today: string
  anchors: string[]
  anchorsDone: boolean[]
  anchorMinutes: number[]
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
  onOpenFocus: (title: string, taskIndex?: number, routineKey?: RoutineKey, overrideMinutes?: number) => void
  onExportToCalendar: (title: string, minutes: number) => Promise<void>
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
                const taskMinutes = anchorMinutes[index] ?? focusMinutes
                return (
                  <SwipeableRow
                    key={`${task}-${index}`}
                    leftLabel={isDone ? 'Offen' : 'Erledigt'}
                    rightLabel="Nach unten"
                    onSwipeLeft={() => onToggleTask(index)}
                    onSwipeRight={index < anchors.length - 1 ? () => onMoveTask(index, 1) : undefined}
                  >
                    <div className={isDone ? 'editable-task is-done' : 'editable-task'}>
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
                        <span>{taskMinutes} Min. Fokus · Position {index + 1}</span>
                      </div>
                      <div className="editable-task__actions">
                        <IconButton label="Nach oben" onClick={() => onMoveTask(index, -1)} disabled={index === 0}>
                          <ChevronUp size={15} />
                        </IconButton>
                        <IconButton label="Nach unten" onClick={() => onMoveTask(index, 1)} disabled={index === anchors.length - 1}>
                          <ChevronDown size={15} />
                        </IconButton>
                        <IconButton label="Fokus starten" onClick={() => onOpenFocus(task, index, undefined, taskMinutes)}>
                          <Play size={15} />
                        </IconButton>
                        {!isDone && (
                          <IconButton
                            label="In Kalender"
                            onClick={() => { void onExportToCalendar(task, taskMinutes) }}
                          >
                            <CalendarPlus size={15} />
                          </IconButton>
                        )}
                        <IconButton label="Bearbeiten" onClick={() => onEditTask(index, task)}>
                          <Pencil size={15} />
                        </IconButton>
                        <IconButton label="Löschen" onClick={() => onDeleteTask(index)} className="icon-button--danger">
                          <Trash2 size={15} />
                        </IconButton>
                      </div>
                    </div>
                  </SwipeableRow>
                )
              })}
            </div>
          )}
        </section>

        <aside className="plan-side">
          <section className="card calming-note">
            <div className="calming-note__art" aria-hidden="true"><span /></div>
            <h3>Weniger Reibung</h3>
            <p>Eine Aufgabe darf klein formuliert sein. „10 Minuten anfangen“ zählt. Standard-Fokus stellst du in den Einstellungen ein.</p>
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

  useEffect(() => {
    if (date > today) onDateChange(today)
  }, [date, today, onDateChange])

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
          <SectionTitle eyebrow="Stimmung" title="Wie geht es dir?" />
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
          <p className="field-hint" style={{ marginBottom: 8 }}>Bettzeit & Aufstehen</p>
          <div className="sleep-times">
            <label className="text-field">
              <span>Bett</span>
              <input
                type="time"
                value={entry.bedTime ?? ''}
                onChange={event => {
                  const bedTime = event.target.value || undefined
                  const wakeTime = entry.wakeTime
                  const hours = bedTime && wakeTime ? hoursBetweenTimes(bedTime, wakeTime) : null
                  onUpdate({
                    bedTime,
                    ...(hours !== null ? { sleepDuration: formatSleepHoursLabel(hours) } : {}),
                  })
                }}
              />
            </label>
            <label className="text-field">
              <span>Aufstehen</span>
              <input
                type="time"
                value={entry.wakeTime ?? ''}
                onChange={event => {
                  const wakeTime = event.target.value || undefined
                  const bedTime = entry.bedTime
                  const hours = bedTime && wakeTime ? hoursBetweenTimes(bedTime, wakeTime) : null
                  onUpdate({
                    wakeTime,
                    ...(hours !== null ? { sleepDuration: formatSleepHoursLabel(hours) } : {}),
                  })
                }}
              />
            </label>
          </div>

          <p className="field-hint" style={{ margin: '14px 0 8px' }}>Dauer</p>
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
                <SectionTitle
                  eyebrow="Werte"
                  title="Körper & Fokus"
                />
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
                    label="Protein"
                    value={entry.proteinGrams}
                    unit="g"
                    step={5}
                    min={0}
                    max={400}
                    placeholder="z. B. 140"
                    onChange={proteinGrams => onUpdate({
                      proteinGrams,
                      proteinReached: proteinGrams >= settings.proteinGoal,
                    })}
                  />
                  <NumberField
                    label="Kalorien"
                    value={entry.calories}
                    unit="kcal"
                    step={50}
                    min={0}
                    max={8000}
                    placeholder="z. B. 2400"
                    onChange={calories => onUpdate({
                      calories,
                      caloriesReached: calories >= settings.calorieGoal,
                    })}
                  />
                  <NumberField
                    label="Fett"
                    value={entry.fatGrams}
                    unit="g"
                    step={5}
                    min={0}
                    max={300}
                    placeholder="z. B. 70"
                    onChange={fatGrams => onUpdate({ fatGrams })}
                  />
                  <NumberField
                    label="Kohlenhydrate"
                    value={entry.carbsGrams}
                    unit="g"
                    step={5}
                    min={0}
                    max={800}
                    placeholder="z. B. 250"
                    onChange={carbsGrams => onUpdate({ carbsGrams })}
                  />
                  <NumberField
                    label="Ballaststoffe"
                    value={entry.fiberGrams}
                    unit="g"
                    step={1}
                    min={0}
                    max={100}
                    placeholder="z. B. 30"
                    onChange={fiberGrams => onUpdate({ fiberGrams })}
                  />
                  <NumberField
                    label="Wasser"
                    value={entry.waterLiters}
                    unit="L"
                    step={0.1}
                    min={0}
                    max={8}
                    placeholder="z. B. 2,5"
                    onChange={waterLiters => onUpdate({ waterLiters })}
                  />
                  <NumberField
                    label="Schritte"
                    value={entry.steps}
                    step={500}
                    min={0}
                    max={100000}
                    placeholder="z. B. 8000"
                    onChange={steps => onUpdate({ steps })}
                  />
                </div>
                <div className="macro-rings" aria-label="Tagesziele">
                  {[
                    { label: 'Protein', value: entry.proteinGrams, goal: settings.proteinGoal, unit: 'g' },
                    { label: 'Kalorien', value: entry.calories, goal: settings.calorieGoal, unit: 'kcal' },
                    { label: 'Fett', value: entry.fatGrams, goal: settings.fatGoal, unit: 'g' },
                    { label: 'KH', value: entry.carbsGrams, goal: settings.carbsGoal, unit: 'g' },
                    { label: 'Faser', value: entry.fiberGrams, goal: settings.fiberGoal, unit: 'g' },
                    { label: 'Wasser', value: entry.waterLiters, goal: 2.5, unit: 'L' },
                  ].map(ring => {
                    const percent = macroProgress(ring.value, ring.goal)
                    return (
                      <div className="macro-ring" key={ring.label}>
                        <strong>{percent}%</strong>
                        <small>{ring.label}</small>
                        <small>{ring.value || 0} / {ring.goal} {ring.unit}</small>
                      </div>
                    )
                  })}
                </div>
        </section>

        <section className="card checkin-card checkin-card--wide">
          <SectionTitle eyebrow="Abschluss" title="Eine kurze Notiz" />
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
            <button
              type="button"
              className="secondary-button"
              disabled={!journal.trim()}
              onClick={async () => {
                const result = await shareText({
                  title: 'Life OS Notiz',
                  text: journal.trim(),
                })
                if (result === 'shared') showToast('Share Sheet geöffnet — z. B. Notizen.')
                else if (result === 'copied') showToast('Notiz kopiert.')
                else showToast('Teilen nicht verfügbar.')
              }}
            >
              <Share2 size={17} /> Teilen
            </button>
            <button type="button" className="primary-button" onClick={saveJournal}>
              <Check size={17} /> Notiz speichern
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function WeightSparkline({
  points,
  insights,
}: {
  points: { date: string; kg: number }[]
  insights: ReturnType<typeof buildWeightInsights>
}) {
  if (points.length === 0) {
    return <p className="field-hint">Noch keine Gewichtseinträge — über Jo AI oder eine verbundene Waage erfassen.</p>
  }

  const latest = points[points.length - 1]
  const first = points[0]
  const formatDelta = (value: number | null) => {
    if (value === null) return null
    if (value === 0) return '±0'
    return `${value > 0 ? '+' : ''}${value}`
  }

  const chart = points.length >= 2 ? (() => {
    const width = 320
    const height = 72
    const pad = 6
    const kgs = points.map(point => point.kg)
    const min = Math.min(...kgs)
    const max = Math.max(...kgs)
    const range = Math.max(max - min, 0.2)
    const polyline = points
      .map((point, index) => {
        const x = pad + (index / (points.length - 1)) * (width - pad * 2)
        const y = height - pad - ((point.kg - min) / range) * (height - pad * 2)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
    return (
      <svg
        className="weight-spark__chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Gewicht von ${first.kg} auf ${latest.kg} kg`}
      >
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyline}
        />
      </svg>
    )
  })() : null

  return (
    <div className="weight-spark">
      <div className="weight-spark__meta">
        <strong>{latest.kg.toFixed(1)} kg</strong>
        <span>{insights.trendLabel} · {points.length} Einträge</span>
      </div>
      <div className="weight-spark__stats">
        <span>7T {formatDelta(insights.delta7) ?? '—'}</span>
        <span>30T {formatDelta(insights.delta30) ?? '—'}</span>
        <span>
          BMI {insights.bmi !== null ? `${insights.bmi}` : '—'}
          {insights.bmiLabel ? ` · ${insights.bmiLabel}` : ''}
        </span>
      </div>
      {chart}
      {insights.bmi === null && (
        <p className="field-hint">Körpergröße in den Einstellungen setzen für BMI.</p>
      )}
    </div>
  )
}

function MonthCalendar({
  today,
  selected,
  entries,
  scoreGoals,
  onSelect,
}: {
  today: string
  selected: string
  entries: DashboardEntry[]
  scoreGoals: { proteinGoal: number; activeHabits: string[] }
  onSelect: (date: string) => void
}) {
  const initial = fromDateKey(selected)
  const [year, setYear] = useState(initial.getFullYear())
  const [monthIndex, setMonthIndex] = useState(initial.getMonth())

  useEffect(() => {
    const date = fromDateKey(selected)
    setYear(date.getFullYear())
    setMonthIndex(date.getMonth())
  }, [selected])

  const entryDates = useMemo(() => new Set(entries.map(entry => entry.date)), [entries])
  const scoresByDate = useMemo(() => {
    const map: Record<string, number> = {}
    for (const entry of entries) {
      map[entry.date] = Math.round(calculateScore(entry, scoreGoals))
    }
    return map
  }, [entries, scoreGoals])

  const cells = buildMonthGrid({ year, monthIndex, today, selected, entryDates, scoresByDate })

  const shiftMonth = (delta: number) => {
    const next = new Date(year, monthIndex + delta, 1)
    setYear(next.getFullYear())
    setMonthIndex(next.getMonth())
  }

  return (
    <section className="card calendar-card">
      <div className="calendar-card__head">
        <SectionTitle eyebrow="Kalender" title={monthLabel(year, monthIndex)} />
        <div className="calendar-card__nav">
          <IconButton label="Vorheriger Monat" onClick={() => shiftMonth(-1)}>
            <ChevronLeft size={16} />
          </IconButton>
          <IconButton label="Nächster Monat" onClick={() => shiftMonth(1)}>
            <ChevronRight size={16} />
          </IconButton>
        </div>
      </div>
      <div className="month-calendar__weekdays" aria-hidden="true">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(label => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="month-calendar" role="grid" aria-label="Monatskalender">
        {cells.map(cell => (
          <button
            type="button"
            key={cell.date}
            className={[
              'month-calendar__cell',
              cell.inMonth ? '' : 'is-outside',
              cell.isToday ? 'is-today' : '',
              cell.isSelected ? 'is-selected' : '',
              cell.hasEntry ? 'has-entry' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onSelect(cell.date)}
            aria-pressed={cell.isSelected}
            aria-label={`${formatLongDate(cell.date)}${cell.hasEntry ? `, Score ${cell.score}` : ''}`}
          >
            <strong>{fromDateKey(cell.date).getDate()}</strong>
            {cell.hasEntry && <span className="month-calendar__dot" />}
          </button>
        ))}
      </div>
      <p className="field-hint">Tippe einen Tag an, um ihn im Tageskern zu öffnen.</p>
    </section>
  )
}

function ProgressView({
  entries,
  today,
  selectedDate,
  scoreGoals,
  heightCm,
  labClassName = '',
  onSelectDate,
}: {
  entries: DashboardEntry[]
  today: string
  selectedDate: string
  scoreGoals: { proteinGoal: number; activeHabits: string[] }
  heightCm: number
  labClassName?: string
  onSelectDate: (date: string) => void
}) {
  const [habitDetail, setHabitDetail] = useState<{ key: HabitKey; label: string } | null>(null)
  const moodLine = moodHabitLine(entries, today, scoreGoals.activeHabits)
  const lastSeven = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6)).map(date => {
    const entry = entries.find(item => item.date === date) ?? createDefaultEntry(date)
    return { date, score: clampNumber(calculateScore(entry, scoreGoals), 0, 100), entry }
  })
  const scoredSeven = lastSeven.filter(item => !item.entry.dayShield)
  const average = scoredSeven.length === 0
    ? 0
    : Math.round(scoredSeven.reduce((sum, item) => sum + item.score, 0) / scoredSeven.length)
  const best = Math.max(...lastSeven.map(item => item.score))
  const previousSeven = Array.from({ length: 7 }, (_, index) => addDays(today, index - 13)).map(date => {
    const entry = entries.find(item => item.date === date) ?? createDefaultEntry(date)
    return clampNumber(calculateScore(entry, scoreGoals), 0, 100)
  })
  const previousAverage = Math.round(previousSeven.reduce((sum, value) => sum + value, 0) / previousSeven.length)
  const weekDelta = average - previousAverage
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
  const energyLabel = (value: DashboardEntry['energyLevel']) => (
    value === 'low' ? 'Niedrig' : value === 'okay' ? 'Okay' : value === 'high' ? 'Gut' : '—'
  )
  const breakdown = getScoreBreakdown(todayEntry, scoreGoals)
  const heatmap = buildYearHeatmap(entries, today, e => (
    e.dayShield ? 20 : calculateScore(e, scoreGoals)
  ))
  const review = buildWeeklyReview(entries, today, scoreGoals)
  const weightSeries = buildWeightSeries(entries, today, 30)
  const weightInsights = buildWeightInsights(entries, today, heightCm)
  const sleepAvg = averageSleepHours(entries, today, 7)
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
    <div className={`view-stack lab-page ${labClassName}`.trim()}>
      <section className="page-intro lab-intro">
        <div>
          <span className="eyebrow">Lab</span>
          <h2>Muster sehen. Klarer steuern.</h2>
          <p>Signale, Trends und Plan an einem Ort — ohne doppelte Eingaben.</p>
        </div>
      </section>

      <section className="lab-status" aria-labelledby="lab-status-title">
        <div className="lab-status__head">
          <div>
            <span className="eyebrow">Heute</span>
            <h3 id="lab-status-title">Deine Signale</h3>
          </div>
          <span className="lab-status__date">{formatShortDate(today)}</span>
        </div>
        <div className="lab-status__grid">
          <div><span>Stimmung</span><strong>{todayEntry.mood || '—'}</strong></div>
          <div><span>Erholung</span><strong>{todayEntry.sleepQuality || '—'}</strong></div>
          <div><span>Morgenenergie</span><strong>{energyLabel(todayEntry.energyLevel)}</strong></div>
          <div><span>Abendenergie</span><strong>{energyLabel(todayEntry.eveningGate?.energyLevel)}</strong></div>
        </div>
      </section>

      <div className="kpi-grid">
        <div className="kpi-card kpi-card--trend">
          <span>Wochenschnitt</span>
          <div className="kpi-card__value-row">
            <strong>{average}%</strong>
            {weekDelta !== 0 && (
              <span className={weekDelta > 0 ? 'trend-chip trend-chip--up' : 'trend-chip trend-chip--down'}>
                {weekDelta > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {Math.abs(weekDelta)}%
              </span>
            )}
          </div>
          <div className="kpi-progress" aria-hidden="true"><span style={{ width: `${average}%` }} /></div>
          <small>vs. Vorwoche {previousAverage}%</small>
        </div>
        <div className="kpi-card">
          <span>Bester Tag</span>
          <strong>{best}%</strong>
          <div className="kpi-progress" aria-hidden="true"><span style={{ width: `${best}%` }} /></div>
          <small>diese Woche</small>
        </div>
        <div className="kpi-card"><span>Rhythmus</span><strong>{xp.streakDays}</strong><small>{plural(xp.streakDays, 'Tag', 'Tage')} · {levelName(xp.level)}</small></div>
      </div>

      <MonthCalendar
        today={today}
        selected={selectedDate}
        entries={entries}
        scoreGoals={scoreGoals}
        onSelect={onSelectDate}
      />

      <section className={`card weekly-review-card${review.isReviewDay ? ' is-review-day' : ''}`}>
        <SectionTitle
          eyebrow={review.isReviewDay ? 'Ritual · So / Mo' : 'Woche'}
          title="Weekly Review"
        />
        <p className="field-hint" style={{ marginTop: -8, marginBottom: 12 }}>
          {review.weekLabel} · Schnitt {review.averageScore}%
          {review.bestScore > 0 ? ` · Best ${review.bestDay} (${review.bestScore}%)` : ''}
        </p>
        <div className="weekly-review-grid">
          <div className="weekly-review-block">
            <span className="eyebrow">Win</span>
            <p>{review.win}</p>
          </div>
          <div className="weekly-review-block">
            <span className="eyebrow">Behalten</span>
            <p>{review.keep}</p>
          </div>
        </div>
        <div className="weekly-review-anchors">
          <span className="eyebrow">Nächste Woche</span>
          <ul>
            {review.nextAnchors.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card insight-card">
        <SectionTitle eyebrow="Muster" title="Was die Woche dir sagt" />
        <div className="insight-list">
          {moodLine && (
            <div className="insight-row">
              <strong>Stimmung × Habit</strong>
              <p>{moodLine.text}</p>
            </div>
          )}
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
              <button
                type="button"
                className="strength-row strength-row--button"
                key={item.key}
                onClick={() => setHabitDetail({ key: item.key, label: item.label })}
              >
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
              </button>
            )
          })}
        </div>
      </section>

      <section className="card weight-spark-card">
        <SectionTitle eyebrow="Körper" title="Gewicht · 30 Tage" />
        <WeightSparkline points={weightSeries} insights={weightInsights} />
      </section>

      <section className="card">
        <SectionTitle eyebrow="Schlaf" title="Wochenrhythmus" />
        <div className="sleep-week-summary">
          <div>
            <strong>{sleepAvg !== null ? `${sleepAvg}h` : '—'}</strong>
            <span>Schnitt · 7 Tage</span>
          </div>
          <p className="field-hint">
            Bettzeit und Aufstehen werden im Morning Gate zusammengeführt.
          </p>
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
      {habitDetail && (
        <HabitDetailSheet
          habitKey={habitDetail.key}
          label={habitDetail.label}
          entries={entries}
          today={today}
          onClose={() => setHabitDetail(null)}
        />
      )}
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
  layout,
  medisRemindersEnabled,
  onOpenSettings,
  onOpenProject,
  onOpenGoal,
  showToast,
  section,
  onSectionChange,
  onQuickAction,
}: {
  dashboard: DashboardPlusState
  onChange: Dispatch<SetStateAction<DashboardPlusState>>
  onBackToToday: () => void
  today: string
  liveOverview: ReturnType<typeof deriveLaborOverview>
  liveStats: ReturnType<typeof deriveLaborStats>
  layout: DashboardPlusLayout
  medisRemindersEnabled: boolean
  onOpenSettings: () => void
  onOpenProject?: (id: string) => void
  onOpenGoal?: (id: string) => void
  showToast: (message: string) => void
  section: LabDataSection
  onSectionChange: (section: LabDataSection) => void
  onQuickAction: (action: LabDataQuickAction) => void
}) {
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const activeSection = section

  const tabsToRender = useMemo(() => {
    const visible = layout.order
      .filter(id => !layout.hidden.includes(id))
      .map(id => DASHBOARD_PLUS_TABS.find(tab => tab.id === id))
      .filter((tab): tab is (typeof DASHBOARD_PLUS_TABS)[number] => Boolean(tab))
    return visible.length > 0 ? visible : [...DASHBOARD_PLUS_TABS]
  }, [layout])

  const currentSection = tabsToRender.some(tab => tab.id === activeSection)
    ? activeSection
    : tabsToRender[0].id

  useEffect(() => {
    if (tabsToRender.some(tab => tab.id === section)) return
    onSectionChange(tabsToRender[0].id)
  }, [section, tabsToRender, onSectionChange])

  const setActiveSection = (next: DashboardPlusSection) => {
    onSectionChange(next)
  }
  const [activeBoardId, setActiveBoardId] = useState(dashboard.boards[0]?.id ?? 'personal')
  const [activeListId, setActiveListId] = useState(dashboard.lists[0]?.id ?? 'pack')
  const [searchQuery, setSearchQuery] = useState('')
  const [todoAreaFilter, setTodoAreaFilter] = useState<AreaFilter>('all')
  const [groupTodosByArea, setGroupTodosByArea] = useState(false)
  const [goalAreaFilter, setGoalAreaFilter] = useState<AreaFilter>('all')
  const [taskMenu, setTaskMenu] = useState<{
    x: number
    y: number
    kind: 'focus' | 'board'
    index: number
    title: string
  } | null>(null)
  const openFocusTodos = dashboard.focusTodos.filter(task => !task.done).length
  const lowStockCount = dashboard.supplements.filter(item => item.dailyUse > 0 && item.stock <= item.dailyUse * 7).length
  const hints = smartLaborHints({
    openTodos: openFocusTodos,
    lowStockCount,
  })
  const searchHits = useMemo(() => searchLabor({
    query: searchQuery,
    focusTodos: dashboard.focusTodos,
    boards: dashboard.boards,
    shopping: dashboard.shopping.items,
    lists: dashboard.lists,
    supplements: dashboard.supplements,
    medications: dashboard.medications,
    goals: dashboard.goals,
    bills: [...dashboard.finances.recurring, ...dashboard.finances.openBills],
  }), [searchQuery, dashboard])
  const laborSearching = searchQuery.trim().length > 0

  useEffect(() => {
    if (!dashboard.boards.some(board => board.id === activeBoardId)) {
      setActiveBoardId(dashboard.boards[0]?.id ?? 'personal')
    }
  }, [activeBoardId, dashboard.boards])

  useEffect(() => {
    if (!dashboard.lists.some(list => list.id === activeListId)) {
      setActiveListId(dashboard.lists[0]?.id ?? 'pack')
    }
  }, [activeListId, dashboard.lists])

  const activeBoard = dashboard.boards.find(board => board.id === activeBoardId) ?? dashboard.boards[0]
  const activeList = dashboard.lists.find(list => list.id === activeListId) ?? dashboard.lists[0]
  const financeSummary = useMemo(() => deriveFinanceSummary(dashboard.finances), [dashboard.finances])
  const formatMoney = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 2, minimumFractionDigits: 0 })

  const updateFocusTask = (index: number, patch: Partial<DashboardPlusTask>) => {
    onChange(current => ({
      ...current,
      focusTodos: current.focusTodos.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }))
  }

  const removeFocusTask = (index: number) => {
    onChange(current => ({
      ...current,
      focusTodos: current.focusTodos.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const moveFocusToBoard = (index: number) => {
    onChange(current => {
      const task = current.focusTodos[index]
      if (!task) return current
      return {
        ...current,
        focusTodos: current.focusTodos.filter((_, itemIndex) => itemIndex !== index),
        boards: syncBoardCounts(current.boards.map(board => (
          board.id === activeBoardId
            ? { ...board, tasks: [...board.tasks, task] }
            : board
        ))),
      }
    })
  }

  const moveBoardToFocus = (boardId: string, index: number) => {
    onChange(current => {
      const board = current.boards.find(item => item.id === boardId)
      const task = board?.tasks[index]
      if (!task) return current
      return {
        ...current,
        focusTodos: [...current.focusTodos, task],
        boards: syncBoardCounts(current.boards.map(item => (
          item.id === boardId
            ? { ...item, tasks: item.tasks.filter((_, itemIndex) => itemIndex !== index) }
            : item
        ))),
      }
    })
  }

  const updateSupplement = (index: number, patch: Partial<DashboardPlusSupplement>) => {
    onChange(current => ({
      ...current,
      supplements: current.supplements.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
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

  const removeGoal = (index: number) => {
    onChange(current => ({
      ...current,
      goals: current.goals.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const updateBoard = (boardId: string, patch: Partial<DashboardPlusBoard>) => {
    onChange(current => ({
      ...current,
      boards: current.boards.map(board => (board.id === boardId ? { ...board, ...patch } : board)),
    }))
  }

  const updateBoardTask = (boardId: string, taskIndex: number, patch: Partial<DashboardPlusTask>) => {
    onChange(current => ({
      ...current,
      boards: syncBoardCounts(current.boards.map(board => (
        board.id === boardId
          ? { ...board, tasks: board.tasks.map((task, itemIndex) => (itemIndex === taskIndex ? { ...task, ...patch } : task)) }
          : board
      ))),
    }))
  }

  const removeBoardTask = (boardId: string, taskIndex: number) => {
    onChange(current => ({
      ...current,
      boards: syncBoardCounts(current.boards.map(board => (
        board.id === boardId
          ? { ...board, tasks: board.tasks.filter((_, itemIndex) => itemIndex !== taskIndex) }
          : board
      ))),
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

  const addSupplementToShopping = (item: DashboardPlusSupplement) => {
    const name = item.name.trim() || 'Nachbestellen'
    let added = true
    onChange(current => {
      const exists = current.shopping.items.some(row =>
        !row.done && row.name.trim().toLowerCase() === name.toLowerCase(),
      )
      if (exists) {
        added = false
        return current
      }
      return {
        ...current,
        shopping: {
          ...current.shopping,
          items: [
            ...current.shopping.items,
            {
              id: crypto.randomUUID(),
              icon: 'pill',
              name,
              note: 'Aus Beständen · knapp',
              price: 0,
              done: false,
              lowStock: true,
            },
          ],
        },
      }
    })
    setActiveSection('shopping')
    showToast(added ? `${name} auf die Kaufliste.` : `${name} ist schon auf der Kaufliste.`)
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

  const updateList = (listId: string, patch: Partial<Pick<DashboardPlusList, 'title' | 'kind'>>) => {
    onChange(current => ({
      ...current,
      lists: current.lists.map(list => (list.id === listId ? { ...list, ...patch } : list)),
    }))
  }

  const removeList = (listId: string) => {
    onChange(current => ({
      ...current,
      lists: current.lists.filter(list => list.id !== listId),
    }))
  }

  const updateListItem = (listId: string, index: number, patch: Partial<DashboardPlusListItem>) => {
    onChange(current => ({
      ...current,
      lists: current.lists.map(list => (
        list.id === listId
          ? { ...list, items: list.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) }
          : list
      )),
    }))
  }

  const addListItem = (listId: string) => {
    onChange(current => ({
      ...current,
      lists: current.lists.map(list => (
        list.id === listId
          ? { ...list, items: [...list.items, { id: crypto.randomUUID(), title: 'Neuer Eintrag', note: '', done: false }] }
          : list
      )),
    }))
  }

  const removeListItem = (listId: string, index: number) => {
    onChange(current => ({
      ...current,
      lists: current.lists.map(list => (
        list.id === listId
          ? { ...list, items: list.items.filter((_, itemIndex) => itemIndex !== index) }
          : list
      )),
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

  const removeRecurringBill = (index: number) => {
    onChange(current => ({
      ...current,
      finances: {
        ...current.finances,
        recurring: current.finances.recurring.filter((_, billIndex) => billIndex !== index),
      },
    }))
  }

  const removeOpenBill = (index: number) => {
    onChange(current => ({
      ...current,
      finances: {
        ...current.finances,
        openBills: current.finances.openBills.filter((_, billIndex) => billIndex !== index),
      },
    }))
  }

  const renderBillRow = (
    bill: DashboardPlusBill,
    index: number,
    onPatch: (index: number, patch: Partial<DashboardPlusBill>) => void,
    onRemove: (index: number) => void,
  ) => (
    <div
      className={`finance-bill-row is-${bill.status}`}
      key={bill.id}
    >
      <span className="finance-bill-row__dot" style={{ background: bill.color }} aria-hidden="true" />
      <div className="finance-bill-row__main">
        <input
          className="dashboard-plus-input dashboard-plus-input--title dashboard-plus-input--ghost"
          value={bill.name}
          onChange={event => onPatch(index, { name: event.target.value })}
          aria-label="Name"
          placeholder="Name"
        />
        <div className="finance-bill-row__meta">
          <input
            className="dashboard-plus-input dashboard-plus-input--ghost finance-bill-row__due"
            type={parseBillDueDate(bill.due) ? 'date' : 'text'}
            value={bill.due}
            onChange={event => onPatch(index, { due: event.target.value })}
            aria-label="Fällig"
            placeholder="Fällig"
          />
          <input
            className="dashboard-plus-input dashboard-plus-input--ghost"
            value={bill.subtitle}
            onChange={event => onPatch(index, { subtitle: event.target.value })}
            aria-label="Notiz"
            placeholder="Notiz"
          />
        </div>
      </div>
      <label className="finance-bill-row__amount">
        <span aria-hidden="true">€</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={bill.amount || ''}
          onChange={event => onPatch(index, { amount: Number(event.target.value) || 0 })}
          aria-label="Betrag"
          placeholder="0"
        />
      </label>
      <button
        type="button"
        className={`finance-bill-row__status is-${bill.status}`}
        onClick={() => onPatch(index, { status: cycleBillStatus(bill.status) })}
        aria-label={`Status: ${billStatusLabel(bill.status)}`}
      >
        {billStatusLabel(bill.status)}
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={() => onRemove(index)}
        aria-label="Löschen"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )

  const sectionContextCounts: Partial<Record<LabDataSection, string | number>> = {
    todos: `${openFocusTodos} offen`,
    shopping: `${dashboard.shopping.items.filter(item => !item.done).length} offen`,
    medications: `${dashboard.medications.filter(item => !isMedicationTakenToday(item, today)).length} offen`,
    stock: lowStockCount > 0 ? `${lowStockCount} niedrig` : 'ok',
    goals: `${dashboard.goals.length}`,
    lists: `${dashboard.lists.length}`,
    finance: financeSummary.openCount > 0 ? `${financeSummary.openCount} offen` : 'ok',
    stats: 'Woche',
    overview: liveOverview.dateLabel,
  }

  return (
    <div
      className="view-stack dashboard-plus-view"
      ref={scrollRef}
      onScroll={event => {
        setHeaderCollapsed(event.currentTarget.scrollTop > 28)
      }}
    >
      <LabDataMobileChrome
        section={currentSection}
        contextLine={contextLineForSection(currentSection, sectionContextCounts)}
        onSectionChange={setActiveSection}
        searchOpen={mobileSearchOpen}
        onSearchToggle={() => {
          setMobileSearchOpen(current => {
            const next = !current
            if (!next) setSearchQuery('')
            return next
          })
        }}
        onOpenSettings={onOpenSettings}
        onQuickAction={onQuickAction}
        collapsed={headerCollapsed}
      />
      <div className="labor-shell">
        <nav className="labor-nav labor-nav--desktop" role="tablist" aria-label="Lab-Daten">
          {tabsToRender.map(tab => {
            const Icon = tab.icon
            const active = currentSection === tab.id
            return (
              <button
                type="button"
                key={tab.id}
                id={`labor-cat-${tab.id}`}
                role="tab"
                aria-selected={active}
                className={active ? 'labor-nav-item is-active' : 'labor-nav-item'}
                onClick={() => setActiveSection(tab.id)}
              >
                <Icon size={16} aria-hidden="true" />
                <span>
                  <strong>{tab.label}</strong>
                  <small>{tab.hint}</small>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="labor-body" role="tabpanel" aria-labelledby={`labor-cat-${currentSection}`}>
          <div className={mobileSearchOpen ? 'labor-toolbar is-search-open' : 'labor-toolbar'}>
            <label className="labor-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Suche in Todos, Listen, Medis…"
                aria-label="Lab durchsuchen"
              />
            </label>
            <div className="labor-toolbar__actions">
              <button type="button" className="secondary-button" onClick={onBackToToday}>
                <ChevronLeft size={16} /> Tageskern
              </button>
              <button type="button" className="secondary-button" onClick={onOpenSettings}>
                <LayoutGrid size={16} /> Reiter
              </button>
            </div>
          </div>

          {searchQuery.trim() && (
            <section className="card labor-search-results">
              <SectionTitle eyebrow="Suche" title={`${searchHits.length} Treffer`} />
              {searchHits.length === 0 ? (
                <p className="field-hint">Nichts gefunden.</p>
              ) : (
                <div className="labor-search-list">
                  {searchHits.map(hit => (
                    <button
                      type="button"
                      key={`${hit.section}-${hit.id}`}
                      className="labor-search-hit"
                      onClick={() => {
                        setActiveSection(hit.section)
                        if (hit.boardId) setActiveBoardId(hit.boardId)
                        if (hit.listId) setActiveListId(hit.listId)
                        setSearchQuery('')
                      }}
                    >
                      <strong>{hit.title}</strong>
                      <span>{hit.source}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

      {!laborSearching && currentSection === 'overview' && (
        <section className="card dashboard-plus-hero">
          <div className="dashboard-plus-hero__meta">
            <div>
              <span className="eyebrow">Heute</span>
              <h2>{liveOverview.dateLabel}</h2>
            </div>
            <ProgressRing value={liveOverview.score} size={86} />
          </div>
          <div className="dashboard-plus-hero__stats">
            <div className="kpi-card dashboard-plus-metric">
              <span>Habits</span>
              <strong>{liveOverview.habits}/{liveOverview.habitsTotal || 0}</strong>
            </div>
            <div className="kpi-card dashboard-plus-metric">
              <span>Anker</span>
              <strong>{liveOverview.todos}/{liveOverview.todosTotal || 0}</strong>
            </div>
            <div className="kpi-card dashboard-plus-metric">
              <span>Boards</span>
              <strong>{liveOverview.projects}</strong>
            </div>
          </div>
          {hints.length > 0 && (
            <div className="labor-hints">
              {hints.map(hint => (
                <p key={hint}>{hint}</p>
              ))}
            </div>
          )}
        </section>
      )}

      {!laborSearching && currentSection === 'todos' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle
            eyebrow="Todos"
            title="Fokus"
            action={<button type="button" className="small-button labor-inline-create" onClick={() => onQuickAction('capture-task')}><Plus size={14} /> Aufgabe</button>}
          />
          <LifeAreaFilter value={todoAreaFilter} onChange={setTodoAreaFilter} />
          <label className="life-area-group-toggle">
            <input type="checkbox" checked={groupTodosByArea} onChange={event => setGroupTodosByArea(event.target.checked)} />
            <span>Nach Bereich gruppieren</span>
          </label>
          <div className="editable-task-list">
            {(() => {
              const rows = dashboard.focusTodos
                .map((task, index) => ({ task, index }))
                .filter(({ task }) => matchesAreaFilter(resolveDashboardTaskArea(task, undefined, dashboard.goals), todoAreaFilter))
              const groups = groupTodosByArea
                ? groupByResolvedArea(rows, row => resolveDashboardTaskArea(row.task, undefined, dashboard.goals).key)
                : [{ key: 'all' as const, label: '', items: rows }]
              return groups.map(group => (
                <div key={group.key} className="life-area-group">
                  {group.label && <span className="eyebrow">{group.label}</span>}
                  {group.items.map(({ task, index }) => (
              <SwipeableRow
                key={task.id}
                leftLabel={task.done ? 'Offen' : 'Erledigt'}
                rightLabel="Zum Board"
                onSwipeLeft={() => updateFocusTask(index, { done: !task.done })}
                onSwipeRight={() => moveFocusToBoard(index)}
                onLongPress={point => setTaskMenu({ x: point.x, y: point.y, kind: 'focus', index, title: task.title })}
              >
                <div className={task.done ? 'editable-task is-done' : 'editable-task'}>
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
                      <LifeAreaSelect compact value={task.lifeArea} onChange={lifeArea => updateFocusTask(index, { lifeArea })} />
                    </div>
                  </div>
                  <div className="editable-task__actions">
                    <PriorityBadge priority={task.priority} onCycle={() => updateFocusTask(index, { priority: nextPriority(task.priority) })} />
                    <button type="button" className="icon-button" onClick={() => removeFocusTask(index)} aria-label="Löschen">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </SwipeableRow>
                  ))}
                </div>
              ))
            })()}
          </div>
        </section>

        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle
            eyebrow="Projekte"
            title="Boards"
            action={activeBoard && onOpenProject ? (
              <button type="button" className="small-button" onClick={() => onOpenProject(activeBoard.id)}>Öffnen</button>
            ) : undefined}
          />
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
                  <LifeAreaMark
                    area={resolveLifeArea({
                      explicit: activeBoard.lifeArea,
                      goal: dashboard.goals.find(item => item.id === activeBoard.goalId),
                    }).key}
                    inherited={!activeBoard.lifeArea && Boolean(dashboard.goals.find(item => item.id === activeBoard.goalId)?.lifeArea)}
                  />
                </div>
                <div className="prog-num">{percent}%</div>
              </div>
              <LifeAreaSelect
                compact
                value={activeBoard.lifeArea}
                inherited={dashboard.goals.find(item => item.id === activeBoard.goalId)?.lifeArea}
                onChange={lifeArea => updateBoard(activeBoard.id, { lifeArea })}
              />
              <div className="editable-task-list">
                {activeBoard.tasks
                  .map((task, index) => ({ task, index }))
                  .filter(({ task }) => matchesAreaFilter(resolveDashboardTaskArea(task, activeBoard, dashboard.goals), todoAreaFilter))
                  .map(({ task, index }) => {
                    const resolved = resolveDashboardTaskArea(task, activeBoard, dashboard.goals)
                    return (
                  <SwipeableRow
                    key={task.id}
                    leftLabel={task.done ? 'Offen' : 'Erledigt'}
                    rightLabel="Zum Fokus"
                    onSwipeLeft={() => updateBoardTask(activeBoard.id, index, { done: !task.done })}
                    onSwipeRight={() => moveBoardToFocus(activeBoard.id, index)}
                    onLongPress={point => setTaskMenu({ x: point.x, y: point.y, kind: 'board', index, title: task.title })}
                  >
                    <div className={task.done ? 'editable-task is-done' : 'editable-task'}>
                      <button type="button" className="task-check" onClick={() => updateBoardTask(activeBoard.id, index, { done: !task.done })} aria-pressed={task.done}>
                        {task.done ? <Check size={17} /> : <Circle size={17} />}
                      </button>
                      <div className="editable-task__content dashboard-plus-editable-content">
                        <input className="dashboard-plus-input dashboard-plus-input--title" value={task.title} onChange={event => updateBoardTask(activeBoard.id, index, { title: event.target.value })} aria-label="Board Aufgabe" />
                        <div className="dashboard-plus-inline-row">
                          <input className="dashboard-plus-input" value={task.tag} onChange={event => updateBoardTask(activeBoard.id, index, { tag: event.target.value })} placeholder="Tag" />
                          <input className="dashboard-plus-input" value={task.time} onChange={event => updateBoardTask(activeBoard.id, index, { time: event.target.value })} placeholder="Zeit" />
                          <LifeAreaSelect
                            compact
                            value={task.lifeArea}
                            inherited={resolved.source === 'explicit' ? undefined : resolved.key}
                            onChange={lifeArea => updateBoardTask(activeBoard.id, index, { lifeArea })}
                          />
                        </div>
                      </div>
                      <div className="editable-task__actions">
                        <PriorityBadge priority={task.priority} onCycle={() => updateBoardTask(activeBoard.id, index, { priority: nextPriority(task.priority) })} />
                        <button type="button" className="icon-button" onClick={() => removeBoardTask(activeBoard.id, index)} aria-label="Löschen">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </SwipeableRow>
                    )
                  })}
              </div>
              <button type="button" className="secondary-button secondary-button--full labor-inline-create" onClick={() => onQuickAction('capture-task')}>
                <Plus size={15} /> Aufgabe hinzufügen
              </button>
            </>
            )
          })()}
        </section>
      </div>
      )}

      {!laborSearching && currentSection === 'lists' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle
            eyebrow="Listen"
            title={activeList?.title || 'Listen'}
            action={(
              <button type="button" className="small-button" onClick={() => onQuickAction('capture-list')}>
                <Plus size={14} /> Liste
              </button>
            )}
          />
          <div className="project-tabs dashboard-plus-tabs">
            {dashboard.lists.map(list => (
              <button
                type="button"
                key={list.id}
                className={list.id === activeListId ? 'project-tab active' : 'project-tab'}
                onClick={() => setActiveListId(list.id)}
              >
                {list.title} <span className="tab-count">{list.items.filter(item => !item.done).length}</span>
              </button>
            ))}
          </div>
          {activeList && (
            <>
              <div className="dashboard-plus-inline-row" style={{ marginBottom: 12 }}>
                <input
                  className="dashboard-plus-input dashboard-plus-input--title"
                  value={activeList.title}
                  onChange={event => updateList(activeList.id, { title: event.target.value })}
                  aria-label="Listenname"
                />
                <select
                  className="dashboard-plus-input"
                  value={activeList.kind}
                  onChange={event => updateList(activeList.id, { kind: event.target.value as DashboardPlusListKind })}
                  aria-label="Listentyp"
                >
                  {(Object.keys(LIST_KIND_LABELS) as DashboardPlusListKind[]).map(kind => (
                    <option key={kind} value={kind}>{LIST_KIND_LABELS[kind]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => removeList(activeList.id)}
                  aria-label="Liste löschen"
                  disabled={dashboard.lists.length <= 1}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="editable-task-list">
                {activeList.items.map((item, index) => (
                  <SwipeableRow
                    key={item.id}
                    leftLabel={item.done ? 'Offen' : 'Erledigt'}
                    onSwipeLeft={() => updateListItem(activeList.id, index, { done: !item.done })}
                  >
                    <div className={item.done ? 'editable-task is-done' : 'editable-task'}>
                      <button
                        type="button"
                        className="task-check"
                        onClick={() => updateListItem(activeList.id, index, { done: !item.done })}
                        aria-pressed={item.done}
                      >
                        {item.done ? <Check size={17} /> : <Circle size={17} />}
                      </button>
                      <div className="editable-task__content dashboard-plus-editable-content">
                        <input
                          className="dashboard-plus-input dashboard-plus-input--title"
                          value={item.title}
                          onChange={event => updateListItem(activeList.id, index, { title: event.target.value })}
                          aria-label="Listeneintrag"
                        />
                        <input
                          className="dashboard-plus-input"
                          value={item.note}
                          onChange={event => updateListItem(activeList.id, index, { note: event.target.value })}
                          placeholder="Notiz"
                          aria-label="Notiz"
                        />
                      </div>
                      <div className="editable-task__actions">
                        <button type="button" className="icon-button" onClick={() => removeListItem(activeList.id, index)} aria-label="Löschen">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </SwipeableRow>
                ))}
              </div>
              <button type="button" className="secondary-button secondary-button--full" onClick={() => addListItem(activeList.id)}>
                <Plus size={15} /> Eintrag hinzufügen
              </button>
            </>
          )}
        </section>
      </div>
      )}

      {!laborSearching && currentSection === 'stock' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle eyebrow="Supplements" title="Bestände" action={<button type="button" className="small-button" onClick={() => onQuickAction('capture-stock')}><Plus size={14} /> Produkt</button>} />
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
                    <>
                      <p className="dashboard-plus-supp-hint">
                        {daysLeft! <= 0
                          ? 'Bestand leer — nachbestellen'
                          : `Noch ca. ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'} · nachbestellen`}
                      </p>
                      <button
                        type="button"
                        className="secondary-button secondary-button--full"
                        onClick={() => addSupplementToShopping(item)}
                      >
                        <ShoppingBag size={15} /> Auf Kaufliste
                      </button>
                    </>
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

      {!laborSearching && currentSection === 'medications' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle eyebrow="Gesundheit" title="Medikamente" action={<button type="button" className="small-button" onClick={() => onQuickAction('capture-med-log')}><Plus size={14} /> Einnahme</button>} />
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
                  <input className="dashboard-plus-input" value={item.time} onChange={event => updateMedication(index, { time: event.target.value })} placeholder="Uhrzeit z. B. 08:00" aria-label="Uhrzeit" />
                </div>
                <label className={`med-remind-toggle${!medisRemindersEnabled ? ' is-muted' : ''}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(item.remind)}
                    disabled={!medisRemindersEnabled}
                    onChange={event => updateMedication(index, { remind: event.target.checked })}
                  />
                  <span>
                    {medisRemindersEnabled
                      ? 'Erinnern zur Uhrzeit'
                      : 'Erinnern (in Einstellungen anschalten)'}
                  </span>
                </label>
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

      {!laborSearching && currentSection === 'goals' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle eyebrow="Planung" title="Ziele" action={<button type="button" className="small-button" onClick={() => onQuickAction('capture-goal')}><Plus size={14} /> Ziel</button>} />
          <LifeAreaFilter value={goalAreaFilter} onChange={setGoalAreaFilter} />
          <div className="dashboard-plus-supplements">
            {dashboard.goals
              .map((goal, index) => ({ goal, index }))
              .filter(({ goal }) => matchesAreaFilter(resolveLifeArea({ explicit: goal.lifeArea }), goalAreaFilter))
              .map(({ goal, index }) => {
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
                    <LifeAreaSelect compact value={goal.lifeArea} onChange={lifeArea => updateGoal(index, { lifeArea })} />
                  </div>
                  <div className="mini-progress" aria-hidden="true">
                    <span style={{ width: `${goal.percent}%` }} />
                  </div>
                  <div className="dashboard-plus-goal-eta">{etaLabel} · {goal.percent}%</div>
                  {onOpenGoal && (
                    <button type="button" className="secondary-button secondary-button--full" onClick={() => onOpenGoal(goal.id)}>
                      Ziel öffnen
                    </button>
                  )}
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

      {!laborSearching && currentSection === 'shopping' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle
            eyebrow="Kaufliste"
            title="Offen"
            action={<button type="button" className="small-button" onClick={() => onQuickAction('capture-shopping')}><Plus size={14} /> Artikel</button>}
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

      {!laborSearching && currentSection === 'stats' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card">
          <SectionTitle eyebrow="Stats" title="Diese Woche" />
          <div className="labor-live-stats">
            <div className="kpi-card"><span>Schnitt</span><strong>{liveStats.average}%</strong></div>
            <div className="kpi-card"><span>Best</span><strong>{liveStats.best}%</strong></div>
            <div className="kpi-card"><span>Rhythmus</span><strong>{liveStats.rhythm}</strong><small>Tage</small></div>
            <div className="kpi-card">
              <span>Gewicht</span>
              <strong>{liveStats.weight ? liveStats.weight.toFixed(1) : '—'}</strong>
              <small>
                {liveStats.weightDelta7 === null
                  ? 'kg'
                  : `kg · ${liveStats.weightDelta7 > 0 ? '+' : ''}${liveStats.weightDelta7} 7T`}
              </small>
            </div>
            <div className="kpi-card">
              <span>Schlaf</span>
              <strong>{liveStats.avgSleepHours !== null ? `${liveStats.avgSleepHours}h` : '—'}</strong>
              <small>7-Tage-Schnitt</small>
            </div>
          </div>
          <div className="labor-week-bars" aria-hidden="true">
            {liveStats.weeklyBars.map((value, index) => (
              <div key={liveStats.weekDates[index]} className="labor-week-bar">
                <span style={{ height: `${Math.max(value, 4)}%` }} />
                <small>{value}</small>
              </div>
            ))}
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

      {!laborSearching && currentSection === 'finance' && (
      <div className="dashboard-plus-grid">
        <section className="card dashboard-plus-card dashboard-plus-card--wide">
          <SectionTitle eyebrow="Finanzen" title="Verpflichtungen" />

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
              <small className="finance-kpi__meta">
                {financeSummary.overdueCount} überfällig
                {financeSummary.pressure > 0 ? ` · Druck ${financeSummary.pressure}%` : ''}
              </small>
            </div>
          </div>

          {financeSummary.nextDue && (
            <div className="finance-next">
              <span className="eyebrow">Als Nächstes</span>
              <div className="finance-next__row">
                <strong>{financeSummary.nextDue.name}</strong>
                <span>
                  € {formatMoney(financeSummary.nextDue.amount)} · {financeSummary.nextDue.due}
                </span>
              </div>
            </div>
          )}

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

          <div className="finance-lists">
            <div className="finance-list-block">
              <div className="finance-list-head">
                <div className="fin-section-label">
                  <CreditCard size={14} aria-hidden="true" />
                  <span>Fixkosten</span>
                </div>
                <button type="button" className="small-button" onClick={() => onQuickAction('capture-finance')}>
                  <Plus size={14} /> Fixkosten
                </button>
              </div>
              {dashboard.finances.recurring.length === 0 ? (
                <p className="dashboard-plus-empty-hint">
                  Noch keine Fixkosten — z. B. Miete, Versicherung, Abo.
                </p>
              ) : (
                <div className="dashboard-plus-bill-list">
                  {dashboard.finances.recurring.map((bill, index) =>
                    renderBillRow(bill, index, updateRecurringBill, removeRecurringBill),
                  )}
                </div>
              )}
            </div>

            <div className="finance-list-block">
              <div className="finance-list-head">
                <div className="fin-section-label">
                  <Receipt size={14} aria-hidden="true" />
                  <span>Offene Posten</span>
                </div>
                <button type="button" className="small-button" onClick={() => onQuickAction('capture-finance')}>
                  <Plus size={14} /> Rechnung
                </button>
              </div>
              {dashboard.finances.openBills.length === 0 ? (
                <p className="dashboard-plus-empty-hint">
                  Keine offenen Rechnungen — Einmalposten hier erfassen.
                </p>
              ) : (
                <div className="dashboard-plus-bill-list">
                  {dashboard.finances.openBills.map((bill, index) =>
                    renderBillRow(bill, index, updateOpenBill, removeOpenBill),
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
      )}

          {!laborSearching && (currentSection === 'todos' || currentSection === 'lists') && (
            <p className="dashboard-plus-footer">Wischen: links erledigen, rechts verschieben · lange drücken: Menü</p>
          )}
        </div>
      </div>

      {taskMenu && (() => {
        const items: ContextMenuItem[] = [
          { id: 'toggle', label: 'Erledigt umschalten' },
          { id: 'priority', label: 'Priorität wechseln' },
          {
            id: 'move',
            label: taskMenu.kind === 'focus' ? 'Zum aktiven Board' : 'Zum Fokus',
          },
          { id: 'delete', label: 'Löschen', danger: true },
        ]
        return (
          <ContextMenu
            x={taskMenu.x}
            y={taskMenu.y}
            title={taskMenu.title || 'Aufgabe'}
            items={items}
            onClose={() => setTaskMenu(null)}
            onSelect={id => {
              if (taskMenu.kind === 'focus') {
                const task = dashboard.focusTodos[taskMenu.index]
                if (!task) return
                if (id === 'toggle') updateFocusTask(taskMenu.index, { done: !task.done })
                if (id === 'priority') updateFocusTask(taskMenu.index, { priority: nextPriority(task.priority) })
                if (id === 'move') moveFocusToBoard(taskMenu.index)
                if (id === 'delete') removeFocusTask(taskMenu.index)
                return
              }
              const task = activeBoard?.tasks[taskMenu.index]
              if (!task || !activeBoard) return
              if (id === 'toggle') updateBoardTask(activeBoard.id, taskMenu.index, { done: !task.done })
              if (id === 'priority') updateBoardTask(activeBoard.id, taskMenu.index, { priority: nextPriority(task.priority) })
              if (id === 'move') moveBoardToFocus(activeBoard.id, taskMenu.index)
              if (id === 'delete') removeBoardTask(activeBoard.id, taskMenu.index)
            }}
          />
        )
      })()}
    </div>
  )
}

function TaskEditor({
  initialValue,
  initialMinutes,
  isEditing,
  onClose,
  onSave,
}: {
  initialValue: string
  initialMinutes: number
  isEditing: boolean
  onClose: () => void
  onSave: (value: string, minutes: number) => void
}) {
  const [value, setValue] = useState(initialValue)
  const [minutes, setMinutes] = useState(() => clampNumber(initialMinutes, 5, 120))
  useModalBehavior(onClose)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSave(value, minutes)
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
        <div className="task-editor-duration">
          <span className="task-editor-duration__label">Fokusdauer</span>
          <div className="duration-grid">
            {TASK_FOCUS_DURATIONS.map(option => (
              <button
                type="button"
                key={option}
                className={minutes === option ? 'duration-button is-active' : 'duration-button'}
                onClick={() => setMinutes(option)}
                aria-pressed={minutes === option}
              >
                <strong>{option}</strong>
                <span>Min.</span>
              </button>
            ))}
          </div>
          <label className="text-field">
            <span>Eigene Minuten</span>
            <input
              type="number"
              min={5}
              max={120}
              step={5}
              value={minutes}
              onChange={event => setMinutes(clampNumber(Number(event.target.value) || 25, 5, 120))}
            />
          </label>
        </div>
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
  onSubmitProtein,
  onSubmitFat,
  onSubmitCarbs,
  onSubmitFiber,
  onSubmitWater,
  onSubmitSteps,
}: {
  onClose: () => void
  onSubmitTask: (title: string) => void
  onSubmitWeight: (value: number) => void
  onSubmitCalories: (value: number) => void
  onSubmitProtein: (value: number) => void
  onSubmitFat: (value: number) => void
  onSubmitCarbs: (value: number) => void
  onSubmitFiber: (value: number) => void
  onSubmitWater: (value: number) => void
  onSubmitSteps: (value: number) => void
}) {
  const [value, setValue] = useState('')
  useModalBehavior(onClose)

  const parsed = parseQuickAdd(value)
  const preview = value.trim() === ''
    ? 'Erkennt Gewicht, kcal, Protein, Fett, KH, Ballaststoffe, Wasser und Schritte — sonst wird eine Aufgabe daraus.'
    : describeQuickAdd(parsed)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!value.trim()) return
    switch (parsed.kind) {
      case 'weight':
        onSubmitWeight(parsed.value)
        return
      case 'calories':
        onSubmitCalories(parsed.value)
        return
      case 'protein':
        onSubmitProtein(parsed.value)
        return
      case 'fat':
        onSubmitFat(parsed.value)
        return
      case 'carbs':
        onSubmitCarbs(parsed.value)
        return
      case 'fiber':
        onSubmitFiber(parsed.value)
        return
      case 'water':
        onSubmitWater(parsed.value)
        return
      case 'steps':
        onSubmitSteps(parsed.value)
        return
      case 'task':
        onSubmitTask(parsed.title)
        return
      default: {
        const _exhaustive: never = parsed
        return _exhaustive
      }
    }
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
  onExportToCalendar,
}: {
  session: FocusSession
  onChangeMinutes: (minutes: number) => void
  onClose: () => void
  onFinish: () => void
  onExportToCalendar: () => void
}) {
  const [secondsLeft, setSecondsLeft] = useState(session.minutes * 60)
  const [running, setRunning] = useState(false)
  const [editingDuration, setEditingDuration] = useState(false)
  const [draftMinutes, setDraftMinutes] = useState(String(session.minutes))
  const finishedRef = useRef(false)
  const wakeLockRef = useRef<Awaited<ReturnType<typeof requestScreenWakeLock>>>(null)
  const durationInputRef = useRef<HTMLInputElement | null>(null)
  useModalBehavior(onClose)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSecondsLeft(session.minutes * 60)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRunning(false)
    finishedRef.current = false
    setDraftMinutes(String(session.minutes))
    setEditingDuration(false)
  }, [session.minutes])

  useEffect(() => {
    if (!editingDuration) return
    durationInputRef.current?.focus()
    durationInputRef.current?.select()
  }, [editingDuration])

  useEffect(() => {
    let cancelled = false

    const syncWakeLock = async () => {
      if (!running) {
        await releaseScreenWakeLock(wakeLockRef.current)
        wakeLockRef.current = null
        return
      }
      const sentinel = await requestScreenWakeLock()
      if (cancelled) {
        await releaseScreenWakeLock(sentinel)
        return
      }
      wakeLockRef.current = sentinel
    }

    void syncWakeLock()

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && running) void syncWakeLock()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void releaseScreenWakeLock(wakeLockRef.current)
      wakeLockRef.current = null
    }
  }, [running])

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

  const commitDraftMinutes = () => {
    const next = clampNumber(Number(draftMinutes) || session.minutes, 5, 120)
    setEditingDuration(false)
    if (next !== session.minutes) onChangeMinutes(next)
    else setDraftMinutes(String(session.minutes))
  }

  const adjustMinutes = (delta: number) => {
    if (running) return
    setEditingDuration(false)
    onChangeMinutes(clampNumber(session.minutes + delta, 5, 120))
  }

  const startEditing = () => {
    if (running) return
    setDraftMinutes(String(session.minutes))
    setEditingDuration(true)
  }

  const displayMinutes = Math.floor(secondsLeft / 60)
  const displaySeconds = secondsLeft % 60
  const progress = 1 - secondsLeft / (session.minutes * 60)
  const statusLabel = running
    ? 'Bleib bei diesem Schritt'
    : secondsLeft === 0
      ? 'Zeit ist um'
      : editingDuration
        ? 'Minuten eingeben · Enter'
        : 'Tippen oder ± zum Anpassen'

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
          className={running ? 'focus-timer' : 'focus-timer focus-timer--editable'}
          style={{ '--focus-progress': `${progress * 360}deg` } as CSSProperties}
        >
          <div className="focus-timer__inner">
            {!running && (
              <button
                type="button"
                className="focus-timer__step"
                onClick={() => adjustMinutes(-5)}
                aria-label="5 Minuten weniger"
                disabled={session.minutes <= 5}
              >
                −
              </button>
            )}
            <div className="focus-timer__readout">
              {editingDuration ? (
                <form
                  className="focus-timer__edit"
                  onSubmit={event => {
                    event.preventDefault()
                    commitDraftMinutes()
                  }}
                >
                  <input
                    ref={durationInputRef}
                    type="number"
                    min={5}
                    max={120}
                    step={1}
                    inputMode="numeric"
                    aria-label="Fokusdauer in Minuten"
                    value={draftMinutes}
                    onChange={event => setDraftMinutes(event.target.value)}
                    onBlur={commitDraftMinutes}
                    onKeyDown={event => {
                      if (event.key === 'Escape') {
                        setEditingDuration(false)
                        setDraftMinutes(String(session.minutes))
                      }
                    }}
                  />
                  <span className="focus-timer__unit">Min.</span>
                </form>
              ) : (
                <button
                  type="button"
                  className="focus-timer__time"
                  onClick={startEditing}
                  disabled={running}
                  aria-label={running ? 'Verbleibende Zeit' : 'Fokusdauer anpassen'}
                >
                  <strong>{String(displayMinutes).padStart(2, '0')}:{String(displaySeconds).padStart(2, '0')}</strong>
                </button>
              )}
              <span>{statusLabel}</span>
            </div>
            {!running && (
              <button
                type="button"
                className="focus-timer__step"
                onClick={() => adjustMinutes(5)}
                aria-label="5 Minuten mehr"
                disabled={session.minutes >= 120}
              >
                +
              </button>
            )}
          </div>
        </div>
        <div className="focus-duration-row">
          {[10, 15, 25, 45, 60].map(value => (
            <button type="button" key={value} className={session.minutes === value ? 'is-active' : ''} onClick={() => onChangeMinutes(value)} disabled={running}>
              {value} Min.
            </button>
          ))}
        </div>
        <div className="focus-controls">
          <button type="button" className="secondary-button" onClick={() => { setRunning(false); setSecondsLeft(session.minutes * 60) }}>
            <RotateCcw size={17} /> Reset
          </button>
          <button
            type="button"
            className="focus-play"
            onClick={() => {
              setEditingDuration(false)
              setRunning(current => !current)
            }}
          >
            {running ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
          </button>
          <button type="button" className="primary-button" onClick={onFinish}>
            <Check size={17} /> Fertig
          </button>
        </div>
        <button type="button" className="text-button focus-calendar-link" onClick={onExportToCalendar}>
          <CalendarPlus size={15} /> In Kalender legen
        </button>
      </div>
    </div>
  )
}

function RitualDurationFields({
  id,
  config,
  onChange,
}: {
  id: MorningRitualStepId
  config: MorningRitualConfig
  onChange: (config: MorningRitualConfig) => void
}) {
  const setMinutes = (key: 'coldSeconds' | 'winnerSeconds' | 'prayerSeconds' | 'hotShowerSeconds', value: number, min: number, max: number) => {
    onChange({ ...config, [key]: clampNumber(Math.round(value * 60), min, max) })
  }
  const plannedTime = (
    <label className="ritual-duration">
      <span>Planzeit Min.</span>
      <input
        type="number"
        min={1}
        max={120}
        value={config.stepMinutes[id]}
        onChange={event => onChange({
          ...config,
          stepMinutes: {
            ...config.stepMinutes,
            [id]: clampNumber(Number(event.target.value) || 1, 1, 120),
          },
        })}
      />
    </label>
  )

  switch (id) {
    case 'coldShower':
      return (
        <label className="ritual-duration">
          <span>Minuten</span>
          <input
            type="number"
            min={1}
            max={10}
            value={Math.round(config.coldSeconds / 60)}
            onChange={event => setMinutes('coldSeconds', Number(event.target.value) || 3, 30, 600)}
          />
        </label>
      )
    case 'winnerPose':
      return (
        <label className="ritual-duration">
          <span>Minuten</span>
          <input
            type="number"
            min={1}
            max={10}
            value={Math.round(config.winnerSeconds / 60)}
            onChange={event => setMinutes('winnerSeconds', Number(event.target.value) || 3, 30, 600)}
          />
        </label>
      )
    case 'prayer':
      return (
        <label className="ritual-duration">
          <span>Minuten</span>
          <input
            type="number"
            min={1}
            max={20}
            value={Math.round(config.prayerSeconds / 60)}
            onChange={event => setMinutes('prayerSeconds', Number(event.target.value) || 7, 60, 1200)}
          />
        </label>
      )
    case 'workout':
      return (
        <div className="ritual-duration-row">
          {plannedTime}
          <label className="ritual-duration">
            <span>Pushups</span>
            <input
              type="number"
              min={5}
              max={200}
              value={config.pushupTarget}
              onChange={event => onChange({
                ...config,
                pushupTarget: clampNumber(Number(event.target.value) || 50, 5, 200),
              })}
            />
          </label>
          <label className="ritual-duration">
            <span>KO</span>
            <input
              type="number"
              min={1}
              max={100}
              value={config.koTarget}
              onChange={event => onChange({
                ...config,
                koTarget: clampNumber(Number(event.target.value) || 10, 1, 100),
              })}
            />
          </label>
        </div>
      )
    case 'postShower':
      return (
        <div className="ritual-duration-row">
          <label className="ritual-duration">
            <span>Heiß Min</span>
            <input
              type="number"
              min={1}
              max={10}
              value={Math.round(config.hotShowerSeconds / 60)}
              onChange={event => setMinutes('hotShowerSeconds', Number(event.target.value) || 3, 30, 600)}
            />
          </label>
          <label className="ritual-duration">
            <span>Kalt Sek</span>
            <input
              type="number"
              min={8}
              max={45}
              value={config.coldRinseSeconds}
              onChange={event => onChange({
                ...config,
                coldRinseSeconds: clampNumber(Number(event.target.value) || 20, 8, 45),
              })}
            />
          </label>
        </div>
      )
    case 'medsShake':
    case 'weight':
    case 'gratitude':
    case 'energy':
    case 'headRecovery':
    case 'todos':
    case 'selfcare':
    case 'letsGo':
      return plannedTime
    default: {
      const _exhaustive: never = id
      return _exhaustive
    }
  }
}

function ritualPhaseLabel(id: MorningRitualStepId): string {
  const phase = morningRitualPhase(id)
  switch (phase) {
    case 'gate':
      return 'Start'
    case 'heute':
      return 'Planung'
    case 'track':
      return 'Aktiv'
    default: {
      const _exhaustive: never = phase
      return _exhaustive
    }
  }
}

type SettingsCategory = 'general' | 'nutrition' | 'routine' | 'rituals' | 'dashboard' | 'devices' | 'data'

const SETTINGS_CATEGORIES: {
  id: SettingsCategory
  label: string
  hint: string
  icon: LucideIcon
}[] = [
  { id: 'general', label: 'Allgemein', hint: 'Name und Darstellung', icon: User },
  { id: 'nutrition', label: 'Ernährung', hint: 'Makros und Gewicht', icon: Utensils },
  { id: 'routine', label: 'Routine', hint: 'Habits und Fokus', icon: Sun },
  { id: 'rituals', label: 'Rituale', hint: 'Morgen- und Abend-Gate', icon: Moon },
  { id: 'dashboard', label: 'Dashboard', hint: 'Reiter und Layout', icon: LayoutGrid },
  { id: 'devices', label: 'Geräte', hint: 'Sync und Shortcuts', icon: Smartphone },
  { id: 'data', label: 'Daten', hint: 'Backup und Lab-Daten', icon: Database },
]

function SettingsModal({
  settings,
  lastBackupAt,
  deviceSync,
  onChange,
  onExport,
  onImport,
  onResetLabor,
  onDeviceSyncChange,
  onSyncNow,
  showToast,
  onClose,
  onPreviewMorningGate,
  onOpenIntegrations,
}: {
  settings: AppSettings
  lastBackupAt: string | null
  deviceSync: DeviceSyncCredentials | null
  onChange: (settings: AppSettings) => void
  onExport: () => void
  onImport: (file: File) => Promise<void>
  onResetLabor: () => void
  onDeviceSyncChange: (creds: DeviceSyncCredentials | null) => void
  onSyncNow: () => void
  showToast: (message: string) => void
  onClose: () => void
  onPreviewMorningGate: () => void
  onOpenIntegrations: () => void
}) {
  useModalBehavior(onClose)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const settingsBodyRef = useRef<HTMLDivElement | null>(null)
  const layout = settings.dashboardPlusLayout
  const [category, setCategory] = useState<SettingsCategory>('general')
  const [copiedShortcut, setCopiedShortcut] = useState<string | null>(null)
  const [pairCode, setPairCode] = useState<string | null>(null)
  const [pairExpiresAt, setPairExpiresAt] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [syncBusy, setSyncBusy] = useState(false)
  const [selfcareDraft, setSelfcareDraft] = useState('')
  const ritualConfig = normalizeMorningRitualConfig(settings.morningRitual)

  useEffect(() => {
    settingsBodyRef.current?.scrollTo({ top: 0 })
  }, [category])

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

        <div className="settings-shell">
          <nav className="settings-nav" role="tablist" aria-label="Einstellungskategorien">
            {SETTINGS_CATEGORIES.map(item => {
              const Icon = item.icon
              const active = category === item.id
              return (
                <button
                  type="button"
                  key={item.id}
                  id={`settings-cat-${item.id}`}
                  role="tab"
                  className={active ? 'settings-nav-item is-active' : 'settings-nav-item'}
                  aria-selected={active}
                  title={item.hint}
                  onClick={() => setCategory(item.id)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </span>
                </button>
              )
            })}
          </nav>

          <div
            className="settings-body"
            ref={settingsBodyRef}
            role="tabpanel"
            aria-labelledby={`settings-cat-${category}`}
          >
        <div className="settings-section" hidden={category !== 'devices'}>
          <h3>Integrationen</h3>
          <p style={{ margin: '-6px 0 12px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Connectoren, Webhooks und Outbound-Events. Die Startseite bleibt unverändert.
          </p>
          <button type="button" className="secondary-button" onClick={onOpenIntegrations}>
            Integrationen öffnen
          </button>
        </div>

        <div className="settings-section" hidden={category !== 'routine'}>
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

        <div className="settings-section" hidden={category !== 'dashboard'}>
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

        <div className="settings-section" hidden={category !== 'general'}>
          <h3>Profil</h3>
          <p className="settings-help">Name erscheint in der Begrüßung und im Tagesablauf.</p>
          <label className="text-field">
            <span>Name</span>
            <input value={settings.name} placeholder="Dein Name" onChange={event => onChange({ ...settings, name: event.target.value })} />
          </label>
        </div>

        <div className="settings-section" hidden={category !== 'general'}>
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
          <p className="settings-help" style={{ marginTop: 14 }}>Akzentfarbe</p>
          <div className="accent-swatch-row" role="group" aria-label="Akzentfarbe">
            {ACCENT_OPTIONS.map(option => (
              <button
                type="button"
                key={option.id}
                className={settings.accent === option.id ? 'accent-swatch is-active' : 'accent-swatch'}
                style={{ ['--swatch' as string]: option.swatch }}
                onClick={() => onChange({ ...settings, accent: option.id })}
                aria-pressed={settings.accent === option.id}
                aria-label={`Akzentfarbe ${option.label}`}
                title={option.label}
              >
                {settings.accent === option.id && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section" hidden={category !== 'routine'}>
          <h3>Standard-Fokus</h3>
          <p className="settings-help">
            Fallback für neue Anker und wenn keine eigene Dauer gesetzt ist. Pro Aufgabe kannst du die Dauer beim Bearbeiten überschreiben.
          </p>
          <div className="duration-grid settings-focus-duration">
            {[10, 25, 45].map(minutes => (
              <button
                type="button"
                key={minutes}
                className={settings.focusMinutes === minutes ? 'duration-button is-active' : 'duration-button'}
                onClick={() => onChange({ ...settings, focusMinutes: minutes })}
                aria-pressed={settings.focusMinutes === minutes}
              >
                <strong>{minutes}</strong>
                <span>Min.</span>
              </button>
            ))}
          </div>
          <label className="text-field" style={{ marginTop: 12 }}>
            <span>Eigene Minuten</span>
            <input
              type="number"
              min={5}
              max={120}
              step={5}
              value={settings.focusMinutes}
              onChange={event => onChange({
                ...settings,
                focusMinutes: clampNumber(Number(event.target.value) || 25, 5, 120),
              })}
            />
          </label>
        </div>

        <div className="settings-section" hidden={category !== 'nutrition'}>
          <h3>Makros</h3>
          <p className="settings-help">Tagesziele für Protein, Kalorien und Kohlenhydrate.</p>
          <div className="settings-grid">
            <label className="text-field"><span>Proteinziel in g</span><input type="number" min="50" max="400" step="5" value={settings.proteinGoal} onChange={event => onChange({ ...settings, proteinGoal: clampNumber(Number(event.target.value) || 150, 50, 400) })} /></label>
            <label className="text-field"><span>Kalorienziel</span><input type="number" min="1000" max="8000" step="50" value={settings.calorieGoal} onChange={event => onChange({ ...settings, calorieGoal: clampNumber(Number(event.target.value) || 3500, 1000, 8000) })} /></label>
            <label className="text-field"><span>Fettziel in g</span><input type="number" min="20" max="200" step="5" value={settings.fatGoal} onChange={event => onChange({ ...settings, fatGoal: clampNumber(Number(event.target.value) || 70, 20, 200) })} /></label>
            <label className="text-field"><span>KH-Ziel in g</span><input type="number" min="50" max="500" step="5" value={settings.carbsGoal} onChange={event => onChange({ ...settings, carbsGoal: clampNumber(Number(event.target.value) || 250, 50, 500) })} /></label>
            <label className="text-field"><span>Ballaststoffe in g</span><input type="number" min="10" max="80" step="1" value={settings.fiberGoal} onChange={event => onChange({ ...settings, fiberGoal: clampNumber(Number(event.target.value) || 30, 10, 80) })} /></label>
          </div>
        </div>

        <div className="settings-section" hidden={category !== 'nutrition'}>
          <h3>Körper</h3>
          <p className="settings-help">Größe für den BMI, Start- und Zielgewicht für Lab.</p>
          <div className="settings-grid">
            <label className="text-field"><span>Körpergröße in cm</span><input type="number" min="0" max="250" step="1" value={settings.heightCm || ''} placeholder="für BMI" onChange={event => onChange({ ...settings, heightCm: clampNumber(Number(event.target.value) || 0, 0, 250) })} /></label>
            <label className="text-field"><span>Gewichtsziel in kg</span><input type="number" min="0" max="300" step="0.1" value={settings.weightGoalKg || ''} placeholder="z. B. 70" onChange={event => onChange({ ...settings, weightGoalKg: clampNumber(Number(event.target.value) || 0, 0, 300) })} /></label>
            <label className="text-field"><span>Startgewicht in kg</span><input type="number" min="0" max="300" step="0.1" value={settings.weightStartKg || ''} placeholder="leer = erster Wert" onChange={event => onChange({ ...settings, weightStartKg: clampNumber(Number(event.target.value) || 0, 0, 300) })} /></label>
          </div>
        </div>

        <div className="settings-section" hidden={category !== 'rituals'}>
          <h3>Abend-Gate</h3>
          <p className="settings-help">
            Ab dieser Uhrzeit erscheint der Tagesabschluss. Punkte steuern, was noch zählt.
          </p>
          <div className="settings-actions">
            <button
              type="button"
              className={settings.eveningGate.enabled ? 'choice-button is-active' : 'choice-button'}
              aria-pressed={settings.eveningGate.enabled}
              onClick={() => onChange({
                ...settings,
                eveningGate: { ...settings.eveningGate, enabled: !settings.eveningGate.enabled },
              })}
            >
              {settings.eveningGate.enabled ? 'Gate an' : 'Gate aus'}
            </button>
          </div>
          {settings.eveningGate.enabled && (
            <>
              <label className="select-field" style={{ marginTop: 14 }}>
                <span>Ab Uhrzeit</span>
                <select
                  value={settings.eveningGate.fromHour}
                  onChange={event => onChange({
                    ...settings,
                    eveningGate: {
                      ...settings.eveningGate,
                      fromHour: clampNumber(Number(event.target.value) || 17, 15, 22),
                    },
                  })}
                >
                  {[15, 16, 17, 18, 19, 20, 21, 22].map(hour => (
                    <option key={hour} value={hour}>
                      {`${String(hour).padStart(2, '0')}:00`}
                    </option>
                  ))}
                </select>
              </label>
              <p className="settings-help" style={{ marginTop: 14 }}>Abschluss-Punkte</p>
              <div className="choice-grid">
                {EVENING_CLOSE_CHECK_IDS.map(id => {
                  const meta = EVENING_CLOSE_CHECK_META[id]
                  const active = !settings.eveningGate.hiddenChecks.includes(id)
                  return (
                    <button
                      type="button"
                      key={id}
                      className={active ? 'choice-button is-active' : 'choice-button'}
                      aria-pressed={active}
                      onClick={() => {
                        const hiddenChecks = active
                          ? [...settings.eveningGate.hiddenChecks, id]
                          : settings.eveningGate.hiddenChecks.filter(check => check !== id)
                        const nextHidden = hiddenChecks.length >= EVENING_CLOSE_CHECK_IDS.length
                          ? settings.eveningGate.hiddenChecks.filter(check => check !== id)
                          : hiddenChecks
                        onChange({
                          ...settings,
                          eveningGate: { ...settings.eveningGate, hiddenChecks: nextHidden as EveningCloseCheckId[] },
                        })
                      }}
                    >
                      {meta.label}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="settings-section" hidden={category !== 'rituals'}>
          <h3>Morgen-Ritual</h3>
          <p className="settings-help">
            Reihenfolge, Regeln und Zeiten steuerst du unten. Jeder Timer wird weiterhin manuell gestartet.
          </p>
          <div className="settings-actions">
            <button
              type="button"
              className={settings.morningGateEnabled ? 'choice-button is-active' : 'choice-button'}
              aria-pressed={settings.morningGateEnabled}
              onClick={() => onChange({ ...settings, morningGateEnabled: !settings.morningGateEnabled })}
            >
              {settings.morningGateEnabled ? 'Ritual an' : 'Ritual aus'}
            </button>
            {settings.morningGateEnabled && (
              <button type="button" className="secondary-button" onClick={onPreviewMorningGate}>
                Ablauf jetzt öffnen
              </button>
            )}
          </div>
          {settings.morningGateEnabled && (
            <div className="settings-grid" style={{ marginTop: 14 }}>
              <label className="text-field">
                <span>Shake Protein g</span>
                <input
                  type="number"
                  min={0}
                  max={80}
                  value={ritualConfig.shakeMeal.proteinGrams}
                  onChange={event => onChange({
                    ...settings,
                    morningRitual: {
                      ...ritualConfig,
                      shakeMeal: {
                        ...ritualConfig.shakeMeal,
                        proteinGrams: clampNumber(Number(event.target.value) || 0, 0, 80),
                      },
                    },
                  })}
                />
              </label>
              <label className="text-field">
                <span>Shake kcal</span>
                <input
                  type="number"
                  min={0}
                  max={800}
                  value={ritualConfig.shakeMeal.calories}
                  onChange={event => onChange({
                    ...settings,
                    morningRitual: {
                      ...ritualConfig,
                      shakeMeal: {
                        ...ritualConfig.shakeMeal,
                        calories: clampNumber(Number(event.target.value) || 0, 0, 800),
                      },
                    },
                  })}
                />
              </label>
              <label className="text-field">
                <span>Shake Fett g</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={ritualConfig.shakeMeal.fatGrams}
                  onChange={event => onChange({
                    ...settings,
                    morningRitual: {
                      ...ritualConfig,
                      shakeMeal: {
                        ...ritualConfig.shakeMeal,
                        fatGrams: clampNumber(Number(event.target.value) || 0, 0, 40),
                      },
                    },
                  })}
                />
              </label>
              <label className="text-field">
                <span>Shake KH g</span>
                <input
                  type="number"
                  min={0}
                  max={80}
                  value={ritualConfig.shakeMeal.carbsGrams}
                  onChange={event => onChange({
                    ...settings,
                    morningRitual: {
                      ...ritualConfig,
                      shakeMeal: {
                        ...ritualConfig.shakeMeal,
                        carbsGrams: clampNumber(Number(event.target.value) || 0, 0, 80),
                      },
                    },
                  })}
                />
              </label>
            </div>
          )}
          {settings.morningGateEnabled && (
            <div className="ritual-card-overview">
              <p className="settings-help">
                Alle Karten in Ablauf-Reihenfolge. Regeln erscheinen direkt auf der jeweiligen Karte.
                Timer-Zeiten steuern den echten Timer; Planzeiten sind Richtwerte.
              </p>
              <ol className="ritual-card-grid">
                {ritualConfig.stepOrder.map((id, index) => {
                  const hidden = ritualConfig.hiddenSteps.includes(id)
                  const meta = morningRitualMeta(id, ritualConfig)
                  return (
                    <li key={id} className={hidden ? 'ritual-config-card is-hidden' : 'ritual-config-card'}>
                      <div className="ritual-config-card__head">
                        <div className="ritual-config-card__number" aria-hidden="true">
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <div className="ritual-config-card__title">
                          <span>{ritualPhaseLabel(id)}</span>
                          <strong>{meta.label}</strong>
                          <small>{hidden ? 'Wird übersprungen' : meta.hint}</small>
                        </div>
                        <div className="ritual-config-card__actions">
                          <IconButton
                            label={`${meta.label} nach oben`}
                            disabled={index === 0}
                            onClick={() => onChange({
                              ...settings,
                              morningRitual: {
                                ...ritualConfig,
                                stepOrder: moveRitualStep(ritualConfig.stepOrder, index, -1),
                              },
                            })}
                          >
                            <ChevronUp size={15} />
                          </IconButton>
                          <IconButton
                            label={`${meta.label} nach unten`}
                            disabled={index === ritualConfig.stepOrder.length - 1}
                            onClick={() => onChange({
                              ...settings,
                              morningRitual: {
                                ...ritualConfig,
                                stepOrder: moveRitualStep(ritualConfig.stepOrder, index, 1),
                              },
                            })}
                          >
                            <ChevronDown size={15} />
                          </IconButton>
                          <IconButton
                            label={hidden ? `${meta.label} einblenden` : `${meta.label} ausblenden`}
                            className={hidden ? '' : 'is-active'}
                            onClick={() => {
                              const hiddenSteps = hidden
                                ? ritualConfig.hiddenSteps.filter(step => step !== id)
                                : [...ritualConfig.hiddenSteps, id]
                              onChange({
                                ...settings,
                                morningRitual: { ...ritualConfig, hiddenSteps },
                              })
                            }}
                          >
                            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                          </IconButton>
                        </div>
                      </div>

                      <div className="ritual-config-card__body">
                        <label className="text-field ritual-rule-field">
                          <span>Eigene Regel</span>
                          <textarea
                            rows={3}
                            maxLength={240}
                            value={ritualConfig.stepRules[id]}
                            onChange={event => onChange({
                              ...settings,
                              morningRitual: {
                                ...ritualConfig,
                                stepRules: {
                                  ...ritualConfig.stepRules,
                                  [id]: event.target.value.slice(0, 240),
                                },
                              },
                            })}
                          />
                        </label>
                        <RitualDurationFields
                          id={id}
                          config={ritualConfig}
                          onChange={morningRitual => onChange({ ...settings, morningRitual })}
                        />

                        {id === 'gratitude' && (
                          <label className="text-field ritual-card-wide-field">
                            <span>Text zum lauten Vorlesen</span>
                            <textarea
                              rows={5}
                              maxLength={1200}
                              value={ritualConfig.gratitudeText}
                              onChange={event => onChange({
                                ...settings,
                                morningRitual: {
                                  ...ritualConfig,
                                  gratitudeText: event.target.value.slice(0, 1200),
                                },
                              })}
                            />
                          </label>
                        )}

                        {id === 'selfcare' && (
                          <div className="ritual-card-wide-field">
                            <span className="ritual-config-card__field-label">Checkliste</span>
                            <div className="habit-settings-list">
                              {ritualConfig.selfcareItems.map(item => (
                                <button
                                  type="button"
                                  key={item.id}
                                  className="choice-button is-active"
                                  onClick={() => {
                                    if (ritualConfig.selfcareItems.length <= 1) return
                                    onChange({
                                      ...settings,
                                      morningRitual: {
                                        ...ritualConfig,
                                        selfcareItems: ritualConfig.selfcareItems.filter(entry => entry.id !== item.id),
                                      },
                                    })
                                  }}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                            <label className="text-field" style={{ marginTop: 8 }}>
                              <span>Selfcare-Punkt hinzufügen</span>
                              <input
                                value={selfcareDraft}
                                placeholder="z. B. Haar stylen"
                                onChange={event => setSelfcareDraft(event.target.value)}
                                onKeyDown={event => {
                                  if (event.key !== 'Enter') return
                                  event.preventDefault()
                                  const label = selfcareDraft.trim()
                                  if (!label) return
                                  onChange({
                                    ...settings,
                                    morningRitual: {
                                      ...ritualConfig,
                                      selfcareItems: normalizeSelfcareItems([
                                        ...ritualConfig.selfcareItems,
                                        { id: `selfcare-${Date.now()}`, label },
                                      ]),
                                    },
                                  })
                                  setSelfcareDraft('')
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
        </div>

        <div className="settings-section" hidden={category !== 'devices'}>
          <h3>iPhone · Kurzbefehle</h3>
          <p className="settings-help">
            In Kurzbefehle → „URL öffnen“. Life OS als PWA auf dem Home Screen speichern (Teilen → Zum Home-Bildschirm), dann bleiben Daten stabiler.
            Ray-Ban / Meta AI ohne Sync: URL mit <code>?action=note&amp;text=…</code> öffnen. Mit Sync: Webhook unten.
          </p>
          <div className="shortcut-recipe-list">
            {SHORTCUT_RECIPES.map(recipe => {
              const url = buildActionUrl(recipe.kind, recipe.text ? { text: recipe.text } : undefined)
              return (
                <div key={recipe.kind} className="shortcut-recipe">
                  <div>
                    <strong>{recipe.label}</strong>
                    <span>{recipe.hint}</span>
                    <code>{url.replace(/^https?:\/\/[^/]+/, '')}</code>
                  </div>
                  <button
                    type="button"
                    className="small-button"
                    onClick={async () => {
                      const ok = await copyText(url)
                      if (!ok) return
                      setCopiedShortcut(recipe.kind)
                      window.setTimeout(() => setCopiedShortcut(current => (current === recipe.kind ? null : current)), 1600)
                    }}
                  >
                    {copiedShortcut === recipe.kind ? 'Kopiert' : 'URL kopieren'}
                  </button>
                </div>
              )
            })}
          </div>
          <p className="settings-help">
            Fokus mit Dauer: <code>?action=focus&amp;min=25</code>. Werte ohne UI:
            <code>?action=log&amp;protein=180&amp;water=2.5</code> oder
            <code>?action=log&amp;text=180g%20protein</code>. Aufgabe direkt:
            <code>?action=add-task&amp;title=Creatine%20holen</code>.
            Notiz (Journal + Kurznotiz): <code>?action=note&amp;text=Idee</code>.
          </p>
        </div>

        <div className="settings-section" hidden={category !== 'devices'}>
          <h3>Geräte-Sync</h3>
          <p className="settings-help">
            Einmal koppeln, danach automatisch: Speichern lädt hoch, Öffnen/alle 60s holt Updates.
          </p>
          {deviceSync ? (
            <>
              <p className="settings-help">
                Verbunden seit {new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(deviceSync.pairedAt))}
                {deviceSync.lastSyncedAt
                  ? ` · zuletzt ${new Intl.DateTimeFormat('de-DE', { timeStyle: 'short' }).format(new Date(deviceSync.lastSyncedAt))} Uhr`
                  : ''}
              </p>
              {pairCode && (
                <div className="sync-pair-code" aria-live="polite">
                  <strong>{pairCode}</strong>
                  <span>
                    Code gültig bis{' '}
                    {pairExpiresAt
                      ? new Intl.DateTimeFormat('de-DE', { timeStyle: 'short' }).format(new Date(pairExpiresAt))
                      : '—'}{' '}
                    Uhr
                  </span>
                </div>
              )}
              <div className="settings-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={syncBusy}
                  onClick={async () => {
                    setSyncBusy(true)
                    try {
                      const result = await refreshPairCode()
                      setPairCode(result.pairCode)
                      setPairExpiresAt(result.expiresAt)
                      showToast('Code erzeugt — auf dem anderen Gerät eingeben.')
                    } catch (error) {
                      showToast(error instanceof Error ? error.message : 'Code fehlgeschlagen.')
                    } finally {
                      setSyncBusy(false)
                    }
                  }}
                >
                  Weiteres Gerät koppeln
                </button>
                <button type="button" className="secondary-button" disabled={syncBusy} onClick={onSyncNow}>
                  Jetzt synchronisieren
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={syncBusy}
                  onClick={() => {
                    if (!window.confirm('Sync auf diesem Gerät trennen? Daten bleiben lokal.')) return
                    clearSyncCredentials()
                    setPairCode(null)
                    setPairExpiresAt(null)
                    onDeviceSyncChange(null)
                    showToast('Sync getrennt.')
                  }}
                >
                  Sync trennen
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="settings-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={syncBusy}
                  onClick={async () => {
                    setSyncBusy(true)
                    setPairCode(null)
                    try {
                      const result = await createDevicePairing()
                      setPairCode(result.pairCode)
                      setPairExpiresAt(result.expiresAt)
                      onDeviceSyncChange(loadSyncCredentials())
                      showToast(`Code: ${result.pairCode}`)
                    } catch (error) {
                      showToast(error instanceof Error ? error.message : 'Koppeln fehlgeschlagen.')
                    } finally {
                      setSyncBusy(false)
                    }
                  }}
                >
                  {syncBusy ? 'Code wird erzeugt …' : 'Dieses Gerät als Start koppeln'}
                </button>
              </div>
              {pairCode && (
                <div className="sync-pair-code" aria-live="polite">
                  <strong>{pairCode}</strong>
                  <span>Auf dem anderen Gerät unten eingeben</span>
                </div>
              )}
              {syncBusy && !pairCode && (
                <p className="settings-help">Warte auf Sync-Server …</p>
              )}
              <label className="text-field" style={{ marginTop: 12 }}>
                <span>Code von anderem Gerät</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="6-stelliger Code"
                  value={joinCode}
                  onChange={event => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </label>
              <div className="settings-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={syncBusy || joinCode.length !== 6}
                  onClick={async () => {
                    setSyncBusy(true)
                    try {
                      const creds = await joinDevicePairing(joinCode)
                      setJoinCode('')
                      onDeviceSyncChange(creds)
                      showToast('Gerät gekoppelt — Sync läuft automatisch.')
                    } catch (error) {
                      showToast(error instanceof Error ? error.message : 'Beitritt fehlgeschlagen.')
                    } finally {
                      setSyncBusy(false)
                    }
                  }}
                >
                  Mit Code verbinden
                </button>
              </div>
            </>
          )}
        </div>

        <div className="settings-section" hidden={category !== 'devices'}>
          <h3>Webhook</h3>
          {deviceSync ? (
            <>
              <p className="settings-help">
                Kurzbefehle, Watch, Ray-Ban Meta oder andere Apps können schreiben, ohne die App zu öffnen.
                Token nicht teilen — wer ihn hat, kann Tage überschreiben.
              </p>
              <div className="shortcut-recipe-list">
                <div className="shortcut-recipe">
                  <div>
                    <strong>POST URL</strong>
                    <span>JSON an diesen Endpunkt senden</span>
                    <code>{`${window.location.origin}/api/hooks`}</code>
                  </div>
                  <button
                    type="button"
                    className="small-button"
                    onClick={async () => {
                      const ok = await copyText(`${window.location.origin}/api/hooks`)
                      if (!ok) return
                      setCopiedShortcut('webhook-url')
                      window.setTimeout(() => setCopiedShortcut(current => (current === 'webhook-url' ? null : current)), 1600)
                    }}
                  >
                    {copiedShortcut === 'webhook-url' ? 'Kopiert' : 'URL kopieren'}
                  </button>
                </div>
                <div className="shortcut-recipe">
                  <div>
                    <strong>Beispiel JSON</strong>
                    <span>type: log, quick, task oder note</span>
                    <code>{`{"roomId":"${deviceSync.roomId}","deviceToken":"${deviceSync.deviceToken}","type":"log","proteinGrams":180}`}</code>
                  </div>
                  <button
                    type="button"
                    className="small-button"
                    onClick={async () => {
                      const ok = await copyText(JSON.stringify({
                        roomId: deviceSync.roomId,
                        deviceToken: deviceSync.deviceToken,
                        type: 'log',
                        proteinGrams: 180,
                      }, null, 2))
                      if (!ok) return
                      setCopiedShortcut('webhook-json')
                      window.setTimeout(() => setCopiedShortcut(current => (current === 'webhook-json' ? null : current)), 1600)
                    }}
                  >
                    {copiedShortcut === 'webhook-json' ? 'Kopiert' : 'JSON kopieren'}
                  </button>
                </div>
                <div className="shortcut-recipe">
                  <div>
                    <strong>Brille-Notiz JSON</strong>
                    <span>Kurzbefehl: Text aus WhatsApp/Notizen in text setzen</span>
                    <code>{`{"roomId":"${deviceSync.roomId}","deviceToken":"${deviceSync.deviceToken}","type":"note","text":"DEIN TEXT"}`}</code>
                  </div>
                  <button
                    type="button"
                    className="small-button"
                    onClick={async () => {
                      const ok = await copyText(JSON.stringify({
                        roomId: deviceSync.roomId,
                        deviceToken: deviceSync.deviceToken,
                        type: 'note',
                        text: 'DEIN TEXT',
                      }, null, 2))
                      if (!ok) return
                      setCopiedShortcut('webhook-note')
                      window.setTimeout(() => setCopiedShortcut(current => (current === 'webhook-note' ? null : current)), 1600)
                    }}
                  >
                    {copiedShortcut === 'webhook-note' ? 'Kopiert' : 'JSON kopieren'}
                  </button>
                </div>
              </div>
              <div className="settings-help glasses-hook-help">
                <p>Ray-Ban Meta → Life OS (ohne Native-App):</p>
                <ol>
                  <li>Brille: „Hey Meta, schick mir per WhatsApp: …“ oder in die iPhone-Notizen.</li>
                  <li>Kurzbefehle → Automation: neue WhatsApp-Nachricht von dir selbst, oder Teilen-Sheet aus Notizen.</li>
                  <li>Aktion „URL-Inhalt abrufen“: POST auf die Webhook-URL, JSON-Typ <code>note</code>, Text = Diktat.</li>
                  <li>Life OS holt die Notiz beim nächsten Sync — Journal + Kurznotiz.</li>
                </ol>
              </div>
              <p className="settings-help">
                Quick-Text: <code>{`{"type":"quick","text":"180g protein"}`}</code>
                · Aufgabe: <code>{`{"type":"task","title":"Creatine holen"}`}</code>
                · Energie: <code>{`{"type":"log","energy":"high"}`}</code>
                · Notiz: <code>{`{"type":"note","text":"Idee vom Gehen"}`}</code>
              </p>
              <div className="shortcut-recipe-list" style={{ marginTop: 16 }}>
                <div className="shortcut-recipe">
                  <div>
                    <strong>Apple Health Ingest</strong>
                    <span>Health Auto Export: Fitdays → Apple Health → dieser Endpunkt</span>
                    <code>{`${window.location.origin}/api/health/ingest`}</code>
                  </div>
                  <button
                    type="button"
                    className="small-button"
                    onClick={async () => {
                      const ok = await copyText(`${window.location.origin}/api/health/ingest`)
                      if (!ok) return
                      setCopiedShortcut('health-url')
                      window.setTimeout(() => setCopiedShortcut(current => (current === 'health-url' ? null : current)), 1600)
                    }}
                  >
                    {copiedShortcut === 'health-url' ? 'Kopiert' : 'URL kopieren'}
                  </button>
                </div>
                <div className="shortcut-recipe">
                  <div>
                    <strong>Health-Header</strong>
                    <span>In Health Auto Export als eigene HTTP-Header setzen</span>
                    <code>{`Authorization: Bearer ${deviceSync.deviceToken}\nX-Life-Os-Room: ${deviceSync.roomId}`}</code>
                  </div>
                  <button
                    type="button"
                    className="small-button"
                    onClick={async () => {
                      const ok = await copyText(`Authorization: Bearer ${deviceSync.deviceToken}\nX-Life-Os-Room: ${deviceSync.roomId}`)
                      if (!ok) return
                      setCopiedShortcut('health-headers')
                      window.setTimeout(() => setCopiedShortcut(current => (current === 'health-headers' ? null : current)), 1600)
                    }}
                  >
                    {copiedShortcut === 'health-headers' ? 'Kopiert' : 'Header kopieren'}
                  </button>
                </div>
              </div>
              <p className="settings-help">
                Health Auto Export kann das native JSON schicken. Einfacher Test:
                <code>{`{"metric":"weight","value":56.8,"unit":"kg","date":"2026-09-13T07:42:00+02:00","source":"Fitdays"}`}</code>
              </p>
            </>
          ) : (
            <p className="settings-help">
              Zuerst Geräte-Sync koppeln. Danach erscheint hier die Webhook-URL mit Token.
            </p>
          )}
        </div>

        <div className="settings-section" hidden={category !== 'data'}>
          <h3>Medis-Erinnerungen</h3>
          <p className="settings-help">
            Nur mit Opt-in. Pro Medikament „Erinnern“ setzen und Uhrzeit eintragen. System-Benachrichtigungen nur, wenn du sie hier erlaubst.
          </p>
          <div className="settings-actions">
            <button
              type="button"
              className={settings.medisRemindersEnabled ? 'choice-button is-active' : 'choice-button'}
              aria-pressed={settings.medisRemindersEnabled}
              onClick={() => onChange({ ...settings, medisRemindersEnabled: !settings.medisRemindersEnabled })}
            >
              {settings.medisRemindersEnabled ? 'Erinnerungen an' : 'Erinnerungen aus'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                if (!('Notification' in window)) return
                if (Notification.permission === 'granted') return
                await Notification.requestPermission()
              }}
            >
              <Bell size={16} /> System-Hinweis erlauben
            </button>
          </div>
        </div>

        <div className="settings-section" hidden={category !== 'data'}>
          <h3>Backup</h3>
          <p className="settings-help">
            Vollbackup enthält Tage, Settings, Lab-Daten und XP. Zusätzlich kannst du Geräte-Sync nutzen.
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

        <div className="settings-section" hidden={category !== 'data'}>
          <h3>Lab-Daten</h3>
          <p className="settings-help">
            Alte Demo-Daten (Medis, Boards, Finanzen) entfernen und den Datenbereich von Lab neu starten. Tages-Einträge bleiben.
          </p>
          <div className="settings-actions">
            <button type="button" className="secondary-button" onClick={onResetLabor}>
              <RotateCcw size={16} /> Lab-Daten zurücksetzen
            </button>
          </div>
        </div>

        <div className="settings-note" hidden={category !== 'data'}>
          <Bell size={18} />
          <p>Benachrichtigungen werden nie ungefragt angefordert. Timer-Hinweise nur mit bestehender Berechtigung. Mit Geräte-Sync laufen Daten nach dem Koppeln automatisch mit.</p>
        </div>
          </div>
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
