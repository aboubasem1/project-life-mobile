import { applyMealToEntry, revertMealFromEntry, type NutritionMeal } from '../dailyFlow.js'
import { applyConvertResult, convertCapture, createCapture, type ConvertResult } from '../lifeos/domain.js'
import { applyConvertToDashboard, type BridgeState } from '../lifeos/dashboardBridge.js'
import { createId } from '../lifeos/store.js'
import type { DashboardEntry } from '../../types/DashboardEntry.js'
import type { Capture, KnowledgeItem, LifeOsState } from '../lifeos/types.js'
import { isDecisionDomain, isDecisionIntent } from './schemas.js'
import { replayGuard } from './idempotency.js'
import type {
  DecisionBatch,
  DecisionIntent,
  LifeOSInput,
  ProposedAction,
  ReasonCode,
  RoutineMealRef,
} from './types.js'

export type CaptureDecisionPreviewItem = {
  actionId: string
  content: string
  domain: string
  intent: string
  confidence: number
  actionLevel: string
  policyResult: string
  suggestedAction: string
  requiresConfirmation: boolean
  due?: string
  mealLabel?: string
  projectLabel?: string
}

export type CaptureDecisionPreview = {
  batchId: string
  provider: string
  items: CaptureDecisionPreviewItem[]
  processedAt: string
}

export type ShoppingDraft = {
  id: string
  name: string
  note: string
  price: number
  done: boolean
  icon: string
}

export type ActionApplyInput = {
  batch: DecisionBatch
  lifeOs: LifeOsState
  dashboard: BridgeState
  entry?: DashboardEntry
  routineMeals?: RoutineMealRef[]
  executedKeys?: string[]
  autoActionsEnabled: boolean
  /** User explicitly confirmed preview items — apply even when policyResult is REVIEW. */
  confirmedByUser?: boolean
  today: string
}

export type ActionApplyResult = {
  lifeOs: LifeOsState
  dashboard: BridgeState
  entry?: DashboardEntry
  shoppingAdds: ShoppingDraft[]
  executedKeys: string[]
  applied: ProposedAction[]
  skipped: Array<{ action: ProposedAction; reason: string }>
  undos: Array<{ actionId: string; kind: 'meal' | 'task' | 'note' | 'shopping' }>
}

export function previewFromBatch(batch: DecisionBatch): CaptureDecisionPreview {
  return {
    batchId: batch.batchId,
    provider: batch.provider,
    processedAt: new Date().toISOString(),
    items: batch.decisions.map((decision, index) => {
      const action = batch.proposedActions[index]
      return {
        actionId: action?.actionId ?? decision.decisionId,
        content: decision.entities.title || decision.content,
        domain: decision.domain,
        intent: decision.intent,
        confidence: decision.confidence,
        actionLevel: decision.actionLevel,
        policyResult: decision.policyResult,
        suggestedAction: decision.suggestedAction || decision.intent,
        requiresConfirmation: decision.requiresConfirmation,
        due: decision.entities.due,
        mealLabel: decision.entities.mealLabel,
        projectLabel: decision.entities.projectLabel,
      }
    }),
  }
}

const GATE_INTENTS = new Set(['REVIEW', 'UNKNOWN', 'REQUEST_INFORMATION'])

function executableIntent(intent: string, suggestedAction?: string): DecisionIntent {
  if (!GATE_INTENTS.has(intent) && isDecisionIntent(intent)) return intent
  if (suggestedAction && !GATE_INTENTS.has(suggestedAction) && isDecisionIntent(suggestedAction)) {
    return suggestedAction
  }
  return 'CREATE_TASK'
}

/** Rebuild an applyable batch from the preview the Capture sheet already holds. */
export function batchFromPreview(
  preview: CaptureDecisionPreview,
  lifeInput: { id?: string; source?: LifeOSInput['source']; content: string; timestamp?: string },
): DecisionBatch {
  const timestamp = lifeInput.timestamp || preview.processedAt || new Date().toISOString()
  const input: LifeOSInput = {
    id: lifeInput.id || preview.batchId,
    source: lifeInput.source || 'quick_add',
    content: lifeInput.content,
    timestamp,
  }
  const decisions = preview.items.map((item, index) => {
    const intent = executableIntent(item.intent, item.suggestedAction)
    const domain = isDecisionDomain(item.domain) ? item.domain : 'TASK'
    const actionLevel = item.actionLevel === 'CONFIRM' || item.actionLevel === 'SAFE_AUTO' || item.actionLevel === 'REVERSIBLE_AUTO'
      ? item.actionLevel
      : 'REVERSIBLE_AUTO'
    const policyResult = item.policyResult === 'EXECUTE' || item.policyResult === 'REQUEST_INFORMATION' || item.policyResult === 'REJECT'
      ? item.policyResult
      : 'REVIEW'
    const provider = preview.provider === 'jev' || preview.provider === 'llm' || preview.provider === 'fallback'
      ? preview.provider
      : 'rules'
    return {
      decisionId: item.actionId,
      inputId: input.id,
      itemIndex: index,
      content: item.content,
      domain,
      intent,
      confidence: item.confidence,
      confidenceBand: (item.confidence >= 0.8 ? 'high' : item.confidence >= 0.55 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
      entities: {
        title: item.content,
        due: item.due,
        mealLabel: item.mealLabel,
        projectLabel: item.projectLabel,
      },
      suggestedAction: intent,
      actionLevel: actionLevel as ProposedAction['actionLevel'],
      provider: provider as DecisionBatch['provider'],
      requiresConfirmation: item.requiresConfirmation,
      reasonCode: 'OK' as const,
      timestamp,
      policyResult: policyResult as ProposedAction['policyResult'],
      policyReasons: [] as ReasonCode[],
    }
  })
  const proposedActions: ProposedAction[] = decisions.map((decision, index) => ({
    actionId: preview.items[index].actionId,
    decisionId: decision.decisionId,
    intent: decision.intent,
    domain: decision.domain,
    actionLevel: decision.actionLevel,
    policyResult: decision.policyResult,
    content: decision.content,
    entities: decision.entities,
    requiresConfirmation: decision.requiresConfirmation,
    reversible: decision.actionLevel === 'REVERSIBLE_AUTO',
  }))
  return {
    batchId: preview.batchId,
    input,
    items: preview.items.map((item, index) => ({
      index,
      content: item.content,
      original: item.content,
    })),
    decisions,
    proposedActions,
    audits: [],
    latencyMs: 0,
    provider: decisions[0]?.provider ?? 'rules',
  }
}

function mealFromRef(ref: RoutineMealRef): NutritionMeal {
  return {
    id: ref.id,
    label: ref.label,
    proteinGrams: ref.proteinGrams,
    calories: ref.calories,
    fatGrams: ref.fatGrams,
    carbsGrams: ref.carbsGrams,
    fiberGrams: ref.fiberGrams,
  }
}

export function applyDecisionBatch(input: ActionApplyInput): ActionApplyResult {
  const skipped: ActionApplyResult['skipped'] = []
  const applied: ProposedAction[] = []
  const undos: ActionApplyResult['undos'] = []
  const executedKeys = [...(input.executedKeys ?? [])]
  let lifeOs = input.lifeOs
  let dashboard = input.dashboard
  let entry = input.entry
  const shoppingAdds: ShoppingDraft[] = []

  if (!input.autoActionsEnabled && !input.confirmedByUser) {
    return {
      lifeOs,
      dashboard,
      entry,
      shoppingAdds,
      executedKeys,
      applied,
      skipped: input.batch.proposedActions.map(action => ({ action, reason: 'AUTO_ACTIONS_DISABLED' })),
      undos,
    }
  }

  const decisionById = new Map(input.batch.decisions.map(decision => [decision.decisionId, decision]))

  for (const action of input.batch.proposedActions) {
    const decision = decisionById.get(action.decisionId)
    const intent = executableIntent(action.intent, decision?.suggestedAction)
    const confirmedReview = input.confirmedByUser
      && action.policyResult === 'REVIEW'
      && action.actionLevel !== 'CONFIRM'
      && intent !== 'REVIEW'
      && intent !== 'UNKNOWN'
      && intent !== 'REQUEST_INFORMATION'
    if ((!input.confirmedByUser && action.policyResult !== 'EXECUTE') || action.actionLevel === 'CONFIRM') {
      if (!confirmedReview) {
        skipped.push({ action, reason: action.policyResult === 'EXECUTE' ? 'LEVEL_CONFIRM' : action.policyResult })
        continue
      }
    }
    if (replayGuard(executedKeys, action.actionId)) {
      skipped.push({ action, reason: 'IDEMPOTENT_REPLAY' })
      continue
    }

    switch (intent) {
      case 'LOG_MEAL': {
        const mealRef = input.routineMeals?.find(item => item.id === action.entities.mealId)
        if (!entry || !mealRef) {
          skipped.push({ action, reason: 'MEAL_NOT_FOUND' })
          continue
        }
        const patch = applyMealToEntry(entry, mealFromRef(mealRef))
        if (Object.keys(patch).length === 0) {
          skipped.push({ action, reason: 'IDEMPOTENT_REPLAY' })
          continue
        }
        entry = { ...entry, ...patch }
        executedKeys.push(action.actionId)
        applied.push({ ...action, intent })
        undos.push({ actionId: action.actionId, kind: 'meal' })
        break
      }
      case 'CREATE_TASK': {
        const title = action.entities.title || action.content
        const capture = {
          ...createCapture({ raw: title, projectId: action.entities.projectId }),
          targetType: 'task' as const,
          status: 'classified' as const,
        }
        const converted = convertCapture(capture)
        lifeOs = applyConvertResult({
          ...lifeOs,
          captures: [converted.capture, ...lifeOs.captures],
        }, converted)
        dashboard = applyConvertToDashboard(dashboard, converted, input.today)
        executedKeys.push(action.actionId)
        applied.push({ ...action, intent })
        undos.push({ actionId: action.actionId, kind: 'task' })
        break
      }
      case 'CREATE_NOTE': {
        const title = action.entities.title || action.content
        const body = action.entities.body || action.content
        const capture = {
          ...createCapture({ raw: `${title}\n${body}`, projectId: action.entities.relatedProject }),
          targetType: 'note' as const,
          status: 'classified' as const,
        }
        const converted = convertCapture(capture)
        lifeOs = applyConvertResult({
          ...lifeOs,
          captures: [converted.capture, ...lifeOs.captures],
        }, converted)
        executedKeys.push(action.actionId)
        applied.push({ ...action, intent })
        undos.push({ actionId: action.actionId, kind: 'note' })
        break
      }
      case 'ADD_SHOPPING_ITEM': {
        const name = action.entities.product || action.entities.title || action.content
        shoppingAdds.push({
          id: createId(),
          name,
          note: action.content,
          price: 0,
          done: false,
          icon: 'bag',
        })
        executedKeys.push(action.actionId)
        applied.push({ ...action, intent })
        undos.push({ actionId: action.actionId, kind: 'shopping' })
        break
      }
      case 'CLASSIFY':
      case 'ROUTE':
      case 'TAG':
      case 'PRIORITIZE':
      case 'FILTER_RADAR':
      case 'COMPLETE_ROUTINE':
        executedKeys.push(action.actionId)
        applied.push({ ...action, intent })
        break
      case 'DELETE':
      case 'UPDATE_CALENDAR':
      case 'SEND_MESSAGE':
      case 'PURCHASE':
      case 'REQUEST_INFORMATION':
      case 'REVIEW':
      case 'UNKNOWN':
        skipped.push({ action, reason: 'POLICY_BLOCKED' })
        break
      default: {
        const _exhaustive: never = intent
        skipped.push({ action, reason: 'UNKNOWN_INTENT' })
        void _exhaustive
      }
    }
  }

  return { lifeOs, dashboard, entry, shoppingAdds, executedKeys, applied, skipped, undos }
}

export function revertAppliedMeal(entry: DashboardEntry, meal: NutritionMeal): Partial<DashboardEntry> {
  return revertMealFromEntry(entry, meal)
}

export function lastKnowledge(state: LifeOsState): KnowledgeItem | undefined {
  return state.knowledge[state.knowledge.length - 1]
}

export function lastCapture(state: LifeOsState): Capture | undefined {
  return state.captures[0]
}

export function convertResultFromAction(action: ProposedAction): ConvertResult | null {
  if (action.intent !== 'CREATE_TASK' && action.intent !== 'CREATE_NOTE') return null
  const capture = {
    ...createCapture({ raw: action.entities.title || action.content, projectId: action.entities.projectId }),
    targetType: action.intent === 'CREATE_TASK' ? 'task' as const : 'note' as const,
    status: 'classified' as const,
  }
  return convertCapture(capture)
}
