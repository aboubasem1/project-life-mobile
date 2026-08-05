import {
  createSyncRoom,
  joinSyncRoom,
  pullSyncSnapshot,
  pushSyncSnapshot,
  readSyncJson,
  refreshPairCode,
  syncError,
  syncJson,
} from './sync-core'
import type { SyncSnapshot } from './sync-store'

/** Unified router for Vite middleware + optional single-endpoint use. */
export async function handleSyncRequest(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') return syncJson({ ok: true })

    const url = new URL(request.url)
    const pathname = url.pathname.replace(/\/$/, '')

    if (pathname.endsWith('/api/sync/create') && request.method === 'POST') {
      return syncJson(await createSyncRoom())
    }

    if (pathname.endsWith('/api/sync/join') && request.method === 'POST') {
      const body = await readSyncJson<{ pairCode?: unknown }>(request)
      return syncJson(await joinSyncRoom(String(body.pairCode ?? '')))
    }

    if (pathname.endsWith('/api/sync/push') && request.method === 'POST') {
      const body = await readSyncJson<{
        roomId?: unknown
        deviceToken?: unknown
        snapshot?: SyncSnapshot
      }>(request)
      return syncJson(await pushSyncSnapshot({
        roomId: String(body.roomId ?? ''),
        deviceToken: String(body.deviceToken ?? ''),
        snapshot: body.snapshot as SyncSnapshot,
      }))
    }

    if (pathname.endsWith('/api/sync/pull')) {
      if (request.method === 'GET') {
        return syncJson(await pullSyncSnapshot(
          url.searchParams.get('roomId') ?? '',
          url.searchParams.get('deviceToken') ?? '',
        ))
      }
      if (request.method === 'POST') {
        const body = await readSyncJson<{ roomId?: unknown; deviceToken?: unknown; action?: unknown }>(request)
        if (String(body.action ?? '') === 'refresh-code') {
          return syncJson(await refreshPairCode(String(body.roomId ?? ''), String(body.deviceToken ?? '')))
        }
        return syncJson({ error: 'Unbekannte Aktion.' }, 400)
      }
    }

    return syncJson({ error: 'Not found' }, 404)
  } catch (error) {
    return syncError(error)
  }
}
