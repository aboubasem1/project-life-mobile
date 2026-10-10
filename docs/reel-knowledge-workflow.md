# Reel → Knowledge review workflow

## What is implemented

LifeOS now has a review-first Reel inbox inside **Knowledge → Reels**.

1. Select up to 50 videos from the Mac file picker.
2. The browser uploads two at a time directly to the private object store.
3. The API extracts small mono audio with FFmpeg and transcribes it. If little or no speech is
   detected, it samples up to six frames and reads visible on-screen text.
4. A low-cost model extracts title, summary, topics and atomic claims.
5. TypeSafe JEV suggests relevance, risk, Life Area and whether the item fits Knowledge,
   a guideline, source-only, or rejection.
6. Useful claims receive a web evidence check. Provider failures fail closed to
   `REVIEW_REQUIRED`; they never become “true” by default.
7. The user reviews the transcript, claims, sources, category and notes.
8. Approval creates only an `APPROVED_CANDIDATE`. Final publishing is deliberately absent.

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
- Upload errors remain visible and can be selected again. Failed server processing can be retried.
- Every registration, processing result and review transition is written to the audit table.
- Optimistic versions prevent two tabs from silently overwriting the same review.
- Original videos stay private. The server processes one object in a temporary directory and
  deletes the temporary copy afterwards.

## Production requirements

- OVH Docker deployment (the API image now includes FFmpeg)
- PostgreSQL
- private R2 bucket or the configured local object-store fallback
- `OPENAI_API_KEY` (transcription, extraction, optional evidence search)
- `TYPESAFE_API_KEY` or `JEV_API_KEY` (JEV triage)

Keep `JEV_AUTO_ACTIONS_ENABLED=false`. See
[`docs/infrastructure/INTEGRATIONS_SETUP.md`](infrastructure/INTEGRATIONS_SETUP.md) for variables.
