/** Generational Run workspace. Unknown numbers stay null. */

export const RUN_PROJECT_ID = 'generational-run'
export const DEFAULT_EXPERIMENT_LIMIT = 2
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024
export const RUN_EPOCH = '1970-01-01T00:00:00.000Z'

export type EnergyMode = 'normal' | 'low'
export type DayCapacity = 'small' | 'normal' | 'wide'
export type TaskEnergy = 'low' | 'okay' | 'high'
export type TaskStatus = 'ready' | 'active' | 'paused' | 'blocked' | 'done'
export type TaskKind = 'revenue' | 'support' | 'anchor' | 'appointment' | 'prescribed'
export type PortfolioStatus = 'idea' | 'ready' | 'active' | 'paused' | 'done'
export type PortfolioKind = 'workspace' | 'revenue' | 'other'
export type ExperimentStatus = 'idea' | 'active' | 'paused' | 'done'
export type GoalLevel = 'big' | 'mid' | 'task'
export type GoalStatus = 'draft' | 'active' | 'paused' | 'done'
export type AssetAccess = 'unknown' | 'owned' | 'shared' | 'none'
export type InboxKind = 'text' | 'link' | 'idea' | 'task'
export type ReviewDecision = 'continue' | 'change' | 'pause'
export type PreferenceKind = 'fact' | 'preference' | 'hypothesis'
export type ReelStatus = 'import' | 'transcript' | 'review' | 'released' | 'error'
export type SourceKind = 'note' | 'transcript' | 'external'
export type DelegationStatus = 'draft' | 'active' | 'blocked' | 'done'

export type RunTask = {
  id: string
  title: string
  nextStep: string
  minutes: number
  energy: TaskEnergy
  result: string
  due?: string
  status: TaskStatus
  kind: TaskKind
  protected: boolean
  fallbackTaskId?: string
  blockedNote?: string
  goalId?: string
  createdAt: string
  updatedAt: string
}

export type InboxItem = {
  id: string
  text: string
  url?: string
  kind: InboxKind
  createdAt: string
}

export type PortfolioItem = {
  id: string
  name: string
  status: PortfolioStatus
  kind: PortfolioKind
  nextAction: string
  confirmed: boolean
  note: string
}

export type Experiment = {
  id: string
  offer: string
  buyers: string
  hypothesis: string
  budgetLimit: number | null
  timeBudgetMin: number | null
  durationDays: number | null
  success: string
  abort: string
  metricsNote: string
  nextAction: string
  status: ExperimentStatus
  basis: string
  uncertainty: string
  updatedAt: string
}

export type GoalNode = {
  id: string
  level: GoalLevel
  parentId?: string
  title: string
  result: string
  status: GoalStatus
  due?: string
  updatedAt: string
}

export type AssetRecord = {
  id: string
  name: string
  url: string | null
  platform: string | null
  audience: string | null
  access: AssetAccess
  lastActivity: string | null
  contentRights: string | null
  metricValue: number | null
  metricDate: string | null
  metricSource: string | null
  revenue: number | null
  products: string | null
  confirmed: boolean
  note: string
  updatedAt: string
}

export type WeekReview = {
  id: string
  periodStart: string
  periodEnd: string
  summary: string
  decision?: ReviewDecision
  note: string
  updatedAt: string
}

export type FinanceState = {
  revenue: number | null
  paidIn: number | null
  variableCosts: number | null
  fixedCosts: number | null
  receivables: number | null
  capital: number | null
  returnsAmount: number | null
  shipping: number | null
  purchaseCosts: number | null
  platformFees: number | null
  assumptions: string
}

export type DelegationItem = {
  id: string
  task: string
  owner: string
  input: string
  example: string
  output: string
  doneWhen: string
  budget: string
  due: string
  status: DelegationStatus
  questions: string
  updatedAt: string
}

export type PreferenceItem = {
  id: string
  kind: PreferenceKind
  text: string
  source: string
  at: string
  enabled: boolean
}

export type ReelCandidate = {
  id: string
  text: string
  category: string
  sourceKind: SourceKind
  timestamp?: string
}

export type ReelJob = {
  id: string
  fileName: string
  status: ReelStatus
  error?: string
  transcript: string | null
  transcriptBlocked: boolean
  candidates: ReelCandidate[]
  knowledgeId?: string
  updatedAt: string
}

export type LifeRequirement = {
  id: string
  label: string
  active: boolean
  note: string
}

export type WeightPoint = {
  id: string
  date: string
  unit: 'kg'
  value: number
}

export type SupplementDraft = {
  id: string
  product: string
  amount: string
  stock: string
}

export type MealDraft = {
  id: string
  name: string
  note: string
}

export type ShoppingItem = {
  id: string
  text: string
}

export type VisitDraft = {
  id: string
  title: string
  date: string
  documents: string
  followUp: string
}

export type HealthPlan = {
  movementSessionsPerWeek: number
  movementNote: string
  calorieTarget: number | null
  proteinTarget: number | null
  sleepStart: string | null
  sleepEnd: string | null
  sleepRecovery: string | null
  weightPoints: WeightPoint[]
  skincareNote: string
  whiteningOptional: boolean
  supplements: SupplementDraft[]
  meals: MealDraft[]
  shopping: ShoppingItem[]
  mealPrepNote: string
  bulkNote: string
  hairNote: string
  teethNote: string
  careNextAction: string
  careAppointment: string
  careCostNote: string
  visits: VisitDraft[]
  prescriptionNote: string
}

export type RunSession = {
  taskId: string
  phase: 'running' | 'paused'
}

export type GenerationalRunState = {
  version: 1
  projectId: string
  initialized: boolean
  updatedAt: string
  draftsSeeded: boolean
  energyMode: EnergyMode
  capacity: DayCapacity
  experimentLimit: number
  capacityNote: string
  captureDraft: string
  tasks: RunTask[]
  inbox: InboxItem[]
  portfolio: PortfolioItem[]
  experiments: Experiment[]
  goals: GoalNode[]
  assets: AssetRecord[]
  reviews: WeekReview[]
  finance: FinanceState
  delegations: DelegationItem[]
  preferences: PreferenceItem[]
  reels: ReelJob[]
  lifeRequirements: LifeRequirement[]
  healthPlan: HealthPlan
  session: RunSession | null
}

export type ReleasedKnowledge = {
  id: string
  title: string
  content: string
  summary: string
  source: string
  topics: string[]
  tags: string[]
}
