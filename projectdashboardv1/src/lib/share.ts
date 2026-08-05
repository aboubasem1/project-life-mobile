/** Web Share + clipboard helpers for Notes / Shortcuts handoff. */

export type ShareTextResult = 'shared' | 'copied' | 'failed'

export async function shareText(input: {
  title?: string
  text: string
  url?: string
}): Promise<ShareTextResult> {
  const text = input.text.trim()
  if (!text) return 'failed'

  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({
        title: input.title,
        text,
        url: input.url,
      })
      return 'shared'
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'failed'
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return 'copied'
    }
  } catch {
    /* fall through */
  }

  return 'failed'
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
