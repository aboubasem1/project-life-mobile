/** Server-safe Life OS snapshot merge. Avoid importing the client store into Vercel functions. */

export function mergeLifeOsSnapshots(local: unknown, remote: unknown): unknown {
  if (remote == null) return local
  if (local == null) return remote
  if (!isRecord(local) || !isRecord(remote)) return remote

  const pick = (key: string): unknown[] => {
    const left = Array.isArray(local[key]) ? local[key] : []
    const right = Array.isArray(remote[key]) ? remote[key] : []
    return mergeById(left, right)
  }

  return {
    ...local,
    ...remote,
    version: typeof remote.version === 'number' ? remote.version : local.version,
    captures: pick('captures'),
    knowledge: pick('knowledge'),
    decisions: pick('decisions'),
    signals: pick('signals'),
    reviews: pick('reviews'),
    insights: pick('insights'),
    relations: pick('relations'),
    activities: pick('activities'),
    events: pick('events'),
    connectors: pick('connectors'),
    outboundWebhooks: pick('outboundWebhooks'),
    webhookLogs: pick('webhookLogs'),
    areaIntentions: {
      ...(isRecord(local.areaIntentions) ? local.areaIntentions : {}),
      ...(isRecord(remote.areaIntentions) ? remote.areaIntentions : {}),
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function mergeById(local: unknown[], remote: unknown[]): unknown[] {
  const map = new Map<string, unknown>()
  for (const item of [...local, ...remote]) {
    if (!isRecord(item) || typeof item.id !== 'string') continue
    const current = map.get(item.id)
    if (!current || later(item, current)) map.set(item.id, item)
  }
  return [...map.values()]
}

function later(next: Record<string, unknown>, current: unknown): boolean {
  if (!isRecord(current)) return true
  const nextAt = String(next.updatedAt ?? next.createdAt ?? '')
  const currentAt = String(current.updatedAt ?? current.createdAt ?? '')
  return nextAt >= currentAt
}
