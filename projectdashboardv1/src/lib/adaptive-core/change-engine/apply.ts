import { getAdaptivePath, normalizeAdaptiveLifeConfig, setAdaptivePath } from '../life-model.js'
import { asRecord } from '../schema.js'
import type { AdaptiveLifeConfig } from '../types.js'
import type { ChangeOperation, ChangeSpec, MutableLifeSettings } from './types.js'

function cloneSettings(settings: MutableLifeSettings): MutableLifeSettings {
  return structuredClone(settings)
}

function ensureAdaptive(settings: MutableLifeSettings): AdaptiveLifeConfig {
  return normalizeAdaptiveLifeConfig(settings.adaptive)
}

function listMove(list: string[], from: number, to: number): string[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function applyMorningOp(
  settings: MutableLifeSettings,
  operation: ChangeOperation,
): MutableLifeSettings {
  const ritual = { ...(settings.morningRitual ?? {}) }
  const order = Array.isArray(ritual.stepOrder) ? [...ritual.stepOrder] : []
  const hidden = Array.isArray(ritual.hiddenSteps) ? [...ritual.hiddenSteps] : []

  switch (operation.op) {
    case 'move': {
      if (operation.path === 'stepOrder' || operation.path.endsWith('/stepOrder')) {
        ritual.stepOrder = listMove(order, operation.from ?? -1, operation.to ?? -1)
      }
      break
    }
    case 'insert': {
      const item = operation.item ?? (typeof operation.value === 'string' ? operation.value : '')
      if (item && (operation.path === 'stepOrder' || operation.path.endsWith('stepOrder'))) {
        const to = typeof operation.to === 'number' ? operation.to : order.length
        const next = order.filter(id => id !== item)
        next.splice(Math.max(0, Math.min(to, next.length)), 0, item)
        ritual.stepOrder = next
        ritual.hiddenSteps = hidden.filter(id => id !== item)
      }
      break
    }
    case 'set': {
      if (operation.path === 'stepOrder' && Array.isArray(operation.value)) {
        ritual.stepOrder = operation.value.filter((x): x is string => typeof x === 'string')
      }
      if (operation.path === 'hiddenSteps' && Array.isArray(operation.value)) {
        ritual.hiddenSteps = operation.value.filter((x): x is string => typeof x === 'string')
      }
      break
    }
    case 'remove': {
      const item = operation.item ?? (typeof operation.value === 'string' ? operation.value : '')
      if (item && (operation.path === 'stepOrder' || operation.path === 'hiddenSteps')) {
        if (operation.path === 'stepOrder') {
          ritual.hiddenSteps = hidden.includes(item) ? hidden : [...hidden, item]
        } else {
          ritual.hiddenSteps = hidden.filter(id => id !== item)
        }
      }
      break
    }
    case 'enable': {
      const item = operation.item ?? (typeof operation.value === 'string' ? operation.value : '')
      if (item) ritual.hiddenSteps = hidden.filter(id => id !== item)
      break
    }
    case 'disable': {
      const item = operation.item ?? (typeof operation.value === 'string' ? operation.value : '')
      if (item && !hidden.includes(item)) ritual.hiddenSteps = [...hidden, item]
      break
    }
    default: {
      const _exhaustive: never = operation.op
      return _exhaustive
    }
  }
  return { ...settings, morningRitual: ritual }
}

function applyEveningOp(
  settings: MutableLifeSettings,
  operation: ChangeOperation,
): MutableLifeSettings {
  const evening = { ...(settings.eveningGate ?? {}) }
  const hidden = Array.isArray(evening.hiddenChecks) ? [...evening.hiddenChecks] : []
  switch (operation.op) {
    case 'disable':
    case 'remove': {
      const item = operation.item ?? (typeof operation.value === 'string' ? operation.value : '')
      if (item && !hidden.includes(item)) evening.hiddenChecks = [...hidden, item]
      break
    }
    case 'enable':
    case 'insert': {
      const item = operation.item ?? (typeof operation.value === 'string' ? operation.value : '')
      if (item) evening.hiddenChecks = hidden.filter(id => id !== item)
      break
    }
    case 'set': {
      if (operation.path === 'hiddenChecks' && Array.isArray(operation.value)) {
        evening.hiddenChecks = operation.value.filter((x): x is string => typeof x === 'string')
      }
      if (operation.path === 'enabled') evening.enabled = Boolean(operation.value)
      break
    }
    case 'move':
      break
    default: {
      const _exhaustive: never = operation.op
      return _exhaustive
    }
  }
  return { ...settings, eveningGate: evening }
}

function applyAdaptiveOp(
  settings: MutableLifeSettings,
  operation: ChangeOperation,
): MutableLifeSettings {
  let adaptive = ensureAdaptive(settings)
  switch (operation.op) {
    case 'set':
      adaptive = setAdaptivePath(adaptive, operation.path, operation.value)
      break
    case 'insert': {
      if (operation.path.includes('excludeEntities') || operation.path.includes('hiddenFields')) {
        const current = getAdaptivePath(adaptive, operation.path)
        const list = Array.isArray(current) ? [...current] : []
        const item = operation.item ?? (typeof operation.value === 'string' ? operation.value : '')
        if (item && !list.includes(item)) list.push(item)
        adaptive = setAdaptivePath(adaptive, operation.path, list)
      } else {
        adaptive = setAdaptivePath(adaptive, operation.path, operation.value)
      }
      break
    }
    case 'remove': {
      if (operation.path.includes('excludeEntities') || operation.path.includes('hiddenFields')) {
        const current = getAdaptivePath(adaptive, operation.path)
        const list = Array.isArray(current) ? [...current] : []
        const item = operation.item ?? (typeof operation.value === 'string' ? operation.value : '')
        adaptive = setAdaptivePath(adaptive, operation.path, list.filter(id => id !== item))
      }
      break
    }
    case 'enable':
    case 'disable':
      adaptive = setAdaptivePath(adaptive, operation.path, operation.op === 'enable')
      break
    case 'move':
      break
    default: {
      const _exhaustive: never = operation.op
      return _exhaustive
    }
  }
  return { ...settings, adaptive }
}

export function snapshotRelevantState(settings: MutableLifeSettings, spec: ChangeSpec): unknown {
  if (spec.target.startsWith('surface.') || spec.target.startsWith('ui.')) {
    return ensureAdaptive(settings)
  }
  if (spec.target.startsWith('routine.morning') || spec.target === 'morning_gate') {
    return settings.morningRitual ?? null
  }
  if (spec.target.startsWith('routine.evening') || spec.target === 'evening_gate') {
    return settings.eveningGate ?? null
  }
  return {
    adaptive: settings.adaptive ?? null,
    morningRitual: settings.morningRitual ?? null,
    eveningGate: settings.eveningGate ?? null,
  }
}

export function applyChangeSpec(
  settings: MutableLifeSettings,
  spec: ChangeSpec,
): { ok: true; settings: MutableLifeSettings } | { ok: false; error: string; settings: MutableLifeSettings } {
  if (spec.type === 'CODE_CHANGE' || spec.type === 'CRITICAL_CHANGE') {
    return { ok: false, error: 'CODE_CHANGE/CRITICAL_CHANGE cannot be applied by Change Engine', settings }
  }

  let next = cloneSettings(settings)
  try {
    for (const operation of spec.operations) {
      if (
        spec.target.startsWith('surface.')
        || spec.target.startsWith('ui.')
        || operation.path.startsWith('surfaces/')
        || operation.path.startsWith('/surfaces/')
      ) {
        next = applyAdaptiveOp(next, operation)
        continue
      }
      if (spec.target.startsWith('routine.morning') || spec.target === 'morning_gate') {
        next = applyMorningOp(next, operation)
        continue
      }
      if (spec.target.startsWith('routine.evening') || spec.target === 'evening_gate') {
        next = applyEveningOp(next, operation)
        continue
      }
      // Fallback: adaptive paths
      if (operation.path.includes('surfaces') || operation.path.includes('autonomy')) {
        next = applyAdaptiveOp(next, operation)
        continue
      }
      return { ok: false, error: `Unknown target: ${spec.target}`, settings }
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Apply failed',
      settings,
    }
  }

  // Normalize adaptive blob if present
  if (next.adaptive) next.adaptive = ensureAdaptive(next)
  return { ok: true, settings: next }
}

export function summarizeOperations(spec: ChangeSpec): string[] {
  return spec.operations.map(operation => {
    switch (operation.op) {
      case 'set':
        return `${operation.path} → ${formatValue(operation.value)}`
      case 'insert':
        return `Add ${operation.item ?? formatValue(operation.value)} at ${operation.path}`
      case 'remove':
        return `Remove ${operation.item ?? formatValue(operation.value)} from ${operation.path}`
      case 'move':
        return `Move ${operation.path}: ${operation.from} → ${operation.to}`
      case 'enable':
        return `Enable ${operation.item ?? operation.path}`
      case 'disable':
        return `Disable ${operation.item ?? operation.path}`
      default: {
        const _exhaustive: never = operation.op
        return _exhaustive
      }
    }
  })
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.join(', ')
  const record = asRecord(value)
  if (Object.keys(record).length === 0) return '—'
  try {
    return JSON.stringify(value)
  } catch {
    return '—'
  }
}
