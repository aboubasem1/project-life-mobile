# Reel import 2.0 — Phase 1

Implementation branch only. Do not infer production availability from this document.
Baseline inspected: `6ece2e41362e2063fcb3682ec250051f7577b062` (unchanged main at audit).
Phase 2–4 remain gated on Phase 1 verification.

## iPhone journey after deployment verification

1. Open Knowledge → **Reels importieren**.
2. Select up to 50 videos from Photos or Files, then tap **Videos importieren**.
3. Keep LifeOS visible until transfers finish. Transfers run one at a time to bound mobile memory.
4. The server registers each completed transfer and queues processing atomically. Only a recent
   worker heartbeat enables the message that processing continues after closing LifeOS.
5. Return later. Status refreshes every five seconds while the import panel is visible.
6. Filter by status, Life Area or risk. Select up to 50 results and confirm one batch action.
   Bulk publication accepts only low-risk Knowledge candidates; rejected batch members remain visible.
7. Alternatively open one item, review its claims and select **Prüfung bestätigen & Wissen übernehmen**.
8. The canonical Knowledge item appears immediately. Its source section loads original transcript,
   screen text and evidence on demand. Other paired devices obtain the same deterministic ID via sync.

Safari/PWA cannot silently enumerate Photos or guarantee uploads while suspended. Interrupted
transfers require re-selection. There is no byte-range resume. Receipts retain object IDs before
upload; reopening attempts server-side completion (size verification) and registration without
re-uploading a successfully transferred object. Lost/deleted browser storage can lose these receipts;
registered Reels remain on the server. Failed transfers never appear as completed Reels.

## Persistence and ownership

| Object | Authority / uniqueness | Update, retention, recovery |
|---|---|---|
| `lifeos_reels`, objects, claims, audit | Existing server records, authenticated room | Original transcript/media retained. No automatic source deletion. Versions guard review writes. |
| `lifeos_reel_jobs` | Server; one job per Reel, room-owned | queued/running/done/failed; retries preserve extraction, analysis and verification artifacts. Rows retained with the Reel, cascade only if an administrator deletes the source. |
| `lifeos_reel_publications` | Immutable delivery record, not an editable knowledge store; one Reel → one `reel:<uuid>` ID | Payload version 1 and approved Reel version retained. Replay inserts only absent canonical objects; existing edits win. The canonical snapshot containing the ID is the delivery acknowledgment. Retained for offline-device recovery; source deletion restricted. |
| `lifeos_reel_workers` | Operational heartbeat, no user content | Random worker ID; heartbeat every five seconds, healthy for 45 seconds. Old records pruned after a day. |
| `KnowledgeItem.reelSource` | Existing local-first canonical Knowledge, propagated by existing sync | Additive reference to private Reel/object, risk and evidence status; no transcript/video binaries in snapshots. |
| `LifeOsState.deletedKnowledgeIds` | Canonical deletion acknowledgments | Union-merged and retained so publication replay/offline devices do not resurrect deleted Knowledge. Source and audit remain. |
| Browser import receipt | Room-scoped localStorage, transport recovery only | Object ID, filename, size, checksum, created timestamp; removed after registration. No signed URLs, tokens or video bytes retained. Up to 300 pending receipts. |

Schema changes are additive and idempotent. Existing processing/unfinished uploaded Reels without
jobs are adopted at schema initialization. Existing Knowledge records normalize without new fields.
PostgreSQL snapshot writes serialize per room and merge against the latest persisted LifeOS state.
The existing Redis bridge remains intact; production should use PostgreSQL as its authoritative backend.

## Worker

The worker starts in `server/http.ts` inside the existing OVH API container after schema readiness.
There is no new daemon or dependency. Work claiming uses a short transaction, `FOR UPDATE SKIP LOCKED`
and a session advisory lock. A live worker cannot be stolen solely because its heartbeat is old.
All pipeline writes use the lock-owning connection; loss of that connection fences further writes.
After a dead worker's heartbeat is two minutes old, a new worker can reclaim it. Retry exhaustion
becomes a visible permanent failure. Manual retry starts another bounded attempt cycle.

Defaults (configurable in the existing Docker environment):

- `REEL_WORKER_ENABLED=true`
- `REEL_WORKER_CONCURRENCY=1` (maximum 3 per API process)
- `REEL_MAX_ATTEMPTS=3` (maximum 5 per retry cycle)
- `REEL_DAILY_LIMIT=100` (attempt starts per room, database calendar day, maximum 1000)

At the default daily limit, 300 successful imports can require three processing days. Set a
reviewed budget of 300 or more to process the collection in one day; retries also consume attempts.
Daily budget checks serialize across workers. The UI identifies waiting for the next daily allowance.
Backoff starts at 30 seconds, doubles, and caps at one hour. Provider calls remain bounded by their
existing timeouts; FFmpeg has a two-minute kill timeout and restricted demuxers/protocols.

`/api/health` includes `reelWorker.available`. Authenticated Reel listings expose job state,
attempts, retry availability and safe errors. Logs contain job IDs, attempt counts and error categories,
not transcripts, API keys or raw provider errors. Audit rows record job attempts, retries and publishing.

Exact hashes are computed in a stream on the server for every processed file. Client SHA-256 is
limited to 32 MiB to avoid mobile memory spikes. Large-file duplicates are detected before paid
processing. Concurrent registration is conflict-safe. A crash during a paid request may still cause
one repeated provider call before its result could be persisted; exactly-once external billing is
not promised.

## Safety

Existing JEV, extraction and evidence providers are reused. Medical/legal/financial/safety claim
categories escalate to high risk. High-risk publication and guidelines require nonempty supported
claims with HTTPS evidence. Source-only entries are never trusted instructions. Import text is
explicitly treated as untrusted provider input. No tool execution or Change Engine mutation is
available from the ingestion pipeline. Approved/published sources cannot be overwritten by a stale
review; subsequent user edits belong to the canonical Knowledge item.

## Validation and deployment

From `projectdashboardv1` run `npm run typecheck`, `npm test`, `npm run build`,
`npm run build:server`, `npm run lint`.

`server/reel-import.integration.test.ts` uses real PostgreSQL and mocked paid providers. Supply
`TEST_DATABASE_URL` pointing to a test database; it creates and deletes an isolated schema. Without
that variable these tests explicitly skip. CI provisions PostgreSQL 17 and runs them. Tests cover
registration races, incomplete uploads, room isolation, normal/OCR processing, retry artifact reuse,
live-worker lock protection, stale-worker recovery, exhausted retries, idempotent publication,
canonical sync, edits/deletion, evidence gates, partial batches and 300 queued imports.

`server/reel-media.test.ts` uses real FFmpeg with generated normal, silent and corrupt media. It
skips explicitly if FFmpeg is absent. Silent videos shorter than eight seconds are regression-tested.
Physical iPhone Photos/Files, HEVC, suspended Safari/PWA transfer and real OVH restart checks remain
separate acceptance checks; mocked providers and desktop tests cannot certify them.

Deploy only after review and CI checks through the existing Deploy OVH workflow. Do not run this
worker in the Vercel fallback. Check PostgreSQL, private R2, FFmpeg, provider credentials and a fresh
worker heartbeat. Then smoke-test an actual video, close the browser after transfer, verify completion,
restart the API during another job and check recovery, and publish on two paired devices.

Rollback: redeploy the previous image; keep additive tables and data. Disable the new worker before
running the old synchronous processor. Do not run old and new processing versions concurrently.

## Cost model for 300 Reels

Checked 2026-10-23 against [official OpenAI pricing](https://developers.openai.com/api/docs/pricing).
The published estimated transcription rate for `gpt-4o-mini-transcribe` is USD 0.003/minute.
For average duration d minutes, transcription estimate = `300 × d × 0.003`:
30-second average ≈ USD 0.45; 60-second average ≈ USD 0.90; 90-second average ≈ USD 1.35.
These are transcription-only estimates, not the total import bill.

Total = transcription + analysis input/output tokens at the configured model's current rates + OCR
image/text tokens + JEV charges + evidence-search calls and tokens + storage. Official web search
is USD 10/1000 calls plus tokens; 300 calls alone add USD 3.00. One verification request may make
multiple searches. For mini models the documented non-preview search-content charge uses 8,000 input
tokens per call. Actual totals require measured token usage, verification frequency, selected models,
JEV tariff and R2 account pricing; no exact all-in total has been established.
