export const EVENING_GATE_STEP_IDS = [
  'windDown',
  'shower',
  'skinSmile',
  'breathing',
  'prepare',
  'preRoll',
  'memo',
  'noScreen',
] as const

export type EveningGateStepId = (typeof EVENING_GATE_STEP_IDS)[number]

export type EveningPreparationItem = {
  id: string
  label: string
  done: boolean
}

export type EveningEnergyLevel = 'low' | 'okay' | 'high'

export type EveningCareId = 'cleanse' | 'bha' | 'needly' | 'backBpo' | 'dental' | 'whitening'
export type EveningCareOptions = { backBpo: boolean; whitening: boolean }

/** Gate-owned routine: no separate Habit/NOW tasks. Date is local YYYY-MM-DD. */
export function eveningCareSteps(date: string, options: EveningCareOptions): Array<{
  id: EveningCareId
  label: string
  detail: string
}> {
  const weekday = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T12:00:00`).getDay()
    : -1
  return [
    { id: 'cleanse', label: 'Rituals Cleanser', detail: 'Gesicht mild und mit lauwarmem Wasser reinigen.' },
    ...(weekday === 1 || weekday === 4
      ? [{ id: 'bha' as const, label: 'COSRX BHA Blackhead Power Liquid', detail: 'Mo/Do: dünn auf trockene Haut. Bei Reizung pausieren.' }]
      : []),
    { id: 'needly', label: 'Needly Crossbarrier Cream', detail: 'Dünn auftragen. Keine zusätzliche Q10-Nachtcreme.' },
    ...(options.backBpo
      ? [{ id: 'backBpo' as const, label: 'Rücken · Benzaknen 10 % Gel', detail: 'Nur nach Eignungsabklärung; Leave-on, nicht abwaschen. Hautreizungen und Textilbleichung beachten. Nicht mit Aknefug schichten.' }]
      : []),
    { id: 'dental', label: 'Zahnpflege', detail: 'Zahnzwischenräume reinigen und 2 Minuten Fluoridzahnpasta.' },
    ...(options.whitening
      ? [{ id: 'whitening' as const, label: 'SmileSecret Phonebleaching', detail: 'Eine Gel-Tube gemäß deiner Anleitung auf obere und untere Schiene verteilen; ans Smartphone anschließen und 16 Minuten anwenden. Nur während einer Kur.' }]
      : []),
  ]
}

export type EveningGateState = {
  startedAt?: string
  completedAt?: string
  /** Separate evening reading; the Morning Gate owns DashboardEntry.energyLevel. */
  energyLevel?: EveningEnergyLevel
  done: EveningGateStepId[]
  breathingRounds: number
  preparationItems: EveningPreparationItem[]
  memoCaptured: boolean
  careChecked: EveningCareId[]
  careOptions: EveningCareOptions


export const DEFAULT_EVENING_PREPARATION: EveningPreparationItem[] = [
  { id: 'clothes', label: 'Kleidung für morgen', done: false },
  { id: 'bag', label: 'Tasche, Schlüssel & Portemonnaie', done: false },
  { id: 'meds-water', label: 'Medikamente & Wasser bereitstellen', done: false },
]

function isEveningGateStepId(value: unknown): value is EveningGateStepId {
  return typeof value === 'string'
    && (EVENING_GATE_STEP_IDS as readonly string[]).includes(value)
}

function normalizePreparationItems(raw: unknown): EveningPreparationItem[] {
  if (!Array.isArray(raw)) return DEFAULT_EVENING_PREPARATION.map(item => ({ ...item }))
  const items = raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Partial<EveningPreparationItem>
      const label = typeof record.label === 'string' ? record.label.trim().slice(0, 80) : ''
      if (!label) return null
      const id = typeof record.id === 'string' && record.id.trim()
        ? record.id.trim().slice(0, 80)
        : `prep-${index}`
      return { id, label, done: record.done === true }
    })
    .filter((item): item is EveningPreparationItem => Boolean(item))
  return items.length > 0 ? items : DEFAULT_EVENING_PREPARATION.map(item => ({ ...item }))
}

export function createEveningGateState(raw?: Partial<EveningGateState> | null): EveningGateState {
  return {
    startedAt: typeof raw?.startedAt === 'string' && raw.startedAt ? raw.startedAt : undefined,
    completedAt: typeof raw?.completedAt === 'string' && raw.completedAt ? raw.completedAt : undefined,
    energyLevel: raw?.energyLevel === 'low' || raw?.energyLevel === 'okay' || raw?.energyLevel === 'high'
      ? raw.energyLevel
      : undefined,
    done: Array.isArray(raw?.done)
      ? [...new Set(raw.done.filter(isEveningGateStepId))]
      : [],
    breathingRounds: Math.max(0, Math.min(3, Math.round(Number(raw?.breathingRounds) || 0))),
    preparationItems: normalizePreparationItems(raw?.preparationItems),
    memoCaptured: raw?.memoCaptured === true,
    careChecked: Array.isArray(raw?.careChecked)
      ? [...new Set(raw.careChecked.filter((id): id is EveningCareId =>
        typeof id === 'string' && ['cleanse', 'bha', 'needly', 'backBpo', 'dental', 'whitening'].includes(id)))]
      : [],
    careOptions: {
      backBpo: raw?.careOptions?.backBpo === true,
      whitening: raw?.careOptions?.whitening === true,
    },
  }
}

export function normalizeEveningGateState(raw: unknown): EveningGateState | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  return createEveningGateState(raw as Partial<EveningGateState>)
}

export function markEveningGateStepDone(
  state: EveningGateState,
  step: EveningGateStepId,
  at = new Date(),
): EveningGateState {
  const done = state.done.includes(step) ? state.done : [...state.done, step]
  return {
    ...state,
    startedAt: state.startedAt ?? at.toISOString(),
    done,
  }
}

export function finishEveningGate(state: EveningGateState, at = new Date()): EveningGateState {
  return {
    ...state,
    startedAt: state.startedAt ?? at.toISOString(),
    completedAt: at.toISOString(),
    done: [...EVENING_GATE_STEP_IDS],
  }
}

export function restartEveningGate(state: EveningGateState): EveningGateState {
  return {
    ...state,
    startedAt: undefined,
    completedAt: undefined,
    energyLevel: undefined,
    done: [],
    breathingRounds: 0,
    preparationItems: state.preparationItems.map(item => ({ ...item, done: false })),
    memoCaptured: false,
    careChecked: [],
    careOptions: { backBpo: false, whitening: false },
  }
}

export function nextEveningGateStep(state: EveningGateState): EveningGateStepId | null {
  return EVENING_GATE_STEP_IDS.find(step => !state.done.includes(step)) ?? null
}

export function isEveningGateComplete(state: EveningGateState | undefined): boolean {
  return Boolean(state?.completedAt)
}
