import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { Pool } from 'pg'
import { closeDatabase, databaseQuery, ensureDatabaseSchema } from './database'
import { handleSyncRequest } from './sync-router'
import { workOneReel } from './reel-jobs'
import { runReelJob } from './reel-api'
import { publishReel } from './reel-publication'
import { pullSyncSnapshot, pushSyncSnapshot } from './sync-core'
import { analyzeReelTranscript, readOnScreenText } from './reel-analysis'
import { transcribeAudioBytes } from './transcription-core'
import { extractReelAudio } from './reel-media'

vi.mock('./object-storage', async importOriginal => ({
  ...await importOriginal<typeof import('./object-storage')>(),
  materializeStoredObject: vi.fn(async (key: string, path: string) => writeFile(path, key)),
}))
vi.mock('./reel-media', () => ({ extractReelAudio: vi.fn(async () => Buffer.from('audio')), extractReelFrames: vi.fn(async () => [Buffer.from('frame')]) }))
vi.mock('./transcription-core', async importOriginal => ({ ...await importOriginal<typeof import('./transcription-core')>(), transcribeAudioBytes: vi.fn(async () => ({ transcript: 'Original transcript', provider: 'mock', model: 'mock' })) }))
vi.mock('./reel-analysis', () => ({
  analyzeReelTranscript: vi.fn(async () => ({ title: 'Lernen', summary: 'Zusammenfassung', topics: ['Lernen'], lifeArea: 'growth', usefulnessScore: 80, riskLevel: 'low', claims: [{ text: 'Eine Aussage', type: 'general' }] })),
  readOnScreenText: vi.fn(async () => 'Bildschirmtext'),
  verifyClaims: vi.fn(async () => [{ status: 'UNVERIFIED', confidence: 0, evidence: [], note: 'Test' }]),
}))
vi.mock('./reel-jev', () => ({ triageReelWithJev: vi.fn(async () => ({ available: true, target: 'knowledge', risk: 'low', lifeArea: 'growth', relevance: 'useful' })) }))

// Explicit opt-in. A unique schema prevents touching other data in the test database.
const testUrl = process.env.TEST_DATABASE_URL
const schema = `reel_test_${randomUUID().replaceAll('-', '')}`
let admin: Pool
let room: string
let other: string
const token = 'test-device-token'
const savedUrl = process.env.DATABASE_URL
const savedBridge = process.env.SYNC_UPSTASH_BRIDGE

describe.skipIf(!testUrl)('Reel import with real PostgreSQL and mocked providers', () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl })
    await admin.query(`CREATE SCHEMA ${schema}`)
    const url = new URL(testUrl!)
    url.searchParams.set('options', `-c search_path=${schema}`)
    process.env.DATABASE_URL = url.toString()
    process.env.SYNC_UPSTASH_BRIDGE = 'false'
    process.env.REEL_DAILY_LIMIT = '1000'
    await ensureDatabaseSchema()
  })
  beforeEach(async () => {
    vi.clearAllMocks()
    await databaseQuery('TRUNCATE lifeos_sync_rooms CASCADE')
    room = randomUUID(); other = randomUUID()
    for (const id of [room, other]) await databaseQuery(`INSERT INTO lifeos_sync_rooms(room_id,device_tokens,created_at,updated_at) VALUES($1,$2,now(),now())`, [id, [token]])
  })
  afterAll(async () => {
    await closeDatabase()
    await admin.query(`DROP SCHEMA ${schema} CASCADE`)
    await admin.end()
    if (savedUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = savedUrl
    if (savedBridge === undefined) delete process.env.SYNC_UPSTASH_BRIDGE; else process.env.SYNC_UPSTASH_BRIDGE = savedBridge
    delete process.env.REEL_DAILY_LIMIT
  })
  async function request(path: string, body?: unknown, owner = room, device = token) {
    return handleSyncRequest(new Request(`https://lifeos.test/api/reels${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${device}`, 'x-life-os-room': owner, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }))
  }
  async function object(status = 'ready') {
    const id = randomUUID()
    await databaseQuery(`INSERT INTO lifeos_objects(id,room_id,category,storage_key,original_name,content_type,size_bytes,status) VALUES($1,$2,'media',$3,'iphone.mov','video/quicktime',10,$4)`, [id, room, `media/${room}/${id}`, status])
    return id
  }
  async function register(objectId = '') {
    const response = await request('/register', { objectId: objectId || await object(), lifeAreas: ['growth'] })
    expect(response.status).toBe(200)
    return (await response.json()).reel
  }
  async function ready() {
    const reel = await register()
    await workOneReel(runReelJob)
    return (await (await request(`/${reel.id}`)).json()).reel
  }
  async function approve(reel: { id: string; version: number }) {
    const response = await request(`/${reel.id}/review`, { action: 'approve_candidate', version: reel.version, title: 'Lernen', summary: 'Mein Entwurf', suggestedTarget: 'knowledge', lifeArea: 'growth', topics: ['Lernen'] })
    expect(response.status).toBe(200)
    return (await response.json()).reel
  }
  it('registers once under simultaneous retry and schedules exactly one durable job', async () => {
    const id = await object()
    const results = await Promise.all([register(id), register(id)])
    expect(results[0].id).toBe(results[1].id)
    expect((await databaseQuery('SELECT * FROM lifeos_reel_jobs')).rowCount).toBe(1)
  })
  it('rejects incomplete uploads and cross-room access', async () => {
    const id = await object('pending')
    expect((await request('/register', { objectId: id })).status).toBe(409)
    expect((await request('/register', { objectId: id }, other)).status).toBe(409)
    expect((await request('', undefined, room, 'wrong')).status).toBe(403)
    const reel = await register()
    expect((await request(`/${reel.id}`, undefined, other)).status).toBe(404)
    expect((await (await request('', undefined, other)).json()).reels).toHaveLength(0)
  })
  it('processes independently of a browser connection and retains transcript and OCR', async () => {
    const reel = await ready()
    expect(reel.status).toBe('REVIEW_READY')
    expect(reel.transcript).toBe('Original transcript')
    expect(reel.onScreenText).toBe('Bildschirmtext')
  })
  it('supports speech-free media through the existing OCR fallback', async () => {
    vi.mocked(extractReelAudio).mockRejectedValueOnce(new Error('No audio'))
    const reel = await ready()
    expect(reel.status).toBe('REVIEW_READY')
    expect(reel.transcript).toBe('')
    expect(readOnScreenText).toHaveBeenCalledOnce()
  })
  it('reuses extraction after a provider failure and retries with backoff', async () => {
    vi.mocked(analyzeReelTranscript).mockRejectedValueOnce(new Error('Temporary provider failure'))
    const reel = await register()
    await workOneReel(runReelJob)
    const job = (await databaseQuery('SELECT * FROM lifeos_reel_jobs')).rows[0]
    expect(job.state).toBe('queued'); expect(job.attempts).toBe(1)
    expect(await workOneReel(runReelJob)).toBe(false)
    await databaseQuery('UPDATE lifeos_reel_jobs SET available_at=now()')
    await workOneReel(runReelJob)
    expect(transcribeAudioBytes).toHaveBeenCalledOnce()
    expect((await (await request(`/${reel.id}`)).json()).reel.status).toBe('REVIEW_READY')
  })
  it('does not steal an active job even with a stale heartbeat', async () => {
    await register()
    let release!: () => void
    let started!: () => void
    const gate = new Promise<void>(r => { release = r })
    const entered = new Promise<void>(r => { started = r })
    const worker = workOneReel(async () => { started(); await gate })
    await entered
    await databaseQuery("UPDATE lifeos_reel_jobs SET heartbeat_at=now()-interval '5 minutes'")
    expect(await workOneReel(runReelJob)).toBe(false)
    release(); await worker
  })
  it('recovers a committed running job after worker disappearance and caps exhausted attempts', async () => {
    await register()
    await databaseQuery("UPDATE lifeos_reel_jobs SET state='running',attempts=1,heartbeat_at=now()-interval '5 minutes'")
    await workOneReel(runReelJob)
    expect((await databaseQuery('SELECT state,attempts FROM lifeos_reel_jobs')).rows[0]).toMatchObject({ state: 'done', attempts: 2 })
    await register()
    await databaseQuery("UPDATE lifeos_reel_jobs SET state='running',attempts=3,heartbeat_at=now()-interval '5 minutes' WHERE state='queued'")
    await workOneReel(runReelJob)
    expect((await databaseQuery("SELECT * FROM lifeos_reel_jobs WHERE state='failed'")).rowCount).toBe(1)
  })
  it('publishes idempotently into canonical Knowledge with device merge and deletion protection', async () => {
    const reel = await approve(await ready())
    const publications = await Promise.all([publishReel(room, reel.id, reel.version), publishReel(room, reel.id, reel.version)])
    expect(publications[0]).toEqual(publications[1])
    const pulled = await pullSyncSnapshot(room, token)
    const lifeOs = pulled.snapshot!.lifeOs as { knowledge: Array<{ id: string; title: string; updatedAt: string }> }
    expect(lifeOs.knowledge).toHaveLength(1)
    const edited = { ...lifeOs.knowledge[0], title: 'Meine Änderung', updatedAt: '2099-01-01T00:00:00.000Z' }
    await pushSyncSnapshot({ roomId: room, deviceToken: token, snapshot: { revision: 1, updatedAt: '', entries: [], lifeOs: { knowledge: [edited] } } })
    await publishReel(room, reel.id, reel.version)
    expect(((await pullSyncSnapshot(room, token)).snapshot!.lifeOs as typeof lifeOs).knowledge[0].title).toBe('Meine Änderung')
    await pushSyncSnapshot({ roomId: room, deviceToken: token, snapshot: { revision: 2, updatedAt: '', entries: [], lifeOs: { knowledge: [], deletedKnowledgeIds: [edited.id] } } })
    expect(((await pullSyncSnapshot(room, token)).snapshot!.lifeOs as typeof lifeOs).knowledge).toHaveLength(0)
    expect((await pullSyncSnapshot(other, token)).snapshot).toBeNull()
  })
  it('blocks evidence-free high-risk approval and excludes high-risk entries from bulk publish', async () => {
    const reel = await ready()
    await databaseQuery("UPDATE lifeos_reels SET risk_level='high' WHERE id=$1", [reel.id])
    const response = await request('/batch', { action: 'publish', items: [{ id: reel.id, version: reel.version }] })
    expect((await response.json()).results[0].error).toBeTruthy()
    expect((await request(`/${reel.id}/review`, { action: 'approve_candidate', version: reel.version, suggestedTarget: 'knowledge' })).status).toBe(409)
    expect((await databaseQuery('SELECT * FROM lifeos_reel_publications')).rowCount).toBe(0)
  })
  it('reports partial batch failures individually', async () => {
    const good = await ready()
    const response = await request('/batch', { action: 'publish', items: [{ id: good.id, version: good.version }, { id: randomUUID(), version: 1 }] })
    const results = (await response.json()).results
    expect(results[0].publication.knowledge.id).toBe(`reel:${good.id}`)
    expect(results[1].error).toBeTruthy()
  })
  it('restores a 300-item import without loading video payloads into sync', async () => {
    for (let i = 0; i < 300; i++) await register()
    const response = await request('?limit=300')
    expect((await response.json()).reels).toHaveLength(300)
    expect((await databaseQuery('SELECT * FROM lifeos_reel_jobs')).rowCount).toBe(300)
  }, 30_000)
})
