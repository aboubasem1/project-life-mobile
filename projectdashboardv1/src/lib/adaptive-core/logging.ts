/** Structured observability for adaptive core — no sensitive payloads. */

export type AdaptiveLogLevel = 'info' | 'warn' | 'error'

export type AdaptiveLogEvent = {
  level: AdaptiveLogLevel
  area:
    | 'intent'
    | 'change'
    | 'validation'
    | 'apply'
    | 'rollback'
    | 'suggestion'
    | 'experiment'
    | 'development'
  message: string
  meta?: Record<string, string | number | boolean | null>
  at: string
}

const buffer: AdaptiveLogEvent[] = []
const MAX = 200

export function adaptiveLog(
  level: AdaptiveLogLevel,
  area: AdaptiveLogEvent['area'],
  message: string,
  meta?: AdaptiveLogEvent['meta'],
): void {
  const entry: AdaptiveLogEvent = {
    level,
    area,
    message,
    meta,
    at: new Date().toISOString(),
  }
  buffer.unshift(entry)
  if (buffer.length > MAX) buffer.length = MAX
  if (typeof console !== 'undefined') {
    const line = `[adaptive:${area}] ${message}`
    if (level === 'error') console.error(line, meta ?? {})
    else if (level === 'warn') console.warn(line, meta ?? {})
    else console.info(line, meta ?? {})
  }
}

export function recentAdaptiveLogs(): AdaptiveLogEvent[] {
  return [...buffer]
}
