import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { databaseConfigured, databaseQuery } from './database.js'
import { materializeStoredObject } from './object-storage.js'
import { analyzeReelTranscript, readOnScreenText, verifyClaims } from './reel-analysis.js'
import { triageReelWithJev } from './reel-jev.js'
import { extractReelAudio, extractReelFrames } from './reel-media.js'
import { SyncHttpError, readSyncJson, syncJson } from './sync-core.js'
import { getRoom } from './sync-store.js'
import { transcribeAudioBytes } from './transcription-core.js'

type ReelStatus =
  | 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'CLASSIFIED' | 'FACT_CHECK_PENDING'
  | 'REVIEW_READY' | 'USER_REVIEWED' | 'APPROVED_CANDIDATE' | 'REJECTED'
  | 'SOURCE_ONLY' | 'MORE_EVIDENCE' | 'FAILED' | 'DUPLICATE' | 'SUPERSEDED'

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
  original_name?: string
  content_type?: string
  size_bytes?: number | string
  claims?: unknown
}

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
  }
}

async function audit(input: {
  reelId: string
  roomId: string
  action: string
  from?: string | null
  to?: string | null
  details?: unknown
}): Promise<void> {
  await databaseQuery(`
    INSERT INTO lifeos_reel_audit (reel_id, room_id, actor, action, from_status, to_status, details)
    VALUES ($1, $2, 'authenticated_device', $3, $4, $5, $6::jsonb)
  `, [input.reelId, input.roomId, input.action, input.from ?? null, input.to ?? null, JSON.stringify(input.details ?? {})])
}

async function findReel(roomId: string, reelId: string): Promise<ReelRow> {
  const result = await databaseQuery<ReelRow>(`
    SELECT r.*, o.original_name, o.content_type, o.size_bytes,
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
    FROM lifeos_reels r
    JOIN lifeos_objects o ON o.id = r.object_id
    WHERE r.id = $1 AND r.room_id = $2
    LIMIT 1
  `, [reelId, roomId])
  const reel = result.rows[0]
  if (!reel) throw new SyncHttpError(404, 'Reel nicht gefunden.')
  return reel
}

async function registerReel(request: Request, roomId: string): Promise<Response> {
  const body = await readSyncJson<{ objectId?: unknown; checksumSha256?: unknown }>(request)
  const objectId = uuid(body.objectId, 'Datei-ID')
  const objectResult = await databaseQuery<{ checksum_sha256: string | null; status: string }>(`
    SELECT checksum_sha256, status FROM lifeos_objects WHERE id = $1 AND room_id = $2 LIMIT 1
  `, [objectId, roomId])
  const object = objectResult.rows[0]
  if (!object || object.status !== 'ready') throw new SyncHttpError(409, 'Upload ist noch nicht vollständig.')
  const checksum = optionalChecksum(body.checksumSha256) || object.checksum_sha256

  const existingObject = await databaseQuery<ReelRow>('SELECT * FROM lifeos_reels WHERE object_id = $1 AND room_id = $2 LIMIT 1', [objectId, roomId])
  if (existingObject.rows[0]) return syncJson({ ok: true, duplicate: false, reel: reelJson(await findReel(roomId, existingObject.rows[0].id)) })

  let duplicateOf: ReelRow | undefined
  if (checksum) {
    const duplicate = await databaseQuery<ReelRow>(`
      SELECT * FROM lifeos_reels
      WHERE room_id = $1 AND checksum_sha256 = $2 AND status NOT IN ('DUPLICATE', 'SUPERSEDED')
      ORDER BY created_at ASC LIMIT 1
    `, [roomId, checksum])
    duplicateOf = duplicate.rows[0]
  }

  const reelId = randomUUID()
  const status: ReelStatus = duplicateOf ? 'DUPLICATE' : 'UPLOADED'
  await databaseQuery(`
    INSERT INTO lifeos_reels (id, room_id, object_id, checksum_sha256, status, analysis)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
  `, [reelId, roomId, objectId, checksum, status, JSON.stringify(duplicateOf ? { duplicateOf: duplicateOf.id } : {})])
  await audit({ reelId, roomId, action: duplicateOf ? 'duplicate_detected' : 'registered', to: status, details: duplicateOf ? { duplicateOf: duplicateOf.id } : {} })
  return syncJson({ ok: true, duplicate: Boolean(duplicateOf), reel: reelJson(await findReel(roomId, reelId)) })
}

async function listReels(url: URL, roomId: string): Promise<Response> {
  const stale = await databaseQuery<{ id: string }>(`
    UPDATE lifeos_reels SET status = 'FAILED', error_message = 'Verarbeitung wurde unterbrochen und kann erneut gestartet werden.',
      updated_at = now(), version = version + 1
    WHERE room_id = $1 AND status = 'PROCESSING' AND updated_at < now() - interval '20 minutes'
    RETURNING id
  `, [roomId])
  for (const reel of stale.rows) {
    await audit({ reelId: reel.id, roomId, action: 'stale_processing_recovered', from: 'PROCESSING', to: 'FAILED' })
  }
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
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'position', c.position, 'text', c.claim_text, 'type', c.claim_type,
        'verificationStatus', c.verification_status, 'confidence', c.confidence,
        'evidence', c.evidence, 'note', c.verifier_note
      ) ORDER BY c.position) FROM lifeos_reel_claims c WHERE c.reel_id = r.id), '[]'::jsonb) AS claims
    FROM lifeos_reels r JOIN lifeos_objects o ON o.id = r.object_id
    WHERE r.room_id = $1 ${statusSql}
    ORDER BY r.created_at DESC LIMIT $2
  `, values)
  return syncJson({ ok: true, reels: result.rows.map(reelJson) })
}

async function processReel(request: Request, roomId: string, reelId: string): Promise<Response> {
  const body = await readSyncJson<{ lifeAreas?: unknown }>(request)
  const lifeAreas = stringList(body.lifeAreas, 50)
  const current = await findReel(roomId, reelId)
  if (current.status === 'DUPLICATE') throw new SyncHttpError(409, 'Duplikate werden nicht erneut verarbeitet.')
  const staleProcessing = current.status === 'PROCESSING'
    && Date.now() - new Date(current.updated_at).getTime() > 20 * 60_000
  if (current.status === 'PROCESSING' && !staleProcessing) throw new SyncHttpError(409, 'Reel wird bereits verarbeitet.')
  if (!['UPLOADED', 'FAILED', 'MORE_EVIDENCE'].includes(current.status) && !staleProcessing) {
    return syncJson({ ok: true, reel: reelJson(current) })
  }

  const locked = await databaseQuery<ReelRow>(`
    UPDATE lifeos_reels SET status = 'PROCESSING', processing_attempts = processing_attempts + 1,
      error_message = NULL, updated_at = now(), version = version + 1
    WHERE id = $1 AND room_id = $2 AND status = $3
    RETURNING *
  `, [reelId, roomId, current.status])
  if (!locked.rows[0]) throw new SyncHttpError(409, 'Reel-Status wurde gleichzeitig geändert.')
  await audit({ reelId, roomId, action: 'processing_started', from: current.status, to: 'PROCESSING' })

  const objectResult = await databaseQuery<{ storage_key: string }>('SELECT storage_key FROM lifeos_objects WHERE id = $1 AND room_id = $2 LIMIT 1', [current.object_id, roomId])
  const storageKey = objectResult.rows[0]?.storage_key
  if (!storageKey) throw new SyncHttpError(404, 'Quelldatei nicht gefunden.')
  const temporary = await mkdtemp(join(tmpdir(), 'lifeos-reel-'))
  try {
    const videoPath = join(temporary, 'source-video')
    const audioPath = join(temporary, 'audio.mp3')
    await materializeStoredObject(storageKey, videoPath)
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
    await databaseQuery(`
      UPDATE lifeos_reels SET status = 'EXTRACTED', transcript = $3, transcript_provider = $4,
        transcript_model = $5, updated_at = now(), version = version + 1
      WHERE id = $1 AND room_id = $2
    `, [reelId, roomId, transcript, transcriptProvider, transcriptModel])

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
    await databaseQuery(`
      UPDATE lifeos_reels SET status = 'FACT_CHECK_PENDING', title = $3, summary = $4,
        life_area = $5, topics = $6::jsonb, usefulness_score = $7, risk_level = $8,
        suggested_target = $9, jev_result = $10::jsonb, analysis = $11::jsonb,
        updated_at = now(), version = version + 1
      WHERE id = $1 AND room_id = $2
    `, [reelId, roomId, analysis.title, analysis.summary, jev.lifeArea || analysis.lifeArea || null,
      JSON.stringify(analysis.topics), analysis.usefulnessScore, riskLevel, target,
      JSON.stringify(jev), JSON.stringify(analysis)])

    // Save web-search cost for clearly low-value sources; they remain visible and reviewable.
    const verifications = analysis.usefulnessScore >= 40 && jev.relevance !== 'not_useful'
      ? await verifyClaims(analysis.claims)
      : analysis.claims.map(claim => ({
          claim: claim.text,
          status: 'REVIEW_REQUIRED' as const,
          confidence: 0,
          note: 'Faktencheck wegen niedriger Relevanz übersprungen.',
          evidence: [],
        }))
    await databaseQuery('DELETE FROM lifeos_reel_claims WHERE reel_id = $1', [reelId])
    for (let index = 0; index < analysis.claims.length; index += 1) {
      const claim = analysis.claims[index]
      const verification = verifications[index]
      await databaseQuery(`
        INSERT INTO lifeos_reel_claims (
          id, reel_id, position, claim_text, claim_type, verification_status, confidence, evidence, verifier_note
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      `, [randomUUID(), reelId, index, claim.text, claim.type, verification?.status ?? 'REVIEW_REQUIRED',
        verification?.confidence ?? 0, JSON.stringify(verification?.evidence ?? []), verification?.note ?? 'Manuelle Prüfung erforderlich.'])
    }
    await databaseQuery(`
      UPDATE lifeos_reels SET status = 'REVIEW_READY', updated_at = now(), version = version + 1
      WHERE id = $1 AND room_id = $2
    `, [reelId, roomId])
    await audit({ reelId, roomId, action: 'processing_completed', from: 'PROCESSING', to: 'REVIEW_READY', details: { claimCount: analysis.claims.length, jevAvailable: jev.available } })
    return syncJson({ ok: true, reel: reelJson(await findReel(roomId, reelId)) })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Verarbeitung fehlgeschlagen.'
    await databaseQuery(`
      UPDATE lifeos_reels SET status = 'FAILED', error_message = $3, updated_at = now(), version = version + 1
      WHERE id = $1 AND room_id = $2
    `, [reelId, roomId, message]).catch(() => undefined)
    await audit({ reelId, roomId, action: 'processing_failed', from: 'PROCESSING', to: 'FAILED', details: { message } }).catch(() => undefined)
    throw error
  } finally {
    await rm(temporary, { recursive: true, force: true }).catch(() => undefined)
  }
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

export async function handleReelRequest(request: Request): Promise<Response> {
  requireDatabase()
  if (request.method === 'OPTIONS') return syncJson({ ok: true })
  const roomId = await authorizeRoom(request)
  const url = new URL(request.url)
  const pathname = url.pathname.replace(/\/$/, '')
  if (pathname.endsWith('/api/reels') && request.method === 'GET') return listReels(url, roomId)
  if (pathname.endsWith('/api/reels/register') && request.method === 'POST') return registerReel(request, roomId)
  const match = pathname.match(/\/api\/reels\/([0-9a-f-]+)(?:\/(process|review))?$/i)
  if (!match) return syncJson({ error: 'Not found' }, 404)
  const reelId = uuid(match[1], 'Reel-ID')
  if (!match[2] && request.method === 'GET') return syncJson({ ok: true, reel: reelJson(await findReel(roomId, reelId)) })
  if (match[2] === 'process' && request.method === 'POST') return processReel(request, roomId, reelId)
  if (match[2] === 'review' && request.method === 'POST') return reviewReel(request, roomId, reelId)
  return syncJson({ error: 'Not found' }, 404)
}
