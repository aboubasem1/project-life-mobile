import type { ActionLevel } from '../types.js'

/** External notifications are always confirm-only. */
export function notificationActionLevel(): ActionLevel {
  return 'CONFIRM'
}
