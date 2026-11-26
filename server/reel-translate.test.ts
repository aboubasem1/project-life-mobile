import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { translateTranscriptToGerman } from './reel-analysis.js'

describe('translateTranscriptToGerman', () => {
  const previousKey = process.env.OPENAI_API_KEY

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
  })

  afterEach(() => {
    if (previousKey == null) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
  })

  it('maps a German translation payload without inventing empty text', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ german: 'Hallo Welt', wasAlreadyGerman: false }) } }],
    }), { status: 200 })) as unknown as typeof fetch

    const result = await translateTranscriptToGerman('Hello world', fetchImpl)
    expect(result).toEqual({ german: 'Hallo Welt', wasAlreadyGerman: false })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('keeps already-German transcripts flagged', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ german: 'Schon deutsch', wasAlreadyGerman: true }) } }],
    }), { status: 200 })) as unknown as typeof fetch

    const result = await translateTranscriptToGerman('Schon deutsch', fetchImpl)
    expect(result.wasAlreadyGerman).toBe(true)
    expect(result.german).toBe('Schon deutsch')
  })

  it('rejects empty transcripts', async () => {
    await expect(translateTranscriptToGerman('   ')).rejects.toMatchObject({ status: 422 })
  })
})
