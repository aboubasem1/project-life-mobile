# LifeOS operations

## Services

| Service | Purpose | Public port |
|---|---|---:|
| `web` | Caddy, static PWA, API reverse proxy and HTTPS | 80/443 |
| `api` | Sync, health ingest, hooks, decisions, transcription, developer API and private object storage | none |
| `db` | PostgreSQL | none |
| `backup` | Scheduled compressed database dumps to OVH and, when configured, R2 | none |

PostgreSQL and the API are reachable only on the internal Compose network.

## One-time host setup

After the VPS has been inspected and SSH key access has been verified:

```bash
sudo DEPLOY_USER="$USER" sh infrastructure/scripts/bootstrap-server.sh
LIFEOS_DEPLOY_ROOT=/opt/lifeos sh infrastructure/scripts/init-secrets.sh
```

`bootstrap-server.sh` does not disable password login unless `HARDEN_SSH=true` is explicitly set
and an authorized key already exists. Test a second SSH session before enabling that option.

The protected runtime file is `/opt/lifeos/shared/.env`. Edit it only on the VPS. Values that must
be transferred from existing production are the active Upstash variables and whichever AI,
transcription, Typesafe/JEV and developer-console variables are actually configured in Vercel.
The credential-free `VITE_JEV_*` values are build-time flags and are passed to the web image.

## Object storage and R2 configuration

The first OVH deployment uses the persistent `object_data` Docker volume with short-lived,
HMAC-signed upload and download URLs. This keeps uploads private and fully functional while R2
credentials are not yet available. `OBJECT_STORAGE_SIGNING_SECRET` is generated automatically on
the VPS and never committed.

R2 remains the target off-server backend. Once its credentials are configured, the same API uses
R2 without a frontend change:

- Bucket: `lifeos-production`
- Access: private
- API: S3-compatible endpoint for the Cloudflare account
- Token scope: object read/write for this bucket only
- Browser CORS: allow the final LifeOS HTTPS origin; methods `PUT`, `GET`, `HEAD`; headers
  `Content-Type`; expose `ETag`; use a short cache duration

R2 secret keys exist only in `/opt/lifeos/shared/.env`. The browser receives a short-lived URL for
one object operation and never receives storage credentials.

During the Vercel fallback period, the same bucket-scoped R2 variables are also configured as
server-only Vercel environment variables. Storage requests are folded into the existing Decision
Function, preserving the 12-function limit. Remove those Vercel variables only after the fallback
is formally retired.

Object prefixes are `profile/`, `meals/`, `labs/`, `documents/`, `captures/`, `media/`, `exports/`
and `backups/database/`.

## Healthchecks

- `GET /healthz`: static web/reverse-proxy liveness
- `GET /api/health/live`: API process liveness
- `GET /api/health`: PostgreSQL and R2 readiness without hostnames, credentials or stack traces

Expected production response. During the OVH-local stage, `objectStorage.status` is still `ok`:

```json
{
  "service": "life-os",
  "status": "ok",
  "ok": true,
  "storage": "postgres",
  "database": { "status": "ok" },
  "objectStorage": { "status": "ok" }
}
```

## Deployment

The OVH workflow is inert until repository variable `OVH_DEPLOY_ENABLED` is `true`.

Repository variables:

- `OVH_DEPLOY_ENABLED`
- `OVH_HOST`
- `OVH_USER`
- `OVH_SSH_PORT`
- `OVH_DEPLOY_PATH`

GitHub Actions secrets:

- `OVH_SSH_PRIVATE_KEY`
- `OVH_KNOWN_HOSTS`

Every enabled push to `main` installs dependencies, typechecks, runs 105+ tests, builds web and API,
verifies the API container, uploads a tracked-file archive over SSH, builds commit-tagged images on
OVH, starts them and checks Web/API/PostgreSQL/R2. The `current` symlink changes only after success.

## Rollback

If deployment health fails, `remote-deploy.sh` starts the prior commit-tagged images and leaves the
`current` symlink unchanged. Releases and images are intentionally retained until the migration has
stabilized.

Manual rollback is performed only after identifying the desired existing release:

```bash
cd /opt/lifeos/current
LIFEOS_IMAGE_TAG="$(basename "$(readlink -f /opt/lifeos/current)")" \
  docker compose --project-name lifeos --env-file /opt/lifeos/shared/.env up -d
```

## Backups

The backup container runs at 03:15 Europe/Berlin by default. `pg_dump` custom format is already
compressed. Copies are written to the persistent OVH `backup_data` volume until R2 is configured,
then to R2:

- `backups/database/daily/` — newest 7
- `backups/database/weekly/` — newest 4
- `backups/database/monthly/` — newest 3

Run one on demand:

```bash
docker compose --project-name lifeos --env-file /opt/lifeos/shared/.env exec backup \
  /usr/local/bin/backup-database.sh
```

## Restore

A restore replaces database state and is therefore never part of automatic deployment. Download the
chosen dump into a protected temporary directory, stop write traffic, take a fresh safety backup and
then run `pg_restore` inside the database container. Validate `/api/health` and LifeOS data before
resuming normal use.

## Routine updates

- Application updates: push to `main` after review.
- Container base updates: rebuild through the same workflow.
- Ubuntu security updates: apply during a planned maintenance window.
- PostgreSQL major upgrades: take and verify a dump before changing the image major version.
- Disable `SYNC_UPSTASH_BRIDGE` only after Vercel fallback is no longer needed.
