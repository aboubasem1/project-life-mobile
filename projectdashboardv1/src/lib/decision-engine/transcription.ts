import type { TranscriptionProvider } from './types.js'

type SpeechRecognitionCtor = new () => {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: {
    results: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }> & { length: number }
  }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

export class TranscriptionError extends Error {
  readonly code: 'unavailable' | 'empty' | 'network' | 'invalid' | 'busy'

  constructor(code: TranscriptionError['code'], message: string) {
    super(message)
    this.name = 'TranscriptionError'
    this.code = code
  }
}

export function isTranscriptionError(error: unknown): error is TranscriptionError {
  if (error instanceof TranscriptionError) return true
  if (!error || typeof error !== 'object') return false
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown }
  return candidate.name === 'TranscriptionError'
    && typeof candidate.code === 'string'
    && typeof candidate.message === 'string'
}

export function transcriptionErrorMessage(error: unknown): string {
  if (isTranscriptionError(error)) return error.message
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Spracherkennung fehlgeschlagen — tippe kurz, worum es ging.'
}

async function readApiErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload = await response.clone().json()
    if (payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string') {
      const message = (payload as { error: string }).error.trim()
      return message || null
    }
  } catch {
    // ignore non-JSON error bodies
  }
  return null
}

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  const root = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return root.SpeechRecognition ?? root.webkitSpeechRecognition ?? null
}

export function parseRemoteTranscript(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const transcript = (payload as { transcript?: unknown }).transcript
  return typeof transcript === 'string' && transcript.trim() ? transcript.trim() : null
}

async function blobToBase64(blob: Blob): Promise<string> {
  // Prefer FileReader in browsers; fall back to arrayBuffer for Node/tests.
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : ''
        const comma = result.indexOf(',')
        resolve(comma >= 0 ? result.slice(comma + 1) : result)
      }
      reader.onerror = () => reject(new TranscriptionError('invalid', 'Aufnahme konnte nicht gelesen werden.'))
      reader.readAsDataURL(blob)
    })
  }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const NodeBuffer = (globalThis as typeof globalThis & {
    Buffer?: { from: (input: Uint8Array) => { toString: (encoding: string) => string } }
  }).Buffer
  if (NodeBuffer) {
    return NodeBuffer.from(bytes).toString('base64')
  }
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** Prefer a mime type the browser can actually record (Safari → mp4). */
export function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined
  }
  const candidates = [
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ]
  return candidates.find(type => MediaRecorder.isTypeSupported(type))
}

/** Server Whisper path. UI never talks to the provider directly. */
export function remoteTranscriptionProvider(id = 'remote-whisper'): TranscriptionProvider {
  return {
    id,
    async transcribe({ audioRef, mimeType }) {
      try {
        if (!audioRef.startsWith('blob:') && !audioRef.startsWith('data:')) {
          throw new TranscriptionError('invalid', 'Keine Aufnahme zum Transkribieren.')
        }
        let blob: Blob
        try {
          blob = await fetch(audioRef).then(response => response.blob())
        } catch {
          throw new TranscriptionError('invalid', 'Aufnahme konnte nicht gelesen werden.')
        }
        if (blob.size < 32) {
          throw new TranscriptionError('empty', 'Aufnahme war zu kurz. Sprich etwas länger und stoppe erneut.')
        }
        const audioBase64 = await blobToBase64(blob)
        const postOnce = async () => fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            mimeType: mimeType || blob.type || 'audio/webm',
          }),
        })
        let response: Response
        try {
          response = await postOnce()
          if (response.status === 429) {
            await new Promise(resolve => setTimeout(resolve, 900))
            response = await postOnce()
          }
        } catch {
          throw new TranscriptionError('network', 'Transkription offline — tippe den Text kurz ein.')
        }
        if (response.status === 429) {
          throw new TranscriptionError(
            'busy',
            (await readApiErrorMessage(response))
              || 'Spracherkennung ist gerade ausgelastet — kurz warten und nochmal aufnehmen, oder tippen.',
          )
        }
        if (response.status === 503) {
          throw new TranscriptionError(
            'unavailable',
            (await readApiErrorMessage(response))
              || 'Spracherkennung ist gerade nicht konfiguriert — tippe den Text kurz ein.',
          )
        }
        if (response.status === 422 || response.status === 400) {
          throw new TranscriptionError(
            'empty',
            (await readApiErrorMessage(response))
              || 'Kein Text erkannt. Sprich deutlicher oder tippe kurz nach.',
          )
        }
        if (!response.ok) {
          throw new TranscriptionError(
            'unavailable',
            (await readApiErrorMessage(response))
              || 'Transkription nicht verfügbar — tippe den Text kurz ein.',
          )
        }
        let payload: unknown
        try {
          payload = await response.json()
        } catch {
          throw new TranscriptionError('unavailable', 'Transkription nicht verfügbar — tippe den Text kurz ein.')
        }
        const transcript = parseRemoteTranscript(payload)
        if (!transcript) {
          throw new TranscriptionError('empty', 'Kein Text erkannt. Sprich deutlicher oder tippe kurz nach.')
        }
        return { transcript }
      } catch (error) {
        if (isTranscriptionError(error)) throw error
        throw new TranscriptionError(
          'unavailable',
          'Spracherkennung fehlgeschlagen — tippe den Text kurz ein.',
        )
      }
    },
  }
}

export async function transcribeCaptureAudio(input: {
  /** Parallel browser transcript — used only if Whisper fails busy/offline. */
  liveTranscript?: string
  audioRef?: string
  mimeType?: string
  remote?: TranscriptionProvider
}): Promise<{ transcript: string; provider: string }> {
  const live = input.liveTranscript?.trim() ?? ''
  if (input.audioRef) {
    const provider = input.remote ?? remoteTranscriptionProvider()
    try {
      const result = await provider.transcribe({
        audioRef: input.audioRef,
        mimeType: input.mimeType,
      })
      const transcript = result.transcript.trim()
      if (!transcript) {
        throw new TranscriptionError('empty', 'Kein Text erkannt. Sprich deutlicher oder tippe kurz nach.')
      }
      return { transcript, provider: provider.id }
    } catch (error) {
      const busyOrOffline = isTranscriptionError(error)
        && (error.code === 'busy' || error.code === 'network' || error.code === 'unavailable')
      if (live && busyOrOffline) {
        return { transcript: live, provider: 'webkit-speech-fallback' }
      }
      if (isTranscriptionError(error)) throw error
      throw new TranscriptionError(
        'unavailable',
        'Spracherkennung fehlgeschlagen — tippe den Text kurz ein.',
      )
    }
  }
  if (live) return { transcript: live, provider: 'webkit-speech' }
  throw new TranscriptionError('invalid', 'Keine Aufnahme zum Transkribieren.')
}

/** Browser speech recognition. No extra dependency. Fails closed. */
export function webSpeechTranscriptionProvider(id = 'webkit-speech'): TranscriptionProvider {
  return {
    id,
    transcribe() {
      const Ctor = speechRecognitionCtor()
      if (!Ctor) return Promise.reject(new Error('Spracheingabe ist auf diesem Gerät nicht verfügbar.'))
      return new Promise((resolve, reject) => {
        const recognition = new Ctor()
        recognition.lang = 'de-DE'
        recognition.interimResults = false
        recognition.continuous = false
        recognition.onresult = event => {
          const first = event.results[0]?.[0]
          const transcript = first?.transcript?.trim() ?? ''
          if (!transcript) {
            reject(new Error('Kein Text erkannt.'))
            return
          }
          resolve({ transcript })
        }
        recognition.onerror = () => reject(new Error('Transkription fehlgeschlagen.'))
        recognition.onend = () => reject(new Error('Aufnahme beendet, ohne Text.'))
        try {
          recognition.start()
        } catch {
          reject(new Error('Mikrofon konnte nicht gestartet werden.'))
        }
      })
    },
  }
}

/** Silent parallel collector during MediaRecorder — Chromium only (Safari re-prompts). */
export function startParallelSpeechCollector(onTranscript: (text: string) => void): (() => void) | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  const isSafari = /safari/i.test(ua) && !/chrome|chromium|android/i.test(ua)
  if (isSafari) return null
  const Ctor = speechRecognitionCtor()
  if (!Ctor) return null
  try {
    const recognition = new Ctor()
    recognition.lang = 'de-DE'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.onresult = event => {
      const parts: string[] = []
      for (let i = 0; i < event.results.length; i += 1) {
        const alt = event.results[i]?.[0]?.transcript?.trim()
        if (alt) parts.push(alt)
      }
      const text = parts.join(' ').trim()
      if (text) onTranscript(text)
    }
    recognition.onerror = () => { /* keep MediaRecorder path */ }
    recognition.onend = () => { /* ended with recorder stop */ }
    recognition.start()
    return () => {
      try { recognition.stop() } catch { /* ignore */ }
    }
  } catch {
    return null
  }
}
