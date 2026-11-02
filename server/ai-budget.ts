import { randomUUID } from 'node:crypto'
import { databaseConfigured, databaseTransaction, type SqlQuery } from './database.js'
import { SyncHttpError } from './http-error.js'

/** Calendar month key in Europe/Berlin (YYYY-MM). */
export function berlinPeriodYm(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
  }).format(at)
}

function envNumber(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name])
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export type AiBudgetStep =
  | 'transcription'
  | 'vision'
  | 'ocr'
  | 'analysis'
  | 'embedding'
  | 'translation'
  | 'quiz'
  | 'jo'
  | 'factcheck'
  | 'other'

export type AiBudgetKind = 'background' | 'interactive' | 'enrichment'

export type BudgetThresholds = {
  limitEur: number
  warnEur: number
  enrichmentPauseEur: number
  backgroundPauseEur: number
  hardStopEur: number
}

export type BudgetAssumptions = {
  fxUsdEur: number
  fxDated: string
  taxFactor: number
  safetyFactor: number
  priceVersion: string
  note: string
}

export type BudgetSnapshot = {
  periodYm: string
  limitEur: number
  spentEur: number
  reservedEur: number
  remainingEur: number
  byStep: Record<string, { spentEur: number; reservedEur: number }>
  enrichmentPaused: boolean
  backgroundPaused: boolean
  allPaused: boolean
  warn: boolean
  assumptions: BudgetAssumptions
  queueResume: 'manual' | 'auto_next_month'
}

export type ReserveInput = {
  roomId: string
  step: AiBudgetStep
  kind: AiBudgetKind
  provider: string
  model: string
  estimatedUsd: number
  jobId?: string | null
  reelId?: string | null
  userRef?: string | null
  audioMs?: number | null
  inputTokens?: number | null
  outputTokens?: number | null
  meta?: Record<string, unknown>
}

export type Reservation = {
  id: string
  periodYm: string
  reservedEur: number
  assumptions: BudgetAssumptions
}

function readAssumptions(): BudgetAssumptions {
  const fxUsdEur = envNumber('AI_BUDGET_USD_EUR', 0.95, 0.5, 2)
  const taxFactor = envNumber('AI_BUDGET_TAX_FACTOR', 1.19, 1, 1.5)
  const safetyFactor = envNumber('AI_BUDGET_SAFETY_FACTOR', 1.25, 1, 3)
  return {
    fxUsdEur,
    fxDated: process.env.AI_BUDGET_FX_DATED?.trim() || '2026-03-01-manual',
    taxFactor,
    safetyFactor,
    priceVersion: process.env.AI_BUDGET_PRICE_VERSION?.trim() || 'deepinfra-2026-03-verified',
    note: 'USD→EUR mit Steuerfaktor und Sicherheitsaufschlag. Keine USD=EUR-Gleichsetzung.',
  }
}

export function budgetThresholds(): BudgetThresholds {
  const limitEur = envNumber('AI_BUDGET_MONTHLY_EUR', 20, 1, 500)
  return {
    limitEur,
    warnEur: envNumber('AI_BUDGET_WARN_EUR', Math.min(10, limitEur * 0.5), 0, limitEur),
    enrichmentPauseEur: envNumber('AI_BUDGET_ENRICHMENT_PAUSE_EUR', Math.min(15, limitEur * 0.75), 0, limitEur),
    backgroundPauseEur: envNumber('AI_BUDGET_BACKGROUND_PAUSE_EUR', Math.min(18, limitEur * 0.9), 0, limitEur),
    hardStopEur: limitEur,
  }
}

/** Convert provider USD cost into conservative EUR including tax + safety. */
export function usdToBudgetEur(usd: number, assumptions = readAssumptions()): number {
  const safeUsd = Math.max(0, Number.isFinite(usd) ? usd : 0)
  return Number((safeUsd * assumptions.fxUsdEur * assumptions.taxFactor * assumptions.safetyFactor).toFixed(6))
}

export function isBudgetPauseError(error: unknown): boolean {
  return error instanceof SyncHttpError && error.status === 402
}

export class BudgetPausedError extends SyncHttpError {
  readonly pauseLevel: 'enrichment' | 'background' | 'all'
  constructor(pauseLevel: 'enrichment' | 'background' | 'all', message?: string) {
    super(402, message || (
      pauseLevel === 'all'
        ? 'KI-Budget für diesen Monat ist aufgebraucht.'
        : pauseLevel === 'background'
          ? 'KI-Budget pausiert Hintergrundjobs. Restbudget bleibt für interaktive Nutzung.'
          : 'KI-Budget pausiert optionale Anreicherungen (Vision/Embeddings).'
    ))
    this.pauseLevel = pauseLevel
  }
}

async function ensurePeriod(query: SqlQuery, periodYm: string, assumptions: BudgetAssumptions): Promise<void> {
  const thresholds = budgetThresholds()
  await query(`
    INSERT INTO lifeos_ai_budget_periods (
      period_ym, limit_eur, spent_eur, reserved_eur, assumptions, queue_resume, updated_at
    ) VALUES ($1, $2, 0, 0, $3::jsonb, $4, now())
    ON CONFLICT (period_ym) DO NOTHING
  `, [
    periodYm,
    thresholds.limitEur,
    JSON.stringify(assumptions),
    process.env.AI_BUDGET_QUEUE_RESUME?.trim() === 'auto_next_month' ? 'auto_next_month' : 'manual',
  ])
}

function flagsFor(spent: number, reserved: number, thresholds: BudgetThresholds) {
  const committed = spent + reserved
  return {
    warn: committed >= thresholds.warnEur,
    enrichmentPaused: committed >= thresholds.enrichmentPauseEur,
    backgroundPaused: committed >= thresholds.backgroundPauseEur,
    allPaused: committed >= thresholds.hardStopEur,
  }
}

export async function getBudgetSnapshot(at: Date = new Date()): Promise<BudgetSnapshot | null> {
  if (!databaseConfigured()) return null
  const periodYm = berlinPeriodYm(at)
  const assumptions = readAssumptions()
  const thresholds = budgetThresholds()
  return databaseTransaction(async query => {
    await ensurePeriod(query, periodYm, assumptions)
    const period = await query<{
      limit_eur: string
      spent_eur: string
      reserved_eur: string
      queue_resume: string
      assumptions: unknown
    }>(`
      SELECT limit_eur, spent_eur, reserved_eur, queue_resume, assumptions
      FROM lifeos_ai_budget_periods
      WHERE period_ym = $1
      FOR UPDATE
    `, [periodYm])
    const row = period.rows[0]
    const spentEur = Number(row?.spent_eur || 0)
    const reservedEur = Number(row?.reserved_eur || 0)
    const limitEur = Number(row?.limit_eur || thresholds.limitEur)
    const byStepRows = await query<{ step: string; spent: string; reserved: string }>(`
      SELECT step,
        COALESCE(SUM(CASE WHEN status IN ('settled', 'uncertain') THEN settled_eur ELSE 0 END), 0)::text AS spent,
        COALESCE(SUM(CASE WHEN status = 'reserved' THEN reserved_eur ELSE 0 END), 0)::text AS reserved
      FROM lifeos_ai_spend
      WHERE period_ym = $1
      GROUP BY step
    `, [periodYm])
    const byStep: BudgetSnapshot['byStep'] = {}
    for (const entry of byStepRows.rows) {
      byStep[entry.step] = { spentEur: Number(entry.spent), reservedEur: Number(entry.reserved) }
    }
    const flags = flagsFor(spentEur, reservedEur, { ...thresholds, limitEur, hardStopEur: limitEur })
    return {
      periodYm,
      limitEur,
      spentEur,
      reservedEur,
      remainingEur: Math.max(0, Number((limitEur - spentEur - reservedEur).toFixed(6))),
      byStep,
      ...flags,
      assumptions: {
        ...assumptions,
        ...(row?.assumptions && typeof row.assumptions === 'object' ? row.assumptions as BudgetAssumptions : {}),
      },
      queueResume: row?.queue_resume === 'auto_next_month' ? 'auto_next_month' : 'manual',
    }
  })
}

/** Atomically reserve budget before a billable call. Throws BudgetPausedError when blocked. */
export async function reserveBudget(input: ReserveInput): Promise<Reservation> {
  if (!databaseConfigured()) {
    throw new SyncHttpError(503, 'Budgetkontrolle benötigt PostgreSQL.')
  }
  if (!(input.estimatedUsd > 0) || !Number.isFinite(input.estimatedUsd)) {
    throw new SyncHttpError(400, 'Kostenobergrenze für den Aufruf ist unklar — Aufruf abgebrochen.')
  }
  const periodYm = berlinPeriodYm()
  const assumptions = readAssumptions()
  const thresholds = budgetThresholds()
  const reservedEur = usdToBudgetEur(input.estimatedUsd, assumptions)
  if (!(reservedEur > 0)) {
    throw new SyncHttpError(400, 'Kostenobergrenze für den Aufruf ist unklar — Aufruf abgebrochen.')
  }

  return databaseTransaction(async query => {
    await ensurePeriod(query, periodYm, assumptions)
    const locked = await query<{ spent_eur: string; reserved_eur: string; limit_eur: string }>(`
      SELECT spent_eur, reserved_eur, limit_eur
      FROM lifeos_ai_budget_periods
      WHERE period_ym = $1
      FOR UPDATE
    `, [periodYm])
    const spent = Number(locked.rows[0]?.spent_eur || 0)
    const reserved = Number(locked.rows[0]?.reserved_eur || 0)
    const limit = Number(locked.rows[0]?.limit_eur || thresholds.limitEur)
    const after = spent + reserved + reservedEur
    const flags = flagsFor(spent, reserved, { ...thresholds, limitEur: limit, hardStopEur: limit })

    if (flags.allPaused || after > limit + 1e-9) {
      throw new BudgetPausedError('all')
    }
    if (input.kind === 'background' && (flags.backgroundPaused || after >= thresholds.backgroundPauseEur)) {
      throw new BudgetPausedError('background')
    }
    if (input.kind === 'enrichment' && (flags.enrichmentPaused || after >= thresholds.enrichmentPauseEur)) {
      throw new BudgetPausedError('enrichment')
    }

    const id = randomUUID()
    await query(`
      INSERT INTO lifeos_ai_spend (
        id, period_ym, room_id, user_ref, job_id, reel_id, step, kind, provider, model,
        status, reserved_eur, settled_eur, cost_usd, cost_source, price_version,
        fx_usd_eur, fx_dated, tax_factor, safety_factor, input_tokens, output_tokens, audio_ms, meta
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        'reserved',$11,0,NULL,'estimate',$12,
        $13,$14,$15,$16,$17,$18,$19,$20::jsonb
      )
    `, [
      id, periodYm, input.roomId, input.userRef || null, input.jobId || null, input.reelId || null,
      input.step, input.kind, input.provider, input.model,
      reservedEur, assumptions.priceVersion,
      assumptions.fxUsdEur, assumptions.fxDated, assumptions.taxFactor, assumptions.safetyFactor,
      input.inputTokens ?? null, input.outputTokens ?? null, input.audioMs ?? null,
      JSON.stringify(input.meta || {}),
    ])
    await query(`
      UPDATE lifeos_ai_budget_periods
      SET reserved_eur = reserved_eur + $2, updated_at = now(), assumptions = $3::jsonb
      WHERE period_ym = $1
    `, [periodYm, reservedEur, JSON.stringify(assumptions)])
    return { id, periodYm, reservedEur, assumptions }
  })
}

export async function settleReservation(input: {
  reservationId: string
  actualUsd?: number | null
  requestId?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  audioMs?: number | null
  uncertain?: boolean
}): Promise<void> {
  if (!databaseConfigured()) return
  await databaseTransaction(async query => {
    const existing = await query<{
      period_ym: string
      reserved_eur: string
      status: string
      fx_usd_eur: string
      tax_factor: string
      safety_factor: string
    }>(`
      SELECT period_ym, reserved_eur, status, fx_usd_eur, tax_factor, safety_factor
      FROM lifeos_ai_spend
      WHERE id = $1
      FOR UPDATE
    `, [input.reservationId])
    const row = existing.rows[0]
    if (!row || row.status !== 'reserved') return

    await query(`SELECT period_ym FROM lifeos_ai_budget_periods WHERE period_ym = $1 FOR UPDATE`, [row.period_ym])

    const reservedEur = Number(row.reserved_eur)
    const assumptions: BudgetAssumptions = {
      ...readAssumptions(),
      fxUsdEur: Number(row.fx_usd_eur),
      taxFactor: Number(row.tax_factor),
      safetyFactor: Number(row.safety_factor),
    }

    if (input.uncertain) {
      // Keep the reserved amount as conservative spent — do not free on unclear timeout.
      await query(`
        UPDATE lifeos_ai_spend
        SET status = 'uncertain',
          settled_eur = reserved_eur,
          cost_source = 'uncertain_estimate',
          request_id = COALESCE($2, request_id),
          updated_at = now()
        WHERE id = $1
      `, [input.reservationId, input.requestId || null])
      await query(`
        UPDATE lifeos_ai_budget_periods
        SET reserved_eur = GREATEST(0, reserved_eur - $2),
          spent_eur = spent_eur + $2,
          updated_at = now()
        WHERE period_ym = $1
      `, [row.period_ym, reservedEur])
      return
    }

    const actualUsd = input.actualUsd != null && Number.isFinite(input.actualUsd) ? Math.max(0, input.actualUsd) : null
    const settledEur = actualUsd == null
      ? reservedEur
      : Math.min(reservedEur, usdToBudgetEur(actualUsd, assumptions))
    const costSource = actualUsd == null ? 'estimate' : 'reported'

    await query(`
      UPDATE lifeos_ai_spend
      SET status = 'settled',
        settled_eur = $2,
        cost_usd = $3,
        cost_source = $4,
        request_id = COALESCE($5, request_id),
        input_tokens = COALESCE($6, input_tokens),
        output_tokens = COALESCE($7, output_tokens),
        audio_ms = COALESCE($8, audio_ms),
        updated_at = now()
      WHERE id = $1
    `, [
      input.reservationId,
      settledEur,
      actualUsd,
      costSource,
      input.requestId || null,
      input.inputTokens ?? null,
      input.outputTokens ?? null,
      input.audioMs ?? null,
    ])
    await query(`
      UPDATE lifeos_ai_budget_periods
      SET reserved_eur = GREATEST(0, reserved_eur - $2),
        spent_eur = spent_eur + $3,
        updated_at = now()
      WHERE period_ym = $1
    `, [row.period_ym, reservedEur, settledEur])
  })
}

/** Release a reservation that never reached the provider (preflight cancel). */
export async function releaseReservation(reservationId: string): Promise<void> {
  if (!databaseConfigured()) return
  await databaseTransaction(async query => {
    const existing = await query<{ period_ym: string; reserved_eur: string; status: string }>(`
      SELECT period_ym, reserved_eur, status FROM lifeos_ai_spend WHERE id = $1 FOR UPDATE
    `, [reservationId])
    const row = existing.rows[0]
    if (!row || row.status !== 'reserved') return
    const reservedEur = Number(row.reserved_eur)
    await query(`SELECT period_ym FROM lifeos_ai_budget_periods WHERE period_ym = $1 FOR UPDATE`, [row.period_ym])
    await query(`UPDATE lifeos_ai_spend SET status = 'released', settled_eur = 0, updated_at = now() WHERE id = $1`, [reservationId])
    await query(`
      UPDATE lifeos_ai_budget_periods
      SET reserved_eur = GREATEST(0, reserved_eur - $2), updated_at = now()
      WHERE period_ym = $1
    `, [row.period_ym, reservedEur])
  })
}

export async function assertBackgroundBudgetAvailable(): Promise<void> {
  const snap = await getBudgetSnapshot()
  if (!snap) return
  if (snap.allPaused) throw new BudgetPausedError('all')
  if (snap.backgroundPaused) throw new BudgetPausedError('background')
}

export function publicBudgetView(snapshot: BudgetSnapshot) {
  return {
    periodYm: snapshot.periodYm,
    limitEur: snapshot.limitEur,
    spentEur: Number(snapshot.spentEur.toFixed(4)),
    reservedEur: Number(snapshot.reservedEur.toFixed(4)),
    remainingEur: Number(snapshot.remainingEur.toFixed(4)),
    byStep: snapshot.byStep,
    enrichmentPaused: snapshot.enrichmentPaused,
    backgroundPaused: snapshot.backgroundPaused,
    allPaused: snapshot.allPaused,
    warn: snapshot.warn,
    queueResume: snapshot.queueResume,
    assumptions: {
      fxUsdEur: snapshot.assumptions.fxUsdEur,
      fxDated: snapshot.assumptions.fxDated,
      taxFactor: snapshot.assumptions.taxFactor,
      safetyFactor: snapshot.assumptions.safetyFactor,
      priceVersion: snapshot.assumptions.priceVersion,
      note: snapshot.assumptions.note,
    },
    deepinfraExternalLimitNote:
      'DeepInfra-Key-Limit unter Dashboard → API Keys / payment/key-limits setzen. LifeOS kann Ausgaben fremder Programme mit demselben Key nicht begrenzen — separaten Key für LifeOS verwenden.',
  }
}
