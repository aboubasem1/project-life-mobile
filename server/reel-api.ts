import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { databaseConfigured, databaseQuery, databaseTransaction, type SqlQuery } from './database.js'
import { materializeStoredObject } from './object-storage.js'
import { analyzeReelTranscript, readOnScreenText, verifyClaims } from './reel-analysis.js'
import { enqueueReelJob, enqueueReelJobWithQuery, reelWorkerEnabled, reelWorkerStatus, roomJobCounts, startReelWorker } from './reel-jobs.js'
import { triageReelWithJev } from './reel-jev.js'
import { extractReelAudio, extractReelFrames } from './reel-media.js'
import { buildKnowledgeDraft, bulkItemDecision, normalizeLifeAreas, pipelineStage, publishBlockReason, type KnowledgePublishDraft } from './reel-policy.js'
import { SyncHttpError, readSyncJson, syncJson } from './sync-core.js'
import { getRoom } from './sync-store.js'
import { transcribeAudioBytes } from './transcription-core.js'

type ReelStatus =
  | 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'CLASSIFIED' | 'FACT_CHECK_PENDING'
  | 'REVIEW_READY' | 'USER_REVIEWED' | 'APPROVED_CANDIDATE' | 'REJECTED'
  | 'SOURCE_ONLY' | 'MORE_EVIDENCE' | 'FAILED' | 'DUPLICATE' | 'SUPERSEDED' | 'PUBLISHED'

type ReelRow = {
  id: string
  room_id: string
  object_id: string
  checksum_sha256: string | null
  status: ReelStatus
  title: string
  summary: string
  transcript: string
  transcript_provider: string | null
  transcript_model: string | null
  life_area: string | null
  topics: unknown
  usefulness_score: number | null
  risk_level: 'low' | 'medium' | 'high'
  suggested_target: 'knowledge' | 'guideline' | 'source_only' | 'reject' | null
  jev_result: unknown
  analysis: unknown
  reviewer_note: string
  processing_attempts: number
  error_message: string | null
  version: number
  created_at: Date | string
  updated_at: Date | string
  reviewed_at: Date | string | null
  approved_at: Date | string | null
  knowledge_item_id?: string | null
  published_at?: Date | string | null
  publish_snapshot?: KnowledgePublishDraft | null
  original_name?: string
  content_type?: string
  size_bytes?: number | string
  claims?: unknown
  job_status?: string | null
  job_attempts?: number | null
  job_last_error?: string | null
  job_run_after?: Date | string | null
}

const REEL_FROM = `
  FROM lifeos_reels r
  JOIN lifeos_objects o ON o.id = r.object_id
  LEFT JOIN LATERAL (
    SELECT status AS job_status, attempts AS job_attempts, last_error AS job_last_error, run_after AS job_run_after
    FROM lifeos_reel_jobs
    WHERE reel_id = r.id
    ORDER BY created_at DESC
    LIMIT 1
  ) job ON true
`

const REVIEW_TRANSITIONS: Record<string, ReelStatus> = {
  approve_candidate: 'APPROVED_CANDIDATE',
  reject: 'REJECTED',
  source_only: 'SOURCE_ONLY',
  more_evidence: 'MORE_EVIDENCE',
  reviewed: 'USER_REVIEWED',
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

async function authorizeRoom(request: Request): Promise<string> {
  const roomId = request.headers.get('x-life-os-room')?.trim() ?? ''
  const deviceToken = bearerToken(request) || request.headers.get('x-life-os-token')?.trim() || ''
  if (!roomId || !deviceToken) throw new SyncHttpError(401, 'Raum und Token sind nötig.')
  const room = await getRoom(roomId)
  if (!room) throw new SyncHttpError(404, 'Sync-Raum nicht gefunden.')
  if (!room.deviceTokens.includes(deviceToken)) throw new SyncHttpError(403, 'Gerät nicht mit diesem Sync verbunden.')
  return roomId
}

function requireDatabase(): void {
  if (!databaseConfigured()) throw new SyncHttpError(503, 'Reel-Import benötigt PostgreSQL.')
}

function uuid(value: unknown, label = 'ID'): string {
  const id = typeof value === 'string' ? value.trim() : ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new SyncHttpError(400, `${label} ist ungültig.`)
  }
  return id
}

function optionalChecksum(value: unknown): string | null {
  const checksum = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!checksum) return null
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw new SyncHttpError(400, 'Prüfsumme ist ungültig.')
  return checksum
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function stringList(value: unknown, max = 30): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(item => text(item, 80)).filter(Boolean))].slice(0, max)
}

function reelJson(row: ReelRow): Record<string, unknown> {
  const analysis = row.analysis && typeof row.analysis === 'object' ? row.analysis as Record<string, unknown> : {}
  return {
    id: row.id,
    objectId: row.object_id,
    checksumSha256: row.checksum_sha256,
    status: row.status,
    title: row.title,
    summary: row.summary,
    transcript: row.transcript,
    transcriptProvider: row.transcript_provider,
    transcriptModel: row.transcript_model,
    onScreenText: typeof analysis.onScreenText === 'string' ? analysis.onScreenText : '',
    lifeArea: row.life_area || '',
    topics: Array.isArray(row.topics) ? row.topics : [],
    usefulnessScore: row.usefulness_score,
    riskLevel: row.risk_level,
    suggestedTarget: row.suggested_target,
    jev: row.jev_result,
    reviewerNote: row.reviewer_note,
    processingAttempts: row.processing_attempts,
    errorMessage: row.error_message,
    version: row.version,
    originalName: row.original_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes == null ? undefined : Number(row.size_bytes),
    claims: Array.isArray(row.claims) ? row.claims : [],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    knowledgeItemId: row.knowledge_item_id ?? null,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    jobStatus: row.job_status ?? null,
    jobAttempts: row.job_attempts ?? 0,
    jobLastError: row.job_last_error ?? null,
    jobRunAfter: row.job_run_after ? new Date(row.job_run_after).toISOString() : null,
    backgroundProcessing: workerSnapshot().enabled,
  }
}

function workerSnapshot() {
  return reelWorkerStatus()
}

async function audit(input: {
  reelId: string
  roomId: string
  action: string
  from?: string | null
  to?: string | null
  details?: unknown
  query?: SqlQuery
}): Promise<void> {
  await (input.query ?? databaseQuery)(`
    INSERT INTO lifeos_reel_audit (reel_id, room_id, actor, action, from_status, to_status, details)
    VALUES ($1, $2, 'authenticated_device', $3, $4, $5, $6::jsonb)
  `, [input.reelId, input.roomId, input.action, input.from ?? null, input.to ?? null, JSON.stringify(input.details ?? {})])
}

async function findReel(roomId: string, reelId: string): Promise<ReelRow> {
  const result = await databaseQuery<ReelRow>(`
    SELECT r.*, o.original_name, o.content_type, o.size_bytes,
      job.job_status, job.job_attempts, job.job_last_error, job.job_run_after,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', c.id,
          'position', c.position,
          'text', c.claim_text,
          'type', c.claim_type,
          'verificationStatus', c.verification_status,
          'confidence', c.confidence,
          'evidence', c.evidence,
          'note', c.verifier_note
        ) ORDER BY c.position)
        FROM lifeos_reel_claims c WHERE c.reel_id = r.id
      ), '[]'::jsonb) AS claims
    ${REEL_FROM}
    WHERE r.id = $1 AND r.room_id = $2
    LIMIT 1
  `, [reelId, roomId])
  const reel = result.rows[0]
  if (!reel) throw new SyncHttpError(404, 'Reel nicht gefunden.')
  return reel
}

async function registerReel(request: Request, roomId: string): Promise<Response> {
  const body = await readSyncJson<{ objectId?: unknown; checksumSha256?: unknown; lifeAreas?: unknown }>(request)
  const objectId = uuid(body.objectId, 'Datei-ID')
  const result = await databaseTransaction(async query => {
    const objectResult = await query<{ checksum_sha256: string | null; status: string }>(`
      SELECT checksum_sha256, status FROM lifeos_objects WHERE id = $1 AND room_id = $2 FOR UPDATE
    `, [objectId, roomId])
    const object = objectResult.rows[0]
    if (!object || object.status !== 'ready') throw new SyncHttpError(409, 'Upload ist noch nicht vollständig.')
    const checksum = optionalChecksum(body.checksumSha256) || object.checksum_sha256

    const existingObject = await query<ReelRow>('SELECT * FROM lifeos_reels WHERE object_id = $1 AND room_id = $2 LIMIT 1', [objectId, roomId])
    if (existingObject.rows[0]) {
      const existing = existingObject.rows[0]
      const job = existing.status === 'UPLOADED' || existing.status === 'FAILED'
        ? await enqueueReelJobWithQuery(query, { reelId: existing.id, roomId, lifeAreas: body.lifeAreas, force: existing.status === 'FAILED' })
        : null
      return { reelId: existing.id, duplicate: existing.status === 'DUPLICATE', job }
    }

    if (checksum) await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${roomId}:${checksum}`])
    let duplicateOf: ReelRow | undefined
    if (checksum) {
      const duplicate = await query<ReelRow>(`
      SELECT * FROM lifeos_reels
      WHERE room_id = $1 AND checksum_sha256 = $2 AND status NOT IN ('DUPLICATE', 'SUPERSEDED')
      ORDER BY created_at ASC LIMIT 1
    `, [roomId, checksum])
      duplicateOf = duplicate.rows[0]
    }

    const reelId = randomUUID()
    const status: ReelStatus = duplicateOf ? 'DUPLICATE' : 'UPLOADED'
    await query(`
    INSERT INTO lifeos_reels (id, room_id, object_id, checksum_sha256, status, analysis)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `, [reelId, roomId, objectId, checksum, status, JSON.stringify(duplicateOf ? { duplicateOf: duplicateOf.id } : {})])
    await audit({ reelId, roomId, action: duplicateOf ? 'duplicate_detected' : 'registered', to: status, details: duplicateOf ? { duplicateOf: duplicateOf.id } : {}, query })
    const job = duplicateOf ? null : await enqueueReelJobWithQuery(query, { reelId, roomId, lifeAreas: body.lifeAreas })
    return { reelId, duplicate: Boolean(duplicateOf), job }
  })
  return syncJson({
    ok: true,
    duplicate: result.duplicate,
    queued: Boolean(result.job?.queued),
    deferred: Boolean(result.job?.deferred),
    reel: reelJson(await findReel(roomId, result.reelId)),
  })
}

async function listReels(url: URL, roomId: string): Promise<Response> {
  const status = url.searchParams.get('status')?.trim() || ''
  const limit = Math.min(300, Math.max(1, Number(url.searchParams.get('limit')) || 100))
  const values: unknown[] = [roomId, limit]
  let statusSql = ''
  if (status) {
    values.push(status)
    statusSql = `AND r.status = $${values.length}`
  }
  const result = await databaseQuery<ReelRow>(`
    SELECT r.*, o.original_name, o.content_type, o.size_bytes,
      job.job_status, job.job_attempts, job.job_last_error, job.job_run_after,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'position', c.position, 'text', c.claim_text, 'type', c.claim_type,
        'verificationStatus', c.verification_status, 'confidence', c.confidence,
        'evidence', c.evidence, 'note', c.verifier_note
      ) ORDER BY c.position) FROM lifeos_reel_claims c WHERE c.reel_id = r.id), '[]'::jsonb) AS claims
    ${REEL_FROM}
    WHERE r.room_id = $1 ${statusSql}
    ORDER BY r.created_at DESC LIMIT $2
  `, values)
  return syncJson({ ok: true, reels: result.rows.map(reelJson) })
}

const FINISHED_STATUSES = ['REVIEW_READY', 'USER_REVIEWED', 'APPROVED_CANDIDATE', 'PUBLISHED', 'SOURCE_ONLY', 'REJECTED', 'SUPERSEDED']

function analysisRecord(row: ReelRow): Record<string, unknown> {
  return row.analysis && typeof row.analysis === 'object' ? row.analysis as Record<string, unknown> : {}
}

function storedClaims(analysis: Record<string, unknown>): Array<{ text: string; type: 'general' | 'health' | 'legal' | 'financial' | 'safety' }> {
  if (!Array.isArray(analysis.claims)) return []
  return analysis.claims.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const claim = item as { text?: unknown; type?: unknown }
    const claimText = typeof claim.text === 'string' ? claim.text.trim() : ''
    if (!claimText) return []
    const type = claim.type === 'health' || claim.type === 'legal' || claim.type === 'financial' || claim.type === 'safety' ? claim.type : 'general'
    return [{ text: claimText, type }]
  })
}

function onScreenTextOf(row: ReelRow): string {
  const value = analysisRecord(row).onScreenText
  return typeof value === 'string' ? value : ''
}

async function assertJobOwner(jobId?: string, workerId?: string): Promise<void> {
  if (!jobId || !workerId) return
  const result = await databaseQuery<{ locked_by: string | null; status: string }>(`
    SELECT locked_by, status FROM lifeos_reel_jobs WHERE id = $1
  `, [jobId])
  const row = result.rows[0]
  if (!row || row.locked_by !== workerId || row.status !== 'running') {
    throw new SyncHttpError(409, 'Verarbeitung wurde von einem anderen Worker übernommen.')
  }
}

export async function runReelPipeline(input: {
  roomId: string
  reelId: string
  lifeAreas: string[]
  jobId?: string
  workerId?: string
}): Promise<void> {
  const lifeAreas = normalizeLifeAreas(input.lifeAreas)
  let current = await findReel(input.roomId, input.reelId)
  if (current.status === 'DUPLICATE') throw new SyncHttpError(409, 'Duplikate werden nicht erneut verarbeitet.')
  const stageOf = (row: ReelRow) => pipelineStage({
    status: row.status,
    transcript: row.transcript,
    onScreenText: onScreenTextOf(row),
    title: row.title,
    claimsSaved: analysisRecord(row).claimsSaved === true || (Array.isArray(row.claims) && row.claims.length > 0 && row.status !== 'MORE_EVIDENCE'),
  })
  if (stageOf(current) === 'done') return

  await assertJobOwner(input.jobId, input.workerId)
  await audit({ reelId: input.reelId, roomId: input.roomId, action: 'processing_started', from: current.status, to: 'PROCESSING' })
  const temporary = await mkdtemp(join(tmpdir(), 'lifeos-reel-'))
  try {
    if (stageOf(current) === 'extract') {
      const objectResult = await databaseQuery<{ storage_key: string }>('SELECT storage_key FROM lifeos_objects WHERE id = $1 AND room_id = $2 LIMIT 1', [current.object_id, input.roomId])
      const storageKey = objectResult.rows[0]?.storage_key
      if (!storageKey) throw new SyncHttpError(404, 'Quelldatei nicht gefunden.')
      const videoPath = join(temporary, 'source-video')
      const audioPath = join(temporary, 'audio.mp3')
      await materializeStoredObject(storageKey, videoPath)
      await assertJobOwner(input.jobId, input.workerId)
      let transcript = ''
      let transcriptProvider: string | null = null
      let transcriptModel: string | null = null
      let audio: Buffer | null = null
      try {
        audio = await extractReelAudio(videoPath, audioPath)
      } catch {
        // Text-only reels legitimately have no audio track. Frame OCR below is the fallback.
      }
      if (audio) {
        try {
          const transcription = await transcribeAudioBytes(audio, 'audio/mpeg')
          transcript = transcription.transcript
          transcriptProvider = transcription.provider
          transcriptModel = transcription.model
        } catch (error) {
          if (!(error instanceof SyncHttpError) || error.status !== 422) throw error
        }
      }
      const frames = transcript.length < 200 ? await extractReelFrames(videoPath, temporary) : []
      const onScreenText = await readOnScreenText(frames)
      if (!transcript && !onScreenText) throw new SyncHttpError(422, 'Weder Sprache noch lesbarer Bildschirmtext erkannt.')
      await assertJobOwner(input.jobId, input.workerId)
      await databaseQuery(`
        UPDATE lifeos_reels SET status = 'EXTRACTED', transcript = $3, transcript_provider = $4,
          transcript_model = $5, analysis = COALESCE(analysis, '{}'::jsonb) || $6::jsonb,
          updated_at = now(), version = version + 1
        WHERE id = $1 AND room_id = $2
      `, [input.reelId, input.roomId, transcript, transcriptProvider, transcriptModel, JSON.stringify({ onScreenText })])
      current = await findReel(input.roomId, input.reelId)
    }

    if (stageOf(current) === 'analyze') {
      await assertJobOwner(input.jobId, input.workerId)
      const transcript = current.transcript
      const onScreenText = onScreenTextOf(current)
      const analysis = await analyzeReelTranscript(transcript, lifeAreas, onScreenText)
      const jev = await triageReelWithJev({
        title: analysis.title,
        summary: analysis.summary,
        transcript: [transcript, onScreenText].filter(Boolean).join('\n\n'),
        topics: analysis.topics,
        lifeAreas,
      })
      const riskLevel = analysis.riskLevel === 'high' || jev.risk === 'high'
        ? 'high'
        : analysis.riskLevel === 'medium' || jev.risk === 'medium' ? 'medium' : 'low'
      const target = jev.available ? jev.target : 'source_only'
      const title = analysis.title.trim() || current.original_name?.trim() || 'Reel'
      await assertJobOwner(input.jobId, input.workerId)
      await databaseQuery(`
        UPDATE lifeos_reels SET status = 'FACT_CHECK_PENDING', title = $3, summary = $4,
          life_area = $5, topics = $6::jsonb, usefulness_score = $7, risk_level = $8,
          suggested_target = $9, jev_result = $10::jsonb, analysis = $11::jsonb,
          updated_at = now(), version = version + 1
        WHERE id = $1 AND room_id = $2
      `, [input.reelId, input.roomId, title, analysis.summary, jev.lifeArea || analysis.lifeArea || null,
        JSON.stringify(analysis.topics), analysis.usefulnessScore, riskLevel, target,
        JSON.stringify(jev), JSON.stringify({ ...analysis, onScreenText, title })])
      current = await findReel(input.roomId, input.reelId)
    }

    if (stageOf(current) === 'verify' || stageOf(current) === 'finish') {
      if (stageOf(current) === 'verify') {
        await assertJobOwner(input.jobId, input.workerId)
        const analysis = analysisRecord(current)
        const claims = storedClaims(analysis)
        const usefulness = current.usefulness_score ?? 0
        const relevance = current.jev_result && typeof current.jev_result === 'object'
          ? (current.jev_result as { relevance?: string }).relevance
          : undefined
        const verifications = usefulness >= 40 && relevance !== 'not_useful'
          ? await verifyClaims(claims)
          : claims.map(claim => ({
              claim: claim.text,
              status: 'REVIEW_REQUIRED' as const,
              confidence: 0,
              note: 'Faktencheck wegen niedriger Relevanz übersprungen.',
              evidence: [],
            }))
        await assertJobOwner(input.jobId, input.workerId)
        await databaseQuery('DELETE FROM lifeos_reel_claims WHERE reel_id = $1', [input.reelId])
        for (let index = 0; index < claims.length; index += 1) {
          const claim = claims[index]
          const verification = verifications[index]
          await databaseQuery(`
            INSERT INTO lifeos_reel_claims (
              id, reel_id, position, claim_text, claim_type, verification_status, confidence, evidence, verifier_note
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
          `, [randomUUID(), input.reelId, index, claim.text, claim.type, verification?.status ?? 'REVIEW_REQUIRED',
            verification?.confidence ?? 0, JSON.stringify(verification?.evidence ?? []), verification?.note ?? 'Manuelle Prüfung erforderlich.'])
        }
        await databaseQuery(`
          UPDATE lifeos_reels SET analysis = COALESCE(analysis, '{}'::jsonb) || '{"claimsSaved": true}'::jsonb,
            updated_at = now(), version = version + 1
          WHERE id = $1 AND room_id = $2
        `, [input.reelId, input.roomId])
        current = await findReel(input.roomId, input.reelId)
      }
      await databaseQuery(`
        UPDATE lifeos_reels SET status = 'REVIEW_READY', error_message = NULL, updated_at = now(), version = version + 1
        WHERE id = $1 AND room_id = $2 AND status IN ('PROCESSING', 'EXTRACTED', 'CLASSIFIED', 'FACT_CHECK_PENDING', 'MORE_EVIDENCE', 'FAILED')
      `, [input.reelId, input.roomId])
      await audit({
        reelId: input.reelId,
        roomId: input.roomId,
        action: 'processing_completed',
        from: 'PROCESSING',
        to: 'REVIEW_READY',
        details: { claimCount: Array.isArray(current.claims) ? current.claims.length : 0 },
      })
    }
    current = await findReel(input.roomId, input.reelId)
    if (current.status !== 'REVIEW_READY' && stageOf(current) !== 'done') {
      throw new SyncHttpError(500, 'Verarbeitung unvollständig.')
    }
  } finally {
    await rm(temporary, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function enqueueProcessing(request: Request, roomId: string, reelId: string): Promise<Response> {
  const body = await readSyncJson<{ lifeAreas?: unknown }>(request)
  const current = await findReel(roomId, reelId)
  if (current.status === 'DUPLICATE') throw new SyncHttpError(409, 'Duplikate werden nicht erneut verarbeitet.')
  if (FINISHED_STATUSES.includes(current.status)) return syncJson({ ok: true, queued: false, reel: reelJson(current) })
  const force = current.status === 'FAILED' || current.status === 'MORE_EVIDENCE' || current.job_status === 'dead'
  const job = await enqueueReelJob({ reelId, roomId, lifeAreas: body.lifeAreas, force })
  return syncJson({ ok: true, queued: job.queued, deferred: job.deferred, reel: reelJson(await findReel(roomId, reelId)) })
}

async function reviewReel(request: Request, roomId: string, reelId: string): Promise<Response> {
  const body = await readSyncJson<{
    action?: unknown
    version?: unknown
    title?: unknown
    summary?: unknown
    lifeArea?: unknown
    topics?: unknown
    suggestedTarget?: unknown
    reviewerNote?: unknown
  }>(request)
  const action = text(body.action, 40)
  const next = REVIEW_TRANSITIONS[action]
  if (!next) throw new SyncHttpError(400, 'Unbekannte Review-Aktion.')
  const version = Number(body.version)
  if (!Number.isSafeInteger(version) || version < 1) throw new SyncHttpError(400, 'Version fehlt.')
  const current = await findReel(roomId, reelId)
  if (!['REVIEW_READY', 'USER_REVIEWED', 'MORE_EVIDENCE', 'APPROVED_CANDIDATE', 'SOURCE_ONLY', 'REJECTED'].includes(current.status)) {
    throw new SyncHttpError(409, 'Reel ist noch nicht bereit zur Prüfung.')
  }
  const target = ['knowledge', 'guideline', 'source_only', 'reject'].includes(String(body.suggestedTarget))
    ? String(body.suggestedTarget)
    : current.suggested_target
  if (next === 'APPROVED_CANDIDATE' && (!target || target === 'reject' || target === 'source_only')) {
    throw new SyncHttpError(400, 'Für die Freigabe muss Knowledge oder Leitlinie gewählt sein.')
  }
  if (next === 'APPROVED_CANDIDATE' && (target === 'guideline' || current.risk_level === 'high')) {
    const unresolved = await databaseQuery<{ count: string }>(`
      SELECT count(*)::text AS count FROM lifeos_reel_claims
      WHERE reel_id = $1 AND verification_status <> 'SUPPORTED'
    `, [reelId])
    if (Number(unresolved.rows[0]?.count) > 0) {
      throw new SyncHttpError(409, 'Leitlinien und Hochrisiko-Inhalte brauchen für jede Aussage einen belegten Status.')
    }
  }
  const result = await databaseQuery<ReelRow>(`
    UPDATE lifeos_reels SET status = $3, title = $4, summary = $5, life_area = $6,
      topics = $7::jsonb, suggested_target = $8, reviewer_note = $9,
      reviewed_at = now(), approved_at = CASE WHEN $3 = 'APPROVED_CANDIDATE' THEN now() ELSE approved_at END,
      updated_at = now(), version = version + 1
    WHERE id = $1 AND room_id = $2 AND version = $10
    RETURNING *
  `, [reelId, roomId, next, text(body.title, 160) || current.title, text(body.summary, 3000),
    text(body.lifeArea, 80) || null, JSON.stringify(stringList(body.topics)), target,
    text(body.reviewerNote, 3000), version])
  if (!result.rows[0]) throw new SyncHttpError(409, 'Der Eintrag wurde zwischenzeitlich geändert. Bitte neu laden.')
  await audit({ reelId, roomId, action: `review_${action}`, from: current.status, to: next, details: { target } })
  return syncJson({ ok: true, reel: reelJson(await findReel(roomId, reelId)) })
}

function gateInput(row: ReelRow) {
  const claims = Array.isArray(row.claims) ? row.claims as Array<{ text?: string; verificationStatus?: string }> : []
  const topics = Array.isArray(row.topics) ? row.topics.map(item => String(item)) : []
  return {
    status: row.status,
    riskLevel: row.risk_level,
    suggestedTarget: row.suggested_target,
    claims: claims.map(claim => ({ text: claim.text, verificationStatus: String(claim.verificationStatus || 'REVIEW_REQUIRED') })),
    id: row.id,
    title: row.title,
    summary: row.summary,
    topics,
    lifeArea: row.life_area,
    originalName: row.original_name,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

async function publishReelRecord(roomId: string, reelId: string, sourceOnly: boolean, expectedVersion?: number, allowReady = false): Promise<{ reel: ReelRow; knowledge: KnowledgePublishDraft }> {
  const current = await findReel(roomId, reelId)
  if (current.status === 'PUBLISHED' && current.knowledge_item_id && current.publish_snapshot) {
    return { reel: current, knowledge: current.publish_snapshot }
  }
  if (expectedVersion != null && current.version !== expectedVersion) {
    throw new SyncHttpError(409, 'Der Eintrag wurde zwischenzeitlich geändert. Bitte neu laden.')
  }
  const gate = gateInput(current)
  const reason = publishBlockReason(gate, sourceOnly ? 'source_only' : 'knowledge', allowReady)
  if (reason) throw new SyncHttpError(409, reason)
  const knowledgeItemId = current.knowledge_item_id || randomUUID()
  const publishedAt = current.published_at ? new Date(current.published_at).toISOString() : new Date().toISOString()
  const draft = current.publish_snapshot ?? buildKnowledgeDraft({ reel: gate, knowledgeItemId, publishedAt, sourceOnly })
  const updated = await databaseQuery(`
    UPDATE lifeos_reels
    SET status = 'PUBLISHED', knowledge_item_id = $3, published_at = COALESCE(published_at, $4::timestamptz),
      approved_at = COALESCE(approved_at, now()),
      suggested_target = CASE WHEN $7::boolean THEN 'source_only' ELSE suggested_target END,
      publish_snapshot = $5::jsonb, updated_at = now(), version = version + 1
    WHERE id = $1 AND room_id = $2 AND version = $6 AND (knowledge_item_id IS NULL OR knowledge_item_id = $3)
    RETURNING id
  `, [reelId, roomId, knowledgeItemId, publishedAt, JSON.stringify(draft), current.version, sourceOnly])
  if (!updated.rows[0]) {
    const latest = await findReel(roomId, reelId)
    if (latest.status === 'PUBLISHED' && latest.publish_snapshot) return { reel: latest, knowledge: latest.publish_snapshot }
    throw new SyncHttpError(409, 'Der Eintrag wurde zwischenzeitlich geändert. Bitte neu laden.')
  }
  await audit({ reelId, roomId, action: sourceOnly ? 'published_source' : 'published_knowledge', from: current.status, to: 'PUBLISHED', details: { knowledgeItemId } })
  return { reel: await findReel(roomId, reelId), knowledge: draft }
}

async function publishReel(request: Request, roomId: string, reelId: string): Promise<Response> {
  const body = await readSyncJson<{ version?: unknown; sourceOnly?: unknown }>(request)
  const version = Number(body.version)
  if (!Number.isSafeInteger(version) || version < 1) throw new SyncHttpError(400, 'Version fehlt.')
  const result = await publishReelRecord(roomId, reelId, body.sourceOnly === true, version)
  return syncJson({ ok: true, reel: reelJson(result.reel), knowledge: result.knowledge })
}

async function transitionStatus(roomId: string, reel: ReelRow, status: ReelStatus, version: number): Promise<void> {
  const updated = await databaseQuery(`
    UPDATE lifeos_reels SET status = $3, reviewed_at = now(), updated_at = now(), version = version + 1
    WHERE id = $1 AND room_id = $2 AND version = $4
    RETURNING id
  `, [reel.id, roomId, status, version])
  if (!updated.rows[0]) throw new SyncHttpError(409, 'Der Eintrag wurde zwischenzeitlich geändert. Bitte neu laden.')
  await audit({ reelId: reel.id, roomId, action: `review_${status.toLowerCase()}`, from: reel.status, to: status })
}

async function batchReels(request: Request, roomId: string): Promise<Response> {
  const body = await readSyncJson<{ action?: unknown; ids?: unknown; includeMediumRisk?: unknown; versions?: unknown }>(request)
  const action = text(body.action, 40)
  if (action !== 'approve_publish' && action !== 'reject' && action !== 'source_only') throw new SyncHttpError(400, 'Unbekannte Aktion.')
  if (!Array.isArray(body.ids) || body.ids.length === 0) throw new SyncHttpError(400, 'Keine Einträge ausgewählt.')
  if (body.ids.length > 50) throw new SyncHttpError(400, 'Höchstens 50 Einträge pro Runde.')
  const versions = body.versions && typeof body.versions === 'object' ? body.versions as Record<string, unknown> : {}
  const includeMediumRisk = body.includeMediumRisk === true
  const results: Array<Record<string, unknown>> = []
  for (const rawId of body.ids) {
    const idText = typeof rawId === 'string' ? rawId : ''
    try {
      const reelId = uuid(idText, 'Reel-ID')
      const version = Number(versions[reelId])
      if (!Number.isSafeInteger(version) || version < 1) throw new SyncHttpError(400, 'Version fehlt.')
      const current = await findReel(roomId, reelId)
      const decision = bulkItemDecision(gateInput(current), action, includeMediumRisk)
      if (!decision.ok) throw new SyncHttpError(409, decision.reason)
      if (current.status === 'PUBLISHED') {
        const existing = await publishReelRecord(roomId, reelId, false)
        results.push({ id: reelId, ok: true, reel: reelJson(existing.reel), knowledge: existing.knowledge })
        continue
      }
      if (action === 'reject') {
        if (current.status !== 'REJECTED') await transitionStatus(roomId, current, 'REJECTED', version)
        results.push({ id: reelId, ok: true, reel: reelJson(await findReel(roomId, reelId)) })
        continue
      }
      if (action === 'source_only') {
        const published = await publishReelRecord(roomId, reelId, true, version)
        results.push({ id: reelId, ok: true, reel: reelJson(published.reel), knowledge: published.knowledge })
        continue
      }
      const published = await publishReelRecord(roomId, reelId, false, version, true)
      results.push({ id: reelId, ok: true, reel: reelJson(published.reel), knowledge: published.knowledge })
    } catch (error) {
      results.push({ id: idText, ok: false, error: error instanceof Error ? error.message : 'Aktion fehlgeschlagen.' })
    }
  }
  return syncJson({ ok: true, results })
}

async function reelHealth(roomId: string): Promise<Response> {
  const jobs = await roomJobCounts(roomId)
  const worker = reelWorkerStatus()
  return syncJson({
    ok: true,
    backgroundProcessing: worker.enabled,
    worker: { enabled: worker.enabled, lastTickAt: worker.lastTickAt, startedAt: worker.startedAt },
    jobs,
  })
}

export async function handleReelRequest(request: Request): Promise<Response> {
  requireDatabase()
  if (databaseConfigured() && reelWorkerEnabled()) startReelWorker()
  if (request.method === 'OPTIONS') return syncJson({ ok: true })
  const roomId = await authorizeRoom(request)
  const url = new URL(request.url)
  const pathname = url.pathname.replace(/\/$/, '')
  if (pathname.endsWith('/api/reels') && request.method === 'GET') return listReels(url, roomId)
  if (pathname.endsWith('/api/reels/health') && request.method === 'GET') return reelHealth(roomId)
  if (pathname.endsWith('/api/reels/register') && request.method === 'POST') return registerReel(request, roomId)
  if (pathname.endsWith('/api/reels/batch') && request.method === 'POST') return batchReels(request, roomId)
  const match = pathname.match(/\/api\/reels\/([0-9a-f-]+)(?:\/(process|review|publish))?$/i)
  if (!match) return syncJson({ error: 'Not found' }, 404)
  const reelId = uuid(match[1], 'Reel-ID')
  if (!match[2] && request.method === 'GET') return syncJson({ ok: true, reel: reelJson(await findReel(roomId, reelId)) })
  if (match[2] === 'process' && request.method === 'POST') return enqueueProcessing(request, roomId, reelId)
  if (match[2] === 'review' && request.method === 'POST') return reviewReel(request, roomId, reelId)
  if (match[2] === 'publish' && request.method === 'POST') return publishReel(request, roomId, reelId)
  return syncJson({ error: 'Not found' }, 404)
}
