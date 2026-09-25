import { describe, expect, it } from 'vitest'
import { emptyLifeOsState } from '../lifeos/store.js'
import {
  applyDecisionBatch,
  batchFromPreview,
  previewFromBatch,
} from './actions.js'
import { defaultRoutineMeals } from './decisions/nutrition.js'
import { runLocalCaptureDecision } from './engine.js'
import { evaluatePolicy } from './policies.js'
import { classifyWithRules } from './providers/rules.js'
import {
  pickRecorderMimeType,
  parseRemoteTranscript,
  TranscriptionError,
  transcribeCaptureAudio,
} from './transcription.js'
import { unsupportedTranscriptionProvider } from './voice.js'

const NOW = new Date('2026-09-21T08:00:00.000Z')
const TODAY = '2026-09-21'
const MEALS = defaultRoutineMeals()
const EMPTY_ENTRY = {
  date: TODAY,
  proteinGrams: 0,
  calories: 0,
  fatGrams: 0,
  carbsGrams: 0,
  fiberGrams: 0,
  appliedMeals: [] as string[],
}

const DEMOS = [
  'Milch kaufen',
  'Morgen Tom anrufen',
  'Notiz: Idee fürs Wochenende',
  'Proteinshake getrunken',
  'Weider bestellen',
  'DHL Claim fertig machen',
  'Irgendwas Wichtiges morgen',
  'Einkaufen: Brot und Butter',
] as const

function decideDemo(text: string) {
  return runLocalCaptureDecision({
    id: `demo-${text.slice(0, 12)}`,
    source: 'quick_add',
    content: text,
    timestamp: NOW.toISOString(),
  }, {
    now: NOW,
    flags: { autoActionsEnabled: false, jevEnabled: false, llmFallbackEnabled: false },
    context: { routineMeals: MEALS },
  })
}

function confirmApply(text: string) {
  const batch = decideDemo(text)
  const preview = previewFromBatch(batch)
  const applied = applyDecisionBatch({
    batch,
    lifeOs: emptyLifeOsState(),
    dashboard: { focusTodos: [], boards: [], goals: [] },
    entry: EMPTY_ENTRY as never,
    routineMeals: MEALS,
    autoActionsEnabled: false,
    confirmedByUser: true,
    today: TODAY,
  })
  return { batch, preview, applied }
}

describe('Jo AI hard demos — speech transcription', () => {
  it('never treats empty live transcript as success', async () => {
    const result = await transcribeCaptureAudio({
      liveTranscript: '   ',
      audioRef: 'blob:demo',
      remote: {
        id: 'remote-whisper',
        async transcribe() {
          return { transcript: 'Milch kaufen' }
        },
      },
    })
    expect(result).toEqual({ transcript: 'Milch kaufen', provider: 'remote-whisper' })
  })

  it('always calls Whisper when no real live speech is provided', async () => {
    let called = 0
    await transcribeCaptureAudio({
      audioRef: 'blob:demo',
      mimeType: 'audio/mp4',
      remote: {
        id: 'remote-whisper',
        async transcribe(input) {
          called += 1
          expect(input.mimeType).toBe('audio/mp4')
          return { transcript: 'Tom anrufen' }
        },
      },
    })
    expect(called).toBe(1)
  })

  it('surfaces unavailable vs empty transcription distinctly', async () => {
    await expect(transcribeCaptureAudio({
      audioRef: 'blob:demo',
      remote: {
        id: 'remote-whisper',
        async transcribe() {
          throw new TranscriptionError('unavailable', 'Spracherkennung ist gerade nicht konfiguriert.')
        },
      },
    })).rejects.toMatchObject({ code: 'unavailable' })

    await expect(transcribeCaptureAudio({
      audioRef: 'blob:demo',
      remote: {
        id: 'remote-whisper',
        async transcribe() {
          throw new TranscriptionError('empty', 'Kein Text erkannt.')
        },
      },
    })).rejects.toMatchObject({ code: 'empty' })
  })

  it('throws on remote provider failure instead of silent null', async () => {
    await expect(transcribeCaptureAudio({
      audioRef: 'blob:demo',
      remote: unsupportedTranscriptionProvider(),
    })).rejects.toThrow()
  })

  it('parses remote transcript payloads strictly', () => {
    expect(parseRemoteTranscript({ transcript: '  Hallo  ' })).toBe('Hallo')
    expect(parseRemoteTranscript({ transcript: '' })).toBeNull()
    expect(parseRemoteTranscript(null)).toBeNull()
  })

  it('exposes a mime picker helper for MediaRecorder', () => {
    expect(() => pickRecorderMimeType()).not.toThrow()
  })
})

describe('Jo AI hard demos — decide → confirm → apply', () => {
  it.each(DEMOS)('confirm-apply creates a store change for: %s', (text) => {
    const { batch, applied } = confirmApply(text)
    expect(batch.proposedActions.length).toBeGreaterThan(0)
    expect(batch.proposedActions[0]?.policyResult).toMatch(/REVIEW|EXECUTE/)

    const meaningful = applied.applied.filter(item => (
      item.intent === 'CREATE_TASK'
      || item.intent === 'CREATE_NOTE'
      || item.intent === 'ADD_SHOPPING_ITEM'
      || item.intent === 'LOG_MEAL'
    ))
    expect(meaningful.length).toBeGreaterThan(0)

    const touchedStore = (
      applied.dashboard.focusTodos.length > 0
      || applied.shoppingAdds.length > 0
      || Boolean(applied.entry && (applied.entry.appliedMeals?.length ?? 0) > 0)
      || applied.lifeOs.knowledge.length > 0
      || applied.lifeOs.captures.some(item => item.status === 'converted')
    )
    expect(touchedStore).toBe(true)
  })

  it('rebuilds apply from preview alone (lost lastCaptureBatchRef)', () => {
    const results = DEMOS.map(text => {
      const batch = decideDemo(text)
      const preview = previewFromBatch(batch)
      const rebuilt = batchFromPreview(preview, {
        id: `lost-${text}`,
        source: 'voice',
        content: text,
        timestamp: NOW.toISOString(),
      })
      return applyDecisionBatch({
        batch: rebuilt,
        lifeOs: emptyLifeOsState(),
        dashboard: { focusTodos: [], boards: [], goals: [] },
        entry: EMPTY_ENTRY as never,
        routineMeals: MEALS,
        autoActionsEnabled: false,
        confirmedByUser: true,
        today: TODAY,
      })
    })

    for (const result of results) {
      expect(result.applied.length).toBeGreaterThan(0)
    }
  })

  it('preserves mealId through preview rebuild so LOG_MEAL still applies', () => {
    const batch = decideDemo('Proteinshake getrunken')
    expect(batch.proposedActions[0]?.entities.mealId).toBe('protein-shake')
    const preview = previewFromBatch(batch)
    expect(preview.items[0]?.mealId).toBe('protein-shake')
    const rebuilt = batchFromPreview(preview, {
      id: 'meal-1',
      source: 'voice',
      content: 'Proteinshake getrunken',
      timestamp: NOW.toISOString(),
    })
    expect(rebuilt.proposedActions[0]?.entities.mealId).toBe('protein-shake')
    const applied = applyDecisionBatch({
      batch: rebuilt,
      lifeOs: emptyLifeOsState(),
      dashboard: { focusTodos: [], boards: [], goals: [] },
      entry: EMPTY_ENTRY as never,
      routineMeals: MEALS,
      autoActionsEnabled: false,
      confirmedByUser: true,
      today: TODAY,
    })
    expect(applied.applied[0]?.intent).toBe('LOG_MEAL')
    expect(applied.entry?.appliedMeals).toContain('protein-shake')
  })

  it('falls back to a note when confirmed LOG_MEAL has no meal context', () => {
    const batch = decideDemo('Proteinshake getrunken')
    const applied = applyDecisionBatch({
      batch,
      lifeOs: emptyLifeOsState(),
      dashboard: { focusTodos: [], boards: [], goals: [] },
      autoActionsEnabled: false,
      confirmedByUser: true,
      today: TODAY,
    })
    expect(applied.applied[0]?.intent).toBe('CREATE_NOTE')
    expect(
      applied.lifeOs.knowledge.length
      + applied.lifeOs.captures.filter(item => item.status === 'converted').length,
    ).toBeGreaterThan(0)
  })

  it('keeps due override from preview when rebuilding the batch', () => {
    const batch = decideDemo('Morgen Tom anrufen')
    const preview = previewFromBatch(batch)
    preview.items[0] = { ...preview.items[0], due: '2026-09-25' }
    const rebuilt = batchFromPreview(preview, {
      id: 'due-1',
      source: 'quick_add',
      content: 'Morgen Tom anrufen',
      timestamp: NOW.toISOString(),
    })
    expect(rebuilt.proposedActions[0]?.entities.due).toBe('2026-09-25')
    const applied = applyDecisionBatch({
      batch: rebuilt,
      lifeOs: emptyLifeOsState(),
      dashboard: { focusTodos: [], boards: [], goals: [] },
      autoActionsEnabled: false,
      confirmedByUser: true,
      today: TODAY,
    })
    expect(applied.dashboard.focusTodos[0]?.title).toMatch(/Tom/i)
  })

  it('does not wipe concrete intent when domain is UNKNOWN', () => {
    const candidate = {
      content: 'Random stuff',
      domain: 'UNKNOWN' as const,
      intent: 'CREATE_TASK' as const,
      confidence: 0.5,
      entities: { title: 'Random stuff' },
      suggestedAction: 'CREATE_TASK' as const,
      reasonCode: 'UNKNOWN_INTENT' as const,
    }
    const verdict = evaluatePolicy({
      candidate,
      context: { now: NOW },
      flags: {
        autoActionsEnabled: false,
        jevEnabled: false,
        llmFallbackEnabled: false,
        jevTimeoutMs: 2500,
        llmTimeoutMs: 2500,
      },
    })
    expect(verdict.result).toBe('REVIEW')
    expect(verdict.intent).toBe('CREATE_TASK')
  })

  it('rules fallback prefers CREATE_TASK over dead REVIEW for free text', () => {
    const decision = classifyWithRules('Freier Gedanke ohne Keyword', { now: NOW })
    expect(decision.intent).toBe('CREATE_TASK')
    expect(decision.suggestedAction).toBe('CREATE_TASK')
    expect(decision.domain).toBe('TASK')
  })

  it('without confirm and without auto-actions, stores stay untouched', () => {
    const batch = decideDemo('Milch kaufen')
    const result = applyDecisionBatch({
      batch,
      lifeOs: emptyLifeOsState(),
      dashboard: { focusTodos: [], boards: [], goals: [] },
      autoActionsEnabled: false,
      confirmedByUser: false,
      today: TODAY,
    })
    expect(result.applied).toHaveLength(0)
    expect(result.dashboard.focusTodos).toHaveLength(0)
  })
})

describe('Jo AI hard demos — multi-item confirm filter', () => {
  it('applies only kept action ids from a multi-item preview', () => {
    const batch = runLocalCaptureDecision({
      id: 'multi-1',
      source: 'quick_add',
      content: 'Tom anrufen und dann Milch kaufen',
      timestamp: NOW.toISOString(),
    }, {
      now: NOW,
      flags: { autoActionsEnabled: false, jevEnabled: false, llmFallbackEnabled: false },
      context: { routineMeals: MEALS },
    })
    expect(batch.proposedActions.length).toBeGreaterThan(1)
    const keepId = batch.proposedActions[0]?.actionId
    expect(keepId).toBeTruthy()
    const filtered = {
      ...batch,
      proposedActions: batch.proposedActions.filter(action => action.actionId === keepId),
      decisions: batch.decisions.filter((_decision, index) => batch.proposedActions[index]?.actionId === keepId),
    }
    const applied = applyDecisionBatch({
      batch: filtered,
      lifeOs: emptyLifeOsState(),
      dashboard: { focusTodos: [], boards: [], goals: [] },
      autoActionsEnabled: false,
      confirmedByUser: true,
      today: TODAY,
    })
    expect(applied.applied).toHaveLength(1)
    expect(applied.applied[0]?.actionId).toBe(keepId)
  })
})
