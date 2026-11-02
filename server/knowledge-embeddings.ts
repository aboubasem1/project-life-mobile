import { createHash, randomUUID } from 'node:crypto'
import { databaseConfigured, databaseQuery } from './database.js'
import { BudgetPausedError, deepinfraConfig, deepinfraEmbeddings } from './ai-provider.js'
import { SyncHttpError } from './http-error.js'

function enabled(): boolean {
  const flag = process.env.AI_EMBEDDINGS_ENABLED?.trim().toLowerCase()
  return flag === '1' || flag === 'true' || flag === 'on' || flag === 'yes'
}

function chunkText(body: string): string[] {
  const normalized = body.replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  const chunks: string[] = []
  const size = 700
  for (let i = 0; i < normalized.length; i += size) {
    chunks.push(normalized.slice(i, i + size))
    if (chunks.length >= 12) break
  }
  return chunks
}

function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32)
}

/** Embed new/changed knowledge chunks via DeepInfra bge-m3 into Postgres JSONB (no separate vector DB). */
export async function upsertKnowledgeEmbeddings(input: {
  roomId: string
  knowledgeId: string
  title: string
  body: string
  startMs?: number | null
  endMs?: number | null
}): Promise<{ embedded: number; skipped: boolean; reason?: string }> {
  if (!enabled()) return { embedded: 0, skipped: true, reason: 'disabled' }
  if (!databaseConfigured()) return { embedded: 0, skipped: true, reason: 'no_database' }
  const config = deepinfraConfig()
  if (!config.enabled) return { embedded: 0, skipped: true, reason: 'deepinfra_unavailable' }

  const chunks = chunkText([input.title, input.body].filter(Boolean).join('\n'))
  if (!chunks.length) return { embedded: 0, skipped: true, reason: 'empty' }

  const existing = await databaseQuery<{ chunk_index: number; content_hash: string }>(`
    SELECT chunk_index, content_hash FROM lifeos_knowledge_chunks
    WHERE room_id = $1 AND knowledge_id = $2
  `, [input.roomId, input.knowledgeId])
  const byIndex = new Map(existing.rows.map(row => [row.chunk_index, row.content_hash]))
  const pending: Array<{ index: number; text: string; hash: string }> = []
  chunks.forEach((text, index) => {
    const hash = contentHash(text)
    if (byIndex.get(index) === hash) return
    pending.push({ index, text, hash })
  })
  if (!pending.length) return { embedded: 0, skipped: true, reason: 'unchanged' }

  try {
    const result = await deepinfraEmbeddings({
      texts: pending.map(item => item.text),
      ctx: {
        roomId: input.roomId,
        step: 'embedding',
        kind: 'enrichment',
      },
    })
    for (let i = 0; i < pending.length; i += 1) {
      const item = pending[i]
      const vector = result.vectors[i]
      await databaseQuery(`
        INSERT INTO lifeos_knowledge_chunks (
          id, room_id, knowledge_id, chunk_index, text, source_kind, start_ms, end_ms,
          embedding_model, embedding_version, embedding, content_hash, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,'body',$6,$7,$8,$9,$10::jsonb,$11,now()
        )
        ON CONFLICT (room_id, knowledge_id, chunk_index) DO UPDATE SET
          text = EXCLUDED.text,
          embedding_model = EXCLUDED.embedding_model,
          embedding_version = EXCLUDED.embedding_version,
          embedding = EXCLUDED.embedding,
          content_hash = EXCLUDED.content_hash,
          start_ms = EXCLUDED.start_ms,
          end_ms = EXCLUDED.end_ms,
          updated_at = now()
      `, [
        randomUUID(),
        input.roomId,
        input.knowledgeId,
        item.index,
        item.text,
        input.startMs ?? null,
        input.endMs ?? null,
        result.model,
        'bge-m3-v1',
        JSON.stringify(vector),
        item.hash,
      ])
    }
    return { embedded: pending.length, skipped: false }
  } catch (error) {
    if (error instanceof BudgetPausedError) return { embedded: 0, skipped: true, reason: 'budget_paused' }
    if (error instanceof SyncHttpError) return { embedded: 0, skipped: true, reason: error.message.slice(0, 120) }
    return { embedded: 0, skipped: true, reason: 'embed_failed' }
  }
}
