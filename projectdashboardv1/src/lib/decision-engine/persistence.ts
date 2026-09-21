import { capAudits } from './audit.js'
import type { DecisionAudit, VoiceMemo } from './types.js'

export const DECISION_LAYER_KEY = 'life-os-v1-decision-layer'

export type DecisionLayerState = {
  audits: DecisionAudit[]
  executedActionKeys: string[]
  voiceMemos: VoiceMemo[]
}

export function emptyDecisionLayerState(): DecisionLayerState {
  return {
    audits: [],
    executedActionKeys: [],
    voiceMemos: [],
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function normalizeDecisionLayerState(raw: unknown): DecisionLayerState {
  const seed = emptyDecisionLayerState()
  if (!raw || typeof raw !== 'object') return seed
  const data = raw as Partial<DecisionLayerState>
  return {
    audits: capAudits(Array.isArray(data.audits) ? data.audits.filter(item => item && typeof item === 'object' && asString(item.decisionId)) : []),
    executedActionKeys: Array.isArray(data.executedActionKeys)
      ? [...new Set(data.executedActionKeys.map(item => asString(item)).filter(Boolean))].slice(-400)
      : [],
    voiceMemos: Array.isArray(data.voiceMemos)
      ? data.voiceMemos.filter(item => item && typeof item === 'object' && asString(item.id) && asString(item.audioRef))
      : [],
  }
}

function storage(): { getItem(key: string): string | null; setItem(key: string, value: string): void } | null {
  const host = globalThis as { localStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void } }
  return host.localStorage ?? null
}

export function loadDecisionLayerState(): DecisionLayerState {
  try {
    return normalizeDecisionLayerState(JSON.parse(storage()?.getItem(DECISION_LAYER_KEY) ?? 'null'))
  } catch {
    return emptyDecisionLayerState()
  }
}

export function saveDecisionLayerState(state: DecisionLayerState): boolean {
  try {
    const current = storage()
    if (!current) return false
    current.setItem(DECISION_LAYER_KEY, JSON.stringify(normalizeDecisionLayerState(state)))
    return true
  } catch {
    return false
  }
}

export function recordDecisionAudits(audits: DecisionAudit[]): DecisionLayerState {
  const current = loadDecisionLayerState()
  const next = normalizeDecisionLayerState({
    ...current,
    audits: [...current.audits, ...audits],
  })
  saveDecisionLayerState(next)
  return next
}

export function rememberExecutedKeys(keys: string[]): DecisionLayerState {
  const current = loadDecisionLayerState()
  const next = normalizeDecisionLayerState({
    ...current,
    executedActionKeys: [...current.executedActionKeys, ...keys],
  })
  saveDecisionLayerState(next)
  return next
}

export function upsertVoiceMemo(memo: VoiceMemo): DecisionLayerState {
  const current = loadDecisionLayerState()
  const voiceMemos = current.voiceMemos.some(item => item.id === memo.id)
    ? current.voiceMemos.map(item => item.id === memo.id ? memo : item)
    : [memo, ...current.voiceMemos].slice(0, 80)
  const next = { ...current, voiceMemos }
  saveDecisionLayerState(next)
  return next
}
