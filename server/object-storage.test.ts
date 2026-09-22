import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createObjectKey,
  createPresignedDownload,
  createPresignedUpload,
  handleSignedLocalObject,
  headStoredObject,
  normalizeContentType,
  parseObjectCategory,
} from './object-storage.ts'

let temporaryRoot = ''

afterEach(async () => {
  delete process.env.LOCAL_OBJECT_STORAGE_ROOT
  delete process.env.OBJECT_STORAGE_SIGNING_SECRET
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true })
  temporaryRoot = ''
})

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

  it('uploads and downloads through short-lived signed local URLs', async () => {
    temporaryRoot = await mkdtemp(join(tmpdir(), 'lifeos-object-storage-'))
    process.env.LOCAL_OBJECT_STORAGE_ROOT = temporaryRoot
    process.env.OBJECT_STORAGE_SIGNING_SECRET = 'test-only-signing-secret'
    const storageKey = createObjectKey('documents', 'room-123')
    const upload = await createPresignedUpload({ storageKey, contentType: 'text/plain' })
    const uploadResponse = await handleSignedLocalObject(new Request(new URL(upload.url, 'http://lifeos.test'), {
      method: 'PUT',
      headers: upload.headers,
      body: 'LifeOS local storage',
    }))
    expect(uploadResponse.status).toBe(204)
    await expect(headStoredObject(storageKey)).resolves.toMatchObject({
      sizeBytes: 20,
      contentType: 'text/plain',
    })

    const download = await createPresignedDownload({
      storageKey,
      fileName: 'test.txt',
      contentType: 'text/plain',
    })
    const downloadResponse = await handleSignedLocalObject(new Request(new URL(download.url, 'http://lifeos.test')))
    expect(downloadResponse.status).toBe(200)
    await expect(downloadResponse.text()).resolves.toBe('LifeOS local storage')
  })
})
