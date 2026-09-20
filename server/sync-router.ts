import { applyHealthIngest } from './health-ingest-core.js'
import { applyInboundHook, resolveInboundHookType, type InboundHook } from './hook-core.js'
import { probeSyncStorage } from './sync-store.js'
import {
  createSyncRoom,
  joinSyncRoom,
  pullSyncSnapshot,
  pushSyncSnapshot,
  readSyncJson,
  refreshPairCode,
  syncError,
  syncJson,
} from './sync-core.js'
import { type SyncSnapshot } from './sync-store.js'

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

/** Unified router for Vite middleware + optional single-endpoint use. */
export async function handleSyncRequest(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') return syncJson({ ok: true })

    const url = new URL(request.url)
    const pathname = url.pathname.replace(/\/$/, '')

    if (pathname.endsWith('/api/health/ingest') && request.method === 'POST') {
      const body = await readSyncJson<unknown>(request)
      const result = await applyHealthIngest(request, body)
      return syncJson({ ok: true, ...result })
    }

    if (pathname.endsWith('/api/health') && (request.method === 'GET' || request.method === 'HEAD')) {
      const probe = await probeSyncStorage()
      return syncJson({
        service: 'life-os',
        ...probe,
      }, probe.ok ? 200 : 503)
    }

    if (pathname.endsWith('/api/hooks') && request.method === 'POST') {
      const body = await readSyncJson<Partial<InboundHook>>(request)
      const result = await applyInboundHook({
        roomId: String(body.roomId ?? ''),
        deviceToken: bearerToken(request) || String(body.deviceToken ?? ''),
        type: resolveInboundHookType(body),
        date: typeof body.date === 'string' ? body.date : undefined,
        text: typeof body.text === 'string' ? body.text : undefined,
        title: typeof body.title === 'string' ? body.title : undefined,
        proteinGrams: body.proteinGrams,
        calories: body.calories,
        waterLiters: body.waterLiters,
        steps: body.steps,
        weightKg: body.weightKg,
        energy: body.energy,
        habit: typeof body.habit === 'string' ? body.habit : undefined,
      })
      return syncJson({ ok: true, ...result })
    }

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
