import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../deviceSync', () => ({
  createDevicePairing: vi.fn(async () => undefined),
  loadSyncCredentials: vi.fn(() => ({ roomId: 'room-1', deviceToken: 'token-1' })),
}))

describe('getReel + translateReelTranscript', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('loads a single reel by id', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      expect(String(input)).toContain('/api/reels/reel-1')
      return new Response(JSON.stringify({
        ok: true,
        reel: {
          id: 'reel-1',
          objectId: 'obj-1',
          checksumSha256: null,
          status: 'PUBLISHED',
          title: 'Test',
          summary: 'Kurz',
          transcript: 'Hello',
          transcriptProvider: 'whisper',
          transcriptModel: 'gpt-4o-mini-transcribe',
          onScreenText: '',
          lifeArea: '',
          topics: [],
          usefulnessScore: 50,
          riskLevel: 'low',
          suggestedTarget: 'knowledge',
          jev: null,
          reviewerNote: '',
          processingAttempts: 1,
          errorMessage: null,
          version: 1,
          claims: [],
          createdAt: '2026-11-02T10:00:00.000Z',
          updatedAt: '2026-11-02T10:00:00.000Z',
        },
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { getReel } = await import('./api')
    const reel = await getReel('reel-1')
    expect(reel.id).toBe('reel-1')
    expect(reel.transcript).toBe('Hello')
  })

  it('requests on-demand German translation', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      expect(String(input)).toContain('/api/reels/reel-2/translate')
      expect(init?.method).toBe('POST')
      return new Response(JSON.stringify({
        ok: true,
        reel: {
          id: 'reel-2',
          objectId: 'obj-2',
          checksumSha256: null,
          status: 'PUBLISHED',
          title: 'Test',
          summary: 'Kurz',
          transcript: 'Hello',
          transcriptDe: 'Hallo',
          transcriptDeWasAlreadyGerman: false,
          transcriptProvider: 'whisper',
          transcriptModel: 'gpt-4o-mini-transcribe',
          onScreenText: '',
          lifeArea: '',
          topics: [],
          usefulnessScore: 50,
          riskLevel: 'low',
          suggestedTarget: 'knowledge',
          jev: null,
          reviewerNote: '',
          processingAttempts: 1,
          errorMessage: null,
          version: 2,
          claims: [],
          createdAt: '2026-11-02T10:00:00.000Z',
          updatedAt: '2026-11-02T10:00:00.000Z',
        },
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { translateReelTranscript } = await import('./api')
    const reel = await translateReelTranscript('reel-2')
    expect(reel.transcriptDe).toBe('Hallo')
  })
})
