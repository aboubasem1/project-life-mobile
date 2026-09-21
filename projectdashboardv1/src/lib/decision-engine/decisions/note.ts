import type { DecisionEntities } from '../types.js'

const NOTE_PREFIX = /^\s*(merken|notiz|note|idea|idee)\s*[-:]?\s*/i

export function isNoteCapture(text: string): boolean {
  return NOTE_PREFIX.test(text)
}

export function noteEntities(text: string, extras?: { transcriptReference?: string; relatedProject?: string }): DecisionEntities {
  const body = text.replace(NOTE_PREFIX, '').trim() || text.trim()
  const title = body.split('\n')[0]?.slice(0, 80) || 'Notiz'
  return {
    title,
    body,
    tags: ['capture'],
    transcriptReference: extras?.transcriptReference,
    relatedProject: extras?.relatedProject,
  }
}
