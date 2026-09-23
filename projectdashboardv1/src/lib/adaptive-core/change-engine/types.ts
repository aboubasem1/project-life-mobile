import type { ChangeOp, ChangeType, RiskLevel } from '../types.js'

export type ChangeOperation = {
  op: ChangeOp
  path: string
  value?: unknown
  /** For move: zero-based from/to indices when path points to an ordered list. */
  from?: number
  to?: number
  /** For insert/remove on arrays of ids. */
  item?: string
}

export type ChangeSpec = {
  id: string
  type: ChangeType
  target: string
  operations: ChangeOperation[]
  reason: string
  risk: RiskLevel
  request?: string
  affectedEntities?: string[]
  createdAt: string
}

export type ChangeStatus =
  | 'proposed'
  | 'validated'
  | 'previewed'
  | 'approved'
  | 'applied'
  | 'failed'
  | 'reverted'
  | 'rejected'

export type ChangeHistoryRecord = {
  id: string
  timestamp: string
  request: string
  interpretation: string
  changeSpec: ChangeSpec
  affectedEntities: string[]
  beforeState: unknown
  afterState: unknown
  risk: RiskLevel
  initiator: 'user' | 'jo' | 'adaptation' | 'experiment' | 'system'
  approval: 'pending' | 'approved' | 'rejected' | 'auto'
  status: ChangeStatus
  revertedAt?: string
  experimentId?: string
  error?: string
}

export type ChangePreview = {
  title: string
  summaryLines: string[]
  risk: RiskLevel
  changeSpec: ChangeSpec
  reversible: boolean
}

export type MutableLifeSettings = {
  morningRitual?: {
    stepOrder?: string[]
    hiddenSteps?: string[]
    [key: string]: unknown
  }
  eveningGate?: {
    hiddenChecks?: string[]
    enabled?: boolean
    [key: string]: unknown
  }
  adaptive?: unknown
  [key: string]: unknown
}

export type ApplyResult = {
  ok: boolean
  settings: MutableLifeSettings
  history: ChangeHistoryRecord
  error?: string
}
