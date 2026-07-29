import type { DashboardEntry } from '../types/DashboardEntry'

export function parseSleepHours(raw: string): number | null {
  const value = String(raw).trim().toLowerCase()
  if (!value) return null
  if (value.startsWith('<')) {
    const n = Number.parseFloat(value.slice(1).replace(',', '.').replace('h', ''))
    return Number.isFinite(n) ? Math.max(0, n - 0.5) : null
  }
  if (value.startsWith('>')) {
    const n = Number.parseFloat(value.slice(1).replace(',', '.').replace('h', ''))
    return Number.isFinite(n) ? n + 0.5 : null
  }
  const n = Number.parseFloat(value.replace(',', '.').replace('h', ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Minutes between bed and wake, crossing midnight when needed. */
export function hoursBetweenTimes(bedTime: string, wakeTime: string): number | null {
  const bed = parseClock(bedTime)
  const wake = parseClock(wakeTime)
  if (bed === null || wake === null) return null
  let minutes = wake - bed
  if (minutes <= 0) minutes += 24 * 60
  if (minutes > 16 * 60) return null
  return Math.round((minutes / 60) * 10) / 10
}

function parseClock(raw: string): number | null {
  const match = String(raw).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

export function formatSleepHoursLabel(hours: number): string {
  const safe = Math.max(0, Math.min(16, hours))
  const whole = Math.floor(safe)
  const minutes = Math.round((safe - whole) * 60)
  if (minutes === 0) return `${whole}h`
  if (minutes === 30) return `${whole}.5h`
  return `${Math.round(safe * 10) / 10}h`
}

export function sleepHoursForEntry(entry: DashboardEntry): number | null {
  if (entry.bedTime && entry.wakeTime) {
    const fromTimes = hoursBetweenTimes(entry.bedTime, entry.wakeTime)
    if (fromTimes !== null) return fromTimes
  }
  return parseSleepHours(entry.sleepDuration)
}

export function averageSleepHours(entries: DashboardEntry[], today: string, days = 7): number | null {
  const start = offsetDate(today, -(days - 1))
  const values = entries
    .filter(entry => entry.date >= start && entry.date <= today)
    .map(sleepHoursForEntry)
    .filter((value): value is number => value !== null)
  if (values.length === 0) return null
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

export type WeightInsights = {
  latestKg: number | null
  delta7: number | null
  delta30: number | null
  bmi: number | null
  bmiLabel: string | null
  trendLabel: string
}

export function buildWeightInsights(
  entries: DashboardEntry[],
  _today: string,
  heightCm = 0,
): WeightInsights {
  const sorted = [...entries]
    .filter(entry => entry.weightKg > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (sorted.length === 0) {
    return {
      latestKg: null,
      delta7: null,
      delta30: null,
      bmi: null,
      bmiLabel: null,
      trendLabel: 'Noch kein Gewicht',
    }
  }

  const latest = sorted[sorted.length - 1]
  const delta7 = deltaSince(sorted, latest.date, 7)
  const delta30 = deltaSince(sorted, latest.date, 30)
  const bmi = heightCm >= 120 ? calcBmi(latest.weightKg, heightCm) : null

  let trendLabel = 'Stabil'
  if (delta7 !== null) {
    if (delta7 <= -0.4) trendLabel = 'Leicht abwärts'
    else if (delta7 >= 0.4) trendLabel = 'Leicht aufwärts'
  }

  return {
    latestKg: latest.weightKg,
    delta7,
    delta30,
    bmi,
    bmiLabel: bmi === null ? null : bmiCategory(bmi),
    trendLabel,
  }
}

function deltaSince(
  sorted: DashboardEntry[],
  latestDate: string,
  days: number,
): number | null {
  const cutoff = offsetDate(latestDate, -days)
  const baseline = [...sorted].reverse().find(entry => entry.date <= cutoff)
    ?? sorted.find(entry => entry.date < latestDate)
  if (!baseline || baseline.date === latestDate) return null
  const latest = sorted[sorted.length - 1]
  return Math.round((latest.weightKg - baseline.weightKg) * 10) / 10
}

export function calcBmi(weightKg: number, heightCm: number): number | null {
  if (weightKg <= 0 || heightCm < 120) return null
  const meters = heightCm / 100
  return Math.round((weightKg / (meters * meters)) * 10) / 10
}

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Untergewicht'
  if (bmi < 25) return 'Normal'
  if (bmi < 30) return 'Übergewicht'
  return 'Adipositas'
}

export function macroProgress(value: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(100, Math.round((value / goal) * 100))
}

function offsetDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
