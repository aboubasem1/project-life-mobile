import { describe, expect, it } from 'vitest'
import {
  createObjectKey,
  normalizeContentType,
  parseObjectCategory,
} from './object-storage.ts'

describe('object storage boundaries', () => {
  it('accepts only known private storage categories', () => {
    expect(parseObjectCategory('captures')).toBe('captures')
    expect(parseObjectCategory('backups')).toBeNull()
    expect(parseObjectCategory('../captures')).toBeNull()
  })

  it('normalizes untrusted content types', () => {
    expect(normalizeContentType('image/PNG')).toBe('image/png')
    expect(normalizeContentType('text/html; charset=utf-8')).toBe('application/octet-stream')
    expect(normalizeContentType(undefined)).toBe('application/octet-stream')
  })

  it('creates opaque keys inside the room and date prefix', () => {
    const key = createObjectKey('labs', 'room-123')
    expect(key).toMatch(/^labs\/room-123\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}$/)
    expect(key).not.toContain('bloodwork.pdf')
  })
})
