/** Build and share/download iCalendar (.ics) events for Apple Calendar. */

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** UTC timestamp for ICS (YYYYMMDDTHHMMSSZ). */
export function formatIcsUtc(date: Date): string {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    'T',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    'Z',
  ].join('')
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = []
  let rest = line
  chunks.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 0) {
    chunks.push(` ${rest.slice(0, 74)}`)
    rest = rest.slice(74)
  }
  return chunks.join('\r\n')
}

export type IcsEventInput = {
  title: string
  minutes: number
  start?: Date
  description?: string
  uid?: string
}

export function buildIcsEvent(input: IcsEventInput): string {
  const start = input.start ?? new Date()
  const end = new Date(start.getTime() + Math.max(5, input.minutes) * 60_000)
  const uid = input.uid ?? `life-os-${start.getTime()}-${Math.random().toString(36).slice(2, 10)}@life-os`
  const stamp = formatIcsUtc(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Life OS//Focus//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatIcsUtc(start)}`,
    `DTEND:${formatIcsUtc(end)}`,
    foldIcsLine(`SUMMARY:${escapeIcsText(input.title.trim() || 'Fokus')}`),
    foldIcsLine(`DESCRIPTION:${escapeIcsText(input.description ?? 'Aus Life OS')}`),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.join('\r\n')}\r\n`
}

function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export type IcsShareResult = 'shared' | 'downloaded' | 'failed'

/** Prefer Share Sheet (iOS → Kalender), else download .ics. */
export async function shareOrDownloadIcs(
  input: IcsEventInput,
  filename = 'life-os-fokus.ics',
): Promise<IcsShareResult> {
  const content = buildIcsEvent(input)
  const file = new File([content], filename, { type: 'text/calendar' })

  try {
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: input.title,
        text: input.description ?? input.title,
      })
      return 'shared'
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'failed'
  }

  try {
    downloadTextFile(filename, content, 'text/calendar;charset=utf-8')
    return 'downloaded'
  } catch {
    return 'failed'
  }
}
