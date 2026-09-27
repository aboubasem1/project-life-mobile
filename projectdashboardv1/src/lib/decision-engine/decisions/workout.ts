/** Workout / ritual matching for Jo AI Capture → COMPLETE_ROUTINE. */

export type WorkoutMatch = {
  kind: 'ko' | 'pushups' | 'workout'
  count?: number
  title: string
}

const KO = /\b(ko|knockouts?|knock[-\s]?outs?)\b/i
const PUSHUPS = /\b(pushups?|liegestütze|liegestuetze)\b/i
const WORKOUT = /\b(workout|training)\b/i
const DONE = /\b(fertig|erledigt|gemacht|done|geschafft|absolviert)\b/i
const COUNT = /(\d{1,3})\s*(?:x|mal|reps?)?/i

export function matchWorkoutRoutine(text: string): WorkoutMatch | null {
  const raw = text.trim()
  if (!raw) return null

  const countMatch = raw.match(COUNT)
  const count = countMatch ? Number(countMatch[1]) : undefined
  const hasDone = DONE.test(raw)

  if (KO.test(raw) && (hasDone || count != null)) {
    // Avoid "KO Meeting" style phrases without done/count.
    if (!hasDone && count == null) return null
    return {
      kind: 'ko',
      count: Number.isFinite(count) ? count : undefined,
      title: count != null ? `${count} KO` : 'KO',
    }
  }

  if (PUSHUPS.test(raw) && (hasDone || count != null)) {
    return {
      kind: 'pushups',
      count: Number.isFinite(count) ? count : undefined,
      title: count != null ? `${count} Pushups` : 'Pushups',
    }
  }

  if (WORKOUT.test(raw) && hasDone) {
    return {
      kind: 'workout',
      title: 'Workout',
    }
  }

  return null
}

export function workoutEntities(match: WorkoutMatch): {
  title: string
  routineId: string
  quantity?: string
  domainHint: 'ROUTINE'
} {
  return {
    title: match.title,
    routineId: match.kind === 'workout' ? 'workout' : match.kind,
    ...(match.count != null ? { quantity: String(match.count) } : {}),
    domainHint: 'ROUTINE',
  }
}
