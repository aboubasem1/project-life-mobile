import { pullSyncSnapshot, refreshPairCode, readSyncJson, syncError, syncJson } from '../../server/sync-core.js'

export const config = {
  maxDuration: 15,
}

async function handle(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') return syncJson({ ok: true })

    if (request.method === 'GET') {
      const url = new URL(request.url)
      const authorization = request.headers.get('authorization') ?? ''
      const roomId = request.headers.get('x-life-os-room') ?? url.searchParams.get('roomId') ?? ''
      const deviceToken = authorization.toLowerCase().startsWith('bearer ')
        ? authorization.slice(7).trim()
        : request.headers.get('x-life-os-token') ?? url.searchParams.get('deviceToken') ?? ''
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

export default { fetch: handle }
