/** Life OS domain types — local-first, additive, no parallel project/goal systems. */

import type { AreaIntention, LifeAreaKey } from './areas.js'

export const LIFE_OS_STORE_VERSION = 2
export const LIFE_OS_KEY = 'life-os-v1-life'

export type CaptureTargetType =
  | 'inbox'
  | 'task'
  | 'note'
  | 'knowledge'
  | 'goal'
  | 'event'
  | 'decision'
  | 'reference'

export type CaptureStatus = 'inbox' | 'classified' | 'converted' | 'archived'

export type CaptureDecisionPreviewItem = {
  actionId: string
  content: string
  domain: string
  intent: string
  confidence: number
  actionLevel: string
  policyResult: string
  suggestedAction: string
  requiresConfirmation: boolean
  due?: string
  mealLabel?: string
  projectLabel?: string
}

export type CaptureDecisionPreview = {
  batchId: string
  provider: string
  items: CaptureDecisionPreviewItem[]
  processedAt: string
}

export type Capture = {
  id: string
  raw: string
  title: string
  body: string
  url?: string
  fileName?: string
  fileKind?: 'file' | 'screenshot'
  fileDataUrl?: string
  fileObjectId?: string
  fileStorageKey?: string
  fileContentType?: string
  fileSize?: number
  targetType: CaptureTargetType
  status: CaptureStatus
  projectId?: string
  goalId?: string
  lifeArea?: LifeAreaKey
  needKeys?: string[]
  converted?: { kind: EntityKind; id: string }
  source?: string
  audioRef?: string
  transcriptId?: string
  decisionPreview?: CaptureDecisionPreview
  createdAt: string
  updatedAt: string
}

export type KnowledgeType =
  | 'thought'
  | 'article'
  | 'webpage'
  | 'video'
  | 'document'
  | 'book'
  | 'research'
  | 'import'

export type KnowledgeItem = {
  id: string
  title: string
  content: string
  summary: string
  source: string
  sourceUrl?: string
  type: KnowledgeType
  topics: string[]
  tags: string[]
  lifeArea?: LifeAreaKey
  needKeys?: string[]
  createdAt: string
  updatedAt: string
}

export type DecisionStatus = 'active' | 'review_due' | 'reviewed' | 'superseded'

export type Decision = {
  id: string
  title: string
  decision: string
  context: string
  reasoning: string
  alternatives: string
  expectedOutcome: string
  projectId?: string
  goalId?: string
  decidedAt: string
  reviewAt?: string
  actualOutcome?: string
  rating?: number
  status: DecisionStatus
  lifeArea?: LifeAreaKey
  needKeys?: string[]
  createdAt: string
  updatedAt: string
}

export type Signal = {
  id: string
  type: string
  value: number
  unit: string
  timestamp: string
  source: string
  sourceId?: string
  metadata?: Record<string, string>
  lifeArea?: LifeAreaKey
  createdAt: string
}

export type ReviewType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export type ReviewAggregates = {
  completedTasks: number
  openTasks: number
  projectProgress: Array<{ id: string; name: string; percent: number }>
  goals: Array<{ id: string; title: string; percent: number }>
  captures: number
  knowledge: number
  decisions: number
  decisionReviewsDue: number
  signals: Array<{ type: string; count: number; lastValue?: number; unit?: string }>
  focusMinutes: number
  plannedMinutes: number
  actualMinutes: number
  lifeAreas?: {
    coverage: number
    reliable: boolean
    hasTimeData: boolean
    slices: Array<{ key: LifeAreaKey | 'unclassified'; actualMinutes: number; plannedMinutes: number; completedTasks: number }>
  }
}

export type Review = {
  id: string
  type: ReviewType
  periodStart: string
  periodEnd: string
  aggregates: ReviewAggregates
  whatWentWell: string
  whatWentWrong: string
  whatILearned: string
  whatToChange: string
  nextPriorities: string
  notes: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type InsightSource = 'deterministic' | 'interpretation'

export type InsightEvidence = { label: string; value: string }

export type Insight = {
  id: string
  type: string
  title: string
  message: string
  period: string
  evidence: InsightEvidence[]
  confidence: number
  suggestedAction?: string
  source: InsightSource
  createdAt: string
}

export type EntityKind =
  | 'capture'
  | 'task'
  | 'project'
  | 'goal'
  | 'note'
  | 'knowledge'
  | 'decision'
  | 'signal'
  | 'review'
  | 'activity'

export type Relation = {
  id: string
  fromKind: EntityKind
  fromId: string
  toKind: EntityKind
  toId: string
  role?: string
  createdAt: string
}

export type ActivityKind = 'task' | 'project' | 'training' | 'focus' | 'custom'

export type ActivitySource = 'user' | 'timer' | 'tracking' | 'connector'

export type ActivityRecord = {
  id: string
  kind: ActivityKind
  title: string
  projectId?: string
  goalId?: string
  plannedDurationMin?: number
  actualDurationMin?: number
  source: ActivitySource
  date: string
  lifeArea?: LifeAreaKey
  needKeys?: string[]
  createdAt: string
  updatedAt: string
}

export type DomainEventType =
  | 'capture.created'
  | 'task.created'
  | 'task.completed'
  | 'project.created'
  | 'project.updated'
  | 'goal.updated'
  | 'knowledge.created'
  | 'decision.created'
  | 'decision.review_due'
  | 'signal.recorded'
  | 'review.completed'
  | 'life_area.assigned'
  | 'life_area.changed'

export type DomainEvent = {
  id: string
  type: DomainEventType
  entityKind?: EntityKind
  entityId?: string
  payload: Record<string, string>
  createdAt: string
}

export type ConnectorCapability = 'read' | 'write' | 'events' | 'actions' | 'sync'
export type ConnectorAuth = 'oauth2' | 'api_key' | 'webhook' | 'none'
export type ConnectorStatus = 'disconnected' | 'connected' | 'error'

export type ConnectorDefinition = {
  id: string
  provider: string
  version: string
  authentication: ConnectorAuth
  capabilities: ConnectorCapability[]
  description: string
}

export type ConnectorInstance = {
  id: string
  connectorId: string
  status: ConnectorStatus
  configuration: Record<string, string>
  lastSyncAt?: string
  lastError?: string
  createdAt: string
  updatedAt: string
}

export type OutboundWebhook = {
  id: string
  url: string
  secretCipher?: string
  events: DomainEventType[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type WebhookLog = {
  id: string
  direction: 'inbound' | 'outbound'
  connectorId: string
  status: number
  message: string
  idempotencyKey?: string
  createdAt: string
}

export type NormalizedObject =
  | { kind: 'capture'; data: Partial<Capture> & { raw: string } }
  | { kind: 'signal'; data: Partial<Signal> & { type: string; value: number } }
  | { kind: 'activity'; data: Partial<ActivityRecord> & { title: string; date: string } }
  | { kind: 'knowledge'; data: Partial<KnowledgeItem> & { title: string } }

export type LifeOsState = {
  version: number
  captures: Capture[]
  knowledge: KnowledgeItem[]
  decisions: Decision[]
  signals: Signal[]
  reviews: Review[]
  insights: Insight[]
  relations: Relation[]
  activities: ActivityRecord[]
  events: DomainEvent[]
  connectors: ConnectorInstance[]
  outboundWebhooks: OutboundWebhook[]
  webhookLogs: WebhookLog[]
  areaIntentions: Partial<Record<LifeAreaKey, AreaIntention>>
}

export type ProjectLike = {
  id: string
  label: string
  description?: string
  outcome?: string
  status?: 'active' | 'paused' | 'done' | 'archived'
  priority?: 'p1' | 'p2' | 'p3' | 'p4'
  startDate?: string
  targetDate?: string
  nextAction?: string
  nextActionTaskId?: string
  milestones?: Array<{ id: string; title: string; done: boolean; due?: string }>
  goalId?: string
  lastActivityAt?: string
  lifeArea?: LifeAreaKey
  needKeys?: string[]
  tasks: Array<{
    id: string
    title: string
    done: boolean
    plannedMinutes?: number
    actualMinutes?: number
    lifeArea?: LifeAreaKey
    needKeys?: string[]
  }>
}

export type GoalLike = {
  id: string
  title: string
  timeframe: 'Jahr' | 'Quartal' | 'Monat' | 'Woche'
  percent: number
  dueDate: string
  description?: string
  outcome?: string
  metric?: string
  target?: number
  current?: number
  unit?: string
  status?: 'active' | 'paused' | 'done' | 'dropped'
  checkIns?: Array<{ id: string; at: string; note: string; value?: number }>
  lifeArea?: LifeAreaKey
  needKeys?: string[]
}

export const CAPTURE_TARGET_LABELS: Record<CaptureTargetType, string> = {
  inbox: 'Inbox',
  task: 'Aufgabe',
  note: 'Notiz',
  knowledge: 'Wissen',
  goal: 'Ziel',
  event: 'Termin',
  decision: 'Entscheidung',
  reference: 'Referenz',
}

export const KNOWLEDGE_TYPE_LABELS: Record<KnowledgeType, string> = {
  thought: 'Gedanke',
  article: 'Artikel',
  webpage: 'Webseite',
  video: 'Video',
  document: 'Dokument',
  book: 'Buch',
  research: 'Research',
  import: 'Import',
}

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  active: 'Aktiv',
  review_due: 'Review fällig',
  reviewed: 'Reviewed',
  superseded: 'Ersetzt',
}

export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Quartal',
  yearly: 'Jährlich',
}

export const SIGNAL_TYPE_PRESETS: Array<{ type: string; unit: string; label: string }> = [
  { type: 'weight', unit: 'kg', label: 'Gewicht' },
  { type: 'sleep_duration', unit: 'h', label: 'Schlafdauer' },
  { type: 'sleep_quality', unit: '/10', label: 'Schlafqualität' },
  { type: 'steps', unit: 'steps', label: 'Schritte' },
  { type: 'training', unit: 'min', label: 'Training' },
  { type: 'focus_time', unit: 'min', label: 'Fokus' },
  { type: 'screen_time', unit: 'min', label: 'Bildschirmzeit' },
  { type: 'energy', unit: '/10', label: 'Energie' },
  { type: 'mood', unit: '/10', label: 'Stimmung' },
  { type: 'spending', unit: '€', label: 'Ausgaben' },
  { type: 'activity', unit: 'min', label: 'Aktivität' },
]
