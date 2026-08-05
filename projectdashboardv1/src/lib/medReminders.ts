/** Opt-in medication reminders — never request permission here. */

export type ReminderMed = {
  id: string
  name: string
  time: string
  remind?: boolean
  taken?: boolean
  takenDate?: string
}

export type DueReminder = {
  id: string
  name: string
  time: string
}

/** Accepts "08:00", "8:00", "8 Uhr", "08.00". */
export function parseReminderTime(raw: string): { hours: number; minutes: number } | null {
  const value = String(raw ?? '').trim().toLowerCase()
  if (!value) return null
  const match = value.match(/^(\d{1,2})(?:[:.](\d{2}))?(?:\s*uhr)?$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return { hours, minutes }
}

export function isMedTakenToday(med: ReminderMed, today: string): boolean {
  if (med.takenDate === today) return true
  // Legacy seed/data used `taken` without a date — treat as taken once for today.
  if (med.taken && !med.takenDate) return true
  return false
}

/**
 * Due if remind is on, not taken today, time is valid, and now is at/after due
 * (until end of day). Callers must mark reminded after showing.
 */
export function dueMedicationReminders(
  meds: ReminderMed[],
  today: string,
  now: Date = new Date(),
): DueReminder[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return meds
    .filter(med => med.remind && !isMedTakenToday(med, today))
    .map(med => {
      const parsed = parseReminderTime(med.time)
      if (!parsed) return null
      const dueAt = parsed.hours * 60 + parsed.minutes
      if (nowMinutes < dueAt) return null
      return { id: med.id, name: med.name || 'Medikament', time: med.time }
    })
    .filter((item): item is DueReminder => Boolean(item))
}

export function reminderStorageKey(medId: string, today: string): string {
  return `life-os-med-reminded-${today}-${medId}`
}
