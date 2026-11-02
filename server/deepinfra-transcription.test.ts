import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeDeepInfraTranscription,
  resolveTranscriptionProvider,
  transcribeAudioBytes,
  transcriptionConfig,
} from './transcription-core.js'

const KEYS = [
  'TRANSCRIPTION_ENABLED',
  'TRANSCRIPTION_API_KEY',
  'OPENAI_API_KEY',
  'LLM_API_KEY',
  'DEEPINFRA_API_KEY',
  'DEEPINFRA_TRANSCRIPTION_ENABLED',
  'TRANSCRIPTION_PROVIDER',
  'TRANSCRIPTION_LANGUAGE',
] as const
const previous = new Map<string, string | undefined>()

function isolateEnv() {
  for (const key of KEYS) {
    if (!previous.has(key)) previous.set(key, process.env[key])
    delete process.env[key]
  }
}

function restoreEnv() {
  for (const key of KEYS) {
    const value = previous.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

beforeEach(isolateEnv)
afterEach(restoreEnv)

describe('DeepInfra transcription', () => {
  it('normalizes DeepInfra payloads defensively', () => {
    const result = normalizeDeepInfraTranscription({
      text: ' Hello world ',
      language: 'en',
      input_length_ms: 1500,
      request_id: 'req-1',
      inference_status: { cost: 0.0002 },
      segments: [
        { start: 0, end: 0.8, text: ' Hello' },
        { start: 0.8, end: 1.5, text: ' world' },
        { start: 9, end: 1, text: 'bad' },
      ],
    }, 'openai/whisper-large-v3-turbo')
    expect(result).toMatchObject({
      transcript: 'Hello world',
      provider: 'deepinfra',
      language: 'en',
      durationMs: 1500,
      requestId: 'req-1',
      cost: 0.0002,
    })
    expect(result.segments).toEqual([
      { start: 0, end: 0.8, text: 'Hello' },
      { start: 0.8, end: 1.5, text: 'world' },
    ])
  })

  it('prefers DeepInfra when its key is present', () => {
    process.env.DEEPINFRA_API_KEY = 'di-test'
    process.env.OPENAI_API_KEY = 'oa-test'
    const config = transcriptionConfig()
    expect(config.deepinfraEnabled).toBe(true)
    expect(resolveTranscriptionProvider(config)).toBe('deepinfra')
  })

  it('does not invent a language when TRANSCRIPTION_LANGUAGE=auto', () => {
    process.env.DEEPINFRA_API_KEY = 'di-test'
    process.env.TRANSCRIPTION_LANGUAGE = 'auto'
    expect(transcriptionConfig().language).toBeUndefined()
  })

  it('posts multipart audio to DeepInfra and maps the response', async () => {
    process.env.DEEPINFRA_API_KEY = 'di-test'
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      const headers = init?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer di-test')
      const form = init?.body as FormData
      expect(form.get('audio')).toBeTruthy()
      expect(form.get('chunk_level')).toBe('segment')
      expect(form.get('language')).toBeNull()
      return new Response(JSON.stringify({
        text: 'Hello from DeepInfra',
        language: 'en',
        segments: [{ start: 0, end: 1.2, text: 'Hello from DeepInfra' }],
        request_id: 'abc',
        inference_status: { cost: 0.001 },
      }), { status: 200 })
    }) as unknown as typeof fetch

    const result = await transcribeAudioBytes(Buffer.alloc(64), 'audio/mpeg', fetchImpl, { includeSegments: true })
    expect(result.provider).toBe('deepinfra')
    expect(result.transcript).toBe('Hello from DeepInfra')
    expect(result.language).toBe('en')
    expect(result.segments?.[0]?.text).toBe('Hello from DeepInfra')
  })

  it('treats invalid DeepInfra keys as configuration failures', async () => {
    process.env.DEEPINFRA_API_KEY = 'bad'
    await expect(transcribeAudioBytes(Buffer.alloc(64), 'audio/mpeg', async () => (
      new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    ), { provider: 'deepinfra' })).rejects.toMatchObject({
      status: 503,
      message: expect.stringMatching(/falsch konfiguriert/i),
    })
  })

  it('retries rate limits then succeeds', async () => {
    process.env.DEEPINFRA_API_KEY = 'di-test'
    let calls = 0
    const result = await transcribeAudioBytes(Buffer.alloc(64), 'audio/mpeg', async () => {
      calls += 1
      if (calls < 3) return new Response('busy', { status: 429, headers: { 'Retry-After': '0' } })
      return new Response(JSON.stringify({ text: 'Recovered' }), { status: 200 })
    }, { provider: 'deepinfra' })
    expect(calls).toBe(3)
    expect(result.transcript).toBe('Recovered')
  })
})
