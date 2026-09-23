/** Adaptive Core shared types — Life Model primitives + autonomy. */

export const AUTONOMY_LEVELS = ['L0', 'L1', 'L2', 'L3'] as const
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number]

/** Default: suggest only — never auto-mutate. */
export const DEFAULT_AUTONOMY: AutonomyLevel = 'L1'

export const CHANGE_TYPES = [
  'CONFIG_CHANGE',
  'UI_CONFIG_CHANGE',
  'CODE_CHANGE',
  'CRITICAL_CHANGE',
] as const
export type ChangeType = (typeof CHANGE_TYPES)[number]

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

export const CHANGE_OPS = ['set', 'insert', 'remove', 'move', 'enable', 'disable'] as const
export type ChangeOp = (typeof CHANGE_OPS)[number]

export const JO_ROUTES = ['CAPTURE', 'QUERY', 'CHANGE', 'SUGGEST', 'EXPERIMENT'] as const
export type JoRoute = (typeof JO_ROUTES)[number]

export const SURFACE_IDS = ['now', 'morning_gate', 'evening_gate', 'checkin', 'lab', 'capture'] as const
export type SurfaceId = (typeof SURFACE_IDS)[number]

export const ENTITY_IDS = [
  'energy',
  'mood',
  'sleep',
  'weight',
  'gratitude',
  'workout',
  'todos',
  'journal',
] as const
export type EntityId = (typeof ENTITY_IDS)[number]

export const DENSITY_VALUES = ['compact', 'normal', 'relaxed'] as const
export type Density = (typeof DENSITY_VALUES)[number]

export const EMPHASIS_VALUES = ['quiet', 'normal', 'hero'] as const
export type Emphasis = (typeof EMPHASIS_VALUES)[number]

export const DISCLOSURE_VALUES = ['progressive', 'expanded'] as const
export type Disclosure = (typeof DISCLOSURE_VALUES)[number]

export const LAYOUT_VALUES = ['stack', 'carousel', 'grid'] as const
export type LayoutMode = (typeof LAYOUT_VALUES)[number]

export const MOTION_VALUES = ['none', 'subtle', 'expressive'] as const
export type MotionMode = (typeof MOTION_VALUES)[number]

export const VISIBILITY_VALUES = ['hidden', 'visible', 'contextual'] as const
export type Visibility = (typeof VISIBILITY_VALUES)[number]

export type SemanticUiConfig = {
  density: Density
  emphasis: Emphasis
  disclosure: Disclosure
  layout: LayoutMode
  motion: MotionMode
}

export type SurfaceNowConfig = {
  excludeSources: Array<'morning_gate' | 'evening_gate'>
  excludeEntities: EntityId[]
  dedupe: boolean
}

export type SurfaceCheckinConfig = {
  hiddenFields: EntityId[]
}

export type AdaptiveSurfaces = {
  now: SurfaceNowConfig
  checkin: SurfaceCheckinConfig
  lab: SemanticUiConfig
}

export type AdaptiveLifeConfig = {
  version: 1
  autonomyLevel: AutonomyLevel
  surfaces: AdaptiveSurfaces
  flags?: Partial<import('./flags.js').AdaptiveFeatureFlags>
}

/** Conceptual Life Model entity refs — maps onto existing production models. */
export type LifeModelEntityKind =
  | 'user_preference'
  | 'goal'
  | 'routine'
  | 'routine_step'
  | 'task'
  | 'metric'
  | 'check_in'
  | 'meal'
  | 'health_entry'
  | 'life_event'
  | 'experiment'
  | 'suggestion'
  | 'system_change'

export type LifeModelRef = {
  kind: LifeModelEntityKind
  id: string
  surface?: SurfaceId
  label?: string
}
