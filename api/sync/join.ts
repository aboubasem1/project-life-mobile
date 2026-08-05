import { joinSyncRoom, readSyncJson, syncError, syncJson } from '../../server/sync-core'

export const config = {
  maxDuration: 15,
}

async function handle(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') return syncJson({ ok: true })
    if (request.method !== 'POST') return syncJson({ error: 'Methode nicht erlaubt.' }, 405)
    const body = await readSyncJson<{ pairCode?: string }>(request)
    const result = await joinSyncRoom(String(body.pairCode ?? ''))
    return syncJson(result)
  } catch (error) {
    return syncError(error)
  }
}

export default { fetch: handle }
