import { normalizeText } from './normalize.js'
import type { NormalizedItem } from './types.js'

export type DomainSignal = {
  nutrition: number
  shopping: number
  note: number
  work: number
  task: number
  personal: number
}

const NUTRITION = /\b(getrunken|getrunken|getrunken|getrunken|gegessen|shake|proteinshake|mass[\s-]?gainer|mahlzeit|kalorien|kcal|eiwei[sß])\b/i
const SHOPPING = /\b(bestellen|kaufen|einkauf|nachbestellen|order|buy)\b/i
const NOTE = /^\s*(merken|notiz|note|idea|idee)\b/i
const WORK = /\b(dhl|claim|claims|arbeit|projekt|kunde|meeting|deadline)\b/i
const TASK = /\b(fertig\s+machen|erledigen|anrufen|machen|abschlie[sß]en|task)\b/i
const PERSONAL = /\b(familie|freund|arzt|privat)\b/i
const CONSUME = /\b(getrunken|getrunken|gegessen|genommen)\b/i

const BOUNDARY = /\s+(?:und|and|sowie|plus|,)\s+/i
const SENTENCE = /(?<=[.!?])\s+(?=[A-ZÄÖÜ])/

export function scoreDomainSignals(text: string): DomainSignal {
  const value = normalizeText(text)
  return {
    nutrition: Number(NUTRITION.test(value)) + Number(CONSUME.test(value)),
    shopping: Number(SHOPPING.test(value)) + Number(/\bweider\b/i.test(value) && !CONSUME.test(value)),
    note: Number(NOTE.test(value)),
    work: Number(WORK.test(value)),
    task: Number(TASK.test(value) || SHOPPING.test(value)),
    personal: Number(PERSONAL.test(value)),
  }
}

export function topDomain(signals: DomainSignal): keyof DomainSignal | null {
  const entries = Object.entries(signals) as Array<[keyof DomainSignal, number]>
  const ranked = [...entries].sort((a, b) => b[1] - a[1])
  if (!ranked[0] || ranked[0][1] <= 0) return null
  if (ranked[1] && ranked[1][1] === ranked[0][1]) return null
  return ranked[0][0]
}

function hasIndependentClause(text: string): boolean {
  const words = normalizeText(text).split(/\s+/).filter(Boolean)
  if (words.length < 2) return false
  return scoreDomainSignals(text).nutrition
    + scoreDomainSignals(text).shopping
    + scoreDomainSignals(text).note
    + scoreDomainSignals(text).work
    + scoreDomainSignals(text).task > 0
    || words.length >= 4
}

function shouldSplitPair(left: string, right: string): boolean {
  if (!hasIndependentClause(left) || !hasIndependentClause(right)) return false
  const leftTop = topDomain(scoreDomainSignals(left))
  const rightTop = topDomain(scoreDomainSignals(right))
  if (leftTop && rightTop && leftTop !== rightTop) return true
  const leftVerb = /\b(getrunken|gegessen|bestellen|kaufen|anrufen|erledigen|fertig\s+machen)\b/i.test(left)
  const rightVerb = /\b(getrunken|gegessen|bestellen|kaufen|anrufen|erledigen|fertig\s+machen)\b/i.test(right)
  return leftVerb && rightVerb
}

function splitConjunctions(text: string): string[] {
  const parts = text.split(BOUNDARY).map(item => item.trim()).filter(Boolean)
  if (parts.length < 2) return [text]
  const out: string[] = []
  let buffer = parts[0] ?? ''
  for (let index = 1; index < parts.length; index += 1) {
    const next = parts[index] ?? ''
    if (shouldSplitPair(buffer, next)) {
      out.push(buffer)
      buffer = next
    } else {
      buffer = `${buffer} und ${next}`
    }
  }
  out.push(buffer)
  return out.map(item => item.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

export function splitIntents(raw: string): NormalizedItem[] {
  const text = normalizeText(raw)
  if (!text) return []
  const sentences = text.split(SENTENCE).map(item => item.trim()).filter(Boolean)
  const chunks = sentences.flatMap(sentence => {
    if (NOTE.test(sentence)) return [sentence]
    return splitConjunctions(sentence)
  })
  return chunks.map((content, index) => ({
    index,
    content,
    original: content,
  }))
}
