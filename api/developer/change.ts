import {
  GITHUB_OWNER,
  GITHUB_REPO,
  PRODUCTION_BRANCH,
  WORKFLOW_FILE,
  branchFor,
  cleanText,
  createRequestId,
  errorResponse,
  github,
  json,
  readJson,
  requireAdmin,
  sleep,
  validateRequestId,
} from '../../server/developer-admin'

type DispatchResponse = {
  workflow_run_id?: number
  html_url?: string
}

type WorkflowRun = {
  id: number
  status: string
  conclusion: string | null
  html_url: string
  display_title?: string
  created_at: string
}

type PullRequest = {
  number: number
  html_url: string
  state: 'open' | 'closed'
  merged_at: string | null
  mergeable?: boolean | null
  head: {
    ref: string
    sha: string
  }
}

type Deployment = {
  id: number
  created_at: string
  environment?: string
}

type DeploymentStatus = {
  state: string
  environment_url?: string | null
  target_url?: string | null
  created_at: string
}

function stageFor(
  run: WorkflowRun,
  pr: PullRequest | null,
  previewUrl: string | null,
): string {
  if (pr?.merged_at) return 'published'
  if (pr?.state === 'closed') return 'discarded'
  if (run.status !== 'completed') return run.status === 'queued' ? 'queued' : 'working'
  if (run.conclusion !== 'success') return 'failed'
  if (!pr) return 'finalizing'
  if (previewUrl) return 'preview_ready'
  return 'waiting_preview'
}

async function findRunId(requestId: string): Promise<number | null> {
  await sleep(1400)

  const runs = await github<{ workflow_runs?: WorkflowRun[] }>(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&branch=${PRODUCTION_BRANCH}&per_page=20`,
  )

  const match = runs.workflow_runs?.find(run => run.display_title?.includes(requestId))
  return match?.id ?? null
}

async function findPreviewUrl(branch: string): Promise<string | null> {
  const deployments = await github<Deployment[]>(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/deployments?ref=${encodeURIComponent(branch)}&per_page=10`,
  )

  const sorted = [...deployments].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  )

  for (const deployment of sorted) {
    const statuses = await github<DeploymentStatus[]>(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/deployments/${deployment.id}/statuses?per_page=10`,
    )

    const successful = statuses.find(status => {
      const url = status.environment_url || status.target_url || ''
      return status.state === 'success' && url.includes('vercel.app')
    })

    if (successful) {
      return successful.environment_url || successful.target_url || null
    }
  }

  return null
}

export default async function handler(request: Request): Promise<Response> {
  try {
    requireAdmin(request)

    if (request.method === 'POST') {
      const body = await readJson<{
        task?: unknown
        viewport?: unknown
        pageUrl?: unknown
      }>(request)

      const task = cleanText(body.task, 3000)
      const viewport = cleanText(body.viewport, 20)
      const pageUrl = cleanText(body.pageUrl, 500)

      if (task.length < 10) {
        return json({ error: 'Beschreibe die Änderung etwas genauer.' }, 400)
      }

      if (!['mobile', 'desktop', 'all'].includes(viewport)) {
        return json({ error: 'Ungültiges Zielgerät.' }, 400)
      }

      const requestId = createRequestId()
      const branch = branchFor(requestId)

      const dispatch = await github<DispatchResponse | null>(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        {
          method: 'POST',
          body: JSON.stringify({
            ref: PRODUCTION_BRANCH,
            inputs: {
              request_id: requestId,
              task,
              viewport,
              page_url: pageUrl || '/',
            },
          }),
        },
      )

      const runId = dispatch?.workflow_run_id ?? (await findRunId(requestId))

      if (!runId) {
        return json(
          {
            error: 'Workflow wurde gestartet, die Run-ID konnte aber noch nicht ermittelt werden.',
            requestId,
            branch,
          },
          202,
        )
      }

      return json({
        requestId,
        branch,
        runId,
        workflowUrl:
          dispatch?.html_url ||
          `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${runId}`,
      })
    }

    if (request.method !== 'GET') {
      return json({ error: 'Methode nicht erlaubt.' }, 405, { Allow: 'GET, POST' })
    }

    const url = new URL(request.url)
    const requestId = validateRequestId(url.searchParams.get('id') ?? '')
    const requestedRunId = Number(url.searchParams.get('runId'))
    const runId =
      Number.isSafeInteger(requestedRunId) && requestedRunId > 0
        ? requestedRunId
        : await findRunId(requestId)

    if (!runId) {
      return json({
        requestId,
        runId: null,
        branch: branchFor(requestId),
        stage: 'queued',
        run: { status: 'queued', conclusion: null, url: null },
        pullRequest: null,
        previewUrl: null,
        canPublish: false,
      })
    }

    const branch = branchFor(requestId)
    const run = await github<WorkflowRun>(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${runId}`,
    )

    const pulls = await github<PullRequest[]>(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls?state=all&head=${GITHUB_OWNER}:${encodeURIComponent(branch)}&per_page=5`,
    )
    const pr = pulls[0] ?? null

    let previewUrl: string | null = null
    if (pr && run.conclusion === 'success') {
      try {
        previewUrl = await findPreviewUrl(branch)
      } catch (error) {
        console.warn('Preview-URL konnte noch nicht gelesen werden.', error)
      }
    }

    return json({
      requestId,
      runId,
      branch,
      stage: stageFor(run, pr, previewUrl),
      run: {
        status: run.status,
        conclusion: run.conclusion,
        url: run.html_url,
      },
      pullRequest: pr
        ? {
            number: pr.number,
            url: pr.html_url,
            state: pr.state,
            mergedAt: pr.merged_at,
            mergeable: pr.mergeable ?? null,
          }
        : null,
      previewUrl,
      canPublish: run.conclusion === 'success' && pr?.state === 'open',
    })
  } catch (error) {
    return errorResponse(error)
  }
}
