import { describe, expect, it } from 'vitest'
import { shouldPushSyncSnapshot, syncUserContentKey, type SyncContentSnapshot } from './syncContent'

function snapshot(revision: number, dailyScore: number, mood = ''): SyncContentSnapshot & { revision: number; updatedAt: string } {
  return {
    revision,
    updatedAt: `2026-11-01T00:00:${String(revision).padStart(2, '0')}.000Z`,
    entries: [{
      date: '2026-11-01',
      mood,
      dailyScore,
      updatedAt: '2026-11-01T12:00:00.000Z',
    }],
    lifeOs: { version: 1, captures: [] },
    dailyEvents: [],
  }
}

describe('sync storm', () => {
  it('does not push when a pull echoes the acknowledged snapshot', () => {
    const local = snapshot(279, 0)
    let acknowledgedKey = syncUserContentKey(local)
    let remote = snapshot(279, 0)
    let pushes = 0

    for (let step = 0; step < 30; step += 1) {
      remote = snapshot(remote.revision + 1, 6)
      const rescored = snapshot(remote.revision, 6)
      const localKey = syncUserContentKey(rescored)
      const remoteKey = syncUserContentKey(remote)
      if (shouldPushSyncSnapshot({ localKey, remoteKey, acknowledgedKey })) {
        pushes += 1
        acknowledgedKey = localKey
        remote = { ...rescored, revision: remote.revision + 1 }
      }
    }

    expect(pushes).toBe(0)
    expect(syncUserContentKey(snapshot(279, 0))).toBe(syncUserContentKey(snapshot(540, 99)))
  })

  it('pushes a user edit once and treats the server echo as already acknowledged', () => {
    const remote = snapshot(279, 0)
    const acknowledgedKey = syncUserContentKey(remote)
    const edited = snapshot(279, 3, 'Gut')
    const editedKey = syncUserContentKey(edited)

    expect(shouldPushSyncSnapshot({
      localKey: editedKey,
      remoteKey: syncUserContentKey(remote),
      acknowledgedKey,
    })).toBe(true)

    const echoed = snapshot(280, 3, 'Gut')
    expect(shouldPushSyncSnapshot({
      localKey: editedKey,
      remoteKey: syncUserContentKey(echoed),
      acknowledgedKey: editedKey,
    })).toBe(false)
  })
})
