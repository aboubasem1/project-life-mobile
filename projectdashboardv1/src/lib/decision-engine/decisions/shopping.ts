import type { DecisionEntities } from '../types.js'

const ORDER = /\b(bestellen|kaufen|einkauf|nachbestellen|order)\b/i

export function shoppingName(text: string): string {
  return text
    .replace(/\b(morgen|heute|übermorgen|bitte|mal|vielleicht)\b/gi, ' ')
    .replace(ORDER, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export function shoppingEntities(text: string, due?: string): DecisionEntities {
  const name = shoppingName(text)
  return {
    product: name || undefined,
    title: name ? `${name} bestellen` : text.trim(),
    due,
    listName: 'shopping',
    priority: 'p3',
  }
}
