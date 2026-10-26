import { randomUUID } from 'node:crypto'
import { databaseConfigured, databasePool, databaseQuery, ensureDatabaseSchema } from './database.js'
import type { PoolClient } from 'pg'

export function jobSettings() {
  const bounded = (key: string, fallback: number, max: number) => {
    const value = Number(process.env[key])
    return Number.isSafeInteger(value) && value > 0 ? Math.min(max, value) : fallback
  }
  return {
    concurrency: bounded('REEL_WORKER_CONCURRENCY', 1, 3),
    maxAttempts: bounded('REEL_MAX_ATTEMPTS', 3, 5),
    dailyLimit: bounded('REEL_DAILY_LIMIT', 100, 1000),
  }
}

export function retryDelaySeconds(attempt: number): number {
  return Math.min(3600, 30 * 2 ** Math.max(0, Math.min(attempt - 1, 10)))
}

export async function enqueueReel(reelId: string, roomId: string, lifeAreas: string[], retry = false) {
  await databaseQuery(`
    INSERT INTO lifeos_reel_jobs (reel_id, room_id, life_areas)
    SELECT id, room_id, $3::jsonb FROM lifeos_reels
    WHERE id = $1 AND room_id = $2 AND status IN ('UPLOADED','FAILED','PROCESSING','EXTRACTED','CLASSIFIED','FACT_CHECK_PENDING')
    ON CONFLICT (reel_id) DO UPDATE SET state = 'queued', available_at = now(), attempts = 0,
      life_areas = EXCLUDED.life_areas, updated_at = now()
    WHERE lifeos_reel_jobs.state = 'failed' AND $4
  `, [reelId, roomId, JSON.stringify(lifeAreas), retry])
}

export async function workerAvailable(): Promise<boolean> {
  const result = await databaseQuery<{ alive: boolean }>(`SELECT EXISTS (
    SELECT 1 FROM lifeos_reel_workers WHERE heartbeat_at > now() - interval '45 seconds'
  ) AS alive`)
  return result.rows[0]?.alive === true
}

type Job = { reel_id: string; room_id: string; life_areas: string[]; attempts: number }
export type ReelProcessor = (job: Job, client: PoolClient) => Promise<void>

/** Session advisory lock outlives each short transaction. A live worker cannot be stolen
 * even if its heartbeat stalls. All pipeline writes use this same connection: losing it
 * fences the old worker. PostgreSQL releases its lock on disconnect/restart. */
export async function workOneReel(process: ReelProcessor): Promise<boolean> {
  await ensureDatabaseSchema()
  const client = await databasePool().connect()
  let job: Job | undefined
  let lockedId: string | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let disconnected = false
  const onError = () => { disconnected = true }
  client.on('error', onError)
  try {
    await client.query('BEGIN')
    const candidates = await client.query<Job>(`
      SELECT j.* FROM lifeos_reel_jobs j
      WHERE (j.state = 'queued' AND j.available_at <= now())
         OR (j.state = 'running' AND j.heartbeat_at < now() - interval '2 minutes')
      ORDER BY j.available_at LIMIT 10 FOR UPDATE SKIP LOCKED
    `)
    for (const candidate of candidates.rows) {
      const lock = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked', [candidate.reel_id])
      if (lock.rows[0]?.locked) { job = candidate; lockedId = candidate.reel_id; break }
    }
    if (!job) { await client.query('COMMIT'); return false }
    // Serialize the per-room budget check across worker processes.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 1))', [job.room_id])
    const budget = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM lifeos_reel_audit
      WHERE room_id = $1 AND action = 'job_attempt' AND created_at >= date_trunc('day', now())`, [job.room_id])
    if (job.attempts >= jobSettings().maxAttempts) {
      await client.query("UPDATE lifeos_reel_jobs SET state='failed', updated_at=now() WHERE reel_id=$1", [job.reel_id])
      await client.query("UPDATE lifeos_reels SET status='FAILED', error_message='Verarbeitung unterbrochen. Bitte erneut versuchen.', updated_at=now(), version=version+1 WHERE id=$1", [job.reel_id])
      await client.query('COMMIT')
      return true
    }
    if (Number(budget.rows[0]?.count) >= jobSettings().dailyLimit) {
      await client.query("UPDATE lifeos_reel_jobs SET state='queued', available_at=date_trunc('day',now())+interval '1 day', updated_at=now() WHERE reel_id=$1", [job.reel_id])
      await client.query('COMMIT')
      return false
    }
    job.attempts += 1
    await client.query("UPDATE lifeos_reel_jobs SET state='running', attempts=$2, heartbeat_at=now(), started_at=now(), updated_at=now() WHERE reel_id=$1", [job.reel_id, job.attempts])
    await client.query("INSERT INTO lifeos_reel_audit (reel_id,room_id,actor,action,details) VALUES ($1,$2,'worker','job_attempt',$3::jsonb)", [job.reel_id, job.room_id, JSON.stringify({ attempt: job.attempts })])
    await client.query('COMMIT')
    heartbeat = setInterval(() => {
      void client.query('UPDATE lifeos_reel_jobs SET heartbeat_at=now() WHERE reel_id=$1', [job!.reel_id]).catch(onError)
    }, 15_000)
    try {
      await process(job, client)
      await client.query("UPDATE lifeos_reel_jobs SET state='done', updated_at=now() WHERE reel_id=$1", [job.reel_id])
      console.info(JSON.stringify({ event: 'reel_job_done', job: job.reel_id, attempt: job.attempts }))
    } catch (error) {
      if (disconnected) throw error
      const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 500
      const permanent = [400, 404, 413, 415, 422].includes(status) || job.attempts >= jobSettings().maxAttempts
      await client.query(`UPDATE lifeos_reel_jobs SET state=$2, available_at=now()+($3 * interval '1 second'), updated_at=now() WHERE reel_id=$1`,
        [job.reel_id, permanent ? 'failed' : 'queued', retryDelaySeconds(job.attempts)])
      await client.query(`UPDATE lifeos_reels SET status='FAILED', error_message=$2, updated_at=now(), version=version+1 WHERE id=$1`,
        [job.reel_id, permanent ? 'Verarbeitung fehlgeschlagen. Bitte Quelle prüfen und erneut versuchen.' : 'Verarbeitung unterbrochen. Ein neuer Versuch ist eingeplant.'])
      await client.query("INSERT INTO lifeos_reel_audit(reel_id,room_id,actor,action,details) VALUES($1,$2,'worker',$3,$4::jsonb)", [job.reel_id,job.room_id,permanent ? 'job_failed' : 'job_retry',JSON.stringify({ attempt: job.attempts, status })])
      console.warn(JSON.stringify({ event: 'reel_job_error', job: job.reel_id, attempt: job.attempts, permanent, status }))
    }
    return true
  } finally {
    if (heartbeat) clearInterval(heartbeat)
    await client.query('ROLLBACK').catch(() => undefined)
    if (lockedId) await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [lockedId]).catch(onError)
    client.removeListener('error', onError)
    client.release(disconnected)
  }
}

export function startReelWorker(process: ReelProcessor): () => Promise<void> {
  if (!databaseConfigured() || processEnvDisabled()) return async () => undefined
  const id = randomUUID()
  let stopped = false
  const active = new Set<Promise<unknown>>()
  const tick = async () => {
    if (stopped) return
    try {
      await databaseQuery(`INSERT INTO lifeos_reel_workers(id) VALUES($1) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now()`, [id])
      await databaseQuery("DELETE FROM lifeos_reel_workers WHERE heartbeat_at < now() - interval '1 day'")
      while (active.size < jobSettings().concurrency) {
        const task = workOneReel(process).catch(() => console.warn(JSON.stringify({ event: 'reel_worker_connection_error' })))
        active.add(task)
        void task.finally(() => active.delete(task))
      }
    } catch { console.warn(JSON.stringify({ event: 'reel_worker_unavailable' })) }
  }
  const timer = setInterval(() => { void tick() }, 5000)
  void tick()
  return async () => {
    stopped = true
    clearInterval(timer)
    // Container termination can interrupt work; the durable row survives and is reclaimed.
    await Promise.race([Promise.allSettled([...active]), new Promise(resolve => setTimeout(resolve, 5000))])
    await databaseQuery('DELETE FROM lifeos_reel_workers WHERE id=$1', [id]).catch(() => undefined)
  }
}
function processEnvDisabled() { return process.env.REEL_WORKER_ENABLED === 'false' }
