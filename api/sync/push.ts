import { pushSyncSnapshot, readSyncJson, syncError, syncJson } from '../../server/sync-core'
import type { SyncSnapshot } from '../../server/sync-store'

export const config = {
  maxDuration: 15,
}

async function handle(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') return syncJson({ ok: true })
    if (request.method !== 'POST') return syncJson({ error: 'Methode nicht erlaubt.' }, 405)
    const body = await readSyncJson<{
      roomId?: unknown
      deviceToken?: unknown
      snapshot?: SyncSnapshot
    }>(request)
    const result = await pushSyncSnapshot({
      roomId: String(body.roomId ?? ''),
      deviceToken: String(body.deviceToken ?? ''),
      snapshot: body.snapshot as SyncSnapshot,
    })
    return syncJson(result)
  } catch (error) {
    return syncError(error)
  }
}

export default { fetch: handle }
