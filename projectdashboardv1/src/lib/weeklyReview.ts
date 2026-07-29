import type { DashboardEntry } from '../types/DashboardEntry'
import { calculateScore, type ScoreGoals } from './score'

export type WeeklyReview = {
  weekLabel: string
  averageScore: number
  bestDay: string
  bestScore: number
  quietDays: number
  win: string
  keep: string
  nextAnchors: string[]
  isReviewDay: boolean
}

function weekdayLabel(date: string): string {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(`${date}T12:00:00`))
}

function offsetDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Sunday (DE: review day) or always available as summary for last 7 days. */
export function buildWeeklyReview(
  entries: DashboardEntry[],
  today: string,
  goals?: ScoreGoals,
): WeeklyReview {
  const weekDates = Array.from({ length: 7 }, (_, i) => offsetDate(today, i - 6))
  const scored = weekDates.map(date => {
    const entry = entries.find(item => item.date === date)
    const score = entry ? Math.round(calculateScore(entry, goals)) : 0
    return { date, entry, score }
  })

  const withData = scored.filter(item => item.entry)
  const averageScore = withData.length
    ? Math.round(withData.reduce((sum, item) => sum + item.score, 0) / withData.length)
    : 0
  const best = withData.reduce(
    (acc, item) => (item.score > acc.score ? item : acc),
    { date: today, score: 0, entry: undefined as DashboardEntry | undefined },
  )
  const quietDays = scored.filter(item => item.score > 0 && item.score < 35).length

  let win = 'Noch zu wenig Daten — diese Woche einfach weiter eintragen.'
  if (best.score >= 75) {
    win = `${weekdayLabel(best.date)} war stark (${best.score}%). Merke, was dort funktioniert hat.`
  } else if (best.score >= 45) {
    win = `Bester Tag: ${weekdayLabel(best.date)} mit ${best.score}%. Kleine Wins zählen.`
  } else if (withData.length > 0) {
    win = 'Die Woche war eher leicht — das ist ok. Soft-Mode war vermutlich richtig.'
  }

  let keep = 'Ein klarer Morgenanker und eine kurze Abendnotiz reichen oft.'
  if (quietDays >= 2) {
    keep = 'Nach ruhigen Tagen: nie zwei schwere Tage hintereinander erzwingen.'
  } else if (averageScore >= 60) {
    keep = 'Rhythmus hält — lieber denselben kleinen Block behalten als aufblasen.'
  }

  const nextAnchors = [
    'Ein Anker unter 25 Minuten',
    averageScore < 50 ? 'Schlaf zuerst schützen' : 'Ein Fokusblock ohne Handy',
    'Eine Sache für morgen schon heute notieren',
  ]

  const dow = new Date(`${today}T12:00:00`).getDay() // 0 = Sunday
  const isReviewDay = dow === 0 || dow === 1 // So/Mo

  return {
    weekLabel: `${weekdayLabel(weekDates[0])} – ${weekdayLabel(weekDates[6])}`,
    averageScore,
    bestDay: weekdayLabel(best.date),
    bestScore: best.score,
    quietDays,
    win,
    keep,
    nextAnchors,
    isReviewDay,
  }
}

export type WeightPoint = { date: string; kg: number }

export function buildWeightSeries(entries: DashboardEntry[], today: string, days = 30): WeightPoint[] {
  const start = offsetDate(today, -(days - 1))
  return [...entries]
    .filter(entry => entry.date >= start && entry.date <= today && entry.weightKg > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(entry => ({ date: entry.date, kg: entry.weightKg }))
}
