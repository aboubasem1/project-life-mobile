import { describe, expect, it } from 'vitest'
import {
  buildUndoPatch,
  canUndoEntryPatch,
  canUndoRitualStep,
  capturePreviousValues,
  createEntryPatchEvent,
  createRitualStepEvent,
  applyEventFieldsToEntry,
  diffEntryChanges,
  eventsForDate,
  mergeDailyEvents,
  normalizeDailyEvent,
  projectRitualDoneFromEvents,
  summarizeDailyEvent,
} from './dailyEvents'

describe('daily events', () => {
  it('merges append-only events by id in stable time order', () => {
    const older = createEntryPatchEvent({
      id: 'older',
      date: '2026-09-20',
      source: 'ui',
      occurredAt: '2026-09-20T06:00:00.000Z',
      changes: { waterLiters: 1 },
    })
    const newer = createEntryPatchEvent({
      id: 'newer',
      date: '2026-09-20',
      source: 'health',
      occurredAt: '2026-09-20T07:00:00.000Z',
      changes: { steps: 2400 },
    })

    const merged = mergeDailyEvents([newer], [older, newer])

    expect(merged.map(event => event.id)).toEqual(['older', 'newer'])
  })

  it('uses one occurrence id for a completed gate step per day', () => {
    const first = createRitualStepEvent({
      date: '2026-09-20',
      stepId: 'energy',
      occurredAt: '2026-09-20T07:00:00.000Z',
    })!
    const repeated = createRitualStepEvent({
      date: '2026-09-20',
      stepId: 'energy',
      occurredAt: '2026-09-20T07:01:00.000Z',
    })!

    expect(first.id).toBe(repeated.id)
    expect(mergeDailyEvents([first], [repeated])).toHaveLength(1)
  })

  it('keeps only changed entry fields and excludes derived metadata', () => {
    const changes = diffEntryChanges(
      { waterLiters: 1, dailyScore: 5, updatedAt: 'before' },
      { waterLiters: 1.5, dailyScore: 8, updatedAt: 'after' },
    )

    expect(changes).toEqual({ waterLiters: 1.5 })
  })

  it('rejects malformed and empty events', () => {
    expect(normalizeDailyEvent({
      id: 'empty',
      date: '2026-09-20',
      occurredAt: '2026-09-20T07:00:00.000Z',
      recordedAt: '2026-09-20T07:00:00.000Z',
      source: 'ui',
      type: 'entry_patch',
      changes: { dailyScore: 10 },
    })).toBeNull()
    expect(normalizeDailyEvent({ id: 'bad' })).toBeNull()
  })

  it('supports undo via previous values exactly once', () => {
    const event = createEntryPatchEvent({
      id: 'water-1',
      date: '2026-09-20',
      source: 'quick_add',
      occurredAt: '2026-09-20T08:00:00.000Z',
      changes: { waterLiters: 2 },
      previous: { waterLiters: 1 },
    })
    expect(event).not.toBeNull()
    expect(canUndoEntryPatch(event!, [event!])).toBe(true)
    expect(buildUndoPatch(event!)).toEqual({ waterLiters: 1 })

    const undone = createEntryPatchEvent({
      id: 'water-1-undo',
      date: '2026-09-20',
      source: 'ui',
      occurredAt: '2026-09-20T08:01:00.000Z',
      changes: { waterLiters: 1 },
      previous: { waterLiters: 2 },
      undoOf: 'water-1',
    })
    expect(canUndoEntryPatch(event!, [event!, undone!])).toBe(false)
    expect(summarizeDailyEvent(undone!)).toBe('Änderung rückgängig')
  })

  it('captures previous values and filters events by date', () => {
    expect(capturePreviousValues(
      { waterLiters: 1, steps: 100 },
      { waterLiters: 2 },
    )).toEqual({ waterLiters: 1 })

    const first = createEntryPatchEvent({
      id: 'a',
      date: '2026-09-20',
      source: 'ui',
      occurredAt: '2026-09-20T09:00:00.000Z',
      changes: { steps: 10 },
    })!
    const second = createEntryPatchEvent({
      id: 'b',
      date: '2026-09-19',
      source: 'ui',
      occurredAt: '2026-09-19T09:00:00.000Z',
      changes: { steps: 5 },
    })!
    expect(eventsForDate([first, second], '2026-09-20').map(event => event.id)).toEqual(['a'])
  })

  it('projects latest event field values and ritual reopen tombstones', () => {
    const first = createEntryPatchEvent({
      id: 'w1',
      date: '2026-09-20',
      source: 'ui',
      occurredAt: '2026-09-20T08:00:00.000Z',
      changes: { waterLiters: 1 },
    })!
    const second = createEntryPatchEvent({
      id: 'w2',
      date: '2026-09-20',
      source: 'ui',
      occurredAt: '2026-09-20T09:00:00.000Z',
      changes: { waterLiters: 2 },
      previous: { waterLiters: 1 },
      undoOf: 'w1',
    })!
    expect(applyEventFieldsToEntry(
      { date: '2026-09-20', waterLiters: 9 },
      [first, second],
    )).toMatchObject({ waterLiters: 2 })

    const done = createRitualStepEvent({
      date: '2026-09-20',
      stepId: 'energy',
      status: 'completed',
      occurredAt: '2026-09-20T07:00:00.000Z',
    })!
    const reopen = createRitualStepEvent({
      date: '2026-09-20',
      stepId: 'energy',
      status: 'reopened',
      occurredAt: '2026-09-20T07:05:00.000Z',
    })!
    expect(projectRitualDoneFromEvents('2026-09-20', ['energy', 'todos'], [done, reopen]))
      .toEqual(['todos'])
    expect(canUndoRitualStep(done, [done])).toBe(true)
    expect(canUndoRitualStep(done, [done, reopen])).toBe(false)
  })
})
