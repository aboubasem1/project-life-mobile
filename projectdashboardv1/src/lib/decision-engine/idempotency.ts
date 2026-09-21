export function actionKey(parts: Array<string | number | undefined>): string {
  const material = parts.map(part => String(part ?? '').trim().toLowerCase()).join('|')
  return `act_${fnv1a(material)}`
}

export function replayGuard(existing: Iterable<string>, key: string): boolean {
  return new Set(existing).has(key)
}

function fnv1a(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}
