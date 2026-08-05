/** Screen Wake Lock while a focus session is running (keeps display awake on iOS/Safari when supported). */

type WakeLockSentinelLike = {
  released: boolean
  release: () => Promise<void>
  addEventListener: (type: 'release', listener: () => void) => void
}

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
}

export async function requestScreenWakeLock(): Promise<WakeLockSentinelLike | null> {
  const nav = navigator as WakeLockNavigator
  if (!nav.wakeLock?.request) return null
  try {
    const sentinel = await nav.wakeLock.request('screen')
    return sentinel
  } catch {
    return null
  }
}

export async function releaseScreenWakeLock(
  sentinel: WakeLockSentinelLike | null | undefined,
): Promise<void> {
  if (!sentinel || sentinel.released) return
  try {
    await sentinel.release()
  } catch {
    /* ignore */
  }
}
