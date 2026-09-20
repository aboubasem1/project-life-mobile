import type { DashboardEntry } from '../types/DashboardEntry.js'

export const BODY_MEASUREMENTS_KEY = 'life-os-v1-body-measurements'

export type BodyMeasurementSource = 'apple_health' | 'manual' | 'hook'

export type BodyMeasurement = {
  id: string
  measuredAt: string
  weightKg?: number
  bodyFatPercent?: number
  leanMassKg?: number
  muscleMassKg?: number
  boneMassKg?: number
  bodyWaterPercent?: number
  bmi?: number
  source: BodyMeasurementSource
  sourceDevice?: string
  sourceApp?: string
  externalId: string
}

export type HealthDailyPatch = {
  date: string
  weightKg?: number
  weightMeasuredAt?: string
  bodyFatPercent?: number
  steps?: number
}

export type HealthIngestState = {
  appliedSampleIds: string[]
}

export type ParsedHealthIngest = {
  measurements: BodyMeasurement[]
  dailyPatches: HealthDailyPatch[]
  sampleIds: string[]
}

const MAX_MEASUREMENTS = 400
const MAX_APPLIED_IDS = 4_000
const MAX_SAMPLES = 500

const WEIGHT_NAMES = new Set([
  'weight', 'body_mass', 'bodymass', 'weight_body_mass', 'body-mass',
])
const BODY_FAT_NAMES = new Set([
  'body_fat', 'bodyfat', 'body_fat_percentage', 'body-fat-percentage', 'bodyfatpercentage',
])
const LEAN_NAMES = new Set([
  'lean_mass', 'lean_body_mass', 'leanbodymass', 'lean-body-mass',
])
const MUSCLE_NAMES = new Set([
  'muscle_mass', 'musclemass', 'muscle_mass_kg',
])
const BONE_NAMES = new Set([
  'bone_mass', 'bonemass', 'bone_mass_kg',
])
const WATER_NAMES = new Set([
  'body_water', 'bodywater', 'body_water_percentage', 'body_water_percent',
])
const BMI_NAMES = new Set([
  'bmi', 'body_mass_index', 'bodymassindex',
])
const STEP_NAMES = new Set([
  'steps', 'step_count', 'stepcount',
])

type BodyField =
  | 'weightKg'
  | 'bodyFatPercent'
  | 'leanMassKg'
  | 'muscleMassKg'
  | 'boneMassKg'
  | 'bodyWaterPercent'
  | 'bmi'

type MetricKind = BodyField | 'steps'

type LooseSample = {
  externalId: string
  kind: MetricKind
  value: number
  measuredAt: string
  source?: string
  sourceApp?: string
  sourceDevice?: string
}

function finiteNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const value = Number(raw.replace(',', '.'))
    return Number.isFinite(value) ? value : null
  }
  return null
}

function slug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export function berlinDateFromIso(iso: string): string {
  const time = Date.parse(iso)
  const date = Number.isFinite(time) ? new Date(time) : new Date()
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function parseMeasuredAt(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T12:00:00+02:00`
  }

  const hae = value.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\s*([+-]\d{2}):?(\d{2}))?/,
  )
  if (hae) {
    const offset = hae[3] ? `${hae[3]}:${hae[4] ?? '00'}` : ''
    const iso = offset
      ? `${hae[1]}T${hae[2]}${offset}`
      : `${hae[1]}T${hae[2]}`
    const ms = Date.parse(iso)
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null
  }

  const ms = Date.parse(value)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

function metricName(raw: unknown): string {
  return slug(String(raw ?? ''))
}

function classifyMetric(name: string): MetricKind | null {
  if (WEIGHT_NAMES.has(name)) return 'weightKg'
  if (BODY_FAT_NAMES.has(name)) return 'bodyFatPercent'
  if (LEAN_NAMES.has(name)) return 'leanMassKg'
  if (MUSCLE_NAMES.has(name)) return 'muscleMassKg'
  if (BONE_NAMES.has(name)) return 'boneMassKg'
  if (WATER_NAMES.has(name)) return 'bodyWaterPercent'
  if (BMI_NAMES.has(name)) return 'bmi'
  if (STEP_NAMES.has(name)) return 'steps'
  return null
}

function convertValue(kind: MetricKind, value: number, unitRaw: unknown): number | null {
  const unit = slug(String(unitRaw ?? ''))
  if (kind === 'weightKg' || kind === 'leanMassKg' || kind === 'muscleMassKg' || kind === 'boneMassKg') {
    if (unit === 'lb' || unit === 'lbs' || unit === 'pound' || unit === 'pounds') {
      return Math.round(value * 0.45359237 * 100) / 100
    }
    return Math.round(value * 100) / 100
  }
  if (kind === 'bodyFatPercent' || kind === 'bodyWaterPercent') {
    const percent = value > 0 && value <= 1 && unit !== 'percent' && unit !== 'pct' ? value * 100 : value
    if (percent <= 0 || percent > 80) return null
    return Math.round(percent * 10) / 10
  }
  if (kind === 'bmi') {
    if (value <= 0 || value > 80) return null
    return Math.round(value * 10) / 10
  }
  if (kind === 'steps') {
    if (value < 0 || value > 200_000) return null
    return Math.round(value)
  }
  return value
}

function sourceText(raw: unknown): string | undefined {
  if (typeof raw === 'string' && raw.trim()) return raw.trim().slice(0, 80)
  if (raw && typeof raw === 'object') {
    const record = raw as { name?: unknown; bundleIdentifier?: unknown }
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    if (name) return name.slice(0, 80)
  }
  return undefined
}

function inferSourceApp(source?: string, explicit?: string): string | undefined {
  if (explicit?.trim()) return explicit.trim().slice(0, 80)
  if (!source) return undefined
  const lower = source.toLowerCase()
  if (lower.includes('fitdays')) return 'fitdays'
  if (lower.includes('health')) return 'apple_health'
  return source.slice(0, 80)
}

function inferSource(sourceApp?: string): BodyMeasurementSource {
  const value = (sourceApp ?? '').toLowerCase()
  if (value === 'manual' || value === 'checkin') return 'manual'
  if (value === 'hook' || value === 'shortcut') return 'hook'
  return 'apple_health'
}

function sampleQty(record: Record<string, unknown>): number | null {
  return finiteNumber(record.qty)
    ?? finiteNumber(record.value)
    ?? finiteNumber(record.Avg)
    ?? finiteNumber(record.avg)
    ?? finiteNumber(record.Max)
}

function recordDate(record: Record<string, unknown>): string | null {
  return parseMeasuredAt(record.date)
    ?? parseMeasuredAt(record.startDate)
    ?? parseMeasuredAt(record.start)
    ?? parseMeasuredAt(record.measuredAt)
    ?? parseMeasuredAt(record.endDate)
}

function pushSample(samples: LooseSample[], sample: LooseSample): void {
  if (samples.length >= MAX_SAMPLES) return
  samples.push(sample)
}

function collectFromSimple(record: Record<string, unknown>, samples: LooseSample[]): void {
  const kind = classifyMetric(metricName(record.metric ?? record.type ?? record.name))
  const measuredAt = recordDate(record)
  const qty = sampleQty(record)
  if (!kind || !measuredAt || qty === null) return
  const value = convertValue(kind, qty, record.unit ?? record.units)
  if (value === null) return
  const source = sourceText(record.source)
  const sourceApp = inferSourceApp(source, sourceText(record.sourceApp ?? record.source_app))
  const sourceDevice = sourceText(record.sourceDevice ?? record.source_device)
  const externalId = String(record.externalId ?? record.id ?? `${kind}:${measuredAt}:${value}:${source ?? ''}`)
  pushSample(samples, { externalId, kind, value, measuredAt, source, sourceApp, sourceDevice })
}

function collectFromHaeMetric(metric: Record<string, unknown>, samples: LooseSample[]): void {
  const kind = classifyMetric(metricName(metric.name ?? metric.metric ?? metric.type))
  if (!kind) return
  const units = metric.units ?? metric.unit
  const rows = Array.isArray(metric.data) ? metric.data : []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const record = row as Record<string, unknown>
    const measuredAt = recordDate(record)
    const qty = sampleQty(record)
    if (!measuredAt || qty === null) continue
    const value = convertValue(kind, qty, record.units ?? record.unit ?? units)
    if (value === null) continue
    const source = sourceText(record.source ?? metric.source)
    const sourceApp = inferSourceApp(source, sourceText(record.sourceApp))
    const sourceDevice = sourceText(record.sourceDevice)
    const externalId = String(record.id ?? record.uuid ?? `${kind}:${measuredAt}:${value}:${source ?? ''}`)
    pushSample(samples, { externalId, kind, value, measuredAt, source, sourceApp, sourceDevice })
  }
}

function collectFromMeasurementObject(record: Record<string, unknown>, samples: LooseSample[]): void {
  const measuredAt = recordDate(record)
  if (!measuredAt) return
  const source = sourceText(record.sourceDevice ?? record.source)
  const sourceApp = inferSourceApp(source, sourceText(record.sourceApp ?? record.source_app))
  const sourceDevice = sourceText(record.sourceDevice ?? record.source_device)
  const fields: Array<[BodyField, unknown]> = [
    ['weightKg', record.weightKg ?? record.weight],
    ['bodyFatPercent', record.bodyFatPercent ?? record.body_fat_percent],
    ['leanMassKg', record.leanMassKg ?? record.lean_mass_kg],
    ['muscleMassKg', record.muscleMassKg ?? record.muscle_mass_kg],
    ['boneMassKg', record.boneMassKg ?? record.bone_mass_kg],
    ['bodyWaterPercent', record.bodyWaterPercent ?? record.body_water_percent],
    ['bmi', record.bmi],
  ]
  for (const [kind, raw] of fields) {
    const qty = finiteNumber(raw)
    if (qty === null) continue
    const value = convertValue(kind, qty, record.unit)
    if (value === null) continue
    const externalId = String(record.externalId ?? record.id ?? `${kind}:${measuredAt}:${value}:${source ?? ''}`)
    pushSample(samples, { externalId, kind, value, measuredAt, source, sourceApp, sourceDevice })
  }
}

function collectSamples(body: unknown): LooseSample[] {
  const samples: LooseSample[] = []
  if (!body || typeof body !== 'object') return samples
  const root = body as Record<string, unknown>
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null

  const haeMetrics = [
    ...(Array.isArray(root.metrics) ? root.metrics : []),
    ...(Array.isArray(data?.metrics) ? data.metrics : []),
  ]
  for (const metric of haeMetrics) {
    if (metric && typeof metric === 'object') collectFromHaeMetric(metric as Record<string, unknown>, samples)
  }

  const measurementRows = [
    ...(Array.isArray(root.measurements) ? root.measurements : []),
    ...(Array.isArray(root.samples) ? root.samples : []),
  ]
  for (const row of measurementRows) {
    if (!row || typeof row !== 'object') continue
    const record = row as Record<string, unknown>
    if (record.metric != null || record.type != null || record.qty != null) {
      collectFromSimple(record, samples)
    } else {
      collectFromMeasurementObject(record, samples)
    }
  }

  if (root.metric != null || root.type != null || root.value != null || root.qty != null) {
    collectFromSimple(root, samples)
  }
  if (root.weightKg != null || root.bodyFatPercent != null) {
    collectFromMeasurementObject(root, samples)
  }

  return samples
}

function minuteKey(iso: string): string {
  return iso.slice(0, 16)
}

function groupMeasurements(samples: LooseSample[]): BodyMeasurement[] {
  const groups = new Map<string, BodyMeasurement>()
  for (const sample of samples) {
    if (sample.kind === 'steps') continue
    const sourceKey = slug(sample.sourceApp ?? sample.source ?? 'apple_health')
    const key = `${minuteKey(sample.measuredAt)}:${sourceKey}`
    const existing = groups.get(key) ?? {
      id: `body:${key}`,
      measuredAt: sample.measuredAt,
      source: inferSource(sample.sourceApp),
      sourceApp: sample.sourceApp,
      sourceDevice: sample.sourceDevice ?? sample.source,
      externalId: `body:${key}`,
    }
    if (sample.measuredAt > existing.measuredAt) existing.measuredAt = sample.measuredAt
    existing[sample.kind] = sample.value
    if (!existing.sourceApp && sample.sourceApp) existing.sourceApp = sample.sourceApp
    if (!existing.sourceDevice && (sample.sourceDevice || sample.source)) {
      existing.sourceDevice = sample.sourceDevice ?? sample.source
    }
    groups.set(key, existing)
  }
  return [...groups.values()]
}

function groupDailyPatches(samples: LooseSample[]): HealthDailyPatch[] {
  const byDate = new Map<string, HealthDailyPatch>()
  for (const sample of samples) {
    const date = berlinDateFromIso(sample.measuredAt)
    const current = byDate.get(date) ?? { date }
    if (sample.kind === 'weightKg') {
      if (!current.weightMeasuredAt || sample.measuredAt >= current.weightMeasuredAt) {
        current.weightKg = sample.value
        current.weightMeasuredAt = sample.measuredAt
      }
    } else if (sample.kind === 'bodyFatPercent') {
      if (!current.weightMeasuredAt || sample.measuredAt >= (current.weightMeasuredAt ?? '')) {
        current.bodyFatPercent = sample.value
      }
    } else if (sample.kind === 'steps') {
      current.steps = Math.max(current.steps ?? 0, sample.value)
    }
    byDate.set(date, current)
  }
  return [...byDate.values()]
}

export function parseHealthIngestBody(body: unknown): ParsedHealthIngest {
  const samples = collectSamples(body)
  return {
    measurements: groupMeasurements(samples),
    dailyPatches: groupDailyPatches(samples),
    sampleIds: samples.map(sample => sample.externalId),
  }
}

export function normalizeBodyMeasurement(raw: unknown): BodyMeasurement | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const measuredAt = parseMeasuredAt(record.measuredAt)
  if (!measuredAt) return null
  const externalId = String(record.externalId ?? record.id ?? '').trim()
  if (!externalId) return null
  const source: BodyMeasurementSource = record.source === 'manual' || record.source === 'hook' || record.source === 'apple_health'
    ? record.source
    : 'apple_health'
  const pick = (key: keyof BodyMeasurement): number | undefined => {
    const value = finiteNumber(record[key])
    return value === null ? undefined : value
  }
  return {
    id: String(record.id ?? externalId),
    measuredAt,
    weightKg: pick('weightKg'),
    bodyFatPercent: pick('bodyFatPercent'),
    leanMassKg: pick('leanMassKg'),
    muscleMassKg: pick('muscleMassKg'),
    boneMassKg: pick('boneMassKg'),
    bodyWaterPercent: pick('bodyWaterPercent'),
    bmi: pick('bmi'),
    source,
    sourceDevice: sourceText(record.sourceDevice),
    sourceApp: sourceText(record.sourceApp),
    externalId,
  }
}

export function normalizeBodyMeasurements(raw: unknown): BodyMeasurement[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(normalizeBodyMeasurement)
    .filter((item): item is BodyMeasurement => item !== null)
}

export function mergeBodyMeasurements(
  current: BodyMeasurement[],
  incoming: BodyMeasurement[],
): BodyMeasurement[] {
  const map = new Map<string, BodyMeasurement>()
  for (const item of [...current, ...incoming]) {
    const key = item.externalId || item.id
    const existing = map.get(key)
    if (!existing) {
      map.set(key, item)
      continue
    }
    const newer = item.measuredAt >= existing.measuredAt ? item : existing
    const older = newer === item ? existing : item
    map.set(key, {
      ...older,
      ...newer,
      weightKg: newer.weightKg ?? older.weightKg,
      bodyFatPercent: newer.bodyFatPercent ?? older.bodyFatPercent,
      leanMassKg: newer.leanMassKg ?? older.leanMassKg,
      muscleMassKg: newer.muscleMassKg ?? older.muscleMassKg,
      boneMassKg: newer.boneMassKg ?? older.boneMassKg,
      bodyWaterPercent: newer.bodyWaterPercent ?? older.bodyWaterPercent,
      bmi: newer.bmi ?? older.bmi,
      sourceDevice: newer.sourceDevice ?? older.sourceDevice,
      sourceApp: newer.sourceApp ?? older.sourceApp,
    })
  }
  return [...map.values()]
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
    .slice(-MAX_MEASUREMENTS)
}

export function normalizeHealthIngestState(raw: unknown): HealthIngestState {
  if (!raw || typeof raw !== 'object') return { appliedSampleIds: [] }
  const record = raw as { appliedSampleIds?: unknown }
  const ids = Array.isArray(record.appliedSampleIds)
    ? record.appliedSampleIds.map(item => String(item)).filter(Boolean)
    : []
  return { appliedSampleIds: ids.slice(-MAX_APPLIED_IDS) }
}

export function mergeHealthIngestState(
  current: unknown,
  incoming: unknown,
): HealthIngestState {
  const left = normalizeHealthIngestState(current)
  const right = normalizeHealthIngestState(incoming)
  return {
    appliedSampleIds: [...new Set([...left.appliedSampleIds, ...right.appliedSampleIds])].slice(-MAX_APPLIED_IDS),
  }
}

export function filterNewSampleIds(existing: HealthIngestState, incoming: string[]): {
  fresh: string[]
  skipped: number
  next: HealthIngestState
} {
  const seen = new Set(existing.appliedSampleIds)
  const fresh: string[] = []
  let skipped = 0
  for (const id of incoming) {
    if (seen.has(id)) {
      skipped += 1
      continue
    }
    seen.add(id)
    fresh.push(id)
  }
  return {
    fresh,
    skipped,
    next: { appliedSampleIds: [...seen].slice(-MAX_APPLIED_IDS) },
  }
}

type MemoryStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function browserStorage(): MemoryStorage | null {
  const candidate = (globalThis as { localStorage?: MemoryStorage }).localStorage
  return candidate ?? null
}

function safeGet(key: string): string | null {
  try {
    return browserStorage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    const storage = browserStorage()
    if (!storage) return false
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function loadBodyMeasurements(): BodyMeasurement[] {
  try {
    return normalizeBodyMeasurements(JSON.parse(safeGet(BODY_MEASUREMENTS_KEY) ?? '[]'))
  } catch {
    return []
  }
}

export function saveBodyMeasurements(items: BodyMeasurement[]): boolean {
  return safeSet(BODY_MEASUREMENTS_KEY, JSON.stringify(mergeBodyMeasurements([], items)))
}

export function mergeSavedBodyMeasurements(incoming: BodyMeasurement[]): BodyMeasurement[] {
  const merged = mergeBodyMeasurements(loadBodyMeasurements(), incoming)
  saveBodyMeasurements(merged)
  return merged
}

export type DailyWeightPoint = {
  date: string
  kg: number
  measuredAt: string
  bodyFatPercent: number | null
  sourceApp: string | null
}

export function buildDailyWeightPoints(
  entries: DashboardEntry[],
  measurements: BodyMeasurement[] = [],
): DailyWeightPoint[] {
  const byDate = new Map<string, DailyWeightPoint>()
  for (const entry of entries) {
    if (entry.weightKg > 0) {
      byDate.set(entry.date, {
        date: entry.date,
        kg: entry.weightKg,
        measuredAt: entry.weightMeasuredAt || '',
        bodyFatPercent: entry.bodyFatPercent && entry.bodyFatPercent > 0 ? entry.bodyFatPercent : null,
        sourceApp: null,
      })
    }
  }
  for (const item of measurements) {
    if (!item.weightKg || item.weightKg <= 0) continue
    const date = berlinDateFromIso(item.measuredAt)
    const current = byDate.get(date)
    if (!current || item.measuredAt >= current.measuredAt) {
      byDate.set(date, {
        date,
        kg: item.weightKg,
        measuredAt: item.measuredAt,
        bodyFatPercent: item.bodyFatPercent ?? current?.bodyFatPercent ?? null,
        sourceApp: item.sourceApp ?? current?.sourceApp ?? null,
      })
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function offsetDate(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00`)
  next.setDate(next.getDate() + days)
  const year = next.getFullYear()
  const month = String(next.getMonth() + 1).padStart(2, '0')
  const day = String(next.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function deltaAgainst(
  points: DailyWeightPoint[],
  latest: DailyWeightPoint,
  days: number,
): number | null {
  const cutoff = offsetDate(latest.date, -days)
  const baseline = [...points].reverse().find(point => point.date <= cutoff && point.date < latest.date)
  if (!baseline) return null
  return Math.round((latest.kg - baseline.kg) * 10) / 10
}

export type WeightDailyStat = {
  kg: number | null
  date: string | null
  measuredAt: string | null
  isCarriedForward: boolean
  comparedToYesterday: boolean
  deltaYesterday: number | null
  delta7: number | null
  delta30: number | null
  bodyFatPercent: number | null
  goalKg: number | null
  startKg: number | null
  progressKg: number | null
  spanKg: number | null
  sourceApp: string | null
}

export function buildWeightDailyStat(
  points: DailyWeightPoint[],
  date: string,
  today: string,
  goalKg = 0,
  startKg = 0,
): WeightDailyStat {
  const empty: WeightDailyStat = {
    kg: null,
    date: null,
    measuredAt: null,
    isCarriedForward: false,
    comparedToYesterday: false,
    deltaYesterday: null,
    delta7: null,
    delta30: null,
    bodyFatPercent: null,
    goalKg: goalKg > 0 ? goalKg : null,
    startKg: startKg > 0 ? startKg : null,
    progressKg: null,
    spanKg: null,
    sourceApp: null,
  }
  if (points.length === 0) return empty

  const exact = points.find(point => point.date === date)
  const lastKnown = [...points].reverse().find(point => point.date <= date) ?? null
  const selected = exact ?? (date === today ? lastKnown : null)
  if (!selected) return empty

  const previous = [...points].reverse().find(point => point.date < selected.date) ?? null
  const yesterday = points.find(point => point.date === offsetDate(selected.date, -1)) ?? null
  const resolvedStart = startKg > 0 ? startKg : points[0]?.kg ?? null
  const resolvedGoal = goalKg > 0 ? goalKg : null
  let progressKg: number | null = null
  let spanKg: number | null = null
  if (resolvedStart !== null && resolvedGoal !== null && resolvedStart !== resolvedGoal) {
    progressKg = Math.round((selected.kg - resolvedStart) * 10) / 10
    spanKg = Math.round((resolvedGoal - resolvedStart) * 10) / 10
  }

  return {
    kg: selected.kg,
    date: selected.date,
    measuredAt: selected.measuredAt,
    isCarriedForward: !exact && date === today,
    comparedToYesterday: Boolean(yesterday),
    deltaYesterday: yesterday
      ? Math.round((selected.kg - yesterday.kg) * 10) / 10
      : previous
        ? Math.round((selected.kg - previous.kg) * 10) / 10
        : null,
    delta7: deltaAgainst(points, selected, 7),
    delta30: deltaAgainst(points, selected, 30),
    bodyFatPercent: selected.bodyFatPercent,
    goalKg: resolvedGoal,
    startKg: resolvedStart,
    progressKg,
    spanKg,
    sourceApp: selected.sourceApp,
  }
}

export function formatKgDelta(value: number | null): string {
  if (value === null) return '—'
  if (value === 0) return '±0 kg'
  const abs = Math.abs(value).toFixed(1)
  return `${value > 0 ? '↑ +' : '↓ −'}${abs} kg`
}

export function formatClock(iso: string | null): string | null {
  if (!iso) return null
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return null
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time))
}
