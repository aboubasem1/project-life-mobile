import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  parseTranscriptionBody,
  transcribeAudioPayload,
  transcriptionConfig,
} from './transcription-core.ts'

const KEYS = ['TRANSCRIPTION_ENABLED', 'TRANSCRIPTION_API_KEY', 'OPENAI_API_KEY', 'LLM_API_KEY'] as const
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

describe('server transcription', () => {
  it('rejects empty audio without calling a provider', () => {
    expect(() => parseTranscriptionBody({})).toThrow(/Keine Aufnahme/)
    expect(transcriptionConfig().enabled).toBe(false)
  })

  it('maps a whisper payload without inventing text', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    const result = await transcribeAudioPayload({
      audioBase64: Buffer.alloc(64).toString('base64'),
      mimeType: 'audio/webm',
    }, async () => new Response(JSON.stringify({ text: '  Mass Gainer getrunken  ' }), { status: 200 }))
    expect(result.transcript).toBe('Mass Gainer getrunken')
    expect(result.provider).toBe('whisper')
  })

  it('fails closed when the provider returns no text', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    await expect(transcribeAudioPayload({
      audioBase64: Buffer.alloc(64).toString('base64'),
    }, async () => new Response(JSON.stringify({ text: '   ' }), { status: 200 }))).rejects.toThrow(/Kein Text/)
  })

  it('retries 429 then succeeds', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    let calls = 0
    const result = await transcribeAudioPayload({
      audioBase64: Buffer.alloc(64).toString('base64'),
      mimeType: 'audio/webm',
    }, async () => {
      calls += 1
      if (calls < 3) return new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded' } }), { status: 429 })
      return new Response(JSON.stringify({ text: 'Milch kaufen' }), { status: 200 })
    })
    expect(calls).toBe(3)
    expect(result.transcript).toBe('Milch kaufen')
  })

  it('surfaces persistent 429 after retries', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    let calls = 0
    await expect(transcribeAudioPayload({
      audioBase64: Buffer.alloc(64).toString('base64'),
    }, async () => {
      calls += 1
      return new Response('rate_limit', { status: 429 })
    })).rejects.toMatchObject({ status: 429 })
    expect(calls).toBe(3)
  })

  it('maps invalid API key to 503', async () => {
    process.env.OPENAI_API_KEY = 'bad-key'
    await expect(transcribeAudioPayload({
      audioBase64: Buffer.alloc(64).toString('base64'),
    }, async () => new Response(JSON.stringify({ error: { code: 'invalid_api_key' } }), { status: 401 }))).rejects.toMatchObject({ status: 503 })
  })
})
