import type { ChangeSpec } from './change-engine/types.js'
import type { JoClassification } from './jo/orchestrator.js'
import { classifyJoIntent, generateChangeSpec } from './jo/orchestrator.js'
import type { MutableLifeSettings } from './change-engine/types.js'

/**
 * Replaceable AI provider. Models propose; deterministic code authorizes.
 * Prefer rules → cheap model → advanced reasoning only as needed.
 */
export type AIProvider = {
  id: string
  classify(text: string): Promise<JoClassification>
  extract(text: string, context: Record<string, unknown>): Promise<Record<string, unknown>>
  reason(prompt: string, context: Record<string, unknown>): Promise<string>
  generateChangeSpec(text: string, settings: MutableLifeSettings): Promise<ChangeSpec | null>
  generateImplementationSpec(text: string): Promise<Record<string, unknown>>
}

/** Deterministic local provider — no network. Used before expensive model calls. */
export function createRulesAIProvider(): AIProvider {
  return {
    id: 'rules',
    async classify(text) {
      return classifyJoIntent(text)
    },
    async extract(text) {
      return { text }
    },
    async reason(prompt) {
      return prompt
    },
    async generateChangeSpec(text, settings) {
      const result = generateChangeSpec(text, settings)
      if ('changeSpec' in result) return result.validation.ok ? result.changeSpec : null
      return null
    },
    async generateImplementationSpec(text) {
      const result = generateChangeSpec(text, {}, { route: 'CHANGE', confidence: 1, changeType: 'CODE_CHANGE', reason: 'forced' })
      if ('goal' in result) return result as unknown as Record<string, unknown>
      return { request: text }
    },
  }
}
