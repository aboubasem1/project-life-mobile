import { describe, expect, it } from 'vitest'
import { mergeIncomingSnapshot } from './sync-core'
import type { SyncSnapshot } from './sync-store'

function entrySnapshot(revision: number, dailyScore: number): SyncSnapshot {
  return {
    revision,
    updatedAt: '2026-11-01T00:00:00.000Z',
    entries: [{
      date: '2026-11-01',
      mood: '',
      dailyScore,
      updatedAt: '2026-11-01T12:00:00.000Z',
    }],
    lifeOs: { version: 1, captures: [] },
    dailyEvents: [],
  }
}

describe('push revision storm', () => {
  it('keeps the current revision when an echoed push only changes the score clock', () => {
    const first = mergeIncomingSnapshot(null, entrySnapshot(1, 0), '2026-11-01T00:00:01.000Z')
    expect(first.changed).toBe(true)

    let current = first.snapshot
    for (let step = 0; step < 20; step += 1) {
      const echo: SyncSnapshot = {
        ...current,
        revision: current.revision + 1,
        updatedAt: `2026-11-01T00:00:${String(10 + step).padStart(2, '0')}.000Z`,
        entries: current.entries.map(item => (
          item && typeof item === 'object'
            ? { ...item, dailyScore: 6 + step }
            : item
        )),
      }
      const next = mergeIncomingSnapshot(current, echo, echo.updatedAt)
      expect(next.changed).toBe(false)
      expect(next.snapshot.revision).toBe(current.revision)
      current = next.snapshot
    }
  })

  it('advances the revision once for a real entry edit', () => {
    const first = mergeIncomingSnapshot(null, entrySnapshot(1, 0), '2026-11-01T00:00:01.000Z')
    const edited: SyncSnapshot = {
      ...entrySnapshot(first.snapshot.revision, 3),
      entries: [{
        date: '2026-11-01',
        mood: 'Gut',
        dailyScore: 3,
        updatedAt: '2026-11-01T12:05:00.000Z',
      }],
    }
    const second = mergeIncomingSnapshot(first.snapshot, edited, '2026-11-01T00:00:02.000Z')
    expect(second.changed).toBe(true)
    expect(second.snapshot.revision).toBe(first.snapshot.revision + 1)
  })

  it('does not mint revisions when the same sparse snapshot is pushed again', () => {
    const first = mergeIncomingSnapshot(null, entrySnapshot(1, 0), '2026-11-01T00:00:01.000Z')
    let current = first.snapshot
    for (let step = 0; step < 20; step += 1) {
      const next = mergeIncomingSnapshot(
        current,
        entrySnapshot(current.revision + 1, 4 + step),
        `2026-11-01T00:00:${String(10 + step).padStart(2, '0')}.000Z`,
      )
      expect(next.changed).toBe(false)
      expect(next.snapshot.revision).toBe(current.revision)
      current = next.snapshot
    }
  })
})
