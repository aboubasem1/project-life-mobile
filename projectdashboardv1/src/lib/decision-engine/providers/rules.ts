import { isNoteCapture, noteEntities } from '../decisions/note.js'
import { matchRoutineMeal, mealEntities, resolveMealContext } from '../decisions/nutrition.js'
import { shoppingEntities } from '../decisions/shopping.js'
import { parseDueDate, taskEntities } from '../decisions/task.js'
import { scoreDomainSignals, topDomain } from '../split.js'
import type { DecisionProviderAdapter, ProviderDecision } from '../types.js'

const HEDGE = /\b(vielleicht|irgendwann|eventuell|später\s+mal|mal\s+schauen|kann\s+sein)\b/i
const CONSUME = /\b(getrunken|gegessen|genommen|getrunken)\b/i
const ORDER = /\b(bestellen|kaufen|einkauf|nachbestellen)\b/i
const CALL = /\b(anrufen|anrufen|call)\b/i

export const rulesProvider: DecisionProviderAdapter = {
  id: 'rules',
  async decide({ item, input, context }) {
    return classifyWithRules(item.content, {
      now: context.now,
      timeZone: context.timeZone,
      routineMeals: resolveMealContext(context),
      projects: context.projects,
      transcriptId: input.transcriptId,
      projectId: input.context?.projectId,
    })
  },
}

export function classifyWithRules(content: string, context: {
  now?: Date
  timeZone?: string
  routineMeals?: Parameters<typeof resolveMealContext>[0]['routineMeals']
  projects?: Parameters<typeof taskEntities>[1]['projects']
  transcriptId?: string
  projectId?: string
} = {}): ProviderDecision {
  const text = content.trim()
  const hedge = HEDGE.test(text)
  const signals = scoreDomainSignals(text)
  const meals = resolveMealContext({ routineMeals: context.routineMeals })
  const meal = matchRoutineMeal(text, meals)
  const due = parseDueDate(text, context.now, context.timeZone)

  if (isNoteCapture(text)) {
    return {
      content: text,
      domain: 'NOTE',
      intent: 'CREATE_NOTE',
      confidence: hedge ? 0.62 : 0.94,
      entities: noteEntities(text, {
        transcriptReference: context.transcriptId,
        relatedProject: context.projectId,
      }),
      suggestedAction: 'CREATE_NOTE',
      reasonCode: hedge ? 'HEDGE_LANGUAGE' : 'OK',
    }
  }

  if (meal && CONSUME.test(text)) {
    return {
      content: text,
      domain: 'NUTRITION',
      intent: 'LOG_MEAL',
      confidence: hedge ? 0.58 : 0.96,
      entities: mealEntities(meal),
      suggestedAction: 'LOG_MEAL',
      reasonCode: hedge ? 'HEDGE_LANGUAGE' : 'OK',
    }
  }

  if (ORDER.test(text)) {
    const entities = {
      ...shoppingEntities(text, due),
      ...taskEntities(text, {
        now: context.now,
        timeZone: context.timeZone,
        projects: context.projects,
      }),
    }
    return {
      content: text,
      domain: 'SHOPPING',
      intent: 'CREATE_TASK',
      confidence: hedge ? 0.55 : 0.93,
      entities,
      suggestedAction: 'CREATE_TASK',
      reasonCode: hedge ? 'HEDGE_LANGUAGE' : 'OK',
    }
  }

  const top = topDomain(signals)
  if (top === 'work' || CALL.test(text) || /\bfertig\s+machen\b/i.test(text)) {
    return {
      content: text,
      domain: top === 'work' || /\b(dhl|claim|claims)\b/i.test(text) ? 'WORK' : 'TASK',
      intent: 'CREATE_TASK',
      confidence: hedge ? 0.56 : 0.91,
      entities: taskEntities(text, {
        now: context.now,
        timeZone: context.timeZone,
        projects: context.projects,
      }),
      suggestedAction: 'CREATE_TASK',
      reasonCode: hedge ? 'HEDGE_LANGUAGE' : 'OK',
    }
  }

  if (meal && !ORDER.test(text) && !hedge) {
    return {
      content: text,
      domain: 'NUTRITION',
      intent: 'LOG_MEAL',
      confidence: 0.72,
      entities: mealEntities(meal),
      suggestedAction: 'LOG_MEAL',
      reasonCode: 'MISSING_ENTITY',
    }
  }

  if (signals.task > 0 || signals.shopping > 0) {
    return {
      content: text,
      domain: signals.shopping > 0 ? 'SHOPPING' : 'TASK',
      intent: 'CREATE_TASK',
      confidence: hedge ? 0.48 : 0.74,
      entities: taskEntities(text, {
        now: context.now,
        timeZone: context.timeZone,
        projects: context.projects,
      }),
      suggestedAction: 'CREATE_TASK',
      reasonCode: hedge ? 'HEDGE_LANGUAGE' : 'OK',
    }
  }

  return {
    content: text,
    domain: 'UNKNOWN',
    intent: 'UNKNOWN',
    confidence: hedge ? 0.28 : 0.34,
    entities: { title: text },
    suggestedAction: 'REVIEW',
    reasonCode: hedge ? 'HEDGE_LANGUAGE' : 'UNKNOWN_INTENT',
  }
}
