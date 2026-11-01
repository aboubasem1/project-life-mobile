import { emptyLifeOsState, mergeLifeOsState, type LifeOsState } from '../lifeos'
import { applyPublishedKnowledge } from './publish'
import type { KnowledgePublishDraft } from './types'

/** Published reel knowledge stays when sync is down or a snapshot arrives without it. */
export function knowledgeAfterReelImport(input: {
  state?: LifeOsState
  drafts: KnowledgePublishDraft[]
  remoteLifeOs?: unknown
}): LifeOsState {
  const published = applyPublishedKnowledge(input.state ?? emptyLifeOsState(), input.drafts).state
  if (input.remoteLifeOs == null) return published
  return mergeLifeOsState(published, input.remoteLifeOs)
}
