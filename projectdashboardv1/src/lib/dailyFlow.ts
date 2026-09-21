/**
 * Daily Flow — one action → one state → every view.
 *
 * Daily Progress (hero ring) is the share of *currently relevant* actions
 * that are done. Evening-only habits and later anchors do not pull a
 * morning percentage down. Nutrition goals are not mixed into this ring.
 */
import type { DashboardEntry } from '../types/DashboardEntry.js'
import type { LifeAreaKey } from './lifeos/areas.js'
import { LIFE_AREA_LABELS } from './lifeos/areas.js'
import { getDayMode, HABIT_INTENSITY, type DayMode, type EnergyLevel } from './dayPolicy.js'
import {
  type MorningRitualConfig,
  type MorningRitualProgress,
  type MorningRitualStepId,
} from './morningGate.js'
import { EVENING_GATE_STEP_IDS, type EveningGateStepId } from './eveningGate.js'

export const SHAKE_MEAL_ID = 'protein-shake'

export type NutritionMeal = {
  id: string
  label: string
  proteinGrams: number
  calories: number
  fatGrams: number
  carbsGrams: number
  fiberGrams: number
}

export const DEFAULT_SHAKE_MEAL: NutritionMeal = {
  id: SHAKE_MEAL_ID,
  label: 'Proteinshake',
  proteinGrams: 30,
  calories: 180,
  fatGrams: 3,
  carbsGrams: 8,
  fiberGrams: 0,
}

export const HEAD_MOODS = ['Sehr schlecht', 'Schlecht', 'Okay', 'Gut', 'Sehr gut'] as const
export const HEAD_SLEEP_QUALITY = ['Schlecht', 'Okay', 'Gut', 'Sehr gut'] as const
export const HEAD_SLEEP_PRESETS = ['<5h', '6h', '7h', '7.5h', '8h', '>8h'] as const

export type NowUrgency = 'overdue' | 'now' | 'soon' | 'high'

export type NowItem = {
  id: string
  kind: 'anchor' | 'habit'
  title: string
  done: boolean
  area?: LifeAreaKey
  urgency?: NowUrgency
  index?: number
  habitKey?: string
  minutes?: number
}

export type DailyProgress = {
  /** 0–100 share of relevant actions done. */
  percent: number
  done: number
  total: number
  /** Human-readable definition of what the number means. */
  meaning: string
}

const EVENING_HABITS = new Set(['journalDone', 'familyTimeDone'])

const HABIT_AREA: Record<string, LifeAreaKey> = {
  breathingDone: 'health',
  coldShower: 'health',
  proteinShake: 'health',
  pushupsDone: 'health',
  squatsDone: 'health',
  wallsitDone: 'health',
  plankDone: 'health',
  gratitudeDone: 'growth',
  focusDone: 'work',
  winnerModeDone: 'growth',
  journalDone: 'growth',
  familyTimeDone: 'relationships',
}

function clampGrams(raw: unknown, fallback: number, max: number): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : fallback
  return Math.min(max, Math.max(0, value))
}

export function normalizeShakeMeal(raw: unknown): NutritionMeal {
  const stored = raw && typeof raw === 'object' ? raw as Partial<NutritionMeal> : {}
  return {
    id: SHAKE_MEAL_ID,
    label: typeof stored.label === 'string' && stored.label.trim()
      ? stored.label.trim().slice(0, 40)
      : DEFAULT_SHAKE_MEAL.label,
    proteinGrams: clampGrams(stored.proteinGrams, DEFAULT_SHAKE_MEAL.proteinGrams, 80),
    calories: clampGrams(stored.calories, DEFAULT_SHAKE_MEAL.calories, 800),
    fatGrams: clampGrams(stored.fatGrams, DEFAULT_SHAKE_MEAL.fatGrams, 40),
    carbsGrams: clampGrams(stored.carbsGrams, DEFAULT_SHAKE_MEAL.carbsGrams, 80),
    fiberGrams: clampGrams(stored.fiberGrams, DEFAULT_SHAKE_MEAL.fiberGrams, 20),
  }
}

export function entryHasMeal(entry: Pick<DashboardEntry, 'appliedMeals'>, id: string): boolean {
  return Boolean(entry.appliedMeals?.includes(id))
}

function nutritionReached(entry: DashboardEntry, proteinGoal?: number): Pick<DashboardEntry, 'proteinReached' | 'caloriesReached'> {
  return {
    proteinReached: proteinGoal ? entry.proteinGrams >= proteinGoal : entry.proteinReached,
    caloriesReached: entry.caloriesReached,
  }
}

export function applyMealToEntry(
  entry: DashboardEntry,
  meal: NutritionMeal,
  proteinGoal?: number,
): Partial<DashboardEntry> {
  if (entryHasMeal(entry, meal.id)) return {}
  const next: DashboardEntry = {
    ...entry,
    proteinGrams: entry.proteinGrams + meal.proteinGrams,
    calories: entry.calories + meal.calories,
    fatGrams: (entry.fatGrams ?? 0) + meal.fatGrams,
    carbsGrams: (entry.carbsGrams ?? 0) + meal.carbsGrams,
    fiberGrams: (entry.fiberGrams ?? 0) + meal.fiberGrams,
    appliedMeals: [...(entry.appliedMeals ?? []), meal.id],
  }
  if (meal.id === SHAKE_MEAL_ID) next.proteinShake = true
  return {
    proteinGrams: next.proteinGrams,
    calories: next.calories,
    fatGrams: next.fatGrams,
    carbsGrams: next.carbsGrams,
    fiberGrams: next.fiberGrams,
    appliedMeals: next.appliedMeals,
    proteinShake: next.proteinShake,
    ...nutritionReached(next, proteinGoal),
  }
}

export function revertMealFromEntry(
  entry: DashboardEntry,
  meal: NutritionMeal,
  proteinGoal?: number,
): Partial<DashboardEntry> {
  if (!entryHasMeal(entry, meal.id)) {
    return meal.id === SHAKE_MEAL_ID ? { proteinShake: false } : {}
  }
  const next: DashboardEntry = {
    ...entry,
    proteinGrams: Math.max(0, entry.proteinGrams - meal.proteinGrams),
    calories: Math.max(0, entry.calories - meal.calories),
    fatGrams: Math.max(0, (entry.fatGrams ?? 0) - meal.fatGrams),
    carbsGrams: Math.max(0, (entry.carbsGrams ?? 0) - meal.carbsGrams),
    fiberGrams: Math.max(0, (entry.fiberGrams ?? 0) - meal.fiberGrams),
    appliedMeals: (entry.appliedMeals ?? []).filter(id => id !== meal.id),
  }
  if (meal.id === SHAKE_MEAL_ID) next.proteinShake = false
  return {
    proteinGrams: next.proteinGrams,
    calories: next.calories,
    fatGrams: next.fatGrams,
    carbsGrams: next.carbsGrams,
    fiberGrams: next.fiberGrams,
    appliedMeals: next.appliedMeals,
    proteinShake: next.proteinShake,
    ...nutritionReached(next, proteinGoal),
  }
}

/** Idempotent shake booking: one real action, one nutrition row. */
export function syncProteinShakeNutrition(
  entry: DashboardEntry,
  nextShake: boolean,
  meal: NutritionMeal,
  proteinGoal?: number,
): Partial<DashboardEntry> {
  if (nextShake) {
    const applied = applyMealToEntry(entry, meal, proteinGoal)
    return { proteinShake: true, ...applied }
  }
  return revertMealFromEntry(entry, meal, proteinGoal)
}

export function isHeadRecoveryDone(entry: Pick<DashboardEntry, 'mood' | 'sleepQuality' | 'sleepDuration' | 'dreamed'>): boolean {
  return Boolean(
    entry.mood
    && entry.sleepQuality
    && entry.sleepDuration
    && entry.dreamed !== undefined,
  )
}

export function completedRitualSteps(input: {
  progress: MorningRitualProgress
  entry: Pick<DashboardEntry, 'proteinShake' | 'gratitudeDone' | 'coldShower' | 'winnerModeDone' | 'energyLevel' | 'mood' | 'sleepQuality' | 'sleepDuration' | 'dreamed' | 'pushupsDone'>
  config: MorningRitualConfig
}): MorningRitualStepId[] {
  const done = new Set(input.progress.done)
  if (input.entry.proteinShake) done.add('medsShake')
  if (input.entry.gratitudeDone) done.add('gratitude')
  if (input.entry.coldShower) done.add('coldShower')
  if (input.entry.winnerModeDone) done.add('winnerPose')
  if (input.entry.energyLevel) done.add('energy')
  if (isHeadRecoveryDone(input.entry)) done.add('headRecovery')
  if (input.entry.pushupsDone && input.progress.ko >= input.config.koTarget) done.add('workout')
  return [...done]
}

export function isEveningHour(hour = new Date().getHours()): boolean {
  return getDayMode(hour) === 'evening'
}

export function shouldShowDailyClose(
  hour = new Date().getHours(),
  closed = false,
  options?: { enabled?: boolean; fromHour?: number },
): boolean {
  if (closed) return true
  if (options?.enabled === false) return false
  const fromHour = options?.fromHour ?? 17
  return hour >= fromHour || hour < 5
}

function habitRelevantNow(key: string, mode: DayMode): boolean {
  if (EVENING_HABITS.has(key)) return mode === 'evening'
  if (mode === 'morning') {
    const intensity = HABIT_INTENSITY[key] ?? 'steady'
    return intensity === 'recovery' || intensity === 'steady' || key === 'coldShower' || key === 'pushupsDone' || key === 'winnerModeDone'
  }
  if (mode === 'evening') return key === 'breathingDone'
  const intensity = HABIT_INTENSITY[key] ?? 'steady'
  return intensity !== 'demand'
}

export function isHabitRelevantNow(key: string, hour = new Date().getHours()): boolean {
  return habitRelevantNow(key, getDayMode(hour))
}

export function assessDailyProgress(input: {
  entry: DashboardEntry
  activeHabits: string[]
  habitDone: Record<string, boolean>
  hour?: number
}): DailyProgress {
  const hour = input.hour ?? new Date().getHours()
  const mode = getDayMode(hour)
  const checks: Array<{ id: string; ok: boolean }> = []

  checks.push({ id: 'energy', ok: Boolean(input.entry.energyLevel) })
  checks.push({ id: 'head', ok: isHeadRecoveryDone(input.entry) })

  for (const key of input.activeHabits) {
    if (!habitRelevantNow(key, mode)) continue
    checks.push({ id: `habit:${key}`, ok: Boolean(input.habitDone[key]) })
  }

  if (mode !== 'morning') {
    const anchors = input.entry.anchors ?? []
    const anchorsDone = input.entry.anchorsDone ?? []
    anchors.forEach((_, index) => {
      checks.push({ id: `anchor:${index}`, ok: Boolean(anchorsDone[index]) })
    })
  }

  const total = checks.length
  const done = checks.filter(item => item.ok).length
  const percent = total === 0 ? 100 : Math.round((done / total) * 100)
  const meaning = mode === 'morning'
    ? 'Morgen: Energie, Stimmung & Erholung und fällige Morgen-Routinen'
    : mode === 'evening'
      ? 'Abend: offene Routinen, Anker und Abendpunkte'
      : 'Tag: fällige Routinen und Anker'

  return { percent, done, total, meaning }
}

/** Habit keys still owned by an incomplete morning-ritual step. */
export const RITUAL_STEP_HABIT: Partial<Record<MorningRitualStepId, string>> = {
  medsShake: 'proteinShake',
  gratitude: 'gratitudeDone',
  coldShower: 'coldShower',
  winnerPose: 'winnerModeDone',
  workout: 'pushupsDone',
}

export function ritualOwnedHabitKeys(input: {
  enabled: boolean
  skipped?: boolean
  steps: MorningRitualStepId[]
  doneSteps: Iterable<MorningRitualStepId>
}): string[] {
  if (!input.enabled || input.skipped) return []
  const done = new Set(input.doneSteps)
  const owned = new Set<string>()
  for (const step of input.steps) {
    if (done.has(step)) continue
    const habit = RITUAL_STEP_HABIT[step]
    if (habit) owned.add(habit)
  }
  return [...owned]
}

export function ritualOwnsEnergy(input: {
  enabled: boolean
  skipped?: boolean
  steps: MorningRitualStepId[]
  doneSteps: Iterable<MorningRitualStepId>
}): boolean {
  if (!input.enabled || input.skipped) return false
  const done = new Set(input.doneSteps)
  return input.steps.includes('energy') && !done.has('energy')
}

export function ritualOwnsHeadRecovery(input: {
  enabled: boolean
  skipped?: boolean
  steps: MorningRitualStepId[]
  doneSteps: Iterable<MorningRitualStepId>
}): boolean {
  if (!input.enabled || input.skipped) return false
  const done = new Set(input.doneSteps)
  return input.steps.includes('headRecovery') && !done.has('headRecovery')
}

export function ritualRemaining(input: {
  steps: MorningRitualStepId[]
  doneSteps: Iterable<MorningRitualStepId>
}): { done: number; total: number; remaining: number } {
  const done = new Set(input.doneSteps)
  const completed = input.steps.filter(step => done.has(step)).length
  return {
    done: completed,
    total: input.steps.length,
    remaining: Math.max(0, input.steps.length - completed),
  }
}

/** Habits still owned by an incomplete evening-gate step. */
export const EVENING_STEP_HABIT: Partial<Record<EveningGateStepId, string>> = {
  breathing: 'breathingDone',
  memo: 'journalDone',
}

export function eveningOwnedHabitKeys(input: {
  enabled: boolean
  completed?: boolean
  doneSteps?: Iterable<EveningGateStepId>
}): string[] {
  if (!input.enabled || input.completed) return []
  const done = new Set(input.doneSteps ?? [])
  const owned = new Set<string>()
  for (const step of EVENING_GATE_STEP_IDS) {
    if (done.has(step)) continue
    const habit = EVENING_STEP_HABIT[step]
    if (habit) owned.add(habit)
  }
  return [...owned]
}

export function eveningRemaining(doneSteps: Iterable<EveningGateStepId> = []): {
  done: number
  total: number
  remaining: number
} {
  const done = new Set(doneSteps)
  const completed = EVENING_GATE_STEP_IDS.filter(step => done.has(step)).length
  return {
    done: completed,
    total: EVENING_GATE_STEP_IDS.length,
    remaining: Math.max(0, EVENING_GATE_STEP_IDS.length - completed),
  }
}

export function selectNowItems(input: {
  anchors: string[]
  anchorsDone: boolean[]
  anchorMinutes: number[]
  habits: Array<{ key: string; label: string; done: boolean; minutes?: number }>
  energy?: EnergyLevel
  hour?: number
  excludeHabitKeys?: Iterable<string>
}): NowItem[] {
  const hour = input.hour ?? new Date().getHours()
  const mode = getDayMode(hour)
  const excluded = new Set(input.excludeHabitKeys ?? [])
  const items: NowItem[] = []

  input.habits.forEach(habit => {
    if (habit.done) return
    if (excluded.has(habit.key)) return
    if (!habitRelevantNow(habit.key, mode)) return
    const intensity = HABIT_INTENSITY[habit.key] ?? 'steady'
    const urgency: NowUrgency | undefined = intensity === 'demand' && mode === 'morning'
      ? 'high'
      : (habit.key === 'proteinShake' || habit.key === 'breathingDone') && mode === 'morning'
        ? 'now'
        : undefined
    items.push({
      id: `habit:${habit.key}`,
      kind: 'habit',
      title: habit.label,
      done: false,
      area: HABIT_AREA[habit.key],
      urgency,
      habitKey: habit.key,
      minutes: habit.minutes,
    })
  })

  input.anchors.forEach((title, index) => {
    if (input.anchorsDone[index]) return
    if (mode === 'morning' && index > 0) return
    items.push({
      id: `anchor:${index}`,
      kind: 'anchor',
      title,
      done: false,
      urgency: index === 0 && mode !== 'evening' ? 'now' : mode === 'evening' ? 'soon' : undefined,
      index,
      minutes: input.anchorMinutes[index],
    })
  })

  return items
}

export function selectOverviewItems(input: {
  anchors: string[]
  anchorsDone: boolean[]
  anchorMinutes: number[]
  habits: Array<{ key: string; label: string; done: boolean; minutes?: number }>
  excludeHabitKeys?: Iterable<string>
}): NowItem[] {
  const excluded = new Set(input.excludeHabitKeys ?? [])
  const habits = input.habits.filter(habit => !excluded.has(habit.key)).map(habit => ({
    id: `habit:${habit.key}`,
    kind: 'habit' as const,
    title: habit.label,
    done: habit.done,
    area: HABIT_AREA[habit.key],
    habitKey: habit.key,
    minutes: habit.minutes,
  }))
  const anchors = input.anchors.map((title, index) => ({
    id: `anchor:${index}`,
    kind: 'anchor' as const,
    title,
    done: Boolean(input.anchorsDone[index]),
    index,
    minutes: input.anchorMinutes[index],
  }))
  return [...anchors, ...habits]
}

export type DaySlot = 'morning' | 'day' | 'evening'

const MORNING_HABITS = new Set([
  'breathingDone',
  'coldShower',
  'proteinShake',
  'gratitudeDone',
  'winnerModeDone',
])

export function overviewSlot(item: Pick<NowItem, 'kind' | 'habitKey'>): DaySlot {
  if (item.kind === 'habit' && item.habitKey) {
    if (EVENING_HABITS.has(item.habitKey)) return 'evening'
    if (MORNING_HABITS.has(item.habitKey)) return 'morning'
  }
  return 'day'
}

export function areaLabel(area?: LifeAreaKey): string | undefined {
  return area ? LIFE_AREA_LABELS[area] : undefined
}

export function urgencyLabel(urgency?: NowUrgency): string | undefined {
  switch (urgency) {
    case 'overdue':
      return 'Überfällig'
    case 'now':
      return 'Jetzt'
    case 'soon':
      return 'Bald'
    case 'high':
      return 'Priorität'
    default:
      return undefined
  }
}

export function nowChipLabel(item: Pick<NowItem, 'area' | 'urgency'>): string | undefined {
  const area = areaLabel(item.area)
  const mark = item.urgency === 'high' || item.urgency === 'overdue'
    ? urgencyLabel(item.urgency)
    : undefined
  if (area && mark) return `${area} · ${mark}`
  return area ?? mark
}

export function startOfWeek(date: string): string {
  const cursor = new Date(`${date}T12:00:00`)
  const day = cursor.getDay()
  const diff = day === 0 ? -6 : 1 - day
  cursor.setDate(cursor.getDate() + diff)
  return toDateKey(cursor)
}

export function addDateKey(date: string, days: number): string {
  const cursor = new Date(`${date}T12:00:00`)
  cursor.setDate(cursor.getDate() + days)
  return toDateKey(cursor)
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function weekDateKeys(date: string): string[] {
  const start = startOfWeek(date)
  return Array.from({ length: 7 }, (_, index) => addDateKey(start, index))
}

export function monthDateKeys(date: string): string[] {
  const cursor = new Date(`${date}T12:00:00`)
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const days = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: days }, (_, index) => {
    const next = new Date(year, month, index + 1, 12)
    return toDateKey(next)
  })
}
