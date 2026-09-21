export type DecisionFlags = {
  jevEnabled: boolean
  autoActionsEnabled: boolean
  llmFallbackEnabled: boolean
  jevTimeoutMs: number
  llmTimeoutMs: number
}

export const DEFAULT_DECISION_FLAGS: DecisionFlags = {
  jevEnabled: false,
  autoActionsEnabled: false,
  llmFallbackEnabled: false,
  jevTimeoutMs: 2500,
  llmTimeoutMs: 4000,
}

function truthy(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function readEnv(name: string): string | undefined {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  if (processEnv && typeof processEnv[name] === 'string') return processEnv[name]
  const meta = (import.meta as { env?: Record<string, string | undefined> }).env
  if (meta && typeof meta[name] === 'string') return meta[name]
  return undefined
}

function timeoutMs(name: string, fallback: number): number {
  const raw = Number(readEnv(name))
  if (!Number.isFinite(raw)) return fallback
  return Math.min(15_000, Math.max(400, Math.round(raw)))
}

/** Server secrets stay server-side. Client may only read VITE_ public flags. */
export function resolveDecisionFlags(overrides: Partial<DecisionFlags> = {}): DecisionFlags {
  const jevEnabled = truthy(readEnv('JEV_ENABLED')) || truthy(readEnv('VITE_JEV_ENABLED'))
  const autoActionsEnabled = truthy(readEnv('JEV_AUTO_ACTIONS_ENABLED')) || truthy(readEnv('VITE_JEV_AUTO_ACTIONS_ENABLED'))
  const llmFallbackEnabled = truthy(readEnv('JEV_LLM_FALLBACK_ENABLED'))
  return {
    jevEnabled,
    autoActionsEnabled,
    llmFallbackEnabled,
    jevTimeoutMs: timeoutMs('JEV_TIMEOUT_MS', DEFAULT_DECISION_FLAGS.jevTimeoutMs),
    llmTimeoutMs: timeoutMs('LLM_TIMEOUT_MS', DEFAULT_DECISION_FLAGS.llmTimeoutMs),
    ...overrides,
  }
}

export function publicDecisionFlags(flags: DecisionFlags = resolveDecisionFlags()): Pick<DecisionFlags, 'jevEnabled' | 'autoActionsEnabled'> {
  return {
    jevEnabled: flags.jevEnabled,
    autoActionsEnabled: flags.autoActionsEnabled,
  }
}
