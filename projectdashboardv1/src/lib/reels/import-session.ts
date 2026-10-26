export const MAX_REEL_BYTES = 512 * 1024 * 1024
export const MAX_REEL_BATCH = 50
export function validateReelFile(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm)$/i.test(file.name)) return 'Nicht unterstützte Videodatei.'
  if (!file.size) return 'Die Datei ist leer.'
  if (file.size > MAX_REEL_BYTES) return 'Die Datei ist größer als 512 MB.'
  return null
}
export function reelContentType(file: Pick<File, 'type' | 'name'>): string {
  return file.type.startsWith('video/') ? file.type : /\.mov$/i.test(file.name) ? 'video/quicktime' : /\.webm$/i.test(file.name) ? 'video/webm' : 'video/mp4'
}
export type ImportReceipt = {
  objectId: string; storageKey: string; fileName: string; contentType: string; sizeBytes: number
  checksumSha256: string | null; createdAt: string
}
export function readImportReceipts(roomId: string): ImportReceipt[] {
  try { const value = JSON.parse(localStorage.getItem(`lifeos-reel-uploads:${roomId}`) || '[]'); return Array.isArray(value) ? value : [] } catch { return [] }
}
export function rememberImportReceipt(roomId: string, receipt: ImportReceipt) {
  // Persist before transfer: after a lost response, /complete verifies actual object size.
  localStorage.setItem(`lifeos-reel-uploads:${roomId}`, JSON.stringify([...readImportReceipts(roomId).filter(r => r.objectId !== receipt.objectId), receipt].slice(-300)))
}
export function forgetImportReceipt(roomId: string, id: string) {
  localStorage.setItem(`lifeos-reel-uploads:${roomId}`, JSON.stringify(readImportReceipts(roomId).filter(r => r.objectId !== id)))
}
