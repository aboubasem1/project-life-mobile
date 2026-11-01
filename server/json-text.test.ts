import { describe, expect, it } from 'vitest'
import { sanitizeJsonText, sanitizeJsonValue } from './json-text'

describe('json text for postgres', () => {
  it('drops null bytes and lone surrogates and keeps the reel sentence', () => {
    const text = `Trainingsstart \u0000bleibt ${String.fromCharCode(0xD800)} stehen`
    expect(sanitizeJsonText(text)).toBe('Trainingsstart bleibt  stehen')
    expect(sanitizeJsonText(`OK ${String.fromCharCode(0xD83D, 0xDCAA)}`)).toBe('OK 💪')
  })

  it('sanitizes nested snapshot strings', () => {
    const clean = sanitizeJsonValue({
      entries: [{ date: '2026-11-01', journalText: 'Tag \u0000' }],
      lifeOs: { knowledge: [{ title: `Reel ${String.fromCharCode(0xD800)}` }] },
    })
    expect(clean.entries[0]?.journalText).toBe('Tag ')
    expect(clean.lifeOs.knowledge[0]?.title).toBe('Reel ')
  })
})
