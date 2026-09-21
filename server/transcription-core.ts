import { SyncHttpError, readSyncJson, syncJson } from './sync-core.js'

const MAX_AUDIO_BYTES = 4 * 1024 * 1024
const DEFAULT_URL = 'https://api.openai.com/v1/audio/transcriptions'
const DEFAULT_MODEL = 'whisper-1'

export type TranscriptionRequestBody = {
  audioBase64?: unknown
  mimeType?: unknown
}

export type TranscriptionResult = {
  transcript: string
  provider: 'whisper'
  model: string
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function isOff(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase()
  return normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no'
}

export function transcriptionConfig() {
  const apiKey = readEnv('TRANSCRIPTION_API_KEY') || readEnv('OPENAI_API_KEY') || readEnv('LLM_API_KEY')
  return {
    enabled: !isOff(readEnv('TRANSCRIPTION_ENABLED')) && Boolean(apiKey),
    apiKey,
    apiUrl: readEnv('TRANSCRIPTION_API_URL') || DEFAULT_URL,
    model: readEnv('TRANSCRIPTION_MODEL') || DEFAULT_MODEL,
    language: readEnv('TRANSCRIPTION_LANGUAGE') || 'de',
    timeoutMs: Math.min(28_000, Math.max(4_000, Number(readEnv('TRANSCRIPTION_TIMEOUT_MS')) || 25_000)),
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

export async function transcribeAudioPayload(
  raw: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<TranscriptionResult> {
  const config = transcriptionConfig()
  if (!config.enabled || !config.apiKey) {
    throw new SyncHttpError(503, 'Transkription ist gerade nicht verfügbar.')
  }
  const { audioBase64, mimeType } = parseTranscriptionBody(raw)
  const bytes = decodeAudio(audioBase64)
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(bytes)], { type: mimeType }), filenameFor(mimeType))
  form.append('model', config.model)
  form.append('language', config.language)

  let response: Response
  try {
    response = await fetchWithTimeout(fetchImpl, config.apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
    }, config.timeoutMs)
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError'
    throw new SyncHttpError(504, timedOut ? 'Transkription hat zu lange gedauert.' : 'Transkription fehlgeschlagen.')
  }

  if (response.status === 429) throw new SyncHttpError(429, 'Transkription ist gerade ausgelastet.')
  if (response.status >= 500) throw new SyncHttpError(502, 'Transkription ist gerade nicht erreichbar.')
  if (!response.ok) throw new SyncHttpError(502, 'Transkription fehlgeschlagen.')

  const payload = await response.json().catch(() => null)
  const transcript = payload && typeof payload === 'object' && typeof (payload as { text?: unknown }).text === 'string'
    ? (payload as { text: string }).text.trim()
    : ''
  if (!transcript) throw new SyncHttpError(422, 'Kein Text erkannt.')
  return { transcript, provider: 'whisper', model: config.model }
}

export async function runTranscriptionRequest(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (request.method === 'OPTIONS') return syncJson({ ok: true })
  if (request.method !== 'POST') return syncJson({ error: 'Methode nicht erlaubt.' }, 405)
  const result = await transcribeAudioPayload(await readSyncJson(request), fetchImpl)
  return syncJson({ ok: true, ...result })
}
