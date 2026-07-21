import type { DashboardEntry } from '../types/DashboardEntry'
import { calculateScore, type ScoreGoals } from './score'

export type LaborLiveOverview = {
  dateLabel: string
  syncStatus: string
  syncTime: string
  score: number
  habits: number
  habitsTotal: number
  todos: number
  todosTotal: number
  projects: number
}

export type LaborLiveStats = {
  average: number
  best: number
  rhythm: number
  weight: number
  weeklyBars: number[]
  weekDates: string[]
}

function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(key: string, amount: number): string {
  const date = new Date(`${key}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return dateKey(date)
}

function entryFor(entries: DashboardEntry[], date: string): DashboardEntry | undefined {
  return entries.find(item => item.date === date)
}

export function deriveLaborOverview(input: {
  entries: DashboardEntry[]
  today: string
  activeHabits: string[]
  openBoardCount: number
  goals?: ScoreGoals
}): LaborLiveOverview {
  const todayEntry = entryFor(input.entries, input.today)
  const score = todayEntry ? calculateScore(todayEntry, input.goals) : 0
  const habitsTotal = input.activeHabits.length
  const habits = input.activeHabits.filter(key => Boolean(todayEntry?.[key as keyof DashboardEntry])).length
  const anchors = todayEntry?.anchors ?? []
  const anchorsDone = todayEntry?.anchorsDone ?? []
  const todosTotal = anchors.length
  const todos = anchorsDone.filter(Boolean).length

  return {
    dateLabel: new Intl.DateTimeFormat('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(`${input.today}T12:00:00`)),
    syncStatus: 'Lokal',
    syncTime: 'nur dieses Gerät',
    score: Math.min(100, Math.max(0, Math.round(score))),
    habits,
    habitsTotal,
    todos,
    todosTotal,
    projects: input.openBoardCount,
  }
}

export function deriveLaborStats(input: {
  entries: DashboardEntry[]
  today: string
  goals?: ScoreGoals
}): LaborLiveStats {
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(input.today, index - 6))
  const weeklyBars = weekDates.map(date => {
    const entry = entryFor(input.entries, date)
    return entry ? Math.min(100, Math.max(0, Math.round(calculateScore(entry, input.goals)))) : 0
  })
  const average = Math.round(weeklyBars.reduce((sum, value) => sum + value, 0) / weeklyBars.length)
  const best = Math.max(0, ...weeklyBars)

  let rhythm = 0
  for (let index = weeklyBars.length - 1; index >= 0; index -= 1) {
    if (weeklyBars[index] > 0) rhythm += 1
    else break
  }

  const withWeight = [...input.entries]
    .filter(entry => entry.weightKg > 0)
    .sort((a, b) => b.date.localeCompare(a.date))

  return {
    average,
    best,
    rhythm,
    weight: withWeight[0]?.weightKg ?? 0,
    weeklyBars,
    weekDates,
  }
}

export function smartLaborHints(input: {
  energy?: 'low' | 'okay' | 'high'
  score: number
  openTodos: number
  lowStockCount: number
}): string[] {
  const hints: string[] = []
  if (input.energy === 'low') {
    hints.push('Low-Energy-Tag: im Labor nur das Nötigste anfassen.')
  }
  if (input.openTodos > 0) {
    hints.push(`${input.openTodos} offene Fokus-Todos — eines reicht oft.`)
  }
  if (input.lowStockCount > 0) {
    hints.push(`${input.lowStockCount} Bestände werden knapp.`)
  }
  if (input.score >= 75) {
    hints.push('Starker Tageskern — Labor eher für Verwaltung, nicht für mehr Druck.')
  }
  if (hints.length === 0) {
    hints.push('Labor ergänzt den Tageskern: Bestände, Boards, Liste — ohne den Fokus zu ersetzen.')
  }
  return hints.slice(0, 3)
}
