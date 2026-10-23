import { SyncHttpError } from './sync-core.js'

export const REEL_LIFE_AREAS = ['work', 'health', 'growth', 'creativity', 'relationships', 'life'] as const
export const REEL_STALE_LOCK_MS = 25 * 60 * 1000
export const REEL_MAX_ATTEMPTS = 4
export const REEL_DAILY_JOB_LIMIT = 400

const RETRY_DELAYS_MS = [20_000, 60_000, 180_000, 600_000]

const TERMINAL_STATUSES = new Set([
  'REVIEW_READY', 'USER_REVIEWED', 'APPROVED_CANDIDATE', 'PUBLISHED',
  'REJECTED', 'SOURCE_ONLY', 'DUPLICATE', 'SUPERSEDED',
])

const REVIEWABLE_STATUSES = new Set([
  'REVIEW_READY', 'USER_REVIEWED', 'MORE_EVIDENCE', 'APPROVED_CANDIDATE',
  'SOURCE_ONLY', 'REJECTED', 'PUBLISHED',
])

export type JobView = {
  status: 'queued' | 'running' | 'retry' | 'succeeded' | 'dead'
  runAfterMs: number
  lockedAtMs: number | null
}

export type PipelineSnapshot = {
  status: string
  transcript: string
  onScreenText: string
  title: string
  claimsSaved: boolean
}

export type PipelineStage = 'done' | 'extract' | 'analyze' | 'verify' | 'finish'

export type FailureDisposition = 'permanent' | 'retry' | 'lost_lock'

export type ReelGateInput = {
  status: string
  riskLevel: 'low' | 'medium' | 'high'
  suggestedTarget: string | null
  claims: Array<{ text?: string; verificationStatus: string }>
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

const CLAIM_LABELS: Record<string, string> = {
  SUPPORTED: 'belegt',
  PARTIALLY_SUPPORTED: 'teilweise belegt',
  CONTRADICTED: 'widersprochen',
  UNVERIFIED: 'unbelegt',
  REVIEW_REQUIRED: 'nicht geprüft',
}

export function isClaimable(job: JobView, nowMs: number, staleMs = REEL_STALE_LOCK_MS): boolean {
  if ((job.status === 'queued' || job.status === 'retry') && job.runAfterMs <= nowMs) return true
  if (job.status === 'running' && job.lockedAtMs != null && nowMs - job.lockedAtMs >= staleMs) return true
  return false
}

export function retryDelayMs(attempts: number): number {
  const index = Math.max(0, Math.min(RETRY_DELAYS_MS.length - 1, attempts - 1))
  return RETRY_DELAYS_MS[index]
}

export function processingFailureDisposition(error: unknown): FailureDisposition {
  if (error instanceof SyncHttpError && error.status === 409 && /anderen Worker/i.test(error.message)) return 'lost_lock'
  if (error instanceof SyncHttpError && [400, 404, 413, 422].includes(error.status)) return 'permanent'
  return 'retry'
}

export function pipelineStage(snapshot: PipelineSnapshot): PipelineStage {
  if (TERMINAL_STATUSES.has(snapshot.status)) return 'done'
  const hasText = Boolean(snapshot.transcript.trim() || snapshot.onScreenText.trim())
  if (!hasText) return 'extract'
  if (!snapshot.title.trim()) return 'analyze'
  if (!snapshot.claimsSaved || snapshot.status === 'MORE_EVIDENCE') return 'verify'
  return 'finish'
}

export function normalizeLifeAreas(value: unknown): string[] {
  const allowed = new Set<string>(REEL_LIFE_AREAS)
  if (!Array.isArray(value)) return [...REEL_LIFE_AREAS]
  const areas = [...new Set(value.map(item => (typeof item === 'string' ? item.trim() : '')).filter(area => allowed.has(area)))]
  return areas.length > 0 ? areas : [...REEL_LIFE_AREAS]
}

function unsupportedClaims(reel: ReelGateInput): number {
  return reel.claims.filter(claim => claim.verificationStatus !== 'SUPPORTED').length
}

export function bulkItemDecision(
  reel: ReelGateInput,
  action: 'approve_publish' | 'reject' | 'source_only',
  includeMediumRisk: boolean,
): { ok: true } | { ok: false; reason: string } {
  if (!REVIEWABLE_STATUSES.has(reel.status) && reel.status !== 'PUBLISHED') {
    return { ok: false, reason: 'Noch nicht bereit zur Prüfung.' }
  }
  if (action === 'reject' || action === 'source_only') return { ok: true }
  if (reel.riskLevel === 'high') return { ok: false, reason: 'Hohes Risiko braucht eine einzelne Prüfung.' }
  if (reel.riskLevel === 'medium' && !includeMediumRisk) return { ok: false, reason: 'Mittleres Risiko ist in dieser Runde nicht enthalten.' }
  const target = reel.suggestedTarget
  if (target !== 'knowledge' && target !== 'guideline') {
    return { ok: false, reason: 'Nur Knowledge- oder Leitlinien-Vorschläge können übernommen werden.' }
  }
  if (target === 'guideline' && unsupportedClaims(reel) > 0) {
    return { ok: false, reason: 'Leitlinien brauchen für jede Aussage einen belegten Status.' }
  }
  return { ok: true }
}

export function publishBlockReason(reel: ReelGateInput, mode: 'knowledge' | 'source_only', allowReady = false): string | null {
  if (reel.status === 'PUBLISHED') return null
  if (mode === 'source_only') {
    if (!['SOURCE_ONLY', 'REVIEW_READY', 'USER_REVIEWED', 'MORE_EVIDENCE', 'APPROVED_CANDIDATE', 'REJECTED'].includes(reel.status)) {
      return 'Diese Quelle kann noch nicht übernommen werden.'
    }
    return null
  }
  const ready = allowReady && ['REVIEW_READY', 'USER_REVIEWED', 'MORE_EVIDENCE', 'APPROVED_CANDIDATE'].includes(reel.status)
  if (reel.status !== 'APPROVED_CANDIDATE' && !ready) {
    return 'Zuerst freigeben, danach in Knowledge übernehmen.'
  }
  if (reel.suggestedTarget !== 'knowledge' && reel.suggestedTarget !== 'guideline') {
    return 'Für die Übernahme muss Knowledge oder Leitlinie gewählt sein.'
  }
  if ((reel.suggestedTarget === 'guideline' || reel.riskLevel === 'high') && unsupportedClaims(reel) > 0) {
    return 'Leitlinien und Hochrisiko-Inhalte brauchen für jede Aussage einen belegten Status.'
  }
  return null
}

function evidenceLabel(reel: ReelGateInput, sourceOnly: boolean): KnowledgePublishDraft['evidenceLabel'] {
  if (sourceOnly) return 'source_only'
  if (reel.claims.length === 0) return 'unverified'
  if (reel.claims.every(claim => claim.verificationStatus === 'SUPPORTED')) return 'verified'
  if (reel.claims.some(claim => claim.verificationStatus === 'SUPPORTED' || claim.verificationStatus === 'PARTIALLY_SUPPORTED')) return 'mixed'
  return 'unverified'
}

export function buildKnowledgeDraft(input: {
  reel: ReelGateInput & {
    id: string
    title: string
    summary: string
    topics: string[]
    lifeArea: string | null
    originalName?: string
    createdAt: string
  }
  knowledgeItemId: string
  publishedAt: string
  sourceOnly: boolean
}): KnowledgePublishDraft {
  const { reel, knowledgeItemId, publishedAt, sourceOnly } = input
  const label = evidenceLabel(reel, sourceOnly)
  const title = reel.title.trim() || reel.originalName?.trim() || 'Reel'
  const claimLines = reel.claims.slice(0, 12).map(claim => {
    const mark = CLAIM_LABELS[claim.verificationStatus] || 'nicht geprüft'
    const text = claim.text?.trim() || ''
    return text ? `- (${mark}) ${text}` : ''
  }).filter(Boolean)
  const caution = sourceOnly
    ? 'Nur eine Quelle. Die Aussagen sind keine geprüfte Leitlinie.'
    : reel.riskLevel === 'high'
      ? 'Hohes Risiko: gespeichert mit Belegstatus, nicht als Handlungsanweisung.'
      : label === 'verified'
        ? 'Aussagen sind mit Quellen belegt. Das ersetzt keine eigene Prüfung.'
        : 'Unbelegte oder nur teilweise belegte Aussagen bleiben als Behauptungen gekennzeichnet.'
  const content = [
    reel.summary.trim(),
    claimLines.length ? `Aussagen:\n${claimLines.join('\n')}` : '',
    caution,
    'Das Originaltranskript bleibt am Reel gespeichert.',
  ].filter(Boolean).join('\n\n').slice(0, 4000)
  const lifeArea = REEL_LIFE_AREAS.includes(reel.lifeArea as typeof REEL_LIFE_AREAS[number]) ? reel.lifeArea ?? '' : ''
  const tags = [`reel:${reel.id}`, `risk:${reel.riskLevel}`, `evidence:${label}`, 'import:reel']
  if (sourceOnly) tags.push('source-only')
  if (reel.suggestedTarget === 'guideline' && !sourceOnly) tags.push('guideline-candidate')
  return {
    id: knowledgeItemId,
    reelId: reel.id,
    title: title.slice(0, 160),
    content,
    summary: (reel.summary.trim() || title).slice(0, 500),
    source: reel.originalName?.trim() ? `Reel: ${reel.originalName.trim()}`.slice(0, 180) : 'Instagram Reel',
    type: 'video',
    topics: reel.topics.slice(0, 20),
    tags,
    lifeArea,
    createdAt: reel.createdAt,
    updatedAt: publishedAt,
    evidenceLabel: label,
    riskLevel: reel.riskLevel,
  }
}
