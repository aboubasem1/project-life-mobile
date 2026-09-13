export const MORNING_RITUAL_STEP_IDS = [
  'medsShake',
  'gratitude',
  'coldShower',
  'winnerPose',
  'prayer',
  'energy',
  'todos',
  'workout',
  'postShower',
  'selfcare',
  'letsGo',
] as const

export type MorningRitualStepId = (typeof MORNING_RITUAL_STEP_IDS)[number]

/** @deprecated use MorningRitualStepId — kept for older settings blobs */
export type MorningGateStepId = MorningRitualStepId

export type MorningRitualPhase = 'gate' | 'heute' | 'track'

export type MorningSelfcareItem = {
  id: string
  label: string
}

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
}

export type MorningRitualProgress = {
  date: string
  done: MorningRitualStepId[]
  selfcareChecked: string[]
  pushups: number
  ko: number
}

export type MorningGateMed = {
  id: string
  name: string
  dosage: string
  time: string
  taken: boolean
}

export const DEFAULT_GRATITUDE_TEXT = [
  'Heute bin ich dankbar für diesen Morgen.',
  'Für einen Körper, der mitmacht.',
  'Für Klarheit, die wächst, wenn ich langsam starte.',
  'Für die Arbeit, die wartet — und dafür, dass ich bereit sein kann.',
].join('\n')

export const DEFAULT_SELFCARE_ITEMS: MorningSelfcareItem[] = [
  { id: 'teeth', label: 'Zähne geputzt' },
  { id: 'rinse', label: 'Mundspülung' },
  { id: 'face', label: 'Gesicht gereinigt' },
  { id: 'cream', label: 'Creme drauf' },
  { id: 'lotion', label: 'Bodylotion' },
  { id: 'deo', label: 'Deo' },
  { id: 'perfume', label: 'Parfüm' },
]

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
}

const SKIP_KEY = 'life-os-morning-gate-skip'
const PROGRESS_KEY = 'life-os-morning-ritual-progress'

export const GATE_STEP_IDS: MorningRitualStepId[] = [
  'medsShake',
  'gratitude',
  'coldShower',
  'winnerPose',
  'prayer',
]

export const FULLSCREEN_STEP_IDS: MorningRitualStepId[] = [
  ...GATE_STEP_IDS,
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
    case 'gratitude':
    case 'coldShower':
    case 'winnerPose':
    case 'prayer':
      return 'gate'
    case 'energy':
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

export function morningRitualMeta(id: MorningRitualStepId): { label: string; hint: string } {
  switch (id) {
    case 'medsShake':
      return { label: 'Medikamente + Shake', hint: 'Einnahme und Proteinshake' }
    case 'gratitude':
      return { label: 'Dankbarkeit', hint: 'Text hören, dann weiter' }
    case 'coldShower':
      return { label: 'Cold Shower', hint: '3 Minuten kalt' }
    case 'winnerPose':
      return { label: 'Winner Mode', hint: '3 Minuten Pose' }
    case 'prayer':
      return { label: 'Gebet', hint: '7 Minuten' }
    case 'energy':
      return { label: 'Energie', hint: 'Kurzer Check-in' }
    case 'todos':
      return { label: 'Todos', hint: 'Was heute zählt' }
    case 'workout':
      return { label: 'Workout', hint: '50 Pushups und KO' }
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
  if (!Array.isArray(raw)) return DEFAULT_SELFCARE_ITEMS.map(item => ({ ...item }))
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

export function normalizeMorningRitualConfig(raw: Partial<MorningRitualConfig> | undefined): MorningRitualConfig {
  const stored = raw ?? {}
  return {
    gratitudeText: typeof stored.gratitudeText === 'string' && stored.gratitudeText.trim()
      ? stored.gratitudeText.slice(0, 1200)
      : DEFAULT_GRATITUDE_TEXT,
    coldSeconds: clampRitualSeconds(stored.coldSeconds, 180, 30, 600),
    winnerSeconds: clampRitualSeconds(stored.winnerSeconds, 180, 30, 600),
    prayerSeconds: clampRitualSeconds(stored.prayerSeconds, 420, 60, 1200),
    pushupTarget: clampRitualSeconds(stored.pushupTarget, 50, 5, 200),
    koTarget: clampRitualSeconds(stored.koTarget, 10, 1, 100),
    hotShowerSeconds: clampRitualSeconds(stored.hotShowerSeconds, 180, 30, 600),
    coldRinseSeconds: clampRitualSeconds(stored.coldRinseSeconds, 20, 8, 45),
    selfcareItems: normalizeSelfcareItems(stored.selfcareItems),
  }
}

function clampRitualSeconds(raw: unknown, fallback: number, min: number, max: number): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : fallback
  return Math.min(max, Math.max(min, value))
}

export function emptyRitualProgress(today: string): MorningRitualProgress {
  return { date: today, done: [], selfcareChecked: [], pushups: 0, ko: 0 }
}

export function loadMorningRitualProgress(today: string): MorningRitualProgress {
  try {
    const stored = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null') as Partial<MorningRitualProgress> | null
    if (!stored || stored.date !== today) return emptyRitualProgress(today)
    return {
      date: today,
      done: Array.isArray(stored.done) ? stored.done.filter(isMorningRitualStepId) : [],
      selfcareChecked: Array.isArray(stored.selfcareChecked) ? stored.selfcareChecked.map(String) : [],
      pushups: clampRitualSeconds(stored.pushups, 0, 0, 400),
      ko: clampRitualSeconds(stored.ko, 0, 0, 200),
    }
  } catch {
    return emptyRitualProgress(today)
  }
}

export function saveMorningRitualProgress(progress: MorningRitualProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    /* ignore */
  }
}

export function markRitualStepDone(progress: MorningRitualProgress, id: MorningRitualStepId): MorningRitualProgress {
  if (progress.done.includes(id)) return progress
  const next = { ...progress, done: [...progress.done, id] }
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
  pushupsDone: boolean
  config: MorningRitualConfig
}): MorningRitualStepId | null {
  if (!input.enabled && !input.preview) return null
  if (input.skipped && !input.preview) return null

  for (const id of MORNING_RITUAL_STEP_IDS) {
    if (!input.preview && input.progress.done.includes(id)) continue
    if (input.preview) {
      /* preview walks every step in order via the UI index, not this helper */
    }
    switch (id) {
      case 'medsShake':
        if (input.preview) return id
        if (input.medications.some(item => !item.taken) || !input.proteinShake) return id
        break
      case 'gratitude':
        if (input.preview) return id
        if (!input.gratitudeDone) return id
        break
      case 'coldShower':
      case 'winnerPose':
      case 'prayer':
      case 'todos':
      case 'postShower':
      case 'selfcare':
      case 'letsGo':
        if (input.preview) return id
        if (!input.progress.done.includes(id)) return id
        break
      case 'energy':
        if (input.preview) return id
        if (!input.energySet) return id
        break
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
