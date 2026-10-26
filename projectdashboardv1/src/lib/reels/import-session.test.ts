import { beforeEach, describe, expect, it } from 'vitest'
import { loadImportReceipts, markImportUploaded, parseImportReceipts, removeImportReceipt, saveImportReceipt } from './import-session'

const values = new Map<string, string>()
const memoryStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value) },
  removeItem: (key: string) => { values.delete(key) },
  clear: () => values.clear(),
  key: (index: number) => [...values.keys()][index] ?? null,
  get length() { return values.size },
} satisfies Storage

beforeEach(() => {
  values.clear()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage })
})

describe('reel import receipts', () => {
  it('restores valid uploaded receipts and ignores corrupt records', () => {
    const receipt = {
      objectId: 'object-1', storageKey: 'room/media/object-1', fileName: 'IMG.MOV',
      contentType: 'video/quicktime', sizeBytes: 42, checksumSha256: null,
      lifeAreas: ['health'], uploaded: true, createdAt: '2026-01-01T00:00:00.000Z',
    }
    expect(parseImportReceipts(JSON.stringify([receipt, { objectId: 4 }]))).toEqual([receipt])
    expect(parseImportReceipts('{broken')).toEqual([])
  })

  it('persists upload state per room and removes completed registrations', () => {
    const receipt = {
      objectId: 'object-1', storageKey: 'room/media/object-1', fileName: 'IMG.MOV',
      contentType: 'video/quicktime', sizeBytes: 42, checksumSha256: null,
      lifeAreas: ['health'], uploaded: false, createdAt: '2026-01-01T00:00:00.000Z',
    }
    saveImportReceipt('room-a', receipt)
    markImportUploaded('room-a', receipt.objectId)
    expect(loadImportReceipts('room-a')[0]?.uploaded).toBe(true)
    expect(loadImportReceipts('room-b')).toEqual([])
    removeImportReceipt('room-a', receipt.objectId)
    expect(loadImportReceipts('room-a')).toEqual([])
  })
})
