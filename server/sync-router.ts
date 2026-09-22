import { applyHealthIngest } from './health-ingest-core.js'
import { applyInboundHook, resolveInboundHookType, type InboundHook } from './hook-core.js'
import { buildHealthStatus } from './health-status.js'
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
import { applyInboundConnectorWebhook, dispatchOutboundWebhook } from './lifeos-webhook-core.js'
import { runDecisionRequest } from './decision-core.js'
import { runTranscriptionRequest } from './transcription-core.js'
import { handleStorageRequest } from './storage-api.js'

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

    if (pathname.endsWith('/api/health/live') && (request.method === 'GET' || request.method === 'HEAD')) {
      return syncJson({ service: 'life-os', status: 'ok', ok: true })
    }

    if (pathname.endsWith('/api/health/ingest') && request.method === 'POST') {
      const body = await readSyncJson<unknown>(request)
      const result = await applyHealthIngest(request, body)
      return syncJson({ ok: true, ...result })
    }

    if (pathname.endsWith('/api/health') && (request.method === 'GET' || request.method === 'HEAD')) {
      const health = await buildHealthStatus()
      return syncJson(health, health.ok ? 200 : 503)
    }

    if (pathname.includes('/api/storage/')) {
      return await handleStorageRequest(request)
    }

    const webhookMatch = pathname.match(/\/api\/integrations\/webhooks\/([^/]+)$/)
    if (webhookMatch && request.method === 'POST') {
      const body = await readSyncJson<unknown>(request)
      return syncJson(await applyInboundConnectorWebhook({
        connector: decodeURIComponent(webhookMatch[1] ?? ''),
        request,
        body,
      }))
    }

    if (pathname.endsWith('/api/integrations/outbound') && request.method === 'POST') {
      const body = await readSyncJson<{
        roomId?: unknown
        deviceToken?: unknown
        url?: unknown
        event?: unknown
        payload?: Record<string, string>
      }>(request)
      return syncJson(await dispatchOutboundWebhook({
        roomId: String(body.roomId ?? request.headers.get('x-life-os-room') ?? ''),
        deviceToken: bearerToken(request) || String(body.deviceToken ?? ''),
        url: String(body.url ?? ''),
        event: String(body.event ?? ''),
        payload: body.payload ?? {},
      }))
    }

    if (pathname.endsWith('/api/transcribe') && (request.method === 'POST' || request.method === 'OPTIONS')) {
      return await runTranscriptionRequest(request)
    }

    if (pathname.endsWith('/api/decision') && request.method === 'POST') {
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
      return syncJson({ ok: true, batch })
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
        const authorization = request.headers.get('authorization') ?? ''
        return syncJson(await pullSyncSnapshot(
          request.headers.get('x-life-os-room') ?? url.searchParams.get('roomId') ?? '',
          authorization.toLowerCase().startsWith('bearer ')
            ? authorization.slice(7).trim()
            : request.headers.get('x-life-os-token') ?? url.searchParams.get('deviceToken') ?? '',
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
