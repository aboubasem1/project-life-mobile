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
  conclusion: string | null
}

type PullRequest = {
  number: number
  state: 'open' | 'closed'
  merged_at: string | null
  head: {
    ref: string
    sha: string
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
    const prNumber = Number(body.prNumber)
    const expectedBranch = branchFor(requestId)

    if (!Number.isSafeInteger(runId) || runId <= 0) {
      return json({ error: 'Ungültige Workflow-ID.' }, 400)
    }

    if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
      return json({ error: 'Ungültige Pull-Request-ID.' }, 400)
    }

    const run = await github<WorkflowRun>(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${runId}`,
    )

    if (run.status !== 'completed' || run.conclusion !== 'success') {
      return json({ error: 'Der Build ist noch nicht erfolgreich abgeschlossen.' }, 409)
    }

    const pr = await github<PullRequest>(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}`,
    )

    if (pr.merged_at) {
      return json({ merged: true, alreadyMerged: true })
    }

    if (pr.state !== 'open' || pr.head.ref !== expectedBranch) {
      return json({ error: 'Der Pull Request passt nicht zu dieser Änderung.' }, 409)
    }

    const merge = await github<{ merged?: boolean; message?: string; sha?: string }>(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}/merge`,
      {
        method: 'PUT',
        body: JSON.stringify({
          sha: pr.head.sha,
          merge_method: 'squash',
          commit_title: `AI change: ${requestId}`,
        }),
      },
    )

    if (!merge.merged) {
      return json({ error: merge.message || 'Pull Request konnte nicht gemergt werden.' }, 409)
    }

    try {
      await github(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${encodeURIComponent(expectedBranch)}`,
        { method: 'DELETE' },
      )
    } catch (error) {
      console.warn('Branch konnte nach dem Merge nicht gelöscht werden.', error)
    }

    return json({
      merged: true,
      sha: merge.sha ?? null,
      productionUrl: 'https://project-life-mobile.vercel.app/',
    })
  } catch (error) {
    return errorResponse(error)
  }
}
