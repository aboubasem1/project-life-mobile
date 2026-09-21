import { parseProviderDecision } from '../schemas.js'
import type { DecisionProviderAdapter } from '../types.js'

export type LlmProviderConfig = {
  apiUrl?: string
  apiKey?: string
  model?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

function readServerEnv(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name]
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const SYSTEM = [
  'Return only JSON: {"domain":"...","intent":"...","confidence":0-1,"content":"...","entities":{},"suggestedAction":"...","reasonCode":"OK"}.',
  'Use only known domains and intents. Never invent nutrition values or new projects.',
  'If unsure, intent=REVIEW, domain=UNKNOWN, confidence<0.7.',
].join(' ')

export function createLlmProvider(config: LlmProviderConfig = {}): DecisionProviderAdapter {
  return {
    id: 'llm',
    async decide({ item, input, context }) {
      const apiUrl = config.apiUrl || readServerEnv('LLM_API_URL') || 'https://api.openai.com/v1/chat/completions'
      const apiKey = config.apiKey || readServerEnv('LLM_API_KEY') || readServerEnv('OPENAI_API_KEY')
      const model = config.model || readServerEnv('LLM_MODEL') || 'gpt-4o-mini'
      const timeoutMs = config.timeoutMs ?? 4000
      const fetchImpl = config.fetchImpl ?? globalThis.fetch
      if (!apiKey || !fetchImpl) return null

      try {
        const response = await fetchWithTimeout(fetchImpl, apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: SYSTEM },
              {
                role: 'user',
                content: JSON.stringify({
                  content: item.content,
                  source: input.source,
                  meals: (context.routineMeals ?? []).map(meal => meal.label),
                  projects: (context.projects ?? []).map(project => project.label),
                }),
              },
            ],
          }),
        }, timeoutMs)
        if (!response.ok) return null
        const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
        const text = payload.choices?.[0]?.message?.content
        if (!text) return null
        return parseProviderDecision(JSON.parse(text), item.content)
      } catch {
        return null
      }
    },
  }
}
