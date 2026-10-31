# LifeOS production audit

**Date:** 2026-10-31  
**Auditor:** autonomous recovery agent  
**Production URL:** https://vps-01d88277.vps.ovh.net  
**Deployed revision (origin/main):** `17c57c4`  
**Local workspace:** fast-forwarded to match `origin/main`

Status legend: **WORKING** | **PARTIAL** | **BROKEN** | **BLOCKED** | **NOT IMPLEMENTED** | **NOT VERIFIED**

Classification rule: code existence alone is never WORKING. Evidence required (live probe, CI deploy, or automated test covering the path).

---

## 0. Executive summary

Production is healthy and already includes several Reel/PWA recovery commits after the Oct 23 R2 proxy fix:

| Commit | Topic |
|---|---|
| `b361d77` | Same-origin R2 upload proxy (iPhone Safari CORS bypass) |
| `9c3e0ff` | Durable import receipts + registration recovery (#38) |
| `1bd3ccb` | Mobile Reel Knowledge / streaming upload policy (#39) |
| `77f4418` | PWA refresh after Reel deploys + health `reelProcessing` (#40) |
| `73ff630` / `17c57c4` | Sync pairing schema bootstrap isolation |

Live `/api/health` (2026-10-31): `ok`, postgres ok, objectStorage ok, `reelProcessing.worker=ok`, transcription/analysis/jev all `configured`.

Highest remaining risk for the user’s goal (~300 Instagram Reels on iPhone): **physical device end-to-end with real Photos videos is NOT VERIFIED**. Native Apple HealthKit / EventKit are **NOT IMPLEMENTED** (PWA cannot do them).

---

## 1. Repository / deploy

| Field | Value |
|---|---|
| Existing implementation | GitHub Actions `deploy-ovh.yml` on push to `main`; CI workflow present |
| Relevant files | `.github/workflows/deploy-ovh.yml`, `ci.yml`, `r2-cors.yml`, `ovh-smoke.yml` |
| Backend endpoints | N/A |
| Database | PostgreSQL on OVH Compose |
| Env | GitHub production environment secrets/vars (R2, OpenAI, TypeSafe, OVH SSH) |
| Current verified | Latest Deploy OVH for `17c57c4` **success** (2026-10-29). Health 200. |
| Missing | Physical iPhone acceptance by agent |
| Root cause of prior failures | VPS downtime (SSH timeout); R2 CORS AccessDenied for bucket PutCors; browser PUT to R2 failed |
| Required changes | Continue P1–P3 polish; keep proxy path |
| Test result | **WORKING** (deploy + health) |

---

## 2. Frontend architecture

| Field | Value |
|---|---|
| Existing | Vite + React PWA in `projectdashboardv1/` |
| Relevant files | `src/App.tsx`, `src/views/lifeos/*`, `vite.config.ts` (PWA plugin) |
| Status | **WORKING** shell; Knowledge / Reels / Jo capture surfaces present |
| Verified | Production index 200; `#knowledge` renders Reels importieren button (browser, 2026-10-31) |

---

## 3. Backend / API

| Field | Value |
|---|---|
| Entry | `server/http.ts` → `server/sync-router.ts` |
| Endpoints | `/api/health`, `/api/health/live`, `/api/health/ingest`, `/api/sync/*`, `/api/storage/*`, `/api/reels*`, `/api/knowledge/search`, `/api/decision`, `/api/transcribe`, `/api/hooks`, `/api/integrations/outbound` |
| Status | **WORKING** for health/storage/reels routing |
| Verified | Live health JSON includes `reelProcessing` |

---

## 4. Auth / device sync

| Field | Value |
|---|---|
| Existing | Pairing via `/api/sync/create` + `/api/sync/join`; credentials in `life-os-v1-device-sync` |
| Relevant files | `server/sync-store.ts`, `server/sync-core.ts`, `projectdashboardv1/src/lib/deviceSync.ts` |
| Env | `DATABASE_URL` / PG*; optional Upstash bridge |
| Current verified | Pairing works after schema bootstrap fixes; Reel APIs require room + device token |
| Missing | Agent cannot use user’s existing production room without credentials |
| Status | **WORKING** (create/join path); real multi-device longevity **NOT VERIFIED** |

---

## 5. Knowledge module

| Field | Value |
|---|---|
| Existing | Local-first Knowledge in LifeOS store; optional server FTS via sync; Jo `tryAnswerKnowledgeQuery` |
| Relevant files | `KnowledgeView.tsx`, `lib/lifeos/*`, `lib/adaptive-core/jo/knowledge-query.ts`, `server/knowledge-index.ts` |
| Endpoints | `/api/knowledge/search` (room-scoped) |
| Current verified | Unit tests for knowledge-query; empty Knowledge UI on fresh browser profile |
| Missing | End-to-end search against reel-published cards on production room |
| Status | **PARTIAL** — client search/Jo retrieval implemented; production content depends on user data + sync |

---

## 6. Reel import (iPhone)

| Field | Value |
|---|---|
| Existing | `ReelImportPanel`, `lib/reels/*`, durable receipts `import-session.ts`, proxy upload, worker jobs |
| Files | `ReelImportPanel.tsx`, `lib/reels/api.ts`, `server/reel-api.ts`, `reel-jobs.ts`, `reel-policy.ts`, `reel-analysis.ts`, `storage-api.ts` |
| Endpoints | presign → **proxy-upload** → complete → `/api/reels/register` → process/batch/publish |
| Env | `OPENAI_API_KEY` / transcription; `TYPESAFE_API_KEY` or `JEV_API_KEY`; R2 keys; `REEL_*` |
| Verified | Upload proxy path (Oct 23); health reelProcessing configured; unit tests 20 passing for reel/storage/http-policy |
| Missing | Cancel in-flight upload UI; physical iPhone multi-select of ~300 Photos videos; real transcript→publish E2E on device |
| Root causes fixed | R2 CORS; interrupted register; mobile Knowledge/nav; PWA stale cache; sync bootstrap |
| Remaining gaps | No per-item cancel during XHR; no native Photos API (browser picker only); genuine video E2E **NOT VERIFIED** |
| Status | **PARTIAL** (pipeline + recovery WORKING in agent/browser tests; iPhone Photos E2E **NOT VERIFIED**) |

### Acceptance checklist mapping (Phase 1)

| # | Criterion | Status |
|---|---|---|
| 1 | PWA opens video picker | **NOT VERIFIED** (physical); UI button present **WORKING** in browser |
| 2 | Multiple Reels selectable | Code `multiple` + batch planner **WORKING**; device **NOT VERIFIED** |
| 3 | Upload success | Proxy path **WORKING** (smoke); real Photos files **NOT VERIFIED** |
| 4 | Upload failures clear | Error rows in panel **WORKING** (code) |
| 5 | Server continues after PWA close | Jobs + receipts design **WORKING**; long-run **NOT VERIFIED** |
| 6 | Real transcription | Provider configured on health; real video call **NOT VERIFIED** this session |
| 7 | Structured AI analysis | Pipeline + JEV configured; real output **NOT VERIFIED** |
| 8 | Knowledge cards persist | Publish bridge exists; production publish **NOT VERIFIED** |
| 9 | No duplicate cards | SHA-256 + policy **WORKING** (tests/code) |
| 10 | Search finds imports | Local/Jo path **PARTIAL**; production **NOT VERIFIED** |

---

## 7. Transcription / AI providers

| Field | Value |
|---|---|
| Existing | `transcription-core.ts`, reel analysis, JEV triage, LLM fallback via `/api/decision` |
| Env | `OPENAI_API_KEY`, `TRANSCRIPTION_*`, `TYPESAFE_API_KEY` / `JEV_*`, `LLM_*` |
| Verified | Health reports transcription/analysis/jev `configured` |
| Status | **WORKING** (config present); content quality **NOT VERIFIED** |

---

## 8. Jo AI

| Field | Value |
|---|---|
| Existing | Universal Capture / Jo FAB; decision engine (rules → JEV → LLM); knowledge-query with citations; Change Engine preview/apply |
| Files | `App.tsx` Jo handlers, `lib/decision-engine/*`, `lib/adaptive-core/jo/*`, `docs/jo-orchestrator.md` |
| Endpoints | `/api/decision`, `/api/transcribe` |
| Verified | Docs claim IMPLEMENTED routing; unit tests exist; live chat with real provider **NOT VERIFIED** this session |
| Missing | Production smoke: general Q, Knowledge Q, action preview on device |
| Status | **PARTIAL** |

---

## 9. Storage

| Field | Value |
|---|---|
| Existing | R2 preferred; local signed fallback; **`/api/storage/proxy-upload`** for browser PUTs |
| Files | `object-storage.ts`, `storage-api.ts`, `http-policy.ts` (stream PUT) |
| Verified | Health objectStorage ok; proxy used when R2 configured |
| Note | `r2-cors.yml` cannot PutBucketCors (AccessDenied on object token) — proxy remains the supported path |
| Status | **WORKING** (proxy + health) |

---

## 10. PWA / iPhone reliability

| Field | Value |
|---|---|
| Existing | `vite-plugin-pwa`; deploy revision / cache refresh work in #40 |
| Verified | App loads on mobile viewport; Morning Gate overlays Knowledge until skipped |
| Missing | Stale SW on user devices until refresh; physical Home Screen install **NOT VERIFIED** |
| Status | **PARTIAL** |

---

## 11. Morning Gate / weight / Apple Health

| Field | Value |
|---|---|
| Existing | Morning Gate weight step; `bodyMeasurement` sources include `apple_health` / manual / hook; health ingest API |
| Files | `MorningGate.tsx`, `bodyMeasurement.ts`, `health-ingest-core.ts`, `/api/health/ingest` |
| Native HealthKit | **NOT IMPLEMENTED** (PWA cannot) |
| Bridge | Webhook/hook + Health Auto Export style JSON documented in settings |
| Status | Manual weight **WORKING** (code); Apple Health auto **PARTIAL** (ingest path only); HealthKit **NOT IMPLEMENTED** |

---

## 12. Apple Calendar / Reminders

| Field | Value |
|---|---|
| Existing | Local month calendar UI; ICS export helpers; decision domain hint `calendar` |
| EventKit | **NOT IMPLEMENTED** |
| Status | **NOT IMPLEMENTED** for two-way Apple sync; local planning UI **PARTIAL** |

---

## 13. Priority order for remaining work

1. **P1** — Physical iPhone E2E + cancel/retry polish for uploads  
2. **P2** — Live Jo provider + Knowledge citation smoke on production  
3. **P3** — Confirm PWA update path after deploy on installed Home Screen  
4. **P4** — Document Health Auto Export / hook as supported path; no fake HealthKit  
5. **P5** — Calendar only after P1–P2 critical acceptance  
