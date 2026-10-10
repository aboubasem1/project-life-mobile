const DEFAULT_URL = 'https://api.typesafe.ai/v1/systemone'
const DEFAULT_MODEL = 'jev-latest'

type ChoiceAnswer = {
  type?: string
  choice?: unknown
  confidence?: unknown
}

export type ReelJevResult = {
  available: boolean
  target: 'knowledge' | 'guideline' | 'source_only' | 'reject'
  risk: 'low' | 'medium' | 'high'
  lifeArea: string
  relevance: 'useful' | 'unclear' | 'not_useful'
  confidence: number
  raw?: unknown
  failure?: 'disabled' | 'timeout' | 'network' | 'provider' | 'invalid'
}

function env(name: string): string {
  return process.env[name]?.trim().replace(/^['"]|['"]$/g, '').trim() ?? ''
}

function answer(payload: unknown, key: string): ChoiceAnswer {
  if (!payload || typeof payload !== 'object') return {}
  const answers = (payload as { answers?: unknown }).answers
  if (!answers || typeof answers !== 'object') return {}
  const value = (answers as Record<string, unknown>)[key]
  return value && typeof value === 'object' ? value as ChoiceAnswer : {}
}

function choice<T extends string>(value: ChoiceAnswer, allowed: readonly T[], fallback: T): T {
  return typeof value.choice === 'string' && allowed.includes(value.choice as T) ? value.choice as T : fallback
}

function confidence(values: ChoiceAnswer[]): number {
  const scores = values
    .map(item => Number(item.confidence))
    .filter(item => Number.isFinite(item) && item >= 0 && item <= 1)
  return scores.length ? Math.min(...scores) : 0.5
}

export async function triageReelWithJev(input: {
  title: string
  summary: string
  transcript: string
  topics: string[]
  lifeAreas: string[]
}, fetchImpl: typeof fetch = fetch): Promise<ReelJevResult> {
  const apiKey = env('TYPESAFE_API_KEY') || env('JEV_API_KEY')
  const enabled = !['0', 'false', 'off', 'no'].includes(env('JEV_ENABLED').toLowerCase())
  if (!apiKey || !enabled) {
    return { available: false, target: 'source_only', risk: 'medium', lifeArea: '', relevance: 'unclear', confidence: 0, failure: 'disabled' }
  }

  const lifeAreaCriteria = Object.fromEntries([
    ['none', 'No clear LifeOS area'],
    ...input.lifeAreas.map(area => [area, area]),
  ])
  const body = {
    model: env('JEV_MODEL') || DEFAULT_MODEL,
    state: {
      title: input.title,
      summary: input.summary,
      transcript: input.transcript.slice(0, 20_000),
      topics: input.topics,
    },
    questions: {
      relevance: {
        type: 'choice',
        instructions: 'Is this source actionable, durable and useful for the user? Judge relevance only, not factual truth.',
        criteria: {
          useful: 'Contains reusable, concrete knowledge or guidance',
          unclear: 'May be useful but requires human review or more context',
          not_useful: 'Mostly entertainment, repetition, promotion, or unusable content',
        },
      },
      target: {
        type: 'choice',
        instructions: 'Where should this candidate go? This is a suggestion only. Never treat the source as verified.',
        criteria: {
          knowledge: 'Reference knowledge, explanation, idea, or source summary',
          guideline: 'A repeatable operating rule or instruction, only if evidence is sufficient',
          source_only: 'Keep the source but do not promote its claims yet',
          reject: 'No useful material to keep',
        },
      },
      risk: {
        type: 'choice',
        instructions: 'Estimate harm if an unverified claim is followed.',
        criteria: {
          low: 'Low-stakes general knowledge or reversible suggestion',
          medium: 'Could waste meaningful time or money, or needs context',
          high: 'Health, legal, financial, safety, or other high-stakes advice',
        },
      },
      life_area: {
        type: 'choice',
        instructions: 'Choose the closest existing LifeOS area. Choose none if unclear.',
        criteria: lifeAreaCriteria,
      },
    },
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.min(30_000, Number(env('JEV_TIMEOUT_MS')) || 8_000))
  try {
    const response = await fetchImpl(env('JEV_API_URL') || DEFAULT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) {
      return { available: false, target: 'source_only', risk: 'medium', lifeArea: '', relevance: 'unclear', confidence: 0, failure: 'provider' }
    }
    const payload = await response.json() as unknown
    const relevanceAnswer = answer(payload, 'relevance')
    const targetAnswer = answer(payload, 'target')
    const riskAnswer = answer(payload, 'risk')
    const areaAnswer = answer(payload, 'life_area')
    if (!relevanceAnswer.choice || !targetAnswer.choice || !riskAnswer.choice) {
      return { available: false, target: 'source_only', risk: 'medium', lifeArea: '', relevance: 'unclear', confidence: 0, failure: 'invalid' }
    }
    const area = typeof areaAnswer.choice === 'string' && input.lifeAreas.includes(areaAnswer.choice) ? areaAnswer.choice : ''
    return {
      available: true,
      target: choice(targetAnswer, ['knowledge', 'guideline', 'source_only', 'reject'] as const, 'source_only'),
      risk: choice(riskAnswer, ['low', 'medium', 'high'] as const, 'medium'),
      lifeArea: area,
      relevance: choice(relevanceAnswer, ['useful', 'unclear', 'not_useful'] as const, 'unclear'),
      confidence: confidence([relevanceAnswer, targetAnswer, riskAnswer, areaAnswer]),
      raw: payload,
    }
  } catch (error) {
    return {
      available: false,
      target: 'source_only',
      risk: 'medium',
      lifeArea: '',
      relevance: 'unclear',
      confidence: 0,
      failure: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network',
    }
  } finally {
    clearTimeout(timer)
  }
}
