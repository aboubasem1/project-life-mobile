export * from './types.js'
export * from './validate.js'
export * from './apply.js'
export * from './history.js'

import { buildChangePreview, applyApprovedChange, revertChange, loadChangeHistory } from './history.js'
import { parseChangeSpec, validateChangeSpec, classifyRisk } from './validate.js'
import { applyChangeSpec, summarizeOperations } from './apply.js'
import type { ChangeSpec, MutableLifeSettings } from './types.js'

/** First-class Change Engine façade. */
export const changeEngine = {
  parse: parseChangeSpec,
  validate: validateChangeSpec,
  classifyRisk,
  preview: buildChangePreview,
  apply: (settings: MutableLifeSettings, spec: ChangeSpec, request?: string) =>
    applyApprovedChange({ settings, spec, request }),
  revert: revertChange,
  history: loadChangeHistory,
  applyRaw: applyChangeSpec,
  summarize: summarizeOperations,
}
