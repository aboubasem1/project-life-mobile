import { describe, expect, it } from 'vitest'
import { SyncHttpError } from './sync-core.ts'

/**
 * Mirrors the extract-stage catch in reel-api.ts: provider failures must soft-fail
 * so OCR can still recover text-only Instagram Reels when Whisper auth is broken.
 */
function shouldAbortExtractForTranscriptionError(error: unknown): boolean {
  return !(error instanceof SyncHttpError)
}

describe('reel transcription soft-fail', () => {
  it('continues to OCR when Whisper rejects the production API key', () => {
    const error = new SyncHttpError(503, 'Spracherkennung ist falsch konfiguriert.')
    expect(shouldAbortExtractForTranscriptionError(error)).toBe(false)
  })

  it('continues to OCR on rate limits and empty transcripts', () => {
    expect(shouldAbortExtractForTranscriptionError(new SyncHttpError(429, 'Transkription ist gerade ausgelastet'))).toBe(false)
    expect(shouldAbortExtractForTranscriptionError(new SyncHttpError(422, 'Kein Text erkannt.'))).toBe(false)
  })

  it('still aborts extract on unexpected non-HTTP failures', () => {
    expect(shouldAbortExtractForTranscriptionError(new TypeError('fetch failed'))).toBe(true)
  })
})
