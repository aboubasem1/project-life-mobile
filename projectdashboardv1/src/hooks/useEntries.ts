import { useState, useCallback, useRef } from 'react'
import type { DashboardEntry } from '../types/DashboardEntry'
import { loadAllEntries, upsertEntry } from '../lib/storage'
import { calculateScore } from '../lib/score'
import { awardDailyXP } from '../lib/xp-store'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

export interface UseEntriesReturn {
  entries: DashboardEntry[]
  syncStatus: SyncStatus
  isOnline: boolean
  saveEntry: (entry: DashboardEntry) => Promise<void>
  reloadAll: () => Promise<void>
}

export function useEntries(): UseEntriesReturn {
  // Synchronous init — instant render, no loading state needed
  const [entries, setEntries]       = useState<DashboardEntry[]>(() => loadAllEntries())
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const resetTimer = useRef<number | null>(null)

  // Reload from localStorage (no network call)
  const reloadAll = useCallback(async () => {
    setEntries(loadAllEntries())
  }, [])

  const saveEntry = useCallback(async (entry: DashboardEntry) => {
    const scored: DashboardEntry = { ...entry, dailyScore: calculateScore(entry) }

    // Write to localStorage
    const updated = upsertEntry(scored)
    awardDailyXP(scored.dailyScore, scored.date)

    // Per-day backup slot (keeps last entries individually recoverable)
    try {
      localStorage.setItem('project-life-backup-' + scored.date, JSON.stringify(scored))
    } catch { /* storage quota — ignore */ }

    setEntries(updated)
    setSyncStatus('synced')
    if (resetTimer.current !== null) clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => setSyncStatus('idle'), 2000)
  }, [])

  return { entries, syncStatus, isOnline: true, saveEntry, reloadAll }
}
