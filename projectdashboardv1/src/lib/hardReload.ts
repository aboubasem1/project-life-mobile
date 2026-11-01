/** What a hard reload removes, in order. User data is not in this list. */
export const HARD_RELOAD_STEPS = [
  'unregister-service-workers',
  'delete-caches',
  'reload',
] as const

export type HardReloadStep = (typeof HARD_RELOAD_STEPS)[number]

/** Stores and pairing that a hard reload must leave untouched. */
export const HARD_RELOAD_PRESERVES = [
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'cookies',
  'life-os-v1-device-sync',
] as const

export const HARD_RELOAD_CONFIRM = 'Zwischengespeicherte App und Service Worker werden entfernt. Die Seite lädt danach neu vom Server. Lokale Daten und die Geräte-Kopplung bleiben.'

export type HardReloadFailure = {
  step: Exclude<HardReloadStep, 'reload'>
  message: string
}

export type HardReloadOutcome =
  | { ok: true; reloaded: true }
  | { ok: false; reloaded: false; failures: HardReloadFailure[] }

export type ServiceWorkerRegistrationLike = {
  unregister: () => Promise<boolean>
}

export type HardReloadClient = {
  listRegistrations: () => Promise<readonly ServiceWorkerRegistrationLike[]>
  listCacheNames: () => Promise<readonly string[]>
  deleteCache: (name: string) => Promise<boolean>
  reload: () => void
}

const APP_BUNDLE = /^index-.+\.js$/
const DEV_ENTRY = new Set(['main.tsx', 'main.jsx', 'main.js'])

export function scriptFileName(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const pathname = new URL(trimmed, 'https://lifeos.local').pathname
    const name = pathname.split('/').filter(Boolean).pop() ?? ''
    return name || null
  } catch {
    return null
  }
}

/** Prefer the built app bundle, then the Vite dev entry. Ignore other scripts. */
export function selectRunningScriptName(scriptUrls: readonly string[]): string | null {
  const names = scriptUrls
    .map(scriptFileName)
    .filter((name): name is string => name != null)
  const bundle = names.find(name => APP_BUNDLE.test(name))
  if (bundle) return bundle
  const dev = names.find(name => DEV_ENTRY.has(name))
  return dev ?? null
}

export function formatRunningVersion(input: {
  scriptName: string | null
  serviceWorkerControlled: boolean
}): string {
  const script = input.scriptName ?? 'unbekannte Datei'
  const worker = input.serviceWorkerControlled
    ? 'Service Worker steuert diese Ansicht'
    : 'kein Service Worker aktiv'
  return `${script} · ${worker}`
}

export function hardReloadErrorText(failures: readonly HardReloadFailure[]): string {
  let worker = false
  let cache = false
  for (const failure of failures) {
    switch (failure.step) {
      case 'unregister-service-workers':
        worker = true
        break
      case 'delete-caches':
        cache = true
        break
      default: {
        const _exhaustive: never = failure.step
        return _exhaustive
      }
    }
  }
  if (worker && cache) return 'Service Worker und Cache konnten nicht vollständig entfernt werden.'
  if (worker) return 'Service Worker konnte nicht entfernt werden.'
  if (cache) return 'Cache konnte nicht gelöscht werden.'
  return 'App konnte nicht neu geladen werden.'
}

function failureMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return fallback
}

/**
 * Unregister every service worker, delete every Cache Storage cache, then reload.
 * Reloads only when both clears succeed. Does not receive or touch app storage.
 */
export async function executeHardReload(client: HardReloadClient): Promise<HardReloadOutcome> {
  const failures: HardReloadFailure[] = []

  let registrations: readonly ServiceWorkerRegistrationLike[] = []
  try {
    registrations = await client.listRegistrations()
  } catch (error) {
    failures.push({
      step: 'unregister-service-workers',
      message: failureMessage(error, 'Service Worker konnten nicht gelesen werden.'),
    })
  }

  for (const registration of registrations) {
    try {
      const removed = await registration.unregister()
      if (!removed) {
        failures.push({
          step: 'unregister-service-workers',
          message: 'Ein Service Worker blieb registriert.',
        })
      }
    } catch (error) {
      failures.push({
        step: 'unregister-service-workers',
        message: failureMessage(error, 'Service Worker konnte nicht entfernt werden.'),
      })
    }
  }

  let cacheNames: readonly string[] = []
  try {
    cacheNames = await client.listCacheNames()
  } catch (error) {
    failures.push({
      step: 'delete-caches',
      message: failureMessage(error, 'Caches konnten nicht gelesen werden.'),
    })
  }

  for (const name of cacheNames) {
    try {
      const deleted = await client.deleteCache(name)
      if (!deleted) {
        failures.push({
          step: 'delete-caches',
          message: `Cache „${name}“ blieb erhalten.`,
        })
      }
    } catch (error) {
      failures.push({
        step: 'delete-caches',
        message: failureMessage(error, 'Cache konnte nicht gelöscht werden.'),
      })
    }
  }

  if (failures.length > 0) {
    return { ok: false, reloaded: false, failures }
  }

  client.reload()
  return { ok: true, reloaded: true }
}

export function browserHardReloadClient(): HardReloadClient {
  return {
    listRegistrations: async () => {
      if (!('serviceWorker' in navigator)) return []
      return navigator.serviceWorker.getRegistrations()
    },
    listCacheNames: async () => {
      if (!('caches' in window)) return []
      return caches.keys()
    },
    deleteCache: name => caches.delete(name),
    reload: () => {
      window.location.reload()
    },
  }
}
