/** Central Life Areas taxonomy — one definition, referenced everywhere. */

export type LifeAreaKey = 'work' | 'health' | 'growth' | 'creativity' | 'relationships' | 'life'

export type LifeArea = {
  id: string
  key: LifeAreaKey
  name: string
  description: string
  sortOrder: number
  active: boolean
}

export type AreaIntention = 'high' | 'medium' | 'low'

export type AreaSource = 'explicit' | 'project' | 'goal' | 'unclassified'

export type ResolvedArea = {
  key: LifeAreaKey | null
  source: AreaSource
}

export type AreaFilter = 'all' | LifeAreaKey | 'unclassified'

/** Reserved for later many-to-many Needs. Not a product surface yet. */
export const FUTURE_NEED_KEYS = [
  'energy', 'connection', 'recovery', 'expression', 'security', 'mastery', 'meaning', 'fun',
] as const

export type FutureNeedKey = (typeof FUTURE_NEED_KEYS)[number]

export const LIFE_AREAS: LifeArea[] = [
  { id: 'area-work', key: 'work', name: 'Work', description: 'Beruf, Business, Karriere, Administration, finanzielle Arbeit.', sortOrder: 1, active: true },
  { id: 'area-health', key: 'health', name: 'Health', description: 'Körper, Psyche, Schlaf, Ernährung, Training, Regeneration.', sortOrder: 2, active: true },
  { id: 'area-growth', key: 'growth', name: 'Growth', description: 'Lernen, Skills, Lesen, Weiterbildung, Reflexion.', sortOrder: 3, active: true },
  { id: 'area-creativity', key: 'creativity', name: 'Creativity', description: 'Musik, Design, Schreiben, Ideen, persönlicher Ausdruck.', sortOrder: 4, active: true },
  { id: 'area-relationships', key: 'relationships', name: 'Relationships', description: 'Familie, Freunde, Partnerschaft, soziale Kontakte.', sortOrder: 5, active: true },
  { id: 'area-life', key: 'life', name: 'Life', description: 'Freizeit, Haushalt, Reisen, Natur, Organisation.', sortOrder: 6, active: true },
]

const AREA_KEYS = new Set<LifeAreaKey>(LIFE_AREAS.map(item => item.key))

export const LIFE_AREA_LABELS: Record<LifeAreaKey, string> = {
  work: 'Work',
  health: 'Health',
  growth: 'Growth',
  creativity: 'Creativity',
  relationships: 'Relationships',
  life: 'Life',
}

export function isLifeAreaKey(value: unknown): value is LifeAreaKey {
  return typeof value === 'string' && AREA_KEYS.has(value as LifeAreaKey)
}

/** Invalid / empty values stay unclassified. Never invent a category. */
export function parseLifeArea(value: unknown): LifeAreaKey | undefined {
  if (value == null || value === '') return undefined
  if (typeof value !== 'string') return undefined
  const key = value.trim().toLowerCase()
  if (key === 'unclassified' || key === 'none' || key === 'null') return undefined
  return isLifeAreaKey(key) ? key : undefined
}

/** Reserved many-to-many Needs. Stored if present, never required or invented. */
export function parseNeedKeys(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const keys = value
    .map(item => typeof item === 'string' ? item.trim().toLowerCase() : '')
    .filter(Boolean)
  return keys.length > 0 ? [...new Set(keys)] : undefined
}

export function normalizeAreaIntentions(value: unknown): Partial<Record<LifeAreaKey, AreaIntention>> {
  if (!value || typeof value !== 'object') return {}
  const next: Partial<Record<LifeAreaKey, AreaIntention>> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const area = parseLifeArea(key)
    if (area && (raw === 'high' || raw === 'medium' || raw === 'low')) next[area] = raw
  }
  return next
}

export function groupByResolvedArea<T>(
  items: T[],
  resolve: (item: T) => LifeAreaKey | null,
): Array<{ key: LifeAreaKey | 'unclassified'; label: string; items: T[] }> {
  const groups: Array<{ key: LifeAreaKey | 'unclassified'; label: string; items: T[] }> = LIFE_AREAS.map(area => ({
    key: area.key,
    label: area.name,
    items: [],
  }))
  groups.push({ key: 'unclassified', label: 'Unclassified', items: [] })
  for (const item of items) {
    const key = resolve(item) ?? 'unclassified'
    const group = groups.find(entry => entry.key === key)
    group?.items.push(item)
  }
  return groups.filter(group => group.items.length > 0)
}

export function areaLabel(key: LifeAreaKey | null | undefined): string {
  return key ? LIFE_AREA_LABELS[key] : 'Unclassified'
}

export function resolveLifeArea(input: {
  explicit?: LifeAreaKey | null
  project?: { lifeArea?: LifeAreaKey | null; goalId?: string } | null
  goal?: { lifeArea?: LifeAreaKey | null } | null
}): ResolvedArea {
  if (isLifeAreaKey(input.explicit)) return { key: input.explicit, source: 'explicit' }
  if (isLifeAreaKey(input.project?.lifeArea)) return { key: input.project.lifeArea, source: 'project' }
  if (isLifeAreaKey(input.goal?.lifeArea)) return { key: input.goal.lifeArea, source: 'goal' }
  return { key: null, source: 'unclassified' }
}

export function matchesAreaFilter(resolved: ResolvedArea, filter: AreaFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'unclassified') return resolved.key == null
  return resolved.key === filter
}

export type AreaItem = {
  id: string
  lifeArea?: LifeAreaKey | null
  projectId?: string
  goalId?: string
  date?: string
  done?: boolean
  plannedMinutes?: number
  actualMinutes?: number
  kind: 'task' | 'project' | 'goal' | 'activity' | 'capture' | 'knowledge' | 'decision' | 'signal'
}

export type AreaSlice = {
  key: LifeAreaKey | 'unclassified'
  actualMinutes: number
  plannedMinutes: number
  completedTasks: number
  activeProjects: number
  goals: number
}

export type AreaDistribution = {
  periodStart: string
  periodEnd: string
  classifiedCount: number
  totalCount: number
  coverage: number
  hasTimeData: boolean
  reliable: boolean
  slices: AreaSlice[]
}

function emptySlice(key: LifeAreaKey | 'unclassified'): AreaSlice {
  return { key, actualMinutes: 0, plannedMinutes: 0, completedTasks: 0, activeProjects: 0, goals: 0 }
}

function offsetDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-')
}

export function inDateRange(date: string | undefined, start: string, end: string): boolean {
  if (!date) return false
  return date >= start && date <= end
}

export function buildAreaDistribution(input: {
  periodStart: string
  periodEnd: string
  items: Array<AreaItem & { resolved: ResolvedArea }>
  scope?: 'period' | 'snapshot'
}): AreaDistribution {
  const slices = new Map<LifeAreaKey | 'unclassified', AreaSlice>()
  for (const area of LIFE_AREAS) slices.set(area.key, emptySlice(area.key))
  slices.set('unclassified', emptySlice('unclassified'))

  let classifiedCount = 0
  let totalCount = 0
  let hasTimeData = false
  const scope = input.scope ?? 'period'

  for (const item of input.items) {
    const snapshotKind = item.kind === 'project' || item.kind === 'goal'
    if (scope === 'period' && !snapshotKind && !inDateRange(item.date, input.periodStart, input.periodEnd)) {
      continue
    }
    if (scope === 'snapshot' && item.date && !inDateRange(item.date, input.periodStart, input.periodEnd) && !snapshotKind) {
      continue
    }
    totalCount += 1
    const key = item.resolved.key ?? 'unclassified'
    if (item.resolved.key) classifiedCount += 1
    const slice = slices.get(key) ?? emptySlice(key)
    if (item.actualMinutes != null && item.actualMinutes > 0) {
      slice.actualMinutes += item.actualMinutes
      hasTimeData = true
    }
    if (item.plannedMinutes != null && item.plannedMinutes > 0) {
      slice.plannedMinutes += item.plannedMinutes
    }
    if (item.kind === 'task' && item.done) slice.completedTasks += 1
    if (item.kind === 'project') slice.activeProjects += 1
    if (item.kind === 'goal') slice.goals += 1
    slices.set(key, slice)
  }

  const coverage = totalCount === 0 ? 0 : classifiedCount / totalCount
  const reliable = totalCount > 0 && coverage >= 0.4 && (hasTimeData || classifiedCount >= 3)

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    classifiedCount,
    totalCount,
    coverage,
    hasTimeData,
    reliable,
    slices: [...slices.values()],
  }
}

export function areaShare(slice: AreaSlice, totalActual: number): number | null {
  if (totalActual <= 0 || slice.key === 'unclassified') return null
  return slice.actualMinutes / totalActual
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0m'
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${String(rest).padStart(2, '0')}m`
}

export function collectAreaItems(input: {
  projects: Array<{
    id: string
    status?: string
    lifeArea?: LifeAreaKey | null
    goalId?: string
    tasks: Array<{ id: string; done: boolean; lifeArea?: LifeAreaKey | null; plannedMinutes?: number; actualMinutes?: number }>
  }>
  goals: Array<{ id: string; lifeArea?: LifeAreaKey | null; status?: string }>
  activities: Array<{
    id: string
    date: string
    projectId?: string
    goalId?: string
    lifeArea?: LifeAreaKey | null
    plannedDurationMin?: number
    actualDurationMin?: number
  }>
}): Array<AreaItem & { resolved: ResolvedArea }> {
  const goalsById = new Map(input.goals.map(goal => [goal.id, goal]))
  const items: Array<AreaItem & { resolved: ResolvedArea }> = []

  for (const goal of input.goals) {
    if (goal.status === 'dropped') continue
    items.push({
      id: goal.id,
      kind: 'goal',
      lifeArea: goal.lifeArea,
      resolved: resolveLifeArea({ explicit: goal.lifeArea }),
    })
  }

  for (const project of input.projects) {
    if (project.status === 'archived') continue
    const goal = project.goalId ? goalsById.get(project.goalId) : undefined
    const projectResolved = resolveLifeArea({ explicit: project.lifeArea, goal })
    items.push({
      id: project.id,
      kind: 'project',
      lifeArea: project.lifeArea,
      goalId: project.goalId,
      resolved: projectResolved,
    })
    for (const task of project.tasks) {
      items.push({
        id: task.id,
        kind: 'task',
        done: task.done,
        lifeArea: task.lifeArea,
        projectId: project.id,
        goalId: project.goalId,
        plannedMinutes: task.plannedMinutes,
        actualMinutes: task.actualMinutes,
        resolved: resolveLifeArea({ explicit: task.lifeArea, project, goal }),
      })
    }
  }

  for (const activity of input.activities) {
    const project = input.projects.find(item => item.id === activity.projectId)
    const goal = activity.goalId
      ? goalsById.get(activity.goalId)
      : project?.goalId
        ? goalsById.get(project.goalId)
        : undefined
    items.push({
      id: activity.id,
      kind: 'activity',
      date: activity.date,
      projectId: activity.projectId,
      goalId: activity.goalId,
      lifeArea: activity.lifeArea,
      plannedMinutes: activity.plannedDurationMin,
      actualMinutes: activity.actualDurationMin,
      resolved: resolveLifeArea({ explicit: activity.lifeArea, project, goal }),
    })
  }

  return items
}

export function buildAreaInsights(input: {
  today: string
  projects: Array<{
    id: string
    label: string
    status?: string
    lifeArea?: LifeAreaKey | null
    goalId?: string
    lastActivityAt?: string
  }>
  goals: Array<{ id: string; lifeArea?: LifeAreaKey | null; status?: string }>
  current: AreaDistribution
  previous: AreaDistribution
}): Array<{
  type: string
  title: string
  message: string
  evidence: Array<{ label: string; value: string }>
  confidence: number
  suggestedAction?: string
}> {
  const insights: Array<{
    type: string
    title: string
    message: string
    evidence: Array<{ label: string; value: string }>
    confidence: number
    suggestedAction?: string
  }> = []

  const active = input.projects.filter(project => project.status !== 'done' && project.status !== 'archived')
  const classifiedProjects = active.filter(project => {
    const goal = project.goalId ? input.goals.find(item => item.id === project.goalId) : undefined
    return resolveLifeArea({ explicit: project.lifeArea, goal }).key != null
  })
  const workProjects = classifiedProjects.filter(project => {
    const goal = project.goalId ? input.goals.find(item => item.id === project.goalId) : undefined
    return resolveLifeArea({ explicit: project.lifeArea, goal }).key === 'work'
  })
  if (classifiedProjects.length >= 3 && workProjects.length / classifiedProjects.length >= 0.8) {
    insights.push({
      type: 'area_project_concentration',
      title: 'Projekte häufen sich in Work',
      message: `${workProjects.length} von ${classifiedProjects.length} aktiven, klassifizierten Projekten gehören zu Work.`,
      evidence: [
        { label: 'Work-Projekte', value: String(workProjects.length) },
        { label: 'Klassifizierte Projekte', value: String(classifiedProjects.length) },
      ],
      confidence: 0.9,
    })
  }

  if (input.current.reliable && input.previous.reliable && input.current.hasTimeData && input.previous.hasTimeData) {
    const currentTotal = input.current.slices.reduce((sum, slice) => slice.key === 'unclassified' ? sum : sum + slice.actualMinutes, 0)
    const previousTotal = input.previous.slices.reduce((sum, slice) => slice.key === 'unclassified' ? sum : sum + slice.actualMinutes, 0)
    for (const area of LIFE_AREAS) {
      const now = input.current.slices.find(slice => slice.key === area.key)?.actualMinutes ?? 0
      const before = input.previous.slices.find(slice => slice.key === area.key)?.actualMinutes ?? 0
      if (before < 30 || currentTotal <= 0 || previousTotal <= 0) continue
      const nowShare = now / currentTotal
      const beforeShare = before / previousTotal
      if (beforeShare >= 0.08 && nowShare <= beforeShare * 0.55) {
        insights.push({
          type: 'area_time_decrease',
          title: `${area.name}: weniger erfasste Zeit`,
          message: `Erfasste ${area.name}-Zeit ist in den letzten ${daysIn(input.current)} Tagen niedriger als in den ${daysIn(input.previous)} Tagen davor.`,
          evidence: [
            { label: 'Aktuell', value: formatMinutes(now) },
            { label: 'Davor', value: formatMinutes(before) },
          ],
          confidence: 0.78,
        })
      }
    }
  }

  for (const area of LIFE_AREAS) {
    const related = active.filter(project => {
      const goal = project.goalId ? input.goals.find(item => item.id === project.goalId) : undefined
      return resolveLifeArea({ explicit: project.lifeArea, goal }).key === area.key
    })
    if (related.length === 0) continue
    const latest = related
      .map(project => project.lastActivityAt?.slice(0, 10))
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1)
    if (!latest) continue
    const idle = Math.round((Date.parse(`${input.today}T12:00:00`) - Date.parse(`${latest}T12:00:00`)) / 86_400_000)
    if (idle >= 14) {
      insights.push({
        type: 'area_inactive',
        title: `${area.name}: keine erfasste Aktivität`,
        message: `Zu ${area.name} wurde ${idle} Tage lang keine Projektaktivität erfasst.`,
        evidence: [{ label: 'Letzte Aktivität', value: latest }],
        confidence: 0.72,
      })
    }
  }

  return insights
}

function daysIn(distribution: AreaDistribution): number {
  const start = Date.parse(`${distribution.periodStart}T12:00:00`)
  const end = Date.parse(`${distribution.periodEnd}T12:00:00`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.round((end - start) / 86_400_000) + 1
}

export function periodWindows(today: string, days: number): { current: { start: string; end: string }; previous: { start: string; end: string } } {
  const currentStart = offsetDate(today, -(days - 1))
  const previousEnd = offsetDate(currentStart, -1)
  const previousStart = offsetDate(previousEnd, -(days - 1))
  return {
    current: { start: currentStart, end: today },
    previous: { start: previousStart, end: previousEnd },
  }
}

export const AREA_REVIEW_PROMPTS = [
  'Welche Area hat mehr Aufmerksamkeit bekommen als beabsichtigt?',
  'Welche Area möchtest du nächste Woche priorisieren?',
  'Hat deine erfasste Zeit widergespiegelt, was dir gerade wichtig ist?',
] as const
