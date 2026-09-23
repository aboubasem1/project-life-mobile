# Development Engine

**Status:** PARTIAL (clean interface + local provider; GitHub dispatch requires secrets)

Location: `projectdashboardv1/src/lib/adaptive-core/development/provider.ts`

## Pipeline

CODE_CHANGE → ImplementationSpec → isolated branch → coding agent → lint/typecheck/tests/build → preview → approval → merge/deploy → rollback

## Provider interface

`DevelopmentProvider`: `analyze`, `plan`, `implement`, `validate`, `createPreview`, `deploy`, `rollback`

Existing GitHub workflow: `.github/workflows/ai-change.yml` + `/api/developer/*`.

## Required secrets (server-side only)

| Variable | Purpose |
|---|---|
| `DEV_ADMIN_SECRET` | Developer console session HMAC |
| `GITHUB_ADMIN_TOKEN` / `REPO_ADMIN_TOKEN` | Workflow dispatch + PR |
| `OPENAI_API_KEY` | Coding agent in `ai-change.yml` |

Without tokens, ImplementationSpecs are still generated and stored; implement() returns `unsupported` with the exact missing variable — no fake CONFIG_CHANGE.
