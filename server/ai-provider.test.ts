import { describe, expect, it } from 'vitest'
import {
  DEEPINFRA_MODELS,
  DEEPINFRA_USD_PRICES,
  estimateChatUsd,
  estimateEmbeddingUsd,
  estimateWhisperUsd,
} from './ai-provider.ts'

describe('DeepInfra price estimates (verified list prices)', () => {
  it('uses documented model IDs', () => {
    expect(DEEPINFRA_MODELS.whisper).toBe('openai/whisper-large-v3-turbo')
    expect(DEEPINFRA_MODELS.text).toBe('deepseek-ai/DeepSeek-V4-Flash-0731')
    expect(DEEPINFRA_MODELS.vision).toBe('Qwen/Qwen3-VL-235B-A22B-Instruct')
    expect(DEEPINFRA_MODELS.embedding).toBe('BAAI/bge-m3')
  })

  it('estimates whisper from documented $/minute', () => {
    expect(estimateWhisperUsd(60_000)).toBeCloseTo(DEEPINFRA_USD_PRICES.whisperPerMinute * 1.15, 8)
  })

  it('estimates text and vision chat from documented $/MTok', () => {
    expect(estimateChatUsd({ inputTokens: 1_000_000, maxOutputTokens: 0, modality: 'text' }))
      .toBeCloseTo(DEEPINFRA_USD_PRICES.textInputPerMTok, 8)
    expect(estimateChatUsd({ inputTokens: 0, maxOutputTokens: 1_000_000, modality: 'vision' }))
      .toBeCloseTo(DEEPINFRA_USD_PRICES.visionOutputPerMTok, 8)
  })

  it('estimates embeddings from documented $/MTok', () => {
    expect(estimateEmbeddingUsd(1_000_000)).toBeCloseTo(DEEPINFRA_USD_PRICES.embeddingPerMTok, 8)
  })
})
