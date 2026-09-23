import { describe, expect, it, beforeEach } from 'vitest'
import {
  applyChangeSpec,
  applyApprovedChange,
  revertChange,
  validateChangeSpec,
  classifyRisk,
  buildChangePreview,
  CHANGE_HISTORY_KEY,
  saveChangeHistory,
} from './change-engine/index.js'
import {
  defaultAdaptiveLifeConfig,
  normalizeAdaptiveLifeConfig,
  readAdaptiveFromSettings,
} from './life-model.js'
import { applyNowDedupePolicy, nowExcludesEntity } from './now-dedupe.js'
import {
  classifyJoIntent,
  generateChangeSpec,
  orchestrateJoRequest,
} from './jo/orchestrator.js'
import { analyzeAndSuggest, detectPatterns } from './adaptation/analyze.js'
import {
  createExperiment,
  startExperiment,
  evaluateExperiment,
  decideExperiment,
  EXPERIMENTS_KEY,
  saveExperiments,
} from './experiments/engine.js'
import { emitAdaptiveEvent, loadAdaptiveEvents, ADAPTIVE_EVENTS_KEY, saveAdaptiveEvents } from './events/store.js'
import { createLocalDevelopmentProvider, createDevelopmentJob } from './development/provider.js'
import { tryOpenSystemChange, commitSystemChange, undoSystemChange } from './jo/system-change.js'
import { normalizeMorningRitualConfig } from '../morningGate.js'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
    clear: () => { map.clear() },
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() { return map.size },
  }
}

beforeEach(() => {
  const storage = memoryStorage()
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
  saveChangeHistory([])
  saveAdaptiveEvents([])
  saveExperiments([])
})

describe('ChangeSpec validation', () => {
  it('accepts a typed config change and rejects garbage', () => {
    const ok = validateChangeSpec({
      type: 'CONFIG_CHANGE',
      target: 'surface.now',
      risk: 'LOW',
      reason: 'test',
      operations: [{ op: 'insert', path: 'surfaces/now/excludeEntities', item: 'energy' }],
    })
    expect(ok.ok).toBe(true)
    expect(validateChangeSpec({ type: 'NOPE', operations: [] }).ok).toBe(false)
    expect(validateChangeSpec({
      type: 'CONFIG_CHANGE',
      target: 'auth.secret',
      risk: 'LOW',
      reason: 'hack',
      operations: [{ op: 'set', path: 'secret', value: 'x' }],
    }).ok).toBe(false)
  })

  it('classifies risk for code vs ui vs sensitive', () => {
    expect(classifyRisk('UI_CONFIG_CHANGE', 'ui.lab', ['density'])).toBe('LOW')
    expect(classifyRisk('CODE_CHANGE', 'lab', ['view'])).toBe('HIGH')
    expect(classifyRisk('CRITICAL_CHANGE', 'auth', ['secret'])).toBe('CRITICAL')
  })
})

describe('apply + undo + history', () => {
  it('applies energy exclusion from NOW and undoes it', () => {
    const settings = {
      morningRitual: normalizeMorningRitualConfig(undefined),
      eveningGate: { enabled: true, fromHour: 17, hiddenChecks: [] as string[] },
      adaptive: defaultAdaptiveLifeConfig(),
    }
    const generated = generateChangeSpec(
      'Energy only belongs in Morning and Evening Gate. Remove it from NOW.',
      settings,
    )
    expect('changeSpec' in generated).toBe(true)
    if (!('changeSpec' in generated)) return

    const preview = buildChangePreview(generated.changeSpec)
    expect(preview.summaryLines.some(line => /Energy removed from NOW/i.test(line))).toBe(true)
    expect(preview.risk).toBe('LOW')

    const applied = applyApprovedChange({
      settings,
      spec: generated.changeSpec,
      request: generated.changeSpec.request,
    })
    expect(applied.ok).toBe(true)
    const adaptive = readAdaptiveFromSettings(applied.settings)
    expect(adaptive.surfaces.now.excludeEntities).toContain('energy')
    expect(nowExcludesEntity(adaptive, 'energy')).toBe(true)

    const undone = revertChange({ settings: applied.settings, historyId: applied.history.id })
    expect(undone.ok).toBe(true)
    const restored = readAdaptiveFromSettings(undone.settings)
    expect(restored.surfaces.now.excludeEntities).not.toContain('energy')
  })

  it('moves weight after breakfast in Morning Gate', () => {
    const settings = {
      morningRitual: normalizeMorningRitualConfig(undefined),
      adaptive: defaultAdaptiveLifeConfig(),
    }
    const generated = generateChangeSpec(
      'Move weight after breakfast in Morning Gate.',
      settings,
    )
    expect('changeSpec' in generated).toBe(true)
    if (!('changeSpec' in generated)) return
    const applied = applyChangeSpec(settings, generated.changeSpec)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    const order = applied.settings.morningRitual?.stepOrder as string[]
    const breakfast = order.indexOf('medsShake')
    const weight = order.indexOf('weight')
    expect(weight).toBe(breakfast + 1)
    expect(applied.settings.morningRitual?.hiddenSteps).not.toContain('weight')
  })

  it('applies Lab UI compact + progressive disclosure', () => {
    const settings = { adaptive: defaultAdaptiveLifeConfig() }
    const generated = generateChangeSpec(
      'Make Lab cards more compact and reveal secondary information only when opened.',
      settings,
    )
    expect('changeSpec' in generated).toBe(true)
    if (!('changeSpec' in generated)) return
    expect(generated.changeType).toBe('UI_CONFIG_CHANGE')
    const applied = applyApprovedChange({ settings, spec: generated.changeSpec })
    expect(applied.ok).toBe(true)
    const adaptive = normalizeAdaptiveLifeConfig(applied.settings.adaptive)
    expect(adaptive.surfaces.lab.density).toBe('compact')
    expect(adaptive.surfaces.lab.disclosure).toBe('progressive')
  })

  it('rejects unauthorized critical apply', () => {
    const result = applyApprovedChange({
      settings: { adaptive: defaultAdaptiveLifeConfig() },
      spec: {
        id: 'chg-x',
        type: 'CRITICAL_CHANGE',
        target: 'auth',
        operations: [{ op: 'set', path: 'secret', value: 'x' }],
        reason: 'no',
        risk: 'CRITICAL',
        createdAt: new Date().toISOString(),
      },
    })
    expect(result.ok).toBe(false)
  })
})

describe('Jo CHANGE routing', () => {
  it('routes energy NOW request as CHANGE', () => {
    const classification = classifyJoIntent(
      'Energy only belongs in Morning and Evening Gate. Remove it from NOW.',
    )
    expect(classification.route).toBe('CHANGE')
    expect(classification.changeType).toBe('CONFIG_CHANGE')
  })

  it('distinguishes CODE_CHANGE for comparison view', () => {
    const result = orchestrateJoRequest({
      text: 'Build a comparison view for my last three Lab measurements.',
      settings: {},
    })
    expect(result.route).toBe('CHANGE')
    if (result.route === 'CHANGE') {
      expect(result.classification.changeType).toBe('CODE_CHANGE')
      expect('implementationSpec' in result && result.implementationSpec).toBeTruthy()
    }
  })

  it('keeps metric logs as CAPTURE — does not hijack Jo', () => {
    const samples = [
      'energy low',
      'Energie hoch',
      'Gewicht 72',
      '72.4 kg',
      'Proteinshake getrunken',
      'make 80g protein',
    ]
    for (const text of samples) {
      expect(classifyJoIntent(text).route, text).toBe('CAPTURE')
      expect(tryOpenSystemChange(text, { adaptive: defaultAdaptiveLifeConfig() }), text).toBeNull()
    }
  })

  it('does not force CODE_CHANGE for config requests that mention implement', () => {
    const classification = classifyJoIntent('Implement denser Lab cards with progressive disclosure')
    // "implement" alone with Lab UI phrase should stay UI config if system-change shape matches
    expect(classification.route).toBe('CHANGE')
    expect(classification.changeType).toBe('UI_CONFIG_CHANGE')
  })

  it('falls through to capture when change text is unmapped', () => {
    const session = tryOpenSystemChange('asdf qwerty unrelated', {
      adaptive: defaultAdaptiveLifeConfig(),
    })
    expect(session).toBeNull()
  })

  it('falls through when config noun appears without change intent', () => {
    expect(classifyJoIntent('morning energy check').route).toBe('CAPTURE')
    expect(tryOpenSystemChange('lab overview', { adaptive: defaultAdaptiveLifeConfig() })).toBeNull()
  })

  it('commits and undoes through system-change pathway', () => {
    const settings = {
      morningRitual: normalizeMorningRitualConfig(undefined),
      adaptive: defaultAdaptiveLifeConfig(),
    }
    const session = tryOpenSystemChange(
      'Remove energy from NOW. Only keep it in Morning and Evening Gate.',
      settings,
    )
    expect(session?.kind).toBe('config')
    if (session?.kind !== 'config') return
    const committed = commitSystemChange({ settings, proposal: session.pending.proposal })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    const undone = undoSystemChange({ settings: committed.settings, historyId: committed.history.id })
    expect(undone.ok).toBe(true)
  })
})

describe('NOW deduplication', () => {
  it('excludes gate-owned habits and configured entities', () => {
    const result = applyNowDedupePolicy({
      surface: {
        excludeSources: ['morning_gate', 'evening_gate'],
        excludeEntities: ['energy'],
        dedupe: true,
      },
      gateOwnedKeys: ['coldShower', 'proteinShake'],
      gateOwnedEntities: ['energy'],
      habitKeys: ['coldShower', 'proteinShake', 'focusDone'],
    })
    expect(result.excludeHabitKeys).toEqual(expect.arrayContaining(['coldShower', 'proteinShake']))
    expect(result.suppressEnergyGap).toBe(true)
    expect(result.excludeEntities).toContain('energy')
  })
})

describe('events + adaptation + experiments', () => {
  it('emits events and generates suggestions from skip patterns', () => {
    for (let i = 0; i < 5; i += 1) {
      emitAdaptiveEvent('routine_step.skipped', { entityId: 'energy' })
    }
    emitAdaptiveEvent('routine_step.completed', { entityId: 'energy' })
    const events = loadAdaptiveEvents()
    expect(events[0]?.type).toMatch(/routine_step|suggestion|change|gate|task|meal|metric|experiment/)
    const hits = detectPatterns(events)
    expect(hits.some(hit => hit.kind === 'skipped_step' && hit.key === 'energy')).toBe(true)
    const suggestions = analyzeAndSuggest(events)
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions[0]?.changeSpec?.type).toBe('CONFIG_CHANGE')
  })

  it('runs experiment lifecycle keep/revert', () => {
    const settings = { adaptive: defaultAdaptiveLifeConfig() }
    const variant = {
      id: 'chg-exp',
      type: 'CONFIG_CHANGE' as const,
      target: 'surface.now',
      operations: [{ op: 'insert' as const, path: 'surfaces/now/excludeEntities', item: 'energy' }],
      reason: 'experiment',
      risk: 'LOW' as const,
      createdAt: new Date().toISOString(),
    }
    const experiment = createExperiment({
      hypothesis: 'Removing energy from NOW increases completion',
      target: 'surface.now',
      variant,
    })
    const started = startExperiment({ experiment, settings })
    expect(started.ok).toBe(true)
    const evaluated = evaluateExperiment(started.experiment, 2)
    expect(evaluated.result?.recommendation).toBe('inconclusive')
    const reverted = decideExperiment({
      experiment: { ...evaluated, historyId: started.experiment.historyId },
      decision: 'revert',
      settings: started.settings,
    })
    expect(reverted.ok).toBe(true)
    expect(localStorage.getItem(EXPERIMENTS_KEY)).toBeTruthy()
    expect(localStorage.getItem(CHANGE_HISTORY_KEY)).toBeTruthy()
    expect(localStorage.getItem(ADAPTIVE_EVENTS_KEY)).toBeTruthy()
  })
})

describe('development engine', () => {
  it('creates ImplementationSpec job without mutating production', async () => {
    const result = orchestrateJoRequest({
      text: 'Build a comparison view for my last three Lab measurements.',
      settings: {},
    })
    expect(result.route).toBe('CHANGE')
    if (result.route !== 'CHANGE' || !('implementationSpec' in result) || !result.implementationSpec) {
      throw new Error('expected implementation spec')
    }
    const provider = createLocalDevelopmentProvider()
    const job = createDevelopmentJob(result.implementationSpec, provider.id)
    const plan = await provider.plan(result.implementationSpec)
    expect(plan.steps.length).toBeGreaterThan(2)
    const implement = await provider.implement(result.implementationSpec)
    expect(['queued', 'unsupported']).toContain(implement.status)
    const deploy = await provider.deploy(result.implementationSpec)
    expect(deploy.status).toBe('blocked')
    expect(job.status).toBe('proposed')
  })
})
