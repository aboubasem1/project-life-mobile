import { useState, useEffect, useCallback, useRef } from 'react'
import type { DashboardEntry } from '../types/DashboardEntry'
import { loadAllEntries, saveAllEntries, upsertEntry } from '../lib/storage'
import { fetchAllEntriesRemote, upsertEntryRemote, isSupabaseAvailable } from '../lib/supabase'
import { calculateScore } from '../lib/score'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

export interface UseEntriesReturn {
  entries: DashboardEntry[]
  syncStatus: SyncStatus
  isOnline: boolean
  saveEntry: (entry: DashboardEntry) => Promise<void>
  reloadAll: () => Promise<void>
}

export function useEntries(): UseEntriesReturn {
  // Initialize synchronously from localStorage for instant render
  const [entries, setEntries]     = useState<DashboardEntry[]>(() => loadAllEntries())
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [isOnline, setIsOnline]   = useState(navigator.onLine)
  const pendingQueue = useRef<DashboardEntry[]>([])

  const reloadAll = useCallback(async () => {
    setSyncStatus('syncing')
    try {
      if (isSupabaseAvailable() && isOnline) {
        const remote = await fetchAllEntriesRemote()
        if (remote) {
          // Merge: remote is authoritative, but local unsaved entries win
          const localMap = new Map(loadAllEntries().map(e => [e.date, e]))
          for (const r of remote) {
            if (!localMap.has(r.date)) localMap.set(r.date, r)
          }
          const merged = Array.from(localMap.values())
            .sort((a, b) => b.date.localeCompare(a.date))
          saveAllEntries(merged)
          setEntries(merged)
          setSyncStatus('synced')
          return
        }
      }
    } catch {
      setSyncStatus('error')
    }
    const local = loadAllEntries()
    setEntries(local)
    // No Supabase configured → localStorage-only mode, not an error
    setSyncStatus(isSupabaseAvailable() ? (isOnline ? 'error' : 'offline') : 'idle')
  }, [isOnline])

  // Initial load — async sync with Supabase + localStorage fallback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reloadAll() }, [isOnline])

  // Online/offline detection
  useEffect(() => {
    const onOnline  = () => { setIsOnline(true);  reloadAll() }
    const onOffline = () => { setIsOnline(false); setSyncStatus('offline') }
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [reloadAll])

  const saveEntry = useCallback(async (entry: DashboardEntry) => {
    const scored: DashboardEntry = { ...entry, dailyScore: calculateScore(entry) }
    const updated = upsertEntry(scored)
    setEntries(updated)
    setSyncStatus('syncing')

    if (isSupabaseAvailable() && isOnline) {
      try {
        await upsertEntryRemote(scored)
        // Flush any queued entries
        while (pendingQueue.current.length > 0) {
          const queued = pendingQueue.current.shift()!
          await upsertEntryRemote(queued)
        }
        setSyncStatus('synced')
      } catch {
        pendingQueue.current.push(scored)
        setSyncStatus('error')
      }
    } else {
      pendingQueue.current.push(scored)
      setSyncStatus('offline')
    }
  }, [isOnline])

  return { entries, syncStatus, isOnline, saveEntry, reloadAll }
}
