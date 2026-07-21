/** Day Policy Engine — turns energy + time into concrete day constraints. */

export type EnergyLevel = 'low' | 'okay' | 'high'
export type DayMode = 'morning' | 'day' | 'evening'

export type HabitIntensity = 'recovery' | 'steady' | 'demand'

export const HABIT_INTENSITY: Record<string, HabitIntensity> = {
  breathingDone: 'recovery',
  gratitudeDone: 'recovery',
  journalDone: 'recovery',
  proteinShake: 'steady',
  familyTimeDone: 'steady',
  coldShower: 'demand',
  pushupsDone: 'demand',
  squatsDone: 'demand',
  wallsitDone: 'demand',
  plankDone: 'demand',
  focusDone: 'demand',
  winnerModeDone: 'demand',
}

export type DayPolicy = {
  energy: EnergyLevel | undefined
  mode: DayMode
  maxAnchors: number
  focusMinutes: number
  badge: string
  anchorTitle: string
  emptyAnchorsText: string
  policyNote: string | null
  primaryHabitIds: string[]
  deferredHabitIds: string[]
  heroHabitCopy: string
}

export type RankableHabit = {
  key: string
  label: string
  minutes?: number
  done: boolean
}

export type RankedStep =
  | { kind: 'anchor'; index: number; title: string; score: number; streakHint?: string }
  | { kind: 'habit'; key: string; title: string; minutes?: number; score: number; streakHint?: string }

function intensityOf(habitId: string): HabitIntensity {
  return HABIT_INTENSITY[habitId] ?? 'steady'
}

function timeBand(hour: number): 'morning' | 'day' | 'evening' | 'night' {
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'day'
  if (hour >= 17 && hour < 23) return 'evening'
  return 'night'
}

export function getDayMode(hour = new Date().getHours()): DayMode {
  const band = timeBand(hour)
  if (band === 'morning') return 'morning'
  if (band === 'evening' || band === 'night') return 'evening'
  return 'day'
}

export function getDayPolicy(input: {
  energy?: EnergyLevel
  activeHabits: string[]
  baseFocusMinutes: number
  hour?: number
}): DayPolicy {
  const energy = input.energy
  const habits = input.activeHabits
  const hour = input.hour ?? new Date().getHours()
  const mode = getDayMode(hour)
  const base = Math.min(120, Math.max(5, input.baseFocusMinutes || 25))

  if (energy === 'low') {
    const primary = habits.filter(id => intensityOf(id) !== 'demand')
    const primaryHabitIds = primary.length > 0 ? primary : habits.slice(0, Math.min(2, habits.length))
    const deferredHabitIds = habits.filter(id => !primaryHabitIds.includes(id))
    return {
      energy,
      mode,
      maxAnchors: 2,
      focusMinutes: Math.min(base, 10),
      badge: 'Sanfter Tag',
      anchorTitle: 'Heute reicht wenig',
      emptyAnchorsText: 'Ein oder zwei sanfte Anker reichen. Mehr muss heute nicht sein.',
      policyNote: 'Energie niedrig: Routine auf Erholung reduziert. Anspruchsvolles ist optional.',
      primaryHabitIds,
      deferredHabitIds,
      heroHabitCopy: 'Klein starten. Das reicht für heute.',
    }
  }

  if (energy === 'high') {
    return {
      energy,
      mode,
      maxAnchors: 5,
      focusMinutes: Math.max(base, 25),
      badge: 'Tiefer Fokus',
      anchorTitle: 'Was heute zählt',
      emptyAnchorsText: 'Lege bis zu fünf klare Anker fest — du hast Kapazität.',
      policyNote: 'Energie gut: Raum für tieferen Fokus und ambitioniertere Schritte.',
      primaryHabitIds: habits,
      deferredHabitIds: [],
      heroHabitCopy: 'Nutze den Schwung für einen klaren Block.',
    }
  }

  if (energy === 'okay') {
    return {
      energy,
      mode,
      maxAnchors: 3,
      focusMinutes: base,
      badge: 'Ruhiger Fokus',
      anchorTitle: 'Was heute zählt',
      emptyAnchorsText: 'Lege ein bis drei klare Anker fest. Mehr muss heute nicht sein.',
      policyNote: 'Machbarer Tag: halte den Plan bewusst klein.',
      primaryHabitIds: habits,
      deferredHabitIds: [],
      heroHabitCopy: 'Ein kleiner Anker bringt wieder Ruhe in den Tag.',
    }
  }

  return {
    energy: undefined,
    mode,
    maxAnchors: mode === 'morning' ? 3 : 5,
    focusMinutes: base,
    badge: mode === 'evening' ? 'Abendmodus' : 'Ruhiger Fokus',
    anchorTitle: mode === 'evening' ? 'Was noch zählt' : 'Was heute zählt',
    emptyAnchorsText: mode === 'morning'
      ? 'Ein klarer Morgenanker reicht oft schon.'
      : 'Lege ein bis drei klare Anker fest. Mehr muss heute nicht sein.',
    policyNote: mode === 'evening'
      ? 'Abend: lieber abschließen als noch einmal groß planen.'
      : null,
    primaryHabitIds: habits,
    deferredHabitIds: [],
    heroHabitCopy: mode === 'evening'
      ? 'Kurz schließen, dann loslassen.'
      : 'Ein kleiner Anker bringt wieder Ruhe in den Tag.',
  }
}

/** Rank incomplete anchors + habits for "Dein nächster Schritt". */
export function rankNextSteps(input: {
  anchors: string[]
  anchorsDone: boolean[]
  habits: RankableHabit[]
  energy?: EnergyLevel
  hour?: number
  streakByKey?: Record<string, number>
}): RankedStep[] {
  const hour = input.hour ?? new Date().getHours()
  const band = timeBand(hour)
  const energy = input.energy
  const streaks = input.streakByKey ?? {}
  const ranked: RankedStep[] = []

  input.anchors.forEach((title, index) => {
    if (input.anchorsDone[index]) return
    let score = 100 - index * 4
    if (energy === 'low') score += 8
    if (energy === 'high' && band === 'day') score += 6
    ranked.push({ kind: 'anchor', index, title, score })
  })

  for (const habit of input.habits) {
    if (habit.done) continue
    const intensity = intensityOf(habit.key)
    let score = 40
    const streak = streaks[habit.key] ?? 0
    let streakHint: string | undefined

    if (energy === 'low') {
      if (intensity === 'recovery') score += 28
      else if (intensity === 'steady') score += 12
      else score -= 20
    } else if (energy === 'high') {
      if (intensity === 'demand') score += 22
      else if (intensity === 'steady') score += 10
      else score += 4
    } else {
      if (intensity === 'steady') score += 14
      else if (intensity === 'recovery') score += 10
      else score += 8
    }

    if (band === 'morning') {
      if (intensity === 'demand') score += 10
      if (habit.key === 'breathingDone' || habit.key === 'proteinShake') score += 6
    } else if (band === 'day') {
      if (habit.key === 'focusDone' || intensity === 'demand') score += 12
    } else if (band === 'evening') {
      if (intensity === 'recovery' || habit.key === 'journalDone' || habit.key === 'gratitudeDone') score += 16
      if (intensity === 'demand') score -= 8
    } else {
      if (intensity === 'recovery') score += 20
      if (intensity === 'demand') score -= 25
    }

    // Protect active streaks without overpowering open anchors
    if (streak >= 3) {
      const boost = Math.min(18, 8 + streak * 2)
      score += boost
      streakHint = `Streak ${streak} retten`
    }

    ranked.push({
      kind: 'habit',
      key: habit.key,
      title: habit.label,
      minutes: habit.minutes,
      score,
      streakHint,
    })
  }

  return ranked.sort((a, b) => b.score - a.score)
}

export function pickNextStep(input: Parameters<typeof rankNextSteps>[0]): RankedStep | null {
  return rankNextSteps(input)[0] ?? null
}
