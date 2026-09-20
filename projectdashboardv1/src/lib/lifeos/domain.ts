import {
  areaLabel,
  buildAreaDistribution,
  buildAreaInsights,
  collectAreaItems,
  parseLifeArea,
  periodWindows,
  type LifeAreaKey,
} from './areas.js'
import {
  type ActivityRecord,
  type Capture,
  type CaptureTargetType,
  type Decision,
  type DomainEvent,
  type DomainEventType,
  type EntityKind,
  type GoalLike,
  type Insight,
  type KnowledgeItem,
  type KnowledgeType,
  type LifeOsState,
  type ProjectLike,
  type Relation,
  type Review,
  type ReviewAggregates,
  type ReviewType,
  type Signal,
} from './types.js'
import {
  createId,
  inboxCaptures,
  nowIso,
  refreshDecisionStatus,
  todayKey,
} from './store.js'

const URL_RE = /https?:\/\/[^\s]+/i

export function parseCaptureInput(raw: string): { title: string; body: string; url?: string } {
  const text = raw.trim()
  const match = text.match(URL_RE)
  const url = match?.[0]
  const withoutUrl = url ? text.replace(url, ' ').replace(/\s+/g, ' ').trim() : text
  const title = withoutUrl.split('\n')[0]?.slice(0, 120) || url || 'Capture'
  const body = withoutUrl.includes('\n') ? withoutUrl : withoutUrl === title ? '' : withoutUrl
  return { title, body, url }
}

export function createCapture(input: {
  raw: string
  url?: string
  fileName?: string
  fileKind?: Capture['fileKind']
  fileDataUrl?: string
  projectId?: string
  goalId?: string
  lifeArea?: LifeAreaKey
}): Capture {
  const parsed = parseCaptureInput(input.raw)
  const now = nowIso()
  return {
    id: createId(),
    raw: input.raw.trim(),
    title: parsed.title,
    body: parsed.body,
    url: input.url ?? parsed.url,
    fileName: input.fileName,
    fileKind: input.fileKind,
    fileDataUrl: input.fileDataUrl,
    targetType: 'inbox',
    status: 'inbox',
    projectId: input.projectId,
    goalId: input.goalId,
    lifeArea: parseLifeArea(input.lifeArea),
    createdAt: now,
    updatedAt: now,
  }
}

export function classifyCapture(
  capture: Capture,
  targetType: CaptureTargetType,
  links?: { projectId?: string; goalId?: string; lifeArea?: LifeAreaKey | null },
): Capture {
  return {
    ...capture,
    targetType,
    status: targetType === 'inbox' ? 'inbox' : 'classified',
    projectId: links?.projectId ?? capture.projectId,
    goalId: links?.goalId ?? capture.goalId,
    lifeArea: links && 'lifeArea' in links ? parseLifeArea(links.lifeArea) : capture.lifeArea,
    updatedAt: nowIso(),
  }
}

export function archiveCapture(capture: Capture): Capture {
  return { ...capture, status: 'archived', updatedAt: nowIso() }
}

export type ConvertResult = {
  capture: Capture
  knowledge?: KnowledgeItem
  decision?: Decision
  signal?: Signal
  activity?: ActivityRecord
  task?: { id: string; title: string; projectId?: string; lifeArea?: LifeAreaKey }
  goal?: { id: string; title: string; lifeArea?: LifeAreaKey }
  relations: Relation[]
  events: DomainEvent[]
}

function relation(
  fromKind: EntityKind,
  fromId: string,
  toKind: EntityKind,
  toId: string,
  role?: string,
): Relation {
  return { id: createId(), fromKind, fromId, toKind, toId, role, createdAt: nowIso() }
}

function event(type: DomainEventType, entityKind?: EntityKind, entityId?: string, payload: Record<string, string> = {}): DomainEvent {
  return { id: createId(), type, entityKind, entityId, payload, createdAt: nowIso() }
}

export function lifeAreaTransitionEvents(
  previous: LifeAreaKey | undefined,
  next: LifeAreaKey | undefined,
  entity: { kind: EntityKind; id: string },
): DomainEvent[] {
  if (previous === next) return []
  const payload = {
    previous: previous ?? 'unclassified',
    next: next ?? 'unclassified',
  }
  if (!previous && next) {
    return [event('life_area.assigned', entity.kind, entity.id, { ...payload, lifeArea: next })]
  }
  return [event('life_area.changed', entity.kind, entity.id, payload)]
}

function assignAreaEvents(kind: EntityKind, id: string, lifeArea?: LifeAreaKey): DomainEvent[] {
  return lifeAreaTransitionEvents(undefined, lifeArea, { kind, id })
}

export function convertCapture(capture: Capture): ConvertResult {
  if (capture.targetType === 'inbox' || capture.status === 'archived') {
    return { capture, relations: [], events: [] }
  }
  const type = capture.targetType
  const relations: Relation[] = []
  const events: DomainEvent[] = []
  const now = nowIso()
  const title = capture.title.trim() || capture.raw.slice(0, 80)
  const body = capture.body || capture.raw
  const mark = (kind: EntityKind, id: string): Capture => ({
    ...capture,
    targetType: type,
    status: 'converted',
    converted: { kind, id },
    updatedAt: now,
  })

  const linkConverted = (kind: EntityKind, id: string) => {
    if (capture.projectId) relations.push(relation(kind, id, 'project', capture.projectId, 'about'))
    if (capture.goalId) relations.push(relation(kind, id, 'goal', capture.goalId, 'supports'))
  }

  switch (type) {
    case 'task': {
      const task = { id: createId(), title, projectId: capture.projectId, lifeArea: capture.lifeArea }
      events.push(event('task.created', 'task', task.id, { title, ...(capture.lifeArea ? { lifeArea: capture.lifeArea } : {}) }))
      events.push(...assignAreaEvents('task', task.id, capture.lifeArea))
      linkConverted('task', task.id)
      return { capture: mark('task', task.id), task, relations, events }
    }
    case 'goal': {
      const goal = { id: createId(), title, lifeArea: capture.lifeArea }
      events.push(event('goal.updated', 'goal', goal.id, { title, reason: 'created', ...(capture.lifeArea ? { lifeArea: capture.lifeArea } : {}) }))
      events.push(...assignAreaEvents('goal', goal.id, capture.lifeArea))
      if (capture.projectId) relations.push(relation('project', capture.projectId, 'goal', goal.id, 'supports'))
      return { capture: mark('goal', goal.id), goal, relations, events }
    }
    case 'decision': {
      const decision: Decision = {
        id: createId(),
        title,
        decision: body,
        context: '',
        reasoning: '',
        alternatives: '',
        expectedOutcome: '',
        projectId: capture.projectId,
        goalId: capture.goalId,
        decidedAt: todayKey(),
        status: 'active',
        lifeArea: capture.lifeArea,
        createdAt: now,
        updatedAt: now,
      }
      events.push(event('decision.created', 'decision', decision.id, { title, ...(capture.lifeArea ? { lifeArea: capture.lifeArea } : {}) }))
      events.push(...assignAreaEvents('decision', decision.id, capture.lifeArea))
      linkConverted('decision', decision.id)
      return { capture: mark('decision', decision.id), decision, relations, events }
    }
    case 'event': {
      const activity: ActivityRecord = {
        id: createId(),
        kind: 'custom',
        title,
        projectId: capture.projectId,
        goalId: capture.goalId,
        source: 'user',
        date: todayKey(),
        lifeArea: capture.lifeArea,
        createdAt: now,
        updatedAt: now,
      }
      events.push(...assignAreaEvents('activity', activity.id, capture.lifeArea))
      linkConverted('activity', activity.id)
      return { capture: mark('activity', activity.id), activity, relations, events }
    }
    case 'knowledge':
    case 'reference':
    case 'note': {
      const knowledgeType: KnowledgeType = type === 'reference'
        ? (capture.url ? 'webpage' : 'import')
        : type === 'note' ? 'thought' : (capture.url ? 'article' : 'thought')
      const knowledge: KnowledgeItem = {
        id: createId(),
        title,
        content: body,
        summary: body.slice(0, 180),
        source: capture.fileName || 'capture',
        sourceUrl: capture.url,
        type: knowledgeType,
        topics: [],
        tags: [],
        lifeArea: capture.lifeArea,
        createdAt: now,
        updatedAt: now,
      }
      events.push(event('knowledge.created', 'knowledge', knowledge.id, { title, ...(capture.lifeArea ? { lifeArea: capture.lifeArea } : {}) }))
      events.push(...assignAreaEvents('knowledge', knowledge.id, capture.lifeArea))
      linkConverted('knowledge', knowledge.id)
      return { capture: mark('knowledge', knowledge.id), knowledge, relations, events }
    }
    default: {
      const _exhaustive: never = type
      void _exhaustive
      return { capture, relations, events }
    }
  }
}

export function applyConvertResult(state: LifeOsState, result: ConvertResult): LifeOsState {
  const captures = state.captures.map(item => item.id === result.capture.id ? result.capture : item)
  return {
    ...state,
    captures,
    knowledge: result.knowledge ? [...state.knowledge, result.knowledge] : state.knowledge,
    decisions: result.decision ? [...state.decisions, result.decision] : state.decisions,
    activities: result.activity ? [...state.activities, result.activity] : state.activities,
    relations: [...state.relations, ...result.relations],
    events: [...state.events, ...result.events],
  }
}

export function resolveNextAction(project: ProjectLike): { text: string; source: 'manual' | 'task' } | null {
  const manual = project.nextAction?.trim()
  if (manual) return { text: manual, source: 'manual' }
  const open = project.tasks.find(task => !task.done && task.title.trim())
  if (open) return { text: open.title.trim(), source: 'task' }
  return null
}

export function projectProgress(project: ProjectLike): number {
  if (project.tasks.length === 0) return 0
  const done = project.tasks.filter(task => task.done).length
  return Math.round((done / project.tasks.length) * 100)
}

export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T12:00:00`)
  const end = Date.parse(`${to}T12:00:00`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.round((end - start) / 86_400_000)
}

export function upsertRelation(state: LifeOsState, next: Omit<Relation, 'id' | 'createdAt'> & { id?: string }): LifeOsState {
  const existing = state.relations.find(item => (
    item.fromKind === next.fromKind
    && item.fromId === next.fromId
    && item.toKind === next.toKind
    && item.toId === next.toId
    && (item.role ?? '') === (next.role ?? '')
  ))
  if (existing) return state
  return {
    ...state,
    relations: [...state.relations, {
      id: next.id ?? createId(),
      fromKind: next.fromKind,
      fromId: next.fromId,
      toKind: next.toKind,
      toId: next.toId,
      role: next.role,
      createdAt: nowIso(),
    }],
  }
}

export function relatedIds(state: LifeOsState, kind: EntityKind, id: string, other: EntityKind): string[] {
  const ids = new Set<string>()
  for (const item of state.relations) {
    if (item.fromKind === kind && item.fromId === id && item.toKind === other) ids.add(item.toId)
    if (item.toKind === kind && item.toId === id && item.fromKind === other) ids.add(item.fromId)
  }
  return [...ids]
}

export function dueDecisionReviews(decisions: Decision[], today = todayKey()): Decision[] {
  return decisions
    .map(item => refreshDecisionStatus(item, today))
    .filter(item => item.status === 'review_due')
}

export function appendDomainEvent(state: LifeOsState, next: DomainEvent): LifeOsState {
  if (state.events.some(item => item.id === next.id)) return state
  return { ...state, events: [...state.events, next] }
}

export function emitDomainEvent(
  type: DomainEventType,
  payload: Record<string, string> = {},
  entity?: { kind: EntityKind; id: string },
): DomainEvent {
  return {
    id: createId(),
    type,
    entityKind: entity?.kind,
    entityId: entity?.id,
    payload,
    createdAt: nowIso(),
  }
}

export type ReviewContext = {
  today: string
  periodStart: string
  periodEnd: string
  completedTasks: number
  openTasks: number
  projects: ProjectLike[]
  goals: GoalLike[]
  captures: Capture[]
  knowledge: KnowledgeItem[]
  decisions: Decision[]
  signals: Signal[]
  activities: ActivityRecord[]
  focusMinutes: number
}

function inPeriod(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

function dateFromIso(iso: string): string {
  return iso.slice(0, 10)
}

export function periodForReviewType(type: ReviewType, today: string): { start: string; end: string } {
  const end = today
  const date = new Date(`${today}T12:00:00`)
  switch (type) {
    case 'daily':
      return { start: today, end }
    case 'weekly':
      date.setDate(date.getDate() - 6)
      break
    case 'monthly':
      date.setDate(date.getDate() - 29)
      break
    case 'quarterly':
      date.setDate(date.getDate() - 89)
      break
    case 'yearly':
      date.setDate(date.getDate() - 364)
      break
    default: {
      const _exhaustive: never = type
      return _exhaustive
    }
  }
  const start = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
  return { start, end }
}

export function aggregateReview(context: ReviewContext): ReviewAggregates {
  const { periodStart, periodEnd } = context
  const captures = context.captures.filter(item => inPeriod(dateFromIso(item.createdAt), periodStart, periodEnd))
  const knowledge = context.knowledge.filter(item => inPeriod(dateFromIso(item.createdAt), periodStart, periodEnd))
  const decisions = context.decisions.filter(item => inPeriod(item.decidedAt, periodStart, periodEnd))
  const signals = context.signals.filter(item => inPeriod(dateFromIso(item.timestamp), periodStart, periodEnd))
  const activities = context.activities.filter(item => inPeriod(item.date, periodStart, periodEnd))
  const signalMap = new Map<string, { type: string; count: number; lastValue?: number; unit?: string }>()
  for (const signal of signals) {
    const current = signalMap.get(signal.type) ?? { type: signal.type, count: 0, lastValue: undefined as number | undefined, unit: signal.unit }
    current.count += 1
    current.lastValue = signal.value
    current.unit = signal.unit
    signalMap.set(signal.type, current)
  }
  return {
    completedTasks: context.completedTasks,
    openTasks: context.openTasks,
    projectProgress: context.projects.map(project => ({
      id: project.id,
      name: project.label,
      percent: projectProgress(project),
    })),
    goals: context.goals.map(goal => ({ id: goal.id, title: goal.title, percent: goal.percent })),
    captures: captures.length,
    knowledge: knowledge.length,
    decisions: decisions.length,
    decisionReviewsDue: dueDecisionReviews(context.decisions, context.today).length,
    signals: [...signalMap.values()],
    focusMinutes: context.focusMinutes,
    plannedMinutes: activities.reduce((sum, item) => sum + (item.plannedDurationMin ?? 0), 0),
    actualMinutes: activities.reduce((sum, item) => sum + (item.actualDurationMin ?? 0), 0),
    lifeAreas: (() => {
      const items = collectAreaItems({
        projects: context.projects,
        goals: context.goals,
        activities: context.activities,
      })
      const dist = buildAreaDistribution({ periodStart, periodEnd, items, scope: 'period' })
      return {
        coverage: dist.coverage,
        reliable: dist.reliable,
        hasTimeData: dist.hasTimeData,
        slices: dist.slices.map(slice => ({
          key: slice.key,
          actualMinutes: slice.actualMinutes,
          plannedMinutes: slice.plannedMinutes,
          completedTasks: slice.completedTasks,
        })),
      }
    })(),
  }
}

export function createReviewDraft(type: ReviewType, context: ReviewContext): Review {
  const now = nowIso()
  return {
    id: createId(),
    type,
    periodStart: context.periodStart,
    periodEnd: context.periodEnd,
    aggregates: aggregateReview(context),
    whatWentWell: '',
    whatWentWrong: '',
    whatILearned: '',
    whatToChange: '',
    nextPriorities: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

export function completeReview(review: Review, fields: Partial<Review>): Review {
  const now = nowIso()
  return {
    ...review,
    ...fields,
    completedAt: now,
    updatedAt: now,
  }
}

export type InsightContext = {
  today: string
  inboxCount: number
  projects: ProjectLike[]
  goals: GoalLike[]
  decisions: Decision[]
  activities: ActivityRecord[]
  signals: Signal[]
}

export function buildDeterministicInsights(context: InsightContext): Insight[] {
  const insights: Insight[] = []
  const createdAt = nowIso()
  const period = `${context.today}`

  if (context.inboxCount >= 8) {
    insights.push({
      id: `inbox-growth-${context.today}`,
      type: 'inbox_growth',
      title: 'Inbox wächst',
      message: `${context.inboxCount} unverarbeitete Captures. Erst klassifizieren, dann neue aufnehmen.`,
      period,
      evidence: [{ label: 'Offene Captures', value: String(context.inboxCount) }],
      confidence: 0.95,
      suggestedAction: 'Inbox auf 5 oder weniger bringen',
      source: 'deterministic',
      createdAt,
    })
  }

  for (const project of context.projects) {
    if (project.status === 'done' || project.status === 'archived') continue
    const last = project.lastActivityAt ? dateFromIso(project.lastActivityAt) : ''
    const idleDays = last ? daysBetween(last, context.today) : project.tasks.length === 0 ? 0 : 14
    if (last && idleDays >= 7) {
      insights.push({
        id: `stale-project-${project.id}`,
        type: 'project_stale',
        title: `${project.label} ohne Aktivität`,
        message: `Seit ${idleDays} Tagen kein Update an „${project.label}“.`,
        period,
        evidence: [
          { label: 'Letzte Aktivität', value: last },
          { label: 'Offene Aufgaben', value: String(project.tasks.filter(task => !task.done).length) },
        ],
        confidence: 0.9,
        suggestedAction: resolveNextAction(project)?.text ?? 'Nächste Aktion setzen',
        source: 'deterministic',
        createdAt,
      })
    }
  }

  for (const goal of context.goals) {
    if (!goal.dueDate || goal.status === 'done' || goal.status === 'dropped') continue
    const left = daysBetween(context.today, goal.dueDate)
    if (left >= 0 && left <= 14 && goal.percent < 80) {
      insights.push({
        id: `goal-deadline-${goal.id}`,
        type: 'goal_deadline',
        title: `${goal.title} nähert sich der Deadline`,
        message: `Noch ${left} Tage, Fortschritt ${goal.percent}%.`,
        period,
        evidence: [
          { label: 'Deadline', value: goal.dueDate },
          { label: 'Fortschritt', value: `${goal.percent}%` },
        ],
        confidence: 0.88,
        suggestedAction: 'Check-in oder nächstes Projekt festlegen',
        source: 'deterministic',
        createdAt,
      })
    }
  }

  const due = dueDecisionReviews(context.decisions, context.today)
  if (due.length > 0) {
    insights.push({
      id: `decision-reviews-${context.today}`,
      type: 'decision_review_due',
      title: 'Decision Reviews fällig',
      message: `${due.length} ${due.length === 1 ? 'Entscheidung wartet' : 'Entscheidungen warten'} auf ein Review.`,
      period,
      evidence: due.slice(0, 5).map(item => ({ label: item.title, value: item.reviewAt ?? context.today })),
      confidence: 1,
      suggestedAction: 'Ergebnis und Bewertung nachtragen',
      source: 'deterministic',
      createdAt,
    })
  }

  const withBoth = context.activities.filter(item => (
    item.plannedDurationMin != null
    && item.actualDurationMin != null
    && item.plannedDurationMin > 0
  ))
  if (withBoth.length >= 2) {
    const planned = withBoth.reduce((sum, item) => sum + (item.plannedDurationMin ?? 0), 0)
    const actual = withBoth.reduce((sum, item) => sum + (item.actualDurationMin ?? 0), 0)
    const delta = Math.round(((actual - planned) / planned) * 100)
    if (Math.abs(delta) >= 30) {
      insights.push({
        id: `planned-actual-${context.today}`,
        type: 'planned_vs_actual',
        title: 'Plan und Realität weichen ab',
        message: `Geplant ${planned} Min., tatsächlich ${actual} Min. (${delta > 0 ? '+' : ''}${delta}%).`,
        period,
        evidence: [
          { label: 'Geplant', value: `${planned} min` },
          { label: 'Tatsächlich', value: `${actual} min` },
          { label: 'Datensätze', value: String(withBoth.length) },
        ],
        confidence: 0.86,
        suggestedAction: 'Nächste Blöcke kürzer oder realistischer planen',
        source: 'deterministic',
        createdAt,
      })
    }
  }

  const byType = new Map<string, Signal[]>()
  for (const signal of context.signals) {
    const list = byType.get(signal.type) ?? []
    list.push(signal)
    byType.set(signal.type, list)
  }
  for (const [type, list] of byType) {
    const sorted = [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    if (sorted.length < 4) continue
    const recent = sorted.slice(-3)
    const older = sorted.slice(0, -3)
    const avg = (items: Signal[]) => items.reduce((sum, item) => sum + item.value, 0) / items.length
    const recentAvg = avg(recent)
    const olderAvg = avg(older)
    if (!Number.isFinite(recentAvg) || !Number.isFinite(olderAvg) || olderAvg === 0) continue
    const change = ((recentAvg - olderAvg) / Math.abs(olderAvg)) * 100
    if (Math.abs(change) >= 15) {
      insights.push({
        id: `signal-trend-${type}`,
        type: 'signal_trend',
        title: `Signal ${type} verändert sich`,
        message: `Letzte Werte ${recentAvg.toFixed(1)} vs. früher ${olderAvg.toFixed(1)} (${change > 0 ? '+' : ''}${Math.round(change)}%).`,
        period,
        evidence: [
          { label: 'Typ', value: type },
          { label: 'Messungen', value: String(sorted.length) },
        ],
        confidence: 0.75,
        source: 'deterministic',
        createdAt,
      })
    }
  }

  const windows = periodWindows(context.today, 30)
  const areaItems = collectAreaItems({
    projects: context.projects,
    goals: context.goals,
    activities: context.activities,
  })
  const current = buildAreaDistribution({ periodStart: windows.current.start, periodEnd: windows.current.end, items: areaItems })
  const previous = buildAreaDistribution({ periodStart: windows.previous.start, periodEnd: windows.previous.end, items: areaItems })
  for (const item of buildAreaInsights({
    today: context.today,
    projects: context.projects,
    goals: context.goals,
    current,
    previous,
  })) {
    insights.push({
      id: `area-${item.type}-${insights.length}-${context.today}`,
      type: item.type,
      title: item.title,
      message: item.message,
      period,
      evidence: item.evidence,
      confidence: item.confidence,
      suggestedAction: item.suggestedAction,
      source: 'deterministic',
      createdAt,
    })
  }

  return insights
}

export function interpretInsights(insights: Insight[]): Insight | null {
  if (insights.length === 0) return null
  const titles = insights.map(item => item.title)
  const evidence = insights.flatMap(item => item.evidence).slice(0, 8)
  return {
    id: `interpretation-${insights[0]?.period ?? todayKey()}`,
    type: 'interpretation',
    title: 'Zusammenhang aus vorhandenen Daten',
    message: `Aus ${insights.length} belegten Hinweisen: ${titles.join(' · ')}. Keine zusätzlichen Messwerte.`,
    period: insights[0]?.period ?? todayKey(),
    evidence,
    confidence: 0.55,
    suggestedAction: insights.find(item => item.suggestedAction)?.suggestedAction,
    source: 'interpretation',
    createdAt: nowIso(),
  }
}

export type SearchHit = {
  id: string
  kind: EntityKind
  title: string
  snippet: string
}

function hay(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ').toLowerCase()
}

export function searchLifeOs(state: LifeOsState, query: string, extra?: {
  projects?: ProjectLike[]
  goals?: GoalLike[]
  tasks?: Array<{ id: string; title: string; project?: string; lifeArea?: LifeAreaKey }>
}): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits: SearchHit[] = []

  for (const item of extra?.tasks ?? []) {
    if (hay(item.title, item.project, areaLabel(item.lifeArea)).includes(q)) {
      hits.push({ id: item.id, kind: 'task', title: item.title, snippet: item.project ?? 'Aufgabe' })
    }
  }
  for (const item of extra?.projects ?? []) {
    if (hay(item.label, item.description, item.outcome, item.nextAction, areaLabel(item.lifeArea)).includes(q)) {
      hits.push({ id: item.id, kind: 'project', title: item.label, snippet: item.outcome || item.description || 'Projekt' })
    }
  }
  for (const item of extra?.goals ?? []) {
    if (hay(item.title, item.description, item.outcome, item.metric, areaLabel(item.lifeArea)).includes(q)) {
      hits.push({ id: item.id, kind: 'goal', title: item.title, snippet: item.outcome || item.description || 'Ziel' })
    }
  }
  for (const item of state.knowledge) {
    if (hay(item.title, item.content, item.summary, item.source, item.tags.join(' '), areaLabel(item.lifeArea)).includes(q)) {
      hits.push({ id: item.id, kind: 'knowledge', title: item.title, snippet: item.summary || item.content.slice(0, 80) })
    }
  }
  for (const item of state.decisions) {
    if (hay(item.title, item.decision, item.context, item.reasoning, areaLabel(item.lifeArea)).includes(q)) {
      hits.push({ id: item.id, kind: 'decision', title: item.title, snippet: item.decision.slice(0, 80) })
    }
  }
  for (const item of inboxCaptures(state)) {
    if (hay(item.title, item.raw, item.body, areaLabel(item.lifeArea)).includes(q)) {
      hits.push({ id: item.id, kind: 'capture', title: item.title, snippet: 'Inbox' })
    }
  }
  return hits.slice(0, 40)
}

export function recordSignal(input: {
  type: string
  value: number
  unit?: string
  source?: string
  sourceId?: string
  metadata?: Record<string, string>
  timestamp?: string
  lifeArea?: LifeAreaKey
}): Signal {
  const now = nowIso()
  return {
    id: createId(),
    type: input.type.trim(),
    value: input.value,
    unit: input.unit ?? '',
    timestamp: input.timestamp ?? now,
    source: input.source ?? 'manual',
    sourceId: input.sourceId,
    metadata: input.metadata,
    lifeArea: parseLifeArea(input.lifeArea),
    createdAt: now,
  }
}

export function recordActivity(input: {
  title: string
  date: string
  kind?: ActivityRecord['kind']
  projectId?: string
  goalId?: string
  plannedDurationMin?: number
  actualDurationMin?: number
  source?: ActivityRecord['source']
  lifeArea?: LifeAreaKey
}): ActivityRecord {
  const now = nowIso()
  return {
    id: createId(),
    kind: input.kind ?? 'custom',
    title: input.title.trim(),
    projectId: input.projectId,
    goalId: input.goalId,
    plannedDurationMin: input.plannedDurationMin,
    actualDurationMin: input.actualDurationMin,
    source: input.source ?? 'user',
    date: input.date,
    lifeArea: parseLifeArea(input.lifeArea),
    createdAt: now,
    updatedAt: now,
  }
}
