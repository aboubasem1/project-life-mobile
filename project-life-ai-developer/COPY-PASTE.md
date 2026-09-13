# Project Life Developer-Konsole – Copy & Paste

Erstelle oder ersetze die folgenden Dateien exakt an den angegebenen Pfaden.

## `.github/workflows/ai-change.yml`

```yaml
name: AI change
run-name: AI change ${{ inputs.request_id }}

on:
  workflow_dispatch:
    inputs:
      request_id:
        description: Internal request ID
        required: true
        type: string
      task:
        description: Requested product change
        required: true
        type: string
      viewport:
        description: Target viewport
        required: true
        type: choice
        options:
          - mobile
          - desktop
          - all
      page_url:
        description: Affected page or route
        required: false
        default: /
        type: string

permissions:
  contents: read

concurrency:
  group: ai-change-${{ inputs.request_id }}
  cancel-in-progress: false

jobs:
  change:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Check out repository
        uses: actions/checkout@v5
        with:
          ref: main
          fetch-depth: 0
          persist-credentials: false

      - name: Validate request
        shell: bash
        env:
          REQUEST_ID: ${{ inputs.request_id }}
        run: |
          set -euo pipefail
          if [[ ! "$REQUEST_ID" =~ ^chg-[a-z0-9-]{8,64}$ ]]; then
            echo "Invalid request ID"
            exit 1
          fi

      - name: Create work branch
        shell: bash
        env:
          REQUEST_ID: ${{ inputs.request_id }}
        run: |
          set -euo pipefail
          git switch -c "ai/$REQUEST_ID"

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: projectdashboardv1/package-lock.json

      - name: Install frontend dependencies
        working-directory: projectdashboardv1
        run: npm ci

      - name: Prepare Codex prompt
        shell: bash
        env:
          USER_TASK: ${{ inputs.task }}
          TARGET_VIEWPORT: ${{ inputs.viewport }}
          PAGE_URL: ${{ inputs.page_url }}
          REQUEST_ID: ${{ inputs.request_id }}
        run: |
          node <<'NODE'
          const fs = require('node:fs')

          const task = process.env.USER_TASK || ''
          const viewport = process.env.TARGET_VIEWPORT || 'all'
          const pageUrl = process.env.PAGE_URL || '/'
          const requestId = process.env.REQUEST_ID || ''

          const prompt = `You are modifying the public Project Life React/Vite application in this repository.

          REQUEST ID: ${requestId}
          AFFECTED PAGE OR ROUTE: ${pageUrl}
          TARGET VIEWPORT: ${viewport}
          
          USER REQUEST
          ---
          ${task}
          ---
          
          IMPLEMENTATION RULES
          1. Work only inside projectdashboardv1/.
          2. Do not modify .github/, api/, server/, vercel.json, any environment file, package.json, package-lock.json, index.html, vite.config.ts, the developer console, or developer-launcher.js.
          3. Do not add dependencies. Use the existing React, TypeScript, CSS and lucide-react stack.
          4. Inspect the current implementation before changing it. Make the smallest complete change that fulfills the request.
          5. Preserve existing stored user data, routes, Supabase behavior, PWA behavior and unrelated features.
          6. For mobile requests, test the layout conceptually at 390px width. For desktop requests, test at 1440px width. For all, cover both.
          7. Every visible control must work. Add accessible labels, keyboard behavior and reduced-motion handling where relevant.
          8. Do not leave preview, demo, beta, placeholder, TODO or mock labels in user-facing UI.
          9. Do not add new analytics, third-party network requests, credentials, remote scripts, eval, or dynamic code execution.
          10. Do not output a plan only. Apply the edits to the repository files.
          11. Keep the final response brief: changed files, behavior implemented and any limitation.
          `

          fs.writeFileSync('.codex-task.md', prompt)
          NODE

      - name: Apply change with Codex
        id: codex
        uses: openai/codex-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          prompt-file: .codex-task.md
          output-file: .codex-output.md
          sandbox: workspace-write
          safety-strategy: drop-sudo
          allow-users: aboubasem1
          effort: medium

      - name: Remove runtime prompt files
        run: rm -f .codex-task.md .codex-output.md

      - name: Enforce protected paths
        shell: bash
        run: |
          set -euo pipefail
          mapfile -t changed < <({ git diff --name-only; git ls-files --others --exclude-standard; } | sort -u)

          if [[ ${#changed[@]} -eq 0 ]]; then
            echo "Codex produced no file changes."
            exit 1
          fi

          printf '%s\n' "${changed[@]}"

          for file in "${changed[@]}"; do
            if [[ ! "$file" =~ ^projectdashboardv1/ ]]; then
              echo "Blocked change outside projectdashboardv1: $file"
              exit 1
            fi

            if [[ "$file" =~ ^projectdashboardv1/public/developer/ ]] ||
               [[ "$file" == "projectdashboardv1/public/developer-launcher.js" ]] ||
               [[ "$file" == "projectdashboardv1/index.html" ]] ||
               [[ "$file" == "projectdashboardv1/vite.config.ts" ]] ||
               [[ "$file" == "projectdashboardv1/package.json" ]] ||
               [[ "$file" == "projectdashboardv1/package-lock.json" ]] ||
               [[ "$file" =~ (^|/)\.env ]]; then
              echo "Blocked protected file: $file"
              exit 1
            fi
          done

      - name: Validate diff
        shell: bash
        run: |
          git add --intent-to-add projectdashboardv1
          git diff --check

      - name: Build application
        working-directory: projectdashboardv1
        run: npm run build

      - name: Commit and push change
        shell: bash
        env:
          REQUEST_ID: ${{ inputs.request_id }}
          GH_TOKEN: ${{ secrets.REPO_ADMIN_TOKEN }}
        run: |
          set -euo pipefail
          gh auth setup-git
          git config user.name "Project Life AI"
          git config user.email "project-life-ai@users.noreply.github.com"
          git add projectdashboardv1
          git -c core.hooksPath=/dev/null commit -m "AI change: $REQUEST_ID"
          git -c core.hooksPath=/dev/null push --set-upstream origin "ai/$REQUEST_ID"

      - name: Create pull request
        id: pull_request
        shell: bash
        env:
          GH_TOKEN: ${{ secrets.REPO_ADMIN_TOKEN }}
          REQUEST_ID: ${{ inputs.request_id }}
          USER_TASK: ${{ inputs.task }}
          TARGET_VIEWPORT: ${{ inputs.viewport }}
          PAGE_URL: ${{ inputs.page_url }}
          CODEX_SUMMARY: ${{ steps.codex.outputs.final-message }}
        run: |
          node <<'NODE'
          const fs = require('node:fs')
          const body = `## Angeforderte Änderung

          ${process.env.USER_TASK || ''}
          
          ## Ziel
          
          - Route: ${process.env.PAGE_URL || '/'}
          - Ansicht: ${process.env.TARGET_VIEWPORT || 'all'}
          - Request: ${process.env.REQUEST_ID || ''}
          
          ## Codex-Zusammenfassung
          
          ${process.env.CODEX_SUMMARY || 'Änderung umgesetzt und Build erfolgreich geprüft.'}
          
          ## Prüfung
          
          - npm ci
          - npm run build
          - geschützte Pfade unverändert
          `
          fs.writeFileSync('/tmp/pr-body.md', body)
          NODE

          PR_URL=$(gh pr create \
            --base main \
            --head "ai/$REQUEST_ID" \
            --title "AI change: $REQUEST_ID" \
            --body-file /tmp/pr-body.md)

          echo "url=$PR_URL" >> "$GITHUB_OUTPUT"
          echo "Pull request: $PR_URL" >> "$GITHUB_STEP_SUMMARY"

```

## `server/developer-admin.ts`

```ts
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const GITHUB_OWNER = 'aboubasem1'
export const GITHUB_REPO = 'project-life-mobile'
export const PRODUCTION_BRANCH = 'main'
export const WORKFLOW_FILE = 'ai-change.yml'
export const GITHUB_API_VERSION = '2026-03-10'

const COOKIE_NAME = 'pl_dev_session'
const SESSION_SECONDS = 12 * 60 * 60

type JsonRecord = Record<string, unknown>

export class HttpError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.details = details
  }
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json(
      {
        error: error.message,
        details: error.details,
      },
      error.status,
    )
  }

  console.error(error)
  return json({ error: 'Interner Serverfehler.' }, 500)
}

export async function readJson<T extends JsonRecord>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new HttpError(400, 'Ungültige JSON-Anfrage.')
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new HttpError(500, `${name} ist nicht konfiguriert.`)
  }
  return value
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function sign(payload: string): string {
  return createHmac('sha256', requireEnv('DEV_ADMIN_SECRET'))
    .update(payload)
    .digest('base64url')
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function verifyAdminPassword(password: string): boolean {
  const expected = requireEnv('DEV_ADMIN_SECRET')
  return safeEqual(password, expected)
}

export function createSessionCookie(): string {
  const payload = toBase64Url(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
      nonce: randomUUID(),
    }),
  )
  const token = `${payload}.${sign(payload)}`

  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie') ?? ''
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=')
    if (rawKey === name) {
      return rawValue.join('=') || null
    }
  }
  return null
}

export function isAdmin(request: Request): boolean {
  const token = getCookie(request, COOKIE_NAME)
  if (!token) return false

  const [payload, signature] = token.split('.')
  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return false
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as { exp?: number }
    return typeof parsed.exp === 'number' && parsed.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

export function requireAdmin(request: Request): void {
  if (!isAdmin(request)) {
    throw new HttpError(401, 'Nicht angemeldet.')
  }
}

export function createRequestId(): string {
  return `chg-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`
}

export function validateRequestId(value: string): string {
  if (!/^chg-[a-z0-9-]{8,64}$/.test(value)) {
    throw new HttpError(400, 'Ungültige Änderungs-ID.')
  }
  return value
}

export function branchFor(requestId: string): string {
  return `ai/${validateRequestId(requestId)}`
}

export function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, maxLength)
}

export async function github<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = requireEnv('GITHUB_ADMIN_TOKEN')
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      'User-Agent': 'project-life-developer-console',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  const text = await response.text()
  let data: unknown = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message?: unknown }).message)
        : `GitHub-Anfrage fehlgeschlagen (${response.status}).`

    throw new HttpError(response.status, message, data)
  }

  return data as T
}

export async function sleep(milliseconds: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, milliseconds))
}

```

## `api/developer/session.ts`

```ts
import {
  clearSessionCookie,
  createSessionCookie,
  errorResponse,
  isAdmin,
  json,
  readJson,
  verifyAdminPassword,
} from '../../server/developer-admin'

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method === 'GET') {
      return json({ authenticated: isAdmin(request) })
    }

    if (request.method === 'DELETE') {
      return json(
        { authenticated: false },
        200,
        { 'Set-Cookie': clearSessionCookie() },
      )
    }

    if (request.method !== 'POST') {
      return json({ error: 'Methode nicht erlaubt.' }, 405, { Allow: 'GET, POST, DELETE' })
    }

    const body = await readJson<{ password?: unknown }>(request)
    const password = String(body.password ?? '')

    if (!password || !verifyAdminPassword(password)) {
      return json({ error: 'Falsches Admin-Passwort.' }, 401)
    }

    return json(
      { authenticated: true },
      200,
      { 'Set-Cookie': createSessionCookie() },
    )
  } catch (error) {
    return errorResponse(error)
  }
}

```

## `api/developer/change.ts`

```ts
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

```

## `api/developer/publish.ts`

```ts
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

```

## `api/developer/discard.ts`

```ts
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

```

## `projectdashboardv1/index.html`

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0f1419" />
    <meta name="description" content="Project Life — Personal Life Tracking Dashboard" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Project Life" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <title>Project Life</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
    <script defer src="/developer-launcher.js"></script>
  </body>
</html>

```

## `projectdashboardv1/vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Project Life Dashboard',
        short_name: 'Project Life',
        description: 'Your personal life tracking system',
        theme_color: '#0f1419',
        background_color: '#0f1419',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [
          /^\/developer(?:\/|$)/,
          /^\/api(?:\/|$)/,
        ],
      },
    }),
  ],
})

```

## `projectdashboardv1/public/developer-launcher.js`

```js
(() => {
  const params = new URLSearchParams(window.location.search)
  const enable = params.get('developer') === '1'
  const disable = params.get('developer') === '0'
  const storageKey = 'project-life-developer-launcher'

  if (enable) localStorage.setItem(storageKey, '1')
  if (disable) localStorage.removeItem(storageKey)
  if (disable || localStorage.getItem(storageKey) !== '1') return

  const button = document.createElement('a')
  button.href = `/developer/?from=${encodeURIComponent(window.location.pathname + window.location.search)}`
  button.setAttribute('aria-label', 'Developer-Konsole öffnen')
  button.title = 'Developer-Konsole'
  button.textContent = '</>'

  Object.assign(button.style, {
    position: 'fixed',
    right: '16px',
    bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
    zIndex: '9999',
    display: 'grid',
    placeItems: 'center',
    width: '46px',
    height: '46px',
    border: '1px solid rgba(127, 127, 127, 0.22)',
    borderRadius: '16px',
    background: 'rgba(20, 24, 22, 0.88)',
    color: '#f4f5f0',
    boxShadow: '0 14px 36px rgba(0, 0, 0, 0.24)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    font: '700 13px/1 ui-monospace, SFMono-Regular, Menlo, monospace',
    textDecoration: 'none',
  })

  document.body.appendChild(button)
})()

```

## `projectdashboardv1/public/developer/index.html`

```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#121714" />
  <meta name="robots" content="noindex, nofollow, noarchive" />
  <title>Project Life Developer</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f1f2ec;
      --surface: rgba(255,255,255,.78);
      --surface-solid: #fbfcf8;
      --surface-2: #e7eae2;
      --text: #182019;
      --muted: #69726a;
      --line: rgba(24,32,25,.11);
      --accent: #57715e;
      --accent-strong: #324c39;
      --accent-soft: rgba(87,113,94,.12);
      --danger: #a94d47;
      --danger-soft: rgba(169,77,71,.1);
      --success: #4e7659;
      --warning: #9b702e;
      --shadow: 0 24px 70px rgba(35,46,37,.11);
    }

    [data-theme="dark"] {
      color-scheme: dark;
      --bg: #0e1210;
      --surface: rgba(23,29,25,.78);
      --surface-solid: #171d19;
      --surface-2: #202822;
      --text: #eff2eb;
      --muted: #98a39a;
      --line: rgba(239,242,235,.1);
      --accent: #9ab7a0;
      --accent-strong: #c2d5c5;
      --accent-soft: rgba(154,183,160,.13);
      --danger: #dc8b83;
      --danger-soft: rgba(220,139,131,.11);
      --success: #99c3a2;
      --warning: #d6ae6b;
      --shadow: 0 28px 80px rgba(0,0,0,.34);
    }

    * { box-sizing: border-box; }
    html { min-height: 100%; background: var(--bg); }
    body {
      min-height: 100vh;
      margin: 0;
      background:
        radial-gradient(circle at 12% 0%, var(--accent-soft), transparent 34rem),
        var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    button, input, textarea, select { font: inherit; }
    button, a { -webkit-tap-highlight-color: transparent; }
    button:focus-visible, input:focus-visible, textarea:focus-visible, a:focus-visible {
      outline: 3px solid var(--accent-soft);
      outline-offset: 2px;
    }
    .hidden { display: none !important; }
    .shell { width: min(1180px, 100%); margin: 0 auto; padding: 20px 18px 80px; }
    .topbar {
      display: flex; align-items: center; justify-content: space-between; gap: 14px;
      margin-bottom: 24px;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-mark {
      display: grid; place-items: center; width: 42px; height: 42px;
      border-radius: 15px; background: var(--accent); color: var(--bg);
      font: 800 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      box-shadow: var(--shadow);
    }
    .brand h1 { margin: 0; font-size: 16px; letter-spacing: -.02em; }
    .brand p { margin: 3px 0 0; color: var(--muted); font-size: 12px; }
    .icon-button {
      width: 42px; height: 42px; border: 1px solid var(--line); border-radius: 14px;
      background: var(--surface); color: var(--text); cursor: pointer;
    }
    .layout { display: grid; gap: 18px; }
    .card {
      border: 1px solid var(--line); border-radius: 26px; background: var(--surface);
      box-shadow: var(--shadow); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
    }
    .composer { padding: 22px; }
    .eyebrow {
      margin: 0 0 8px; color: var(--accent); font-size: 11px; font-weight: 800;
      letter-spacing: .09em; text-transform: uppercase;
    }
    h2 { margin: 0; font-size: clamp(25px, 5vw, 42px); line-height: 1.05; letter-spacing: -.045em; }
    .intro { max-width: 690px; margin: 13px 0 22px; color: var(--muted); line-height: 1.55; }
    label { display: block; margin: 0 0 8px; font-size: 13px; font-weight: 750; }
    textarea, input {
      width: 100%; border: 1px solid var(--line); border-radius: 18px;
      background: var(--surface-solid); color: var(--text); outline: none;
    }
    textarea { min-height: 170px; resize: vertical; padding: 17px; line-height: 1.55; }
    input { min-height: 48px; padding: 0 14px; }
    textarea:focus, input:focus { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
    .textarea-wrap { position: relative; }
    .dictate {
      position: absolute; right: 10px; bottom: 10px; min-height: 38px; padding: 0 12px;
      border: 1px solid var(--line); border-radius: 12px; background: var(--surface-2);
      color: var(--text); cursor: pointer;
    }
    .fields { display: grid; gap: 14px; margin-top: 16px; }
    .segment {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; padding: 5px;
      border: 1px solid var(--line); border-radius: 16px; background: var(--surface-2);
    }
    .segment button {
      min-height: 40px; border: 0; border-radius: 12px; background: transparent;
      color: var(--muted); cursor: pointer; font-weight: 750;
    }
    .segment button.active { background: var(--surface-solid); color: var(--text); box-shadow: 0 4px 14px rgba(0,0,0,.08); }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
    .button {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      min-height: 48px; padding: 0 18px; border: 1px solid var(--line); border-radius: 16px;
      background: var(--surface-solid); color: var(--text); text-decoration: none; cursor: pointer;
      font-weight: 780;
    }
    .button.primary { border-color: transparent; background: var(--accent); color: var(--bg); }
    .button.danger { background: var(--danger-soft); color: var(--danger); }
    .button:disabled { opacity: .45; cursor: not-allowed; }
    .button.loading::before {
      content: ''; width: 15px; height: 15px; border: 2px solid currentColor; border-right-color: transparent;
      border-radius: 50%; animation: spin .8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .security-note {
      display: flex; gap: 10px; margin-top: 18px; padding: 13px 14px; border-radius: 15px;
      background: var(--accent-soft); color: var(--muted); font-size: 12px; line-height: 1.45;
    }
    .status-card { padding: 20px; }
    .status-head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; }
    .status-title { margin: 0; font-size: 20px; letter-spacing: -.025em; }
    .status-copy { margin: 6px 0 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
    .status-pill {
      flex: 0 0 auto; padding: 7px 10px; border-radius: 999px; background: var(--accent-soft);
      color: var(--accent); font-size: 11px; font-weight: 800;
    }
    .timeline { display: grid; gap: 0; margin: 22px 0 18px; }
    .step { position: relative; display: grid; grid-template-columns: 24px 1fr; gap: 11px; min-height: 52px; }
    .step:not(:last-child)::after {
      content: ''; position: absolute; left: 11px; top: 23px; bottom: 0; width: 1px; background: var(--line);
    }
    .dot {
      position: relative; z-index: 1; display: grid; place-items: center; width: 23px; height: 23px;
      border: 1px solid var(--line); border-radius: 50%; background: var(--surface-solid); color: var(--muted); font-size: 11px;
    }
    .step.done .dot { border-color: transparent; background: var(--success); color: var(--bg); }
    .step.current .dot { border-color: var(--accent); box-shadow: 0 0 0 5px var(--accent-soft); color: var(--accent); }
    .step strong { display: block; padding-top: 2px; font-size: 13px; }
    .step span { display: block; margin-top: 3px; color: var(--muted); font-size: 12px; }
    .links { display: flex; flex-wrap: wrap; gap: 8px; }
    .text-link {
      display: inline-flex; min-height: 38px; align-items: center; padding: 0 12px;
      border: 1px solid var(--line); border-radius: 12px; color: var(--text); text-decoration: none; font-size: 12px; font-weight: 750;
    }
    .history { padding: 18px; }
    .history-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }
    .history h3 { margin: 0; font-size: 15px; }
    .history-list { display: grid; gap: 8px; }
    .history-item {
      width: 100%; padding: 13px; border: 1px solid var(--line); border-radius: 15px;
      background: var(--surface-solid); color: var(--text); text-align: left; cursor: pointer;
    }
    .history-item strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .history-item span { display: block; margin-top: 5px; color: var(--muted); font-size: 11px; }
    .empty { padding: 22px 6px; color: var(--muted); text-align: center; font-size: 13px; }
    .login-wrap { min-height: 100vh; display: grid; place-items: center; padding: 22px; }
    .login-card { width: min(420px, 100%); padding: 26px; }
    .login-card h1 { margin: 18px 0 7px; font-size: 28px; letter-spacing: -.04em; }
    .login-card p { margin: 0 0 20px; color: var(--muted); line-height: 1.5; }
    .login-card .button { width: 100%; margin-top: 12px; }
    .error { margin-top: 12px; color: var(--danger); font-size: 13px; }
    .toast {
      position: fixed; left: 50%; bottom: max(18px, env(safe-area-inset-bottom)); z-index: 100;
      width: min(480px, calc(100% - 28px)); transform: translateX(-50%); padding: 13px 15px;
      border: 1px solid var(--line); border-radius: 15px; background: var(--surface-solid); color: var(--text);
      box-shadow: var(--shadow); font-size: 13px;
    }

    @media (min-width: 900px) {
      .shell { padding-top: 30px; }
      .layout { grid-template-columns: minmax(0, 1.45fr) minmax(330px, .75fr); align-items: start; }
      .composer { padding: 34px; }
      .fields { grid-template-columns: 1fr 1fr; }
      .side { display: grid; gap: 18px; position: sticky; top: 22px; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
    }
  </style>
</head>
<body>
  <main id="loginView" class="login-wrap hidden">
    <form id="loginForm" class="card login-card">
      <div class="brand-mark">&lt;/&gt;</div>
      <h1>Developer-Konsole</h1>
      <p>Private Steuerung für Änderungen, Vorschau und Veröffentlichung von Project Life.</p>
      <label for="password">Admin-Passwort</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <button id="loginButton" class="button primary" type="submit">Anmelden</button>
      <div id="loginError" class="error hidden" role="alert"></div>
    </form>
  </main>

  <main id="appView" class="shell hidden">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">&lt;/&gt;</div>
        <div>
          <h1>Project Life Developer</h1>
          <p>Änderung → Build → Preview → Veröffentlichen</p>
        </div>
      </div>
      <div>
        <button id="themeButton" class="icon-button" type="button" aria-label="Darstellung wechseln">◐</button>
        <button id="logoutButton" class="icon-button" type="button" aria-label="Abmelden">↗</button>
      </div>
    </header>

    <div class="layout">
      <section class="card composer">
        <p class="eyebrow">Neue Änderung</p>
        <h2>Was soll angepasst werden?</h2>
        <p class="intro">Beschreibe den Fehler oder die gewünschte Änderung normal. Codex arbeitet nur im Frontend, prüft den Build und erstellt eine getrennte Vorschau.</p>

        <form id="changeForm">
          <label for="task">Änderung</label>
          <div class="textarea-wrap">
            <textarea id="task" name="task" maxlength="3000" placeholder="Beispiel: Auf dem iPhone überlappt der Fokus-Button mit der unteren Navigation. Verschiebe ihn nach oben, ohne die Desktop-Ansicht zu verändern." required></textarea>
            <button id="dictateButton" class="dictate hidden" type="button">Diktieren</button>
          </div>

          <div class="fields">
            <div>
              <label for="pageUrl">Betroffene Seite oder Route</label>
              <input id="pageUrl" name="pageUrl" maxlength="500" value="/" />
            </div>
            <div>
              <label>Zielansicht</label>
              <div id="viewportSegment" class="segment" role="group" aria-label="Zielansicht">
                <button type="button" data-value="mobile">Mobil</button>
                <button type="button" data-value="desktop">Desktop</button>
                <button type="button" data-value="all" class="active">Beide</button>
              </div>
            </div>
          </div>

          <div class="actions">
            <button id="createButton" class="button primary" type="submit">Vorschau erstellen</button>
            <button id="newButton" class="button hidden" type="button">Neue Änderung</button>
          </div>
        </form>

        <div class="security-note">
          <span>⌁</span>
          <span>Geschützte Dateien, API-Routen, Workflows, Schlüssel und Dependencies dürfen von Codex nicht verändert werden. Produktion ändert sich erst nach deiner Freigabe.</span>
        </div>
      </section>

      <aside class="side">
        <section id="statusCard" class="card status-card hidden">
          <div class="status-head">
            <div>
              <h3 id="statusTitle" class="status-title">Änderung wird vorbereitet</h3>
              <p id="statusCopy" class="status-copy">GitHub Actions startet den sicheren Arbeitslauf.</p>
            </div>
            <span id="statusPill" class="status-pill">Gestartet</span>
          </div>

          <div id="timeline" class="timeline"></div>
          <div id="externalLinks" class="links"></div>

          <div id="reviewActions" class="actions hidden">
            <button id="publishButton" class="button primary" type="button">Veröffentlichen</button>
            <button id="discardButton" class="button danger" type="button">Verwerfen</button>
          </div>
        </section>

        <section class="card history">
          <div class="history-head">
            <h3>Letzte Änderungen</h3>
            <button id="clearHistoryButton" class="icon-button" type="button" aria-label="Verlauf leeren">×</button>
          </div>
          <div id="historyList" class="history-list"></div>
        </section>
      </aside>
    </div>
  </main>

  <div id="toast" class="toast hidden" role="status"></div>

  <script>
    (() => {
      const HISTORY_KEY = 'project-life-developer-history-v1'
      const THEME_KEY = 'project-life-developer-theme'
      const POLL_MS = 7000

      const $ = selector => document.querySelector(selector)
      const loginView = $('#loginView')
      const appView = $('#appView')
      const loginForm = $('#loginForm')
      const loginButton = $('#loginButton')
      const loginError = $('#loginError')
      const changeForm = $('#changeForm')
      const taskInput = $('#task')
      const pageUrlInput = $('#pageUrl')
      const createButton = $('#createButton')
      const newButton = $('#newButton')
      const statusCard = $('#statusCard')
      const statusTitle = $('#statusTitle')
      const statusCopy = $('#statusCopy')
      const statusPill = $('#statusPill')
      const timeline = $('#timeline')
      const externalLinks = $('#externalLinks')
      const reviewActions = $('#reviewActions')
      const publishButton = $('#publishButton')
      const discardButton = $('#discardButton')
      const historyList = $('#historyList')
      const toast = $('#toast')

      let viewport = 'all'
      let activeChange = null
      let pollTimer = null
      let currentStatus = null

      function setTheme(theme) {
        const resolved = theme === 'system'
          ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : theme
        document.documentElement.dataset.theme = resolved
        localStorage.setItem(THEME_KEY, theme)
      }

      setTheme(localStorage.getItem(THEME_KEY) || 'system')

      $('#themeButton').addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
        setTheme(next)
      })

      function showToast(message) {
        toast.textContent = message
        toast.classList.remove('hidden')
        clearTimeout(showToast.timer)
        showToast.timer = setTimeout(() => toast.classList.add('hidden'), 3400)
      }

      async function api(path, options = {}) {
        const response = await fetch(path, {
          credentials: 'same-origin',
          headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {}),
          },
          ...options,
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          const error = new Error(data.error || `Anfrage fehlgeschlagen (${response.status})`)
          error.status = response.status
          throw error
        }
        return data
      }

      function getHistory() {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
      }

      function saveHistory(items) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 12)))
        renderHistory()
      }

      function upsertHistory(item) {
        const items = getHistory().filter(entry => entry.requestId !== item.requestId)
        saveHistory([{ ...item, updatedAt: new Date().toISOString() }, ...items])
      }

      function escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, char => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        })[char])
      }

      function renderHistory() {
        const items = getHistory()
        if (!items.length) {
          historyList.innerHTML = '<div class="empty">Noch keine Änderungen erstellt.</div>'
          return
        }

        historyList.innerHTML = items.map(item => `
          <button class="history-item" type="button" data-id="${escapeHtml(item.requestId)}">
            <strong>${escapeHtml(item.task || item.requestId)}</strong>
            <span>${escapeHtml(stageLabel(item.stage || 'queued'))} · ${new Date(item.updatedAt).toLocaleString('de-DE')}</span>
          </button>
        `).join('')

        historyList.querySelectorAll('[data-id]').forEach(button => {
          button.addEventListener('click', () => {
            const item = items.find(entry => entry.requestId === button.dataset.id)
            if (!item) return
            activeChange = item
            taskInput.value = item.task || ''
            pageUrlInput.value = item.pageUrl || '/'
            selectViewport(item.viewport || 'all')
            statusCard.classList.remove('hidden')
            newButton.classList.remove('hidden')
            startPolling()
          })
        })
      }

      function stageLabel(stage) {
        return ({
          queued: 'Wartet',
          working: 'Codex arbeitet',
          in_progress: 'Codex arbeitet',
          finalizing: 'Pull Request wird erstellt',
          waiting_preview: 'Preview wird deployed',
          preview_ready: 'Vorschau bereit',
          failed: 'Fehlgeschlagen',
          published: 'Veröffentlicht',
          discarded: 'Verworfen',
        })[stage] || 'In Bearbeitung'
      }

      function stageDescription(stage) {
        return ({
          queued: 'Der GitHub-Workflow wartet auf einen freien Runner.',
          working: 'Codex analysiert das Projekt, setzt die Änderung um und der Build wird geprüft.',
          in_progress: 'Codex analysiert das Projekt, setzt die Änderung um und der Build wird geprüft.',
          finalizing: 'Der Build ist erfolgreich. Branch und Pull Request werden fertiggestellt.',
          waiting_preview: 'Vercel baut gerade die getrennte Vorschau.',
          preview_ready: 'Öffne die Vorschau auf deinem Gerät. Erst danach veröffentlichen.',
          failed: 'Der Workflow ist fehlgeschlagen. Öffne den Lauf für die genaue Fehlermeldung.',
          published: 'Der Pull Request wurde in main übernommen. Vercel veröffentlicht die Produktionsversion.',
          discarded: 'Die Änderung wurde geschlossen und der Arbeitsbranch entfernt.',
        })[stage] || 'Status wird aktualisiert.'
      }

      function stepState(index, activeIndex, failed) {
        if (failed && index === activeIndex) return 'current'
        if (index < activeIndex) return 'done'
        if (index === activeIndex) return 'current'
        return ''
      }

      function renderStatus(data) {
        currentStatus = data
        const stage = data.stage || 'queued'
        const order = ['queued', 'working', 'waiting_preview', 'preview_ready', 'published']
        let activeIndex = order.indexOf(stage)
        if (stage === 'in_progress') activeIndex = 1
        if (stage === 'finalizing') activeIndex = 2
        if (stage === 'failed') activeIndex = data.pullRequest ? 2 : 1
        if (stage === 'discarded') activeIndex = 4
        if (activeIndex < 0) activeIndex = 0

        statusTitle.textContent = stageLabel(stage)
        statusCopy.textContent = stageDescription(stage)
        statusPill.textContent = stageLabel(stage)

        const steps = [
          ['Workflow gestartet', 'Auftrag sicher an GitHub übergeben'],
          ['Code geändert und geprüft', 'Codex, TypeScript und Produktions-Build'],
          ['Preview Deployment', 'Getrennte Vercel-URL ohne Änderung an Produktion'],
          ['Mobile Prüfung', 'Vorschau öffnen und Verhalten kontrollieren'],
          ['Veröffentlichung', 'Erst nach deiner ausdrücklichen Freigabe'],
        ]

        timeline.innerHTML = steps.map((step, index) => `
          <div class="step ${stepState(index, activeIndex, stage === 'failed')}">
            <div class="dot">${index < activeIndex ? '✓' : index + 1}</div>
            <div><strong>${step[0]}</strong><span>${step[1]}</span></div>
          </div>
        `).join('')

        const links = []
        if (data.run && data.run.url) links.push(`<a class="text-link" href="${escapeHtml(data.run.url)}" target="_blank" rel="noopener">GitHub-Lauf</a>`)
        if (data.pullRequest && data.pullRequest.url) links.push(`<a class="text-link" href="${escapeHtml(data.pullRequest.url)}" target="_blank" rel="noopener">Code-Änderungen</a>`)
        if (data.previewUrl) links.unshift(`<a class="text-link" href="${escapeHtml(data.previewUrl)}" target="_blank" rel="noopener">Live-Vorschau öffnen</a>`)
        if (stage === 'published') links.unshift('<a class="text-link" href="https://project-life-mobile.vercel.app/" target="_blank" rel="noopener">Produktion öffnen</a>')
        externalLinks.innerHTML = links.join('')

        const canReview = data.canPublish && data.pullRequest && data.pullRequest.state === 'open'
        reviewActions.classList.toggle('hidden', !canReview)
        publishButton.disabled = !canReview
        discardButton.disabled = !data.pullRequest && data.run.status === 'completed'

        upsertHistory({
          ...activeChange,
          stage,
          prNumber: data.pullRequest && data.pullRequest.number,
          previewUrl: data.previewUrl,
        })

        if (['published', 'discarded', 'failed'].includes(stage)) stopPolling()
      }

      async function pollStatus() {
        if (!activeChange) return
        try {
          const runQuery = activeChange.runId ? `&runId=${encodeURIComponent(activeChange.runId)}` : ''
          const data = await api(`/api/developer/change?id=${encodeURIComponent(activeChange.requestId)}${runQuery}`)
          if (data.runId) activeChange.runId = data.runId
          renderStatus(data)
        } catch (error) {
          if (error.status === 401) return showLogin()
          statusCopy.textContent = error.message
        }
      }

      function startPolling() {
        stopPolling()
        pollStatus()
        pollTimer = setInterval(pollStatus, POLL_MS)
      }

      function stopPolling() {
        if (pollTimer) clearInterval(pollTimer)
        pollTimer = null
      }

      function showLogin() {
        stopPolling()
        appView.classList.add('hidden')
        loginView.classList.remove('hidden')
        setTimeout(() => $('#password').focus(), 0)
      }

      function showApp() {
        loginView.classList.add('hidden')
        appView.classList.remove('hidden')
        renderHistory()
      }

      loginForm.addEventListener('submit', async event => {
        event.preventDefault()
        loginError.classList.add('hidden')
        loginButton.disabled = true
        loginButton.classList.add('loading')
        try {
          await api('/api/developer/session', {
            method: 'POST',
            body: JSON.stringify({ password: $('#password').value }),
          })
          $('#password').value = ''
          showApp()
        } catch (error) {
          loginError.textContent = error.message
          loginError.classList.remove('hidden')
        } finally {
          loginButton.disabled = false
          loginButton.classList.remove('loading')
        }
      })

      $('#logoutButton').addEventListener('click', async () => {
        await api('/api/developer/session', { method: 'DELETE' }).catch(() => {})
        showLogin()
      })

      function selectViewport(next) {
        viewport = next
        $('#viewportSegment').querySelectorAll('button').forEach(button => {
          button.classList.toggle('active', button.dataset.value === next)
        })
      }

      $('#viewportSegment').addEventListener('click', event => {
        const button = event.target.closest('[data-value]')
        if (button) selectViewport(button.dataset.value)
      })

      changeForm.addEventListener('submit', async event => {
        event.preventDefault()
        const task = taskInput.value.trim()
        if (task.length < 10) return showToast('Beschreibe die Änderung etwas genauer.')

        createButton.disabled = true
        createButton.classList.add('loading')
        createButton.textContent = 'Workflow startet'

        try {
          const data = await api('/api/developer/change', {
            method: 'POST',
            body: JSON.stringify({
              task,
              viewport,
              pageUrl: pageUrlInput.value.trim() || '/',
            }),
          })

          activeChange = {
            requestId: data.requestId,
            runId: data.runId,
            branch: data.branch,
            workflowUrl: data.workflowUrl,
            task,
            viewport,
            pageUrl: pageUrlInput.value.trim() || '/',
            stage: 'queued',
          }

          upsertHistory(activeChange)
          statusCard.classList.remove('hidden')
          newButton.classList.remove('hidden')
          renderStatus({
            stage: 'queued',
            run: { status: 'queued', conclusion: null, url: data.workflowUrl },
            pullRequest: null,
            previewUrl: null,
            canPublish: false,
          })
          startPolling()
        } catch (error) {
          if (error.status === 401) showLogin()
          else showToast(error.message)
        } finally {
          createButton.disabled = false
          createButton.classList.remove('loading')
          createButton.textContent = 'Vorschau erstellen'
        }
      })

      newButton.addEventListener('click', () => {
        stopPolling()
        activeChange = null
        currentStatus = null
        taskInput.value = ''
        statusCard.classList.add('hidden')
        newButton.classList.add('hidden')
        reviewActions.classList.add('hidden')
        taskInput.focus()
      })

      publishButton.addEventListener('click', async () => {
        if (!activeChange || !currentStatus || !currentStatus.pullRequest) return
        if (!confirm('Diese Änderung jetzt in die Produktionsversion übernehmen?')) return

        publishButton.disabled = true
        publishButton.classList.add('loading')
        try {
          const data = await api('/api/developer/publish', {
            method: 'POST',
            body: JSON.stringify({
              requestId: activeChange.requestId,
              runId: activeChange.runId,
              prNumber: currentStatus.pullRequest.number,
            }),
          })
          showToast('Veröffentlicht. Vercel baut jetzt die Produktionsversion.')
          renderStatus({ ...currentStatus, stage: 'published', canPublish: false, pullRequest: { ...currentStatus.pullRequest, state: 'closed', mergedAt: new Date().toISOString() } })
          if (data.productionUrl) window.open(data.productionUrl, '_blank', 'noopener')
        } catch (error) {
          showToast(error.message)
        } finally {
          publishButton.disabled = false
          publishButton.classList.remove('loading')
        }
      })

      discardButton.addEventListener('click', async () => {
        if (!activeChange) return
        if (!confirm('Änderung verwerfen und Arbeitsbranch entfernen?')) return

        discardButton.disabled = true
        discardButton.classList.add('loading')
        try {
          await api('/api/developer/discard', {
            method: 'POST',
            body: JSON.stringify({
              requestId: activeChange.requestId,
              runId: activeChange.runId,
              prNumber: currentStatus && currentStatus.pullRequest && currentStatus.pullRequest.number,
            }),
          })
          renderStatus({
            ...(currentStatus || { run: { status: 'completed', conclusion: 'cancelled', url: activeChange.workflowUrl }, pullRequest: null }),
            stage: 'discarded',
            canPublish: false,
          })
          showToast('Änderung verworfen.')
        } catch (error) {
          showToast(error.message)
        } finally {
          discardButton.disabled = false
          discardButton.classList.remove('loading')
        }
      })

      $('#clearHistoryButton').addEventListener('click', () => {
        if (!confirm('Lokalen Änderungsverlauf leeren?')) return
        saveHistory([])
      })

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const dictateButton = $('#dictateButton')
        dictateButton.classList.remove('hidden')
        dictateButton.addEventListener('click', () => {
          const recognition = new SpeechRecognition()
          recognition.lang = 'de-DE'
          recognition.interimResults = false
          recognition.maxAlternatives = 1
          dictateButton.textContent = 'Hört zu …'
          recognition.onresult = event => {
            const text = event.results[0][0].transcript
            taskInput.value = `${taskInput.value}${taskInput.value ? ' ' : ''}${text}`
          }
          recognition.onerror = () => showToast('Diktat konnte nicht gestartet werden.')
          recognition.onend = () => { dictateButton.textContent = 'Diktieren' }
          recognition.start()
        })
      }

      const from = new URLSearchParams(location.search).get('from')
      if (from) pageUrlInput.value = from.slice(0, 500)

      api('/api/developer/session')
        .then(data => data.authenticated ? showApp() : showLogin())
        .catch(showLogin)
    })()
  </script>
</body>
</html>

```

## Einrichtung

# Project Life Developer-Konsole

## 1. Dateien kopieren

Kopiere den Inhalt dieses Pakets in den Hauptordner des Repositorys `project-life-mobile`.

Die Struktur muss danach so aussehen:

```text
project-life-mobile/
├── .github/workflows/ai-change.yml
├── server/developer-admin.ts
├── api/
│   └── developer/
│       ├── session.ts
│       ├── change.ts
│       ├── publish.ts
│       └── discard.ts
└── projectdashboardv1/
    ├── index.html
    ├── vite.config.ts
    └── public/
        ├── developer-launcher.js
        └── developer/index.html
```

## 2. GitHub Actions Secret

GitHub öffnen:

```text
Repository → Settings → Secrets and variables → Actions → New repository secret
```

Anlegen:

```text
OPENAI_API_KEY = dein OpenAI API-Key
REPO_ADMIN_TOKEN = derselbe Fine-grained GitHub Token aus Schritt 3
```

## 3. Fine-grained GitHub Token

GitHub öffnen:

```text
Settings → Developer settings → Personal access tokens → Fine-grained tokens
```

Konfiguration:

```text
Repository access: Only select repositories
Repository: aboubasem1/project-life-mobile
```

Repository permissions:

```text
Actions: Read and write
Contents: Read and write
Pull requests: Read and write
Deployments: Read-only
Metadata: Read-only
```

## 4. Vercel Environment Variables

Vercel öffnen:

```text
Project Life → Settings → Environment Variables
```

Für Production, Preview und Development anlegen:

```text
DEV_ADMIN_SECRET = ein eigenes langes Admin-Passwort
GITHUB_ADMIN_TOKEN = der Fine-grained GitHub Token
```

`DEV_ADMIN_SECRET` sollte mindestens 24 zufällige Zeichen haben.

## 5. Deployen

Im Repository-Hauptordner:

```bash
git add .github api server projectdashboardv1/index.html projectdashboardv1/vite.config.ts projectdashboardv1/public/developer projectdashboardv1/public/developer-launcher.js
git commit -m "Add mobile AI developer console"
git push
```

Nach dem Vercel-Deployment öffnen:

```text
https://project-life-mobile.vercel.app/developer/
```

## 6. Developer-Button in der Haupt-App aktivieren

Einmal öffnen:

```text
https://project-life-mobile.vercel.app/?developer=1
```

Danach bleibt unten rechts ein kleiner `</>`-Button sichtbar.

Wieder ausblenden:

```text
https://project-life-mobile.vercel.app/?developer=0
```

## Ablauf

```text
Änderung beschreiben
→ GitHub Workflow startet
→ Codex ändert nur projectdashboardv1
→ npm run build wird geprüft
→ Pull Request wird erstellt
→ Vercel erstellt eine Preview
→ Vorschau öffnen
→ Veröffentlichen drücken
→ Merge in main
→ Vercel Production Deployment
```

## Wichtige Grenzen

Die Konsole blockiert automatische Änderungen an:

```text
.github/
api/
server/
vercel.json
projectdashboardv1/index.html
projectdashboardv1/vite.config.ts
projectdashboardv1/package.json
projectdashboardv1/package-lock.json
projectdashboardv1/public/developer/
projectdashboardv1/public/developer-launcher.js
.env-Dateien
```

Damit kann die AI die eigentliche App ändern, aber nicht ihre eigene Sicherheits- und Deployment-Infrastruktur.
