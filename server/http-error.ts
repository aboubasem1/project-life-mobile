/** Shared HTTP-shaped error used across sync, reels, and AI budget modules. */
export class SyncHttpError extends Error {
  status: number
  retryAfterMs?: number

  constructor(status: number, message: string, options?: { retryAfterMs?: number }) {
    super(message)
    this.name = 'SyncHttpError'
    this.status = status
    if (options?.retryAfterMs != null && Number.isFinite(options.retryAfterMs) && options.retryAfterMs > 0) {
      this.retryAfterMs = Math.min(300_000, Math.round(options.retryAfterMs))
    }
  }
}
