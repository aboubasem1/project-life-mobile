import {
  DEFAULT_EXPERIMENT_LIMIT,
  MAX_IMPORT_BYTES,
  RUN_EPOCH,
  RUN_PROJECT_ID,
  type AssetAccess,
  type AssetRecord,
  type DayCapacity,
  type DelegationItem,
  type DelegationStatus,
  type EnergyMode,
  type Experiment,
  type ExperimentStatus,
  type FinanceState,
  type GenerationalRunState,
  type GoalLevel,
  type GoalNode,
  type GoalStatus,
  type HealthPlan,
  type InboxItem,
  type InboxKind,
  type LifeRequirement,
  type MealDraft,
  type PortfolioItem,
  type PortfolioKind,
  type PortfolioStatus,
  type PreferenceItem,
  type PreferenceKind,
  type ReelCandidate,
  type ReelJob,
  type ReelStatus,
  type ReleasedKnowledge,
  type ReviewDecision,
  type RunTask,
  type ShoppingItem,
  type SourceKind,
  type SupplementDraft,
  type TaskEnergy,
  type TaskKind,
  type VisitDraft,
  type WeekReview,
} from './types.js'

export {
  DEFAULT_EXPERIMENT_LIMIT,
  MAX_IMPORT_BYTES,
  RUN_PROJECT_ID,
} from './types.js'

const TEXT_EXT = new Set(['txt', 'md', 'vtt', 'srt'])
const MEDIA_EXT = new Set(['mp4', 'mov', 'm4a', 'mp3', 'webm', 'wav'])

const DRAFT_ASSETS: Array<{ id: string; name: string; note: string }> = [
  { id: 'draft-coolpod', name: 'CoolPod', note: 'Schreibweise aus Notiz, nicht bestätigt. Kein Handle.' },
  { id: 'draft-fashion', name: 'Fashion Brand', note: 'Marke erkannt, exakter Name offen.' },
  { id: 'draft-kiff', name: 'KiffKiff / Kiffengadgets', note: 'Mehrere Schreibweisen, nicht bestätigt.' },
  { id: 'draft-lifestyle', name: 'Lifestyle Brand', note: 'Marke erkannt, exakter Name offen.' },
  { id: 'draft-gadget', name: 'Gadget-Account', note: 'Account erkannt, Handle offen.' },
  { id: 'draft-boobuds', name: 'Boobuds', note: 'Schreibweise aus Notiz, nicht bestätigt.' },
  { id: 'draft-dj', name: 'DJ-Projekt', note: 'Projekt erkannt, exakter Name offen.' },
  { id: 'draft-community', name: 'Community-Projekt', note: 'Projekt erkannt, exakter Name offen.' },
  { id: 'draft-boxraid', name: 'TikTok · BOXRAID', note: 'Achse aus Notiz, Handle offen.' },
  { id: 'draft-adhs', name: 'TikTok · ADHS', note: 'Achse aus Notiz, Handle offen.' },
  { id: 'draft-financial', name: 'TikTok · Financial', note: 'Achse aus Notiz, Handle offen.' },
  { id: 'draft-health', name: 'TikTok · Health / Longevity', note: 'Achse aus Notiz, Handle offen.' },
]

const LIFE_REQUIREMENTS: LifeRequirement[] = [
  { id: 'work', label: 'Arbeit', active: false, note: '' },
  { id: 'home', label: 'Haushalt / Wohnen', active: false, note: '' },
  { id: 'relationships', label: 'Beziehungen', active: false, note: '' },
  { id: 'admin', label: 'Finanzen / Administration', active: false, note: '' },
  { id: 'learning', label: 'Lernen', active: false, note: '' },
]

export function runId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `${prefix}-${uuid}`
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function weekPeriod(now = new Date()): { start: string; end: string } {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekday = date.getDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  date.setDate(date.getDate() + mondayOffset)
  const start = dateKey(date)
  date.setDate(date.getDate() + 6)
  return { start, end: dateKey(date) }
}

function emptyFinance(): FinanceState {
  return {
    revenue: null,
    paidIn: null,
    variableCosts: null,
    fixedCosts: null,
    receivables: null,
    capital: null,
    returnsAmount: null,
    shipping: null,
    purchaseCosts: null,
    platformFees: null,
    assumptions: '',
  }
}

function emptyHealth(): HealthPlan {
  return {
    movementSessionsPerWeek: 3,
    movementNote: 'Planungsentwurf, änderbar. Drei kurze Einheiten pro Woche.',
    calorieTarget: null,
    proteinTarget: null,
    sleepStart: null,
    sleepEnd: null,
    sleepRecovery: null,
    weightPoints: [],
    skincareNote: '',
    whiteningOptional: false,
    supplements: [],
    meals: [],
    shopping: [],
    mealPrepNote: '',
    bulkNote: '',
    hairNote: '',
    teethNote: '',
    careNextAction: '',
    careAppointment: '',
    careCostNote: '',
    visits: [],
    prescriptionNote: '',
  }
}

function workspaceProject(): PortfolioItem {
  return {
    id: RUN_PROJECT_ID,
    name: 'Generational Run',
    status: 'active',
    kind: 'workspace',
    nextAction: 'Nächste umsatzwirksame Aufgabe festlegen',
    confirmed: true,
    note: 'Arbeitsbereich. Kein Umsatzexperiment.',
  }
}

function draftAsset(seed: { id: string; name: string; note: string }): AssetRecord {
  return {
    id: seed.id,
    name: seed.name,
    url: null,
    platform: null,
    audience: null,
    access: 'unknown',
    lastActivity: null,
    contentRights: null,
    metricValue: null,
    metricDate: null,
    metricSource: null,
    revenue: null,
    products: null,
    confirmed: false,
    note: seed.note,
    updatedAt: RUN_EPOCH,
  }
}

export function initialGenerationalRun(): GenerationalRunState {
  return {
    version: 1,
    projectId: RUN_PROJECT_ID,
    initialized: true,
    updatedAt: RUN_EPOCH,
    draftsSeeded: true,
    energyMode: 'normal',
    capacity: 'normal',
    experimentLimit: DEFAULT_EXPERIMENT_LIMIT,
    capacityNote: '',
    captureDraft: '',
    tasks: [],
    inbox: [],
    portfolio: [workspaceProject()],
    experiments: [],
    goals: [],
    assets: DRAFT_ASSETS.map(draftAsset),
    reviews: [],
    finance: emptyFinance(),
    delegations: [],
    preferences: [],
    reels: [],
    lifeRequirements: LIFE_REQUIREMENTS.map(item => ({ ...item })),
    healthPlan: emptyHealth(),
    session: null,
  }
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as Record<string, unknown>
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asOptional(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || undefined
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback
}

function touch(run: GenerationalRunState, now: string): GenerationalRunState {
  return { ...run, updatedAt: now }
}

function withProject(items: PortfolioItem[]): PortfolioItem[] {
  if (items.some(item => item.id === RUN_PROJECT_ID)) return items
  return [workspaceProject(), ...items]
}

function normalizeTask(raw: unknown): RunTask | null {
  const item = asRecord(raw)
  if (!item || typeof item.id !== 'string' || !item.id) return null
  const kind = oneOf(item.kind, ['revenue', 'support', 'anchor', 'appointment', 'prescribed'] as const, 'support')
  const minutes = asNullableNumber(item.minutes)
  return {
    id: item.id,
    title: asString(item.title).trim() || 'Aufgabe',
    nextStep: asString(item.nextStep),
    minutes: minutes == null ? 25 : Math.min(240, Math.max(5, Math.round(minutes))),
    energy: oneOf(item.energy, ['low', 'okay', 'high'] as const, 'okay'),
    result: asString(item.result),
    due: asOptional(item.due),
    status: oneOf(item.status, ['ready', 'active', 'paused', 'blocked', 'done'] as const, 'ready'),
    kind,
    protected: asBool(item.protected) || kind === 'appointment' || kind === 'prescribed',
    fallbackTaskId: asOptional(item.fallbackTaskId),
    blockedNote: asOptional(item.blockedNote),
    goalId: asOptional(item.goalId),
    createdAt: asString(item.createdAt) || RUN_EPOCH,
    updatedAt: asString(item.updatedAt) || RUN_EPOCH,
  }
}

function normalizeInbox(raw: unknown): InboxItem | null {
  const item = asRecord(raw)
  if (!item || typeof item.id !== 'string' || !asString(item.text).trim()) return null
  return {
    id: item.id,
    text: asString(item.text).trim(),
    url: asOptional(item.url),
    kind: oneOf(item.kind, ['text', 'link', 'idea', 'task'] as const, 'text'),
    createdAt: asString(item.createdAt) || RUN_EPOCH,
  }
}

function normalizePortfolio(raw: unknown): PortfolioItem | null {
  const item = asRecord(raw)
  if (!item || typeof item.id !== 'string' || !item.id) return null
  return {
    id: item.id,
    name: asString(item.name).trim() || 'Projekt',
    status: oneOf(item.status, ['idea', 'ready', 'active', 'paused', 'done'] as const, 'idea'),
    kind: oneOf(item.kind, ['workspace', 'revenue', 'other'] as const, 'other'),
    nextAction: asString(item.nextAction),
    confirmed: item.id === RUN_PROJECT_ID ? true : asBool(item.confirmed),
    note: asString(item.note),
  }
}

function normalizeExperiment(raw: unknown): Experiment | null {
  const item = asRecord(raw)
  if (!item || typeof item.id !== 'string' || !item.id) return null
  return {
    id: item.id,
    offer: asString(item.offer),
    buyers: asString(item.buyers),
    hypothesis: asString(item.hypothesis),
    budgetLimit: asNullableNumber(item.budgetLimit),
    timeBudgetMin: asNullableNumber(item.timeBudgetMin),
    durationDays: asNullableNumber(item.durationDays),
    success: asString(item.success),
    abort: asString(item.abort),
    metricsNote: asString(item.metricsNote),
    nextAction: asString(item.nextAction),
    status: oneOf(item.status, ['idea', 'active', 'paused', 'done'] as const, 'idea'),
    basis: asString(item.basis),
    uncertainty: asString(item.uncertainty),
    updatedAt: asString(item.updatedAt) || RUN_EPOCH,
  }
}

function normalizeGoal(raw: unknown): GoalNode | null {
  const item = asRecord(raw)
  if (!item || typeof item.id !== 'string' || !item.id) return null
  return {
    id: item.id,
    level: oneOf(item.level, ['big', 'mid', 'task'] as const, 'task'),
    parentId: asOptional(item.parentId),
    title: asString(item.title).trim() || 'Ziel',
    result: asString(item.result),
    status: oneOf(item.status, ['draft', 'active', 'paused', 'done'] as const, 'draft'),
    due: asOptional(item.due),
    updatedAt: asString(item.updatedAt) || RUN_EPOCH,
  }
}

function normalizeAsset(raw: unknown): AssetRecord | null {
  const item = asRecord(raw)
  if (!item || typeof item.id !== 'string' || !item.id) return null
  return {
    id: item.id,
    name: asString(item.name).trim() || 'Asset',
    url: asNullableString(item.url),
    platform: asNullableString(item.platform),
    audience: asNullableString(item.audience),
    access: oneOf(item.access, ['unknown', 'owned', 'shared', 'none'] as const, 'unknown'),
    lastActivity: asNullableString(item.lastActivity),
    contentRights: asNullableString(item.contentRights),
    metricValue: asNullableNumber(item.metricValue),
    metricDate: asNullableString(item.metricDate),
    metricSource: asNullableString(item.metricSource),
    revenue: asNullableNumber(item.revenue),
    products: asNullableString(item.products),
    confirmed: asBool(item.confirmed),
    note: asString(item.note),
    updatedAt: asString(item.updatedAt) || RUN_EPOCH,
  }
}

function normalizeReview(raw: unknown): WeekReview | null {
  const item = asRecord(raw)
  if (!item || typeof item.id !== 'string') return null
  const decision = item.decision
  return {
    id: item.id,
    periodStart: asString(item.periodStart),
    periodEnd: asString(item.periodEnd),
    summary: asString(item.summary),
    decision: decision === 'continue' || decision === 'change' || decision === 'pause' ? decision : undefined,
    note: asString(item.note),
    updatedAt: asString(item.updatedAt) || RUN_EPOCH,
  }
}

function normalizeDelegation(raw: unknown): DelegationItem | null {
  const item = asRecord(raw)
  if (!item || typeof item.id !== 'string') return null
  return {
    id: item.id,
    task: asString(item.task),
    owner: asString(item.owner),
    input: asString(item.input),
    example: asString(item.example),
    output: asString(item.output),
    doneWhen: asString(item.doneWhen),
    budget: asString(item.budget),
    due: asString(item.due),
    status: oneOf(item.status, ['draft', 'active', 'blocked', 'done'] as const, 'draft'),
    questions: asString(item.questions),
    updatedAt: asString(item.updatedAt) || RUN_EPOCH,
  }
}

function normalizePreference(raw: unknown): PreferenceItem | null {
  const item = asRecord(raw)
  if (!item || typeof item.id !== 'string' || !asString(item.text).trim()) return null
  return {
    id: item.id,
    kind: oneOf(item.kind, ['fact', 'preference', 'hypothesis'] as const, 'hypothesis'),
    text: asString(item.text).trim(),
    source: asString(item.source) || 'Nutzer',
    at: asString(item.at) || RUN_EPOCH,
    enabled: item.enabled !== false,
  }
}

function normalizeCandidate(raw: unknown): ReelCandidate | null {
  const item = asRecord(raw)
  if (!item || typeof item.id !== 'string') return null
  return {
    id: item.id,
    text: asString(item.text),
    category: asString(item.category),
    sourceKind: oneOf(item.sourceKind, ['note', 'transcript', 'external'] as const, 'note'),
    timestamp: asOptional(item.timestamp),
  }
}

function normalizeReel(raw: unknown): ReelJob | null {
  const item = asRecord(raw)
  if (!item || typeof item.id !== 'string') return null
  return {
    id: item.id,
    fileName: asString(item.fileName) || 'Import',
    status: oneOf(item.status, ['import', 'transcript', 'review', 'released', 'error'] as const, 'import'),
    error: asOptional(item.error),
    transcript: item.transcript == null ? null : asString(item.transcript),
    transcriptBlocked: asBool(item.transcriptBlocked),
    candidates: Array.isArray(item.candidates)
      ? item.candidates.map(normalizeCandidate).filter((entry): entry is ReelCandidate => Boolean(entry))
      : [],
    knowledgeId: asOptional(item.knowledgeId),
    updatedAt: asString(item.updatedAt) || RUN_EPOCH,
  }
}

function normalizeRequirement(raw: unknown, index: number): LifeRequirement | null {
  const item = asRecord(raw)
  if (!item || typeof item.id !== 'string') return null
  const fallback = LIFE_REQUIREMENTS[index]
  return {
    id: item.id,
    label: asString(item.label) || fallback?.label || 'Bereich',
    active: asBool(item.active),
    note: asString(item.note),
  }
}

function normalizeMeals(raw: unknown): MealDraft[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap(entry => {
    const record = asRecord(entry)
    if (!record || typeof record.id !== 'string') return []
    const name = asString(record.name).trim()
    if (!name) return []
    return [{ id: record.id, name, note: asString(record.note) }]
  })
}

function normalizeShopping(raw: unknown): ShoppingItem[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap(entry => {
    const record = asRecord(entry)
    if (!record || typeof record.id !== 'string') return []
    const text = asString(record.text).trim()
    if (!text) return []
    return [{ id: record.id, text }]
  })
}

function normalizeVisits(raw: unknown): VisitDraft[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap(entry => {
    const record = asRecord(entry)
    if (!record || typeof record.id !== 'string') return []
    const title = asString(record.title).trim()
    if (!title) return []
    return [{
      id: record.id,
      title,
      date: asString(record.date),
      documents: asString(record.documents),
      followUp: asString(record.followUp),
    }]
  })
}

function normalizeHealth(raw: unknown): HealthPlan {
  const base = emptyHealth()
  const item = asRecord(raw)
  if (!item) return base
  const sessions = asNullableNumber(item.movementSessionsPerWeek)
  const points = Array.isArray(item.weightPoints)
    ? item.weightPoints.flatMap(point => {
      const record = asRecord(point)
      if (!record || typeof record.id !== 'string') return []
      const value = asNullableNumber(record.value)
      if (value == null) return []
      return [{
        id: record.id,
        date: asString(record.date),
        unit: 'kg' as const,
        value,
      }]
    })
    : []
  const supplements = Array.isArray(item.supplements)
    ? item.supplements.flatMap(entry => {
      const record = asRecord(entry)
      if (!record || typeof record.id !== 'string') return []
      return [{
        id: record.id,
        product: asString(record.product),
        amount: asString(record.amount),
        stock: asString(record.stock),
      }]
    })
    : []
  return {
    movementSessionsPerWeek: sessions == null ? 3 : Math.min(14, Math.max(0, Math.round(sessions))),
    movementNote: asString(item.movementNote) || base.movementNote,
    calorieTarget: asNullableNumber(item.calorieTarget),
    proteinTarget: asNullableNumber(item.proteinTarget),
    sleepStart: asNullableString(item.sleepStart),
    sleepEnd: asNullableString(item.sleepEnd),
    sleepRecovery: asNullableString(item.sleepRecovery),
    weightPoints: points,
    skincareNote: asString(item.skincareNote),
    whiteningOptional: asBool(item.whiteningOptional),
    supplements,
    meals: normalizeMeals(item.meals),
    shopping: normalizeShopping(item.shopping),
    mealPrepNote: asString(item.mealPrepNote),
    bulkNote: asString(item.bulkNote),
    hairNote: asString(item.hairNote),
    teethNote: asString(item.teethNote),
    careNextAction: asString(item.careNextAction),
    careAppointment: asString(item.careAppointment),
    careCostNote: asString(item.careCostNote),
    visits: normalizeVisits(item.visits),
    prescriptionNote: asString(item.prescriptionNote),
  }
}

function listOf<T>(raw: unknown, normalize: (item: unknown) => T | null): T[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap(item => {
    const next = normalize(item)
    return next ? [next] : []
  })
}

export function normalizeGenerationalRun(raw: unknown): GenerationalRunState {
  const seed = initialGenerationalRun()
  const item = asRecord(raw)
  if (!item) return seed
  const draftsSeeded = item.draftsSeeded === true
  const assets = listOf(item.assets, normalizeAsset)
  const requirements = Array.isArray(item.lifeRequirements)
    ? item.lifeRequirements.flatMap((entry, index) => {
      const next = normalizeRequirement(entry, index)
      return next ? [next] : []
    })
    : []
  const session = asRecord(item.session)
  const taskIds = new Set(listOf(item.tasks, normalizeTask).map(task => task.id))
  const limit = asNullableNumber(item.experimentLimit)
  return {
    ...seed,
    version: 1,
    projectId: RUN_PROJECT_ID,
    initialized: true,
    updatedAt: asString(item.updatedAt) || RUN_EPOCH,
    draftsSeeded: draftsSeeded || assets.length > 0,
    energyMode: oneOf(item.energyMode, ['normal', 'low'] as const, 'normal'),
    capacity: oneOf(item.capacity, ['small', 'normal', 'wide'] as const, 'normal'),
    experimentLimit: limit == null ? DEFAULT_EXPERIMENT_LIMIT : Math.min(8, Math.max(1, Math.round(limit))),
    capacityNote: asString(item.capacityNote),
    captureDraft: asString(item.captureDraft),
    tasks: listOf(item.tasks, normalizeTask),
    inbox: listOf(item.inbox, normalizeInbox),
    portfolio: withProject(listOf(item.portfolio, normalizePortfolio)),
    experiments: listOf(item.experiments, normalizeExperiment),
    goals: listOf(item.goals, normalizeGoal),
    assets: assets.length > 0 || draftsSeeded ? assets : seed.assets,
    reviews: listOf(item.reviews, normalizeReview),
    finance: {
      ...emptyFinance(),
      ...(asRecord(item.finance) ? {
        revenue: asNullableNumber(asRecord(item.finance)?.revenue),
        paidIn: asNullableNumber(asRecord(item.finance)?.paidIn),
        variableCosts: asNullableNumber(asRecord(item.finance)?.variableCosts),
        fixedCosts: asNullableNumber(asRecord(item.finance)?.fixedCosts),
        receivables: asNullableNumber(asRecord(item.finance)?.receivables),
        capital: asNullableNumber(asRecord(item.finance)?.capital),
        returnsAmount: asNullableNumber(asRecord(item.finance)?.returnsAmount),
        shipping: asNullableNumber(asRecord(item.finance)?.shipping),
        purchaseCosts: asNullableNumber(asRecord(item.finance)?.purchaseCosts),
        platformFees: asNullableNumber(asRecord(item.finance)?.platformFees),
        assumptions: asString(asRecord(item.finance)?.assumptions),
      } : {}),
    },
    delegations: listOf(item.delegations, normalizeDelegation),
    preferences: listOf(item.preferences, normalizePreference),
    reels: listOf(item.reels, normalizeReel),
    lifeRequirements: requirements.length > 0 ? requirements : seed.lifeRequirements,
    healthPlan: normalizeHealth(item.healthPlan),
    session: session && typeof session.taskId === 'string' && taskIds.has(session.taskId)
      && (session.phase === 'running' || session.phase === 'paused')
      ? { taskId: session.taskId, phase: session.phase }
      : null,
  }
}

export function activeRevenueCount(run: GenerationalRunState): number {
  const experiments = run.experiments.filter(item => item.status === 'active').length
  const projects = run.portfolio.filter(item => item.kind === 'revenue' && item.status === 'active').length
  return experiments + projects
}

export function todayBoard(run: GenerationalRunState): { primary: RunTask[]; protectedItems: RunTask[] } {
  const open = run.tasks.filter(task => task.status !== 'done')
  const protectedItems = open.filter(task => task.protected)
  const work = open.filter(task => !task.protected)
  const pool = run.energyMode === 'low' ? work.filter(task => task.energy === 'low') : work
  const revenue = pool.filter(task => task.kind === 'revenue')
  const rest = pool.filter(task => task.kind !== 'revenue')
  const primary: RunTask[] = []
  if (revenue[0]) primary.push(revenue[0])
  for (const task of [...rest, ...revenue.slice(1)]) {
    if (primary.length >= 3) break
    primary.push(task)
  }
  return { primary, protectedItems }
}

export function localPriority(run: GenerationalRunState): { taskId?: string; reason: string; mode: 'local' } {
  const board = todayBoard(run)
  const task = [...board.primary].sort((left, right) => (left.due ?? '9999-99-99').localeCompare(right.due ?? '9999-99-99'))[0]
  const blocked = run.tasks.filter(item => item.status === 'blocked').length
  const missingAction = run.experiments.filter(item => item.status === 'active' && !item.nextAction.trim()).length
  const preference = run.preferences.find(item => item.enabled && item.kind === 'preference')
  const tail = [
    blocked ? `${blocked} Blockaden.` : '',
    missingAction ? `${missingAction} aktive Experimente ohne nächste Handlung.` : '',
    preference ? `Präferenz: ${preference.text.slice(0, 80)}.` : '',
  ].filter(Boolean).join(' ')
  if (!task) {
    return {
      mode: 'local',
      reason: `${run.energyMode === 'low'
        ? 'Wenig Energie: keine kleine Aufgabe offen. Termine und Einnahmen bleiben separat sichtbar.'
        : 'Keine offene Hauptaufgabe.'} ${tail}`.trim(),
    }
  }
  const due = task.due ? ` Termin ${task.due}.` : ''
  return {
    mode: 'local',
    taskId: task.id,
    reason: `${run.energyMode === 'low' ? 'Wenig Energie' : 'Normale Kapazität'}, ${run.capacity}. Zuerst: ${task.title}.${due} ${tail}`.trim(),
  }
}

const VARIABLE_COST_KEYS = ['variableCosts', 'returnsAmount', 'shipping', 'purchaseCosts', 'platformFees'] as const

export function contributionDetail(finance: FinanceState): { value: number; partial: boolean } | null {
  if (finance.paidIn == null) return null
  const known = VARIABLE_COST_KEYS.flatMap(key => {
    const value = finance[key]
    return value == null ? [] : [value]
  })
  if (known.length === 0) return null
  const partial = VARIABLE_COST_KEYS.some(key => finance[key] == null)
  return {
    value: finance.paidIn - known.reduce((sum, value) => sum + value, 0),
    partial,
  }
}

export function contributionMargin(finance: FinanceState): number | null {
  return contributionDetail(finance)?.value ?? null
}

export function isOverdue(task: RunTask, today: string): boolean {
  return Boolean(task.due && task.due < today && task.status !== 'done')
}

export function weightTrend(points: HealthPlan['weightPoints']): { comparable: false } | { comparable: true; delta: number } {
  if (points.length < 2) return { comparable: false }
  const ordered = [...points].sort((left, right) => left.date.localeCompare(right.date))
  const first = ordered[0]
  const last = ordered[ordered.length - 1]
  if (!first || !last) return { comparable: false }
  return { comparable: true, delta: last.value - first.value }
}

function clockMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function sleepDurationMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const from = clockMinutes(start)
  const to = clockMinutes(end)
  if (from == null || to == null || from === to) return null
  return to > from ? to - from : 24 * 60 - from + to
}

function mapTask(run: GenerationalRunState, id: string, now: string, patch: Partial<RunTask>): GenerationalRunState {
  return touch({
    ...run,
    tasks: run.tasks.map(task => task.id === id ? { ...task, ...patch, updatedAt: now } : task),
  }, now)
}

export function setCaptureDraft(run: GenerationalRunState, captureDraft: string, now: string): GenerationalRunState {
  return touch({ ...run, captureDraft }, now)
}

export function addInbox(
  run: GenerationalRunState,
  input: { text: string; url?: string; kind?: InboxKind },
  now: string,
  id = runId('inbox'),
): GenerationalRunState {
  const text = input.text.trim()
  if (!text) return run
  const item: InboxItem = {
    id,
    text,
    url: input.url?.trim() || undefined,
    kind: input.kind ?? (input.url ? 'link' : 'idea'),
    createdAt: now,
  }
  return touch({ ...run, inbox: [item, ...run.inbox], captureDraft: '' }, now)
}

export function removeInbox(run: GenerationalRunState, id: string, now: string): GenerationalRunState {
  return touch({ ...run, inbox: run.inbox.filter(item => item.id !== id) }, now)
}

export function addTask(
  run: GenerationalRunState,
  input: {
    title: string
    nextStep?: string
    minutes?: number
    energy?: TaskEnergy
    result?: string
    due?: string
    kind?: TaskKind
    goalId?: string
  },
  now: string,
  id = runId('task'),
): GenerationalRunState {
  const title = input.title.trim()
  if (!title) return run
  const kind = input.kind ?? 'revenue'
  const task: RunTask = {
    id,
    title,
    nextStep: input.nextStep?.trim() || title,
    minutes: input.minutes && input.minutes >= 5 ? Math.min(240, Math.round(input.minutes)) : 25,
    energy: input.energy ?? (kind === 'appointment' || kind === 'prescribed' ? 'low' : 'okay'),
    result: input.result?.trim() ?? '',
    due: input.due?.trim() || undefined,
    status: 'ready',
    kind,
    protected: kind === 'appointment' || kind === 'prescribed',
    goalId: input.goalId,
    createdAt: now,
    updatedAt: now,
  }
  return touch({ ...run, tasks: [...run.tasks, task] }, now)
}

function resume(run: GenerationalRunState, task: RunTask, now: string): { run: GenerationalRunState; task: RunTask } {
  const next = mapTask(run, task.id, now, { status: 'active' })
  const withSession = touch({ ...next, session: { taskId: task.id, phase: 'running' } }, now)
  const updated = withSession.tasks.find(item => item.id === task.id) ?? task
  return { run: withSession, task: updated }
}

export function startNext(run: GenerationalRunState, now: string): { run: GenerationalRunState; task: RunTask | null } {
  if (run.session) {
    const current = run.tasks.find(task => task.id === run.session?.taskId && task.status !== 'done')
    const allowed = current && (run.energyMode === 'normal' || current.energy === 'low' || current.protected)
    if (current && allowed) return resume(run, current, now)
  }
  const next = todayBoard(run).primary.find(task => task.status !== 'done') ?? null
  if (!next) return { run, task: null }
  return resume(run, next, now)
}

export function startTask(run: GenerationalRunState, taskId: string, now: string): GenerationalRunState {
  const task = run.tasks.find(item => item.id === taskId && item.status !== 'done')
  if (!task) return run
  return resume(run, task, now).run
}

export function pauseActive(run: GenerationalRunState, now: string): GenerationalRunState {
  if (!run.session) return run
  const taskId = run.session.taskId
  return touch({
    ...mapTask(run, taskId, now, { status: 'paused' }),
    session: { taskId, phase: 'paused' },
  }, now)
}

export function completeActive(run: GenerationalRunState, now: string): GenerationalRunState {
  if (!run.session) return run
  const taskId = run.session.taskId
  return touch({
    ...mapTask(run, taskId, now, { status: 'done' }),
    session: null,
  }, now)
}

export function blockActive(run: GenerationalRunState, note: string, now: string): { run: GenerationalRunState; fallback: RunTask | null } {
  if (!run.session) return { run, fallback: null }
  const taskId = run.session.taskId
  const current = run.tasks.find(task => task.id === taskId)
  const fallback = run.tasks.find(task => task.id !== taskId && task.status !== 'done' && task.status !== 'blocked') ?? null
  const next = mapTask(run, taskId, now, {
    status: 'blocked',
    blockedNote: note.trim() || undefined,
    fallbackTaskId: current?.fallbackTaskId || fallback?.id,
  })
  return {
    run: touch({ ...next, session: null }, now),
    fallback,
  }
}

export function setEnergyMode(run: GenerationalRunState, energyMode: EnergyMode, now: string): GenerationalRunState {
  return touch({ ...run, energyMode }, now)
}

export function setCapacity(run: GenerationalRunState, capacity: DayCapacity, now: string): GenerationalRunState {
  return touch({ ...run, capacity }, now)
}

export function setExperimentLimit(run: GenerationalRunState, limit: number, now: string): GenerationalRunState {
  const nextLimit = Math.min(8, Math.max(1, Math.round(limit)))
  const active = activeRevenueCount(run)
  const capacityNote = nextLimit > run.experimentLimit
    ? `Vorgabe von ${run.experimentLimit} auf ${nextLimit}. ${active} Umsatzexperimente sind aktiv. Aufmerksamkeit und Zeit teilen sich auf alle aktiven Experimente.`
    : run.capacityNote
  return touch({ ...run, experimentLimit: nextLimit, capacityNote }, now)
}

export type LimitResult =
  | { ok: true; run: GenerationalRunState }
  | { ok: false; run: GenerationalRunState; reason: 'limit'; active: number; limit: number }

function canActivate(run: GenerationalRunState, alreadyActive: boolean): boolean {
  if (alreadyActive) return true
  return activeRevenueCount(run) < run.experimentLimit
}

export function setExperimentStatus(
  run: GenerationalRunState,
  id: string,
  status: ExperimentStatus,
  now: string,
): LimitResult {
  const current = run.experiments.find(item => item.id === id)
  if (!current) return { ok: false, run, reason: 'limit', active: activeRevenueCount(run), limit: run.experimentLimit }
  if (status === 'active' && !canActivate(run, current.status === 'active')) {
    return { ok: false, run, reason: 'limit', active: activeRevenueCount(run), limit: run.experimentLimit }
  }
  return {
    ok: true,
    run: touch({
      ...run,
      experiments: run.experiments.map(item => item.id === id ? { ...item, status, updatedAt: now } : item),
    }, now),
  }
}

export function addExperiment(
  run: GenerationalRunState,
  input: Pick<Experiment, 'offer' | 'buyers' | 'hypothesis' | 'success' | 'abort' | 'nextAction' | 'basis' | 'uncertainty'> & Partial<Experiment>,
  now: string,
  id = runId('experiment'),
): GenerationalRunState {
  const experiment: Experiment = {
    id,
    offer: input.offer.trim(),
    buyers: input.buyers.trim(),
    hypothesis: input.hypothesis.trim(),
    budgetLimit: input.budgetLimit ?? null,
    timeBudgetMin: input.timeBudgetMin ?? null,
    durationDays: input.durationDays ?? null,
    success: input.success.trim(),
    abort: input.abort.trim(),
    metricsNote: input.metricsNote?.trim() ?? '',
    nextAction: input.nextAction.trim(),
    status: 'idea',
    basis: input.basis.trim(),
    uncertainty: input.uncertainty.trim(),
    updatedAt: now,
  }
  if (!experiment.offer) return run
  return touch({ ...run, experiments: [...run.experiments, experiment] }, now)
}

export function patchExperiment(
  run: GenerationalRunState,
  id: string,
  patch: Partial<Pick<Experiment, 'offer' | 'buyers' | 'hypothesis' | 'budgetLimit' | 'timeBudgetMin' | 'durationDays' | 'success' | 'abort' | 'metricsNote' | 'nextAction' | 'basis' | 'uncertainty'>>,
  now: string,
): GenerationalRunState {
  return touch({
    ...run,
    experiments: run.experiments.map(item => {
      if (item.id !== id) return item
      const offer = patch.offer === undefined ? item.offer : patch.offer.trim()
      if (!offer) return item
      return {
        ...item,
        ...patch,
        id: item.id,
        offer,
        buyers: patch.buyers === undefined ? item.buyers : patch.buyers.trim(),
        hypothesis: patch.hypothesis === undefined ? item.hypothesis : patch.hypothesis.trim(),
        success: patch.success === undefined ? item.success : patch.success.trim(),
        abort: patch.abort === undefined ? item.abort : patch.abort.trim(),
        metricsNote: patch.metricsNote === undefined ? item.metricsNote : patch.metricsNote.trim(),
        nextAction: patch.nextAction === undefined ? item.nextAction : patch.nextAction.trim(),
        basis: patch.basis === undefined ? item.basis : patch.basis.trim(),
        uncertainty: patch.uncertainty === undefined ? item.uncertainty : patch.uncertainty.trim(),
        status: item.status,
        updatedAt: now,
      }
    }),
  }, now)
}

export function setPortfolioStatus(
  run: GenerationalRunState,
  id: string,
  status: PortfolioStatus,
  now: string,
): LimitResult {
  const current = run.portfolio.find(item => item.id === id)
  if (!current || current.kind === 'workspace') {
    return { ok: false, run, reason: 'limit', active: activeRevenueCount(run), limit: run.experimentLimit }
  }
  const activatingRevenue = current.kind === 'revenue' && status === 'active'
  if (activatingRevenue && !canActivate(run, current.status === 'active')) {
    return { ok: false, run, reason: 'limit', active: activeRevenueCount(run), limit: run.experimentLimit }
  }
  return {
    ok: true,
    run: touch({
      ...run,
      portfolio: run.portfolio.map(item => item.id === id ? { ...item, status } : item),
    }, now),
  }
}

export function addPortfolio(
  run: GenerationalRunState,
  input: { name: string; kind?: PortfolioKind; nextAction?: string },
  now: string,
  id = runId('project'),
): GenerationalRunState {
  const name = input.name.trim()
  if (!name) return run
  const item: PortfolioItem = {
    id,
    name,
    status: 'idea',
    kind: input.kind ?? 'other',
    nextAction: input.nextAction?.trim() ?? '',
    confirmed: true,
    note: '',
  }
  return touch({ ...run, portfolio: [...run.portfolio, item] }, now)
}

export function patchPortfolio(
  run: GenerationalRunState,
  id: string,
  patch: Partial<Pick<PortfolioItem, 'name' | 'nextAction' | 'note' | 'kind'>>,
  now: string,
): GenerationalRunState {
  return touch({
    ...run,
    portfolio: run.portfolio.map(item => item.id === id ? { ...item, ...patch } : item),
  }, now)
}

export function addGoal(
  run: GenerationalRunState,
  input: { level: GoalLevel; parentId?: string; title: string; result?: string; due?: string },
  now: string,
  id = runId('goal'),
): GenerationalRunState {
  const title = input.title.trim()
  if (!title) return run
  const goal: GoalNode = {
    id,
    level: input.level,
    parentId: input.parentId,
    title,
    result: input.result?.trim() ?? '',
    status: 'draft',
    due: input.due?.trim() || undefined,
    updatedAt: now,
  }
  return touch({ ...run, goals: [...run.goals, goal] }, now)
}

export function patchGoal(
  run: GenerationalRunState,
  id: string,
  patch: Partial<Pick<GoalNode, 'title' | 'result' | 'status' | 'due'>>,
  now: string,
): GenerationalRunState {
  return touch({
    ...run,
    goals: run.goals.map(goal => goal.id === id ? { ...goal, ...patch, updatedAt: now } : goal),
  }, now)
}

export function addAsset(run: GenerationalRunState, name: string, now: string, id = runId('asset')): GenerationalRunState {
  const trimmed = name.trim()
  if (!trimmed) return run
  return touch({
    ...run,
    draftsSeeded: true,
    assets: [...run.assets, {
      ...draftAsset({ id, name: trimmed, note: '' }),
      confirmed: true,
      updatedAt: now,
    }],
  }, now)
}

export function patchAsset(
  run: GenerationalRunState,
  id: string,
  patch: Partial<AssetRecord>,
  now: string,
): GenerationalRunState {
  return touch({
    ...run,
    draftsSeeded: true,
    assets: run.assets.map(asset => asset.id === id ? { ...asset, ...patch, id: asset.id, updatedAt: now } : asset),
  }, now)
}

export function weekSummary(run: GenerationalRunState): string {
  const done = run.tasks.filter(task => task.status === 'done').length
  const blocked = run.tasks.filter(task => task.status === 'blocked').length
  const active = activeRevenueCount(run)
  const margin = contributionDetail(run.finance)
  const money = margin == null
    ? 'Deckungsbeitrag noch nicht berechenbar.'
    : `Deckungsbeitrag ${margin.value} (bezahlt minus bekannte variable Kosten${margin.partial ? ', unvollständig' : ''}). Annahme, keine Steuerbewertung.`
  return `${done} abgeschlossene Aufgaben, ${active} aktive Umsatzexperimente, ${blocked} Blockaden. ${money}`
}

export function rescheduleTask(run: GenerationalRunState, id: string, due: string, now: string): GenerationalRunState {
  const task = run.tasks.find(item => item.id === id && item.status !== 'done')
  if (!task || !due.trim()) return run
  const status = task.status === 'blocked' || task.status === 'paused' ? 'ready' : task.status
  return mapTask(run, id, now, { due: due.trim(), status })
}

export function shrinkTask(run: GenerationalRunState, id: string, now: string): GenerationalRunState {
  const task = run.tasks.find(item => item.id === id && item.status !== 'done')
  if (!task) return run
  const minutes = Math.max(5, Math.round(task.minutes / 2))
  return mapTask(run, id, now, { minutes, energy: minutes <= 15 ? 'low' : task.energy })
}

export function pauseTask(run: GenerationalRunState, id: string, now: string): GenerationalRunState {
  const task = run.tasks.find(item => item.id === id && item.status !== 'done')
  if (!task) return run
  const cleared = run.session?.taskId === id ? null : run.session
  return touch({ ...mapTask(run, id, now, { status: 'paused' }), session: cleared }, now)
}

export function delegateTask(run: GenerationalRunState, id: string, now: string, delegationId = runId('delegation')): GenerationalRunState {
  const task = run.tasks.find(item => item.id === id && item.status !== 'done')
  if (!task) return run
  const withBrief = addDelegation(run, task.title, now, delegationId)
  return mapTask(withBrief, id, now, { status: 'paused', blockedNote: 'An Delegation übergeben' })
}

export function promoteGoal(run: GenerationalRunState, goalId: string, now: string, taskId = runId('task')): GenerationalRunState {
  const goal = run.goals.find(item => item.id === goalId && item.level === 'task')
  if (!goal || run.tasks.some(task => task.goalId === goalId)) return run
  return addTask(run, {
    title: goal.title,
    nextStep: goal.title,
    result: goal.result,
    due: goal.due,
    kind: 'revenue',
    energy: 'okay',
    goalId,
  }, now, taskId)
}

export function applyReviewDecision(
  run: GenerationalRunState,
  decision: ReviewDecision,
  note: string,
  now: string,
  today = new Date(now),
): GenerationalRunState {
  const saved = saveWeekDecision(run, decision, note, now, today)
  if (decision === 'pause') {
    return touch({
      ...saved,
      experiments: saved.experiments.map(item => item.status === 'active' ? { ...item, status: 'paused', updatedAt: now } : item),
      portfolio: saved.portfolio.map(item => item.kind === 'revenue' && item.status === 'active' ? { ...item, status: 'paused' } : item),
    }, now)
  }
  if (decision === 'change') {
    return touch({
      ...saved,
      capacityNote: 'Review: eine Variable ändern. Angebot, Käufergruppe und Vertriebsweg nicht gleichzeitig.',
    }, now)
  }
  return saved
}

export function attachTranscript(run: GenerationalRunState, jobId: string, text: string, now: string): { run: GenerationalRunState; error?: string } {
  const job = run.reels.find(item => item.id === jobId)
  if (!job) return { run, error: 'Import nicht gefunden.' }
  if (job.knowledgeId || job.status === 'released') return { run, error: 'Bereits freigegeben.' }
  return importReel(run, { fileName: job.fileName, byteSize: 1, text, existingJobId: jobId, now })
}

export function saveWeekDecision(
  run: GenerationalRunState,
  decision: ReviewDecision,
  note: string,
  now: string,
  today = new Date(now),
): GenerationalRunState {
  const period = weekPeriod(today)
  const id = `week-${period.start}`
  const review: WeekReview = {
    id,
    periodStart: period.start,
    periodEnd: period.end,
    summary: weekSummary(run),
    decision,
    note: note.trim(),
    updatedAt: now,
  }
  const reviews = run.reviews.some(item => item.id === id)
    ? run.reviews.map(item => item.id === id ? review : item)
    : [...run.reviews, review]
  return touch({ ...run, reviews }, now)
}

export function patchFinance(run: GenerationalRunState, patch: Partial<FinanceState>, now: string): GenerationalRunState {
  return touch({ ...run, finance: { ...run.finance, ...patch } }, now)
}

export function addDelegation(run: GenerationalRunState, task: string, now: string, id = runId('delegation')): GenerationalRunState {
  const title = task.trim()
  if (!title) return run
  const item: DelegationItem = {
    id,
    task: title,
    owner: '',
    input: '',
    example: '',
    output: '',
    doneWhen: '',
    budget: '',
    due: '',
    status: 'draft',
    questions: '',
    updatedAt: now,
  }
  return touch({ ...run, delegations: [...run.delegations, item] }, now)
}

export function patchDelegation(
  run: GenerationalRunState,
  id: string,
  patch: Partial<DelegationItem>,
  now: string,
): GenerationalRunState {
  return touch({
    ...run,
    delegations: run.delegations.map(item => item.id === id ? { ...item, ...patch, id: item.id, updatedAt: now } : item),
  }, now)
}

export function addPreference(
  run: GenerationalRunState,
  input: { kind: PreferenceKind; text: string; source?: string },
  now: string,
  id = runId('pref'),
): GenerationalRunState {
  const text = input.text.trim()
  if (!text) return run
  const item: PreferenceItem = {
    id,
    kind: input.kind,
    text,
    source: input.source?.trim() || 'Nutzer',
    at: now,
    enabled: true,
  }
  return touch({ ...run, preferences: [...run.preferences, item] }, now)
}

export function patchPreference(
  run: GenerationalRunState,
  id: string,
  patch: Partial<Pick<PreferenceItem, 'text' | 'enabled' | 'kind'>>,
  now: string,
): GenerationalRunState {
  return touch({
    ...run,
    preferences: run.preferences.map(item => item.id === id ? { ...item, ...patch } : item),
  }, now)
}

export function deletePreference(run: GenerationalRunState, id: string, now: string): GenerationalRunState {
  return touch({ ...run, preferences: run.preferences.filter(item => item.id !== id) }, now)
}

export function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split('.')
  return parts.length > 1 ? parts.at(-1) ?? '' : ''
}

export function importFileKind(fileName: string): 'text' | 'media' | 'unsupported' {
  const extension = extensionOf(fileName)
  if (TEXT_EXT.has(extension)) return 'text'
  if (MEDIA_EXT.has(extension)) return 'media'
  return 'unsupported'
}

function candidatesFromText(text: string, sourceKind: SourceKind, idFor: (index: number) => string): ReelCandidate[] {
  return text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((line, index) => ({
      id: idFor(index),
      text: line,
      category: '',
      sourceKind,
    }))
}

export function importReel(
  run: GenerationalRunState,
  input: {
    fileName: string
    byteSize: number
    text?: string
    existingJobId?: string
    now: string
    id?: string
  },
): { run: GenerationalRunState; error?: string } {
  const fileName = input.fileName.trim()
  const kind = importFileKind(fileName)
  if (!fileName || kind === 'unsupported') {
    const error = 'Dateityp nicht unterstützt. Erlaubt: Text, Untertitel oder Video/Audio.'
    return { run: markReelError(run, input.existingJobId, error, input.now), error }
  }
  if (input.byteSize > MAX_IMPORT_BYTES) {
    const error = 'Datei ist größer als 25 MB.'
    return { run: markReelError(run, input.existingJobId, error, input.now), error }
  }
  const text = input.text?.trim() ?? ''
  const sourceKind: SourceKind = kind === 'text' ? 'note' : 'transcript'
  const id = input.existingJobId || input.id || runId('reel')
  const existing = run.reels.find(job => job.id === id)
  if (kind === 'media' && !text) {
    const job: ReelJob = {
      id,
      fileName,
      status: 'transcript',
      error: 'Transkription ohne Dienst nicht verfügbar. Text einfügen und erneut versuchen.',
      transcript: null,
      transcriptBlocked: true,
      candidates: existing?.candidates ?? [],
      knowledgeId: existing?.knowledgeId,
      updatedAt: input.now,
    }
    return { run: upsertReel(run, job, input.now), error: job.error }
  }
  const job: ReelJob = {
    id,
    fileName,
    status: 'review',
    transcript: text,
    transcriptBlocked: false,
    candidates: candidatesFromText(text, sourceKind, index => existing?.candidates[index]?.id || `${id}-c${index}`),
    knowledgeId: existing?.knowledgeId,
    updatedAt: input.now,
  }
  return { run: upsertReel(run, job, input.now) }
}

function markReelError(run: GenerationalRunState, id: string | undefined, error: string, now: string): GenerationalRunState {
  if (!id) return run
  const existing = run.reels.find(job => job.id === id)
  if (!existing) return run
  return upsertReel(run, { ...existing, status: 'error', error, updatedAt: now }, now)
}

function upsertReel(run: GenerationalRunState, job: ReelJob, now: string): GenerationalRunState {
  const reels = run.reels.some(item => item.id === job.id)
    ? run.reels.map(item => item.id === job.id ? job : item)
    : [job, ...run.reels]
  return touch({ ...run, reels }, now)
}

export function patchReelCandidate(
  run: GenerationalRunState,
  jobId: string,
  candidateId: string,
  patch: Partial<Pick<ReelCandidate, 'text' | 'category' | 'sourceKind'>>,
  now: string,
): GenerationalRunState {
  return touch({
    ...run,
    reels: run.reels.map(job => job.id === jobId ? {
      ...job,
      updatedAt: now,
      candidates: job.candidates.map(candidate => candidate.id === candidateId ? { ...candidate, ...patch } : candidate),
    } : job),
  }, now)
}

export function releaseReel(
  run: GenerationalRunState,
  jobId: string,
  now: string,
  knowledgeId = runId('knowledge'),
): { run: GenerationalRunState; created: boolean; knowledge?: ReleasedKnowledge; error?: string } {
  const job = run.reels.find(item => item.id === jobId)
  if (!job) return { run, created: false, error: 'Import nicht gefunden.' }
  if (job.knowledgeId || job.status === 'released') {
    return { run, created: false }
  }
  if (job.transcriptBlocked || job.status === 'transcript' || job.status === 'error') {
    return { run, created: false, error: job.error || 'Zuerst Text prüfen.' }
  }
  const lines = job.candidates.map(candidate => candidate.text.trim()).filter(Boolean)
  if (lines.length === 0) return { run, created: false, error: 'Kein Text zur Freigabe.' }
  const content = job.candidates
    .filter(candidate => candidate.text.trim())
    .map(candidate => `[${candidate.category.trim() || 'ohne Kategorie'}|${candidate.sourceKind}] ${candidate.text.trim()}`)
    .join('\n')
  const knowledge: ReleasedKnowledge = {
    id: knowledgeId,
    title: job.fileName,
    content,
    summary: content.slice(0, 180),
    source: `reel:${job.candidates[0]?.sourceKind ?? 'note'}`,
    topics: [...new Set(job.candidates.map(candidate => candidate.category.trim()).filter(Boolean))],
    tags: [...new Set(job.candidates.map(candidate => `quelle:${candidate.sourceKind}`))],
  }
  const nextJob: ReelJob = { ...job, status: 'released', knowledgeId: knowledge.id, error: undefined, updatedAt: now }
  return { run: upsertReel(run, nextJob, now), created: true, knowledge }
}

export function patchHealth(run: GenerationalRunState, patch: Partial<HealthPlan>, now: string): GenerationalRunState {
  return touch({ ...run, healthPlan: { ...run.healthPlan, ...patch } }, now)
}

function replaceById<T extends { id: string }>(items: T[], id: string, patch: Partial<T>): T[] {
  return items.map(item => item.id === id ? { ...item, ...patch, id: item.id } : item)
}

export function addSupplement(
  run: GenerationalRunState,
  input: { product: string; amount?: string; stock?: string },
  now: string,
  id = runId('supplement'),
): GenerationalRunState {
  const product = input.product.trim()
  if (!product) return run
  const item: SupplementDraft = { id, product, amount: input.amount?.trim() ?? '', stock: input.stock?.trim() ?? '' }
  return patchHealth(run, { supplements: [...run.healthPlan.supplements, item] }, now)
}

export function patchSupplement(
  run: GenerationalRunState,
  id: string,
  patch: Partial<Pick<SupplementDraft, 'product' | 'amount' | 'stock'>>,
  now: string,
): GenerationalRunState {
  const current = run.healthPlan.supplements.find(item => item.id === id)
  if (!current) return run
  const product = patch.product === undefined ? current.product : patch.product.trim()
  if (!product) return run
  return patchHealth(run, {
    supplements: replaceById(run.healthPlan.supplements, id, {
      ...patch,
      product,
      amount: patch.amount === undefined ? current.amount : patch.amount.trim(),
      stock: patch.stock === undefined ? current.stock : patch.stock.trim(),
    }),
  }, now)
}

export function removeSupplement(run: GenerationalRunState, id: string, now: string): GenerationalRunState {
  return patchHealth(run, { supplements: run.healthPlan.supplements.filter(item => item.id !== id) }, now)
}

export function addMeal(
  run: GenerationalRunState,
  input: { name: string; note?: string },
  now: string,
  id = runId('meal'),
): GenerationalRunState {
  const name = input.name.trim()
  if (!name) return run
  const item: MealDraft = { id, name, note: input.note?.trim() ?? '' }
  return patchHealth(run, { meals: [...run.healthPlan.meals, item] }, now)
}

export function removeMeal(run: GenerationalRunState, id: string, now: string): GenerationalRunState {
  return patchHealth(run, { meals: run.healthPlan.meals.filter(item => item.id !== id) }, now)
}

export function addShoppingItem(run: GenerationalRunState, text: string, now: string, id = runId('shop')): GenerationalRunState {
  const label = text.trim()
  if (!label) return run
  return patchHealth(run, { shopping: [...run.healthPlan.shopping, { id, text: label }] }, now)
}

export function removeShoppingItem(run: GenerationalRunState, id: string, now: string): GenerationalRunState {
  return patchHealth(run, { shopping: run.healthPlan.shopping.filter(item => item.id !== id) }, now)
}

export function addVisit(
  run: GenerationalRunState,
  input: { title: string; date?: string; documents?: string; followUp?: string },
  now: string,
  id = runId('visit'),
): GenerationalRunState {
  const title = input.title.trim()
  if (!title) return run
  const item: VisitDraft = {
    id,
    title,
    date: input.date?.trim() ?? '',
    documents: input.documents?.trim() ?? '',
    followUp: input.followUp?.trim() ?? '',
  }
  return patchHealth(run, { visits: [...run.healthPlan.visits, item] }, now)
}

export function removeVisit(run: GenerationalRunState, id: string, now: string): GenerationalRunState {
  return patchHealth(run, { visits: run.healthPlan.visits.filter(item => item.id !== id) }, now)
}

export function patchVisit(
  run: GenerationalRunState,
  id: string,
  patch: Partial<Pick<VisitDraft, 'date' | 'documents' | 'followUp'>>,
  now: string,
): GenerationalRunState {
  if (!run.healthPlan.visits.some(item => item.id === id)) return run
  const next: Partial<Pick<VisitDraft, 'date' | 'documents' | 'followUp'>> = {}
  if (patch.date !== undefined) next.date = patch.date.trim()
  if (patch.documents !== undefined) next.documents = patch.documents.trim()
  if (patch.followUp !== undefined) next.followUp = patch.followUp.trim()
  return patchHealth(run, { visits: replaceById<VisitDraft>(run.healthPlan.visits, id, next) }, now)
}

export function addWeightPoint(
  run: GenerationalRunState,
  input: { date: string; value: number },
  now: string,
  id = runId('weight'),
): GenerationalRunState {
  if (!Number.isFinite(input.value) || !input.date) return run
  return patchHealth(run, {
    weightPoints: [...run.healthPlan.weightPoints, { id, date: input.date, unit: 'kg', value: input.value }],
  }, now)
}

export function patchRequirement(run: GenerationalRunState, id: string, active: boolean, note: string, now: string): GenerationalRunState {
  return touch({
    ...run,
    lifeRequirements: run.lifeRequirements.map(item => item.id === id ? { ...item, active, note } : item),
  }, now)
}

export function taskKindLabel(kind: TaskKind): string {
  switch (kind) {
    case 'revenue': return 'Umsatz'
    case 'support': return 'Unterstützung'
    case 'anchor': return 'Anker'
    case 'appointment': return 'Termin'
    case 'prescribed': return 'Einnahme'
    default: {
      const exhaustive: never = kind
      return exhaustive
    }
  }
}

export function portfolioStatusLabel(status: PortfolioStatus): string {
  switch (status) {
    case 'idea': return 'Idee'
    case 'ready': return 'Bereit'
    case 'active': return 'Aktiv'
    case 'paused': return 'Pausiert'
    case 'done': return 'Abgeschlossen'
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

export function goalStatusLabel(status: GoalStatus): string {
  switch (status) {
    case 'draft': return 'Entwurf'
    case 'active': return 'Aktiv'
    case 'paused': return 'Pausiert'
    case 'done': return 'Erledigt'
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

export function reviewDecisionLabel(decision: ReviewDecision): string {
  switch (decision) {
    case 'continue': return 'Weiterführen'
    case 'change': return 'Ändern'
    case 'pause': return 'Pausieren'
    default: {
      const exhaustive: never = decision
      return exhaustive
    }
  }
}

export function preferenceKindLabel(kind: PreferenceKind): string {
  switch (kind) {
    case 'fact': return 'Fakt'
    case 'preference': return 'Präferenz'
    case 'hypothesis': return 'Hypothese'
    default: {
      const exhaustive: never = kind
      return exhaustive
    }
  }
}

export function delegationStatusLabel(status: DelegationStatus): string {
  switch (status) {
    case 'draft': return 'Entwurf'
    case 'active': return 'Aktiv'
    case 'blocked': return 'Rückfrage'
    case 'done': return 'Fertig'
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

export function reelStatusLabel(status: ReelStatus): string {
  switch (status) {
    case 'import': return 'Import'
    case 'transcript': return 'Transkript blockiert'
    case 'review': return 'Prüfung'
    case 'released': return 'Freigegeben'
    case 'error': return 'Fehler'
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

export function assetAccessLabel(access: AssetAccess): string {
  switch (access) {
    case 'unknown': return 'Unbekannt'
    case 'owned': return 'Zugang da'
    case 'shared': return 'Geteilt'
    case 'none': return 'Kein Zugang'
    default: {
      const exhaustive: never = access
      return exhaustive
    }
  }
}
