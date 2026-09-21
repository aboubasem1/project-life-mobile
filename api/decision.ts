import { runDecisionRequest } from '../server/decision-core.js'
import { readSyncJson, syncError, syncJson } from '../server/sync-core.js'

export const config = {
  maxDuration: 15,
}

async function handle(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') return syncJson({ ok: true })
    if (request.method !== 'POST') return syncJson({ error: 'Methode nicht erlaubt.' }, 405)
    const body = await readSyncJson<{
      input?: unknown
      content?: unknown
      source?: unknown
      context?: Record<string, unknown>
      flags?: Record<string, unknown>
    }>(request)
    const batch = await runDecisionRequest({
      input: body.input,
      content: body.content,
      source: body.source,
      context: body.context,
      flags: body.flags,
    })
    return syncJson({
      ok: true,
      batch,
      flags: {
        jevEnabled: batch.provider === 'jev' || Boolean(body.flags),
      },
    })
  } catch (error) {
    return syncError(error)
  }
}

export default { fetch: handle }
