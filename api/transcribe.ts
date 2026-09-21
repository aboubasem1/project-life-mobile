import { runTranscriptionRequest } from '../server/transcription-core.js'
import { syncError } from '../server/sync-core.js'

export const config = {
  maxDuration: 30,
}

async function handle(request: Request): Promise<Response> {
  try {
    return await runTranscriptionRequest(request)
  } catch (error) {
    return syncError(error)
  }
}

export default { fetch: handle }
