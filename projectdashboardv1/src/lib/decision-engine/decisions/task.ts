import type { DecisionContext, DecisionEntities, ProjectRef } from '../types.js'

const DUE_WORDS: Array<{ re: RegExp; days: number }> = [
  { re: /\bheute\b/i, days: 0 },
  { re: /\bmorgen\b/i, days: 1 },
  { re: /\bübermorgen\b/i, days: 2 },
]

const HIGH_PRIORITY = /\b(dringend|sofort|p1|claims?|deadline|fertig\s+machen)\b/i

export function dateKey(at: Date, timeZone = 'Europe/Berlin'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

export function shiftDateKey(base: Date, days: number, timeZone = 'Europe/Berlin'): string {
  const next = new Date(base.getTime() + days * 86_400_000)
  return dateKey(next, timeZone)
}

export function parseDueDate(text: string, now = new Date(), timeZone = 'Europe/Berlin'): string | undefined {
  for (const item of DUE_WORDS) {
    if (item.re.test(text)) return shiftDateKey(now, item.days, timeZone)
  }
  return undefined
}

export function inferPriority(text: string): DecisionEntities['priority'] {
  if (HIGH_PRIORITY.test(text)) return 'p2'
  return 'p3'
}

export function matchProject(text: string, projects: ProjectRef[] = []): ProjectRef | undefined {
  if (projects.length === 0) return undefined
  const hay = text.toLowerCase()
  const hits = projects.filter(project => {
    const aliases = [project.label, ...(project.aliases ?? [])]
    return aliases.some(alias => {
      const needle = alias.trim().toLowerCase()
      return needle.length >= 3 && hay.includes(needle)
    })
  })
  return hits.length === 1 ? hits[0] : undefined
}

export function taskTitle(text: string): string {
  return text
    .replace(/^\s*(task|todo|aufgabe)[:\s-]+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140)
}

export function taskEntities(text: string, context: DecisionContext): DecisionEntities {
  const now = context.now ?? new Date()
  const timeZone = context.timeZone ?? 'Europe/Berlin'
  const project = matchProject(text, context.projects ?? [])
  return {
    title: taskTitle(text),
    due: parseDueDate(text, now, timeZone),
    priority: inferPriority(text),
    projectId: project?.id,
    projectLabel: project?.label,
    relatedProject: project?.id,
  }
}
