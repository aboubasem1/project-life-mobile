import { objectStorageConfigured, probeObjectStorage } from './object-storage.js'
import { probeSyncStorage } from './sync-store.js'

function truthy(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '')
}

export async function buildHealthStatus(): Promise<{
  service: 'life-os'
  status: 'ok' | 'degraded'
  ok: boolean
  storage: string
  database: { status: 'ok' | 'not_configured' | 'error' }
  objectStorage: { status: 'ok' | 'not_configured' | 'error' }
  time: string
}> {
  const [sync, objects] = await Promise.all([
    probeSyncStorage(),
    probeObjectStorage(),
  ])
  const r2Required = truthy(process.env.R2_REQUIRED) || objectStorageConfigured()
  const ok = sync.ok && (!r2Required || objects.ok)

  return {
    service: 'life-os',
    status: ok ? 'ok' : 'degraded',
    ok,
    storage: sync.storage,
    database: sync.storage === 'postgres'
      ? { status: sync.ok ? 'ok' : 'error' }
      : { status: 'not_configured' },
    objectStorage: { status: objects.status },
    time: new Date().toISOString(),
  }
}
