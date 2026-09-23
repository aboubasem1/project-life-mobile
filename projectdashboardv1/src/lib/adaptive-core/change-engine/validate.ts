import { CHANGE_OPS, CHANGE_TYPES, RISK_LEVELS, type ChangeType, type RiskLevel } from '../types.js'
import { asRecord, asString, createId, nowIso, pick } from '../schema.js'
import type { ChangeOperation, ChangeSpec } from './types.js'

const SENSITIVE_PATHS = [
  'auth',
  'secret',
  'permission',
  'migration',
  'medication',
  'diagnosis',
  'medical',
]

export function parseChangeSpec(raw: unknown, fallbackRequest = ''): ChangeSpec | null {
  const data = asRecord(raw)
  const type = pick(data.type, CHANGE_TYPES)
  const risk = pick(data.risk, RISK_LEVELS)
  const target = asString(data.target)
  const reason = asString(data.reason) || asString(data.request) || fallbackRequest
  if (!type || !risk || !target) return null
  const operationsRaw = Array.isArray(data.operations) ? data.operations : []
  const operations: ChangeOperation[] = []
  for (const item of operationsRaw) {
    const opData = asRecord(item)
    const op = pick(opData.op, CHANGE_OPS)
    const path = asString(opData.path)
    if (!op || !path) return null
    const operation: ChangeOperation = { op, path }
    if ('value' in opData) operation.value = opData.value
    if (typeof opData.from === 'number') operation.from = opData.from
    if (typeof opData.to === 'number') operation.to = opData.to
    if (typeof opData.item === 'string') operation.item = opData.item
    operations.push(operation)
  }
  if (operations.length === 0 && type !== 'CODE_CHANGE') return null
  return {
    id: asString(data.id) || createId('chg'),
    type,
    target,
    operations,
    reason,
    risk,
    request: asString(data.request) || fallbackRequest || undefined,
    affectedEntities: Array.isArray(data.affectedEntities)
      ? data.affectedEntities.filter((x): x is string => typeof x === 'string')
      : undefined,
    createdAt: asString(data.createdAt) || nowIso(),
  }
}

export type ValidationResult = {
  ok: boolean
  errors: string[]
  spec?: ChangeSpec
}

export function validateChangeSpec(raw: unknown, options: {
  request?: string
  allowCritical?: boolean
} = {}): ValidationResult {
  const errors: string[] = []
  const spec = parseChangeSpec(raw, options.request)
  if (!spec) {
    return { ok: false, errors: ['ChangeSpec schema invalid'] }
  }

  for (const operation of spec.operations) {
    if (!operation.path || operation.path.includes('..') || operation.path.includes('\\')) {
      errors.push(`Unsafe path: ${operation.path}`)
    }
    const lower = `${spec.target} ${operation.path}`.toLowerCase()
    if (SENSITIVE_PATHS.some(token => lower.includes(token))) {
      if (spec.type !== 'CRITICAL_CHANGE') {
        errors.push('Sensitive path requires CRITICAL_CHANGE')
      }
    }
    if (operation.op === 'move') {
      if (typeof operation.from !== 'number' || typeof operation.to !== 'number') {
        errors.push('move requires from and to indices')
      }
    }
    if ((operation.op === 'set' || operation.op === 'insert') && operation.value === undefined && !operation.item) {
      errors.push(`${operation.op} requires value or item`)
    }
  }

  if (spec.type === 'CRITICAL_CHANGE' && options.allowCritical === false) {
    errors.push('Critical changes are not auto-applicable')
  }

  if (spec.risk === 'CRITICAL' && spec.type !== 'CRITICAL_CHANGE') {
    errors.push('CRITICAL risk must use CRITICAL_CHANGE type')
  }

  return errors.length === 0
    ? { ok: true, errors: [], spec }
    : { ok: false, errors, spec }
}

export function classifyRisk(type: ChangeType, target: string, paths: string[]): RiskLevel {
  const blob = `${target} ${paths.join(' ')}`.toLowerCase()
  if (SENSITIVE_PATHS.some(token => blob.includes(token)) || type === 'CRITICAL_CHANGE') {
    return 'CRITICAL'
  }
  if (type === 'CODE_CHANGE') return 'HIGH'
  if (type === 'UI_CONFIG_CHANGE') return 'LOW'
  if (blob.includes('schedule') || blob.includes('automation')) return 'MEDIUM'
  return 'LOW'
}
