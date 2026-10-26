export type ReelImportReceipt = {
  objectId: string
  storageKey: string
  fileName: string
  contentType: string
  sizeBytes: number
  checksumSha256: string | null
  lifeAreas: string[]
  uploaded: boolean
  createdAt: string
}

const PREFIX = 'lifeos.reel-import.v1.'

function key(roomId: string): string {
  return `${PREFIX}${roomId}`
}

function storage(): Storage | null {
  try { return globalThis.localStorage ?? null } catch { return null }
}

export function parseImportReceipts(value: string | null): ReelImportReceipt[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ReelImportReceipt => Boolean(
      item && typeof item.objectId === 'string' && typeof item.storageKey === 'string'
      && typeof item.fileName === 'string' && typeof item.sizeBytes === 'number'
      && typeof item.uploaded === 'boolean' && typeof item.createdAt === 'string',
    )).slice(-100)
  } catch { return [] }
}

export function loadImportReceipts(roomId: string): ReelImportReceipt[] {
  return parseImportReceipts(storage()?.getItem(key(roomId)) ?? null)
}

export function saveImportReceipt(roomId: string, receipt: ReelImportReceipt): void {
  const target = storage()
  if (!target) return
  const next = [...loadImportReceipts(roomId).filter(item => item.objectId !== receipt.objectId), receipt].slice(-100)
  target.setItem(key(roomId), JSON.stringify(next))
}

export function removeImportReceipt(roomId: string, objectId: string): void {
  const target = storage()
  if (!target) return
  const next = loadImportReceipts(roomId).filter(item => item.objectId !== objectId)
  if (next.length) target.setItem(key(roomId), JSON.stringify(next))
  else target.removeItem(key(roomId))
}

export function markImportUploaded(roomId: string, objectId: string): void {
  const receipt = loadImportReceipts(roomId).find(item => item.objectId === objectId)
  if (receipt) saveImportReceipt(roomId, { ...receipt, uploaded: true })
}
