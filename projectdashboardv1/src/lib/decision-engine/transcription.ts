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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('Aufnahme konnte nicht gelesen werden.'))
    reader.readAsDataURL(blob)
  })
}

/** Server Whisper path. UI never talks to the provider directly. */
export function remoteTranscriptionProvider(id = 'remote-whisper'): TranscriptionProvider {
  return {
    id,
    async transcribe({ audioRef, mimeType }) {
      if (!audioRef.startsWith('blob:') && !audioRef.startsWith('data:')) {
        throw new Error('Keine Aufnahme zum Transkribieren.')
      }
      const blob = await fetch(audioRef).then(response => response.blob())
      const audioBase64 = await blobToBase64(blob)
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: mimeType || blob.type || 'audio/webm',
        }),
      })
      if (!response.ok) throw new Error('Transkription nicht verfügbar.')
      const transcript = parseRemoteTranscript(await response.json())
      if (!transcript) throw new Error('Kein Text erkannt.')
      return { transcript }
    },
  }
}

export async function transcribeCaptureAudio(input: {
  liveTranscript?: string
  audioRef?: string
  mimeType?: string
  remote?: TranscriptionProvider
}): Promise<{ transcript: string; provider: string } | null> {
  const live = input.liveTranscript?.trim() ?? ''
  if (live) return { transcript: live, provider: 'webkit-speech' }
  if (!input.audioRef) return null
  try {
    const provider = input.remote ?? remoteTranscriptionProvider()
    const result = await provider.transcribe({
      audioRef: input.audioRef,
      mimeType: input.mimeType,
    })
    const transcript = result.transcript.trim()
    return transcript ? { transcript, provider: provider.id } : null
  } catch {
    return null
  }
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
