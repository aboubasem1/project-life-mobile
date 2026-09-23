import { createId, nowIso } from '../schema.js'
import { classifyRisk, parseChangeSpec, validateChangeSpec } from '../change-engine/validate.js'
import { buildChangePreview } from '../change-engine/history.js'
import type { ChangePreview, ChangeSpec, MutableLifeSettings } from '../change-engine/types.js'
import type { ChangeType, JoRoute, RiskLevel } from '../types.js'

export type JoClassification = {
  route: JoRoute
  confidence: number
  changeType?: ChangeType
  reason: string
}

export type SystemChangeProposal = {
  route: 'CHANGE'
  changeType: ChangeType
  changeSpec: ChangeSpec
  preview: ChangePreview
  validation: { ok: boolean; errors: string[] }
  risk: RiskLevel
  interpretation: string
}

export type ImplementationSpec = {
  id: string
  request: string
  goal: string
  affectedSurfaces: string[]
  acceptanceCriteria: string[]
  constraints: string[]
  existingComponentsToReuse: string[]
  filesLikelyAffected: string[]
  testsRequired: string[]
  risk: RiskLevel
  rollbackStrategy: string
  createdAt: string
}

export type JoOrchestratorResult =
  | { route: 'CAPTURE'; classification: JoClassification }
  | { route: 'QUERY'; classification: JoClassification }
  | { route: 'SUGGEST'; classification: JoClassification }
  | { route: 'EXPERIMENT'; classification: JoClassification; hypothesis: string }
  | { route: 'CHANGE'; classification: JoClassification; proposal: SystemChangeProposal }
  | { route: 'CHANGE'; classification: JoClassification; implementationSpec: ImplementationSpec; proposal?: undefined }

/** Strong system-change verbs — not bare "make/move/change" alone. */
const CHANGE_VERB = /\b(entferne|remove|verschieb(?:e|en)?|ausblenden|hide|enable|disable|konfigur(?:iere|ieren)?|umstell(?:e|en)?)\b/i
const CHANGE_STRUCTURE = /\b((nur|only)\s+(in|bei|inside)|gehört\s+(nur\s+)?in|belongs?\s+(only\s+)?in|nach\s+\w+|after\s+\w+)\b/i
const UI_CONFIG_PHRASE = /\b(compact|dichte|density|disclosure|progressive)\b/i
const QUERY_HINT = /\b(wieviel|wie\s+viel|was\s+war|why|warum|wann|show\s+me|letzte|last\s+week|statistik)\b/i
const SUGGEST_HINT = /\b(wie\s+könnten|how\s+could|vorschlag|suggest|besser|easier|einfacher)\b/i
const EXPERIMENT_HINT = /\b(versuch(?:e|en)?|try|experiment|für\s+\d+\s*tage|for\s+\d+\s*days|eine\s+woche|for\s+a\s+week)\b/i
const CAPTURE_METRIC = /\b(\d+(?:[.,]\d+)?\s*(?:kg|kcal|g|liter|l|min|%|grams?)|getrunken|gegessen|erledigt|protein\s*shake|wasser|steps|schritte)\b/i
const CAPTURE_ENERGY_LEVEL = /\b(energy|energie)\b.{0,12}\b(low|okay|high|niedrig|gut|hoch)\b|\b(low|okay|high|niedrig|gut|hoch)\b.{0,12}\b(energy|energie)\b/i
const CAPTURE_WEIGHT_LOG = /\b(weight|gewicht)\b.{0,8}\d|\d.{0,8}\b(kg|weight|gewicht)\b/i
const CODE_BUILD = /\b(bau(?:e|en)?|build|implement(?:iere|ieren)?|vergleichsansicht|comparison\s+view|neue\s+ansicht|new\s+view)\b/i
const CONFIG_NOUN = /\b(energy|energie|mood|stimmung|weight|gewicht|now|jetzt|heute|morning|morgen|evening|abend|lab|gate|dichte|density|disclosure|routine|ritual)\b/i

export function classifyJoIntent(text: string): JoClassification {
  const content = text.trim()
  if (!content) {
    return { route: 'CAPTURE', confidence: 0.1, reason: 'EMPTY' }
  }

  // Metric / check-in logs always win over config vocabulary.
  if (isCaptureLog(content)) {
    return { route: 'CAPTURE', confidence: 0.92, reason: 'capture_metric' }
  }

  if (EXPERIMENT_HINT.test(content) && (CHANGE_VERB.test(content) || CHANGE_STRUCTURE.test(content) || CONFIG_NOUN.test(content))) {
    return { route: 'EXPERIMENT', confidence: 0.82, reason: 'experiment_language' }
  }

  if (SUGGEST_HINT.test(content) && !CHANGE_VERB.test(content) && !CHANGE_STRUCTURE.test(content)) {
    return { route: 'SUGGEST', confidence: 0.78, reason: 'suggest_language' }
  }

  if (isExplicitCodeRequest(content)) {
    return { route: 'CHANGE', confidence: 0.86, changeType: 'CODE_CHANGE', reason: 'requires_code' }
  }

  if (isSystemChangeRequest(content)) {
    return {
      route: 'CHANGE',
      confidence: 0.9,
      changeType: inferChangeType(content),
      reason: 'system_change',
    }
  }

  if (QUERY_HINT.test(content)) {
    return { route: 'QUERY', confidence: 0.75, reason: 'query_language' }
  }

  return { route: 'CAPTURE', confidence: 0.55, reason: 'default_capture' }
}

function isCaptureLog(content: string): boolean {
  if (CAPTURE_METRIC.test(content)) return true
  if (CAPTURE_ENERGY_LEVEL.test(content)) return true
  if (CAPTURE_WEIGHT_LOG.test(content)) return true
  // Short metric-like phrases without reconfiguration language.
  if (/^(energy|energie)\s+(low|okay|high|niedrig|gut|hoch)$/i.test(content)) return true
  if (/^(mood|stimmung)\s+/i.test(content) && !CHANGE_VERB.test(content)) return true
  return false
}

function isSystemChangeRequest(content: string): boolean {
  if (!CONFIG_NOUN.test(content) && !UI_CONFIG_PHRASE.test(content)) return false
  if (CHANGE_VERB.test(content) || CHANGE_STRUCTURE.test(content)) return true
  // UI config can be phrased as "Make Lab cards more compact…"
  if (UI_CONFIG_PHRASE.test(content) && /\b(lab|cards?|karten)\b/i.test(content)) return true
  // "Energy only belongs in Morning and Evening Gate" without explicit remove
  if (/\b(energy|energie)\b/i.test(content) && /\b(only|nur|belongs?|gehört)\b/i.test(content)
    && /\b(morning|morgen|evening|abend|gate)\b/i.test(content)) {
    return true
  }
  return false
}

function isExplicitCodeRequest(content: string): boolean {
  if (!CODE_BUILD.test(content)) return false
  // Config adjustments that happen to include "build" stay config when change verbs + nouns match.
  if (isSystemChangeRequest(content) && !/\b(vergleichsansicht|comparison\s+view|neue\s+ansicht|new\s+view)\b/i.test(content)) {
    return false
  }
  // Require product/feature intent — not "build muscle"
  return /\b(view|ansicht|feature|screen|vergleich|comparison|komponente|component|seite|page)\b/i.test(content)
    || /\b(vergleichsansicht|comparison\s+view|neue\s+ansicht|new\s+view)\b/i.test(content)
}

function inferChangeType(content: string): ChangeType {
  if (isExplicitCodeRequest(content)) return 'CODE_CHANGE'
  if (UI_CONFIG_PHRASE.test(content) && /\b(lab|cards?|karten)\b/i.test(content)) {
    return 'UI_CONFIG_CHANGE'
  }
  return 'CONFIG_CHANGE'
}

/** Deterministic ChangeSpec generation for known Phase-1 scenarios. */
export function generateChangeSpec(
  text: string,
  settings: MutableLifeSettings,
  classification = classifyJoIntent(text),
): SystemChangeProposal | ImplementationSpec {
  const changeType = classification.changeType ?? inferChangeType(text)
  if (changeType === 'CODE_CHANGE') {
    return buildImplementationSpec(text)
  }

  const lower = text.toLowerCase()
  let spec: ChangeSpec | null = null

  // E2E 1: energy only in gates / remove from NOW
  if (/\b(energy|energie)\b/i.test(text)
    && (/\b(now|jetzt|heute)\b/i.test(text) || /\b(only|nur|belongs?|gehört)\b/i.test(text))
    && /\b(remove|entferne|nur|only|gehört|belongs)\b/i.test(text)) {
    const risk = classifyRisk('CONFIG_CHANGE', 'surface.now', ['surfaces/now/excludeEntities'])
    spec = {
      id: createId('chg'),
      type: 'CONFIG_CHANGE',
      target: 'surface.now',
      operations: [{
        op: 'insert',
        path: 'surfaces/now/excludeEntities',
        item: 'energy',
        value: 'energy',
      }],
      reason: 'Energy belongs only in Morning and Evening Gate',
      risk,
      request: text,
      affectedEntities: ['energy', 'surface.now', 'morning_gate', 'evening_gate'],
      createdAt: nowIso(),
    }
  }

  // E2E 2: move weight after breakfast in Morning Gate
  if (!spec && /\b(weight|gewicht)\b/i.test(text) && /\b(move|verschieb|nach|after)\b/i.test(text)
    && /\b(morning|morgen|gate|breakfast|frühstück|meds?shake|shake)\b/i.test(text)) {
    const order = Array.isArray(settings.morningRitual?.stepOrder)
      ? [...settings.morningRitual!.stepOrder as string[]]
      : []
    const breakfastIdx = Math.max(0, order.indexOf('medsShake'))
    let from = order.indexOf('weight')
    const nextOrder = order.filter(id => id !== 'weight')
    const insertAt = Math.min(nextOrder.length, breakfastIdx >= 0 ? breakfastIdx + 1 : 1)
    nextOrder.splice(insertAt, 0, 'weight')
    if (from < 0) from = insertAt
    const to = nextOrder.indexOf('weight')
    const risk = classifyRisk('CONFIG_CHANGE', 'routine.morning', ['stepOrder'])
    spec = {
      id: createId('chg'),
      type: 'CONFIG_CHANGE',
      target: 'routine.morning',
      operations: [
        { op: 'insert', path: 'stepOrder', item: 'weight', to: insertAt },
        { op: 'move', path: 'stepOrder', from, to },
        { op: 'set', path: 'stepOrder', value: nextOrder },
      ],
      reason: 'Move weight after breakfast (medsShake) in Morning Gate',
      risk,
      request: text,
      affectedEntities: ['weight', 'morning_gate'],
      createdAt: nowIso(),
    }
  }

  // E2E 3: Lab compact + progressive disclosure
  if (!spec && /\b(lab)\b/i.test(lower) && /\b(compact|dichte|progressive|secondary|sekundär)\b/i.test(lower)) {
    const risk = classifyRisk('UI_CONFIG_CHANGE', 'ui.lab', ['density', 'disclosure'])
    spec = {
      id: createId('chg'),
      type: 'UI_CONFIG_CHANGE',
      target: 'ui.lab',
      operations: [
        { op: 'set', path: 'surfaces/lab/density', value: 'compact' },
        { op: 'set', path: 'surfaces/lab/disclosure', value: 'progressive' },
      ],
      reason: 'Lab cards compact with progressive disclosure',
      risk,
      request: text,
      affectedEntities: ['lab'],
      createdAt: nowIso(),
    }
  }

  // Generic: hide mood from morning gate
  if (!spec && /\b(mood|stimmung)\b/i.test(text) && /\b(morning|morgen)\b/i.test(text)
    && /\b(remove|entferne|hide|aus)\b/i.test(text)) {
    const risk = classifyRisk('CONFIG_CHANGE', 'routine.morning', ['hiddenSteps'])
    spec = {
      id: createId('chg'),
      type: 'CONFIG_CHANGE',
      target: 'routine.morning',
      operations: [{ op: 'disable', path: 'hiddenSteps', item: 'headRecovery' }],
      reason: 'Hide mood/headRecovery from Morning Gate',
      risk,
      request: text,
      affectedEntities: ['mood', 'morning_gate'],
      createdAt: nowIso(),
    }
  }

  if (!spec) {
    if (isExplicitCodeRequest(text)) {
      return buildImplementationSpec(text)
    }
    // Unmapped system-ish language — do not invent a noop ChangeSpec.
    // Caller (tryOpenSystemChange) should fall through to CAPTURE.
    const risk = classifyRisk('CONFIG_CHANGE', 'unknown', [])
    return {
      route: 'CHANGE',
      changeType: 'CONFIG_CHANGE',
      changeSpec: {
        id: createId('chg'),
        type: 'CONFIG_CHANGE',
        target: 'unknown',
        operations: [{ op: 'set', path: 'noop', value: true }],
        reason: 'Unrecognized change',
        risk,
        request: text,
        createdAt: nowIso(),
      },
      preview: buildChangePreview({
        id: 'unmapped',
        type: 'CONFIG_CHANGE',
        target: 'unknown',
        operations: [{ op: 'set', path: 'noop', value: true }],
        reason: 'Unrecognized change',
        risk,
        createdAt: nowIso(),
      }),
      validation: { ok: false, errors: ['UNMAPPED_CHANGE'] },
      risk,
      interpretation: 'Could not safely interpret this system change',
    }
  }

  // Drop redundant move when set already encodes final order
  if (spec.target === 'routine.morning') {
    const setOp = spec.operations.find(op => op.op === 'set' && op.path === 'stepOrder')
    if (setOp) {
      spec = {
        ...spec,
        operations: [
          ...(spec.operations.some(op => op.op === 'insert' && op.item === 'weight')
            ? [{ op: 'insert' as const, path: 'stepOrder', item: 'weight', to: (setOp.value as string[]).indexOf('weight') }]
            : []),
          setOp,
        ],
      }
    }
  }

  const validation = validateChangeSpec(spec, { request: text, allowCritical: false })
  const finalSpec = validation.spec ?? spec
  return {
    route: 'CHANGE',
    changeType: finalSpec.type,
    changeSpec: finalSpec,
    preview: buildChangePreview(finalSpec),
    validation: { ok: validation.ok, errors: validation.errors },
    risk: finalSpec.risk,
    interpretation: finalSpec.reason,
  }
}

export function buildImplementationSpec(request: string): ImplementationSpec {
  return {
    id: createId('impl'),
    request,
    goal: request.trim(),
    affectedSurfaces: ['lab'],
    acceptanceCriteria: [
      'New UI is reachable from Lab',
      'Uses existing measurement data sources',
      'Works on mobile viewport',
      'Includes tests for rendering empty and filled states',
    ],
    constraints: [
      'No arbitrary CSS from AI',
      'Reuse existing design tokens',
      'Do not invent medical advice',
    ],
    existingComponentsToReuse: [
      'WeightDailyCard',
      'laborLive',
      'bodyMeasurement',
      'lifeosUi',
    ],
    filesLikelyAffected: [
      'projectdashboardv1/src/App.tsx',
      'projectdashboardv1/src/lib/laborLive.ts',
      'projectdashboardv1/src/components/',
    ],
    testsRequired: [
      'unit: comparison selector',
      'component: empty state',
      'build + typecheck',
    ],
    risk: 'HIGH',
    rollbackStrategy: 'Revert merge commit or redeploy previous production artifact',
    createdAt: nowIso(),
  }
}

export function orchestrateJoRequest(input: {
  text: string
  settings: MutableLifeSettings
}): JoOrchestratorResult {
  const classification = classifyJoIntent(input.text)
  switch (classification.route) {
    case 'CAPTURE':
      return { route: 'CAPTURE', classification }
    case 'QUERY':
      return { route: 'QUERY', classification }
    case 'SUGGEST':
      return { route: 'SUGGEST', classification }
    case 'EXPERIMENT':
      return {
        route: 'EXPERIMENT',
        classification,
        hypothesis: input.text.trim(),
      }
    case 'CHANGE': {
      const generated = generateChangeSpec(input.text, input.settings, classification)
      if ('goal' in generated && 'acceptanceCriteria' in generated) {
        return {
          route: 'CHANGE',
          classification: { ...classification, changeType: 'CODE_CHANGE' },
          implementationSpec: generated,
        }
      }
      return {
        route: 'CHANGE',
        classification: { ...classification, changeType: generated.changeType },
        proposal: generated,
      }
    }
    default: {
      const _exhaustive: never = classification.route
      return _exhaustive
    }
  }
}

export function parseModelChangeSpec(raw: unknown, request: string): SystemChangeProposal | null {
  const parsed = parseChangeSpec(raw, request)
  if (!parsed) return null
  const validation = validateChangeSpec(parsed, { request, allowCritical: false })
  if (!validation.spec) return null
  return {
    route: 'CHANGE',
    changeType: validation.spec.type,
    changeSpec: validation.spec,
    preview: buildChangePreview(validation.spec),
    validation: { ok: validation.ok, errors: validation.errors },
    risk: validation.spec.risk,
    interpretation: validation.spec.reason,
  }
}
