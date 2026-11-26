import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertReelHostReady, OVH_PRODUCTION_ORIGIN } from './api'

describe('assertReelHostReady', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts the OVH postgres + object-storage host', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      storage: 'postgres',
      database: { status: 'ok' },
      objectStorage: { status: 'ok' },
    }), { status: 200 })))
    await expect(assertReelHostReady()).resolves.toBeUndefined()
  })

  it('rejects the Vercel upstash fallback with a clear OVH instruction', async () => {
    vi.stubGlobal('window', { location: { host: 'project-life-mobile.vercel.app' } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      storage: 'upstash',
      database: { status: 'not_configured' },
      objectStorage: { status: 'not_configured' },
    }), { status: 200 })))
    await expect(assertReelHostReady()).rejects.toThrow(OVH_PRODUCTION_ORIGIN)
    await expect(assertReelHostReady()).rejects.toThrow(/Vercel/)
  })
})
