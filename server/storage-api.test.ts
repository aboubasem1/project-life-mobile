import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import decisionFunction from '../api/decision.ts'

const R2_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
] as const
const previous = new Map<string, string | undefined>()

beforeEach(() => {
  for (const key of R2_KEYS) {
    if (!previous.has(key)) previous.set(key, process.env[key])
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of R2_KEYS) {
    const value = previous.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('Vercel storage fallback routing', () => {
  it('reuses the existing decision function and fails closed without R2', async () => {
    const response = await decisionFunction.fetch(new Request(
      'https://lifeos.example/api/decision?mode=storage&operation=presign-upload',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'captures',
          fileName: 'test.txt',
          contentType: 'text/plain',
          sizeBytes: 4,
        }),
      },
    ))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Dateispeicher ist noch nicht konfiguriert.',
    })
  })
})
