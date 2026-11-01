/** Browser speech for the gratitude ritual. No audio is stored. */

export function normalizeSpeech(text: string): string {
  return text
    .toLocaleLowerCase('de-DE')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Accepts a spoken attempt that carries the same meaning, not a verbatim script. */
export function speechMatchesStatement(heard: string, expected: string): boolean {
  const spoken = normalizeSpeech(heard)
  const target = normalizeSpeech(expected)
  if (!spoken || !target) return false
  if (spoken.includes(target) || target.includes(spoken)) return true
  const expectedWords = target.split(' ').filter(word => word.length > 2)
  if (expectedWords.length === 0) return spoken === target
  const spokenWords = new Set(spoken.split(' '))
  const hits = expectedWords.filter(word => spokenWords.has(word)).length
  return hits / expectedWords.length >= 0.55
}

export type SpeechSupport = {
  synthesis: boolean
  recognition: boolean
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function recognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const host = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null
}

export function speechSupport(): SpeechSupport {
  return {
    synthesis: typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined',
    recognition: recognitionCtor() != null,
  }
}

export function listenGerman(handlers: {
  onTranscript: (transcript: string, final: boolean) => void
  onError: (message: string) => void
  onEnd: () => void
}): { stop: () => void } | null {
  const Ctor = recognitionCtor()
  if (!Ctor) return null
  const recognition = new Ctor()
  recognition.lang = 'de-DE'
  recognition.continuous = false
  recognition.interimResults = true
  recognition.onresult = event => {
    const chunks: string[] = []
    let final = false
    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index]
      chunks.push(result[0]?.transcript ?? '')
      if ((result as { isFinal?: boolean }).isFinal) final = true
    }
    handlers.onTranscript(chunks.join(' ').trim(), final)
  }
  recognition.onerror = event => {
    const code = event.error ?? 'error'
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      handlers.onError('Mikrofon blockiert. Du kannst den Satz auch bestätigen oder eintippen.')
      return
    }
    if (code === 'no-speech') {
      handlers.onError('Nichts verstanden. Sprich noch einmal oder bestätige manuell.')
      return
    }
    handlers.onError('Erkennung gerade nicht möglich.')
  }
  recognition.onend = () => handlers.onEnd()
  try {
    recognition.start()
  } catch {
    handlers.onError('Spracherkennung konnte nicht starten.')
    return null
  }
  return {
    stop: () => {
      try {
        recognition.abort()
      } catch {
        /* already stopped */
      }
    },
  }
}
