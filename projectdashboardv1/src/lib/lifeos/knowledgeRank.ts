import type { LifeAreaKey } from './areas.js'

export type KnowledgeEvidence = 'verified' | 'mixed' | 'unverified' | 'source_only'

export type KnowledgeDoc = {
  id: string
  title: string
  summary: string
  content: string
  topics: string[]
  tags: string[]
  source: string
  lifeArea?: string
  areaLocked?: boolean
  updatedAt: string
}

export type RankedKnowledge = { id: string; score: number }

export type RelationRole = 'related_to' | 'supports' | 'contradicts' | 'applicable_to' | 'derived_from'

export type RelationSuggestion = {
  fromId: string
  toKind: 'knowledge' | 'goal' | 'project' | 'decision'
  toId: string
  role: RelationRole
  reason: string
}

const STOP = new Set([
  'und', 'oder', 'der', 'die', 'das', 'ein', 'eine', 'einer', 'dem', 'den', 'des',
  'the', 'and', 'or', 'a', 'an', 'to', 'of', 'in', 'im', 'am', 'zu', 'fur', 'fuer', 'mit',
  'auf', 'ist', 'sind', 'ich', 'mein', 'meine', 'für', 'über', 'uber',
])

const TOPIC_ALIASES: Record<string, string> = {
  training: 'training', workout: 'training', muskelaufbau: 'training', krafttraining: 'training',
  ernaehrung: 'nutrition', ernährung: 'nutrition', nutrition: 'nutrition', essen: 'nutrition',
  gesundheit: 'health', health: 'health', schlaf: 'health',
  produktivitaet: 'productivity', produktivität: 'productivity', productivity: 'productivity',
  business: 'business', unternehmen: 'business',
  finanzen: 'finance', finance: 'finance', geld: 'finance',
  technologie: 'technology', technology: 'technology', software: 'technology',
  entwicklung: 'personal-development', lernen: 'personal-development',
}

const AREA_BY_TOPIC: Record<string, LifeAreaKey> = {
  training: 'health', nutrition: 'health', health: 'health',
  productivity: 'growth', 'personal-development': 'growth',
  business: 'work', finance: 'work', technology: 'work',
}

export function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function tokensOf(value: string): string[] {
  return [...new Set(normalizeToken(value).split(' ').filter(token => token.length > 2 && !STOP.has(token)))]
}

export function normalizeTopic(value: string): string {
  const compact = normalizeToken(value).replace(/ /g, '-')
  const first = normalizeToken(value).split(' ')[0] || ''
  return TOPIC_ALIASES[compact] || TOPIC_ALIASES[first] || value.trim()
}

export function suggestLifeArea(topics: string[], text = ''): LifeAreaKey | undefined {
  const names = [...topics.map(normalizeTopic), ...tokensOf(text).map(normalizeTopic)]
  for (const name of names) {
    const area = AREA_BY_TOPIC[name]
    if (area) return area
  }
  return undefined
}

export function keepManualArea<T extends { lifeArea?: string; areaLocked?: boolean }>(item: T, suggestion?: string): T {
  if (item.areaLocked || item.lifeArea) return item
  return suggestion ? { ...item, lifeArea: suggestion } : item
}

function documentText(doc: KnowledgeDoc): string {
  return [doc.title, doc.summary, doc.topics.join(' '), doc.content, doc.source].join(' ')
}

export function tokenSimilarity(left: string, right: string): number {
  const a = new Set(tokensOf(left))
  const b = new Set(tokensOf(right))
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared += 1
  return shared / (a.size + b.size - shared)
}

function expandTokens(tokens: string[]): string[] {
  return [...new Set(tokens.flatMap(token => {
    const alias = TOPIC_ALIASES[token]
    return alias ? [token, alias] : [token]
  }))]
}

export function rankKnowledge(items: KnowledgeDoc[], query: string, limit = 20): RankedKnowledge[] {
  const needles = expandTokens(tokensOf(query))
  if (needles.length === 0) return []
  const ranked = items.flatMap(item => {
    const title = expandTokens(tokensOf(item.title))
    const topics = expandTokens(item.topics.flatMap(topic => tokensOf(normalizeTopic(topic))))
    const summary = expandTokens(tokensOf(item.summary))
    const body = expandTokens(tokensOf(documentText(item)))
    let score = 0
    for (const needle of needles) {
      if (title.includes(needle)) score += 5
      if (topics.includes(needle)) score += 4
      if (summary.includes(needle)) score += 2
      if (body.includes(needle)) score += 1
    }
    score += tokenSimilarity(query, documentText(item))
    return score > 0 ? [{ id: item.id, score }] : []
  })
  return ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit)
}

export function semanticFallback(left: string, right: string): number {
  return tokenSimilarity(left, right)
}

export type IndexRow = { id: string; updatedAt: string }

export function planIndexUpdate(existing: IndexRow[], next: KnowledgeDoc[]): { upsert: KnowledgeDoc[]; remove: string[] } {
  const nextIds = new Set(next.map(item => item.id))
  const previous = new Map(existing.map(item => [item.id, item.updatedAt]))
  return {
    remove: existing.filter(item => !nextIds.has(item.id)).map(item => item.id),
    upsert: next.filter(item => previous.get(item.id) !== item.updatedAt),
  }
}

export function documentsInRoom<T extends { roomId: string }>(rows: T[], roomId: string): T[] {
  return rows.filter(row => row.roomId === roomId)
}

type Named = { id: string; title: string }
type ExistingEdge = { fromKind: string; fromId: string; toKind: string; toId: string; role?: string }

function edgeExists(edges: ExistingEdge[], fromId: string, toKind: string, toId: string, role: string): boolean {
  return edges.some(edge => (
    edge.role === role
    && ((edge.fromKind === 'knowledge' && edge.fromId === fromId && edge.toKind === toKind && edge.toId === toId)
      || (edge.toKind === 'knowledge' && edge.toId === fromId && edge.fromKind === toKind && edge.fromId === toId))
  ))
}

export function suggestRelations(input: {
  focusId: string
  items: KnowledgeDoc[]
  relations: ExistingEdge[]
  goals?: Named[]
  projects?: Named[]
  decisions?: Named[]
}): RelationSuggestion[] {
  const focus = input.items.find(item => item.id === input.focusId)
  if (!focus) return []
  const suggestions: RelationSuggestion[] = []
  const focusTopics = new Set(focus.topics.map(normalizeTopic).filter(Boolean))
  const focusText = documentText(focus)
  for (const other of input.items) {
    if (other.id === focus.id) continue
    if (suggestions.length >= 6) break
    const sharedTopic = other.topics.some(topic => focusTopics.has(normalizeTopic(topic)))
    const similarity = tokenSimilarity(focusText, documentText(other))
    const contradiction = /widerspro|contradict/i.test(`${focus.content} ${other.content}`) && sharedTopic
    const role: RelationRole = contradiction ? 'contradicts' : similarity >= 0.62 ? 'supports' : 'related_to'
    if (!sharedTopic && similarity < 0.45) continue
    if (edgeExists(input.relations, focus.id, 'knowledge', other.id, role)) continue
    suggestions.push({
      fromId: focus.id,
      toKind: 'knowledge',
      toId: other.id,
      role,
      reason: contradiction ? 'Ähnliches Thema, widersprüchliche Aussage' : similarity >= 0.62 ? 'Sehr ähnliche Aussage' : 'Gleiches Thema',
    })
  }
  const namedGroups: Array<{ kind: RelationSuggestion['toKind']; role: RelationRole; items: Named[] }> = [
    { kind: 'goal', role: 'applicable_to', items: input.goals ?? [] },
    { kind: 'project', role: 'applicable_to', items: input.projects ?? [] },
    { kind: 'decision', role: 'related_to', items: input.decisions ?? [] },
  ]
  for (const group of namedGroups) {
    for (const named of group.items) {
      if (suggestions.length >= 8) return suggestions
      const namedTokens = tokensOf(named.title)
      const hit = namedTokens.some(token => focusTopics.has(normalizeTopic(token)) || tokensOf(focusText).includes(token))
      if (!hit || edgeExists(input.relations, focus.id, group.kind, named.id, group.role)) continue
      suggestions.push({
        fromId: focus.id,
        toKind: group.kind,
        toId: named.id,
        role: group.role,
        reason: group.kind === 'decision' ? 'Passt zur Entscheidung' : 'Passt zum bestehenden Ziel',
      })
    }
  }
  return suggestions
}

export function documentsFromLifeOs(lifeOs: unknown): KnowledgeDoc[] {
  if (!lifeOs || typeof lifeOs !== 'object') return []
  const knowledge = (lifeOs as { knowledge?: unknown }).knowledge
  if (!Array.isArray(knowledge)) return []
  return knowledge.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    if (!id || !title) return []
    const list = (value: unknown) => Array.isArray(value) ? value.map(entry => String(entry)).filter(Boolean).slice(0, 20) : []
    return [{
      id,
      title,
      summary: typeof row.summary === 'string' ? row.summary.slice(0, 500) : '',
      content: typeof row.content === 'string' ? row.content.slice(0, 4000) : '',
      topics: list(row.topics),
      tags: list(row.tags),
      source: typeof row.source === 'string' ? row.source.slice(0, 180) : '',
      lifeArea: typeof row.lifeArea === 'string' ? row.lifeArea : undefined,
      areaLocked: row.areaLocked === true,
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : '',
    }]
  })
}

export function preferredSemanticEngine(vectorInstalled: boolean, embeddingsEnabled: boolean): 'pgvector' | 'lexical' {
  return vectorInstalled && embeddingsEnabled ? 'pgvector' : 'lexical'
}
