import { describe, expect, it } from 'vitest'
import { speechMatchesStatement, speechSupport } from './voiceRitual'

describe('gratitude speech', () => {
  it('accepts a close German repetition and rejects an unrelated sentence', () => {
    expect(speechMatchesStatement(
      'Ich bin dankbar für meinen Körper',
      'ICH BIN DANKBAR FÜR MEINEN KÖRPER – ER WÄCHST',
    )).toBe(true)
    expect(speechMatchesStatement('heute wird eingekauft', 'Ich bin dankbar für meinen Körper')).toBe(false)
  })

  it('reports recognition support without throwing when the browser has no speech APIs', () => {
    expect(speechSupport()).toEqual({
      synthesis: typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined',
      recognition: false,
    })
  })
})
