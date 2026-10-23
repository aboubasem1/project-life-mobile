export type ReelStatus =
  | 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'CLASSIFIED' | 'FACT_CHECK_PENDING'
  | 'REVIEW_READY' | 'USER_REVIEWED' | 'APPROVED_CANDIDATE' | 'REJECTED'
  | 'SOURCE_ONLY' | 'MORE_EVIDENCE' | 'FAILED' | 'DUPLICATE' | 'SUPERSEDED' | 'PUBLISHED'

export type ReelClaim = {
  id: string
  position: number
  text: string
  type: string
  verificationStatus: 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'CONTRADICTED' | 'UNVERIFIED' | 'REVIEW_REQUIRED'
  confidence: number
  evidence: Array<{ title: string; url: string; publisher?: string; publishedAt?: string }>
  note: string
}

export type ReelCandidate = {
  id: string
  objectId: string
  checksumSha256: string | null
  status: ReelStatus
  title: string
  summary: string
  transcript: string
  transcriptProvider: string | null
  transcriptModel: string | null
  onScreenText: string
  lifeArea: string
  topics: string[]
  usefulnessScore: number | null
  riskLevel: 'low' | 'medium' | 'high'
  suggestedTarget: 'knowledge' | 'guideline' | 'source_only' | 'reject' | null
  jev: { available?: boolean; confidence?: number; relevance?: string; failure?: string } | null
  reviewerNote: string
  processingAttempts: number
  errorMessage: string | null
  version: number
  originalName?: string
  contentType?: string
  sizeBytes?: number
  claims: ReelClaim[]
  createdAt: string
  updatedAt: string
  knowledgeItemId?: string | null
  publishedAt?: string | null
  jobStatus?: 'queued' | 'running' | 'retry' | 'succeeded' | 'dead' | null
  jobAttempts?: number
  jobLastError?: string | null
  jobRunAfter?: string | null
  backgroundProcessing?: boolean
}

export type KnowledgePublishDraft = {
  id: string
  reelId: string
  title: string
  content: string
  summary: string
  source: string
  type: 'video'
  topics: string[]
  tags: string[]
  lifeArea: string
  createdAt: string
  updatedAt: string
  evidenceLabel: 'verified' | 'mixed' | 'unverified' | 'source_only'
  riskLevel: 'low' | 'medium' | 'high'
}

export type ReelReviewAction = 'approve_candidate' | 'reject' | 'source_only' | 'more_evidence' | 'reviewed'
