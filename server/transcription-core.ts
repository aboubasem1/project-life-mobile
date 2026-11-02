import { SyncHttpError, readSyncJson, syncJson } from './sync-core.js'

const MAX_AUDIO_BYTES = 4 * 1024 * 1024
const MAX_BATCH_AUDIO_BYTES = 25 * 1024 * 1024
const DEFAULT_OPENAI_URL = 'https://api.openai.com/v1/audio/transcriptions'
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini-transcribe'
const DEFAULT_DEEPINFRA_URL = 'https://api.deepinfra.com/v1/inference/openai/whisper-large-v3-turbo'
const DEFAULT_DEEPINFRA_MODEL = 'openai/whisper-large-v3-turbo'

export type TranscriptionRequestBody = {
  audioBase64?: unknown
  mimeType?: unknown
}

export type TranscriptSegment = {
  start: number
  end: number
  text: string
}

export type TranscriptionProviderId = 'deepinfra' | 'openai' | 'whisper'

export type TranscriptionResult = {
  transcript: string
  provider: TranscriptionProviderId
  model: string
  segments?: TranscriptSegment[]
  language?: string
  durationMs?: number
  inputLengthMs?: number
  requestId?: string
  cost?: number
}

export type TranscribeAudioOptions = {
  /** Prefer timed segments when the provider supports them. */
  includeSegments?: boolean
  /** Force a provider; default prefers DeepInfra when its key is present. */
  provider?: 'auto' | 'deepinfra' | 'openai'
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]
  if (typeof value !== 'string') return undefined
  // Strip whitespace and accidental wrapping quotes from pasted secrets.
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '').trim()
  return trimmed || undefined
}

function isOff(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase()
  return normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no'
}

/** Explicit language only — empty / auto means provider auto-detect. */
export function configuredTranscriptionLanguage(): string | undefined {
  const raw = readEnv('TRANSCRIPTION_LANGUAGE')
  if (!raw) return undefined
  const normalized = raw.trim().toLowerCase()
  if (!normalized || normalized === 'auto' || normalized === 'detect') return undefined
  return normalized.slice(0, 16)
}

export function transcriptionConfig() {
  const deepinfraKey = readEnv('DEEPINFRA_API_KEY')
  const openaiKey = readEnv('TRANSCRIPTION_API_KEY') || readEnv('OPENAI_API_KEY') || readEnv('LLM_API_KEY')
  const providerPref = (readEnv('TRANSCRIPTION_PROVIDER') || 'auto').toLowerCase()
  const deepinfraEnabled = Boolean(deepinfraKey) && !isOff(readEnv('DEEPINFRA_TRANSCRIPTION_ENABLED'))
  const openaiEnabled = Boolean(openaiKey)
  const anyProvider = deepinfraEnabled || openaiEnabled
  return {
    enabled: !isOff(readEnv('TRANSCRIPTION_ENABLED')) && anyProvider,
    deepinfraKey,
    openaiKey,
    deepinfraEnabled,
    openaiEnabled,
    providerPref: providerPref === 'deepinfra' || providerPref === 'openai' ? providerPref : 'auto' as const,
    deepinfraUrl: readEnv('DEEPINFRA_TRANSCRIPTION_URL') || DEFAULT_DEEPINFRA_URL,
    deepinfraModel: readEnv('DEEPINFRA_TRANSCRIPTION_MODEL') || DEFAULT_DEEPINFRA_MODEL,
    apiUrl: readEnv('TRANSCRIPTION_API_URL') || DEFAULT_OPENAI_URL,
    model: readEnv('TRANSCRIPTION_MODEL') || DEFAULT_OPENAI_MODEL,
    segmentModel: readEnv('TRANSCRIPTION_SEGMENT_MODEL') || 'whisper-1',
    language: configuredTranscriptionLanguage(),
    timeoutMs: Math.min(300_000, Math.max(4_000, Number(readEnv('TRANSCRIPTION_TIMEOUT_MS')) || 120_000)),
  }
}

export function resolveTranscriptionProvider(
  config: ReturnType<typeof transcriptionConfig>,
  options: TranscribeAudioOptions = {},
): 'deepinfra' | 'openai' {
  const forced = options.provider && options.provider !== 'auto'
    ? options.provider
    : config.providerPref === 'auto' ? null : config.providerPref
  if (forced === 'deepinfra') {
    if (!config.deepinfraEnabled) throw new SyncHttpError(503, 'DeepInfra-Transkription ist nicht konfiguriert.')
    return 'deepinfra'
  }
  if (forced === 'openai') {
    if (!config.openaiEnabled) throw new SyncHttpError(503, 'OpenAI-Transkription ist nicht konfiguriert.')
    return 'openai'
  }
  // Auto: prefer DeepInfra for reel/batch work (segments + scale), else OpenAI.
  if (config.deepinfraEnabled) return 'deepinfra'
  if (config.openaiEnabled) return 'openai'
  throw new SyncHttpError(503, 'Transkription ist gerade nicht verfügbar.')
}

export function parseTranscriptSegments(payload: unknown): TranscriptSegment[] {
  if (!payload || typeof payload !== 'object') return []
  const segments = (payload as { segments?: unknown }).segments
  if (!Array.isArray(segments)) return []
  const parsed: TranscriptSegment[] = []
  for (const entry of segments) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as { start?: unknown; end?: unknown; text?: unknown }
    const start = Number(row.start)
    const end = Number(row.end)
    const text = typeof row.text === 'string' ? row.text.trim() : ''
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end < start) continue
    parsed.push({ start, end, text })
    if (parsed.length >= 400) break
  }
  return parsed
}

export function normalizeDeepInfraTranscription(payload: unknown, model: string): TranscriptionResult {
  if (!payload || typeof payload !== 'object') {
    throw new SyncHttpError(502, 'DeepInfra lieferte eine ungültige Antwort.')
  }
  const body = payload as {
    text?: unknown
    language?: unknown
    input_length_ms?: unknown
    duration?: unknown
    request_id?: unknown
    inference_status?: { cost?: unknown; runtime_ms?: unknown }
    segments?: unknown
  }
  const transcript = typeof body.text === 'string' ? body.text.trim() : ''
  if (!transcript) throw new SyncHttpError(422, 'Kein Text erkannt.')
  const segments = parseTranscriptSegments(payload)
  const language = typeof body.language === 'string' && body.language.trim()
    ? body.language.trim().slice(0, 16)
    : undefined
  const inputLengthMs = Number(body.input_length_ms)
  const durationSec = Number(body.duration)
  const durationMs = Number.isFinite(inputLengthMs) && inputLengthMs > 0
    ? Math.round(inputLengthMs)
    : Number.isFinite(durationSec) && durationSec > 0
      ? Math.round(durationSec * 1000)
      : undefined
  const requestId = typeof body.request_id === 'string' && body.request_id.trim()
    ? body.request_id.trim().slice(0, 120)
    : undefined
  const costRaw = Number(body.inference_status?.cost)
  const cost = Number.isFinite(costRaw) ? costRaw : undefined
  return {
    transcript,
    provider: 'deepinfra',
    model,
    ...(segments.length > 0 ? { segments } : {}),
    ...(language ? { language } : {}),
    ...(durationMs != null ? { durationMs, inputLengthMs: durationMs } : {}),
    ...(requestId ? { requestId } : {}),
    ...(cost != null ? { cost } : {}),
  }
}

export function parseTranscriptionBody(raw: unknown): { audioBase64: string; mimeType: string } {
  const body = (raw ?? {}) as TranscriptionRequestBody
  const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64.trim() : ''
  const mimeType = typeof body.mimeType === 'string' && body.mimeType.trim()
    ? body.mimeType.trim().slice(0, 80)
    : 'audio/webm'
  if (!audioBase64) throw new SyncHttpError(400, 'Keine Aufnahme erhalten.')
  if (audioBase64.length > MAX_AUDIO_BYTES * 2) throw new SyncHttpError(413, 'Aufnahme ist zu lang.')
  return { audioBase64, mimeType }
}

function filenameFor(mimeType: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'voice.m4a'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'voice.mp3'
  if (mimeType.includes('wav')) return 'voice.wav'
  if (mimeType.includes('ogg')) return 'voice.ogg'
  return 'voice.webm'
}

function decodeAudio(audioBase64: string): Buffer {
  const bytes = Buffer.from(audioBase64, 'base64')
  if (bytes.length < 32) throw new SyncHttpError(400, 'Aufnahme ist unvollständig.')
  if (bytes.length > MAX_AUDIO_BYTES) throw new SyncHttpError(413, 'Aufnahme ist zu lang.')
  return bytes
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseRetryAfterMs(response: Response): number | undefined {
  const raw = response.headers.get('retry-after')
  if (!raw) return undefined
  const asSeconds = Number(raw)
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return Math.min(300_000, Math.round(asSeconds * 1000))
  const asDate = Date.parse(raw)
  if (Number.isFinite(asDate)) return Math.min(300_000, Math.max(0, asDate - Date.now()))
  return undefined
}

function providerErrorMessage(status: number, bodyText: string, provider: string): string {
  const lower = bodyText.toLowerCase()
  if (status === 401 || status === 403 || lower.includes('invalid_api_key') || lower.includes('incorrect api key') || lower.includes('unauthorized')) {
    return `${provider}-Transkription ist falsch konfiguriert.`
  }
  if (lower.includes('insufficient_quota') || lower.includes('payment')) {
    return `${provider}-Quota ist leer — Billing prüfen oder neuen Key setzen.`
  }
  if (status === 429 || lower.includes('rate_limit') || lower.includes('too many')) {
    return 'Transkription ist gerade ausgelastet — in ein paar Sekunden nochmal versuchen.'
  }
  return 'Transkription fehlgeschlagen.'
}

function throwHttpFailure(response: Response, bodyText: string, provider: string): never {
  const retryAfterMs = parseRetryAfterMs(response)
  if (response.status === 429) {
    throw new SyncHttpError(429, providerErrorMessage(429, bodyText, provider), { retryAfterMs })
  }
  if (response.status === 401 || response.status === 403) {
    throw new SyncHttpError(503, providerErrorMessage(response.status, bodyText, provider))
  }
  if (response.status >= 500) {
    throw new SyncHttpError(502, `${provider}-Transkription ist gerade nicht erreichbar.`, { retryAfterMs })
  }
  throw new SyncHttpError(502, providerErrorMessage(response.status, bodyText, provider), { retryAfterMs })
}

async function postDeepInfra(
  fetchImpl: typeof fetch,
  config: ReturnType<typeof transcriptionConfig>,
  bytes: Buffer,
  mimeType: string,
): Promise<Response> {
  const form = new FormData()
  // DeepInfra native inference API expects the multipart field name `audio`.
  form.append('audio', new Blob([new Uint8Array(bytes)], { type: mimeType }), filenameFor(mimeType))
  form.append('chunk_level', 'segment')
  if (config.language) form.append('language', config.language)
  return fetchWithTimeout(fetchImpl, config.deepinfraUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.deepinfraKey}` },
    body: form,
  }, config.timeoutMs)
}

async function postOpenAiWhisper(
  fetchImpl: typeof fetch,
  config: ReturnType<typeof transcriptionConfig>,
  bytes: Buffer,
  mimeType: string,
  options: TranscribeAudioOptions = {},
): Promise<Response> {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(bytes)], { type: mimeType }), filenameFor(mimeType))
  const model = options.includeSegments ? config.segmentModel : config.model
  form.append('model', model)
  if (config.language) form.append('language', config.language)
  if (options.includeSegments) {
    form.append('response_format', 'verbose_json')
    form.append('timestamp_granularities[]', 'segment')
  }
  return fetchWithTimeout(fetchImpl, config.apiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.openaiKey}` },
    body: form,
  }, config.timeoutMs)
}

async function withRetries(
  run: () => Promise<Response>,
  providerLabel: string,
): Promise<Response> {
  let response: Response | null = null
  let lastNetworkError: unknown = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await run()
    } catch (error) {
      lastNetworkError = error
      if (attempt < 2) {
        await sleep(400 * (attempt + 1) + Math.floor(Math.random() * 200))
        continue
      }
      const timedOut = error instanceof Error && error.name === 'AbortError'
      throw new SyncHttpError(504, timedOut ? 'Transkription hat zu lange gedauert.' : 'Transkription fehlgeschlagen.')
    }
    if (response.status !== 429 && response.status < 500) break
    if (attempt < 2) {
      const retryAfter = parseRetryAfterMs(response) ?? (700 * (attempt + 1) + Math.floor(Math.random() * 300))
      await sleep(retryAfter)
      continue
    }
  }
  if (!response) {
    const timedOut = lastNetworkError instanceof Error && lastNetworkError.name === 'AbortError'
    throw new SyncHttpError(504, timedOut ? 'Transkription hat zu lange gedauert.' : `${providerLabel}-Transkription fehlgeschlagen.`)
  }
  return response
}

async function transcribeWithDeepInfra(
  bytes: Buffer,
  mimeType: string,
  config: ReturnType<typeof transcriptionConfig>,
  fetchImpl: typeof fetch,
): Promise<TranscriptionResult> {
  const response = await withRetries(
    () => postDeepInfra(fetchImpl, config, bytes, mimeType),
    'DeepInfra',
  )
  if (!response.ok) {
    throwHttpFailure(response, await response.text().catch(() => ''), 'DeepInfra')
  }
  const payload = await response.json().catch(() => null)
  return normalizeDeepInfraTranscription(payload, config.deepinfraModel)
}

async function transcribeWithOpenAi(
  bytes: Buffer,
  mimeType: string,
  config: ReturnType<typeof transcriptionConfig>,
  fetchImpl: typeof fetch,
  options: TranscribeAudioOptions,
): Promise<TranscriptionResult> {
  const model = options.includeSegments ? config.segmentModel : config.model
  const response = await withRetries(
    () => postOpenAiWhisper(fetchImpl, config, bytes, mimeType, options),
    'OpenAI',
  )
  if (!response.ok) {
    throwHttpFailure(response, await response.text().catch(() => ''), 'OpenAI')
  }
  const payload = await response.json().catch(() => null)
  const transcript = payload && typeof payload === 'object' && typeof (payload as { text?: unknown }).text === 'string'
    ? (payload as { text: string }).text.trim()
    : ''
  if (!transcript) throw new SyncHttpError(422, 'Kein Text erkannt.')
  const segments = options.includeSegments ? parseTranscriptSegments(payload) : undefined
  const language = payload && typeof payload === 'object' && typeof (payload as { language?: unknown }).language === 'string'
    ? String((payload as { language: string }).language).trim().slice(0, 16)
    : undefined
  return {
    transcript,
    provider: 'openai',
    model,
    ...(segments && segments.length > 0 ? { segments } : {}),
    ...(language ? { language } : {}),
  }
}

export async function transcribeAudioPayload(
  raw: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<TranscriptionResult> {
  const { audioBase64, mimeType } = parseTranscriptionBody(raw)
  const bytes = decodeAudio(audioBase64)
  return transcribeAudioBytes(bytes, mimeType, fetchImpl)
}

/** Server-side batch transcription for audio extracted from uploaded reels. */
export async function transcribeAudioBytes(
  bytes: Buffer,
  mimeType: string,
  fetchImpl: typeof fetch = fetch,
  options: TranscribeAudioOptions = {},
): Promise<TranscriptionResult> {
  const config = transcriptionConfig()
  if (!config.enabled) {
    throw new SyncHttpError(503, 'Transkription ist gerade nicht verfügbar.')
  }
  if (bytes.length < 32) throw new SyncHttpError(400, 'Aufnahme ist unvollständig.')
  if (bytes.length > MAX_BATCH_AUDIO_BYTES) {
    throw new SyncHttpError(413, 'Extrahierte Audiodatei ist größer als 25 MB.')
  }

  const provider = resolveTranscriptionProvider(config, options)
  if (provider === 'deepinfra') {
    return transcribeWithDeepInfra(bytes, mimeType, config, fetchImpl)
  }
  return transcribeWithOpenAi(bytes, mimeType, config, fetchImpl, options)
}

export async function runTranscriptionRequest(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (request.method === 'OPTIONS') return syncJson({ ok: true })
  if (request.method !== 'POST') return syncJson({ error: 'Methode nicht erlaubt.' }, 405)
  const result = await transcribeAudioPayload(await readSyncJson(request), fetchImpl)
  return syncJson({ ok: true, ...result })
}
