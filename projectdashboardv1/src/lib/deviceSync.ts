/** Client helpers for one-time pairing + automatic device sync. */

import type { DashboardEntry } from '../types/DashboardEntry'
import {
  DASHBOARD_PLUS_KEY,
  ENTRIES_KEY,
  SETTINGS_KEY,
  loadAllEntries,
  saveAllEntries,
} from './storage'
import { loadXP, saveXP, type XPStore } from './xp-store'

const SYNC_CRED_KEY = 'life-os-v1-device-sync'
const QUICK_NOTE_KEY = 'life-os-quick-note'
const LOCAL_REVISION_KEY = 'life-os-v1-sync-revision'

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
  const response = await fetch(path, {
    ...init,
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
): DashboardEntry[] {
  const map = new Map<string, DashboardEntry>()
  for (const entry of local) {
    if (entry.date) map.set(entry.date, entry)
  }
  for (const entry of remote) {
    if (!entry.date) continue
    const current = map.get(entry.date)
    if (!current || entryUpdatedAt(entry) >= entryUpdatedAt(current)) {
      map.set(entry.date, entry)
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function buildLocalSnapshot(): DeviceSyncSnapshot {
  let settings: unknown
  let dashboardPlus: unknown
  let quickNote: unknown
  try {
    settings = JSON.parse(safeGet(SETTINGS_KEY) ?? 'null')
  } catch { settings = undefined }
  try {
    dashboardPlus = JSON.parse(safeGet(DASHBOARD_PLUS_KEY) ?? 'null')
  } catch { dashboardPlus = undefined }
  try {
    quickNote = JSON.parse(safeGet(QUICK_NOTE_KEY) ?? 'null')
  } catch { quickNote = undefined }

  const revision = Number(safeGet(LOCAL_REVISION_KEY) || 0) || 0
  return {
    revision,
    updatedAt: new Date().toISOString(),
    entries: loadAllEntries(),
    settings,
    dashboardPlus,
    xp: loadXP(),
    quickNote,
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
    safeSet(QUICK_NOTE_KEY, JSON.stringify(snapshot.quickNote))
  }
}

export async function pushDeviceSync(): Promise<{ revision: number; updatedAt: string } | null> {
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

export async function pullDeviceSync(): Promise<{
  changed: boolean
  revision: number
  entries: DashboardEntry[]
} | null> {
  const creds = loadSyncCredentials()
  if (!creds || !navigator.onLine) return null

  const result = await syncFetch<{ snapshot: DeviceSyncSnapshot | null }>(
    `/api/sync/pull?roomId=${encodeURIComponent(creds.roomId)}&deviceToken=${encodeURIComponent(creds.deviceToken)}`,
  )

  if (!result.snapshot) {
    const pushed = await pushDeviceSync()
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
  const mergedEntries = mergeEntriesByUpdatedAt(localBefore, remote.entries ?? [])

  saveAllEntries(mergedEntries)

  if (remoteRevision >= localRevision) {
    applyRemoteExtras(remote)
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

  if (localHadNewerEntry || localRevision > remoteRevision) {
    await pushDeviceSync()
  }

  return {
    changed: remoteRevision > localRevision || localHadNewerEntry,
    revision: Number(safeGet(LOCAL_REVISION_KEY) || nextRevision) || nextRevision,
    entries: loadAllEntries(),
  }
}

export { SYNC_CRED_KEY, QUICK_NOTE_KEY, ENTRIES_KEY }
