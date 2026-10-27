import { objectStorageConfigured, probeObjectStorage } from './object-storage.js'
import { reelWorkerEnabled, reelWorkerStatus } from './reel-jobs.js'
import { probeSyncStorage } from './sync-store.js'
import { transcriptionConfig } from './transcription-core.js'

function truthy(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '')
}

function configured(...values: Array<string | undefined>): boolean {
  return values.some(value => Boolean(value?.trim().replace(/^['"]|['"]$/g, '').trim()))
}

export async function buildHealthStatus(): Promise<{
  service: 'life-os'
  status: 'ok' | 'degraded'
  ok: boolean
  storage: string
  database: { status: 'ok' | 'not_configured' | 'error' }
  objectStorage: { status: 'ok' | 'not_configured' | 'error' }
  reelProcessing: {
    worker: 'ok' | 'disabled' | 'starting'
    transcription: 'configured' | 'missing_key' | 'disabled'
    analysis: 'configured' | 'missing_key'
    jev: 'configured' | 'optional_unavailable' | 'disabled'
  }
  time: string
}> {
  const [sync, objects] = await Promise.all([
    probeSyncStorage(),
    probeObjectStorage(),
  ])
  const r2Required = truthy(process.env.R2_REQUIRED) || objectStorageConfigured()
  const ok = sync.ok && (!r2Required || objects.ok)
  const worker = reelWorkerStatus()
  const transcription = transcriptionConfig()
  const transcriptionHasKey = configured(process.env.TRANSCRIPTION_API_KEY, process.env.OPENAI_API_KEY, process.env.LLM_API_KEY)
  const analysisHasKey = configured(process.env.OPENAI_API_KEY, process.env.LLM_API_KEY)
  const jevEnabled = !['0', 'false', 'off', 'no'].includes(process.env.JEV_ENABLED?.trim().toLowerCase() ?? '')
  const jevHasKey = configured(process.env.TYPESAFE_API_KEY, process.env.JEV_API_KEY)

  return {
    service: 'life-os',
    status: ok ? 'ok' : 'degraded',
    ok,
    storage: sync.storage,
    database: sync.storage === 'postgres'
      ? { status: sync.ok ? 'ok' : 'error' }
      : { status: 'not_configured' },
    objectStorage: { status: objects.status },
    reelProcessing: {
      worker: worker.enabled ? 'ok' : reelWorkerEnabled() ? 'starting' : 'disabled',
      transcription: transcription.enabled ? 'configured' : transcriptionHasKey ? 'disabled' : 'missing_key',
      analysis: analysisHasKey ? 'configured' : 'missing_key',
      jev: !jevEnabled ? 'disabled' : jevHasKey ? 'configured' : 'optional_unavailable',
    },
    time: new Date().toISOString(),
  }
}
