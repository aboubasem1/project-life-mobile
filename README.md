# LifeOS / project-life-mobile

LifeOS is a mobile-first, local-first React PWA with optional device sync, health imports,
webhooks, voice transcription and a structured capture layer.

**Production (Reel-Import, Postgres, R2):** [vps-01d88277.vps.ovh.net](https://vps-01d88277.vps.ovh.net/).

The old Vercel fallback at [project-life-mobile.vercel.app](https://project-life-mobile.vercel.app/)
remains online but cannot create sync rooms or upload Reels. Use the OVH URL for the installed PWA.

## Stack

- React 19, TypeScript and Vite 7
- `vite-plugin-pwa` with generated service worker and manifest
- Node 22 API using the existing server/domain modules
- PostgreSQL for synchronized structured state and object metadata
- private Cloudflare R2 bucket for files
- Caddy for static delivery, reverse proxy and automatic HTTPS once a hostname is set
- Docker Compose on a single OVH VPS
- GitHub Actions for verified, automatic, rollback-capable deployment

## Local verification

```bash
npm ci
npm --prefix projectdashboardv1 ci
npm --prefix projectdashboardv1 run typecheck
npm --prefix projectdashboardv1 test
npm --prefix projectdashboardv1 run build
npm --prefix projectdashboardv1 run build:server
```

Frontend development continues as before:

```bash
npm --prefix projectdashboardv1 run dev
```

## Infrastructure documentation

- [Repository audit and dependency map](docs/infrastructure/DEPENDENCY_MAP.md)
- [Migration and cutover plan](docs/infrastructure/MIGRATION_PLAN.md)
- [Operations, backup, restore and rollback](docs/infrastructure/OPERATIONS.md)

