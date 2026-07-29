import { useState, useCallback, useEffect, useRef } from 'react'
import type { DashboardEntry } from '../types/DashboardEntry'
import { loadAllEntries, upsertEntry } from '../lib/storage'
import { calculateScore } from '../lib/score'
import { awardDailyXP } from '../lib/xp-store'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

export interface UseEntriesReturn {
  entries: DashboardEntry[]
  syncStatus: SyncStatus
  isOnline: boolean
  /** Returns false when localStorage write failed. */
  saveEntry: (entry: DashboardEntry) => Promise<boolean>
  reloadAll: () => Promise<void>
}

function todayKeyLocal(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function useEntries(): UseEntriesReturn {
  // Synchronous init — instant render, no loading state needed
  const [entries, setEntries]       = useState<DashboardEntry[]>(() => loadAllEntries())
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const resetTimer = useRef<number | null>(null)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setSyncStatus(current => (current === 'offline' ? 'idle' : current))
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
  }, [])

  // Reload from localStorage (no network call)
  const reloadAll = useCallback(async () => {
    setEntries(loadAllEntries())
  }, [])

  const saveEntry = useCallback(async (entry: DashboardEntry): Promise<boolean> => {
    const scored: DashboardEntry = { ...entry, dailyScore: calculateScore(entry) }

    const { entries: updated, ok } = upsertEntry(scored)
    if (!ok) {
      setSyncStatus('error')
      if (resetTimer.current !== null) clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(
        () => setSyncStatus(current => (current === 'offline' ? 'offline' : 'idle')),
        4000,
      )
      return false
    }

    // XP: today drives streak; past days only top up without rewinding streak
    awardDailyXP(scored.dailyScore, scored.date, todayKeyLocal())

    // Per-day backup slot (keeps last entries individually recoverable)
    try {
      localStorage.setItem('project-life-backup-' + scored.date, JSON.stringify(scored))
    } catch { /* storage quota — ignore */ }

    setEntries(updated)
    setSyncStatus(isOnline ? 'synced' : 'offline')
    if (resetTimer.current !== null) clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(
      () => setSyncStatus(current => (current === 'offline' ? 'offline' : 'idle')),
      2000,
    )
    return true
  }, [isOnline])

  return { entries, syncStatus, isOnline, saveEntry, reloadAll }
}
