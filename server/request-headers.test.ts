import { describe, expect, it } from 'vitest'
import { buildFetchHeaders, isSafeFetchHeaderName } from './request-headers.ts'

describe('buildFetchHeaders', () => {
  it('skips HTTP/2 pseudo-headers and hop-by-hop names that used to crash Request construction', () => {
    const headers = buildFetchHeaders({
      ':method': 'PUT',
      ':path': '/api/storage/proxy-upload',
      host: 'vps-01d88277.vps.ovh.net',
      connection: 'keep-alive',
      'transfer-encoding': 'chunked',
      'content-type': 'video/quicktime',
      authorization: 'Bearer device-token',
      'x-life-os-room': 'room-1',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    })

    expect(headers.get('content-type')).toBe('video/quicktime')
    expect(headers.get('authorization')).toBe('Bearer device-token')
    expect(headers.get('x-life-os-room')).toBe('room-1')
    expect(headers.get('host')).toBe('vps-01d88277.vps.ovh.net')
    expect(headers.has('connection')).toBe(false)
    expect(headers.has('transfer-encoding')).toBe(false)
    expect([...headers.keys()].some(name => name.startsWith(':'))).toBe(false)
  })

  it('ignores illegally injected header names instead of throwing', () => {
    expect(isSafeFetchHeaderName('(illegal)')).toBe(false)
    expect(isSafeFetchHeaderName('content-type ')).toBe(false)
    expect(() => buildFetchHeaders({
      '(illegal)': '1',
      'content-type ': 'video/mp4',
      'content-type': 'video/mp4',
      authorization: 'Bearer x',
    })).not.toThrow()
    const headers = buildFetchHeaders({
      '(illegal)': '1',
      'content-type': 'video/mp4',
      authorization: 'Bearer x',
    })
    expect(headers.get('content-type')).toBe('video/mp4')
    expect(headers.get('authorization')).toBe('Bearer x')
  })
})
