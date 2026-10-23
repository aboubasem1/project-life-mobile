import { describe, expect, it } from 'vitest'
import { planVideoBatch, videoFileIssue } from './files'

describe('reel file selection', () => {
  it('accepts iPhone video types and rejects empty or oversized files', () => {
    expect(videoFileIssue({ name: 'IMG_1.MOV', type: '', size: 2048 })).toBeNull()
    expect(videoFileIssue({ name: 'clip.mp4', type: 'video/mp4', size: 10 })).toBeNull()
    expect(videoFileIssue({ name: 'notes.txt', type: 'text/plain', size: 10 })).toMatch(/Videos/)
    expect(videoFileIssue({ name: 'empty.mp4', type: 'video/mp4', size: 0 })).toMatch(/leer/)
    expect(videoFileIssue({ name: 'huge.mov', type: 'video/quicktime', size: 513 * 1024 * 1024 })).toMatch(/512 MB/)
  })

  it('keeps a practical batch and defers the rest without dropping earlier rounds', () => {
    const files = Array.from({ length: 60 }, (_, index) => ({ name: `clip-${index}.mp4`, type: 'video/mp4', size: 1024 }))
    const plan = planVideoBatch(files)
    expect(plan.accepted).toHaveLength(50)
    expect(plan.skipped.some(item => item.reason.includes('nächsten Runde'))).toBe(true)
  })

  it('shrinks the batch when videos are large', () => {
    const files = Array.from({ length: 12 }, (_, index) => ({ name: `big-${index}.mov`, type: 'video/quicktime', size: 90 * 1024 * 1024 }))
    const plan = planVideoBatch(files)
    expect(plan.batchSize).toBe(8)
    expect(plan.accepted).toHaveLength(8)
    expect(plan.hint).toMatch(/kleineren Runden/)
  })
})
