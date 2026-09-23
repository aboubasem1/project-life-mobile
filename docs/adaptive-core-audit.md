# Adaptive Core — Repository Audit

**Status:** IMPLEMENTED (audit complete; foundation implementation follows this document)  
**Repo:** `aboubasem1/project-life-mobile`  
**Primary app:** `projectdashboardv1/`  
**Audited:** 2026-09-23

## CURRENT STATE

### Frontend
- React 19 + TypeScript + Vite 7 PWA (`projectdashboardv1/`)
- Monolithic `App.tsx` (~8.2k lines) owns settings, Heute/NOW, gates, Lab, capture wiring
- Design tokens in `src/launch.css` (semantic CSS variables; ice/sage accents)
- Components under `src/components/` (MorningGate, EveningGate, Capture via `views/lifeos/CaptureSheet.tsx`)
- Local-first `localStorage` keys: entries, settings (`life-os-v1-settings`), LifeOS store, daily events, ritual progress

### Backend / sync
- Node 22 API modules in `server/` + Vercel `api/` wrappers
- PostgreSQL + Cloudflare R2 migration in progress (see `docs/infrastructure/`)
- Device sync via `/api/sync/*` (Upstash bridge still present)
- Auth: local user UUID; device-sync room tokens; developer console HMAC cookie (`DEV_ADMIN_SECRET`)

### AI / Jo
- Decision engine at `src/lib/decision-engine/` — rules → optional JEV → optional LLM
- Providers abstracted (`DecisionProviderAdapter`); validates with hand-rolled schemas (no Zod)
- Universal Capture routes through `decide` / `applyDecisionBatch`; Jo FAB opens CaptureSheet
- **No SYSTEM_CHANGE / config mutation path today** — Jo captures data, does not reconfigure LifeOS

### Routines / surfaces
- Morning ritual: `src/lib/morningGate.ts` — configurable `stepOrder`, `hiddenSteps`, timings
- Evening gate: `src/lib/eveningGate.ts` + close checks in `dayClose.ts`
- NOW: `selectNowItems` in `dailyFlow.ts` with hard-coded `GATE_ONLY_HABITS` + ritual/evening ownership exclusion
- Energy lives in Morning Gate step + Evening Gate state + day-close “Energie setzen” gap
- Weight: check-in / Lab / Heute stats — **not** a Morning Gate step yet

### Self-development (CODE_CHANGE precursor)
- `project-life-ai-developer/` + `/api/developer/*` + `.github/workflows/ai-change.yml`
- Isolated branch → Codex → build → PR → Vercel preview → merge
- Secrets: `OPENAI_API_KEY`, `REPO_ADMIN_TOKEN` / `GITHUB_ADMIN_TOKEN`, `DEV_ADMIN_SECRET`

### Tests / CI
- Vitest in `projectdashboardv1` (`npm test`, `typecheck`, `build`, `lint`)
- GitHub Actions: `ci.yml`, `deploy-ovh.yml`, `ai-change.yml`

## TARGET STATE

UI → Jo Orchestrator → Adaptation Engine → Life Model + Change Engine → Event Store → existing connectors.

Configuration-level changes apply without deploy. Code changes go through Development Engine + existing GitHub workflow. AI never mutates state directly.

## REUSABLE COMPONENTS

| Existing | Reuse as |
|---|---|
| `decision-engine` providers/flags/schemas | Jo classification + AIProvider abstraction |
| `MorningRitualConfig.stepOrder/hiddenSteps` | CONFIG_CHANGE targets |
| `EveningGateConfig.hiddenChecks` | CONFIG_CHANGE targets |
| `selectNowItems` + ownership helpers | Extend with surface dedupe policy |
| `dailyEvents` | Behavioral event stream base |
| `lifeos` store/types | Life Model entities (Capture, Task, Goal…) |
| Developer console + `ai-change.yml` | DevelopmentProvider backend |
| Hand-rolled validators | ChangeSpec / Life Model validation style |
| Settings localStorage + sync extras | Persist adaptive config |

## TECHNICAL DEBT

- Settings/`AppSettings` defined inside `App.tsx` (hard to share with engines)
- Hard-coded NOW gate-only sets vs. declarative surface config
- Decision intents lack CHANGE / SUGGEST / EXPERIMENT
- Energy duplication across gate / day-close without single ownership policy
- `project-life-ai-developer/` is a partial duplicate package (keep as reference; do not fork further)

## DUPLICATIONS

| Concern | Locations | Action |
|---|---|---|
| Energy | Morning step, evening state, day-close gap | Surface ownership config |
| Check-in (mood/sleep) | Morning `headRecovery`, Check-in view | Keep both; disclosure via config |
| Capture / Jo | CaptureSheet + quick-add + decision engine | Extend Capture; no second input |
| AI change | developer console vs adaptive Development Engine | Wrap existing APIs |
| Events | `dailyEvents` vs decision audits | Unify adaptive events alongside dailyEvents |

## MIGRATION RISKS

- Mutating `AppSettings` shape must stay backward-compatible (normalize missing adaptive blob)
- Adding Morning step `weight` requires exhaustive switch updates in `morningGate.ts` / UI
- Change apply must never touch medical truth fields without CRITICAL risk
- Sync: adaptive config rides inside settings JSON — ensure merge preserves it

## IMPLEMENTATION PLAN

1. Schemas + AdaptiveLifeConfig + surface/UI tokens  
2. ChangeEngine (validate/preview/apply/history/undo)  
3. Jo CHANGE routing + Change Preview UI + Capture integration  
4. NOW dedupe policy + semantic Lab UI config  
5. Adaptive events + adaptation suggestions + experiments (L1 default)  
6. DevelopmentEngine interface over existing GitHub workflow  
7. Tests, typecheck, build, docs alignment  
