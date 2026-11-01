/** PostgreSQL jsonb rejects U+0000 and lone surrogates. The surrounding text still saves. */

export function sanitizeJsonText(value: string): string {
  let out = ''
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code === 0) continue
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = value.charCodeAt(index + 1)
      if (next >= 0xDC00 && next <= 0xDFFF) {
        out += value[index] + value[index + 1]
        index += 1
        continue
      }
      continue
    }
    if (code >= 0xDC00 && code <= 0xDFFF) continue
    out += value[index]
  }
  return out
}

export function sanitizeJsonValue<T>(value: T): T {
  if (typeof value === 'string') return sanitizeJsonText(value) as T
  if (Array.isArray(value)) return value.map(item => sanitizeJsonValue(item)) as T
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      next[sanitizeJsonText(key)] = sanitizeJsonValue(item)
    }
    return next as T
  }
  return value
}
