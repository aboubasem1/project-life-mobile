import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractReelAudio, extractReelFrames } from './reel-media'
let available = true
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }) } catch { available = false }
let directory: string
async function dir() { directory = await mkdtemp(join(tmpdir(), 'reel-test-')); return directory }
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }) })
describe.skipIf(!available)('real FFmpeg media extraction', () => {
  it('extracts audio from a normal MP4', async () => {
    const root = await dir(); const input = join(root, 'normal.mp4')
    execFileSync('ffmpeg', ['-loglevel','error','-f','lavfi','-i','color=c=black:s=160x120:r=10','-f','lavfi','-i','sine=frequency=440','-t','1','-c:v','libx264','-c:a','aac',input])
    expect((await extractReelAudio(input, join(root, 'audio.mp3'))).length).toBeGreaterThan(100)
  })
  it('extracts a frame from a short silent MOV for OCR', async () => {
    const root = await dir(); const input = join(root, 'silent.mov')
    execFileSync('ffmpeg', ['-loglevel','error','-f','lavfi','-i','color=c=white:s=160x120:r=10','-t','1','-c:v','libx264',input])
    expect((await extractReelFrames(input, root)).length).toBeGreaterThan(0)
  })
  it('rejects corrupt media without exposing decoder output', async () => {
    const root = await dir(); const input = join(root, 'corrupt.mp4'); await writeFile(input, 'not a video')
    await expect(extractReelAudio(input, join(root,'audio.mp3'))).rejects.toThrow('Audio konnte nicht')
  })
})
