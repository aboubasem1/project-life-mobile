import { parseProviderDecision } from '../schemas.js'
import { parseDueDate, taskTitle } from '../decisions/task.js'
import {
  DECISION_DOMAINS,
  DECISION_INTENTS,
  type DecisionContext,
  type DecisionDomain,
  type DecisionIntent,
  type DecisionProviderAdapter,
  type LifeOSInput,
  type NormalizedItem,
  type ProviderDecision,
  type ReasonCode,
} from '../types.js'

export const TYPESAFE_SYSTEMONE_URL = 'https://api.typesafe.ai/v1/systemone'
export const TYPESAFE_DEFAULT_MODEL = 'jev-latest'

export type JevProviderConfig = {
  apiUrl?: string
  apiKey?: string
  model?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export type JevFailure = {
  kind: 'timeout' | 'http_4xx' | 'http_5xx' | 'invalid' | 'rate_limit' | 'network' | 'disabled'
  status?: number
}

type ChoiceAnswer = {
  type: 'choice'
  choice: string
  probabilities?: Record<string, number>
  confidence?: number
}

type NoulAnswer = {
  type: 'noul'
  noul: number
}

type SystemOneResponse = {
  model?: string
  answers?: Record<string, ChoiceAnswer | NoulAnswer | { type?: string }>
}

const DOMAIN_CRITERIA: Record<DecisionDomain, string> = {
  TASK: 'A to-do the user wants tracked',
  NOTE: 'Something to remember, not necessarily act on now',
  NUTRITION: 'Food, drink, or a routine meal that was consumed',
  SHOPPING: 'Buy, order, or restock a product',
  PROJECT: 'Work on an existing project',
  CALENDAR: 'A dated appointment or schedule change',
  ROUTINE: 'A habitual check-in or ritual step',
  KNOWLEDGE: 'Reference material to keep',
  FINANCE: 'Money, invoices, or spending',
  WORK: 'Job, claims, customers, or admin work',
  PERSONAL: 'Private or family life',
  RADAR: 'A watchlist, price, or match signal',
  HEALTH: 'Body, labs, sleep, mood, or recovery',
  SYSTEM: 'App or system maintenance',
  UNKNOWN: 'None of the other domains fit',
}

const INTENT_CRITERIA: Record<DecisionIntent, string> = {
  CREATE_TASK: 'Create a clear to-do the user wants done; prefer this over REVIEW for concrete actions',
  CREATE_NOTE: 'Save a note',
  LOG_MEAL: 'Log a known routine meal; do not invent macros',
  ADD_SHOPPING_ITEM: 'Add an item to the shopping list',
  CLASSIFY: 'Only classify or tag',
  ROUTE: 'Route to a module',
  TAG: 'Add tags only',
  PRIORITIZE: 'Set priority only',
  COMPLETE_ROUTINE: 'Mark a routine step done',
  REQUEST_INFORMATION: 'A required fact is missing',
  REVIEW: 'Only when the utterance is ambiguous or incomplete and a person must clarify',
  UNKNOWN: 'No supported intent',
  DELETE: 'Delete something existing',
  UPDATE_CALENDAR: 'Create or change a calendar event',
  SEND_MESSAGE: 'Send an external message',
  PURCHASE: 'Complete a purchase',
  FILTER_RADAR: 'Filter or rank a radar item',
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

function readServerEnv(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function isChoiceAnswer(value: unknown): value is ChoiceAnswer {
  const data = asRecord(value)
  return data.type === 'choice' && typeof data.choice === 'string'
}

function isNoulAnswer(value: unknown): value is NoulAnswer {
  const data = asRecord(value)
  return data.type === 'noul' && typeof data.noul === 'number' && Number.isFinite(data.noul)
}

export function buildSystemOneRequest(input: {
  item: NormalizedItem
  input: LifeOSInput
  context: DecisionContext
  model?: string
}): { state: Record<string, unknown>; model: string; questions: Record<string, unknown> } {
  const meals = input.context.routineMeals ?? []
  const projects = input.context.projects ?? []
  const mealCriteria: Record<string, string | null> = { none: 'No stored routine meal is clearly named' }
  for (const meal of meals) mealCriteria[meal.id] = meal.label
  const projectCriteria: Record<string, string | null> = { none: 'No existing project is clearly named; do not invent one' }
  for (const project of projects) projectCriteria[project.id] = project.label

  return {
    model: input.model || TYPESAFE_DEFAULT_MODEL,
    state: {
      content: input.item.content,
      source: input.input.source,
      currentModule: input.context.currentModule ?? input.input.context?.currentModule ?? null,
      projectHint: input.input.context?.projectId ?? null,
      meals: meals.map(meal => ({ id: meal.id, label: meal.label })),
      projects: projects.map(project => ({ id: project.id, label: project.label })),
    },
    questions: {
      domain: {
        type: 'choice',
        instructions: 'Which LifeOS domain does `content` belong to?',
        criteria: DOMAIN_CRITERIA,
      },
      intent: {
        type: 'choice',
        instructions: 'Which LifeOS action should be proposed for `content`? Prefer CREATE_TASK for concrete to-dos, LOG_MEAL for consumed meals, CREATE_NOTE for remember/merken, and ADD_SHOPPING_ITEM for buy/order. Use REVIEW only when the utterance is truly ambiguous or incomplete. Never invent nutrition values or new projects.',
        criteria: INTENT_CRITERIA,
      },
      hedge: {
        type: 'noul',
        instructions: 'Is `content` tentative, hypothetical, or undecided rather than a concrete action already taken or requested?',
        criteria: {
          true: 'Hedge words, someday, maybe, or no commitment',
          false: 'A concrete action, meal log, or note',
        },
      },
      meal: {
        type: 'choice',
        instructions: 'If `content` logs a consumed meal, which stored routine meal in `meals` is it? Choose none unless the match is explicit.',
        criteria: mealCriteria,
      },
      project: {
        type: 'choice',
        instructions: 'If `content` belongs to one project in `projects`, which id? Choose none unless the match is unique and explicit. Do not create a project.',
        criteria: projectCriteria,
      },
    },
  }
}

export function mapSystemOneAnswers(payload: unknown, content: string): ProviderDecision | null {
  const data = asRecord(payload)
  const answers = asRecord(data.answers)
  const domainAnswer = answers.domain
  const intentAnswer = answers.intent
  if (!isChoiceAnswer(domainAnswer) || !isChoiceAnswer(intentAnswer)) return null

  const domain = DECISION_DOMAINS.includes(domainAnswer.choice as DecisionDomain)
    ? domainAnswer.choice as DecisionDomain
    : null
  const intent = DECISION_INTENTS.includes(intentAnswer.choice as DecisionIntent)
    ? intentAnswer.choice as DecisionIntent
    : null
  if (!domain || !intent) return null

  const hedge = isNoulAnswer(answers.hedge) ? answers.hedge.noul : 0
  const mealChoice = isChoiceAnswer(answers.meal) && answers.meal.choice !== 'none' ? answers.meal.choice : undefined
  const projectChoice = isChoiceAnswer(answers.project) && answers.project.choice !== 'none' ? answers.project.choice : undefined
  const confidences = [domainAnswer.confidence, intentAnswer.confidence].filter((value): value is number => typeof value === 'number')
  const confidence = confidences.length > 0 ? Math.min(...confidences) : 0.5
  const due = parseDueDate(content)
  const next = parseProviderDecision({
    content,
    domain,
    intent,
    confidence: hedge >= 0.7 ? Math.min(confidence, 0.58) : confidence,
    entities: {
      mealId: mealChoice,
      product: mealChoice,
      projectId: projectChoice,
      relatedProject: projectChoice,
      title: intent === 'CREATE_TASK' || intent === 'CREATE_NOTE' || intent === 'ADD_SHOPPING_ITEM'
        ? taskTitle(content)
        : content,
      due,
    },
    suggestedAction: intent,
    reasonCode: hedge >= 0.7 ? 'HEDGE_LANGUAGE' : 'OK',
  }, content)
  return next
}

export function createJevProvider(config: JevProviderConfig = {}): DecisionProviderAdapter & { lastFailure?: JevFailure } {
  const adapter: DecisionProviderAdapter & { lastFailure?: JevFailure } = {
    id: 'jev',
    async decide({ item, input, context }) {
      const apiUrl = config.apiUrl || readServerEnv('JEV_API_URL') || TYPESAFE_SYSTEMONE_URL
      const apiKey = config.apiKey || readServerEnv('TYPESAFE_API_KEY') || readServerEnv('JEV_API_KEY')
      const model = config.model || readServerEnv('JEV_MODEL') || TYPESAFE_DEFAULT_MODEL
      const timeoutMs = config.timeoutMs ?? 2500
      const fetchImpl = config.fetchImpl ?? globalThis.fetch
      if (!apiKey || !fetchImpl) {
        adapter.lastFailure = { kind: 'disabled' }
        return null
      }

      try {
        const body = buildSystemOneRequest({ item, input, context, model })
        const response = await fetchWithTimeout(fetchImpl, apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        }, timeoutMs)

        if (response.status === 429 || response.status === 529) {
          adapter.lastFailure = { kind: 'rate_limit', status: response.status }
          return null
        }
        if (response.status >= 400 && response.status < 500) {
          adapter.lastFailure = { kind: 'http_4xx', status: response.status }
          return null
        }
        if (response.status >= 500) {
          adapter.lastFailure = { kind: 'http_5xx', status: response.status }
          return null
        }

        const payload = await response.json() as SystemOneResponse
        const parsed = mapSystemOneAnswers(payload, item.content)
        if (!parsed) {
          adapter.lastFailure = { kind: 'invalid' }
          return null
        }
        adapter.lastFailure = undefined
        return parsed
      } catch (error) {
        const name = error instanceof Error ? error.name : ''
        adapter.lastFailure = name === 'AbortError' ? { kind: 'timeout' } : { kind: 'network' }
        return null
      }
    },
  }
  return adapter
}

export function failureReason(failure?: JevFailure): ReasonCode {
  if (!failure) return 'JEV_DISABLED'
  switch (failure.kind) {
    case 'timeout':
      return 'JEV_TIMEOUT'
    case 'invalid':
      return 'JEV_INVALID'
    case 'rate_limit':
      return 'RATE_LIMIT'
    case 'http_4xx':
    case 'http_5xx':
    case 'network':
      return 'JEV_UNAVAILABLE'
    case 'disabled':
      return 'JEV_DISABLED'
    default: {
      const _exhaustive: never = failure.kind
      return _exhaustive
    }
  }
}
