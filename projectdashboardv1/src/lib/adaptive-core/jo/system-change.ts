import {
  applyApprovedChange,
  revertChange,
  type ChangeHistoryRecord,
  type ChangePreview,
  type MutableLifeSettings,
} from '../change-engine/index.js'
import { emitAdaptiveEvent } from '../events/store.js'
import { adaptiveLog } from '../logging.js'
import {
  orchestrateJoRequest,
  type ImplementationSpec,
  type SystemChangeProposal,
} from './orchestrator.js'
import { resolveAdaptiveFlags } from '../flags.js'
import { readAdaptiveFromSettings } from '../life-model.js'

export type PendingSystemChange = {
  proposal: SystemChangeProposal
  preview: ChangePreview
}

export type JoChangeSession =
  | { kind: 'config'; pending: PendingSystemChange }
  | { kind: 'code'; spec: ImplementationSpec }
  | { kind: 'error'; message: string }
  | null

export function tryOpenSystemChange(
  text: string,
  settings: MutableLifeSettings,
): JoChangeSession {
  const flags = resolveAdaptiveFlags(readAdaptiveFromSettings(settings).flags)
  if (!flags.adaptiveCore || !flags.joSystemChange) return null

  const result = orchestrateJoRequest({ text, settings })
  adaptiveLog('info', 'intent', 'Jo classified', {
    route: result.route,
    confidence: result.classification.confidence,
  })

  // Never intercept ordinary capture / query / suggest traffic.
  if (result.route !== 'CHANGE') return null

  if ('implementationSpec' in result && result.implementationSpec) {
    emitAdaptiveEvent('change.requested', { payload: { route: 'CODE_CHANGE' } })
    adaptiveLog('info', 'change', 'CODE_CHANGE ImplementationSpec created', {
      id: result.implementationSpec.id,
    })
    return { kind: 'code', spec: result.implementationSpec }
  }

  if (!('proposal' in result) || !result.proposal) return null

  const { proposal } = result

  // Unmapped / invalid ChangeSpecs fall back to Universal Capture — do not block logging.
  if (!proposal.validation.ok || proposal.validation.errors.includes('UNMAPPED_CHANGE')) {
    adaptiveLog('info', 'validation', 'ChangeSpec unmapped — falling through to capture', {
      errors: proposal.validation.errors.length,
    })
    return null
  }

  if (!flags.changePreview) return null

  emitAdaptiveEvent('change.requested', { payload: { route: 'CHANGE' } })
  emitAdaptiveEvent('change.proposed', {
    entityId: proposal.changeSpec.id,
    payload: { risk: proposal.risk, type: proposal.changeType },
  })

  return {
    kind: 'config',
    pending: { proposal, preview: proposal.preview },
  }
}

export function commitSystemChange(input: {
  settings: MutableLifeSettings
  proposal: SystemChangeProposal
}): { ok: true; settings: MutableLifeSettings; history: ChangeHistoryRecord }
  | { ok: false; settings: MutableLifeSettings; error: string; history: ChangeHistoryRecord } {
  emitAdaptiveEvent('change.approved', { entityId: input.proposal.changeSpec.id })
  const applied = applyApprovedChange({
    settings: input.settings,
    spec: input.proposal.changeSpec,
    request: input.proposal.changeSpec.request,
    initiator: 'jo',
  })
  if (!applied.ok) {
    emitAdaptiveEvent('change.failed', { entityId: input.proposal.changeSpec.id })
    adaptiveLog('error', 'apply', applied.error ?? 'apply failed', {
      id: input.proposal.changeSpec.id,
    })
    return { ok: false, settings: input.settings, error: applied.error ?? 'Apply failed', history: applied.history }
  }
  emitAdaptiveEvent('change.applied', { entityId: input.proposal.changeSpec.id })
  adaptiveLog('info', 'apply', 'Change applied', { id: input.proposal.changeSpec.id })
  return { ok: true, settings: applied.settings, history: applied.history }
}

export function undoSystemChange(input: {
  settings: MutableLifeSettings
  historyId: string
}) {
  const result = revertChange(input)
  if (result.ok) {
    emitAdaptiveEvent('change.reverted', { entityId: input.historyId })
    adaptiveLog('info', 'rollback', 'Change reverted', { id: input.historyId })
  }
  return result
}

/** True when capture text should be handled as system change instead of data capture. */
export function looksLikeSystemChange(text: string, settings: MutableLifeSettings): boolean {
  return tryOpenSystemChange(text, settings) != null
}
