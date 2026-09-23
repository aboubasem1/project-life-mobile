import type { AdaptiveLifeConfig, EntityId, SurfaceNowConfig } from './types.js'

/**
 * Reusable NOW visibility / deduplication policy.
 * Gate-owned work should not also clutter NOW unless explicitly configured.
 */
export type NowDedupeInput = {
  surface: SurfaceNowConfig
  /** Habit/entity keys already presented inside an active gate. */
  gateOwnedKeys?: Iterable<string>
  /** Entity ids considered gate-owned (energy, mood, …). */
  gateOwnedEntities?: Iterable<EntityId>
  /** Candidate habit keys for NOW. */
  habitKeys: string[]
  /** Map habit key → conceptual entity when applicable. */
  habitEntity?: Partial<Record<string, EntityId>>
}

export type NowDedupeResult = {
  excludeHabitKeys: string[]
  excludeEntities: EntityId[]
  suppressEnergyGap: boolean
  reason: string[]
}

const HABIT_ENTITY_DEFAULT: Partial<Record<string, EntityId>> = {
  gratitudeDone: 'gratitude',
  pushupsDone: 'workout',
  journalDone: 'journal',
}

export function applyNowDedupePolicy(input: NowDedupeInput): NowDedupeResult {
  const reasons: string[] = []
  const exclude = new Set<string>()
  const excludeEntities = new Set<EntityId>(input.surface.excludeEntities)
  const gateKeys = new Set(input.gateOwnedKeys ?? [])
  const gateEntities = new Set(input.gateOwnedEntities ?? [])
  const habitEntity = { ...HABIT_ENTITY_DEFAULT, ...input.habitEntity }

  if (input.surface.dedupe && input.surface.excludeSources.length > 0) {
    for (const key of gateKeys) {
      exclude.add(key)
    }
    if (gateKeys.size > 0) {
      reasons.push('Gate-owned items excluded via dedupe')
    }
    for (const entity of gateEntities) {
      excludeEntities.add(entity)
    }
  }

  for (const entity of input.surface.excludeEntities) {
    excludeEntities.add(entity)
    reasons.push(`Entity ${entity} excluded from NOW by config`)
  }

  for (const key of input.habitKeys) {
    const entity = habitEntity[key]
    if (entity && excludeEntities.has(entity)) exclude.add(key)
  }

  const suppressEnergyGap = excludeEntities.has('energy')
  if (suppressEnergyGap) reasons.push('Energy gap suppressed — owned by gates only')

  return {
    excludeHabitKeys: [...exclude],
    excludeEntities: [...excludeEntities],
    suppressEnergyGap,
    reason: reasons,
  }
}

export function nowExcludesEntity(config: AdaptiveLifeConfig, entity: EntityId): boolean {
  return config.surfaces.now.excludeEntities.includes(entity)
}

export function labUiClassNames(config: AdaptiveLifeConfig): string {
  const ui = config.surfaces.lab
  return [
    `lab-ui--density-${ui.density}`,
    `lab-ui--disclosure-${ui.disclosure}`,
    `lab-ui--emphasis-${ui.emphasis}`,
    `lab-ui--layout-${ui.layout}`,
    `lab-ui--motion-${ui.motion}`,
  ].join(' ')
}
