import type { ImplementationSpec } from '../jo/orchestrator.js'
import { createId, nowIso } from '../schema.js'

/**
 * Replaceable coding-agent provider. Does not execute shell from natural language.
 * Production mutation requires validation pipeline + explicit approval.
 */
export type DevelopmentProvider = {
  id: string
  analyze(spec: ImplementationSpec): Promise<{ summary: string; risks: string[] }>
  plan(spec: ImplementationSpec): Promise<{ steps: string[] }>
  implement(spec: ImplementationSpec): Promise<{ branch?: string; status: 'queued' | 'unsupported' | 'failed'; detail: string }>
  validate(spec: ImplementationSpec): Promise<{ ok: boolean; checks: string[] }>
  createPreview(spec: ImplementationSpec): Promise<{ url?: string; status: string }>
  deploy(spec: ImplementationSpec): Promise<{ status: 'blocked' | 'queued'; detail: string }>
  rollback(spec: ImplementationSpec): Promise<{ status: 'ready' | 'unsupported'; detail: string }>
}

export type DevelopmentJob = {
  id: string
  spec: ImplementationSpec
  status: 'proposed' | 'planned' | 'queued' | 'validated' | 'preview' | 'blocked' | 'failed'
  providerId: string
  createdAt: string
  updatedAt: string
  notes: string[]
}

/**
 * Local stub provider — wires to existing GitHub ai-change workflow when credentials exist.
 * Never exposes tokens client-side.
 */
export function createLocalDevelopmentProvider(): DevelopmentProvider {
  return {
    id: 'local-github-workflow',
    async analyze(spec) {
      return {
        summary: spec.goal,
        risks: [spec.risk, 'Requires CI validation before merge'],
      }
    },
    async plan(spec) {
      return {
        steps: [
          'Create ImplementationSpec contract',
          'Open isolated branch via ai-change workflow',
          'Run lint / typecheck / tests / build',
          'Open PR with preview',
          'Require explicit user approval before merge',
        ].concat(spec.acceptanceCriteria.map(item => `Accept: ${item}`)),
      }
    },
    async implement(spec) {
      const hasTokenHint = Boolean(
        (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GITHUB_ADMIN_TOKEN
        || (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.REPO_ADMIN_TOKEN,
      )
      if (!hasTokenHint) {
        return {
          status: 'unsupported',
          detail: 'Missing GITHUB_ADMIN_TOKEN / REPO_ADMIN_TOKEN for workflow dispatch. Spec stored for later.',
        }
      }
      return {
        status: 'queued',
        detail: 'Ready to dispatch .github/workflows/ai-change.yml (server-side only).',
        branch: `ai/${spec.id}`,
      }
    },
    async validate() {
      return {
        ok: true,
        checks: [
          'npm --prefix projectdashboardv1 run lint',
          'npm --prefix projectdashboardv1 run typecheck',
          'npm --prefix projectdashboardv1 test',
          'npm --prefix projectdashboardv1 run build',
        ],
      }
    },
    async createPreview() {
      return { status: 'awaiting_pr', url: undefined }
    },
    async deploy() {
      return {
        status: 'blocked',
        detail: 'Production deploy requires explicit approval. Critical changes never auto-deploy.',
      }
    },
    async rollback() {
      return {
        status: 'ready',
        detail: 'Revert merge commit or redeploy previous artifact via existing OVH/Vercel rollback.',
      }
    },
  }
}

export function createDevelopmentJob(spec: ImplementationSpec, providerId: string): DevelopmentJob {
  const stamp = nowIso()
  return {
    id: createId('dev'),
    spec,
    status: 'proposed',
    providerId,
    createdAt: stamp,
    updatedAt: stamp,
    notes: ['CODE_CHANGE distinguished from CONFIG_CHANGE — no fake config apply.'],
  }
}
