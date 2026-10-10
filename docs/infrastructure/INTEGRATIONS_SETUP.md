# LifeOS integrations — activate R2, Upstash, OpenAI, Transcription

Put these in GitHub → Settings → Secrets and variables → Actions
(environment **production** if the Deploy OVH job uses it).

After they are set, push to `main` (or re-run **Deploy OVH**). The workflow writes
non-empty values into `/opt/lifeos/shared/.env` and rebuilds.

## Cloudflare R2 (files + off-box backups)

| Secret / var | Where to get it |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare → R2 → Overview |
| `R2_ACCESS_KEY_ID` | R2 → Manage R2 API Tokens (Object Read & Write on `lifeos-production`) |
| `R2_SECRET_ACCESS_KEY` | same token |
| `R2_ENDPOINT` | optional; else built as `https://<accountid>.r2.cloudflarestorage.com` |
| `R2_BUCKET` (variable, optional) | default `lifeos-production` |
| `R2_REGION` (variable, optional) | default `auto` |

Create a **private** bucket `lifeos-production`. CORS for `https://vps-01d88277.vps.ovh.net`
(or your final hostname): methods `PUT,GET,HEAD`; header `Content-Type`; expose `ETag`.

Once R2 credentials exist, the API prefers R2 over local disk. Local storage remains the
fallback when R2 is not configured.

## Upstash Redis (sync bridge during cutover)

| Secret | Where to get it |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash console → Redis → REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | REST TOKEN |

Keep the same values on **Vercel** while the bridge is active.
Deploy keeps `SYNC_UPSTASH_BRIDGE=true` unless you set the repo variable to `false`.

## OpenAI / LLM fallback

| Secret | Notes |
|---|---|
| `OPENAI_API_KEY` | Chat Completions access |
| `LLM_API_KEY` | optional override; falls back to OpenAI key |
| `LLM_API_URL` | optional; default OpenAI chat completions |
| `LLM_MODEL` | optional; deploy defaults to `gpt-4o-mini` |

Deploy defaults `JEV_LLM_FALLBACK_ENABLED=true` so Jev can fall back to the LLM on complex items.

## Transcription

| Secret | Notes |
|---|---|
| `OPENAI_API_KEY` **or** `TRANSCRIPTION_API_KEY` | Audio Transcriptions |
| `TRANSCRIPTION_API_URL` | optional Whisper-compatible endpoint |
| `TRANSCRIPTION_ENABLED` | optional; deploy defaults to `true` |

Language/model defaults: `de` / `gpt-4o-mini-transcribe`.

## Reel knowledge inbox

The reel importer runs on the OVH API container because it needs FFmpeg and processing time.
It is intentionally not routed through the 15-second Vercel fallback.

| Variable | Default | Purpose |
|---|---|---|
| `TYPESAFE_API_KEY` or `JEV_API_KEY` | required for JEV | cheap relevance, target, risk, and Life Area triage |
| `JEV_ENABLED` | `true` | enables suggestions; never publishes content |
| `JEV_AUTO_ACTIONS_ENABLED` | `false` | must remain off for the review-first workflow |
| `REEL_ANALYSIS_MODEL` | `gpt-4o-mini` | title, summary, topics, and atomic claims |
| `REEL_OCR_ENABLED` | `true` | samples up to six frames when little speech is detected |
| `REEL_OCR_MODEL` | `gpt-4o-mini` | reads visible text from sampled frames |
| `REEL_FACTCHECK_ENABLED` | `true` | verifies useful claims with web search; failures fall back to manual review |
| `REEL_FACTCHECK_MODEL` | `gpt-4.1-mini` | evidence verification model |

The pipeline skips paid web verification for clearly low-value reels. A claim can only be
marked supported when at least one HTTPS source is returned. High-risk or incomplete claims
remain review-required. Approval creates an `APPROVED_CANDIDATE`; there is no publish endpoint.

**Saving a key is not enough — it must reach the running app:**

1. **OVH (production):** set the secret in GitHub Actions (environment **production**), then push to `main` or re-run **Deploy OVH**. The workflow writes `/opt/lifeos/shared/.env` only on deploy.
2. **Vercel:** set the same key under Project → Settings → Environment Variables for **Production** (and Preview if you test there), then **Redeploy**. Serverless functions do not pick up new env vars until the next deployment.
3. Paste the key without quotes or trailing spaces (`sk-...` only).

Quick check after redeploy:

```bash
# tiny payload → 400 incomplete is OK (proves route is up)
curl -sS -X POST https://vps-01d88277.vps.ovh.net/api/transcribe \
  -H 'Content-Type: application/json' \
  -d '{"audioBase64":"AAAA","mimeType":"audio/webm"}'

# real audio should return {"transcript":"..."} not 401/503/429
```

| Live error | Meaning |
|---|---|
| `Spracherkennung ist falsch konfiguriert` | Key missing/invalid on that host (common on Vercel before redeploy) |
| `OpenAI-Quota ist leer` / `ausgelastet` | Key accepted but OpenAI billing/rate-limit blocks Whisper |
| `Transkription ist gerade nicht verfügbar` | No key in process env / `TRANSCRIPTION_ENABLED=false` |

## Minimal “go live” set

1. `OPENAI_API_KEY` → unlocks Whisper + LLM fallback  
2. `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` → bridge  
3. `R2_ACCOUNT_ID` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` → cloud files  

TypeSafe (`TYPESAFE_API_KEY`) is already in use for Jev.

## Verify after deploy

```bash
curl -sS https://vps-01d88277.vps.ovh.net/api/health
```

Expect `objectStorage.status: ok` and, with R2 configured, a real bucket name (not only
`ovh-local`). Voice capture should transcribe when a key is present; sync bridge needs
Upstash on both OVH and Vercel.
