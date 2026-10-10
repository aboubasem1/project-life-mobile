import { afterEach, describe, expect, it } from 'vitest'
import { triageReelWithJev } from './reel-jev'

const original = {
  key: process.env.TYPESAFE_API_KEY,
  enabled: process.env.JEV_ENABLED,
}

afterEach(() => {
  if (original.key === undefined) delete process.env.TYPESAFE_API_KEY
  else process.env.TYPESAFE_API_KEY = original.key
  if (original.enabled === undefined) delete process.env.JEV_ENABLED
  else process.env.JEV_ENABLED = original.enabled
})

describe('reel JEV triage', () => {
  it('fails closed to source-only without a key', async () => {
    delete process.env.TYPESAFE_API_KEY
    delete process.env.JEV_API_KEY
    const result = await triageReelWithJev({ title: 'Test', summary: '', transcript: 'Text', topics: [], lifeAreas: ['health'] })
    expect(result).toMatchObject({ available: false, target: 'source_only', relevance: 'unclear', failure: 'disabled' })
  })

  it('maps only bounded SystemOne choices', async () => {
    process.env.TYPESAFE_API_KEY = 'test-key'
    process.env.JEV_ENABLED = 'true'
    const fetchImpl = async () => new Response(JSON.stringify({
      answers: {
        relevance: { type: 'choice', choice: 'useful', confidence: 0.92 },
        target: { type: 'choice', choice: 'guideline', confidence: 0.88 },
        risk: { type: 'choice', choice: 'high', confidence: 0.95 },
        life_area: { type: 'choice', choice: 'health', confidence: 0.9 },
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    const result = await triageReelWithJev({
      title: 'Schlaf', summary: 'Eine Schlafregel', transcript: 'Behauptung', topics: ['Schlaf'], lifeAreas: ['health', 'work'],
    }, fetchImpl)
    expect(result).toMatchObject({
      available: true,
      target: 'guideline',
      risk: 'high',
      lifeArea: 'health',
      relevance: 'useful',
      confidence: 0.88,
    })
  })
})
