export type QuickNoteState = {
  text: string
  updatedAt: string | null
}

export const QUICK_NOTE_MAX = 600

export function formatNoteLine(text: string, at = new Date()): string {
  const time = new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(at)
  return `${time} — ${text.trim()}`
}

export function appendJournal(existing: string, line: string): string {
  const current = existing.trim()
  return current ? `${current}\n${line}` : line
}

export function mergeQuickNote(existing: QuickNoteState | null | undefined, line: string, at = new Date()): QuickNoteState {
  const prior = existing?.text?.trim() ?? ''
  const next = prior ? `${line}\n${prior}` : line
  return {
    text: next.slice(0, QUICK_NOTE_MAX),
    updatedAt: at.toISOString(),
  }
}

export function parseQuickNote(raw: unknown): QuickNoteState | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Partial<QuickNoteState>
  if (typeof record.text !== 'string') return null
  return {
    text: record.text.slice(0, QUICK_NOTE_MAX),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
  }
}

export function mergeJournalTexts(left: string, right: string): string {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const raw of `${left}\n${right}`.split('\n')) {
    const line = raw.trim()
    if (!line || seen.has(line)) continue
    seen.add(line)
    lines.push(line)
  }
  return lines.join('\n')
}

export function mergeQuickNoteStates(
  left: QuickNoteState | null | undefined,
  right: QuickNoteState | null | undefined,
): QuickNoteState | null {
  if (!left && !right) return null
  const text = mergeJournalTexts(left?.text ?? '', right?.text ?? '')
  const stamps = [left?.updatedAt, right?.updatedAt]
    .filter((value): value is string => Boolean(value))
    .sort()
  return {
    text: text.slice(0, QUICK_NOTE_MAX),
    updatedAt: stamps[stamps.length - 1] ?? new Date().toISOString(),
  }
}

export function mergeDayJournal<T extends {
  journalText?: unknown
  journalDone?: unknown
}>(newer: T, older: T): T {
  const journalText = mergeJournalTexts(String(older.journalText ?? ''), String(newer.journalText ?? ''))
  return {
    ...newer,
    journalText,
    journalDone: Boolean(journalText.trim()) || Boolean(newer.journalDone) || Boolean(older.journalDone),
  }
}
