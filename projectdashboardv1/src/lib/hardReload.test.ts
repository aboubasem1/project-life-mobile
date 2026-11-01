import { describe, expect, it } from 'vitest'
import {
  HARD_RELOAD_PRESERVES,
  HARD_RELOAD_STEPS,
  executeHardReload,
  formatRunningVersion,
  hardReloadErrorText,
  selectRunningScriptName,
  type HardReloadClient,
  type ServiceWorkerRegistrationLike,
} from './hardReload'

function client(overrides?: Partial<HardReloadClient> & {
  registrations?: ServiceWorkerRegistrationLike[]
  caches?: string[]
}): {
  api: HardReloadClient
  calls: string[]
  preserved: string[]
} {
  const calls: string[] = []
  const preserved: string[] = []
  const registrations = overrides?.registrations ?? []
  const caches = overrides?.caches ?? []
  const api: HardReloadClient = {
    listRegistrations: overrides?.listRegistrations ?? (async () => {
      calls.push('list-registrations')
      return registrations
    }),
    listCacheNames: overrides?.listCacheNames ?? (async () => {
      calls.push('list-caches')
      return caches
    }),
    deleteCache: overrides?.deleteCache ?? (async name => {
      calls.push(`delete-cache:${name}`)
      return true
    }),
    reload: overrides?.reload ?? (() => {
      calls.push('reload')
    }),
  }
  const guarded = api as HardReloadClient & {
    clearLocalStorage: () => void
    deleteIndexedDB: () => void
    clearPairing: () => void
  }
  guarded.clearLocalStorage = () => {
    preserved.push('localStorage')
  }
  guarded.deleteIndexedDB = () => {
    preserved.push('indexedDB')
  }
  guarded.clearPairing = () => {
    preserved.push('life-os-v1-device-sync')
  }
  return { api, calls, preserved }
}

describe('hard reload', () => {
  it('names the built script and ignores other scripts', () => {
    expect(selectRunningScriptName([
      '/developer-launcher.js',
      '/assets/index-DHpCFHDr.js',
    ])).toBe('index-DHpCFHDr.js')
    expect(selectRunningScriptName(['/src/main.tsx', '/developer-launcher.js'])).toBe('main.tsx')
    expect(formatRunningVersion({
      scriptName: 'index-DHpCFHDr.js',
      serviceWorkerControlled: true,
    })).toBe('index-DHpCFHDr.js · Service Worker steuert diese Ansicht')
    expect(formatRunningVersion({
      scriptName: null,
      serviceWorkerControlled: false,
    })).toBe('unbekannte Datei · kein Service Worker aktiv')
  })

  it('unregisters workers and deletes caches before reload, and leaves user storage alone', async () => {
    const unregisterA = async () => {
      calls.push('unregister:a')
      return true
    }
    const unregisterB = async () => {
      calls.push('unregister:b')
      return true
    }
    const { api, calls, preserved } = client({
      registrations: [
        { unregister: unregisterA },
        { unregister: unregisterB },
      ],
      caches: ['lifeos-navigation', 'workbox-precache'],
    })

    const outcome = await executeHardReload(api)

    expect(outcome).toEqual({ ok: true, reloaded: true })
    expect(calls).toEqual([
      'list-registrations',
      'unregister:a',
      'unregister:b',
      'list-caches',
      'delete-cache:lifeos-navigation',
      'delete-cache:workbox-precache',
      'reload',
    ])
    expect(preserved).toEqual([])
    expect(HARD_RELOAD_STEPS).toEqual([
      'unregister-service-workers',
      'delete-caches',
      'reload',
    ])
    for (const store of ['localStorage', 'sessionStorage', 'indexedDB', 'cookies', 'life-os-v1-device-sync'] as const) {
      expect(HARD_RELOAD_PRESERVES).toContain(store)
    }
  })

  it('still deletes caches when unregister fails, and does not report success', async () => {
    const { api, calls } = client({
      registrations: [{
        unregister: async () => {
          throw new Error('unregister blocked')
        },
      }],
      caches: ['lifeos-navigation'],
    })

    const outcome = await executeHardReload(api)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reloaded).toBe(false)
    expect(outcome.failures.map(failure => failure.step)).toEqual(['unregister-service-workers'])
    expect(outcome.failures[0]?.message).toBe('unregister blocked')
    expect(calls).toContain('delete-cache:lifeos-navigation')
    expect(calls).not.toContain('reload')
    expect(hardReloadErrorText(outcome.failures)).toBe('Service Worker konnte nicht entfernt werden.')
  })

  it('reports a cache that stays behind and still tries the next cache', async () => {
    const { api, calls } = client({
      caches: ['keep-me', 'also-keep'],
      deleteCache: async name => {
        calls.push(`delete-cache:${name}`)
        if (name === 'keep-me') return false
        throw new Error('quota')
      },
    })

    const outcome = await executeHardReload(api)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.failures).toEqual([
      { step: 'delete-caches', message: 'Cache „keep-me“ blieb erhalten.' },
      { step: 'delete-caches', message: 'quota' },
    ])
    expect(calls).toEqual([
      'list-registrations',
      'list-caches',
      'delete-cache:keep-me',
      'delete-cache:also-keep',
    ])
    expect(hardReloadErrorText(outcome.failures)).toBe('Cache konnte nicht gelöscht werden.')
  })

  it('reports both steps when reading workers and caches fails', async () => {
    const { api, calls } = client({
      listRegistrations: async () => {
        calls.push('list-registrations')
        throw new Error('workers unavailable')
      },
      listCacheNames: async () => {
        calls.push('list-caches')
        throw new Error('caches unavailable')
      },
    })

    const outcome = await executeHardReload(api)

    expect(outcome).toEqual({
      ok: false,
      reloaded: false,
      failures: [
        { step: 'unregister-service-workers', message: 'workers unavailable' },
        { step: 'delete-caches', message: 'caches unavailable' },
      ],
    })
    expect(hardReloadErrorText(
      outcome.ok ? [] : outcome.failures,
    )).toBe('Service Worker und Cache konnten nicht vollständig entfernt werden.')
  })
})
