import { asRecord, asString, createId, nowIso, pick } from '../schema.js'
import { applyApprovedChange, revertChange } from '../change-engine/history.js'
import type { ChangeSpec, MutableLifeSettings } from '../change-engine/types.js'
import { emitAdaptiveEvent } from '../events/store.js'

export const EXPERIMENTS_KEY = 'life-os-v1-experiments'

export const EXPERIMENT_STATUSES = [
  'proposed',
  'running',
  'completed',
  'kept',
  'reverted',
  'cancelled',
] as const
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number]

export type Experiment = {
  id: string
  hypothesis: string
  target: string
  baselineWindowDays: number
  experimentWindowDays: number
  variant: ChangeSpec
  metrics: string[]
  start?: string
  end?: string
  status: ExperimentStatus
  result?: {
    recommendation: 'keep' | 'revert' | 'inconclusive'
    evidence: string[]
    sampleSize: number
  }
  historyId?: string
  createdAt: string
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function loadExperiments(): Experiment[] {
  const storage = safeStorage()
  if (!storage) return []
  try {
    const raw = JSON.parse(storage.getItem(EXPERIMENTS_KEY) ?? '[]')
    return Array.isArray(raw) ? raw as Experiment[] : []
  } catch {
    return []
  }
}

export function saveExperiments(experiments: Experiment[]): void {
  const storage = safeStorage()
  if (!storage) return
  try {
    storage.setItem(EXPERIMENTS_KEY, JSON.stringify(experiments.slice(0, 100)))
  } catch {
    /* ignore */
  }
}

export function createExperiment(input: {
  hypothesis: string
  target: string
  variant: ChangeSpec
  baselineWindowDays?: number
  experimentWindowDays?: number
  metrics?: string[]
}): Experiment {
  return {
    id: createId('exp'),
    hypothesis: input.hypothesis,
    target: input.target,
    baselineWindowDays: input.baselineWindowDays ?? 7,
    experimentWindowDays: input.experimentWindowDays ?? 7,
    variant: input.variant,
    metrics: input.metrics ?? ['completion_rate', 'abandonment_rate', 'duration', 'manual_overrides'],
    status: 'proposed',
    createdAt: nowIso(),
  }
}

export function startExperiment(input: {
  experiment: Experiment
  settings: MutableLifeSettings
}): { ok: boolean; settings: MutableLifeSettings; experiment: Experiment; error?: string } {
  const applied = applyApprovedChange({
    settings: input.settings,
    spec: input.experiment.variant,
    request: input.experiment.hypothesis,
    initiator: 'experiment',
    experimentId: input.experiment.id,
  })
  if (!applied.ok) {
    return { ok: false, settings: input.settings, experiment: input.experiment, error: applied.error }
  }
  const experiment: Experiment = {
    ...input.experiment,
    status: 'running',
    start: nowIso(),
    historyId: applied.history.id,
  }
  const all = loadExperiments().filter(item => item.id !== experiment.id)
  saveExperiments([experiment, ...all])
  emitAdaptiveEvent('experiment.started', { entityId: experiment.id, surface: experiment.target })
  return { ok: true, settings: applied.settings, experiment }
}

export function evaluateExperiment(experiment: Experiment, sampleSize: number): Experiment {
  // Personal evidence only — never claim statistical certainty.
  let recommendation: 'keep' | 'revert' | 'inconclusive' = 'inconclusive'
  const evidence: string[] = []
  if (sampleSize < 5) {
    evidence.push(`Only ${sampleSize} observations — treat as personal signal, not proof.`)
    recommendation = 'inconclusive'
  } else {
    evidence.push(`${sampleSize} observations collected during the experiment window.`)
    recommendation = 'keep'
  }
  return {
    ...experiment,
    status: 'completed',
    end: nowIso(),
    result: { recommendation, evidence, sampleSize },
  }
}

export function decideExperiment(input: {
  experiment: Experiment
  decision: 'keep' | 'revert'
  settings: MutableLifeSettings
}): { ok: boolean; settings: MutableLifeSettings; experiment: Experiment; error?: string } {
  if (input.decision === 'keep') {
    const experiment: Experiment = { ...input.experiment, status: 'kept', end: input.experiment.end ?? nowIso() }
    saveExperiments([experiment, ...loadExperiments().filter(item => item.id !== experiment.id)])
    emitAdaptiveEvent('experiment.completed', {
      entityId: experiment.id,
      payload: { decision: 'keep' },
    })
    return { ok: true, settings: input.settings, experiment }
  }
  if (!input.experiment.historyId) {
    return { ok: false, settings: input.settings, experiment: input.experiment, error: 'Missing history for revert' }
  }
  const reverted = revertChange({ settings: input.settings, historyId: input.experiment.historyId })
  if (!reverted.ok) {
    return { ok: false, settings: input.settings, experiment: input.experiment, error: reverted.error }
  }
  const experiment: Experiment = { ...input.experiment, status: 'reverted', end: nowIso() }
  saveExperiments([experiment, ...loadExperiments().filter(item => item.id !== experiment.id)])
  emitAdaptiveEvent('experiment.completed', {
    entityId: experiment.id,
    payload: { decision: 'revert' },
  })
  return { ok: true, settings: reverted.settings, experiment }
}

export function normalizeExperiment(raw: unknown): Experiment | null {
  const data = asRecord(raw)
  const status = pick(data.status, EXPERIMENT_STATUSES)
  const hypothesis = asString(data.hypothesis)
  if (!status || !hypothesis) return null
  return data as unknown as Experiment
}
