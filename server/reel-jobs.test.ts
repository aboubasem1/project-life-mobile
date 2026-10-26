import { describe, expect, it, vi } from 'vitest'
import { enqueueReelJobWithQuery } from './reel-jobs'

describe('durable Reel job enqueue', () => {
  it('reuses an existing open job idempotently', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [{
      id: 'job-1', reel_id: 'reel-1', room_id: 'room-1', status: 'queued',
      attempts: 0, max_attempts: 4, life_areas: [], run_after: new Date(), locked_at: null,
    }] })
    const result = await enqueueReelJobWithQuery(query, { reelId: 'reel-1', roomId: 'room-1' })
    expect(result).toMatchObject({ queued: true, jobId: 'job-1', state: 'queued' })
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('creates the job through the caller transaction query', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
    const result = await enqueueReelJobWithQuery(query, { reelId: 'reel-2', roomId: 'room-1', lifeAreas: ['health'] })
    expect(result).toMatchObject({ queued: true, deferred: false, state: 'queued' })
    expect(query).toHaveBeenCalledTimes(3)
    expect(String(query.mock.calls[2]?.[0])).toContain('INSERT INTO lifeos_reel_jobs')
  })
})
