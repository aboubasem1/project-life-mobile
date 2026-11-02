import { spawn } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { SyncHttpError } from './sync-core.js'

const FFMPEG_TIMEOUT_MS = Math.min(300_000, Math.max(10_000, Number(process.env.REEL_FFMPEG_TIMEOUT_MS) || 120_000))
const MIN_AUDIO_BYTES = 256

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
    // If ffprobe is missing, fall through to ffmpeg extract and interpret failures.
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') return true
    return true
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

/** Samples a few frames for OCR; failures do not block audio-first processing. */
export async function extractReelFrames(inputPath: string, outputDirectory: string): Promise<Buffer[]> {
  const outputPattern = join(outputDirectory, 'frame-%02d.jpg')
  try {
    const result = await runCommand('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-i', inputPath,
      '-vf', 'fps=1/8,scale=720:-2', '-frames:v', '6', '-q:v', '5',
      outputPattern,
    ])
    if (result.code !== 0) return []
    const names = (await readdir(outputDirectory)).filter(name => /^frame-\d+\.jpg$/.test(name)).sort()
    return Promise.all(names.map(name => readFile(join(outputDirectory, name))))
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
