import { describe, expect, it } from 'vitest'
import {
  isKnowledgeTabId,
  knowledgeSurfaceFromHash,
  knowledgeTabFromHash,
  entityIdFromHash,
} from './routing'

describe('knowledge hash routing', () => {
  it('reads entity id and tab from knowledge deep links', () => {
    expect(entityIdFromHash('#/knowledge?id=abc&tab=transcript')).toBe('abc')
    expect(knowledgeTabFromHash('#/knowledge?id=abc&tab=transcript')).toBe('transcript')
    expect(knowledgeTabFromHash('#/knowledge?id=abc&tab=jo')).toBe('jo')
    expect(knowledgeTabFromHash('#/knowledge?id=abc')).toBeUndefined()
  })

  it('rejects unknown tabs', () => {
    expect(isKnowledgeTabId('notes')).toBe(true)
    expect(isKnowledgeTabId('reader')).toBe(false)
    expect(knowledgeTabFromHash('#/knowledge?tab=reader')).toBeUndefined()
  })

  it('detects processing surface without treating it as detail', () => {
    expect(knowledgeSurfaceFromHash('#/knowledge?surface=processing')).toBe('processing')
    expect(knowledgeSurfaceFromHash('#/knowledge/processing')).toBe('processing')
    expect(knowledgeSurfaceFromHash('#/wissen/verarbeitung')).toBe('processing')
    expect(knowledgeSurfaceFromHash('#/knowledge?id=card-1&tab=notes')).toBe('detail')
    expect(knowledgeSurfaceFromHash('#/knowledge')).toBe('library')
  })
})
