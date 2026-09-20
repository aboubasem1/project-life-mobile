/** Client helpers for one-time pairing + automatic device sync. */

import type { DashboardEntry } from '../types/DashboardEntry'
import {
  DASHBOARD_PLUS_KEY,
  ENTRIES_KEY,
  SETTINGS_KEY,
  loadAllEntries,
  saveAllEntries,
} from './storage'
import { loadXP, recomputeXPFromEntries, saveXP, type XPStore } from './xp-store'
import { calculateScore } from './score'
import {
  loadBodyMeasurements,
  mergeSavedBodyMeasurements,
  normalizeBodyMeasurements,
  type BodyMeasurement,
} from './bodyMeasurement'
import { mergeDayJournal, mergeQuickNoteStates, parseQuickNote } from './inboundNote'
import {
  DAILY_EVENTS_KEY,
  applyEventFieldsToEntry,
  loadDailyEvents,
  mergeDailyEvents,
  projectRitualDoneFromEvents,
  saveDailyEvents,
  type DailyEvent,
} from './dailyEvents'
import {
  MORNING_RITUAL_PROGRESS_KEY,
  mergeMorningRitualProgress,
  type MorningRitualProgress,
} from './morningGate'
import { loadLifeOsState, mergeLifeOsState, saveLifeOsState, type LifeOsState } from './lifeos'
import {
  PRIVATE_VAULT_KEY,
  mergePrivateVaultEnvelopes,
  type PrivateVaultEnvelope,
} from './privateVault'

const SYNC_CRED_KEY = 'life-os-v1-device-sync'
const QUICK_NOTE_KEY = 'life-os-quick-note'
const LOCAL_REVISION_KEY = 'life-os-v1-sync-revision'
export const LIFE_OS_SYNC_EXTRAS_EVENT = 'life-os-sync-extras'

let remoteApplyGeneration = 0
let syncChain: Promise<unknown> = Promise.resolve()

function enqueueSync<T>(fn: () => Promise<T>): Promise<T> {
  const run = syncChain.then(fn, fn)
  syncChain = run.then(() => undefined, () => undefined)
  return run
}

function notifySyncExtras(): void {
  remoteApplyGeneration += 1
  window.dispatchEvent(new CustomEvent(LIFE_OS_SYNC_EXTRAS_EVENT))
}

/** Bumps when a pull wrote settings/labor. Persist effects skip the echo-push. */
export function remoteApplyGenerationNow(): number {
  return remoteApplyGeneration
}

export type DeviceSyncCredentials = {
  roomId: string
  deviceToken: string
  pairedAt: string
  lastSyncedAt?: string
  lastRevision?: number
}

export type DeviceSyncSnapshot = {
  revision: number
  updatedAt: string
  entries: DashboardEntry[]
  settings?: unknown
  dashboardPlus?: unknown
  xp?: XPStore
  quickNote?: unknown
  bodyMeasurements?: BodyMeasurement[]
  healthIngest?: unknown
  morningRitualProgress?: MorningRitualProgress
  dailyEvents?: DailyEvent[]
  lifeOs?: LifeOsState
  privateVault?: PrivateVaultEnvelope
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch { /* ignore */ }
}

export function loadSyncCredentials(): DeviceSyncCredentials | null {
  try {
    const raw = JSON.parse(safeGet(SYNC_CRED_KEY) ?? 'null') as Partial<DeviceSyncCredentials> | null
    if (!raw?.roomId || !raw.deviceToken) return null
    return {
      roomId: String(raw.roomId),
      deviceToken: String(raw.deviceToken),
      pairedAt: typeof raw.pairedAt === 'string' ? raw.pairedAt : new Date().toISOString(),
      lastSyncedAt: typeof raw.lastSyncedAt === 'string' ? raw.lastSyncedAt : undefined,
      lastRevision: Number(raw.lastRevision) || undefined,
    }
  } catch {
    return null
  }
}

export function saveSyncCredentials(creds: DeviceSyncCredentials): void {
  safeSet(SYNC_CRED_KEY, JSON.stringify(creds))
}

export function clearSyncCredentials(): void {
  safeRemove(SYNC_CRED_KEY)
}

export function isDeviceSyncEnabled(): boolean {
  return Boolean(loadSyncCredentials())
}

async function syncFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
    const data = await response.json().catch(() => ({})) as T & { error?: string }
    if (!response.ok) {
      throw new Error(data.error || `Sync fehlgeschlagen (${response.status})`)
    }
    return data
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Sync-Server antwortet nicht (Timeout). Bitte später erneut versuchen.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function createDevicePairing(): Promise<{
  roomId: string
  pairCode: string
  deviceToken: string
  expiresAt: string
}> {
  const result = await syncFetch<{
    roomId: string
    pairCode: string
    deviceToken: string
    expiresAt: string
  }>('/api/sync/create', { method: 'POST', body: '{}' })

  saveSyncCredentials({
    roomId: result.roomId,
    deviceToken: result.deviceToken,
    pairedAt: new Date().toISOString(),
    lastRevision: 0,
  })
  return result
}

export async function joinDevicePairing(pairCode: string): Promise<DeviceSyncCredentials> {
  const result = await syncFetch<{ roomId: string; deviceToken: string }>('/api/sync/join', {
    method: 'POST',
    body: JSON.stringify({ pairCode }),
  })
  const creds: DeviceSyncCredentials = {
    roomId: result.roomId,
    deviceToken: result.deviceToken,
    pairedAt: new Date().toISOString(),
    lastRevision: 0,
  }
  saveSyncCredentials(creds)
  return creds
}

export async function refreshPairCode(): Promise<{ pairCode: string; expiresAt: string }> {
  const creds = loadSyncCredentials()
  if (!creds) throw new Error('Noch nicht gekoppelt.')
  return syncFetch('/api/sync/pull', {
    method: 'POST',
    body: JSON.stringify({
      action: 'refresh-code',
      roomId: creds.roomId,
      deviceToken: creds.deviceToken,
    }),
  })
}

function entryUpdatedAt(entry: DashboardEntry): number {
  const raw = entry.updatedAt
  if (!raw) return 0
  const time = Date.parse(raw)
  return Number.isFinite(time) ? time : 0
}

export function mergeEntriesByUpdatedAt(
  local: DashboardEntry[],
  remote: DashboardEntry[],
  events: DailyEvent[] = [],
): DashboardEntry[] {
  const map = new Map<string, DashboardEntry>()
  for (const entry of local) {
    if (entry.date) map.set(entry.date, entry)
  }
  for (const entry of remote) {
    if (!entry.date) continue
    const current = map.get(entry.date)
    if (!current) {
      map.set(entry.date, entry)
      continue
    }
    const newer = entryUpdatedAt(entry) >= entryUpdatedAt(current) ? entry : current
    const older = newer === entry ? current : entry
    map.set(entry.date, mergeDayJournal(newer, older))
  }
  return [...map.values()]
    .map(entry => applyEventFieldsToEntry(entry, events))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function buildLocalSnapshot(): DeviceSyncSnapshot {
  let settings: unknown
  let dashboardPlus: unknown
  let quickNote: unknown
  let privateVault: PrivateVaultEnvelope | undefined
  let morningRitualProgress: MorningRitualProgress | undefined
  try {
    settings = JSON.parse(safeGet(SETTINGS_KEY) ?? 'null')
  } catch { settings = undefined }
  try {
    dashboardPlus = JSON.parse(safeGet(DASHBOARD_PLUS_KEY) ?? 'null')
  } catch { dashboardPlus = undefined }
  try {
    quickNote = JSON.parse(safeGet(QUICK_NOTE_KEY) ?? 'null')
  } catch { quickNote = undefined }
  try {
    privateVault = mergePrivateVaultEnvelopes(
      undefined,
      JSON.parse(safeGet(PRIVATE_VAULT_KEY) ?? 'null'),
    ) ?? undefined
  } catch { privateVault = undefined }
  try {
    morningRitualProgress = mergeMorningRitualProgress(
      undefined,
      JSON.parse(safeGet(MORNING_RITUAL_PROGRESS_KEY) ?? 'null'),
    ) ?? undefined
  } catch { morningRitualProgress = undefined }

  const revision = Number(safeGet(LOCAL_REVISION_KEY) || 0) || 0
  return {
    revision,
    updatedAt: new Date().toISOString(),
    entries: loadAllEntries(),
    settings,
    dashboardPlus,
    xp: loadXP(),
    quickNote,
    bodyMeasurements: loadBodyMeasurements(),
    morningRitualProgress,
    dailyEvents: loadDailyEvents(),
    lifeOs: loadLifeOsState(),
    privateVault,
  }
}

function applyRemoteExtras(snapshot: DeviceSyncSnapshot): void {
  if (snapshot.settings != null) {
    safeSet(SETTINGS_KEY, JSON.stringify(snapshot.settings))
  }
  if (snapshot.dashboardPlus != null) {
    safeSet(DASHBOARD_PLUS_KEY, JSON.stringify(snapshot.dashboardPlus))
  }
  if (snapshot.xp) {
    saveXP({ ...loadXP(), ...snapshot.xp })
  }
  if (snapshot.quickNote != null) {
    let localNote: unknown = null
    try {
      localNote = JSON.parse(safeGet(QUICK_NOTE_KEY) ?? 'null')
    } catch {
      localNote = null
    }
    const merged = mergeQuickNoteStates(parseQuickNote(localNote), parseQuickNote(snapshot.quickNote))
    if (merged) safeSet(QUICK_NOTE_KEY, JSON.stringify(merged))
  }
  if (snapshot.morningRitualProgress != null) {
    let localProgress: unknown = null
    try {
      localProgress = JSON.parse(safeGet(MORNING_RITUAL_PROGRESS_KEY) ?? 'null')
    } catch {
      localProgress = null
    }
    const merged = mergeMorningRitualProgress(localProgress, snapshot.morningRitualProgress)
    if (merged) {
      const withEvents = {
        ...merged,
        done: projectRitualDoneFromEvents(
          merged.date,
          merged.done,
          mergeDailyEvents(loadDailyEvents(), snapshot.dailyEvents),
        ),
      }
      safeSet(MORNING_RITUAL_PROGRESS_KEY, JSON.stringify(withEvents))
    }
  }
  if (snapshot.dailyEvents != null) {
    saveDailyEvents(mergeDailyEvents(loadDailyEvents(), snapshot.dailyEvents))
  }
  if (snapshot.lifeOs != null) {
    saveLifeOsState(mergeLifeOsState(loadLifeOsState(), snapshot.lifeOs))
  }
  if (snapshot.privateVault != null) {
    let localVault: unknown = null
    try {
      localVault = JSON.parse(safeGet(PRIVATE_VAULT_KEY) ?? 'null')
    } catch {
      localVault = null
    }
    const merged = mergePrivateVaultEnvelopes(localVault, snapshot.privateVault)
    if (merged) safeSet(PRIVATE_VAULT_KEY, JSON.stringify(merged))
  }
  notifySyncExtras()
}

async function pushDeviceSyncUnlocked(): Promise<{ revision: number; updatedAt: string } | null> {
  const creds = loadSyncCredentials()
  if (!creds || !navigator.onLine) return null

  const snapshot = buildLocalSnapshot()
  const result = await syncFetch<{ revision: number; updatedAt: string }>('/api/sync/push', {
    method: 'POST',
    body: JSON.stringify({
      roomId: creds.roomId,
      deviceToken: creds.deviceToken,
      snapshot,
    }),
  })

  safeSet(LOCAL_REVISION_KEY, String(result.revision))
  saveSyncCredentials({
    ...creds,
    lastSyncedAt: result.updatedAt,
    lastRevision: result.revision,
  })
  return result
}

export async function pushDeviceSync(): Promise<{ revision: number; updatedAt: string } | null> {
  return enqueueSync(() => pushDeviceSyncUnlocked())
}

export async function pullDeviceSync(): Promise<{
  changed: boolean
  revision: number
  entries: DashboardEntry[]
} | null> {
  return enqueueSync(async () => {
    const creds = loadSyncCredentials()
    if (!creds || !navigator.onLine) return null

    const result = await syncFetch<{ snapshot: DeviceSyncSnapshot | null }>(
      `/api/sync/pull?roomId=${encodeURIComponent(creds.roomId)}&deviceToken=${encodeURIComponent(creds.deviceToken)}`,
    )

    if (!result.snapshot) {
      const pushed = await pushDeviceSyncUnlocked()
      return {
        changed: false,
        revision: pushed?.revision ?? 0,
        entries: loadAllEntries(),
      }
    }

    const localBefore = loadAllEntries()
    const remote = result.snapshot
    const localRevision = Number(safeGet(LOCAL_REVISION_KEY) || 0) || 0
    const remoteRevision = remote.revision ?? 0
    const mergedEvents = mergeDailyEvents(loadDailyEvents(), remote.dailyEvents)
    saveDailyEvents(mergedEvents)
    const mergedEntries = mergeEntriesByUpdatedAt(
      localBefore,
      remote.entries ?? [],
      mergedEvents,
    )

    const remoteMeasurements = normalizeBodyMeasurements(remote.bodyMeasurements)
    if (remoteMeasurements.length > 0) {
      mergeSavedBodyMeasurements(remoteMeasurements)
      notifySyncExtras()
    }

    if (remoteRevision >= localRevision) {
      applyRemoteExtras(remote)
    }

    const rescoredEntries = mergedEntries.map(entry => ({
      ...entry,
      dailyScore: calculateScore(entry),
    }))
    const scoreChanged = rescoredEntries.some((entry, index) => (
      entry.dailyScore !== mergedEntries[index]?.dailyScore
    ))
    saveAllEntries(rescoredEntries)
    if (remoteRevision > localRevision || scoreChanged) {
      recomputeXPFromEntries(rescoredEntries)
    }

    const localHadNewerEntry = localBefore.some(entry => {
      const remoteEntry = (remote.entries ?? []).find(item => item.date === entry.date)
      return !remoteEntry || entryUpdatedAt(entry) > entryUpdatedAt(remoteEntry)
    })

    const nextRevision = Math.max(localRevision, remoteRevision)
    safeSet(LOCAL_REVISION_KEY, String(nextRevision))
    saveSyncCredentials({
      ...creds,
      lastSyncedAt: new Date().toISOString(),
      lastRevision: nextRevision,
    })

    if (localHadNewerEntry || localRevision > remoteRevision || scoreChanged) {
      await pushDeviceSyncUnlocked()
    }

    return {
      changed: remoteRevision > localRevision || localHadNewerEntry,
      revision: Number(safeGet(LOCAL_REVISION_KEY) || nextRevision) || nextRevision,
      entries: loadAllEntries(),
    }
  })
}

export { SYNC_CRED_KEY, QUICK_NOTE_KEY, ENTRIES_KEY, DAILY_EVENTS_KEY, PRIVATE_VAULT_KEY }
