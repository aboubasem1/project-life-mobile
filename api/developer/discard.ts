import {
  GITHUB_OWNER,
  GITHUB_REPO,
  branchFor,
  errorResponse,
  github,
  json,
  readJson,
  requireAdmin,
  validateRequestId,
} from '../../server/developer-admin'

type WorkflowRun = {
  status: string
}

type PullRequest = {
  state: 'open' | 'closed'
  head: {
    ref: string
  }
}

export default async function handler(request: Request): Promise<Response> {
  try {
    requireAdmin(request)

    if (request.method !== 'POST') {
      return json({ error: 'Methode nicht erlaubt.' }, 405, { Allow: 'POST' })
    }

    const body = await readJson<{
      requestId?: unknown
      runId?: unknown
      prNumber?: unknown
    }>(request)

    const requestId = validateRequestId(String(body.requestId ?? ''))
    const runId = Number(body.runId)
    const prNumber = body.prNumber ? Number(body.prNumber) : null
    const branch = branchFor(requestId)

    if (Number.isSafeInteger(runId) && runId > 0) {
      try {
        const run = await github<WorkflowRun>(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${runId}`,
        )
        if (run.status !== 'completed') {
          await github(
            `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${runId}/cancel`,
            { method: 'POST' },
          )
        }
      } catch (error) {
        console.warn('Workflow konnte nicht abgebrochen werden.', error)
      }
    }

    if (prNumber && Number.isSafeInteger(prNumber) && prNumber > 0) {
      try {
        const pr = await github<PullRequest>(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}`,
        )
        if (pr.state === 'open' && pr.head.ref === branch) {
          await github(
            `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}`,
            {
              method: 'PATCH',
              body: JSON.stringify({ state: 'closed' }),
            },
          )
        }
      } catch (error) {
        console.warn('Pull Request konnte nicht geschlossen werden.', error)
      }
    }

    try {
      await github(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${encodeURIComponent(branch)}`,
        { method: 'DELETE' },
      )
    } catch (error) {
      console.warn('Branch war noch nicht vorhanden oder konnte nicht gelöscht werden.', error)
    }

    return json({ discarded: true })
  } catch (error) {
    return errorResponse(error)
  }
}
