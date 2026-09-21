import { confidenceBand, meetsConfidence } from './confidence.js'
import { matchRoutineMeal, resolveMealContext } from './decisions/nutrition.js'
import type { DecisionFlags } from './flags.js'
import type {
  ActionLevel,
  DecisionContext,
  DecisionIntent,
  PolicyResult,
  ProviderDecision,
  ReasonCode,
} from './types.js'

export type PolicyInput = {
  candidate: ProviderDecision
  context: DecisionContext
  flags: DecisionFlags
}

export type PolicyVerdict = {
  result: PolicyResult
  reasons: ReasonCode[]
  actionLevel: ActionLevel
  requiresConfirmation: boolean
  intent: DecisionIntent
  entities: ProviderDecision['entities']
}

const CONFIRM_INTENTS: DecisionIntent[] = [
  'DELETE',
  'UPDATE_CALENDAR',
  'SEND_MESSAGE',
  'PURCHASE',
]

const SAFE_INTENTS: DecisionIntent[] = [
  'CLASSIFY',
  'ROUTE',
  'TAG',
  'PRIORITIZE',
  'FILTER_RADAR',
]

export function actionLevelFor(intent: DecisionIntent): ActionLevel {
  if (CONFIRM_INTENTS.includes(intent)) return 'CONFIRM'
  if (SAFE_INTENTS.includes(intent)) return 'SAFE_AUTO'
  return 'REVERSIBLE_AUTO'
}

export function evaluatePolicy(input: PolicyInput): PolicyVerdict {
  const { candidate, context, flags } = input
  const reasons: ReasonCode[] = []
  const level = actionLevelFor(candidate.intent)
  const intent = candidate.intent
  let entities = { ...candidate.entities }

  if (candidate.intent === 'UNKNOWN' || candidate.domain === 'UNKNOWN') {
    reasons.push(candidate.reasonCode && candidate.reasonCode !== 'OK' ? candidate.reasonCode : 'UNKNOWN_INTENT')
    return verdict('REVIEW', reasons, level, true, 'REVIEW', entities)
  }

  if (confidenceBand(candidate.confidence) === 'low') {
    reasons.push(candidate.reasonCode === 'HEDGE_LANGUAGE' ? 'HEDGE_LANGUAGE' : 'LOW_CONFIDENCE')
    return verdict('REVIEW', reasons, level, true, 'REVIEW', entities)
  }

  switch (candidate.intent) {
    case 'LOG_MEAL': {
      const meals = resolveMealContext(context)
      const meal = entities?.mealId
        ? meals.find(item => item.id === entities?.mealId)
        : matchRoutineMeal([entities?.product, entities?.mealLabel, candidate.content].filter(Boolean).join(' '), meals)
      if (!meal) {
        reasons.push('MEAL_NOT_FOUND')
        return verdict('REQUEST_INFORMATION', reasons, level, true, 'REQUEST_INFORMATION', entities)
      }
      entities = {
        ...entities,
        mealId: meal.id,
        mealLabel: meal.label,
        product: entities?.product || meal.label,
      }
      break
    }
    case 'CREATE_TASK':
    case 'ADD_SHOPPING_ITEM': {
      const title = (entities?.title || candidate.content).trim()
      if (!title) {
        reasons.push('MISSING_ENTITY')
        return verdict('REQUEST_INFORMATION', reasons, level, true, 'REQUEST_INFORMATION', entities)
      }
      if (entities?.projectLabel && !entities.projectId && !context.allowCreateProject) {
        reasons.push('PROJECT_NOT_FOUND')
      }
      break
    }
    case 'CREATE_NOTE': {
      if (!(entities?.title || entities?.body || candidate.content).trim()) {
        reasons.push('MISSING_ENTITY')
        return verdict('REQUEST_INFORMATION', reasons, level, true, 'REQUEST_INFORMATION', entities)
      }
      break
    }
    case 'DELETE':
    case 'UPDATE_CALENDAR':
    case 'SEND_MESSAGE':
    case 'PURCHASE':
    case 'CLASSIFY':
    case 'ROUTE':
    case 'TAG':
    case 'PRIORITIZE':
    case 'COMPLETE_ROUTINE':
    case 'REQUEST_INFORMATION':
    case 'REVIEW':
    case 'FILTER_RADAR':
      break
    default: {
      const _exhaustive: never = candidate.intent
      return _exhaustive
    }
  }

  if (level === 'CONFIRM') {
    reasons.push('LEVEL_CONFIRM')
    return verdict('REVIEW', reasons, level, true, intent, entities)
  }

  const needed = level === 'SAFE_AUTO' ? 'medium' : 'high'
  if (!meetsConfidence(candidate.confidence, needed)) {
    reasons.push('LOW_CONFIDENCE')
    return verdict('REVIEW', reasons, level, true, 'REVIEW', entities)
  }

  if (level === 'REVERSIBLE_AUTO' && !flags.autoActionsEnabled) {
    reasons.push('AUTO_ACTIONS_DISABLED')
    return verdict('REVIEW', reasons, level, true, intent, entities)
  }

  if (level === 'SAFE_AUTO' && !flags.jevEnabled && !flags.autoActionsEnabled) {
    reasons.push('AUTO_ACTIONS_DISABLED')
    return verdict('REVIEW', reasons, level, false, intent, entities)
  }

  reasons.push('OK')
  return verdict('EXECUTE', reasons, level, false, intent, entities)
}

function verdict(
  result: PolicyResult,
  reasons: ReasonCode[],
  actionLevel: ActionLevel,
  requiresConfirmation: boolean,
  intent: DecisionIntent,
  entities: ProviderDecision['entities'],
): PolicyVerdict {
  return { result, reasons, actionLevel, requiresConfirmation, intent, entities }
}
