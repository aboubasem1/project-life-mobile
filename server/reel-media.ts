import { spawn } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SyncHttpError } from './sync-core.js'

function runFfmpeg(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-i', inputPath,
      '-vn', '-ac', '1', '-ar', '16000', '-b:a', '32k',
      outputPath,
    ], { stdio: ['ignore', 'ignore', 'pipe'] })
    let errorText = ''
    child.stderr.on('data', chunk => { errorText += String(chunk).slice(0, 2000) })
    child.on('error', error => reject(error))
    child.on('close', code => code === 0 ? resolve() : reject(new Error(errorText || `ffmpeg exit ${code}`)))
  })
}

export async function extractReelAudio(inputPath: string, outputPath: string): Promise<Buffer> {
  try {
    await runFfmpeg(inputPath, outputPath)
    return await readFile(outputPath)
  } catch (error) {
    const missing = error instanceof Error && 'code' in error && error.code === 'ENOENT'
    throw new SyncHttpError(500, missing
      ? 'Videoverarbeitung ist auf dem Server noch nicht installiert.'
      : 'Audio konnte nicht aus dem Reel extrahiert werden.')
  }
}

/** Samples a few frames for text-only reels; failures do not block audio-first processing. */
export async function extractReelFrames(inputPath: string, outputDirectory: string): Promise<Buffer[]> {
  const outputPattern = join(outputDirectory, 'frame-%02d.jpg')
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
        '-i', inputPath,
        '-vf', 'fps=1/8,scale=720:-2', '-frames:v', '6', '-q:v', '5',
        outputPattern,
      ], { stdio: ['ignore', 'ignore', 'pipe'] })
      child.on('error', reject)
      child.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)))
    })
    const names = (await readdir(outputDirectory)).filter(name => /^frame-\d+\.jpg$/.test(name)).sort()
    return Promise.all(names.map(name => readFile(join(outputDirectory, name))))
  } catch {
    return []
  }
}
