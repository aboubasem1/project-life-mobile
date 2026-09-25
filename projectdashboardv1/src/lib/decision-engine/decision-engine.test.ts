import { describe, expect, it } from 'vitest'
import { applyMealToEntry } from '../dailyFlow.js'
import { emptyLifeOsState } from '../lifeos/store.js'
import { applyDecisionBatch, batchFromPreview, previewFromBatch } from './actions.js'
import { confidenceBand, configureConfidenceThresholds, resetConfidenceThresholds } from './confidence.js'
import { decide, runLocalCaptureDecision } from './engine.js'
import { actionKey, replayGuard } from './idempotency.js'
import { isBlankInput, normalizeText, normalizeVoiceTranscript, toLifeOSInput } from './normalize.js'
import { actionLevelFor, evaluatePolicy } from './policies.js'
import { classifyWithRules } from './providers/rules.js'
import { buildSystemOneRequest, mapSystemOneAnswers } from './providers/jev.js'
import { parseProviderDecision } from './schemas.js'
import { splitIntents } from './split.js'
import { DECISION_DOMAINS, type DecisionProviderAdapter, type ProviderDecision } from './types.js'
import { parseRemoteTranscript, TranscriptionError, transcribeCaptureAudio } from './transcription.js'
import { createVoiceMemo, transcribeVoiceMemo, unsupportedTranscriptionProvider } from './voice.js'

const NOW = new Date('2026-09-21T08:00:00.000Z')
const PROJECTS = [
  { id: 'work', label: 'Arbeit' },
  { id: 'dhl', label: 'DHL Claims' },
]

async function decideText(text: string, extra: Parameters<typeof decide>[1] = {}) {
  return decide({
    id: 'in-test',
    source: 'quick_add',
    content: text,
    timestamp: NOW.toISOString(),
  }, {
    now: NOW,
    context: { now: NOW, timeZone: 'Europe/Berlin', projects: PROJECTS, ...extra.context },
    flags: { jevEnabled: false, autoActionsEnabled: false, llmFallbackEnabled: false, ...extra.flags },
    providers: extra.providers,
  })
}

describe('normalization', () => {
  it('trims and maps string input to LifeOSInput', () => {
    const input = toLifeOSInput('  Mass Gainer getrunken  ', { id: 'a', timestamp: NOW.toISOString() })
    expect(input?.content).toBe('Mass Gainer getrunken')
    expect(input?.source).toBe('quick_add')
    expect(normalizeText('  a \n\n\n b  ')).toBe('a \n\n b')
  })

  it('prepares voice transcripts without sending audio', () => {
    const input = normalizeVoiceTranscript({ id: 'vm1', transcript: '  Merken: Idee  ', audioRef: 'blob:1' })
    expect(input.source).toBe('voice')
    expect(input.content).toBe('Merken: Idee')
    expect(input.audioRef).toBe('blob:1')
  })

  it('treats empty and punctuation-only input as blank', () => {
    expect(isBlankInput('')).toBe(true)
    expect(isBlankInput('   ')).toBe(true)
    expect(isBlankInput('?')).toBe(true)
    expect(isBlankInput('Hab meinen Mass Gainer getrunken')).toBe(false)
  })
})

describe('schema validation', () => {
  it('accepts a typed provider decision and rejects garbage', () => {
    const ok = parseProviderDecision({
      domain: 'NUTRITION',
      intent: 'LOG_MEAL',
      confidence: 0.97,
      entities: { product: 'WEIDER_MASS_GAINER' },
    }, 'shake')
    expect(ok?.domain).toBe('NUTRITION')
    expect(parseProviderDecision({ domain: 'FOOD', intent: 'EAT' }, 'x')).toBeNull()
    expect(parseProviderDecision(null, 'x')).toBeNull()
  })
})

describe('confidence gates', () => {
  it('uses central thresholds', () => {
    expect(confidenceBand(0.9)).toBe('high')
    expect(confidenceBand(0.89)).toBe('medium')
    expect(confidenceBand(0.69)).toBe('low')
    configureConfidenceThresholds({ high: 0.95, medium: 0.8 })
    expect(confidenceBand(0.9)).toBe('medium')
    resetConfidenceThresholds()
    expect(confidenceBand(0.9)).toBe('high')
  })
})

describe('action risk levels', () => {
  it('maps intents onto the three safety classes', () => {
    expect(actionLevelFor('CLASSIFY')).toBe('SAFE_AUTO')
    expect(actionLevelFor('LOG_MEAL')).toBe('REVERSIBLE_AUTO')
    expect(actionLevelFor('CREATE_TASK')).toBe('REVERSIBLE_AUTO')
    expect(actionLevelFor('DELETE')).toBe('CONFIRM')
    expect(actionLevelFor('PURCHASE')).toBe('CONFIRM')
    expect(actionLevelFor('UPDATE_CALENDAR')).toBe('CONFIRM')
  })
})

describe('policy engine', () => {
  it('does not invent a meal and asks for information instead', () => {
    const verdict = evaluatePolicy({
      candidate: {
        content: 'irgendwas getrunken',
        domain: 'NUTRITION',
        intent: 'LOG_MEAL',
        confidence: 0.97,
        entities: { product: 'UNKNOWN_DRINK' },
      },
      context: { now: NOW },
      flags: { jevEnabled: true, autoActionsEnabled: true, llmFallbackEnabled: false, jevTimeoutMs: 2500, llmTimeoutMs: 4000 },
    })
    expect(verdict.result).toBe('REQUEST_INFORMATION')
    expect(verdict.reasons).toContain('MEAL_NOT_FOUND')
  })

  it('authorizes a known routine meal only when auto actions are on', () => {
    const candidate: ProviderDecision = {
      content: 'Hab meinen Mass Gainer getrunken',
      domain: 'NUTRITION',
      intent: 'LOG_MEAL',
      confidence: 0.97,
      entities: { product: 'mass gainer' },
    }
    const review = evaluatePolicy({
      candidate,
      context: { now: NOW },
      flags: { jevEnabled: true, autoActionsEnabled: false, llmFallbackEnabled: false, jevTimeoutMs: 2500, llmTimeoutMs: 4000 },
    })
    expect(review.result).toBe('REVIEW')
    expect(review.intent).toBe('LOG_MEAL')
    expect(review.entities?.mealId).toBe('protein-shake')

    const execute = evaluatePolicy({
      candidate,
      context: { now: NOW },
      flags: { jevEnabled: true, autoActionsEnabled: true, llmFallbackEnabled: false, jevTimeoutMs: 2500, llmTimeoutMs: 4000 },
    })
    expect(execute.result).toBe('EXECUTE')
    expect(execute.actionLevel).toBe('REVERSIBLE_AUTO')
  })

  it('never auto-executes confirm-level intents', () => {
    const verdict = evaluatePolicy({
      candidate: { content: 'lösche alles', domain: 'SYSTEM', intent: 'DELETE', confidence: 0.99 },
      context: { now: NOW },
      flags: { jevEnabled: true, autoActionsEnabled: true, llmFallbackEnabled: false, jevTimeoutMs: 2500, llmTimeoutMs: 4000 },
    })
    expect(verdict.result).toBe('REVIEW')
    expect(verdict.actionLevel).toBe('CONFIRM')
    expect(verdict.requiresConfirmation).toBe(true)
  })

  it('keeps CREATE_TASK intent when confidence only warrants review', () => {
    const verdict = evaluatePolicy({
      candidate: {
        content: 'LifeOS zu Ende programmieren',
        domain: 'TASK',
        intent: 'CREATE_TASK',
        confidence: 0.72,
        entities: { title: 'LifeOS zu Ende programmieren' },
        suggestedAction: 'CREATE_TASK',
      },
      context: { now: NOW },
      flags: { jevEnabled: true, autoActionsEnabled: false, llmFallbackEnabled: false, jevTimeoutMs: 2500, llmTimeoutMs: 4000 },
    })
    expect(verdict.result).toBe('REVIEW')
    expect(verdict.intent).toBe('CREATE_TASK')
  })
})

describe('required capture inputs', () => {
  it('recognizes a routine mass gainer meal without inventing macros', () => {
    const local = runLocalCaptureDecision('Hab meinen Mass Gainer getrunken', { now: NOW })
    expect(local.decisions).toHaveLength(1)
    expect(local.decisions[0]?.domain).toBe('NUTRITION')
    expect(local.decisions[0]?.intent).toBe('LOG_MEAL')
    expect(local.decisions[0]?.entities.mealId).toBe('protein-shake')
    expect(local.decisions[0]?.confidence).toBeGreaterThanOrEqual(0.9)
    expect(local.decisions[0]?.policyResult).toBe('REVIEW')
  })

  it('routes Weider order as a shopping task due tomorrow', async () => {
    const batch = await decideText('Morgen Weider bestellen')
    expect(batch.decisions).toHaveLength(1)
    expect(batch.decisions[0]?.domain).toBe('SHOPPING')
    expect(batch.decisions[0]?.intent).toBe('CREATE_TASK')
    expect(batch.decisions[0]?.entities.due).toBe('2026-09-22')
  })

  it('routes DHL claims to work and the matching project', async () => {
    const batch = await decideText('DHL Claims morgen fertig machen')
    expect(batch.decisions[0]?.domain).toBe('WORK')
    expect(batch.decisions[0]?.intent).toBe('CREATE_TASK')
    expect(batch.decisions[0]?.entities.due).toBe('2026-09-22')
    expect(batch.decisions[0]?.entities.projectId).toBe('dhl')
    expect(batch.decisions[0]?.entities.priority).toBe('p2')
  })

  it('splits meal plus shopping into two decisions', async () => {
    const batch = await decideText('Mass Gainer getrunken und morgen Weider bestellen')
    expect(batch.items.length).toBe(2)
    expect(batch.decisions.map(item => item.domain)).toEqual(['NUTRITION', 'SHOPPING'])
    expect(batch.decisions.map(item => item.intent)).toEqual(['LOG_MEAL', 'CREATE_TASK'])
  })

  it('captures a note from merken prefix', async () => {
    const batch = await decideText('Merken: LifeOS Dashboard weiter vereinfachen')
    expect(batch.decisions[0]?.domain).toBe('NOTE')
    expect(batch.decisions[0]?.intent).toBe('CREATE_NOTE')
    expect(batch.decisions[0]?.entities.title).toContain('LifeOS')
  })

  it('routes a phone call as a task due tomorrow', async () => {
    const batch = await decideText('Ich muss morgen Tom anrufen')
    expect(batch.decisions[0]?.domain).toBe('TASK')
    expect(batch.decisions[0]?.intent).toBe('CREATE_TASK')
    expect(batch.decisions[0]?.entities.due).toBe('2026-09-22')
    expect(batch.decisions[0]?.content).toMatch(/Tom/i)
  })

  it('keeps hedged shopping ideas at low confidence for review', async () => {
    const batch = await decideText('Vielleicht irgendwann mal Weider testen')
    expect(batch.decisions[0]?.confidence).toBeLessThan(0.7)
    expect(batch.decisions[0]?.policyResult).toBe('REVIEW')
    expect(['HEDGE_LANGUAGE', 'LOW_CONFIDENCE']).toContain(batch.decisions[0]?.reasonCode)
  })

  it('reviews a lone question mark without crashing', async () => {
    const batch = await decideText('?')
    expect(batch.decisions[0]?.domain).toBe('UNKNOWN')
    expect(batch.decisions[0]?.policyResult).toBe('REVIEW')
    expect(batch.decisions[0]?.reasonCode).toBe('UNKNOWN_INTENT')
  })

  it('rejects empty input', async () => {
    const batch = await decideText('   ')
    expect(batch.decisions[0]?.reasonCode).toBe('EMPTY_INPUT')
    expect(batch.decisions[0]?.policyResult).toBe('REVIEW')
  })
})

describe('multi intent splitting', () => {
  it('does not smash two clauses into one task', () => {
    const items = splitIntents('Morgen Weider bestellen und Tom wegen DHL anrufen.')
    expect(items).toHaveLength(2)
    expect(items[0]?.content).toMatch(/Weider/i)
    expect(items[1]?.content).toMatch(/Tom/i)
  })

  it('splits sequential to-dos joined with und dann', () => {
    const items = splitIntents('Routine abschließen und dann LifeOS zu Ende programmieren')
    expect(items.length).toBeGreaterThanOrEqual(2)
    expect(items[0]?.content).toMatch(/Routine/i)
    expect(items.at(-1)?.content).toMatch(/LifeOS|programmieren/i)
  })

  it('keeps a single note idea together', () => {
    expect(splitIntents('Merken: Idee für LifeOS Dashboard und Voice')).toHaveLength(1)
  })
})

describe('JEV disabled and failure', () => {
  it('works with JEV disabled and never calls the JEV adapter', async () => {
    let called = 0
    const jev: DecisionProviderAdapter = {
      id: 'jev',
      async decide() {
        called += 1
        return null
      },
    }
    const batch = await decideText('Morgen Weider bestellen', {
      flags: { jevEnabled: false },
      providers: { jev },
    })
    expect(called).toBe(0)
    expect(batch.provider).toBe('rules')
    expect(batch.decisions[0]?.intent).toBe('CREATE_TASK')
  })

  it('falls back to rules when JEV times out', async () => {
    const jev: DecisionProviderAdapter = {
      id: 'jev',
      async decide() {
        const error = new Error('timeout')
        error.name = 'AbortError'
        throw error
      },
    }
    const batch = await decideText('irgendwas komisches notieren vielleicht', {
      flags: { jevEnabled: true, autoActionsEnabled: false, llmFallbackEnabled: false },
      providers: { jev },
    })
    expect(batch.decisions[0]?.provider).toBe('rules')
    expect(batch.decisions[0]?.policyResult).toBe('REVIEW')
    expect(batch.audits[0]?.error).toMatch(/timeout|AbortError/i)
  })

  it('falls back to rules when JEV fails', async () => {
    const jev: DecisionProviderAdapter = {
      id: 'jev',
      async decide() {
        throw new Error('offline')
      },
    }
    const batch = await decideText('irgendwas komisches notieren vielleicht', {
      flags: { jevEnabled: true, autoActionsEnabled: false, llmFallbackEnabled: false },
      providers: { jev },
    })
    expect(batch.decisions[0]?.provider).toBe('rules')
    expect(batch.decisions[0]?.policyResult).toBe('REVIEW')
    expect(batch.audits[0]?.error).toBe('offline')
  })

  it('uses a valid JEV decision when the adapter returns one', async () => {
    const jev: DecisionProviderAdapter = {
      id: 'jev',
      async decide() {
        return {
          content: 'Hab meinen Mass Gainer getrunken',
          domain: 'NUTRITION',
          intent: 'LOG_MEAL',
          confidence: 0.97,
          entities: { product: 'WEIDER_MASS_GAINER' },
          suggestedAction: 'LOG_MEAL',
          reasonCode: 'OK',
        }
      },
    }
    const batch = await decideText('etwas Unklares getrunken', {
      flags: { jevEnabled: true, autoActionsEnabled: false, llmFallbackEnabled: false },
      providers: { jev },
    })
    expect(batch.decisions[0]?.provider).toBe('jev')
    expect(batch.decisions[0]?.entities.mealId).toBe('protein-shake')
  })
})

describe('TypeSafe System One mapping', () => {
  it('maps Choice and Noul answers into a LifeOS decision without inventing meals', () => {
    const mapped = mapSystemOneAnswers({
      model: 'jev-1.13.0',
      answers: {
        domain: { type: 'choice', choice: 'NUTRITION', confidence: 0.91 },
        intent: { type: 'choice', choice: 'LOG_MEAL', confidence: 0.88 },
        hedge: { type: 'noul', noul: 0.04 },
        meal: { type: 'choice', choice: 'protein-shake', confidence: 0.93 },
        project: { type: 'choice', choice: 'none', confidence: 0.8 },
      },
    }, 'Hab meinen Mass Gainer getrunken')
    expect(mapped?.domain).toBe('NUTRITION')
    expect(mapped?.intent).toBe('LOG_MEAL')
    expect(mapped?.entities?.mealId).toBe('protein-shake')
    expect(mapped?.confidence).toBe(0.88)
    expect(mapped?.reasonCode).toBe('OK')
  })

  it('rejects a TypeSafe payload that is not Choice/Noul answers', () => {
    expect(mapSystemOneAnswers({ decision: { domain: 'NUTRITION', intent: 'LOG_MEAL' } }, 'x')).toBeNull()
  })

  it('builds a System One request with named state and parallel questions', () => {
    const request = buildSystemOneRequest({
      item: { index: 0, content: 'Morgen Weider bestellen', original: 'Morgen Weider bestellen' },
      input: { id: 'in-1', source: 'quick_add', content: 'Morgen Weider bestellen', timestamp: NOW.toISOString() },
      context: { now: NOW, projects: PROJECTS },
    })
    expect(request.model).toBe('jev-latest')
    expect(request.state.content).toBe('Morgen Weider bestellen')
    expect(request.questions.domain).toMatchObject({ type: 'choice' })
    expect(request.questions.intent).toMatchObject({ type: 'choice' })
    expect(request.questions.hedge).toMatchObject({ type: 'noul' })
  })
})

describe('low confidence', () => {
  it('does not authorize execution below the high threshold for reversible actions', () => {
    const verdict = evaluatePolicy({
      candidate: classifyWithRules('Vielleicht irgendwann mal Weider testen', { now: NOW }),
      context: { now: NOW },
      flags: { jevEnabled: true, autoActionsEnabled: true, llmFallbackEnabled: false, jevTimeoutMs: 2500, llmTimeoutMs: 4000 },
    })
    expect(verdict.result).toBe('REVIEW')
  })
})

describe('idempotency and task/meal apply', () => {
  it('does not create a second meal or task on retry', () => {
    const batch = runLocalCaptureDecision({
      id: 'stable-input',
      source: 'quick_add',
      content: 'Hab meinen Mass Gainer getrunken',
      timestamp: NOW.toISOString(),
    }, {
      now: NOW,
      flags: { autoActionsEnabled: true, jevEnabled: false, llmFallbackEnabled: false },
    })
    expect(batch.proposedActions[0]?.actionId).toBe(actionKey([
      'stable-input',
      0,
      batch.decisions[0]?.intent,
      batch.decisions[0]?.domain,
      batch.decisions[0]?.content,
      batch.decisions[0]?.entities.mealId,
      batch.decisions[0]?.entities.title,
    ]))

    const meal = {
      id: 'protein-shake',
      label: 'Proteinshake',
      proteinGrams: 30,
      calories: 180,
      fatGrams: 3,
      carbsGrams: 8,
      fiberGrams: 0,
    }
    const entry = {
      date: '2026-09-21',
      proteinGrams: 0,
      calories: 0,
      fatGrams: 0,
      carbsGrams: 0,
      fiberGrams: 0,
      appliedMeals: [] as string[],
    }
    const first = applyDecisionBatch({
      batch,
      lifeOs: emptyLifeOsState(),
      dashboard: { focusTodos: [], boards: [], goals: [] },
      entry: entry as never,
      routineMeals: [meal],
      autoActionsEnabled: true,
      today: '2026-09-21',
    })
    expect(first.applied).toHaveLength(1)
    expect(first.entry?.appliedMeals).toEqual(['protein-shake'])

    const second = applyDecisionBatch({
      batch,
      lifeOs: first.lifeOs,
      dashboard: first.dashboard,
      entry: first.entry,
      routineMeals: [meal],
      executedKeys: first.executedKeys,
      autoActionsEnabled: true,
      today: '2026-09-21',
    })
    expect(second.applied).toHaveLength(0)
    expect(second.skipped[0]?.reason).toBe('IDEMPOTENT_REPLAY')
    expect(replayGuard(first.executedKeys, batch.proposedActions[0]?.actionId ?? '')).toBe(true)

    const again = applyMealToEntry(first.entry as never, meal)
    expect(again).toEqual({})
  })

  it('creates a task once when auto actions are enabled', () => {
    const batch = runLocalCaptureDecision({
      id: 'task-1',
      source: 'quick_add',
      content: 'Morgen Weider bestellen',
      timestamp: NOW.toISOString(),
    }, {
      now: NOW,
      flags: { autoActionsEnabled: true, jevEnabled: false, llmFallbackEnabled: false },
    })
    const first = applyDecisionBatch({
      batch,
      lifeOs: emptyLifeOsState(),
      dashboard: { focusTodos: [], boards: [], goals: [] },
      autoActionsEnabled: true,
      today: '2026-09-21',
    })
    expect(first.dashboard.focusTodos).toHaveLength(1)
    const second = applyDecisionBatch({
      batch,
      lifeOs: first.lifeOs,
      dashboard: first.dashboard,
      executedKeys: first.executedKeys,
      autoActionsEnabled: true,
      today: '2026-09-21',
    })
    expect(second.dashboard.focusTodos).toHaveLength(1)
    expect(second.skipped[0]?.reason).toBe('IDEMPOTENT_REPLAY')
  })

  it('does nothing to stores when auto actions are disabled', () => {
    const batch = runLocalCaptureDecision('Morgen Weider bestellen', {
      now: NOW,
      flags: { autoActionsEnabled: false },
    })
    const result = applyDecisionBatch({
      batch,
      lifeOs: emptyLifeOsState(),
      dashboard: { focusTodos: [], boards: [], goals: [] },
      autoActionsEnabled: false,
      today: '2026-09-21',
    })
    expect(result.applied).toHaveLength(0)
    expect(result.dashboard.focusTodos).toHaveLength(0)
  })
})

describe('voice memo pipeline', () => {
  it('uses Whisper first when audio is present, even with a parallel live transcript', async () => {
    let called = 0
    const result = await transcribeCaptureAudio({
      liveTranscript: '  Mass Gainer getrunken  ',
      audioRef: 'blob:1',
      remote: {
        id: 'remote-whisper',
        async transcribe() {
          called += 1
          return { transcript: 'Mass Gainer getrunken' }
        },
      },
    })
    expect(result).toEqual({ transcript: 'Mass Gainer getrunken', provider: 'remote-whisper' })
    expect(called).toBe(1)
    expect(parseRemoteTranscript({ transcript: '  Weider bestellen  ' })).toBe('Weider bestellen')
    expect(parseRemoteTranscript({ ok: true })).toBeNull()
  })

  it('falls back to parallel live transcript when Whisper is busy', async () => {
    const result = await transcribeCaptureAudio({
      liveTranscript: 'Milch kaufen',
      audioRef: 'blob:1',
      remote: {
        id: 'remote-whisper',
        async transcribe() {
          throw new TranscriptionError('busy', 'ausgelastet')
        },
      },
    })
    expect(result).toEqual({ transcript: 'Milch kaufen', provider: 'webkit-speech-fallback' })
  })

  it('uses the remote provider when live speech is empty', async () => {
    const result = await transcribeCaptureAudio({
      liveTranscript: '   ',
      audioRef: 'blob:1',
      remote: {
        id: 'remote-whisper',
        async transcribe() {
          return { transcript: 'Morgen Tom anrufen' }
        },
      },
    })
    expect(result).toEqual({ transcript: 'Morgen Tom anrufen', provider: 'remote-whisper' })
  })

  it('throws when remote transcription fails', async () => {
    await expect(transcribeCaptureAudio({
      audioRef: 'blob:1',
      remote: unsupportedTranscriptionProvider(),
    })).rejects.toThrow()
  })

  it('applies confirmed REVIEW proposals as tasks', () => {
    const batch = runLocalCaptureDecision({
      id: 'confirm-1',
      source: 'quick_add',
      content: 'Irgendwas Wichtiges morgen',
      timestamp: NOW.toISOString(),
    }, {
      now: NOW,
      flags: { autoActionsEnabled: false, jevEnabled: false, llmFallbackEnabled: false },
    })
    expect(batch.proposedActions[0]?.policyResult).toBe('REVIEW')
    const result = applyDecisionBatch({
      batch,
      lifeOs: emptyLifeOsState(),
      dashboard: { focusTodos: [], boards: [], goals: [] },
      autoActionsEnabled: false,
      confirmedByUser: true,
      today: '2026-09-21',
    })
    expect(result.applied.some(item => item.intent === 'CREATE_TASK')).toBe(true)
    expect(result.dashboard.focusTodos.length).toBeGreaterThan(0)
  })

  it('rebuilds an applyable batch from preview when the live ref is gone', () => {
    const batch = runLocalCaptureDecision({
      id: 'preview-1',
      source: 'quick_add',
      content: 'Milch kaufen',
      timestamp: NOW.toISOString(),
    }, {
      now: NOW,
      flags: { autoActionsEnabled: false, jevEnabled: false, llmFallbackEnabled: false },
    })
    const preview = previewFromBatch(batch)
    const rebuilt = batchFromPreview(preview, {
      id: 'preview-1',
      source: 'quick_add',
      content: 'Milch kaufen',
      timestamp: NOW.toISOString(),
    })
    const result = applyDecisionBatch({
      batch: rebuilt,
      lifeOs: emptyLifeOsState(),
      dashboard: { focusTodos: [], boards: [], goals: [] },
      autoActionsEnabled: false,
      confirmedByUser: true,
      today: '2026-09-21',
    })
    expect(result.dashboard.focusTodos[0]?.title).toMatch(/Milch/i)
  })

  it('keeps an aborted memo pending without derived items', () => {
    const memo = createVoiceMemo({
      id: 'vm-cancel',
      audioRef: 'blob:abort',
      createdAt: NOW.toISOString(),
      durationSec: 3,
    })
    expect(memo.transcriptionStatus).toBe('pending')
    expect(memo.processingStatus).toBe('idle')
    expect(memo.derivedItems).toEqual([])
  })

  it('marks transcription failure without crashing the capture path', async () => {
    const memo = createVoiceMemo({
      id: 'vm-fail',
      audioRef: 'blob:fail',
      createdAt: NOW.toISOString(),
    })
    const failed = await transcribeVoiceMemo(memo, unsupportedTranscriptionProvider())
    expect(failed.transcriptionStatus).toBe('failed')
    expect(failed.processingStatus).toBe('failed')
    expect(failed.derivedItems).toEqual([])
  })
})

describe('prepared domains', () => {
  it('keeps HEALTH as a first-class domain without inventing values', () => {
    expect(DECISION_DOMAINS).toContain('HEALTH')
    expect(DECISION_DOMAINS).toContain('ROUTINE')
  })
})
