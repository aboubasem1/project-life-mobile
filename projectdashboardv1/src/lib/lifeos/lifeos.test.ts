import { describe, expect, it } from 'vitest'
import { applyConvertToDashboard } from './dashboardBridge'
import {
  applyConvertResult,
  applyNormalizedObjects,
  archiveCapture,
  alreadyProcessed,
  buildAreaDistribution,
  classifyCapture,
  collectAreaItems,
  convertCapture,
  createCapture,
  createReviewDraft,
  dueDecisionReviews,
  emptyLifeOsState,
  LIFE_OS_STORE_VERSION,
  matchesAreaFilter,
  mergeLifeOsState,
  normalizeExternalPayload,
  normalizeLifeOsState,
  normalizeSignalType,
  parseCaptureInput,
  parseLifeArea,
  periodForReviewType,
  projectProgress,
  recordActivity,
  recordSignal,
  refreshDecisionStatus,
  resolveLifeArea,
  resolveNextAction,
  searchLifeOs,
  webhookIdempotencyKey,
  buildDeterministicInsights,
  interpretInsights,
} from './index'

describe('universal capture', () => {
  it('parses title, body and url without classifying', () => {
    const parsed = parseCaptureInput('Buch lesen\nhttps://example.com/x')
    expect(parsed.url).toBe('https://example.com/x')
    expect(parsed.title).toBe('Buch lesen')

    const capture = createCapture({ raw: 'Idee für Training' })
    expect(capture.status).toBe('inbox')
    expect(capture.targetType).toBe('inbox')
  })

  it('classifies and converts inbox items into domain objects', () => {
    let state = emptyLifeOsState()
    const capture = createCapture({ raw: 'Entscheidung: Fokus vor Features', projectId: 'work' })
    state = { ...state, captures: [capture] }

    const classified = classifyCapture(capture, 'decision', { projectId: 'work' })
    expect(classified.status).toBe('classified')

    const converted = convertCapture(classified)
    expect(converted.decision?.title).toContain('Entscheidung')
    expect(converted.relations.some(item => item.toKind === 'project' && item.toId === 'work')).toBe(true)

    state = applyConvertResult(state, converted)
    expect(state.captures[0]?.status).toBe('converted')
    expect(state.decisions).toHaveLength(1)
    expect(state.events.some(item => item.type === 'decision.created')).toBe(true)
  })

  it('writes converted tasks onto the existing project board', () => {
    const capture = classifyCapture(createCapture({ raw: 'Board-Task', projectId: 'work' }), 'task', { projectId: 'work' })
    const result = convertCapture(capture)
    const next = applyConvertToDashboard({
      focusTodos: [],
      boards: [{ id: 'work', label: 'Arbeit', count: 0, tasks: [] }],
      goals: [],
    }, result, '2026-09-20')
    expect(next.boards[0]?.tasks[0]?.title).toBe('Board-Task')
    expect(next.focusTodos).toHaveLength(0)
  })

  it('archives without inventing a domain object', () => {
    const archived = archiveCapture(createCapture({ raw: 'später' }))
    expect(archived.status).toBe('archived')
    expect(convertCapture({ ...archived, targetType: 'inbox' }).knowledge).toBeUndefined()
  })
})

describe('projects and next action', () => {
  it('uses the manual next action and otherwise the first open task', () => {
    const project = {
      id: 'p1',
      label: 'Life OS',
      nextAction: 'Connector SDK schreiben',
      tasks: [
        { id: 't1', title: 'UI polieren', done: false },
        { id: 't2', title: 'Tests', done: false },
      ],
    }
    expect(resolveNextAction(project)?.text).toBe('Connector SDK schreiben')
    expect(resolveNextAction({ ...project, nextAction: '' })?.text).toBe('UI polieren')
    expect(resolveNextAction({ ...project, nextAction: '', tasks: [] })).toBeNull()
    expect(projectProgress({ ...project, tasks: [{ id: 'a', title: 'x', done: true }, { id: 'b', title: 'y', done: false }] })).toBe(50)
  })
})

describe('decisions and reviews', () => {
  it('marks review_due from the review date without inventing outcomes', () => {
    const due = refreshDecisionStatus({
      id: 'd1',
      title: 'Kein Parallel-System',
      decision: 'Boards erweitern',
      context: '',
      reasoning: '',
      alternatives: '',
      expectedOutcome: '',
      decidedAt: '2026-09-01',
      reviewAt: '2026-09-18',
      status: 'active',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    }, '2026-09-20')
    expect(due.status).toBe('review_due')
    expect(dueDecisionReviews([due], '2026-09-20')).toHaveLength(1)
  })

  it('aggregates only supplied review data', () => {
    const period = periodForReviewType('weekly', '2026-09-20')
    const draft = createReviewDraft('weekly', {
      today: '2026-09-20',
      periodStart: period.start,
      periodEnd: period.end,
      completedTasks: 3,
      openTasks: 2,
      projects: [{ id: 'p', label: 'Work', tasks: [{ id: 't', title: 'A', done: true }] }],
      goals: [{ id: 'g', title: 'Schlaf', timeframe: 'Monat', percent: 40, dueDate: '2026-09-30' }],
      captures: [createCapture({ raw: 'Idee' })],
      knowledge: [],
      decisions: [],
      signals: [recordSignal({ type: 'mood', value: 7, unit: '/10' })],
      activities: [recordActivity({ title: 'Fokus', date: '2026-09-19', plannedDurationMin: 60, actualDurationMin: 40 })],
      focusMinutes: 40,
    })
    expect(draft.aggregates.completedTasks).toBe(3)
    expect(draft.aggregates.plannedMinutes).toBe(60)
    expect(draft.aggregates.actualMinutes).toBe(40)
    expect(draft.completedAt).toBeUndefined()
  })
})

describe('signals, search and merge', () => {
  it('persists signals and keeps them through merge', () => {
    const signal = recordSignal({ type: 'weight', value: 82.4, unit: 'kg', source: 'manual' })
    const local = normalizeLifeOsState({ signals: [signal] })
    const remote = normalizeLifeOsState({
      signals: [recordSignal({ type: 'mood', value: 6, unit: '/10' })],
    })
    const merged = mergeLifeOsState(local, remote)
    expect(merged.signals).toHaveLength(2)
    expect(merged.signals.some(item => item.type === 'weight' && item.value === 82.4)).toBe(true)
  })

  it('searches knowledge, decisions and projects', () => {
    const capture = createCapture({ raw: 'Zettelwirtschaft vermeiden' })
    const state = applyConvertResult(
      { ...emptyLifeOsState(), captures: [capture] },
      convertCapture(classifyCapture(capture, 'knowledge')),
    )
    const knowledgeHits = searchLifeOs(state, 'Zettel', {
      projects: [{ id: 'p', label: 'Life OS', tasks: [] }],
      goals: [{ id: 'g', title: 'Klarheit', timeframe: 'Jahr', percent: 10, dueDate: '2026-12-31' }],
    })
    const projectHits = searchLifeOs(state, 'Life', {
      projects: [{ id: 'p', label: 'Life OS', tasks: [] }],
    })
    expect(knowledgeHits.some(item => item.kind === 'knowledge')).toBe(true)
    expect(projectHits.some(item => item.kind === 'project')).toBe(true)
  })
})

describe('insights stay evidence-based', () => {
  it('creates inbox and planned-vs-actual insights from real numbers only', () => {
    const insights = buildDeterministicInsights({
      today: '2026-09-20',
      inboxCount: 9,
      projects: [],
      goals: [{ id: 'g', title: 'Buch', timeframe: 'Monat', percent: 20, dueDate: '2026-09-25' }],
      decisions: [],
      activities: [
        recordActivity({ title: 'A', date: '2026-09-18', plannedDurationMin: 60, actualDurationMin: 20 }),
        recordActivity({ title: 'B', date: '2026-09-19', plannedDurationMin: 60, actualDurationMin: 25 }),
      ],
      signals: [],
    })
    expect(insights.some(item => item.type === 'inbox_growth')).toBe(true)
    expect(insights.some(item => item.type === 'planned_vs_actual')).toBe(true)
    expect(insights.some(item => item.type === 'goal_deadline')).toBe(true)
    const story = interpretInsights(insights)
    expect(story?.source).toBe('interpretation')
    expect(story?.message.includes('belegten')).toBe(true)
  })
})

describe('connector normalization', () => {
  it('maps provider fields onto Life OS signals instead of storing them raw', () => {
    expect(normalizeSignalType('readiness_score')).toBe('recovery')
    const objects = normalizeExternalPayload({
      signal_type: 'readiness_score',
      value: 71,
      unit: '/100',
      source: 'provider-a',
    })
    expect(objects).toEqual([
      expect.objectContaining({
        kind: 'signal',
        data: expect.objectContaining({ type: 'recovery', value: 71 }),
      }),
    ])
    const next = applyNormalizedObjects(emptyLifeOsState(), objects, 'webhook-generic')
    expect(next.signals[0]?.type).toBe('recovery')
    expect((next.signals[0] as { readiness_score?: number }).readiness_score).toBeUndefined()
  })

  it('treats webhook idempotency keys as already processed', () => {
    const key = webhookIdempotencyKey({ 'x-idempotency-key': 'abc-1' }, { hello: true })
    expect(key).toBe('abc-1')
    const state = {
      ...emptyLifeOsState(),
      webhookLogs: [{
        id: 'log1',
        direction: 'inbound' as const,
        connectorId: 'n8n',
        status: 200,
        message: 'ok',
        idempotencyKey: 'abc-1',
        createdAt: '2026-09-20T10:00:00.000Z',
      }],
    }
    expect(alreadyProcessed(state, 'abc-1')).toBe(true)
    expect(alreadyProcessed(state, 'abc-2')).toBe(false)
  })
})

describe('life areas', () => {
  it('assigns areas to tasks, projects and goals without inventing values', () => {
    expect(parseLifeArea('HEALTH')).toBe('health')
    expect(parseLifeArea('unknown')).toBeUndefined()
    expect(parseLifeArea('')).toBeUndefined()

    const capture = classifyCapture(
      createCapture({ raw: 'Workout', lifeArea: 'health' }),
      'task',
    )
    expect(capture.lifeArea).toBe('health')
    const converted = convertCapture(capture)
    expect(converted.task?.lifeArea).toBe('health')
    expect(converted.events.some(item => item.type === 'life_area.assigned')).toBe(true)
  })

  it('inherits goal → project → task and lets explicit task area override', () => {
    const goal = { id: 'g1', lifeArea: 'health' as const }
    const project = { id: 'p1', lifeArea: undefined, goalId: 'g1' }
    expect(resolveLifeArea({ project, goal }).key).toBe('health')
    expect(resolveLifeArea({ project, goal }).source).toBe('goal')

    const withProject = { ...project, lifeArea: 'growth' as const }
    expect(resolveLifeArea({ project: withProject, goal }).source).toBe('project')
    expect(resolveLifeArea({ explicit: 'creativity', project: withProject, goal })).toEqual({
      key: 'creativity',
      source: 'explicit',
    })
    expect(resolveLifeArea({}).source).toBe('unclassified')
  })

  it('keeps unclassified objects valid through migration', () => {
    const legacy = normalizeLifeOsState({
      version: 1,
      captures: [{
        id: 'c1',
        raw: 'Versicherung anrufen',
        title: 'Versicherung anrufen',
        body: '',
        targetType: 'inbox',
        status: 'inbox',
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z',
      }],
    })
    expect(legacy.version).toBe(LIFE_OS_STORE_VERSION)
    expect(legacy.captures[0]?.lifeArea).toBeUndefined()
    expect(legacy.areaIntentions).toEqual({})
    expect(legacy.captures[0]?.raw).toBe('Versicherung anrufen')
  })

  it('filters by resolved area including unclassified', () => {
    const health = resolveLifeArea({ explicit: 'health' })
    const none = resolveLifeArea({})
    expect(matchesAreaFilter(health, 'all')).toBe(true)
    expect(matchesAreaFilter(health, 'health')).toBe(true)
    expect(matchesAreaFilter(health, 'work')).toBe(false)
    expect(matchesAreaFilter(none, 'unclassified')).toBe(true)
    expect(matchesAreaFilter(health, 'unclassified')).toBe(false)
  })

  it('aggregates time-weighted area data and review coverage', () => {
    const items = collectAreaItems({
      projects: [{
        id: 'p1',
        lifeArea: 'work',
        tasks: [
          { id: 't1', done: true, lifeArea: 'work', plannedMinutes: 30, actualMinutes: 25 },
          { id: 't2', done: false },
        ],
      }],
      goals: [{ id: 'g1', lifeArea: 'health' }],
      activities: [
        { id: 'a1', date: '2026-09-18', lifeArea: 'health', actualDurationMin: 40, plannedDurationMin: 45 },
        { id: 'a2', date: '2026-09-19', lifeArea: 'work', actualDurationMin: 120, plannedDurationMin: 90 },
      ],
    })
    const snapshot = buildAreaDistribution({
      periodStart: '2026-09-01',
      periodEnd: '2026-09-20',
      items,
      scope: 'snapshot',
    })
    expect(snapshot.slices.find(slice => slice.key === 'work')?.activeProjects).toBe(1)
    expect(snapshot.slices.find(slice => slice.key === 'health')?.goals).toBe(1)
    expect(snapshot.coverage).toBeGreaterThan(0)

    const period = periodForReviewType('weekly', '2026-09-20')
    const draft = createReviewDraft('weekly', {
      today: '2026-09-20',
      periodStart: period.start,
      periodEnd: period.end,
      completedTasks: 1,
      openTasks: 1,
      projects: [{
        id: 'p1',
        label: 'Studio',
        lifeArea: 'creativity',
        tasks: [{ id: 't1', title: 'Mix', done: true, lifeArea: 'creativity', actualMinutes: 90 }],
      }],
      goals: [{ id: 'g1', title: 'Album', timeframe: 'Monat', percent: 20, dueDate: '2026-09-30', lifeArea: 'creativity' }],
      captures: [createCapture({ raw: 'Idee' })],
      knowledge: [],
      decisions: [],
      signals: [],
      activities: [
        recordActivity({ title: 'Session', date: '2026-09-19', actualDurationMin: 90, plannedDurationMin: 80, lifeArea: 'creativity' }),
        recordActivity({ title: 'Call', date: '2026-09-18', actualDurationMin: 30, lifeArea: 'work' }),
      ],
      focusMinutes: 0,
    })
    expect(draft.aggregates.lifeAreas?.hasTimeData).toBe(true)
    expect(draft.aggregates.lifeAreas?.slices.find(slice => slice.key === 'creativity')?.actualMinutes).toBe(90)
    expect(draft.aggregates.lifeAreas?.slices.find(slice => slice.key === 'work')?.actualMinutes).toBe(30)
  })

  it('builds area insights from project concentration without moral language', () => {
    const insights = buildDeterministicInsights({
      today: '2026-09-20',
      inboxCount: 1,
      projects: [
        { id: 'p1', label: 'A', status: 'active', lifeArea: 'work', lastActivityAt: '2026-09-19T10:00:00.000Z', tasks: [] },
        { id: 'p2', label: 'B', status: 'active', lifeArea: 'work', lastActivityAt: '2026-09-18T10:00:00.000Z', tasks: [] },
        { id: 'p3', label: 'C', status: 'active', lifeArea: 'work', lastActivityAt: '2026-09-17T10:00:00.000Z', tasks: [] },
        { id: 'p4', label: 'D', status: 'active', lifeArea: 'work', lastActivityAt: '2026-09-16T10:00:00.000Z', tasks: [] },
        { id: 'p5', label: 'E', status: 'active', lifeArea: 'health', lastActivityAt: '2026-09-15T10:00:00.000Z', tasks: [] },
      ],
      goals: [],
      decisions: [],
      activities: [],
      signals: [],
    })
    const concentration = insights.find(item => item.type === 'area_project_concentration')
    expect(concentration?.message).toContain('Work')
    expect(concentration?.message.toLowerCase()).not.toContain('neglect')
    expect(insights.some(item => item.title.toLowerCase().includes('score'))).toBe(false)
  })

  it('passes life_area through connectors without hardcoding provider areas', () => {
    const objects = normalizeExternalPayload({
      kind: 'activity',
      title: 'Gym',
      date: '2026-09-20',
      actual_duration: 60,
      life_area: 'health',
    })
    expect(objects[0]).toEqual(expect.objectContaining({
      kind: 'activity',
      data: expect.objectContaining({ title: 'Gym', lifeArea: 'health' }),
    }))
    const next = applyNormalizedObjects(emptyLifeOsState(), objects, 'webhook-generic')
    expect(next.activities[0]?.lifeArea).toBe('health')
  })
})
