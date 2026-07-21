import type { DashboardEntry } from '../types/DashboardEntry'

export type WeekInsight = {
  id: string
  title: string
  text: string
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** Parse UI sleep labels like "<5h", "6.5h", ">8h" into comparable hours. */
function parseSleepHours(raw: string): number | null {
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

/** Lightweight, explainable insights from recent entries — no ML. */
export function buildWeekInsights(entries: DashboardEntry[], today: string): WeekInsight[] {
  const recent = [...entries]
    .filter(entry => entry.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14)

  if (recent.length < 3) {
    return [{
      id: 'warming-up',
      title: 'Noch zu früh für Muster',
      text: 'Nach ein paar Check-ins zeigt der Verlauf, was dich trägt — und was du streichen kannst.',
    }]
  }

  const insights: WeekInsight[] = []

  const withSleep = recent.filter(entry => parseSleepHours(entry.sleepDuration) !== null)

  if (withSleep.length >= 4) {
    const short = withSleep.filter(entry => {
      const hours = parseSleepHours(entry.sleepDuration)
      return hours !== null && hours < 6.5
    })
    const rest = withSleep.filter(entry => !short.includes(entry))
    if (short.length >= 2 && rest.length >= 2) {
      const shortAvg = average(short.map(entry => entry.dailyScore || 0))
      const restAvg = average(rest.map(entry => entry.dailyScore || 0))
      if (restAvg - shortAvg >= 8) {
        insights.push({
          id: 'sleep-score',
          title: 'Schlaf prägt den Score',
          text: `An Tagen mit unter 6,5 h Schlaf lag der Schnitt bei ${Math.round(shortAvg)}% — sonst bei ${Math.round(restAvg)}%. Soft-Mode nach kurzen Nächten lohnt sich.`,
        })
      }
    }
  }

  const lowEnergy = recent.filter(entry => entry.energyLevel === 'low')
  const highEnergy = recent.filter(entry => entry.energyLevel === 'high')
  if (lowEnergy.length >= 2 && highEnergy.length >= 2) {
    const lowDone = average(lowEnergy.map(entry => {
      const anchors = entry.anchors ?? []
      const done = entry.anchorsDone ?? []
      if (anchors.length === 0) return entry.dailyScore || 0
      return (done.filter(Boolean).length / anchors.length) * 100
    }))
    const highDone = average(highEnergy.map(entry => {
      const anchors = entry.anchors ?? []
      const done = entry.anchorsDone ?? []
      if (anchors.length === 0) return entry.dailyScore || 0
      return (done.filter(Boolean).length / anchors.length) * 100
    }))
    if (highDone - lowDone >= 10) {
      insights.push({
        id: 'energy-anchors',
        title: 'Energie steuert Abschluss',
        text: `Bei hoher Energie schaffst du Anker spürbar öfter (${Math.round(highDone)}% vs. ${Math.round(lowDone)}% bei niedriger). Weniger planen an Low-Tagen ist smart — nicht faul.`,
      })
    }
  }

  const habitKeys: Array<{ key: keyof DashboardEntry; label: string }> = [
    { key: 'gratitudeDone', label: 'Dankbarkeit' },
    { key: 'proteinShake', label: 'Protein Shake' },
    { key: 'breathingDone', label: 'Atmung' },
    { key: 'focusDone', label: 'Deep Focus' },
    { key: 'pushupsDone', label: 'Pushups' },
  ]

  let best: { label: string; rate: number } | null = null
  for (const habit of habitKeys) {
    const rate = recent.filter(entry => Boolean(entry[habit.key])).length / recent.length
    if (!best || rate > best.rate) best = { label: habit.label, rate }
  }
  if (best && best.rate >= 0.4) {
    insights.push({
      id: 'habit-carrier',
      title: 'Dein Träger-Ritual',
      text: `${best.label} läuft in ${Math.round(best.rate * 100)}% der letzten ${recent.length} Tage mit. Das ist ein Anker, den du schützen solltest.`,
    })
  }

  const lowSleepQuality = recent.filter(entry => entry.sleepQuality === 'Schlecht' || entry.sleepQuality === 'Okay')
  if (lowSleepQuality.length >= 3) {
    const demandOnLowSleep = lowSleepQuality.filter(entry => entry.coldShower || entry.pushupsDone || entry.focusDone).length
    if (demandOnLowSleep / lowSleepQuality.length >= 0.5) {
      insights.push({
        id: 'recover-after-bad-sleep',
        title: 'Nach schwachem Schlaf oft Vollgas',
        text: 'An Tagen mit schwächerem Schlaf startest du trotzdem oft fordernde Rituale. Erholung zuerst erhöht die Chance, dass der Rest gelingt.',
      })
    }
  }

  if (insights.length === 0) {
    insights.push({
      id: 'steady',
      title: 'Gleichmäßiger Rhythmus',
      text: 'Noch kein starkes Muster — und das ist okay. Weiter tracken; die Woche zeigt den Trend klarer als ein einzelner Tag.',
    })
  }

  return insights.slice(0, 3)
}
