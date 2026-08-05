import { pullSyncSnapshot, refreshPairCode, readSyncJson, syncError, syncJson } from '../../server/sync-core'

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') return syncJson({ ok: true })

    if (request.method === 'GET') {
      const url = new URL(request.url)
      const roomId = url.searchParams.get('roomId') ?? ''
      const deviceToken = url.searchParams.get('deviceToken') ?? ''
      const result = await pullSyncSnapshot(roomId, deviceToken)
      return syncJson(result)
    }

    if (request.method === 'POST') {
      // refresh pair code for inviting another device
      const body = await readSyncJson<{ roomId?: unknown; deviceToken?: unknown; action?: unknown }>(request)
      if (String(body.action ?? '') === 'refresh-code') {
        const result = await refreshPairCode(String(body.roomId ?? ''), String(body.deviceToken ?? ''))
        return syncJson(result)
      }
      return syncJson({ error: 'Unbekannte Aktion.' }, 400)
    }

    return syncJson({ error: 'Methode nicht erlaubt.' }, 405)
  } catch (error) {
    return syncError(error)
  }
}
