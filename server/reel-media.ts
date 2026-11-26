import { spawn } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { SyncHttpError } from './http-error.js'

const FFMPEG_TIMEOUT_MS = Math.min(300_000, Math.max(10_000, Number(process.env.REEL_FFMPEG_TIMEOUT_MS) || 120_000))
const MIN_AUDIO_BYTES = 256
const FRAME_INTERVAL_SEC = Math.min(10, Math.max(1, Number(process.env.REEL_OCR_FRAME_INTERVAL_SEC) || 2))
const MAX_VISION_FRAMES = Math.min(24, Math.max(1, Number(process.env.REEL_VISION_MAX_FRAMES) || 12))

function runCommand(command: string, args: string[], timeoutMs = FFMPEG_TIMEOUT_MS): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`${command} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    child.stdout.on('data', chunk => { stdout += String(chunk).slice(0, 4000) })
    child.stderr.on('data', chunk => { stderr += String(chunk).slice(0, 4000) })
    child.on('error', error => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', code => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

/** Probe whether the container has at least one audio stream. Never shells out with interpolated paths. */
export async function videoHasAudioStream(inputPath: string): Promise<boolean> {
  try {
    const result = await runCommand('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'csv=p=0',
      inputPath,
    ], Math.min(30_000, FFMPEG_TIMEOUT_MS))
    if (result.code !== 0) return false
    return /audio/i.test(result.stdout.trim())
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') return true
    return true
  }
}

export async function probeVideoDurationMs(inputPath: string): Promise<number | null> {
  try {
    const result = await runCommand('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      inputPath,
    ], Math.min(30_000, FFMPEG_TIMEOUT_MS))
    if (result.code !== 0) return null
    const seconds = Number(result.stdout.trim())
    if (!Number.isFinite(seconds) || seconds <= 0) return null
    return Math.round(seconds * 1000)
  } catch {
    return null
  }
}

async function runFfmpegExtract(inputPath: string, outputPath: string): Promise<void> {
  const result = await runCommand('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-i', inputPath,
    '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '48k',
    outputPath,
  ])
  if (result.code !== 0) {
    const stderr = result.stderr.toLowerCase()
    if (stderr.includes('does not contain any stream') || stderr.includes('stream map') || stderr.includes('output file does not contain any stream')) {
      throw Object.assign(new Error('no_audio'), { code: 'NO_AUDIO' })
    }
    throw new Error(result.stderr || `ffmpeg exit ${result.code}`)
  }
}

export type ExtractAudioResult =
  | { ok: true; bytes: Buffer }
  | { ok: false; reason: 'no_audio' | 'ffmpeg_missing' | 'timeout' | 'failed'; message: string }

export async function extractReelAudio(inputPath: string, outputPath: string): Promise<ExtractAudioResult> {
  try {
    const hasAudio = await videoHasAudioStream(inputPath)
    if (!hasAudio) {
      return { ok: false, reason: 'no_audio', message: 'Keine Tonspur im Video gefunden.' }
    }
    await runFfmpegExtract(inputPath, outputPath)
    const info = await stat(outputPath)
    if (info.size < MIN_AUDIO_BYTES) {
      return { ok: false, reason: 'no_audio', message: 'Extrahierte Audiodatei ist leer.' }
    }
    const bytes = await readFile(outputPath)
    return { ok: true, bytes }
  } catch (error) {
    const missing = error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
    if (missing) {
      return { ok: false, reason: 'ffmpeg_missing', message: 'Videoverarbeitung ist auf dem Server noch nicht installiert.' }
    }
    if (error instanceof Error && (error as { code?: string }).code === 'NO_AUDIO') {
      return { ok: false, reason: 'no_audio', message: 'Keine Tonspur im Video gefunden.' }
    }
    if (error instanceof Error && /timed out/i.test(error.message)) {
      return { ok: false, reason: 'timeout', message: 'Audio-Extraktion hat zu lange gedauert.' }
    }
    return {
      ok: false,
      reason: 'failed',
      message: error instanceof Error ? error.message.slice(0, 240) : 'Audio konnte nicht aus dem Reel extrahiert werden.',
    }
  }
}

function sampleFingerprint(buffer: Buffer): string {
  // Coarse byte histogram fingerprint to drop near-identical frames without a heavy image lib.
  const buckets = new Array<number>(16).fill(0)
  const step = Math.max(1, Math.floor(buffer.length / 2048))
  for (let i = 0; i < buffer.length; i += step) buckets[(buffer[i] >> 4) & 15] += 1
  return buckets.join(',')
}

function fingerprintsSimilar(a: string, b: string): boolean {
  const left = a.split(',').map(Number)
  const right = b.split(',').map(Number)
  if (left.length !== right.length) return false
  let distance = 0
  let total = 0
  for (let i = 0; i < left.length; i += 1) {
    distance += Math.abs(left[i] - right[i])
    total += left[i] + right[i]
  }
  if (total <= 0) return true
  return distance / total < 0.04
}

export type SampledFrame = {
  buffer: Buffer
  approxMs: number
}

/**
 * Samples frames at t=0, every N seconds (default 2s), and via scene-change filter.
 * Near-duplicates are dropped. This is an approximation — very short overlays can be missed.
 */
export async function extractReelFrames(
  inputPath: string,
  outputDirectory: string,
  options: { maxFrames?: number; intervalSec?: number } = {},
): Promise<SampledFrame[]> {
  const maxFrames = options.maxFrames ?? MAX_VISION_FRAMES
  const intervalSec = options.intervalSec ?? FRAME_INTERVAL_SEC
  const durationMs = await probeVideoDurationMs(inputPath)
  const outputPattern = join(outputDirectory, 'frame-%03d.jpg')
  try {
    // Interval sampling + light scene detection. Scene threshold is intentionally moderate.
    const vf = `fps=1/${intervalSec},select='eq(n\\,0)+gt(scene\\,0.28)',scale=720:-2`
    const result = await runCommand('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-i', inputPath,
      '-vf', vf,
      '-frames:v', String(Math.max(maxFrames * 2, maxFrames)),
      '-q:v', '5',
      outputPattern,
    ])
    if (result.code !== 0) {
      // Fallback: simple fixed-interval sampling without scene filter.
      const fallback = await runCommand('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
        '-i', inputPath,
        '-vf', `fps=1/${intervalSec},scale=720:-2`,
        '-frames:v', String(maxFrames),
        '-q:v', '5',
        outputPattern,
      ])
      if (fallback.code !== 0) return []
    }
    const names = (await readdir(outputDirectory)).filter(name => /^frame-\d+\.jpg$/.test(name)).sort()
    const sampled: SampledFrame[] = []
    const fingerprints: string[] = []
    for (let index = 0; index < names.length; index += 1) {
      const buffer = await readFile(join(outputDirectory, names[index]))
      const fingerprint = sampleFingerprint(buffer)
      if (fingerprints.some(existing => fingerprintsSimilar(existing, fingerprint))) continue
      fingerprints.push(fingerprint)
      const approxMs = durationMs != null
        ? Math.min(durationMs, Math.round(index * intervalSec * 1000))
        : Math.round(index * intervalSec * 1000)
      sampled.push({ buffer, approxMs })
      if (sampled.length >= maxFrames) break
    }
    return sampled
  } catch {
    return []
  }
}

/** Hard failure helper kept for callers that still expect SyncHttpError. */
export function extractAudioOrThrow(result: ExtractAudioResult): Buffer {
  if (result.ok) return result.bytes
  if (result.reason === 'ffmpeg_missing') throw new SyncHttpError(500, result.message)
  if (result.reason === 'no_audio') throw new SyncHttpError(422, result.message)
  throw new SyncHttpError(500, result.message)
}

export { FRAME_INTERVAL_SEC, MAX_VISION_FRAMES }
