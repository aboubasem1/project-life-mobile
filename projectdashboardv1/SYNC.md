# Geräte-Sync (Life OS)

Nach **einmaligem Koppeln** synchronisieren sich Tage, Settings, Labor, XP und Kurznotiz automatisch.

## Lokal testen

```bash
cd projectdashboardv1 && npm run dev
```

Der Vite-Dev-Server stellt `/api/sync/*`, `POST /api/hooks` und `GET /api/health` bereit und speichert Räume in `projectdashboardv1/.data/life-os-sync.json`.

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
https://upstash.com/start-redis/console/e5671dba-c50c-4d8b-a21d-388c73cd0f4d


## Nutzung

1. Gerät A → Einstellungen → **Dieses Gerät als Start koppeln** → 6-stelligen Code notieren  
2. Gerät B → **Mit Code verbinden**  
3. Fertig — Speichern pusht, App-Öffnen / Fokus / jede Minute pullt

## Incoming Webhook

Nach dem Koppeln: Einstellungen → **Webhook**. Kurzbefehle oder andere Tools schreiben direkt in den Sync-Raum. Die App holt die Änderung beim nächsten Pull.

```bash
curl -X POST https://DEINE-DOMAIN/api/hooks \
  -H "Content-Type: application/json" \
  -d '{"roomId":"...","deviceToken":"...","type":"log","proteinGrams":180}'
```

Typen: `log` (Felder), `quick` (Freitext wie `180g protein`), `task` (`title`). Optional `date` als `YYYY-MM-DD`, sonst heute (Europe/Berlin).

```bash
curl https://DEINE-DOMAIN/api/health
```
