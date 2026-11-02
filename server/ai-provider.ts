import {
  BudgetPausedError,
  releaseReservation,
  reserveBudget,
  settleReservation,
  usdToBudgetEur,
  type AiBudgetKind,
  type AiBudgetStep,
  type Reservation,
} from './ai-budget.js'
import { SyncHttpError } from './http-error.js'

/** Verified DeepInfra model IDs + USD list prices (standard tier), checked 2026-03 against deepinfra.com. */
export const DEEPINFRA_MODELS = {
  whisper: 'openai/whisper-large-v3-turbo',
  text: 'deepseek-ai/DeepSeek-V4-Flash-0731',
  vision: 'Qwen/Qwen3-VL-235B-A22B-Instruct',
  embedding: 'BAAI/bge-m3',
} as const

/** USD prices used for conservative pre-call estimates (standard tier). */
export const DEEPINFRA_USD_PRICES = {
  whisperPerMinute: 0.0002,
  textInputPerMTok: 0.06,
  textOutputPerMTok: 0.18,
  visionInputPerMTok: 0.2,
  visionOutputPerMTok: 0.88,
  embeddingPerMTok: 0.01,
} as const

const CHAT_URL = 'https://api.deepinfra.com/v1/openai/chat/completions'
const EMBED_URL = 'https://api.deepinfra.com/v1/openai/embeddings'

function readEnv(name: string): string {
  return process.env[name]?.trim().replace(/^['"]|['"]$/g, '').trim() ?? ''
}

function isOff(value: string): boolean {
  const normalized = value.toLowerCase()
  return normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no'
}

export function deepinfraConfig() {
  const apiKey = readEnv('DEEPINFRA_API_KEY')
  return {
    apiKey,
    enabled: Boolean(apiKey) && !isOff(readEnv('DEEPINFRA_ENABLED') || 'true'),
    textModel: readEnv('DEEPINFRA_TEXT_MODEL') || DEEPINFRA_MODELS.text,
    visionModel: readEnv('DEEPINFRA_VISION_MODEL') || DEEPINFRA_MODELS.vision,
    embeddingModel: readEnv('DEEPINFRA_EMBEDDING_MODEL') || DEEPINFRA_MODELS.embedding,
    whisperModel: readEnv('DEEPINFRA_TRANSCRIPTION_MODEL') || DEEPINFRA_MODELS.whisper,
    timeoutMs: Math.min(300_000, Math.max(5_000, Number(readEnv('DEEPINFRA_TIMEOUT_MS')) || 120_000)),
  }
}

export function openaiFallbackConfigured(): boolean {
  return Boolean(readEnv('OPENAI_API_KEY') || readEnv('LLM_API_KEY'))
}

export function estimateWhisperUsd(audioMs: number): number {
  const minutes = Math.max(0.05, (Math.max(0, audioMs) / 60_000) * 1.15)
  return minutes * DEEPINFRA_USD_PRICES.whisperPerMinute
}

export function estimateChatUsd(input: {
  inputTokens: number
  maxOutputTokens: number
  modality: 'text' | 'vision'
}): number {
  const prices = input.modality === 'vision'
    ? { in: DEEPINFRA_USD_PRICES.visionInputPerMTok, out: DEEPINFRA_USD_PRICES.visionOutputPerMTok }
    : { in: DEEPINFRA_USD_PRICES.textInputPerMTok, out: DEEPINFRA_USD_PRICES.textOutputPerMTok }
  return (input.inputTokens / 1_000_000) * prices.in + (input.maxOutputTokens / 1_000_000) * prices.out
}

export function estimateEmbeddingUsd(inputTokens: number): number {
  return (Math.max(0, inputTokens) / 1_000_000) * DEEPINFRA_USD_PRICES.embeddingPerMTok
}

/** Rough token estimate for Latin/Cyrillic-ish text (~4 chars/token). */
export function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

/** Conservative image token estimate for VL calls (low-detail JPEG frames). */
export function estimateImageTokens(frameCount: number): number {
  return Math.max(0, frameCount) * 1200
}

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<Record<string, unknown>>
}

export type BudgetedCallContext = {
  roomId: string
  step: AiBudgetStep
  kind: AiBudgetKind
  jobId?: string | null
  reelId?: string | null
  userRef?: string | null
}

export type ChatCompletionResult = {
  content: string
  provider: 'deepinfra' | 'openai'
  model: string
  requestId?: string
  costUsd?: number
  costSource: 'reported' | 'estimate'
  inputTokens?: number
  outputTokens?: number
  reservationId?: string
}

async function withReservation<T>(input: {
  ctx: BudgetedCallContext
  provider: string
  model: string
  estimatedUsd: number
  audioMs?: number
  inputTokens?: number
  outputTokens?: number
  run: (reservation: Reservation) => Promise<{
    value: T
    actualUsd?: number | null
    requestId?: string | null
    inputTokens?: number | null
    outputTokens?: number | null
    uncertain?: boolean
  }>
}): Promise<T> {
  let reservation: Reservation
  try {
    reservation = await reserveBudget({
      roomId: input.ctx.roomId,
      step: input.ctx.step,
      kind: input.ctx.kind,
      provider: input.provider,
      model: input.model,
      estimatedUsd: input.estimatedUsd,
      jobId: input.ctx.jobId,
      reelId: input.ctx.reelId,
      userRef: input.ctx.userRef,
      audioMs: input.audioMs,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
    })
  } catch (error) {
    if (error instanceof BudgetPausedError) throw error
    throw error
  }

  try {
    const result = await input.run(reservation)
    await settleReservation({
      reservationId: reservation.id,
      actualUsd: result.actualUsd,
      requestId: result.requestId,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      uncertain: result.uncertain,
    })
    return result.value
  } catch (error) {
    const timedOut = error instanceof SyncHttpError && error.status === 504
    const networkish = error instanceof TypeError || (error instanceof Error && /fetch|network|ECONN|ETIMEDOUT/i.test(error.message))
    if (timedOut || networkish) {
      await settleReservation({ reservationId: reservation.id, uncertain: true })
    } else {
      await releaseReservation(reservation.id)
    }
    throw error
  }
}

function parseUsageCost(payload: unknown): {
  requestId?: string
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
} {
  if (!payload || typeof payload !== 'object') return {}
  const row = payload as {
    id?: unknown
    usage?: {
      prompt_tokens?: unknown
      completion_tokens?: unknown
      total_tokens?: unknown
      estimated_cost?: unknown
    }
  }
  const usage = row.usage || {}
  return {
    requestId: typeof row.id === 'string' ? row.id : undefined,
    inputTokens: Number.isFinite(Number(usage.prompt_tokens)) ? Number(usage.prompt_tokens) : undefined,
    outputTokens: Number.isFinite(Number(usage.completion_tokens)) ? Number(usage.completion_tokens) : undefined,
    costUsd: Number.isFinite(Number(usage.estimated_cost)) ? Number(usage.estimated_cost) : undefined,
  }
}

export async function deepinfraChatCompletion(input: {
  messages: ChatMessage[]
  model?: string
  maxTokens: number
  temperature?: number
  json?: boolean
  modality?: 'text' | 'vision'
  ctx: BudgetedCallContext
  fetchImpl?: typeof fetch
}): Promise<ChatCompletionResult> {
  const config = deepinfraConfig()
  if (!config.enabled || !config.apiKey) {
    throw new SyncHttpError(503, 'DeepInfra ist nicht konfiguriert.')
  }
  const modality = input.modality || 'text'
  const model = input.model || (modality === 'vision' ? config.visionModel : config.textModel)
  const approxInput = input.messages.reduce((sum, message) => {
    if (typeof message.content === 'string') return sum + estimateTextTokens(message.content)
    return sum + message.content.reduce((inner, part) => {
      if (part.type === 'text' && typeof part.text === 'string') return inner + estimateTextTokens(part.text)
      if (part.type === 'image_url') return inner + 1200
      return inner
    }, 0)
  }, 0)
  const estimatedUsd = estimateChatUsd({
    inputTokens: approxInput,
    maxOutputTokens: input.maxTokens,
    modality,
  }) * 1.2

  return withReservation({
    ctx: input.ctx,
    provider: 'deepinfra',
    model,
    estimatedUsd,
    inputTokens: approxInput,
    outputTokens: input.maxTokens,
    run: async reservation => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), config.timeoutMs)
      try {
        const response = await (input.fetchImpl || fetch)(CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: input.temperature ?? 0,
            max_tokens: input.maxTokens,
            ...(input.json ? { response_format: { type: 'json_object' } } : {}),
            messages: input.messages,
          }),
          signal: controller.signal,
        })
        if (response.status === 401 || response.status === 403) {
          throw new SyncHttpError(503, 'DeepInfra ist falsch konfiguriert.')
        }
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('retry-after'))
          throw Object.assign(new SyncHttpError(429, 'DeepInfra Rate-Limit.'), {
            retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined,
          })
        }
        if (response.status >= 500) throw new SyncHttpError(502, 'DeepInfra ist gerade nicht erreichbar.')
        if (!response.ok) throw new SyncHttpError(502, 'DeepInfra-Anfrage fehlgeschlagen.')
        const payload = await response.json() as {
          choices?: Array<{ message?: { content?: string } }>
        } & Record<string, unknown>
        const content = payload.choices?.[0]?.message?.content?.trim() || ''
        if (!content) throw new SyncHttpError(502, 'DeepInfra lieferte keinen Text.')
        const usage = parseUsageCost(payload)
        const value: ChatCompletionResult = {
          content,
          provider: 'deepinfra',
          model,
          requestId: usage.requestId,
          costUsd: usage.costUsd,
          costSource: usage.costUsd != null ? 'reported' : 'estimate',
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          reservationId: reservation.id,
        }
        return {
          value,
          actualUsd: usage.costUsd ?? estimateChatUsd({
            inputTokens: usage.inputTokens ?? approxInput,
            maxOutputTokens: usage.outputTokens ?? Math.min(input.maxTokens, estimateTextTokens(content)),
            modality,
          }),
          requestId: usage.requestId,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        }
      } catch (error) {
        if (error instanceof SyncHttpError) throw error
        if (error instanceof Error && error.name === 'AbortError') throw new SyncHttpError(504, 'DeepInfra-Timeout.')
        throw new SyncHttpError(502, 'DeepInfra-Anfrage fehlgeschlagen.')
      } finally {
        clearTimeout(timer)
      }
    },
  })
}

export async function deepinfraEmbeddings(input: {
  texts: string[]
  ctx: BudgetedCallContext
  fetchImpl?: typeof fetch
}): Promise<{ vectors: number[][]; model: string; reservationId?: string; costUsd?: number }> {
  const config = deepinfraConfig()
  if (!config.enabled || !config.apiKey) throw new SyncHttpError(503, 'DeepInfra ist nicht konfiguriert.')
  const texts = input.texts.map(text => text.trim()).filter(Boolean).slice(0, 32)
  if (!texts.length) return { vectors: [], model: config.embeddingModel }
  const inputTokens = texts.reduce((sum, text) => sum + estimateTextTokens(text), 0)
  const estimatedUsd = estimateEmbeddingUsd(inputTokens) * 1.3
  return withReservation({
    ctx: input.ctx,
    provider: 'deepinfra',
    model: config.embeddingModel,
    estimatedUsd,
    inputTokens,
    run: async reservation => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), config.timeoutMs)
      try {
        const response = await (input.fetchImpl || fetch)(EMBED_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.embeddingModel,
            input: texts,
            encoding_format: 'float',
          }),
          signal: controller.signal,
        })
        if (response.status === 401 || response.status === 403) {
          throw new SyncHttpError(503, 'DeepInfra ist falsch konfiguriert.')
        }
        if (!response.ok) throw new SyncHttpError(502, 'Embedding-Anfrage fehlgeschlagen.')
        const payload = await response.json() as {
          data?: Array<{ embedding?: number[] }>
          usage?: { prompt_tokens?: number; estimated_cost?: number }
          id?: string
        }
        const vectors = (payload.data || []).map(row => Array.isArray(row.embedding) ? row.embedding : [])
        if (vectors.length !== texts.length || vectors.some(vector => vector.length === 0)) {
          throw new SyncHttpError(502, 'Embedding-Antwort unvollständig.')
        }
        const costUsd = Number.isFinite(Number(payload.usage?.estimated_cost))
          ? Number(payload.usage?.estimated_cost)
          : estimateEmbeddingUsd(payload.usage?.prompt_tokens ?? inputTokens)
        return {
          value: {
            vectors,
            model: config.embeddingModel,
            reservationId: reservation.id,
            costUsd,
          },
          actualUsd: costUsd,
          requestId: typeof payload.id === 'string' ? payload.id : null,
          inputTokens: payload.usage?.prompt_tokens ?? inputTokens,
        }
      } catch (error) {
        if (error instanceof SyncHttpError) throw error
        if (error instanceof Error && error.name === 'AbortError') throw new SyncHttpError(504, 'Embedding-Timeout.')
        throw new SyncHttpError(502, 'Embedding-Anfrage fehlgeschlagen.')
      } finally {
        clearTimeout(timer)
      }
    },
  })
}

export { usdToBudgetEur, BudgetPausedError }
