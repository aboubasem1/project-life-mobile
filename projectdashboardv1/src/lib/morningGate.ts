export const MORNING_RITUAL_STEP_IDS = [
  'medsShake',
  'weight',
  'gratitude',
  'commitment',
  'coldShower',
  'winnerPose',
  'prayer',
  'energy',
  'headRecovery',
  'todos',
  'workout',
  'postShower',
  'selfcare',
  'letsGo',
] as const

/** Order stored before the commitment step existed. Used only to detect untouched configs. */
const LEGACY_STEP_ORDER: MorningRitualStepId[] = [
  'medsShake',
  'weight',
  'gratitude',
  'coldShower',
  'winnerPose',
  'prayer',
  'energy',
  'headRecovery',
  'todos',
  'workout',
  'postShower',
  'selfcare',
  'letsGo',
]

export const DEFAULT_STEP_ORDER: MorningRitualStepId[] = [
  'headRecovery',
  'weight',
  'gratitude',
  'commitment',
  'medsShake',
  'coldShower',
  'winnerPose',
  'prayer',
  'energy',
  'todos',
  'workout',
  'postShower',
  'selfcare',
  'letsGo',
]

export const DEFAULT_HIDDEN_STEPS: MorningRitualStepId[] = [
  'prayer',
  'energy',
  'todos',
  'workout',
  'postShower',
  'selfcare',
  'letsGo',
]

export type MorningRitualStepId = (typeof MORNING_RITUAL_STEP_IDS)[number]

/** @deprecated use MorningRitualStepId — kept for older settings blobs */
export type MorningGateStepId = MorningRitualStepId

export type MorningRitualPhase = 'gate' | 'heute' | 'track'

export type MorningSelfcareItem = {
  id: string
  label: string
}

export type MorningRitualStepRules = Record<MorningRitualStepId, string>
export type MorningRitualStepMinutes = Record<MorningRitualStepId, number>

export type MorningRitualConfig = {
  gratitudeText: string
  coldSeconds: number
  winnerSeconds: number
  prayerSeconds: number
  pushupTarget: number
  koTarget: number
  hotShowerSeconds: number
  coldRinseSeconds: number
  selfcareItems: MorningSelfcareItem[]
  stepOrder: MorningRitualStepId[]
  hiddenSteps: MorningRitualStepId[]
  autoAdvance: boolean
  stepRules: MorningRitualStepRules
  stepMinutes: MorningRitualStepMinutes
  commitmentText: string
  /** Explicit link when more than one document could be the agreement. */
  commitmentDocumentId: string
  shakeMeal: {
    id: string
    label: string
    proteinGrams: number
    calories: number
    fatGrams: number
    carbsGrams: number
    fiberGrams: number
  }
}

export const CHECKIN_QUESTION_IDS = ['mood', 'recovery', 'sleep', 'dream'] as const
export type CheckinQuestionId = (typeof CHECKIN_QUESTION_IDS)[number]

export type RitualTimerState = {
  durationSec: number
  startedAt: number | null
  accumulatedMs: number
  running: boolean
}

export type ShakeRitualStatus = 'pending' | 'taken' | 'later' | 'skipped'

export type CommitmentConfirmation = {
  confirmedAt: string
  documentId?: string
  /** Immutable snapshot of the text the user confirmed. */
  text: string
  fingerprint: string
}

export type MorningRitualProgress = {
  date: string
  done: MorningRitualStepId[]
  skipped: MorningRitualStepId[]
  selfcareChecked: string[]
  pushups: number
  ko: number
  checkinSkipped: CheckinQuestionId[]
  gratitudeIndex: number
  gratitudeConfirmed: number[]
  gratitudeSkipped: number[]
  medsSkipped: string[]
  supplementsTaken: string[]
  supplementsSkipped: string[]
  shakeStatus: ShakeRitualStatus
  dailiesConfirmed: string[]
  dailiesSkipped: string[]
  coldTimer: RitualTimerState | null
  commitment: CommitmentConfirmation | null
}

export const DEFAULT_COMMITMENT_TEXT = 'Heute gebe ich mein Bestes. Ich handle bewusst, übernehme Verantwortung für meine Entscheidungen und arbeite Schritt für Schritt an meinen Zielen.'

export type MorningGateMed = {
  id: string
  name: string
  dosage: string
  time: string
  taken: boolean
  skipped?: boolean
}

const LEGACY_DEFAULT_GRATITUDE_TEXT = [
  'Heute bin ich dankbar für diesen Morgen.',
  'Für einen Körper, der mitmacht.',
  'Für Klarheit, die wächst, wenn ich langsam starte.',
  'Für die Arbeit, die wartet — und dafür, dass ich bereit sein kann.',
].join('\n')

export const DEFAULT_GRATITUDE_TEXT = [
  'DANKE',
  'ICH BIN DANKBAR. ICH BIN BEREIT. ICH BIN IN TOPFORM!',
  'ICH DANKE GOTT FÜR DIESEN WUNDERVOLLEN TAG UND ALL DIE CHANCEN DIE MIT IHM KOMMEN.',
  'ICH ATME, ICH LEBE UND GENIEßE DIE FREIHEIT – DAS IST EIN PRIVILEG DAS ICH TÄGLICH EHRE!',
  'DANKBAR FÜR DIE FREIHEIT MEINE TRÄUME ZU LEBEN.',
  'ICH ENTSCHEIDE TÄGLICH BEWUSST WER ICH BIN UND WIE ICH MOVE. ZUM NÄCHSTEN LEVEL. IMMER.',
  'ICH BIN DANKBAR FÜR MEINEN KÖRPER – ER WÄCHST, KÄMPFT, ER TRÄGT MICH. ICH GEBE IHM ALLES WAS ER BRAUCHT UM JEDEN TAG STÄRKER ZU WERDEN!',
  'ICH BIN DANKBAR FÜR MEINEN GEIST, MEINE TALENTE, MEIN CHARISMA, MEIN POTENTIAL – UND SETZE DIESE TÄGLICH VOLLSTÄNDIG EIN.',
  'ICH BIN DANKBAR FÜR DIE MENSCHEN UM MICH HERUM, FREUNDE & FAMILIE DIE MICH LACHEN LASSEN, MIR KRAFT GEBEN & MICH WACHSEN LASSEN.',
  'MEINE DANKBARKEIT ZEIGT SICH IN MEINEN HANDLUNGEN.',
  'ICH HANDLE. ICH BAUE. ICH WACHSE.',
  'ICH SEHE DAS KLEINE. ICH ERSCHAFFE DAS GROßE!',
  'HEUTE! JETZT! ICH!',
].join('\n\n')

const LEGACY_SELFCARE_ITEMS: MorningSelfcareItem[] = [
  { id: 'teeth', label: 'Zähne geputzt' },
  { id: 'rinse', label: 'Mundspülung' },
  { id: 'face', label: 'Gesicht gereinigt' },
  { id: 'cream', label: 'Creme drauf' },
  { id: 'lotion', label: 'Bodylotion' },
  { id: 'deo', label: 'Deo' },
  { id: 'perfume', label: 'Parfüm' },
]

export const DEFAULT_SELFCARE_ITEMS: MorningSelfcareItem[] = [
  { id: 'teeth', label: 'Zähne · 2 Min. Fluoridzahnpasta' },
  { id: 'face', label: 'Rituals Cleanser · lauwarmes Wasser' },
  { id: 'purito', label: 'Purito Galacto Niacin 97 Essence' },
  { id: 'cream', label: 'Needly Crossbarrier Cream · bei Bedarf' },
  { id: 'spf', label: 'Beauty of Joseon Relief Sun SPF 50+' },
  { id: 'deo', label: 'Deo' },
]

export const DEFAULT_MORNING_RITUAL_RULES: MorningRitualStepRules = {
  medsShake: 'Erst Medikamente bestätigen, dann den Proteinshake trinken.',
  weight: 'Kurz wiegen — nur die Zahl, kein Urteil.',
  gratitude: 'Hör den Satz, dann sprich ihn selbst.',
  commitment: 'Ein Satz. Eine Entscheidung. Dann weiter.',
  coldShower: 'Atmen. Bleib stehen. Danach bewusst bestätigen.',
  winnerPose: 'Brust offen, Blick fest.',
  prayer: 'In Ruhe bleiben. Danach öffnet sich Heute.',
  energy: 'Kurz ehrlich einchecken, dann die Todos ansehen.',
  headRecovery: 'Wie ist die Stimmung, wie war die Nacht — ohne Werte, ohne Notiz.',
  todos: 'Schau deine Anker einmal bewusst an.',
  workout: 'Jede Wiederholung bewusst zählen.',
  postShower: 'Erst heiß, anschließend kurz kalt.',
  selfcare: 'Pflege nacheinander. Sonnenschutz bildet den letzten Schritt im Gesicht.',
  letsGo: 'Du bist durch. Tür zu, raus, arbeiten.',
}

export const DEFAULT_MORNING_RITUAL_MINUTES: MorningRitualStepMinutes = {
  medsShake: 2,
  weight: 1,
  gratitude: 2,
  commitment: 1,
  coldShower: 3,
  winnerPose: 3,
  prayer: 7,
  energy: 1,
  headRecovery: 2,
  todos: 2,
  workout: 10,
  postShower: 4,
  selfcare: 8,
  letsGo: 1,
}

export const DEFAULT_MORNING_RITUAL: MorningRitualConfig = {
  gratitudeText: DEFAULT_GRATITUDE_TEXT,
  coldSeconds: 180,
  winnerSeconds: 180,
  prayerSeconds: 420,
  pushupTarget: 50,
  koTarget: 10,
  hotShowerSeconds: 180,
  coldRinseSeconds: 20,
  selfcareItems: DEFAULT_SELFCARE_ITEMS,
  stepOrder: [...DEFAULT_STEP_ORDER],
  hiddenSteps: [...DEFAULT_HIDDEN_STEPS],
  autoAdvance: true,
  stepRules: { ...DEFAULT_MORNING_RITUAL_RULES },
  stepMinutes: { ...DEFAULT_MORNING_RITUAL_MINUTES },
  commitmentText: DEFAULT_COMMITMENT_TEXT,
  commitmentDocumentId: '',
  shakeMeal: {
    id: 'protein-shake',
    label: 'Proteinshake',
    proteinGrams: 30,
    calories: 180,
    fatGrams: 3,
    carbsGrams: 8,
    fiberGrams: 0,
  },
}

const SKIP_KEY = 'life-os-morning-gate-skip'
export const MORNING_RITUAL_PROGRESS_KEY = 'life-os-morning-ritual-progress'

export const GATE_STEP_IDS: MorningRitualStepId[] = [
  'headRecovery',
  'weight',
  'gratitude',
  'commitment',
  'medsShake',
  'coldShower',
  'winnerPose',
]

export const FULLSCREEN_STEP_IDS: MorningRitualStepId[] = [
  ...GATE_STEP_IDS,
  'weight',
  'energy',
  'headRecovery',
  'workout',
  'postShower',
  'selfcare',
  'letsGo',
]

export function isMorningRitualStepId(value: unknown): value is MorningRitualStepId {
  return typeof value === 'string' && (MORNING_RITUAL_STEP_IDS as readonly string[]).includes(value)
}

export function morningRitualPhase(id: MorningRitualStepId): MorningRitualPhase {
  switch (id) {
    case 'medsShake':
    case 'weight':
    case 'gratitude':
    case 'commitment':
    case 'coldShower':
    case 'winnerPose':
    case 'prayer':
    case 'energy':
    case 'headRecovery':
      return 'gate'
    case 'todos':
      return 'heute'
    case 'workout':
    case 'postShower':
    case 'selfcare':
    case 'letsGo':
      return 'track'
    default: {
      const _exhaustive: never = id
      return _exhaustive
    }
  }
}

export function morningRitualMeta(
  id: MorningRitualStepId,
  config?: MorningRitualConfig,
): { label: string; hint: string } {
  const minutes = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} Minuten`
  switch (id) {
    case 'medsShake':
      return { label: 'Morning Essentials', hint: 'Medikamente, Supplements, Shake, Dailies' }
    case 'weight':
      return { label: 'Gewicht', hint: 'Kurze Morgenwägung' }
    case 'gratitude':
      return { label: 'Dankbarkeit', hint: 'Hören, sprechen, bestätigen' }
    case 'commitment':
      return { label: 'Verbindlichkeit', hint: 'Ein bewusster Satz' }
    case 'coldShower':
      return { label: 'Cold Shower', hint: `${minutes(config?.coldSeconds ?? 180)} kalt` }
    case 'winnerPose':
      return { label: 'Winner Mode', hint: `${minutes(config?.winnerSeconds ?? 180)} Pose` }
    case 'prayer':
      return { label: 'Gebet', hint: minutes(config?.prayerSeconds ?? 420) }
    case 'energy':
      return { label: 'Energie', hint: 'Kurzer Check-in' }
    case 'headRecovery':
      return { label: 'Stimmung & Erholung', hint: 'Stimmung und Schlaf' }
    case 'todos':
      return { label: 'Todos', hint: 'Was heute zählt' }
    case 'workout':
      return {
        label: 'Workout',
        hint: `${config?.pushupTarget ?? 50} Pushups und KO`,
      }
    case 'postShower':
      return { label: 'Dusche', hint: 'Heiß, dann kurz kalt' }
    case 'selfcare':
      return { label: 'Selfcare', hint: 'Bereit machen' }
    case 'letsGo':
      return { label: 'LETS GO', hint: 'Ready zur Arbeit' }
    default: {
      const _exhaustive: never = id
      return _exhaustive
    }
  }
}

/** Aliases so older UI imports keep compiling. */
export const morningGateMeta = morningRitualMeta
export const DEFAULT_MORNING_GATE_STEPS: MorningRitualStepId[] = [...GATE_STEP_IDS]
export const MORNING_GATE_STEPS = GATE_STEP_IDS.map(id => ({ id, ...morningRitualMeta(id) }))

export function normalizeMorningGateSteps(raw: unknown): MorningRitualStepId[] {
  if (!Array.isArray(raw)) return [...GATE_STEP_IDS]
  const unique = [...new Set(raw.filter(isMorningRitualStepId))]
  return unique.length > 0 ? unique : [...GATE_STEP_IDS]
}

export function normalizeSelfcareItems(raw: unknown): MorningSelfcareItem[] {
  if (!Array.isArray(raw) || JSON.stringify(raw) === JSON.stringify(LEGACY_SELFCARE_ITEMS)) {
    return DEFAULT_SELFCARE_ITEMS.map(item => ({ ...item }))
  }
  const items = raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Partial<MorningSelfcareItem>
      const label = String(record.label ?? '').trim()
      if (!label) return null
      const id = String(record.id ?? '').trim() || `selfcare-${index}`
      return { id, label: label.slice(0, 60) }
    })
    .filter((item): item is MorningSelfcareItem => Boolean(item))
  return items.length > 0 ? items : DEFAULT_SELFCARE_ITEMS.map(item => ({ ...item }))
}

export function normalizeStepOrder(raw: unknown): MorningRitualStepId[] {
  const stored = Array.isArray(raw) ? raw.filter(isMorningRitualStepId) : []
  const unique = [...new Set(stored)]
  if (unique.length > 0 && !unique.includes('commitment')) {
    const gratitudeAt = unique.indexOf('gratitude')
    if (gratitudeAt >= 0) unique.splice(gratitudeAt + 1, 0, 'commitment')
    else unique.push('commitment')
  }
  const missing = MORNING_RITUAL_STEP_IDS.filter(id => !unique.includes(id))
  if (missing.includes('headRecovery')) {
    const energyAt = unique.indexOf('energy')
    if (energyAt >= 0) unique.splice(energyAt + 1, 0, 'headRecovery')
    else unique.push('headRecovery')
    return [...unique, ...missing.filter(id => id !== 'headRecovery')]
  }
  return [...unique, ...missing]
}

export function normalizeHiddenSteps(raw: unknown): MorningRitualStepId[] {
  if (!Array.isArray(raw)) return []
  const hidden = [...new Set(raw.filter(isMorningRitualStepId))]
  return hidden.length >= MORNING_RITUAL_STEP_IDS.length ? [] : hidden
}

export function ritualSequence(config: MorningRitualConfig): MorningRitualStepId[] {
  const hidden = new Set(config.hiddenSteps)
  return normalizeStepOrder(config.stepOrder).filter(id => !hidden.has(id))
}

export function moveRitualStep(order: MorningRitualStepId[], index: number, delta: number): MorningRitualStepId[] {
  const next = normalizeStepOrder(order)
  const target = index + delta
  if (target < 0 || target >= next.length) return next
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

export function ritualSecondsFor(id: MorningRitualStepId, config: MorningRitualConfig): number | null {
  switch (id) {
    case 'coldShower':
      return config.coldSeconds
    case 'winnerPose':
      return config.winnerSeconds
    case 'prayer':
      return config.prayerSeconds
    case 'postShower':
      return config.hotShowerSeconds + config.coldRinseSeconds
    case 'medsShake':
    case 'weight':
    case 'gratitude':
    case 'commitment':
    case 'energy':
    case 'headRecovery':
    case 'todos':
    case 'workout':
    case 'selfcare':
    case 'letsGo':
      return null
    default: {
      const _exhaustive: never = id
      return _exhaustive
    }
  }
}

export function ritualRuleFor(id: MorningRitualStepId, config: MorningRitualConfig): string {
  return config.stepRules?.[id] || DEFAULT_MORNING_RITUAL_RULES[id]
}

export function ritualMinutesFor(id: MorningRitualStepId, config: MorningRitualConfig): number {
  const timedSeconds = ritualSecondsFor(id, config)
  if (timedSeconds !== null) return Math.max(1, Math.round(timedSeconds / 60))
  return config.stepMinutes?.[id] || DEFAULT_MORNING_RITUAL_MINUTES[id]
}

function normalizeStepRules(raw: unknown): MorningRitualStepRules {
  const stored = raw && typeof raw === 'object' ? raw as Partial<MorningRitualStepRules> : {}
  return Object.fromEntries(MORNING_RITUAL_STEP_IDS.map(id => {
    const value = typeof stored[id] === 'string' ? stored[id].trim().slice(0, 240) : ''
    return [id, value || DEFAULT_MORNING_RITUAL_RULES[id]]
  })) as MorningRitualStepRules
}

function normalizeStepMinutes(raw: unknown): MorningRitualStepMinutes {
  const stored = raw && typeof raw === 'object' ? raw as Partial<MorningRitualStepMinutes> : {}
  return Object.fromEntries(MORNING_RITUAL_STEP_IDS.map(id => [
    id,
    clampRitualSeconds(stored[id], DEFAULT_MORNING_RITUAL_MINUTES[id], 1, 120),
  ])) as MorningRitualStepMinutes
}

function sameStepList(raw: unknown, expected: readonly MorningRitualStepId[]): boolean {
  if (!Array.isArray(raw) || raw.length !== expected.length) return false
  return raw.every((id, index) => id === expected[index])
}

function isUntouchedLegacyRitual(stored: Partial<MorningRitualConfig>): boolean {
  const orderMissing = !Array.isArray(stored.stepOrder)
  const orderLegacy = sameStepList(stored.stepOrder, LEGACY_STEP_ORDER)
  const hiddenMissing = !Array.isArray(stored.hiddenSteps)
  const hiddenLegacy = Array.isArray(stored.hiddenSteps)
    && stored.hiddenSteps.length === 1
    && stored.hiddenSteps[0] === 'weight'
  return (orderMissing || orderLegacy) && (hiddenMissing || hiddenLegacy)
}

export function normalizeMorningRitualConfig(raw: Partial<MorningRitualConfig> | undefined): MorningRitualConfig {
  const stored = raw ?? {}
  const storedGratitudeText = typeof stored.gratitudeText === 'string'
    ? stored.gratitudeText.trim()
    : ''
  const untouched = isUntouchedLegacyRitual(stored)
  let hiddenSteps = untouched ? [...DEFAULT_HIDDEN_STEPS] : normalizeHiddenSteps(stored.hiddenSteps)
  const storedOrder = Array.isArray(stored.stepOrder) ? stored.stepOrder : null
  const knewWeight = Boolean(storedOrder?.includes('weight'))
  // Configs from before the weight step existed stay hidden unless they opted in.
  if (!untouched && !knewWeight && !hiddenSteps.includes('weight')) {
    hiddenSteps = [...hiddenSteps, 'weight']
  }
  const commitmentText = typeof stored.commitmentText === 'string' ? stored.commitmentText.trim() : ''
  return {
    gratitudeText: storedGratitudeText && storedGratitudeText !== LEGACY_DEFAULT_GRATITUDE_TEXT
      ? storedGratitudeText.slice(0, 1200)
      : DEFAULT_GRATITUDE_TEXT,
    coldSeconds: clampRitualSeconds(stored.coldSeconds, 180, 30, 600),
    winnerSeconds: clampRitualSeconds(stored.winnerSeconds, 180, 30, 600),
    prayerSeconds: clampRitualSeconds(stored.prayerSeconds, 420, 60, 1200),
    pushupTarget: clampRitualSeconds(stored.pushupTarget, 50, 5, 200),
    koTarget: clampRitualSeconds(stored.koTarget, 10, 1, 100),
    hotShowerSeconds: clampRitualSeconds(stored.hotShowerSeconds, 180, 30, 600),
    coldRinseSeconds: clampRitualSeconds(stored.coldRinseSeconds, 20, 8, 45),
    selfcareItems: normalizeSelfcareItems(stored.selfcareItems),
    stepOrder: untouched ? [...DEFAULT_STEP_ORDER] : normalizeStepOrder(stored.stepOrder),
    hiddenSteps,
    autoAdvance: stored.autoAdvance !== false,
    stepRules: normalizeStepRules(stored.stepRules),
    stepMinutes: normalizeStepMinutes(stored.stepMinutes),
    commitmentText: commitmentText ? commitmentText.slice(0, 800) : DEFAULT_COMMITMENT_TEXT,
    commitmentDocumentId: typeof stored.commitmentDocumentId === 'string'
      ? stored.commitmentDocumentId.trim().slice(0, 80)
      : '',
    shakeMeal: normalizeShakeMealConfig(stored.shakeMeal),
  }
}

function normalizeShakeMealConfig(raw: unknown): MorningRitualConfig['shakeMeal'] {
  const stored = raw && typeof raw === 'object' ? raw as Partial<MorningRitualConfig['shakeMeal']> : {}
  const grams = (value: unknown, fallback: number, max: number) => {
    const next = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
    return Math.min(max, Math.max(0, next))
  }
  return {
    id: 'protein-shake',
    label: typeof stored.label === 'string' && stored.label.trim()
      ? stored.label.trim().slice(0, 40)
      : DEFAULT_MORNING_RITUAL.shakeMeal.label,
    proteinGrams: grams(stored.proteinGrams, DEFAULT_MORNING_RITUAL.shakeMeal.proteinGrams, 80),
    calories: grams(stored.calories, DEFAULT_MORNING_RITUAL.shakeMeal.calories, 800),
    fatGrams: grams(stored.fatGrams, DEFAULT_MORNING_RITUAL.shakeMeal.fatGrams, 40),
    carbsGrams: grams(stored.carbsGrams, DEFAULT_MORNING_RITUAL.shakeMeal.carbsGrams, 80),
    fiberGrams: grams(stored.fiberGrams, DEFAULT_MORNING_RITUAL.shakeMeal.fiberGrams, 20),
  }
}

function clampRitualSeconds(raw: unknown, fallback: number, min: number, max: number): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : fallback
  return Math.min(max, Math.max(min, value))
}

export function emptyRitualProgress(today: string): MorningRitualProgress {
  return {
    date: today,
    done: [],
    skipped: [],
    selfcareChecked: [],
    pushups: 0,
    ko: 0,
    checkinSkipped: [],
    gratitudeIndex: 0,
    gratitudeConfirmed: [],
    gratitudeSkipped: [],
    medsSkipped: [],
    supplementsTaken: [],
    supplementsSkipped: [],
    shakeStatus: 'pending',
    dailiesConfirmed: [],
    dailiesSkipped: [],
    coldTimer: null,
    commitment: null,
  }
}

function stringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.map(item => String(item).trim()).filter(Boolean))]
}

function numberList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((item): item is number => (
    typeof item === 'number' && Number.isInteger(item) && item >= 0 && item < 200
  )))]
}

function checkinList(raw: unknown): CheckinQuestionId[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((item): item is CheckinQuestionId => (
    item === 'mood' || item === 'recovery' || item === 'sleep' || item === 'dream'
  )))]
}

function normalizeShakeStatus(raw: unknown): ShakeRitualStatus {
  if (raw === 'taken' || raw === 'later' || raw === 'skipped' || raw === 'pending') return raw
  return 'pending'
}

function normalizeCommitment(raw: unknown): CommitmentConfirmation | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Partial<CommitmentConfirmation>
  const text = typeof record.text === 'string' ? record.text.trim() : ''
  const confirmedAt = typeof record.confirmedAt === 'string' ? record.confirmedAt.trim() : ''
  if (!text || !confirmedAt) return null
  const fingerprint = typeof record.fingerprint === 'string' && record.fingerprint.trim()
    ? record.fingerprint.trim().slice(0, 40)
    : commitmentFingerprint(text)
  const documentId = typeof record.documentId === 'string' ? record.documentId.trim().slice(0, 80) : ''
  return {
    confirmedAt: confirmedAt.slice(0, 40),
    text: text.slice(0, 800),
    fingerprint,
    ...(documentId ? { documentId } : {}),
  }
}

function normalizeTimer(raw: unknown): RitualTimerState | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Partial<RitualTimerState>
  const durationSec = clampRitualSeconds(record.durationSec, 0, 0, 600)
  if (durationSec <= 0) return null
  const accumulatedMs = typeof record.accumulatedMs === 'number' && record.accumulatedMs > 0
    ? Math.min(durationSec * 1000, Math.round(record.accumulatedMs))
    : 0
  const startedAt = typeof record.startedAt === 'number' && Number.isFinite(record.startedAt)
    ? record.startedAt
    : null
  const running = Boolean(record.running) && startedAt != null
  return {
    durationSec,
    accumulatedMs,
    startedAt: running ? startedAt : null,
    running,
  }
}

export function normalizeMorningRitualProgress(raw: unknown): MorningRitualProgress | null {
  if (!raw || typeof raw !== 'object') return null
  const stored = raw as Partial<MorningRitualProgress>
  const date = typeof stored.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(stored.date)
    ? stored.date
    : ''
  if (!date) return null
  const done = Array.isArray(stored.done) ? [...new Set(stored.done.filter(isMorningRitualStepId))] : []
  const skipped = (Array.isArray(stored.skipped) ? [...new Set(stored.skipped.filter(isMorningRitualStepId))] : [])
    .filter(id => !done.includes(id))
  return {
    date,
    done,
    skipped,
    selfcareChecked: stringList(stored.selfcareChecked),
    pushups: clampRitualSeconds(stored.pushups, 0, 0, 400),
    ko: clampRitualSeconds(stored.ko, 0, 0, 200),
    checkinSkipped: checkinList(stored.checkinSkipped),
    gratitudeIndex: clampRitualSeconds(stored.gratitudeIndex, 0, 0, 80),
    gratitudeConfirmed: numberList(stored.gratitudeConfirmed),
    gratitudeSkipped: numberList(stored.gratitudeSkipped),
    medsSkipped: stringList(stored.medsSkipped),
    supplementsTaken: stringList(stored.supplementsTaken),
    supplementsSkipped: stringList(stored.supplementsSkipped).filter(id => !stringList(stored.supplementsTaken).includes(id)),
    shakeStatus: normalizeShakeStatus(stored.shakeStatus),
    dailiesConfirmed: stringList(stored.dailiesConfirmed),
    dailiesSkipped: stringList(stored.dailiesSkipped).filter(id => !stringList(stored.dailiesConfirmed).includes(id)),
    coldTimer: normalizeTimer(stored.coldTimer),
    commitment: normalizeCommitment(stored.commitment),
  }
}

export function mergeMorningRitualProgress(
  current: unknown,
  incoming: unknown,
): MorningRitualProgress | null {
  const local = normalizeMorningRitualProgress(current)
  const remote = normalizeMorningRitualProgress(incoming)
  if (!local) return remote
  if (!remote) return local
  if (local.date !== remote.date) return local.date > remote.date ? local : remote
  const done = [...new Set([...local.done, ...remote.done])]
  const shakeRank: Record<ShakeRitualStatus, number> = { pending: 0, later: 1, skipped: 2, taken: 3 }
  const commitment = [local.commitment, remote.commitment]
    .filter((item): item is CommitmentConfirmation => Boolean(item))
    .sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt))
    .at(-1) ?? null
  const coldTimer = [local.coldTimer, remote.coldTimer]
    .filter((item): item is RitualTimerState => Boolean(item))
    .sort((a, b) => (a.accumulatedMs + (a.running ? 1 : 0)) - (b.accumulatedMs + (b.running ? 1 : 0)))
    .at(-1) ?? null
  return {
    date: local.date,
    done,
    skipped: [...new Set([...local.skipped, ...remote.skipped])].filter(id => !done.includes(id)),
    selfcareChecked: [...new Set([...local.selfcareChecked, ...remote.selfcareChecked])],
    pushups: Math.max(local.pushups, remote.pushups),
    ko: Math.max(local.ko, remote.ko),
    checkinSkipped: [...new Set([...local.checkinSkipped, ...remote.checkinSkipped])],
    gratitudeIndex: Math.max(local.gratitudeIndex, remote.gratitudeIndex),
    gratitudeConfirmed: [...new Set([...local.gratitudeConfirmed, ...remote.gratitudeConfirmed])],
    gratitudeSkipped: [...new Set([...local.gratitudeSkipped, ...remote.gratitudeSkipped])],
    medsSkipped: [...new Set([...local.medsSkipped, ...remote.medsSkipped])],
    supplementsTaken: [...new Set([...local.supplementsTaken, ...remote.supplementsTaken])],
    supplementsSkipped: [...new Set([...local.supplementsSkipped, ...remote.supplementsSkipped])]
      .filter(id => !local.supplementsTaken.includes(id) && !remote.supplementsTaken.includes(id)),
    shakeStatus: shakeRank[local.shakeStatus] >= shakeRank[remote.shakeStatus] ? local.shakeStatus : remote.shakeStatus,
    dailiesConfirmed: [...new Set([...local.dailiesConfirmed, ...remote.dailiesConfirmed])],
    dailiesSkipped: [...new Set([...local.dailiesSkipped, ...remote.dailiesSkipped])]
      .filter(id => !local.dailiesConfirmed.includes(id) && !remote.dailiesConfirmed.includes(id)),
    coldTimer,
    commitment,
  }
}

export function loadMorningRitualProgress(today: string): MorningRitualProgress {
  try {
    const stored = normalizeMorningRitualProgress(
      JSON.parse(localStorage.getItem(MORNING_RITUAL_PROGRESS_KEY) ?? 'null'),
    )
    return stored?.date === today ? stored : emptyRitualProgress(today)
  } catch {
    return emptyRitualProgress(today)
  }
}

export function saveMorningRitualProgress(progress: MorningRitualProgress): void {
  try {
    localStorage.setItem(MORNING_RITUAL_PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    /* ignore */
  }
}

export function markRitualStepDone(progress: MorningRitualProgress, id: MorningRitualStepId): MorningRitualProgress {
  if (progress.done.includes(id) && !progress.skipped.includes(id)) return progress
  const next = {
    ...progress,
    done: progress.done.includes(id) ? progress.done : [...progress.done, id],
    skipped: progress.skipped.filter(step => step !== id),
  }
  saveMorningRitualProgress(next)
  return next
}

export function markRitualStepSkipped(progress: MorningRitualProgress, id: MorningRitualStepId): MorningRitualProgress {
  if (progress.skipped.includes(id) && !progress.done.includes(id)) return progress
  const next = {
    ...progress,
    done: progress.done.filter(step => step !== id),
    skipped: progress.skipped.includes(id) ? progress.skipped : [...progress.skipped, id],
  }
  saveMorningRitualProgress(next)
  return next
}

export function reopenRitualStep(progress: MorningRitualProgress, id: MorningRitualStepId): MorningRitualProgress {
  const next = {
    ...progress,
    done: progress.done.filter(step => step !== id),
    skipped: progress.skipped.filter(step => step !== id),
  }
  saveMorningRitualProgress(next)
  return next
}

export function patchRitualProgress(
  progress: MorningRitualProgress,
  patch: Partial<MorningRitualProgress>,
): MorningRitualProgress {
  const next = normalizeMorningRitualProgress({ ...progress, ...patch, date: progress.date }) ?? progress
  saveMorningRitualProgress(next)
  return next
}

export function nextMorningRitualStep(input: {
  enabled: boolean
  skipped: boolean
  preview: boolean
  progress: MorningRitualProgress
  medications: MorningGateMed[]
  proteinShake: boolean
  gratitudeDone: boolean
  energySet: boolean
  headRecoveryDone?: boolean
  weightSet?: boolean
  pushupsDone: boolean
  coldShowerDone?: boolean
  winnerModeDone?: boolean
  essentialsOpen?: boolean
  config: MorningRitualConfig
}): MorningRitualStepId | null {
  if (!input.enabled && !input.preview) return null
  if (input.skipped && !input.preview) return null

  for (const id of ritualSequence(input.config)) {
    if (!input.preview && (input.progress.done.includes(id) || input.progress.skipped.includes(id))) continue
    switch (id) {
      case 'medsShake':
        if (input.preview) return id
        return id
      case 'weight':
        if (input.preview) return id
        return id
      case 'gratitude':
        if (input.preview) return id
        if (!input.gratitudeDone) return id
        break
      case 'commitment':
        if (input.preview) return id
        if (!input.progress.commitment) return id
        break
      case 'coldShower':
        if (input.preview) return id
        if (input.coldShowerDone) break
        return id
      case 'winnerPose':
        if (input.preview) return id
        if (input.winnerModeDone) break
        return id
      case 'prayer':
      case 'todos':
      case 'postShower':
      case 'selfcare':
      case 'letsGo':
        if (input.preview) return id
        return id
      case 'energy':
        if (input.preview) return id
        if (!input.energySet) return id
        break
      case 'headRecovery':
        if (input.preview) return id
        if (input.headRecoveryDone) break
        return id
      case 'workout':
        if (input.preview) return id
        if (!input.pushupsDone || input.progress.ko < input.config.koTarget) return id
        break
      default: {
        const _exhaustive: never = id
        return _exhaustive
      }
    }
  }
  return null
}

export function pendingMorningGateSteps(input: {
  enabled: boolean
  steps: MorningRitualStepId[]
  skipped: boolean
  medications: MorningGateMed[]
  gratitudeDone: boolean
}): MorningRitualStepId[] {
  if (!input.enabled || input.skipped) return []
  const next = nextMorningRitualStep({
    enabled: input.enabled,
    skipped: input.skipped,
    preview: false,
    progress: emptyRitualProgress(''),
    medications: input.medications,
    proteinShake: true,
    gratitudeDone: input.gratitudeDone,
    energySet: true,
    pushupsDone: true,
    config: DEFAULT_MORNING_RITUAL,
  })
  return next && GATE_STEP_IDS.includes(next) ? [next] : []
}

export function loadMorningGateSkip(today: string): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) === today
  } catch {
    return false
  }
}

export function saveMorningGateSkip(today: string): void {
  try {
    localStorage.setItem(SKIP_KEY, today)
  } catch {
    /* ignore */
  }
}

export function formatRitualClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function estimateSpeechMs(text: string): number {
  const chars = text.replace(/\s+/g, ' ').trim().length
  return Math.min(120_000, Math.max(4000, Math.round(chars / 12) * 1000))
}

export function speakGerman(text: string, onEnded: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const speech = window.speechSynthesis
  if (!speech) {
    const timer = globalThis.setTimeout(onEnded, estimateSpeechMs(text))
    return () => globalThis.clearTimeout(timer)
  }

  speech.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'de-DE'
  utterance.rate = 0.92
  const voices = speech.getVoices()
  const german = voices.find(voice => voice.lang.toLowerCase().startsWith('de'))
  if (german) utterance.voice = german
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    onEnded()
  }
  utterance.onend = finish
  utterance.onerror = finish
  const fallback = globalThis.setTimeout(finish, estimateSpeechMs(text) + 2500)
  speech.speak(utterance)
  return () => {
    globalThis.clearTimeout(fallback)
    speech.cancel()
  }
}

export function playRitualChime(kind: 'done' | 'alarm' = 'done'): void {
  const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return
  const context = new AudioCtor()
  const notes = kind === 'alarm' ? [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5] : [523.25, 659.25, 783.99]
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.value = 0.0001
    oscillator.connect(gain)
    gain.connect(context.destination)
    const start = context.currentTime + index * (kind === 'alarm' ? 0.18 : 0.14)
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
    oscillator.start(start)
    oscillator.stop(start + 0.18)
  })
  window.setTimeout(() => {
    void context.close()
  }, kind === 'alarm' ? 1600 : 700)
}

export function commitmentFingerprint(text: string): string {
  let hash = 0
  for (const char of text) hash = Math.imul(hash, 31) + char.charCodeAt(0) | 0
  return `c${(hash >>> 0).toString(16)}`
}

export function gratitudeStatements(text: string, personal: string[] = []): string[] {
  const configured = text.split(/\n+/).map(line => line.trim()).filter(Boolean)
  const seen = new Set<string>()
  const lines: string[] = []
  for (const line of [...personal, ...configured]) {
    const clean = line.replace(/\s+/g, ' ').trim()
    if (!clean) continue
    const key = clean.toLocaleLowerCase('de-DE')
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(clean)
  }
  return lines.length > 0 ? lines : ['Ich bin dankbar für diesen Morgen.']
}

export type CommitmentDocument = {
  id: string
  title: string
  content: string
  tags?: string[]
}

const COMMITMENT_PATTERN = /vereinbarung|commitment|selbstvertrag|affirmation|vorsatz|ich gebe mein bestes/i

export function resolveCommitment(input: {
  configuredText: string
  linkedDocumentId?: string
  documents: CommitmentDocument[]
}): {
  text: string
  documentId?: string
  title?: string
  imported: boolean
  ambiguous: boolean
} {
  const configured = input.configuredText.trim() || DEFAULT_COMMITMENT_TEXT
  const linkedId = input.linkedDocumentId?.trim()
  if (linkedId) {
    const linked = input.documents.find(doc => doc.id === linkedId)
    const linkedText = linked?.content.trim()
    if (linked && linkedText) {
      return {
        text: linkedText,
        documentId: linked.id,
        title: linked.title.trim() || undefined,
        imported: true,
        ambiguous: false,
      }
    }
  }
  const matches = input.documents.filter(doc => {
    const haystack = `${doc.title} ${(doc.tags ?? []).join(' ')} ${doc.content}`
    return COMMITMENT_PATTERN.test(haystack) && doc.content.trim().length > 0
  })
  if (matches.length > 1) {
    return { text: configured, imported: false, ambiguous: true }
  }
  if (matches.length === 1) {
    return {
      text: matches[0].content.trim(),
      documentId: matches[0].id,
      title: matches[0].title.trim() || undefined,
      imported: true,
      ambiguous: false,
    }
  }
  return { text: configured, imported: false, ambiguous: false }
}

export function personalGratitudeLines(documents: CommitmentDocument[]): string[] {
  const lines: string[] = []
  for (const doc of documents) {
    const haystack = `${doc.title} ${(doc.tags ?? []).join(' ')}`
    if (!/dankbar/i.test(`${haystack} ${doc.content}`)) continue
    const contentLines = doc.content
      .split(/\n+/)
      .map(line => line.trim())
      .filter(line => line.length >= 8 && line.length <= 180)
    if (contentLines.length > 0) lines.push(...contentLines.slice(0, 3))
    else if (doc.title.trim()) lines.push(doc.title.trim())
    if (lines.length >= 6) break
  }
  return lines.slice(0, 6)
}

export function nextCheckinQuestion(input: {
  mood: string
  sleepQuality: string
  sleepDuration: string
  dreamed?: boolean
  skipped: CheckinQuestionId[]
}): CheckinQuestionId | null {
  for (const id of CHECKIN_QUESTION_IDS) {
    if (input.skipped.includes(id)) continue
    if (id === 'mood' && input.mood.trim()) continue
    if (id === 'recovery' && input.sleepQuality.trim()) continue
    if (id === 'sleep' && input.sleepDuration.trim()) continue
    if (id === 'dream' && input.dreamed !== undefined) continue
    return id
  }
  return null
}

export function checkinResolution(input: {
  mood: string
  sleepQuality: string
  sleepDuration: string
  dreamed?: boolean
  skipped: CheckinQuestionId[]
}): 'pending' | 'completed' | 'skipped' {
  if (nextCheckinQuestion(input)) return 'pending'
  return input.skipped.length > 0 ? 'skipped' : 'completed'
}

export type DoseMedication = {
  name: string
  dosage: string
  notes?: string
  doseOptions?: string[]
}

function uniqueDoses(values: string[]): string[] {
  const seen = new Set<string>()
  const doses: string[] = []
  for (const value of values) {
    const clean = value.replace(/\s+/g, ' ').trim()
    if (!clean) continue
    const key = clean.toLocaleLowerCase('de-DE')
    if (seen.has(key)) continue
    seen.add(key)
    doses.push(clean.slice(0, 40))
  }
  return doses
}

function splitConfiguredDoses(raw: string): string[] {
  const parts = raw.split(/\s*(?:\/|,|;|\||\boder\b)\s*/i).map(part => part.trim()).filter(Boolean)
  const doses = parts.filter(part => /\d/.test(part) && /mg|µg|mcg|μg|ml|ie\b/i.test(part))
  return doses.length > 1 ? uniqueDoses(doses) : []
}

/** Doses come only from stored medication configuration. Never invent a ladder. */
export function medicationDoseOptions(medication: DoseMedication): string[] {
  const configured = uniqueDoses(medication.doseOptions ?? [])
  if (configured.length > 0) return configured
  const fromDosage = splitConfiguredDoses(medication.dosage)
  if (fromDosage.length > 0) return fromDosage
  if (/elvanse/i.test(medication.name)) {
    const fromNotes = splitConfiguredDoses(medication.notes ?? '')
    if (fromNotes.length > 0) return fromNotes
  }
  const single = medication.dosage.trim()
  return single ? [single.slice(0, 40)] : []
}

export function essentialsPhaseOpen(input: {
  progress: MorningRitualProgress
  pendingMedicationIds: string[]
  supplementIds: string[]
  pendingDailyIds: string[]
  proteinShake: boolean
}): boolean {
  if (input.progress.done.includes('medsShake') || input.progress.skipped.includes('medsShake')) return false
  const medsOpen = input.pendingMedicationIds.some(id => !input.progress.medsSkipped.includes(id))
  const supplementsOpen = input.supplementIds.some(id => (
    !input.progress.supplementsTaken.includes(id) && !input.progress.supplementsSkipped.includes(id)
  ))
  const shakeOpen = input.progress.shakeStatus === 'pending' && !input.proteinShake
  const dailiesOpen = input.pendingDailyIds.some(id => (
    !input.progress.dailiesConfirmed.includes(id) && !input.progress.dailiesSkipped.includes(id)
  ))
  return medsOpen || supplementsOpen || shakeOpen || dailiesOpen
}

export function createTimerState(durationSec: number): RitualTimerState {
  return {
    durationSec: Math.min(600, Math.max(15, Math.round(durationSec))),
    startedAt: null,
    accumulatedMs: 0,
    running: false,
  }
}

export function timerRemainingMs(state: RitualTimerState, now: number): number {
  const runningMs = state.running && state.startedAt != null ? Math.max(0, now - state.startedAt) : 0
  return Math.max(0, state.durationSec * 1000 - state.accumulatedMs - runningMs)
}

export function startRitualTimer(state: RitualTimerState, now: number): RitualTimerState {
  if (state.running) return state
  if (timerRemainingMs(state, now) <= 0) return { ...state, running: false, startedAt: null }
  return { ...state, running: true, startedAt: now }
}

export function pauseRitualTimer(state: RitualTimerState, now: number): RitualTimerState {
  if (!state.running || state.startedAt == null) return { ...state, running: false, startedAt: null }
  const accumulatedMs = Math.min(
    state.durationSec * 1000,
    state.accumulatedMs + Math.max(0, now - state.startedAt),
  )
  return { ...state, running: false, startedAt: null, accumulatedMs }
}

export function resetRitualTimer(state: RitualTimerState): RitualTimerState {
  return createTimerState(state.durationSec)
}

export function completeRitualTimer(state: RitualTimerState): RitualTimerState {
  return {
    ...state,
    running: false,
    startedAt: null,
    accumulatedMs: state.durationSec * 1000,
  }
}

export function goalTravelPercent(current: number, start: number, goal: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(start) || !Number.isFinite(goal)) return null
  if (start === goal) return null
  const raw = (current - start) / (goal - start)
  return Math.max(0, Math.min(1, raw))
}
