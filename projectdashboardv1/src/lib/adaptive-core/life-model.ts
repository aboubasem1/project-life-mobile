import { resolveAdaptiveFlags, type AdaptiveFeatureFlags } from './flags.js'
import { asRecord, asBoolean, pick } from './schema.js'
import {
  AUTONOMY_LEVELS,
  DENSITY_VALUES,
  DISCLOSURE_VALUES,
  EMPHASIS_VALUES,
  ENTITY_IDS,
  LAYOUT_VALUES,
  MOTION_VALUES,
  DEFAULT_AUTONOMY,
  type AdaptiveLifeConfig,
  type AdaptiveSurfaces,
  type AutonomyLevel,
  type EntityId,
  type SemanticUiConfig,
  type SurfaceCheckinConfig,
  type SurfaceNowConfig,
} from './types.js'

export const ADAPTIVE_CONFIG_KEY = 'adaptive'

const DEFAULT_LAB_UI: SemanticUiConfig = {
  density: 'normal',
  emphasis: 'normal',
  disclosure: 'progressive',
  layout: 'stack',
  motion: 'subtle',
}

const DEFAULT_NOW: SurfaceNowConfig = {
  excludeSources: ['morning_gate', 'evening_gate'],
  excludeEntities: [],
  dedupe: true,
}

export function defaultAdaptiveSurfaces(): AdaptiveSurfaces {
  return {
    now: { ...DEFAULT_NOW, excludeSources: [...DEFAULT_NOW.excludeSources], excludeEntities: [] },
    checkin: { hiddenFields: [] },
    lab: { ...DEFAULT_LAB_UI },
  }
}

export function defaultAdaptiveLifeConfig(
  flags: Partial<AdaptiveFeatureFlags> = resolveAdaptiveFlags(),
): AdaptiveLifeConfig {
  return {
    version: 1,
    autonomyLevel: DEFAULT_AUTONOMY,
    surfaces: defaultAdaptiveSurfaces(),
    flags,
  }
}

function normalizeEntityList(raw: unknown): EntityId[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.map(item => pick(item, ENTITY_IDS)).filter((id): id is EntityId => Boolean(id)))]
}

function normalizeNow(raw: unknown): SurfaceNowConfig {
  const data = asRecord(raw)
  const sources = Array.isArray(data.excludeSources)
    ? data.excludeSources.filter((s): s is 'morning_gate' | 'evening_gate' =>
      s === 'morning_gate' || s === 'evening_gate')
    : [...DEFAULT_NOW.excludeSources]
  return {
    excludeSources: sources.length > 0 ? sources : [...DEFAULT_NOW.excludeSources],
    excludeEntities: normalizeEntityList(data.excludeEntities),
    dedupe: asBoolean(data.dedupe, true),
  }
}

function normalizeCheckin(raw: unknown): SurfaceCheckinConfig {
  const data = asRecord(raw)
  return { hiddenFields: normalizeEntityList(data.hiddenFields) }
}

function normalizeUi(raw: unknown): SemanticUiConfig {
  const data = asRecord(raw)
  return {
    density: pick(data.density, DENSITY_VALUES) ?? DEFAULT_LAB_UI.density,
    emphasis: pick(data.emphasis, EMPHASIS_VALUES) ?? DEFAULT_LAB_UI.emphasis,
    disclosure: pick(data.disclosure, DISCLOSURE_VALUES) ?? DEFAULT_LAB_UI.disclosure,
    layout: pick(data.layout, LAYOUT_VALUES) ?? DEFAULT_LAB_UI.layout,
    motion: pick(data.motion, MOTION_VALUES) ?? DEFAULT_LAB_UI.motion,
  }
}

export function normalizeAdaptiveLifeConfig(raw: unknown): AdaptiveLifeConfig {
  const data = asRecord(raw)
  const surfacesRaw = asRecord(data.surfaces)
  const autonomy = pick(data.autonomyLevel, AUTONOMY_LEVELS) as AutonomyLevel | null
  return {
    version: 1,
    autonomyLevel: autonomy ?? DEFAULT_AUTONOMY,
    surfaces: {
      now: normalizeNow(surfacesRaw.now),
      checkin: normalizeCheckin(surfacesRaw.checkin),
      lab: normalizeUi(surfacesRaw.lab),
    },
    flags: data.flags && typeof data.flags === 'object'
      ? resolveAdaptiveFlags(data.flags as Partial<AdaptiveFeatureFlags>)
      : resolveAdaptiveFlags(),
  }
}

export function mergeAdaptiveIntoSettings<T extends Record<string, unknown>>(
  settings: T,
  adaptive: AdaptiveLifeConfig,
): T & { adaptive: AdaptiveLifeConfig } {
  return { ...settings, adaptive: normalizeAdaptiveLifeConfig(adaptive) }
}

export function readAdaptiveFromSettings(settings: unknown): AdaptiveLifeConfig {
  const data = asRecord(settings)
  return normalizeAdaptiveLifeConfig(data.adaptive ?? data[ADAPTIVE_CONFIG_KEY])
}

/** Clone config and apply a JSON-pointer-like path under surfaces.*. */
export function setAdaptivePath(
  config: AdaptiveLifeConfig,
  path: string,
  value: unknown,
): AdaptiveLifeConfig {
  const next = normalizeAdaptiveLifeConfig(structuredClone(config))
  const parts = path.replace(/^\//, '').split('/').filter(Boolean)
  if (parts[0] === 'autonomyLevel') {
    const level = pick(value, AUTONOMY_LEVELS)
    if (level) next.autonomyLevel = level
    return next
  }
  if (parts[0] !== 'surfaces' || parts.length < 3) return next
  const surface = parts[1]
  const field = parts[2]
  if (surface === 'now') {
    if (field === 'dedupe') next.surfaces.now.dedupe = asBoolean(value, next.surfaces.now.dedupe)
    if (field === 'excludeEntities' && Array.isArray(value)) {
      next.surfaces.now.excludeEntities = normalizeEntityList(value)
    }
    if (field === 'excludeSources' && Array.isArray(value)) {
      next.surfaces.now = normalizeNow({ ...next.surfaces.now, excludeSources: value })
    }
  }
  if (surface === 'checkin' && field === 'hiddenFields' && Array.isArray(value)) {
    next.surfaces.checkin.hiddenFields = normalizeEntityList(value)
  }
  if (surface === 'lab') {
    const ui = { ...next.surfaces.lab, [field]: value }
    next.surfaces.lab = normalizeUi(ui)
  }
  return next
}

export function getAdaptivePath(config: AdaptiveLifeConfig, path: string): unknown {
  const parts = path.replace(/^\//, '').split('/').filter(Boolean)
  let cursor: unknown = config
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object') return undefined
    cursor = (cursor as Record<string, unknown>)[part]
  }
  return cursor
}
