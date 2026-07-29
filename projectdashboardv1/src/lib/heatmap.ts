import type { DashboardEntry } from '../types/DashboardEntry'

/** Year contribution grid for Verlauf (Everyday / Loggd style). */

export type HeatmapCell = {
  date: string
  score: number
  level: 0 | 1 | 2 | 3 | 4
}

function scoreLevel(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score <= 0) return 0
  if (score < 35) return 1
  if (score < 55) return 2
  if (score < 75) return 3
  return 4
}

function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Last ~365 days ending at `today`, Monday-aligned columns for a clean grid. */
export function buildYearHeatmap(
  entries: DashboardEntry[],
  today: string,
  scoreOf: (entry: DashboardEntry) => number,
): HeatmapCell[] {
  const byDate = new Map(entries.map(entry => [entry.date, entry]))
  const end = new Date(`${today}T12:00:00`)
  const start = new Date(end)
  start.setDate(start.getDate() - 364)

  // Align to Monday
  const startDow = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - startDow)

  const cells: HeatmapCell[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const key = dateKey(cursor)
    const entry = byDate.get(key)
    const score = entry ? Math.min(100, Math.max(0, Math.round(scoreOf(entry)))) : 0
    cells.push({ date: key, score, level: entry ? scoreLevel(score) : 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return cells
}

export const EVENING_PROMPTS = [
  'Was darfst du heute loslassen?',
  'Was hat heute gut funktioniert — auch wenn es klein war?',
  'Wofür bist du heute dankbar?',
  'Was braucht morgen nur 2 Minuten Start?',
  'Wen oder was willst du morgen schützen?',
  'Was war heute genug?',
  'Welcher Gedanke darf über Nacht draußen bleiben?',
]

export function eveningPromptForDate(dateKey: string): string {
  let hash = 0
  for (let i = 0; i < dateKey.length; i += 1) {
    hash = (hash + dateKey.charCodeAt(i) * (i + 1)) % EVENING_PROMPTS.length
  }
  return EVENING_PROMPTS[hash] ?? EVENING_PROMPTS[0]
}
