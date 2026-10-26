import { databaseConfigured, databasePool, databaseQuery, ensureDatabaseSchema } from './database.js'
import { SyncHttpError } from './sync-core.js'
import type { KnowledgeItem, DomainEvent } from '../projectdashboardv1/src/lib/lifeos/types.js'
import { parseLifeArea } from '../projectdashboardv1/src/lib/lifeos/areas.js'

type Publication = { knowledge: KnowledgeItem; event: DomainEvent; version: 1 }

export async function publishReel(roomId: string, reelId: string, version: number): Promise<Publication> {
  await ensureDatabaseSchema()
  const client = await databasePool().connect()
  try {
    await client.query('BEGIN')
    const result = await client.query('SELECT * FROM lifeos_reels WHERE id=$1 AND room_id=$2 FOR UPDATE', [reelId, roomId])
    const reel = result.rows[0]
    if (!reel) throw new SyncHttpError(404, 'Reel nicht gefunden.')
    const existing = await client.query<{ payload: Publication }>('SELECT payload FROM lifeos_reel_publications WHERE reel_id=$1 AND room_id=$2', [reelId, roomId])
    if (existing.rows[0]) { await client.query('COMMIT'); return existing.rows[0].payload }
    if (reel.status !== 'APPROVED_CANDIDATE' || reel.version !== version) throw new SyncHttpError(409, 'Bitte aktuellen Entwurf prüfen und freigeben.')
    if (!['knowledge', 'guideline'].includes(reel.suggested_target)) throw new SyncHttpError(409, 'Diese Quelle ist nicht zur Übernahme freigegeben.')
    const claims = await client.query('SELECT * FROM lifeos_reel_claims WHERE reel_id=$1', [reelId])
    const highRisk = reel.risk_level === 'high' || reel.suggested_target === 'guideline'
      || claims.rows.some(c => c.claim_type !== 'general')
    if (highRisk && (!claims.rows.length || claims.rows.some(c => c.verification_status !== 'SUPPORTED' || !Array.isArray(c.evidence) || !c.evidence.some((e: { url?: string }) => /^https:\/\//.test(e.url || ''))))) {
      throw new SyncHttpError(409, 'Für diese Inhalte fehlen belegte Aussagen. Als Quelle behalten oder Belege prüfen.')
    }
    const now = new Date().toISOString()
    const id = `reel:${reelId}`
    const evidence = claims.rows.length && claims.rows.every(c => c.verification_status === 'SUPPORTED') ? 'supported' : 'unverified'
    const knowledge: KnowledgeItem = {
      id, title: reel.title || 'Reel', summary: reel.summary, content: reel.summary,
      source: 'Importiertes Reel – Aussagen der Originalquelle', type: 'video',
      topics: reel.topics, tags: ['reel', evidence === 'supported' ? 'belegt' : 'ungeprüfte-aussagen'],
      lifeArea: parseLifeArea(reel.life_area), createdAt: now, updatedAt: now,
      reelSource: { reelId, objectId: reel.object_id, version: reel.version, evidence, risk: reel.risk_level },
    }
    const payload: Publication = { version: 1, knowledge, event: {
      id: `reel-published:${reelId}`, type: 'knowledge.created', entityKind: 'knowledge', entityId: id,
      createdAt: now, payload: { title: knowledge.title, sourceReelId: reelId },
    } }
    await client.query(`INSERT INTO lifeos_reel_publications(reel_id,room_id,knowledge_id,reel_version,payload)
      VALUES($1,$2,$3,$4,$5::jsonb)`, [reelId, roomId, id, version, JSON.stringify(payload)])
    await client.query("INSERT INTO lifeos_reel_audit(reel_id,room_id,actor,action,details) VALUES($1,$2,'authenticated_device','published',$3::jsonb)", [reelId, roomId, JSON.stringify({ knowledgeId: id, version })])
    await client.query('UPDATE lifeos_reels SET version=version+1, updated_at=now() WHERE id=$1', [reelId])
    await client.query('COMMIT')
    return payload
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

/** Immutable delivery record, not a second editable Knowledge collection. Existing
 * canonical objects always win, including edits with an older client clock. */
export function applyPublications(raw: unknown, publications: Publication[]): Record<string, unknown> {
  const state = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const knowledge = Array.isArray(state.knowledge) ? [...state.knowledge] : []
  const events = Array.isArray(state.events) ? [...state.events] : []
  const deleted = new Set(Array.isArray(state.deletedKnowledgeIds) ? state.deletedKnowledgeIds : [])
  for (const publication of publications) {
    if (!deleted.has(publication.knowledge.id) && !knowledge.some(k => k?.id === publication.knowledge.id)) knowledge.push(publication.knowledge)
    if (!events.some(e => e?.id === publication.event.id)) events.push(publication.event)
  }
  return { ...state, knowledge: knowledge.filter(k => !deleted.has(k.id)), events }
}

export async function deliverReelPublications(roomId: string, raw: unknown): Promise<unknown> {
  if (!databaseConfigured()) return raw
  const result = await databaseQuery<{ payload: Publication }>('SELECT payload FROM lifeos_reel_publications WHERE room_id=$1 ORDER BY created_at', [roomId])
  return result.rows.length ? applyPublications(raw, result.rows.map(r => r.payload)) : raw
}
