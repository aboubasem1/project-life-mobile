import { createSyncRoom, syncError, syncJson } from '../../server/sync-core'

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') return syncJson({ ok: true })
    if (request.method !== 'POST') return syncJson({ error: 'Methode nicht erlaubt.' }, 405)
    const result = await createSyncRoom()
    return syncJson(result)
  } catch (error) {
    return syncError(error)
  }
}
