# LifeOS infrastructure audit

Audit basis: repository `aboubasem1/project-life-mobile`, branch `main`, commit
`32fd83063845a48df16a1edbd9bc827473aa55f4`, inspected on 22 September 2026.

## Confirmed current state

- The production build is `projectdashboardv1/`: React 19, TypeScript, Vite 7 and npm.
- Vercel builds the static app and exposes 12 TypeScript serverless functions from `api/`.
- The public production URL, manifest, service worker and `/api/health` respond successfully.
- The production health endpoint currently reports `storage: upstash`.
- Primary browser persistence is `localStorage`; device sync stores a merged JSON snapshot in Upstash.
- There is no active Supabase client or SQL migration despite stale historical planning files.
- There are no cron jobs and no object-storage integration in the current production code.
- Universal Capture currently stores small attachments as base64 data URLs in browser state.
- The repository contains a second, partial copy under `project-life-ai-developer/`; it is not the
  Vercel production build path.

## Dependency map

| Feature | Current infrastructure | Vercel dependency | Migration | Target component |
|---|---|---:|---|---|
| Web UI, Now, routines, Daily Stats, meals, labs | Vite static bundle | Static hosting/build | Build unchanged and serve the same `dist` | Caddy web container |
| Mobile/PWA | Vite PWA manifest, Workbox service worker | HTTPS hosting | Preserve generated artifacts and cache rules | Caddy over HTTPS |
| Daily data and settings | Browser `localStorage` | None | Retain offline-first state; sync remains additive | Browser plus PostgreSQL sync |
| Device pairing and sync | `/api/sync/*`, Upstash Redis | Serverless functions and Vercel env | PostgreSQL becomes primary; temporary Upstash bridge preserves rooms and fallback | Node API plus PostgreSQL |
| Fitdays/Apple Health import | `/api/health/ingest` | Serverless function | Reuse existing handler without payload changes | Node API |
| Incoming quick hooks | `/api/hooks` | Serverless function | Reuse existing handler | Node API |
| Universal Capture text | local LifeOS state, optional sync | Optional `/api/decision` | Preserve decision flow | Browser plus Node API |
| Capture attachments | base64 in `localStorage` and sync snapshot | None | Presigned upload with small local fallback | Private R2 plus PostgreSQL metadata |
| Voice transcription | `/api/transcribe` rewritten to `/api/decision?mode=transcribe` | Vercel function limit and env | Expose direct route on OVH; retain Vercel rewrite | Node API plus configured provider |
| Jo/decision providers | rules, optional Typesafe JEV and OpenAI-compatible LLM | Serverless runtime/env | Reuse server-only providers | Node API |
| Integration webhooks | Implemented in `sync-router.ts`; not all have Vercel wrappers | Partial | Unified router exposes them | Node API |
| Developer console | Static `/developer`, four `/api/developer/*` functions | Vercel functions, GitHub token, secure cookie | Route the same handlers through Node | Caddy plus Node API |
| Database | None; Upstash holds whole-room JSON | Upstash env | Add relational room/object metadata tables; preserve snapshot schema as JSONB during safe cutover | PostgreSQL |
| Object storage | None | None | S3-compatible abstraction and private presigned URLs | Cloudflare R2 |
| Backups | Manual JSON export only | None | Daily compressed PostgreSQL dump with 7/4/3 retention | Backup container plus R2 |
| CI | GitHub Actions typecheck/test/build | Vercel auto-deploy runs separately | Keep CI and add gated OVH deployment | GitHub Actions |

## Environment variables found in code

Existing server variables include Upstash, OpenAI/transcription, JEV/Typesafe, LLM,
`DEV_ADMIN_SECRET` and `GITHUB_ADMIN_TOKEN`. New OVH-only variables are PostgreSQL and R2
settings listed in `.env.example`. All stay server-side. Only the credential-free `VITE_` JEV
feature flags can enter the frontend bundle.

## Security findings to resolve before final cutover

1. The GitHub repository is currently public and tracks personal health-related text files under
   `01_health/`. Making the repository private is recommended before OVH becomes primary. The new
   deployment uploads a commit archive from GitHub Actions, so the VPS does not need repository
   credentials after that change.
2. Existing pull requests placed room and device tokens in the URL query string. The migrated client
   now sends both through headers; the API retains query compatibility only for older clients.
3. The current CORS policy is permissive. Same-origin OVH traffic is safe behind Caddy, but origin
   restriction should be enabled after the final hostname is known.
4. Raw-IP HTTP is suitable only for infrastructure smoke tests. Service workers, secure cookies and
   microphone access require a trusted HTTPS origin for a complete iPhone/PWA test.
