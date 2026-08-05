# Geräte-Sync (Life OS)

Nach **einmaligem Koppeln** synchronisieren sich Tage, Settings, Labor, XP und Kurznotiz automatisch.

## Lokal testen

```bash
cd projectdashboardv1 && npm run dev
```

Der Vite-Dev-Server stellt `/api/sync/*` bereit und speichert Räume in `projectdashboardv1/.data/life-os-sync.json`.

## Production (Vercel)

Env-Variablen (bereits lokal in `.env.local`):

```text
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

In Vercel eintragen (nach `vercel login`):

```bash
cd "/Users/eliaspol/Desktop/Project Life"
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
# ggf. auch preview / development
```

Temporäre Redis-DB (72h) claimen, sonst verfällt sie:
https://upstash.com/start-redis/console/4e9fe165-9f10-4acf-86fc-7dc87b2831e1


## Nutzung

1. Gerät A → Einstellungen → **Dieses Gerät als Start koppeln** → 6-stelligen Code notieren  
2. Gerät B → **Mit Code verbinden**  
3. Fertig — Speichern pusht, App-Öffnen / Fokus / jede Minute pullt
