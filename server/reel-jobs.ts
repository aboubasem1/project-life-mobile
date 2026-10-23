import { randomUUID } from 'node:crypto'
import { databaseQuery, databaseTransaction } from './database.js'
import { REEL_DAILY_JOB_LIMIT, REEL_MAX_ATTEMPTS, REEL_STALE_LOCK_MS, isClaimable, normalizeLifeAreas, processingFailureDisposition, retryDelayMs, type JobView } from './reel-policy.js'

type JobRow = {
  id: string
  reel_id: string
  room_id: string
  status: 'queued' | 'running' | 'retry' | 'succeeded' | 'dead'
  attempts: number
  max_attempts: number
  life_areas: unknown
  run_after: Date | string
  locked_at: Date | string | null
}

export type ReelWorkerSnapshot = {
  enabled: boolean
  workerId: string | null
  startedAt: string | null
  lastTickAt: string | null
  lastError: string | null
  claimed: number
}

const workerSnapshot: ReelWorkerSnapshot = {
  enabled: false,
  workerId: null,
  startedAt: null,
  lastTickAt: null,
  lastError: null,
  claimed: 0,
}

let timer: ReturnType<typeof setInterval> | null = null
let ticking = false
let stopped = false

function envNumber(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name])
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}

export function reelWorkerEnabled(): boolean {
  const flag = process.env.REEL_WORKER_ENABLED?.trim().toLowerCase()
  if (flag === '0' || flag === 'false' || flag === 'off') return false
  return true
}

export function reelWorkerStatus(): ReelWorkerSnapshot {
  return { ...workerSnapshot }
}

function log(event: string, fields: Record<string, unknown> = {}): void {
  console.info(JSON.stringify({ scope: 'reel-worker', event, ...fields }))
}

export async function enqueueReelJob(input: {
  reelId: string
  roomId: string
  lifeAreas?: unknown
  force?: boolean
}): Promise<{ queued: boolean; deferred: boolean; jobId: string | null; state: string }> {
  const lifeAreas = normalizeLifeAreas(input.lifeAreas)
  const dailyLimit = envNumber('REEL_DAILY_JOB_LIMIT', REEL_DAILY_JOB_LIMIT, 1, 5000)
  return databaseTransaction(async query => {
    const open = await query<JobRow>(`
      SELECT * FROM lifeos_reel_jobs
      WHERE reel_id = $1 AND room_id = $2 AND status IN ('queued', 'running', 'retry')
      ORDER BY created_at DESC
      LIMIT 1
    `, [input.reelId, input.roomId])
    const existing = open.rows[0]
    if (existing && (!input.force || existing.status === 'running')) {
      return { queued: true, deferred: new Date(existing.run_after).getTime() > Date.now() + 60_000, jobId: existing.id, state: existing.status }
    }
    if (existing) {
      await query(`
        UPDATE lifeos_reel_jobs
        SET status = 'queued', run_after = now(), last_error = NULL, locked_at = NULL, locked_by = NULL, updated_at = now()
        WHERE id = $1
      `, [existing.id])
      return { queued: true, deferred: false, jobId: existing.id, state: 'queued' }
    }
    const usage = await query<{ count: string }>(`
      SELECT count(*)::text AS count FROM lifeos_reel_jobs
      WHERE room_id = $1 AND created_at >= date_trunc('day', now())
    `, [input.roomId])
    const deferred = Number(usage.rows[0]?.count ?? 0) >= dailyLimit
    const jobId = randomUUID()
    await query(`
      INSERT INTO lifeos_reel_jobs (id, reel_id, room_id, status, max_attempts, run_after, life_areas, last_error)
      VALUES ($1, $2, $3, 'queued', $4, CASE WHEN $5::boolean THEN now() + interval '1 day' ELSE now() END, $6::jsonb, $7)
    `, [jobId, input.reelId, input.roomId, envNumber('REEL_JOB_MAX_ATTEMPTS', REEL_MAX_ATTEMPTS, 1, 8), deferred, JSON.stringify(lifeAreas), deferred ? 'Tageslimit erreicht. Die Verarbeitung startet automatisch später.' : null])
    log('enqueued', { reelId: input.reelId, roomId: input.roomId, jobId, deferred })
    return { queued: true, deferred, jobId, state: 'queued' }
  })
}

async function claimJobs(workerId: string, limit: number): Promise<JobRow[]> {
  const staleSeconds = Math.round(envNumber('REEL_JOB_STALE_MS', REEL_STALE_LOCK_MS, 60_000, 3_600_000) / 1000)
  return databaseTransaction(async query => {
    const result = await query<JobRow>(`
      WITH candidate AS (
        SELECT id
        FROM lifeos_reel_jobs
        WHERE (
          status IN ('queued', 'retry') AND run_after <= now()
        ) OR (
          status = 'running' AND locked_at < now() - ($2::int * interval '1 second')
        )
        ORDER BY run_after ASC, created_at ASC
        LIMIT $3
        FOR UPDATE SKIP LOCKED
      )
      UPDATE lifeos_reel_jobs AS job
      SET status = 'running', locked_at = now(), locked_by = $1, attempts = attempts + 1, updated_at = now()
      FROM candidate
      WHERE job.id = candidate.id
      RETURNING job.*
    `, [workerId, staleSeconds, limit])
    return result.rows
  })
}

async function settleJob(job: JobRow, error?: unknown): Promise<void> {
  if (!error) {
    await databaseQuery(`
      UPDATE lifeos_reel_jobs
      SET status = 'succeeded', last_error = NULL, locked_at = NULL, updated_at = now()
      WHERE id = $1 AND locked_by = $2 AND status = 'running'
    `, [job.id, workerSnapshot.workerId])
    return
  }
  const disposition = processingFailureDisposition(error)
  if (disposition === 'lost_lock') {
    log('lost_lock', { reelId: job.reel_id, roomId: job.room_id, jobId: job.id })
    return
  }
  const message = error instanceof Error ? error.message.slice(0, 1000) : 'Verarbeitung fehlgeschlagen.'
  const permanent = disposition === 'permanent' || job.attempts >= job.max_attempts
  if (permanent) {
    await databaseQuery(`
      UPDATE lifeos_reel_jobs
      SET status = 'dead', last_error = $3, locked_at = NULL, updated_at = now()
      WHERE id = $1 AND locked_by = $2 AND status = 'running'
    `, [job.id, workerSnapshot.workerId, message])
    await databaseQuery(`
      UPDATE lifeos_reels
      SET status = 'FAILED', error_message = $3, updated_at = now(), version = version + 1
      WHERE id = $1 AND room_id = $2 AND status = 'PROCESSING'
    `, [job.reel_id, job.room_id, message])
    log('dead', { reelId: job.reel_id, roomId: job.room_id, attempts: job.attempts })
    return
  }
  const delaySeconds = Math.round(retryDelayMs(job.attempts) / 1000)
  await databaseQuery(`
    UPDATE lifeos_reel_jobs
    SET status = 'retry', last_error = $3, locked_at = NULL, locked_by = NULL,
      run_after = now() + ($4::int * interval '1 second'), updated_at = now()
    WHERE id = $1 AND locked_by = $2 AND status = 'running'
  `, [job.id, workerSnapshot.workerId, message, delaySeconds])
  await databaseQuery(`
    UPDATE lifeos_reels
    SET error_message = $3, updated_at = now()
    WHERE id = $1 AND room_id = $2 AND status = 'PROCESSING'
  `, [job.reel_id, job.room_id, message])
  log('retry', { reelId: job.reel_id, roomId: job.room_id, attempts: job.attempts, delaySeconds })
}

async function markReelProcessing(job: JobRow): Promise<boolean> {
  const updated = await databaseQuery(`
    UPDATE lifeos_reels
    SET status = 'PROCESSING', processing_attempts = processing_attempts + 1, error_message = NULL, updated_at = now(), version = version + 1
    WHERE id = $1 AND room_id = $2
      AND status IN ('UPLOADED', 'FAILED', 'MORE_EVIDENCE', 'EXTRACTED', 'CLASSIFIED', 'FACT_CHECK_PENDING', 'PROCESSING')
    RETURNING id
  `, [job.reel_id, job.room_id])
  if (updated.rows[0]) return true
  const current = await databaseQuery<{ status: string }>(`SELECT status FROM lifeos_reels WHERE id = $1 AND room_id = $2`, [job.reel_id, job.room_id])
  const status = current.rows[0]?.status
  if (status && ['REVIEW_READY', 'USER_REVIEWED', 'APPROVED_CANDIDATE', 'PUBLISHED', 'SOURCE_ONLY', 'REJECTED'].includes(status)) {
    await settleJob(job)
    return false
  }
  await settleJob(job, new Error('Reel kann nicht verarbeitet werden.'))
  return false
}

async function tick(workerId: string): Promise<void> {
  if (ticking || stopped) return
  ticking = true
  workerSnapshot.lastTickAt = new Date().toISOString()
  try {
    const jobs = await claimJobs(workerId, envNumber('REEL_WORKER_CONCURRENCY', 1, 1, 2))
    workerSnapshot.claimed += jobs.length
    for (const job of jobs) {
      if (stopped) break
      const ready = await markReelProcessing(job)
      if (!ready) continue
      try {
        const { runReelPipeline } = await import('./reel-api.js')
        const areas = normalizeLifeAreas(job.life_areas)
        await runReelPipeline({ roomId: job.room_id, reelId: job.reel_id, lifeAreas: areas, jobId: job.id, workerId })
        await settleJob(job)
        log('succeeded', { reelId: job.reel_id, roomId: job.room_id, attempts: job.attempts })
      } catch (error) {
        workerSnapshot.lastError = error instanceof Error ? error.message.slice(0, 300) : 'Verarbeitung fehlgeschlagen.'
        await settleJob(job, error)
      }
    }
  } catch (error) {
    workerSnapshot.lastError = error instanceof Error ? error.message.slice(0, 300) : 'Worker-Tick fehlgeschlagen.'
    log('tick_failed', { message: workerSnapshot.lastError })
  } finally {
    ticking = false
  }
}

export function startReelWorker(): () => void {
  if (!reelWorkerEnabled()) {
    workerSnapshot.enabled = false
    log('disabled')
    return () => undefined
  }
  if (timer) return () => stopReelWorker()
  const workerId = `reel-${randomUUID()}`
  stopped = false
  workerSnapshot.enabled = true
  workerSnapshot.workerId = workerId
  workerSnapshot.startedAt = new Date().toISOString()
  const pollMs = envNumber('REEL_WORKER_POLL_MS', 4000, 1000, 60_000)
  void tick(workerId)
  timer = setInterval(() => void tick(workerId), pollMs)
  log('started', { workerId, pollMs, concurrency: envNumber('REEL_WORKER_CONCURRENCY', 1, 1, 2) })
  return () => stopReelWorker()
}

export function stopReelWorker(): void {
  stopped = true
  if (timer) clearInterval(timer)
  timer = null
  workerSnapshot.enabled = false
}

export async function roomJobCounts(roomId: string): Promise<{ queued: number; running: number; retry: number; dead: number }> {
  const result = await databaseQuery<{ status: string; count: string }>(`
    SELECT status, count(*)::text AS count
    FROM lifeos_reel_jobs
    WHERE room_id = $1 AND created_at > now() - interval '14 days'
    GROUP BY status
  `, [roomId])
  const counts = { queued: 0, running: 0, retry: 0, dead: 0 }
  for (const row of result.rows) {
    if (row.status in counts) counts[row.status as keyof typeof counts] = Number(row.count)
  }
  return counts
}

export function claimDecision(job: JobView, nowMs: number): boolean {
  return isClaimable(job, nowMs, envNumber('REEL_JOB_STALE_MS', REEL_STALE_LOCK_MS, 60_000, 3_600_000))
}
