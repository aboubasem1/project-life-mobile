export const MAX_VIDEO_BYTES = 512 * 1024 * 1024
const VIDEO_EXTENSION = /\.(mp4|mov|m4v|webm|qt)$/i

export type VideoFileLike = { name: string; type: string; size: number }

export function videoFileIssue(file: VideoFileLike): string | null {
  const type = file.type.toLowerCase()
  const looksLikeVideo = type.startsWith('video/') || VIDEO_EXTENSION.test(file.name)
  if (!looksLikeVideo) return 'Nur Videos (MP4, MOV oder WebM) können importiert werden.'
  if (file.size <= 0) return 'Die Datei ist leer.'
  if (file.size > MAX_VIDEO_BYTES) return 'Die Datei ist größer als 512 MB.'
  return null
}

export function planVideoBatch<T extends VideoFileLike>(files: T[], limit = 50): {
  accepted: T[]
  skipped: Array<{ name: string; reason: string }>
  batchSize: number
  hint: string
} {
  const valid: T[] = []
  const skipped: Array<{ name: string; reason: string }> = []
  for (const file of files) {
    const issue = videoFileIssue(file)
    if (issue) skipped.push({ name: file.name, reason: issue })
    else valid.push(file)
  }
  const average = valid.reduce((sum, file) => sum + file.size, 0) / Math.max(1, valid.length)
  const batchSize = average > 80 * 1024 * 1024 ? Math.min(8, limit) : limit
  const deferred = valid.slice(batchSize)
  return {
    accepted: valid.slice(0, batchSize),
    skipped: [...skipped, ...deferred.map(file => ({ name: file.name, reason: 'In der nächsten Runde auswählen.' }))],
    batchSize,
    hint: deferred.length > 0
      ? 'Große Videos werden in kleineren Runden übertragen. Lass LifeOS offen, bis diese Runde vollständig hochgeladen ist.'
      : 'Lass LifeOS offen, bis die Übertragung fertig ist. Die Verarbeitung kann danach auf dem Server weiterlaufen.',
  }
}
