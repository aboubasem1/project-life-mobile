import { applyInboundHook, type InboundHook } from '../server/hook-core'
import { readSyncJson, syncError, syncJson } from '../server/sync-core'

export const config = {
  maxDuration: 15,
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

async function handle(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') return syncJson({ ok: true })
    if (request.method !== 'POST') return syncJson({ error: 'Methode nicht erlaubt.' }, 405)

    const body = await readSyncJson<Partial<InboundHook> & { roomId?: unknown; deviceToken?: unknown }>(request)
    const result = await applyInboundHook({
      roomId: String(body.roomId ?? ''),
      deviceToken: bearerToken(request) || String(body.deviceToken ?? ''),
      type: (body.type ?? 'log') as InboundHook['type'],
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
  } catch (error) {
    return syncError(error)
  }
}

export default { fetch: handle }
