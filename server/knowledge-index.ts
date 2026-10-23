import { databaseConfigured, databaseQuery, databaseTransaction } from './database.js'
import { documentsFromLifeOs, planIndexUpdate, rankKnowledge, type KnowledgeDoc } from '../projectdashboardv1/src/lib/lifeos/knowledgeRank.js'

export type KnowledgeSearchHit = { id: string; title: string; score: number }

function bodyOf(doc: KnowledgeDoc): string {
  return [doc.title, doc.summary, doc.topics.join(' '), doc.content].join('\n').slice(0, 8000)
}

export async function reindexRoomKnowledge(roomId: string, lifeOs: unknown): Promise<void> {
  if (!roomId || !databaseConfigured()) return
  const next = documentsFromLifeOs(lifeOs)
  await databaseTransaction(async query => {
    const existing = await query<{ id: string; updated_at: string }>(`
      SELECT knowledge_id AS id, source_updated_at AS updated_at
      FROM lifeos_knowledge_documents
      WHERE room_id = $1
    `, [roomId])
    const plan = planIndexUpdate(existing.rows.map(row => ({ id: row.id, updatedAt: row.updated_at })), next)
    if (plan.remove.length > 0) {
      await query(`
        DELETE FROM lifeos_knowledge_documents
        WHERE room_id = $1 AND knowledge_id = ANY($2::text[])
      `, [roomId, plan.remove])
    }
    for (const doc of plan.upsert) {
      const body = bodyOf(doc)
      await query(`
        INSERT INTO lifeos_knowledge_documents (
          room_id, knowledge_id, title, body, topics, source_updated_at, search_vector
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, to_tsvector('simple', $7))
        ON CONFLICT (room_id, knowledge_id) DO UPDATE SET
          title = EXCLUDED.title,
          body = EXCLUDED.body,
          topics = EXCLUDED.topics,
          source_updated_at = EXCLUDED.source_updated_at,
          search_vector = EXCLUDED.search_vector
      `, [roomId, doc.id, doc.title.slice(0, 160), body, JSON.stringify(doc.topics), doc.updatedAt, body])
    }
  })
}

export async function searchRoomKnowledge(roomId: string, rawQuery: string): Promise<{
  mode: 'fulltext' | 'lexical'
  semantic: 'lexical'
  hits: KnowledgeSearchHit[]
}> {
  const queryText = rawQuery.trim().slice(0, 200)
  const semantic = 'lexical' as const
  if (!queryText || !databaseConfigured()) return { mode: 'fulltext', semantic, hits: [] }
  try {
    const fts = await databaseQuery<{ knowledge_id: string; title: string; score: string }>(`
      SELECT knowledge_id, title, ts_rank(search_vector, websearch_to_tsquery('simple', $2))::text AS score
      FROM lifeos_knowledge_documents
      WHERE room_id = $1 AND search_vector @@ websearch_to_tsquery('simple', $2)
      ORDER BY ts_rank(search_vector, websearch_to_tsquery('simple', $2)) DESC
      LIMIT 20
    `, [roomId, queryText])
    if (fts.rows.length > 0) {
      return {
        mode: 'fulltext',
        semantic,
        hits: fts.rows.map(row => ({ id: row.knowledge_id, title: row.title, score: Number(row.score) || 0 })),
      }
    }
  } catch {
    console.info(JSON.stringify({ scope: 'knowledge-search', event: 'fulltext_failed', roomId }))
  }
  const stored = await databaseQuery<{ knowledge_id: string; title: string; body: string; topics: unknown }>(`
    SELECT knowledge_id, title, body, topics
    FROM lifeos_knowledge_documents
    WHERE room_id = $1
    ORDER BY source_updated_at DESC
    LIMIT 300
  `, [roomId])
  const docs: KnowledgeDoc[] = stored.rows.map(row => ({
    id: row.knowledge_id,
    title: row.title,
    summary: '',
    content: row.body,
    topics: Array.isArray(row.topics) ? row.topics.map(String) : [],
    tags: [],
    source: '',
    updatedAt: '',
  }))
  const ranked = rankKnowledge(docs, queryText)
  const titles = new Map(docs.map(doc => [doc.id, doc.title]))
  return {
    mode: 'lexical',
    semantic,
    hits: ranked.map(hit => ({ id: hit.id, title: titles.get(hit.id) || hit.id, score: hit.score })),
  }
}
