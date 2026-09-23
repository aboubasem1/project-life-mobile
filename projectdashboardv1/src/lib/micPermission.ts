/** Microphone permission helpers for Capture voice input. */

const MIC_GRANTED_KEY = 'life-os-mic-granted'

export type MicPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown'

export function readStoredMicGranted(): boolean {
  try {
    return sessionStorage.getItem(MIC_GRANTED_KEY) === '1'
      || localStorage.getItem(MIC_GRANTED_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberMicGranted(): void {
  try {
    sessionStorage.setItem(MIC_GRANTED_KEY, '1')
    localStorage.setItem(MIC_GRANTED_KEY, '1')
  } catch {
    // ignore quota / private mode
  }
}

export async function queryMicPermission(): Promise<MicPermissionState> {
  if (readStoredMicGranted()) return 'granted'
  const permissions = navigator.permissions
  if (!permissions?.query) return 'unknown'
  try {
    const status = await permissions.query({ name: 'microphone' as PermissionName })
    if (status.state === 'granted') {
      rememberMicGranted()
      return 'granted'
    }
    if (status.state === 'denied') return 'denied'
    if (status.state === 'prompt') return 'prompt'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Open a single audio stream for MediaRecorder.
 * Does not start Web Speech Recognition (that would re-prompt on Safari/iOS).
 */
export async function acquireMicrophoneStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Mikrofon ist auf diesem Gerät nicht verfügbar.')
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  })
  rememberMicGranted()
  return stream
}
