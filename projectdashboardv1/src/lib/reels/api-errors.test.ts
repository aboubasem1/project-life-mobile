import { describe, expect, it } from 'vitest'
import { formatReelApiFailure } from './api'

describe('formatReelApiFailure', () => {
  it('keeps the opaque production message but names the failing upload stage and safe ref', () => {
    const error = formatReelApiFailure({
      stage: 'presign',
      status: 500,
      error: 'Interner Serverfehler.',
      errorRef: 'a1b2c3d4',
    })
    expect(error.message).toBe('Interner Serverfehler. [Stufe: presign, HTTP 500, Ref a1b2c3d4]')
  })

  it('surfaces proxy-upload JSON bodies instead of a bare status code', () => {
    const error = formatReelApiFailure({
      stage: 'proxy-upload',
      status: 500,
      error: 'Interner Serverfehler.',
      errorRef: 'deadbeef',
    })
    expect(error.message).toContain('Stufe: proxy-upload')
    expect(error.message).toContain('Ref deadbeef')
    expect(error.message).not.toMatch(/^Upload fehlgeschlagen \(500\)\.$/)
  })
})
