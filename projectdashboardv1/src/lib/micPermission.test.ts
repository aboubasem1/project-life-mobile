import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryMicPermission, readStoredMicGranted, rememberMicGranted } from './micPermission'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => { map.delete(key) },
    setItem: (key: string, value: string) => { map.set(key, value) },
  }
}

describe('micPermission', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true })
    Object.defineProperty(globalThis, 'sessionStorage', { value: memoryStorage(), configurable: true })
  })

  it('remembers granted state across reads', () => {
    expect(readStoredMicGranted()).toBe(false)
    rememberMicGranted()
    expect(readStoredMicGranted()).toBe(true)
  })

  it('treats Permissions API granted as granted and stores it', async () => {
    vi.stubGlobal('navigator', {
      permissions: {
        query: vi.fn(async () => ({ state: 'granted' })),
      },
    })
    await expect(queryMicPermission()).resolves.toBe('granted')
    expect(readStoredMicGranted()).toBe(true)
    vi.unstubAllGlobals()
  })
})
