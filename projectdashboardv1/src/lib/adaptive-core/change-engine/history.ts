import { createId, nowIso } from '../schema.js'
import { applyChangeSpec, snapshotRelevantState, summarizeOperations } from './apply.js'
import { validateChangeSpec } from './validate.js'
import type {
  ApplyResult,
  ChangeHistoryRecord,
  ChangePreview,
  ChangeSpec,
  MutableLifeSettings,
} from './types.js'

export const CHANGE_HISTORY_KEY = 'life-os-v1-change-history'
export const MAX_CHANGE_HISTORY = 200

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function loadChangeHistory(): ChangeHistoryRecord[] {
  const storage = safeStorage()
  if (!storage) return []
  try {
    const raw = JSON.parse(storage.getItem(CHANGE_HISTORY_KEY) ?? '[]')
    return Array.isArray(raw) ? raw as ChangeHistoryRecord[] : []
  } catch {
    return []
  }
}

export function saveChangeHistory(records: ChangeHistoryRecord[]): void {
  const storage = safeStorage()
  if (!storage) return
  try {
    storage.setItem(CHANGE_HISTORY_KEY, JSON.stringify(records.slice(0, MAX_CHANGE_HISTORY)))
  } catch {
    /* quota — ignore */
  }
}

export function appendChangeHistory(record: ChangeHistoryRecord): ChangeHistoryRecord[] {
  const next = [record, ...loadChangeHistory()].slice(0, MAX_CHANGE_HISTORY)
  saveChangeHistory(next)
  return next
}

export function buildChangePreview(spec: ChangeSpec): ChangePreview {
  const lines = humanizeSpec(spec)
  const changeCount = lines.filter(line => !/unchanged/i.test(line)).length
  return {
    title: 'LifeOS Update',
    summaryLines: lines,
    changeCount,
    risk: spec.risk,
    changeSpec: spec,
    reversible: spec.type === 'CONFIG_CHANGE' || spec.type === 'UI_CONFIG_CHANGE',
  }
}

function humanizeSpec(spec: ChangeSpec): string[] {
  const changes: string[] = []
  const notes: string[] = []
  for (const operation of spec.operations) {
    if (operation.path.includes('excludeEntities') && (operation.item === 'energy' || operation.value === 'energy' || (Array.isArray(operation.value) && operation.value.includes('energy')))) {
      changes.push(operation.op === 'remove'
        ? 'Energy again visible in NOW'
        : 'Energy removed from NOW')
      continue
    }
    if (spec.target.includes('morning') && operation.op === 'move') {
      changes.push(`Morning Gate step moved (${operation.from} → ${operation.to})`)
      continue
    }
    if (operation.path.includes('density')) {
      changes.push(`Lab density → ${String(operation.value)}`)
      continue
    }
    if (operation.path.includes('disclosure')) {
      changes.push(`Lab disclosure → ${String(operation.value)}`)
      continue
    }
  }
  if (changes.length === 0) changes.push(...summarizeOperations(spec))
  // Dependency notes — not counted as separate mutations in the preview heading.
  if (spec.operations.some(op => op.item === 'energy' || op.value === 'energy' || (Array.isArray(op.value) && op.value.includes('energy')))) {
    if (!changes.some(line => /Morning Gate/i.test(line))) notes.push('Morning Gate unchanged')
    if (!changes.some(line => /Evening Gate/i.test(line))) notes.push('Evening Gate unchanged')
  }
  return [...changes, ...notes].slice(0, 6)
}

export function applyApprovedChange(input: {
  settings: MutableLifeSettings
  spec: ChangeSpec
  request?: string
  initiator?: ChangeHistoryRecord['initiator']
  experimentId?: string
}): ApplyResult {
  const validation = validateChangeSpec(input.spec, { request: input.request, allowCritical: false })
  if (!validation.ok || !validation.spec) {
    const failed: ChangeHistoryRecord = {
      id: createId('hist'),
      timestamp: nowIso(),
      request: input.request ?? input.spec.request ?? '',
      interpretation: validation.errors.join('; '),
      changeSpec: input.spec,
      affectedEntities: input.spec.affectedEntities ?? [],
      beforeState: snapshotRelevantState(input.settings, input.spec),
      afterState: null,
      risk: input.spec.risk,
      initiator: input.initiator ?? 'user',
      approval: 'approved',
      status: 'failed',
      experimentId: input.experimentId,
      error: validation.errors.join('; '),
    }
    appendChangeHistory(failed)
    return { ok: false, settings: input.settings, history: failed, error: failed.error }
  }

  const before = snapshotRelevantState(input.settings, validation.spec)
  const applied = applyChangeSpec(input.settings, validation.spec)
  if (!applied.ok) {
    const failed: ChangeHistoryRecord = {
      id: createId('hist'),
      timestamp: nowIso(),
      request: input.request ?? validation.spec.request ?? '',
      interpretation: applied.error,
      changeSpec: validation.spec,
      affectedEntities: validation.spec.affectedEntities ?? [],
      beforeState: before,
      afterState: null,
      risk: validation.spec.risk,
      initiator: input.initiator ?? 'user',
      approval: 'approved',
      status: 'failed',
      experimentId: input.experimentId,
      error: applied.error,
    }
    appendChangeHistory(failed)
    return { ok: false, settings: input.settings, history: failed, error: applied.error }
  }

  const history: ChangeHistoryRecord = {
    id: createId('hist'),
    timestamp: nowIso(),
    request: input.request ?? validation.spec.request ?? '',
    interpretation: buildChangePreview(validation.spec).summaryLines.join(' · '),
    changeSpec: validation.spec,
    affectedEntities: validation.spec.affectedEntities ?? [validation.spec.target],
    beforeState: before,
    afterState: snapshotRelevantState(applied.settings, validation.spec),
    risk: validation.spec.risk,
    initiator: input.initiator ?? 'user',
    approval: 'approved',
    status: 'applied',
    experimentId: input.experimentId,
  }
  appendChangeHistory(history)
  return { ok: true, settings: applied.settings, history }
}

export function revertChange(input: {
  settings: MutableLifeSettings
  historyId: string
}): ApplyResult {
  const records = loadChangeHistory()
  const record = records.find(item => item.id === input.historyId)
  if (!record || record.status !== 'applied') {
    const failed: ChangeHistoryRecord = {
      id: createId('hist'),
      timestamp: nowIso(),
      request: `undo:${input.historyId}`,
      interpretation: 'Nothing to undo',
      changeSpec: record?.changeSpec ?? {
        id: createId('chg'),
        type: 'CONFIG_CHANGE',
        target: 'unknown',
        operations: [],
        reason: 'undo',
        risk: 'LOW',
        createdAt: nowIso(),
      },
      affectedEntities: [],
      beforeState: null,
      afterState: null,
      risk: 'LOW',
      initiator: 'user',
      approval: 'approved',
      status: 'failed',
      error: 'Change not found or not applied',
    }
    appendChangeHistory(failed)
    return { ok: false, settings: input.settings, history: failed, error: failed.error }
  }

  let next = cloneMergeBefore(input.settings, record)
  const undoRecord: ChangeHistoryRecord = {
    id: createId('hist'),
    timestamp: nowIso(),
    request: `undo:${record.id}`,
    interpretation: `Reverted: ${record.interpretation}`,
    changeSpec: {
      ...record.changeSpec,
      id: createId('chg'),
      reason: `Undo of ${record.changeSpec.id}`,
      createdAt: nowIso(),
    },
    affectedEntities: record.affectedEntities,
    beforeState: record.afterState,
    afterState: record.beforeState,
    risk: record.risk,
    initiator: 'user',
    approval: 'approved',
    status: 'reverted',
    revertedAt: nowIso(),
  }

  const updated = records.map(item => (
    item.id === record.id
      ? { ...item, status: 'reverted' as const, revertedAt: undoRecord.timestamp }
      : item
  ))
  saveChangeHistory([undoRecord, ...updated].slice(0, MAX_CHANGE_HISTORY))
  return { ok: true, settings: next, history: undoRecord }
}

function cloneMergeBefore(settings: MutableLifeSettings, record: ChangeHistoryRecord): MutableLifeSettings {
  const next = structuredClone(settings)
  const before = record.beforeState
  if (!before || typeof before !== 'object') return next
  const target = record.changeSpec.target
  if (target.startsWith('surface.') || target.startsWith('ui.')) {
    next.adaptive = before
    return next
  }
  if (target.startsWith('routine.morning') || target === 'morning_gate') {
    next.morningRitual = before as MutableLifeSettings['morningRitual']
    return next
  }
  if (target.startsWith('routine.evening') || target === 'evening_gate') {
    next.eveningGate = before as MutableLifeSettings['eveningGate']
    return next
  }
  const blob = before as Record<string, unknown>
  if ('adaptive' in blob) next.adaptive = blob.adaptive
  if ('morningRitual' in blob) next.morningRitual = blob.morningRitual as MutableLifeSettings['morningRitual']
  if ('eveningGate' in blob) next.eveningGate = blob.eveningGate as MutableLifeSettings['eveningGate']
  return next
}
