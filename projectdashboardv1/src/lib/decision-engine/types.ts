/** JEV Decision Layer — structured decisions only. Never writes LifeOS state. */

export const LIFEOS_INPUT_SOURCES = [
  'quick_add',
  'voice',
  'note',
  'meal',
  'shopping',
  'radar',
  'email',
  'calendar',
  'system',
] as const

export type LifeOSInputSource = (typeof LIFEOS_INPUT_SOURCES)[number]

export type LifeOSInput = {
  id: string
  source: LifeOSInputSource
  content: string
  timestamp: string
  context?: LifeOSInputContext
  audioRef?: string
  transcriptId?: string
}

export type LifeOSInputContext = {
  currentModule?: string
  projectId?: string
  routineId?: string
  metadata?: Record<string, unknown>
}

export const DECISION_DOMAINS = [
  'TASK',
  'NOTE',
  'NUTRITION',
  'SHOPPING',
  'PROJECT',
  'CALENDAR',
  'ROUTINE',
  'KNOWLEDGE',
  'FINANCE',
  'WORK',
  'PERSONAL',
  'RADAR',
  'HEALTH',
  'SYSTEM',
  'UNKNOWN',
] as const

export type DecisionDomain = (typeof DECISION_DOMAINS)[number]

export const DECISION_INTENTS = [
  'CREATE_TASK',
  'CREATE_NOTE',
  'LOG_MEAL',
  'ADD_SHOPPING_ITEM',
  'CLASSIFY',
  'ROUTE',
  'TAG',
  'PRIORITIZE',
  'COMPLETE_ROUTINE',
  'REQUEST_INFORMATION',
  'REVIEW',
  'UNKNOWN',
  'DELETE',
  'UPDATE_CALENDAR',
  'SEND_MESSAGE',
  'PURCHASE',
  'FILTER_RADAR',
] as const

export type DecisionIntent = (typeof DECISION_INTENTS)[number]

export const ACTION_LEVELS = ['SAFE_AUTO', 'REVERSIBLE_AUTO', 'CONFIRM'] as const
export type ActionLevel = (typeof ACTION_LEVELS)[number]

export const POLICY_RESULTS = ['EXECUTE', 'REQUEST_INFORMATION', 'REVIEW', 'REJECT'] as const
export type PolicyResult = (typeof POLICY_RESULTS)[number]

export const DECISION_PROVIDERS = ['rules', 'jev', 'llm', 'fallback'] as const
export type DecisionProvider = (typeof DECISION_PROVIDERS)[number]

export const CONFIDENCE_BANDS = ['high', 'medium', 'low'] as const
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number]

export const REASON_CODES = [
  'OK',
  'EMPTY_INPUT',
  'INVALID_INPUT',
  'LOW_CONFIDENCE',
  'UNKNOWN_INTENT',
  'MISSING_ENTITY',
  'AMBIGUOUS_ENTITY',
  'MEAL_NOT_FOUND',
  'PROJECT_NOT_FOUND',
  'HEDGE_LANGUAGE',
  'JEV_DISABLED',
  'JEV_UNAVAILABLE',
  'JEV_TIMEOUT',
  'JEV_INVALID',
  'LLM_UNAVAILABLE',
  'POLICY_BLOCKED',
  'AUTO_ACTIONS_DISABLED',
  'LEVEL_CONFIRM',
  'IDEMPOTENT_REPLAY',
  'SCHEMA_MISMATCH',
  'RATE_LIMIT',
  'NETWORK_ERROR',
] as const

export type ReasonCode = (typeof REASON_CODES)[number]

export const LIFEOS_EVENT_TYPES = [
  'TASK_CREATED',
  'TASK_OVERDUE',
  'MEAL_LOGGED',
  'ROUTINE_MISSED',
  'WEIGHT_LOGGED',
  'RADAR_MATCH',
  'PRICE_DROP',
  'CALENDAR_CHANGED',
  'PROJECT_STALLED',
  'PURCHASE_DETECTED',
  'CAPTURE_CREATED',
  'NOTE_CREATED',
] as const

export type LifeOSEventType = (typeof LIFEOS_EVENT_TYPES)[number]

export type DecisionEntities = {
  product?: string
  mealId?: string
  mealLabel?: string
  quantity?: string
  due?: string
  priority?: 'p1' | 'p2' | 'p3' | 'p4'
  projectId?: string
  projectLabel?: string
  title?: string
  body?: string
  tags?: string[]
  domainHint?: DecisionDomain
  relatedProject?: string
  transcriptReference?: string
  listName?: string
}

export type NormalizedItem = {
  index: number
  content: string
  original: string
}

export type Decision = {
  decisionId: string
  inputId: string
  itemIndex: number
  content: string
  domain: DecisionDomain
  intent: DecisionIntent
  confidence: number
  confidenceBand: ConfidenceBand
  entities: DecisionEntities
  suggestedAction: DecisionIntent
  actionLevel: ActionLevel
  provider: DecisionProvider
  requiresConfirmation: boolean
  reasonCode: ReasonCode
  timestamp: string
  policyResult: PolicyResult
  policyReasons: ReasonCode[]
}

export type ProposedAction = {
  actionId: string
  decisionId: string
  intent: DecisionIntent
  domain: DecisionDomain
  actionLevel: ActionLevel
  policyResult: PolicyResult
  content: string
  entities: DecisionEntities
  requiresConfirmation: boolean
  reversible: boolean
  undoHint?: string
}

export type DecisionBatch = {
  batchId: string
  input: LifeOSInput
  items: NormalizedItem[]
  decisions: Decision[]
  proposedActions: ProposedAction[]
  audits: DecisionAudit[]
  latencyMs: number
  provider: DecisionProvider
  error?: string
}

export type DecisionAudit = {
  decisionId: string
  inputId: string
  source: LifeOSInputSource
  contentPreview: string
  provider: DecisionProvider
  domain: DecisionDomain
  intent: DecisionIntent
  confidence: number
  policyResult: PolicyResult
  proposedAction: DecisionIntent
  executedAction?: DecisionIntent
  timestamp: string
  error?: string
  undoReference?: string
  latencyMs?: number
}

export type RoutineMealRef = {
  id: string
  label: string
  aliases?: string[]
  proteinGrams: number
  calories: number
  fatGrams: number
  carbsGrams: number
  fiberGrams: number
}

export type ProjectRef = {
  id: string
  label: string
  aliases?: string[]
}

export type DecisionContext = {
  now?: Date
  timeZone?: string
  routineMeals?: RoutineMealRef[]
  projects?: ProjectRef[]
  openTaskTitles?: string[]
  currentModule?: string
  allowCreateProject?: boolean
}

export type ProviderDecision = {
  content: string
  domain: DecisionDomain
  intent: DecisionIntent
  confidence: number
  entities?: DecisionEntities
  suggestedAction?: DecisionIntent
  reasonCode?: ReasonCode
}

export type DecisionProviderAdapter = {
  id: DecisionProvider
  decide(input: {
    item: NormalizedItem
    input: LifeOSInput
    context: DecisionContext
  }): Promise<ProviderDecision | null>
}

export type TranscriptionStatus = 'pending' | 'ready' | 'failed' | 'skipped'
export type VoiceProcessingStatus = 'idle' | 'transcribing' | 'normalizing' | 'deciding' | 'preview' | 'done' | 'failed'

export type VoiceMemo = {
  id: string
  audioRef: string
  durationSec?: number
  createdAt: string
  transcript?: string
  transcriptionStatus: TranscriptionStatus
  processingStatus: VoiceProcessingStatus
  derivedItems: DerivedItem[]
  title?: string
}

export type DerivedItemStatus = 'proposed' | 'accepted' | 'edited' | 'discarded' | 'executed' | 'failed'

export type DerivedItem = {
  id: string
  voiceMemoId: string
  originalSegment: string
  normalizedContent: string
  decision?: Decision
  proposedAction?: ProposedAction
  executionStatus: DerivedItemStatus
}

export type TranscriptionProvider = {
  id: string
  transcribe(input: { audioRef: string; mimeType?: string }): Promise<{ transcript: string }>
}
