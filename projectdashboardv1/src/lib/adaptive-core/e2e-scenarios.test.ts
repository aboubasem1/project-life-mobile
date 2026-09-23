/**
 * Offline verification of the four Phase-1 end-to-end scenarios.
 * Run: npx vitest run src/lib/adaptive-core/e2e-scenarios.test.ts
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { defaultAdaptiveLifeConfig, readAdaptiveFromSettings } from './life-model.js'
import { generateChangeSpec, orchestrateJoRequest } from './jo/orchestrator.js'
import { applyApprovedChange, revertChange, saveChangeHistory } from './change-engine/index.js'
import { applyNowDedupePolicy } from './now-dedupe.js'
import { normalizeMorningRitualConfig } from '../morningGate.js'
import { saveAdaptiveEvents } from './events/store.js'
import { saveExperiments } from './experiments/engine.js'

beforeEach(() => {
  const map = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v) },
      removeItem: (k: string) => { map.delete(k) },
      clear: () => map.clear(),
      key: () => null,
      length: 0,
    },
    configurable: true,
  })
  saveChangeHistory([])
  saveAdaptiveEvents([])
  saveExperiments([])
})

describe('E2E Phase-1 scenarios', () => {
  it('1) Energy only in gates — remove from NOW', () => {
    const settings = {
      morningRitual: normalizeMorningRitualConfig(undefined),
      eveningGate: { enabled: true, fromHour: 17, hiddenChecks: [] as string[] },
      adaptive: defaultAdaptiveLifeConfig(),
    }
    const generated = generateChangeSpec(
      'Energy only belongs in Morning and Evening Gate. Remove it from NOW.',
      settings,
    )
    expect('changeSpec' in generated && generated.validation.ok).toBe(true)
    if (!('changeSpec' in generated)) return
    expect(generated.risk).toBe('LOW')
    const applied = applyApprovedChange({ settings, spec: generated.changeSpec })
    expect(applied.ok).toBe(true)
    const adaptive = readAdaptiveFromSettings(applied.settings)
    expect(adaptive.surfaces.now.excludeEntities).toContain('energy')
    // Gates untouched
    expect(applied.settings.morningRitual).toEqual(settings.morningRitual)
    expect(applied.settings.eveningGate).toEqual(settings.eveningGate)
    const dedupe = applyNowDedupePolicy({
      surface: adaptive.surfaces.now,
      habitKeys: ['focusDone'],
    })
    expect(dedupe.suppressEnergyGap).toBe(true)
    const undone = revertChange({ settings: applied.settings, historyId: applied.history.id })
    expect(undone.ok).toBe(true)
    expect(readAdaptiveFromSettings(undone.settings).surfaces.now.excludeEntities).not.toContain('energy')
  })

  it('2) Move weight after breakfast in Morning Gate', () => {
    const settings = {
      morningRitual: normalizeMorningRitualConfig(undefined),
      adaptive: defaultAdaptiveLifeConfig(),
    }
    const generated = generateChangeSpec('Move weight after breakfast in Morning Gate.', settings)
    expect('changeSpec' in generated).toBe(true)
    if (!('changeSpec' in generated)) return
    const applied = applyApprovedChange({ settings, spec: generated.changeSpec })
    expect(applied.ok).toBe(true)
    const order = applied.settings.morningRitual?.stepOrder as string[]
    expect(order.indexOf('weight')).toBe(order.indexOf('medsShake') + 1)
    expect(applied.settings.morningRitual?.hiddenSteps).not.toContain('weight')
    const undone = revertChange({ settings: applied.settings, historyId: applied.history.id })
    expect(undone.ok).toBe(true)
  })

  it('3) Lab compact + progressive disclosure', () => {
    const settings = { adaptive: defaultAdaptiveLifeConfig() }
    const generated = generateChangeSpec(
      'Make Lab cards more compact and reveal secondary information only when opened.',
      settings,
    )
    expect('changeSpec' in generated && generated.changeType).toBe('UI_CONFIG_CHANGE')
    if (!('changeSpec' in generated)) return
    const applied = applyApprovedChange({ settings, spec: generated.changeSpec })
    expect(applied.ok).toBe(true)
    const adaptive = readAdaptiveFromSettings(applied.settings)
    expect(adaptive.surfaces.lab.density).toBe('compact')
    expect(adaptive.surfaces.lab.disclosure).toBe('progressive')
  })

  it('4) Comparison view is CODE_CHANGE with ImplementationSpec', () => {
    const result = orchestrateJoRequest({
      text: 'Build a comparison view for my last three Lab measurements.',
      settings: {},
    })
    expect(result.route).toBe('CHANGE')
    if (result.route !== 'CHANGE') return
    expect(result.classification.changeType).toBe('CODE_CHANGE')
    expect('implementationSpec' in result).toBe(true)
    if (!('implementationSpec' in result) || !result.implementationSpec) return
    expect(result.implementationSpec.acceptanceCriteria.length).toBeGreaterThan(0)
    expect(result.implementationSpec.risk).toBe('HIGH')
  })
})
