function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * A later device snapshot may omit sourceReelId or blank the title.
 * The published reel record already on this device stays.
 */
export function preserveReelKnowledgeItems(local: unknown[], merged: unknown[]): unknown[] {
  const localById = new Map<string, Record<string, unknown>>()
  for (const item of local) {
    const record = asRecord(item)
    if (record && typeof record.id === 'string') localById.set(record.id, record)
  }
  return merged.map(item => {
    const record = asRecord(item)
    if (!record || typeof record.id !== 'string') return item
    const previous = localById.get(record.id)
    if (!previous) return item
    const previousReel = typeof previous.sourceReelId === 'string' && previous.sourceReelId.length > 0
    if (!previousReel) return item
    const nextReel = typeof record.sourceReelId === 'string' && record.sourceReelId.length > 0
    const nextTitle = typeof record.title === 'string' ? record.title.trim() : ''
    const previousTitle = typeof previous.title === 'string' ? previous.title.trim() : ''
    if (!nextReel || (!nextTitle && previousTitle)) return previous
    return item
  })
}
