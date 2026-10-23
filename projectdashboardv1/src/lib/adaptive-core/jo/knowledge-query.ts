import type { JoClassification } from './orchestrator.js'
import { classifyJoIntent } from './orchestrator.js'
import {
  normalizeTopic,
  rankKnowledge,
  suggestRelations,
  type KnowledgeDoc,
} from '../../lifeos/knowledgeRank.js'

export type KnowledgeQuerySource = {
  id: string
  title: string
  snippet: string
  evidenceStatus?: 'verified' | 'mixed' | 'unverified' | 'source_only'
  riskLevel?: 'low' | 'medium' | 'high'
}

export type KnowledgeQueryAnswer = {
  searched: true
  found: boolean
  answer: string
  sources: KnowledgeQuerySource[]
  caution?: string
}

export type KnowledgeQueryItem = KnowledgeDoc & {
  evidenceStatus?: KnowledgeQuerySource['evidenceStatus']
  riskLevel?: KnowledgeQuerySource['riskLevel']
}

const KNOWLEDGE_QUERY = /\b(was\s+habe\s+ich|welche\s+(tipps|erkenntnisse|empfehlungen|quellen)|fasse|zusammenfassen|widersprechen|widerspruch|originalquelle|gesammelt|aus\s+meinen\s+(reels|quellen)|über\s+\w+|muskelaufbau|produktivit|business-?reels?)\b/i
const CONTRADICTION = /\b(widersprechen|widerspruch|contradict)\b/i
const ORIGINAL = /\b(originalquelle|original\s+quelle|zeige\s+mir\s+die\s+quelle)\b/i

const EVIDENCE_LABEL: Record<NonNullable<KnowledgeQuerySource['evidenceStatus']>, string> = {
  verified: 'belegt',
  mixed: 'teilweise belegt',
  unverified: 'unbelegt',
  source_only: 'nur Quelle',
}

export function isKnowledgeQuery(text: string): boolean {
  const content = text.trim()
  if (!content) return false
  if (KNOWLEDGE_QUERY.test(content)) return true
  const route = classifyJoIntent(content).route
  return route === 'QUERY'
}

export function classifyKnowledgeAwareIntent(text: string): JoClassification {
  const content = text.trim()
  if (!content) return classifyJoIntent(content)
  if (KNOWLEDGE_QUERY.test(content)) {
    return { route: 'QUERY', confidence: 0.88, reason: 'knowledge_query' }
  }
  return classifyJoIntent(content)
}

function sanitizeSnippet(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/ignore (all|previous) instructions/gi, '[entfernt]')
    .replace(/system\s*:/gi, '[entfernt]')
    .trim()
    .slice(0, 180)
}

function toDocs(items: KnowledgeQueryItem[]): KnowledgeDoc[] {
  return items.map(item => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    content: item.content,
    topics: item.topics,
    tags: item.tags,
    source: item.source,
    lifeArea: item.lifeArea,
    areaLocked: item.areaLocked,
    updatedAt: item.updatedAt,
  }))
}

function sourceFrom(item: KnowledgeQueryItem): KnowledgeQuerySource {
  return {
    id: item.id,
    title: item.title,
    snippet: sanitizeSnippet(item.summary || item.content || item.title),
    evidenceStatus: item.evidenceStatus,
    riskLevel: item.riskLevel,
  }
}

function labelEvidence(item: KnowledgeQueryItem): string {
  return item.evidenceStatus ? EVIDENCE_LABEL[item.evidenceStatus] : 'ungeprüft'
}

function answerFromHits(question: string, hits: KnowledgeQueryItem[]): KnowledgeQueryAnswer {
  const sources = hits.slice(0, 5).map(sourceFrom)
  if (hits.length === 0) {
    return {
      searched: true,
      found: false,
      answer: 'Dazu habe ich in deinem Knowledge nichts Passendes gefunden.',
      sources: [],
      caution: 'Es wurde nicht geraten. Speichere zuerst passende Einträge oder formuliere die Frage enger.',
    }
  }

  if (ORIGINAL.test(question)) {
    const first = hits[0]
    return {
      searched: true,
      found: true,
      answer: `Die passende Quelle ist „${first.title}“ (${labelEvidence(first)}).`,
      sources,
      caution: first.evidenceStatus === 'verified' ? undefined : 'Aussagen aus Reels bleiben Behauptungen, bis sie belegt sind.',
    }
  }

  if (CONTRADICTION.test(question)) {
    const focus = hits[0]
    const relations = suggestRelations({
      focusId: focus.id,
      items: toDocs(hits),
      relations: [],
    }).filter(item => item.role === 'contradicts')
    if (relations.length === 0) {
      return {
        searched: true,
        found: true,
        answer: 'In den gefundenen Einträgen sehe ich keinen klaren Widerspruch.',
        sources,
      }
    }
    const other = hits.find(item => item.id === relations[0].toId)
    return {
      searched: true,
      found: true,
      answer: other
        ? `„${focus.title}“ und „${other.title}“ wirken widersprüchlich. Beide bleiben mit ihrem Belegstatus gespeichert.`
        : `Zu „${focus.title}“ gibt es einen Widerspruchsvorschlag.`,
      sources,
      caution: 'Das ist ein Hinweis aus deinen Notizen, keine externe Faktprüfung.',
    }
  }

  const bullets = hits.slice(0, 3).map(item => {
    const claim = sanitizeSnippet(item.summary || item.content)
    return `• ${item.title}: ${claim} (${labelEvidence(item)})`
  })
  const highRisk = hits.some(item => item.riskLevel === 'high' || item.evidenceStatus === 'source_only' || item.evidenceStatus === 'unverified')
  return {
    searched: true,
    found: true,
    answer: `Dazu habe ich ${hits.length} passende Einträge gefunden:\n${bullets.join('\n')}`,
    sources,
    caution: highRisk
      ? 'Unbelegte oder nur als Quelle gespeicherte Reel-Aussagen sind keine geprüften Anweisungen.'
      : undefined,
  }
}

export function answerKnowledgeQuery(input: {
  question: string
  knowledge: KnowledgeQueryItem[]
  goals?: Array<{ id: string; title: string }>
}): KnowledgeQueryAnswer {
  const question = input.question.trim()
  if (!question) {
    return {
      searched: true,
      found: false,
      answer: 'Stelle eine Frage zu deinem gespeicherten Wissen.',
      sources: [],
    }
  }

  // Untrusted source text must never become instructions — only quoted snippets above.
  const ranked = rankKnowledge(toDocs(input.knowledge), question, 8)
  let hits = ranked
    .map(hit => input.knowledge.find(item => item.id === hit.id))
    .filter((item): item is KnowledgeQueryItem => Boolean(item))

  if (input.goals?.length) {
    const goalTokens = new Set(input.goals.flatMap(goal => goal.title.toLowerCase().split(/\W+/).filter(Boolean)))
    hits = [...hits].sort((a, b) => {
      const score = (item: KnowledgeQueryItem) => item.topics.some(topic => goalTokens.has(normalizeTopic(topic)))
        || item.title.toLowerCase().split(/\W+/).some(token => goalTokens.has(token)) ? 1 : 0
      return score(b) - score(a)
    })
  }

  return answerFromHits(question, hits)
}

export function tryAnswerKnowledgeQuery(input: {
  text: string
  knowledge: KnowledgeQueryItem[]
  goals?: Array<{ id: string; title: string }>
}): { classification: JoClassification; answer: KnowledgeQueryAnswer } | null {
  const classification = classifyKnowledgeAwareIntent(input.text)
  if (classification.route !== 'QUERY') return null
  return {
    classification,
    answer: answerKnowledgeQuery({
      question: input.text,
      knowledge: input.knowledge,
      goals: input.goals,
    }),
  }
}
