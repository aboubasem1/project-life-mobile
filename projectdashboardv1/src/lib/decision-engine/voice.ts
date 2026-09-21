import { normalizeVoiceTranscript } from './normalize.js'
import type {
  DerivedItem,
  TranscriptionProvider,
  VoiceMemo,
} from './types.js'

export type VoiceCaptureDraft = {
  id: string
  audioRef: string
  durationSec?: number
  createdAt: string
  title?: string
}

export function createVoiceMemo(draft: VoiceCaptureDraft): VoiceMemo {
  return {
    id: draft.id,
    audioRef: draft.audioRef,
    durationSec: draft.durationSec,
    createdAt: draft.createdAt,
    transcriptionStatus: 'pending',
    processingStatus: 'idle',
    derivedItems: [],
    title: draft.title,
  }
}

export function applyTranscript(memo: VoiceMemo, transcript: string): VoiceMemo {
  return {
    ...memo,
    transcript,
    transcriptionStatus: 'ready',
    processingStatus: 'normalizing',
  }
}

export function voiceInputFromMemo(memo: VoiceMemo) {
  return normalizeVoiceTranscript({
    id: memo.id,
    transcript: memo.transcript ?? '',
    audioRef: memo.audioRef,
    timestamp: memo.createdAt,
  })
}

export function attachDerivedItems(memo: VoiceMemo, items: DerivedItem[]): VoiceMemo {
  return {
    ...memo,
    derivedItems: items,
    processingStatus: items.length > 0 ? 'preview' : 'done',
  }
}

export function updateDerivedItem(memo: VoiceMemo, itemId: string, patch: Partial<DerivedItem>): VoiceMemo {
  return {
    ...memo,
    derivedItems: memo.derivedItems.map(item => item.id === itemId ? { ...item, ...patch } : item),
  }
}

export async function transcribeVoiceMemo(
  memo: VoiceMemo,
  provider: TranscriptionProvider,
): Promise<VoiceMemo> {
  try {
    const result = await provider.transcribe({ audioRef: memo.audioRef })
    return applyTranscript({ ...memo, processingStatus: 'transcribing' }, result.transcript)
  } catch {
    return {
      ...memo,
      transcriptionStatus: 'failed',
      processingStatus: 'failed',
    }
  }
}

/** No provider is wired. Callers inject one later. */
export function unsupportedTranscriptionProvider(id = 'none'): TranscriptionProvider {
  return {
    id,
    async transcribe() {
      throw new Error('Kein Transcription-Provider konfiguriert.')
    },
  }
}
