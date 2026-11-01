/** User-visible sync payload, without revision clocks or derived scores. */

export type SyncContentSnapshot = {
  entries?: unknown
  settings?: unknown
  dashboardPlus?: unknown
  quickNote?: unknown
  bodyMeasurements?: unknown
  morningRitualProgress?: unknown
  dailyEvents?: unknown
  lifeOs?: unknown
  privateVault?: unknown
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).filter(key => record[key] !== undefined).sort()
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

function sortRecords(raw: unknown, key: string): unknown[] {
  if (!Array.isArray(raw)) return []
  return [...raw].sort((left, right) => {
    const a = left && typeof left === 'object' ? String((left as Record<string, unknown>)[key] ?? '') : ''
    const b = right && typeof right === 'object' ? String((right as Record<string, unknown>)[key] ?? '') : ''
    return a.localeCompare(b)
  })
}

function userEntries(raw: unknown): unknown[] {
  return sortRecords(raw, 'date').map(item => {
    if (!item || typeof item !== 'object') return item
    const next = { ...(item as Record<string, unknown>) }
    delete next.dailyScore
    return next
  })
}

/** Identity of a snapshot ignoring revision, snapshot time, XP, and dailyScore. */
export function syncUserContentKey(snapshot: SyncContentSnapshot | null | undefined): string {
  if (!snapshot) return stableStringify(null)
  return stableStringify({
    entries: userEntries(snapshot.entries),
    settings: snapshot.settings ?? null,
    dashboardPlus: snapshot.dashboardPlus ?? null,
    quickNote: snapshot.quickNote ?? null,
    bodyMeasurements: sortRecords(snapshot.bodyMeasurements, 'externalId'),
    morningRitualProgress: snapshot.morningRitualProgress ?? null,
    dailyEvents: sortRecords(snapshot.dailyEvents, 'id'),
    lifeOs: snapshot.lifeOs ?? null,
    privateVault: snapshot.privateVault ?? null,
  })
}

/**
 * Push only for user content the server has not already acknowledged.
 * An echoed pull (new revision, same fields, rescored dailyScore) must not push.
 */
export function shouldPushSyncSnapshot(input: {
  localKey: string
  remoteKey: string | null
  acknowledgedKey: string | null
}): boolean {
  if (input.acknowledgedKey && input.localKey === input.acknowledgedKey) return false
  if (input.remoteKey && input.localKey === input.remoteKey) return false
  return true
}
