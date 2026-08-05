import { useState, useCallback, useEffect, useRef } from 'react'
import type { DashboardEntry } from '../types/DashboardEntry'
import { ENTRIES_KEY, loadAllEntries, upsertEntry } from '../lib/storage'
import { calculateScore } from '../lib/score'
import { awardDailyXP } from '../lib/xp-store'
import {
  isDeviceSyncEnabled,
  pullDeviceSync,
  pushDeviceSync,
} from '../lib/deviceSync'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

export interface UseEntriesReturn {
  entries: DashboardEntry[]
  syncStatus: SyncStatus
  isOnline: boolean
  /** Returns false when localStorage write failed. */
  saveEntry: (entry: DashboardEntry) => Promise<boolean>
  reloadAll: () => Promise<void>
  syncNow: () => Promise<void>
}

function todayKeyLocal(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function useEntries(): UseEntriesReturn {
  const [entries, setEntries] = useState<DashboardEntry[]>(() => loadAllEntries())
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const resetTimer = useRef<number | null>(null)
  const pushTimer = useRef<number | null>(null)

  const markStatus = useCallback((status: SyncStatus, resetMs = 2000) => {
    setSyncStatus(status)
    if (resetTimer.current !== null) clearTimeout(resetTimer.current)
    if (status === 'offline') return
    resetTimer.current = window.setTimeout(
      () => setSyncStatus(current => (current === 'offline' ? 'offline' : 'idle')),
      resetMs,
    )
  }, [])

  const schedulePush = useCallback(() => {
    if (!isDeviceSyncEnabled() || !navigator.onLine) return
    if (pushTimer.current !== null) window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(() => {
      void pushDeviceSync()
        .then(() => markStatus('synced', 1800))
        .catch(() => markStatus('error', 4000))
    }, 700)
  }, [markStatus])

  const syncNow = useCallback(async () => {
    if (!isDeviceSyncEnabled()) {
      setEntries(loadAllEntries())
      return
    }
    if (!navigator.onLine) {
      markStatus('offline', 0)
      return
    }
    markStatus('syncing', 10_000)
    try {
      const result = await pullDeviceSync()
      if (result) setEntries(result.entries)
      else setEntries(loadAllEntries())
      markStatus('synced', 2000)
    } catch {
      markStatus('error', 4000)
    }
  }, [markStatus])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setSyncStatus(current => (current === 'offline' ? 'idle' : current))
      void syncNow()
    }

    const handleOffline = () => {
      setIsOnline(false)
      setSyncStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncNow])

  // Multi-tab: reload when another tab writes entries
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === ENTRIES_KEY || event.key === null) {
        setEntries(loadAllEntries())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Pull on open, on focus, and periodically while paired
  useEffect(() => {
    void syncNow()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncNow()
    }
    document.addEventListener('visibilitychange', onVisible)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void syncNow()
    }, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
      if (pushTimer.current !== null) window.clearTimeout(pushTimer.current)
    }
  }, [syncNow])

  const reloadAll = useCallback(async () => {
    setEntries(loadAllEntries())
  }, [])

  const saveEntry = useCallback(async (entry: DashboardEntry): Promise<boolean> => {
    const scored: DashboardEntry = {
      ...entry,
      dailyScore: calculateScore(entry),
      updatedAt: new Date().toISOString(),
    }

    const { entries: updated, ok } = upsertEntry(scored)
    if (!ok) {
      markStatus('error', 4000)
      return false
    }

    awardDailyXP(scored.dailyScore, scored.date, todayKeyLocal())

    try {
      localStorage.setItem('project-life-backup-' + scored.date, JSON.stringify(scored))
    } catch { /* storage quota — ignore */ }

    setEntries(updated)
    markStatus(navigator.onLine ? 'synced' : 'offline', navigator.onLine ? 2000 : 0)
    schedulePush()
    return true
  }, [markStatus, schedulePush])

  return { entries, syncStatus, isOnline, saveEntry, reloadAll, syncNow }
}
