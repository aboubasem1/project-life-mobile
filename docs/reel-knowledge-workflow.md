# Reel → Knowledge review workflow

## What is implemented

LifeOS now has a review-first Reel inbox inside **Knowledge → Reels**.

1. Select up to 50 videos from Photos, Files, or the Mac picker. Large files use a smaller round so the phone can finish the transfer.
2. The browser uploads directly to the private object store. Keep LifeOS open until the transfer reaches 100%.
3. Registration creates a PostgreSQL job. The API worker transcribes and reviews the video after the upload, even if the phone is locked.
4. A low-cost model extracts title, summary, topics and atomic claims.
5. TypeSafe JEV suggests relevance, risk, Life Area and whether the item fits Knowledge,
   a guideline, source-only, or rejection.
6. Useful claims receive a web evidence check. Provider failures fail closed to
   `REVIEW_REQUIRED`; they never become “true” by default.
7. The user reviews the transcript, claims, sources, category and notes.
8. Low-risk candidates can be approved in a batch. High-risk items stay on the single-item review.
9. Publishing writes a stable Knowledge draft. The device stores it in the existing LifeOS Knowledge collection and syncs it. The same reel cannot create a second item, and a later publish does not overwrite edits.

The full transcript stays on the reel record. Knowledge items keep a short summary, labeled claims, and the tag `reel:<id>`.

Search runs on the device over titles, summaries, topics and text, in German and English. A sync push also refreshes a PostgreSQL full-text index for that room only. Vector search stays off unless pgvector and embeddings are both enabled; until then similar wording is matched by token overlap. Relation suggestions are accepted explicitly and do not replace a life area you set yourself.

## Why JEV helps

JEV handles the high-volume, bounded decisions that are cheap to express as choices:

- useful / unclear / not useful;
- Knowledge / guideline / source-only / reject;
- low / medium / high risk;
- one existing Life Area.

It does not invent categories, edit the database directly, verify truth, or publish. If JEV is
unavailable, the item is retained as source-only and shown for manual review.

## Safety and recovery

- SHA-256 catches exact duplicates up to 128 MB without an extra dependency. Larger files still
  upload but skip client-side hashing to avoid excessive browser memory.
- Upload errors remain visible and can be selected again. Failed server jobs can be retried; permanent media errors are not retried forever.
- A crashed worker releases its lock after 25 minutes. Listing reels does not fail a job that is still running.
- Every registration, processing result, review and publish transition is written to the audit table.
- Optimistic versions prevent two tabs from silently overwriting the same review.
- Original videos stay private. The server processes one object in a temporary directory and
  deletes the temporary copy afterwards.

## Production requirements

- OVH Docker deployment (the API image now includes FFmpeg)
- PostgreSQL
- private R2 bucket or the configured local object-store fallback
- `OPENAI_API_KEY` (transcription, extraction, optional evidence search)
- `TYPESAFE_API_KEY` or `JEV_API_KEY` (JEV triage)

Keep `JEV_AUTO_ACTIONS_ENABLED=false`. The API process starts the reel worker. Useful limits: `REEL_WORKER_CONCURRENCY` (default 1, max 2), `REEL_JOB_MAX_ATTEMPTS` (default 4), `REEL_DAILY_JOB_LIMIT` (default 400), `REEL_WORKER_ENABLED=false` to pause it.

Cost for 300 reels is not a fixed invoice. Each reel spends one transcription call for its audio duration (`gpt-4o-mini-transcribe` unless `TRANSCRIPTION_MODEL` is set), one extraction call (`gpt-4o-mini` unless overridden), optional frame reading, and a fact-check call only when usefulness is at least 40. Multiply the current OpenAI prices for those models by measured minutes and call counts. A retry reuses a saved transcript and completed analysis instead of calling those steps again.

See [`docs/infrastructure/INTEGRATIONS_SETUP.md`](infrastructure/INTEGRATIONS_SETUP.md) for variables.
