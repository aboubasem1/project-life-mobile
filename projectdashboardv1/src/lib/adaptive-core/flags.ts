/** Adaptive Core feature flags — staged rollout. */

export type AdaptiveFeatureFlags = {
  adaptiveCore: boolean
  joSystemChange: boolean
  changePreview: boolean
  changeHistory: boolean
  adaptationSuggestions: boolean
  experiments: boolean
  developmentEngine: boolean
}

export const DEFAULT_ADAPTIVE_FLAGS: AdaptiveFeatureFlags = {
  adaptiveCore: true,
  joSystemChange: true,
  changePreview: true,
  changeHistory: true,
  adaptationSuggestions: true,
  experiments: true,
  developmentEngine: true,
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

/** Missing env → default on for local-first adaptive core. Explicit false disables. */
export function resolveAdaptiveFlags(overrides: Partial<AdaptiveFeatureFlags> = {}): AdaptiveFeatureFlags {
  const read = (key: keyof AdaptiveFeatureFlags, envName: string): boolean => {
    const raw = readEnv(envName) ?? readEnv(`VITE_${envName}`)
    if (raw === undefined) return DEFAULT_ADAPTIVE_FLAGS[key]
    return truthy(raw)
  }
  return {
    adaptiveCore: read('adaptiveCore', 'ADAPTIVE_CORE'),
    joSystemChange: read('joSystemChange', 'JO_SYSTEM_CHANGE'),
    changePreview: read('changePreview', 'CHANGE_PREVIEW'),
    changeHistory: read('changeHistory', 'CHANGE_HISTORY'),
    adaptationSuggestions: read('adaptationSuggestions', 'ADAPTATION_SUGGESTIONS'),
    experiments: read('experiments', 'ADAPTIVE_EXPERIMENTS'),
    developmentEngine: read('developmentEngine', 'DEVELOPMENT_ENGINE'),
    ...overrides,
  }
}
