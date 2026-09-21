import { parseLifeOSInput } from './schemas.js'
import type { LifeOSInput, LifeOSInputSource } from './types.js'

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g

export function normalizeText(raw: string): string {
  return raw
    .replace(ZERO_WIDTH, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function sourceFromHints(hints?: {
  source?: unknown
  module?: string
  hasAudio?: boolean
}): LifeOSInputSource {
  if (hints?.source === 'voice' || hints?.hasAudio) return 'voice'
  if (hints?.source === 'note' || hints?.module === 'note' || hints?.module === 'knowledge') return 'note'
  if (hints?.source === 'meal' || hints?.module === 'nutrition') return 'meal'
  if (hints?.source === 'shopping' || hints?.module === 'shopping') return 'shopping'
  if (hints?.source === 'radar') return 'radar'
  if (hints?.source === 'email') return 'email'
  if (hints?.source === 'calendar') return 'calendar'
  if (hints?.source === 'system') return 'system'
  return 'quick_add'
}

/** Voice audio is not decided here. Transcript / text is the engine input. */
export function normalizeVoiceTranscript(input: {
  id?: string
  transcript: string
  audioRef?: string
  timestamp?: string
}): LifeOSInput {
  return {
    id: input.id || `voice_${Date.now()}`,
    source: 'voice',
    content: normalizeText(input.transcript),
    timestamp: input.timestamp || new Date().toISOString(),
    audioRef: input.audioRef,
    transcriptId: input.id,
  }
}

export function toLifeOSInput(raw: unknown, fallback?: {
  id?: string
  source?: LifeOSInputSource
  timestamp?: string
}): LifeOSInput | null {
  const timestamp = fallback?.timestamp || new Date().toISOString()
  const id = fallback?.id || `in_${Date.now().toString(36)}`
  const parsed = parseLifeOSInput(raw, id, timestamp)
  if (!parsed) return null
  return {
    ...parsed,
    source: fallback?.source ?? parsed.source,
    content: normalizeText(parsed.content),
  }
}

export function isBlankInput(content: string): boolean {
  const text = normalizeText(content)
  return text.length === 0 || text === '?' || text === '??' || /^[?.!,\s]+$/.test(text)
}
