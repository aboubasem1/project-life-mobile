import type { TranscriptionProvider } from './types.js'

type SpeechRecognitionCtor = new () => {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

export class TranscriptionError extends Error {
  readonly code: 'unavailable' | 'empty' | 'network' | 'invalid'

  constructor(code: TranscriptionError['code'], message: string) {
    super(message)
    this.name = 'TranscriptionError'
    this.code = code
  }
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
      if (!audioRef.startsWith('blob:') && !audioRef.startsWith('data:')) {
        throw new TranscriptionError('invalid', 'Keine Aufnahme zum Transkribieren.')
      }
      const blob = await fetch(audioRef).then(response => response.blob())
      if (blob.size < 32) {
        throw new TranscriptionError('empty', 'Aufnahme war zu kurz. Sprich etwas länger und stoppe erneut.')
      }
      const audioBase64 = await blobToBase64(blob)
      let response: Response
      try {
        response = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            mimeType: mimeType || blob.type || 'audio/webm',
          }),
        })
      } catch {
        throw new TranscriptionError('network', 'Transkription offline — tippe den Text kurz ein.')
      }
      if (response.status === 503) {
        throw new TranscriptionError('unavailable', 'Spracherkennung ist gerade nicht konfiguriert.')
      }
      if (response.status === 422 || response.status === 400) {
        throw new TranscriptionError('empty', 'Kein Text erkannt. Sprich deutlicher oder tippe kurz nach.')
      }
      if (!response.ok) {
        throw new TranscriptionError('unavailable', 'Transkription nicht verfügbar.')
      }
      const transcript = parseRemoteTranscript(await response.json())
      if (!transcript) throw new TranscriptionError('empty', 'Kein Text erkannt. Sprich deutlicher oder tippe kurz nach.')
      return { transcript }
    },
  }
}

export async function transcribeCaptureAudio(input: {
  /** Only pass a real speech transcript — never typed draft text. */
  liveTranscript?: string
  audioRef?: string
  mimeType?: string
  remote?: TranscriptionProvider
}): Promise<{ transcript: string; provider: string }> {
  const live = input.liveTranscript?.trim() ?? ''
  if (live) return { transcript: live, provider: 'webkit-speech' }
  if (!input.audioRef) {
    throw new TranscriptionError('invalid', 'Keine Aufnahme zum Transkribieren.')
  }
  const provider = input.remote ?? remoteTranscriptionProvider()
  const result = await provider.transcribe({
    audioRef: input.audioRef,
    mimeType: input.mimeType,
  })
  const transcript = result.transcript.trim()
  if (!transcript) {
    throw new TranscriptionError('empty', 'Kein Text erkannt. Sprich deutlicher oder tippe kurz nach.')
  }
  return { transcript, provider: provider.id }
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
