import { describe, expect, it } from 'vitest'
import { emptyLifeOsState } from '../lifeos/store.js'
import {
  applyDecisionBatch,
  batchFromPreview,
  previewFromBatch,
} from './actions.js'
import { defaultRoutineMeals } from './decisions/nutrition.js'
import { runLocalCaptureDecision } from './engine.js'
import {
  TranscriptionError,
  parseRemoteTranscript,
  pickRecorderMimeType,
  remoteTranscriptionProvider,
  transcribeCaptureAudio,
} from './transcription.js'

const NOW = new Date('2026-09-21T08:00:00.000Z')
const TODAY = '2026-09-21'
const MEALS = defaultRoutineMeals()
const ENTRY = {
  date: TODAY,
  proteinGrams: 0,
  calories: 0,
  fatGrams: 0,
  carbsGrams: 0,
  fiberGrams: 0,
  appliedMeals: [] as string[],
}

const ADVERSARIAL = [
  '',
  '   ',
  '?',
  '<script>alert(1)</script>',
  '"; DROP TABLE captures;--',
  '🥛 Milch kaufen',
  'A'.repeat(4000),
  'http://evil.example/phishing',
  'TODO: ${process.env.SECRET}',
  'null',
  'undefined',
  'NaN',
]

function decide(text: string) {
  return runLocalCaptureDecision({
    id: `pen-${text.slice(0, 16) || 'empty'}`,
    source: 'quick_add',
    content: text,
    timestamp: NOW.toISOString(),
  }, {
    now: NOW,
    flags: { autoActionsEnabled: false, jevEnabled: false, llmFallbackEnabled: false },
    context: { routineMeals: MEALS },
  })
}

describe('Jo AI pen — adversarial decide/apply', () => {
  it.each(ADVERSARIAL.filter(text => text.trim() && text !== '?' && text !== '??'))(
    'does not crash decide/apply for: %s',
    (text) => {
      const batch = decide(text.slice(0, 500))
      expect(batch.decisions.length).toBeGreaterThan(0)
      const applied = applyDecisionBatch({
        batch,
        lifeOs: emptyLifeOsState(),
        dashboard: { focusTodos: [], boards: [], goals: [] },
        entry: ENTRY as never,
        routineMeals: MEALS,
        autoActionsEnabled: false,
        confirmedByUser: true,
        today: TODAY,
      })
      // Either applied something meaningful or skipped cleanly — never throw / corrupt.
      expect(applied.skipped.length + applied.applied.length).toBe(batch.proposedActions.length)
    },
  )

  it('blank and lone punctuation stay review/empty without applyables when unconfirmed', () => {
    for (const text of ['', '   ', '?']) {
      const batch = decide(text)
      expect(batch.decisions[0]?.policyResult).toBe('REVIEW')
      const applied = applyDecisionBatch({
        batch,
        lifeOs: emptyLifeOsState(),
        dashboard: { focusTodos: [], boards: [], goals: [] },
        autoActionsEnabled: false,
        confirmedByUser: false,
        today: TODAY,
      })
      expect(applied.applied).toHaveLength(0)
    }
  })

  it('script tags are treated as plain task content, not executed intents', () => {
    const batch = decide('<script>alert(1)</script> Milch kaufen')
    const preview = previewFromBatch(batch)
    expect(preview.items[0]?.content).toContain('Milch')
    const applied = applyDecisionBatch({
      batch,
      lifeOs: emptyLifeOsState(),
      dashboard: { focusTodos: [], boards: [], goals: [] },
      autoActionsEnabled: false,
      confirmedByUser: true,
      today: TODAY,
    })
    expect(applied.dashboard.focusTodos[0]?.title).toContain('Milch')
  })

  it('meal preview keeps LOG_MEAL suggestedAction for UI labeling', () => {
    const batch = decide('Proteinshake getrunken')
    const preview = previewFromBatch(batch)
    expect(preview.items[0]?.suggestedAction).toBe('LOG_MEAL')
    expect(preview.items[0]?.mealId).toBe('protein-shake')
    expect(preview.items[0]?.mealLabel).toMatch(/protein|shake/i)
  })

  it('due override on live batch + preview merge wins', () => {
    const batch = decide('Morgen Tom anrufen')
    const preview = previewFromBatch(batch)
    preview.items[0] = { ...preview.items[0], due: '2026-12-01', content: 'Tom anrufen (verschoben)' }
    const rebuilt = batchFromPreview(preview, {
      id: 'pen-due',
      source: 'quick_add',
      content: 'Morgen Tom anrufen',
      timestamp: NOW.toISOString(),
    })
    expect(rebuilt.proposedActions[0]?.entities.due).toBe('2026-12-01')
    expect(rebuilt.proposedActions[0]?.entities.title).toContain('Tom')
  })
})

describe('Jo AI pen — transcription hardening', () => {
  it('rejects missing audioRef', async () => {
    await expect(transcribeCaptureAudio({})).rejects.toBeInstanceOf(TranscriptionError)
  })

  it('propagates remote 503 as unavailable', async () => {
    await expect(transcribeCaptureAudio({
      audioRef: 'blob:demo',
      remote: {
        id: 'remote-whisper',
        async transcribe() {
          throw new TranscriptionError('unavailable', 'Spracherkennung ist gerade nicht konfiguriert.')
        },
      },
    })).rejects.toMatchObject({ code: 'unavailable' })
  })

  function audioDataUrl(byteLength = 64): string {
    const bytes = new Uint8Array(byteLength).fill(1)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return `data:audio/webm;base64,${btoa(binary)}`
  }

  function mockAudioThenApi(status: number, body: unknown = { error: 'x' }) {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        return new Response(new Uint8Array(64), { status: 200 })
      }
      return new Response(JSON.stringify(body), { status })
    }) as typeof fetch
    return () => {
      globalThis.fetch = originalFetch
    }
  }

  it('maps HTTP 429 as busy with a tip-to-type message', async () => {
    const restore = mockAudioThenApi(429, { error: 'busy' })
    try {
      await expect(remoteTranscriptionProvider().transcribe({
        audioRef: audioDataUrl(),
        mimeType: 'audio/webm',
      })).rejects.toMatchObject({ code: 'busy' })
    } finally {
      restore()
    }
  })

  it('maps HTTP 503 from the default remote provider', async () => {
    const restore = mockAudioThenApi(503, { error: 'down' })
    try {
      await expect(remoteTranscriptionProvider().transcribe({
        audioRef: audioDataUrl(),
        mimeType: 'audio/webm',
      })).rejects.toMatchObject({ code: 'unavailable' })
    } finally {
      restore()
    }
  })

  it('propagates remote 422 as empty', async () => {
    const restore = mockAudioThenApi(422, { error: 'none' })
    try {
      await expect(remoteTranscriptionProvider().transcribe({
        audioRef: audioDataUrl(),
        mimeType: 'audio/webm',
      })).rejects.toMatchObject({ code: 'empty' })
    } finally {
      restore()
    }
  })

  it('maps network failure to network code', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        return new Response(new Uint8Array(64), { status: 200 })
      }
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    try {
      await expect(remoteTranscriptionProvider().transcribe({
        audioRef: audioDataUrl(),
        mimeType: 'audio/webm',
      })).rejects.toMatchObject({ code: 'network' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('rejects audio blobs under 32 bytes as empty', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response(new Uint8Array(8), { status: 200 })) as typeof fetch
    try {
      await expect(remoteTranscriptionProvider().transcribe({
        audioRef: 'blob:tiny',
        mimeType: 'audio/webm',
      })).rejects.toMatchObject({ code: 'empty' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('parseRemoteTranscript ignores non-string payloads', () => {
    expect(parseRemoteTranscript({ transcript: 12 })).toBeNull()
    expect(parseRemoteTranscript({ transcript: { text: 'x' } })).toBeNull()
  })

  it('pickRecorderMimeType is safe without MediaRecorder', () => {
    expect(() => pickRecorderMimeType()).not.toThrow()
  })
})

describe('Jo AI pen — idempotent confirm apply', () => {
  it('second confirm of same batch does not duplicate focus todos when keys remembered', () => {
    const batch = decide('Milch kaufen')
    const first = applyDecisionBatch({
      batch,
      lifeOs: emptyLifeOsState(),
      dashboard: { focusTodos: [], boards: [], goals: [] },
      autoActionsEnabled: false,
      confirmedByUser: true,
      today: TODAY,
    })
    expect(first.dashboard.focusTodos).toHaveLength(1)
    const second = applyDecisionBatch({
      batch,
      lifeOs: first.lifeOs,
      dashboard: first.dashboard,
      executedKeys: first.executedKeys,
      autoActionsEnabled: false,
      confirmedByUser: true,
      today: TODAY,
    })
    expect(second.dashboard.focusTodos).toHaveLength(1)
    expect(second.skipped[0]?.reason).toBe('IDEMPOTENT_REPLAY')
  })
})
