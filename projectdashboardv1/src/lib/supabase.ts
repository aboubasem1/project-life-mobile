import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DashboardEntry } from '../types/DashboardEntry'
import { getUserId } from './storage'

// ─── Singleton client ─────────────────────────────────────────────────────────
let _client: SupabaseClient | null = null

function getClient(): SupabaseClient | null {
  if (_client) return _client
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !key) return null
  _client = createClient(url, key)
  return _client
}

export function isSupabaseAvailable(): boolean {
  return getClient() !== null
}

// ─── Remote CRUD ──────────────────────────────────────────────────────────────
export async function fetchAllEntriesRemote(): Promise<DashboardEntry[] | null> {
  const sb = getClient()
  if (!sb) return null
  const userId = getUserId()
  const { data, error } = await sb
    .from('daily_entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(dbRowToEntry)
}

export async function upsertEntryRemote(entry: DashboardEntry): Promise<void> {
  const sb = getClient()
  if (!sb) return
  const userId = getUserId()
  const { error } = await sb
    .from('daily_entries')
    .upsert(
      { ...entryToRow(entry), user_id: userId },
      { onConflict: 'date,user_id' },
    )
  if (error) throw error
}

// ─── Row mapping (camelCase ↔ snake_case) ─────────────────────────────────────
function entryToRow(e: DashboardEntry): Record<string, unknown> {
  return {
    date:                e.date,
    mood:                e.mood,
    sleep_quality:       e.sleepQuality,
    sleep_duration:      e.sleepDuration,
    meditation_minutes:  e.meditationMinutes,
    cold_shower:         e.coldShower,
    protein_shake:       e.proteinShake,
    pushups_done:        e.pushupsDone,
    squats_done:         e.squatsDone,
    wallsit_done:        e.wallsitDone,
    plank_done:          e.plankDone,
    gratitude_done:      e.gratitudeDone,
    focus_done:          e.focusDone,
    winner_mode_done:    e.winnerModeDone,
    protein_grams:       e.proteinGrams,
    calories:            e.calories,
    tasks_done:          e.tasksDone,
    journal_done:        e.journalDone,
    journal_text:        e.journalText,
    family_time_done:    e.familyTimeDone,
    weight_kg:           e.weightKg,
    water_liters:        e.waterLiters,
    deep_work_hours:     e.deepWorkHours,
    daily_score:         e.dailyScore,
  }
}

function dbRowToEntry(row: Record<string, unknown>): DashboardEntry {
  return {
    date:               String(row.date ?? ''),
    mood:               String(row.mood ?? ''),
    sleepQuality:       String(row.sleep_quality ?? ''),
    sleepDuration:      String(row.sleep_duration ?? ''),
    meditationMinutes:  Number(row.meditation_minutes)  || 0,
    coldShower:         Boolean(row.cold_shower),
    proteinShake:       Boolean(row.protein_shake),
    pushupsDone:        Boolean(row.pushups_done),
    squatsDone:         Boolean(row.squats_done),
    wallsitDone:        Boolean(row.wallsit_done),
    plankDone:          Boolean(row.plank_done),
    gratitudeDone:      Boolean(row.gratitude_done),
    focusDone:          Boolean(row.focus_done),
    winnerModeDone:     Boolean(row.winner_mode_done),
    proteinGrams:       Number(row.protein_grams)       || 0,
    calories:           Number(row.calories)            || 0,
    tasksDone:          Number(row.tasks_done)          || 0,
    journalDone:        Boolean(row.journal_done),
    journalText:        String(row.journal_text ?? ''),
    familyTimeDone:     Boolean(row.family_time_done),
    weightKg:           Number(row.weight_kg)           || 0,
    waterLiters:        Number(row.water_liters)        || 0,
    deepWorkHours:      Number(row.deep_work_hours)     || 0,
    dailyScore:         Number(row.daily_score)         || 0,
  }
}
