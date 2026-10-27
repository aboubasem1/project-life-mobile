import { describe, expect, it } from 'vitest'
import { shouldStreamRequest } from './http-policy'

describe('HTTP request streaming policy', () => {
  it('streams only same-origin media proxy uploads', () => {
    expect(shouldStreamRequest('PUT', '/api/storage/proxy-upload')).toBe(true)
    expect(shouldStreamRequest('PUT', '/api/storage/proxy-upload/')).toBe(true)
    expect(shouldStreamRequest('POST', '/api/storage/proxy-upload')).toBe(false)
    expect(shouldStreamRequest('PUT', '/api/storage/complete')).toBe(false)
  })
})
