# Geräte-Sync (Life OS)

Nach **einmaligem Koppeln** synchronisieren sich Tage, Settings, Labor, XP und Kurznotiz automatisch.

## Lokal testen

```bash
cd projectdashboardv1 && npm run dev
```

Der Vite-Dev-Server stellt `/api/sync/*`, `POST /api/hooks` und `GET /api/health` bereit.

Mit lebender Upstash-DB (`.env.local`) gehen lokale Writes in Redis — derselbe Raum wie Production. Ohne Redis oder wenn Redis tot ist, fällt lokal auf `projectdashboardv1/.data/life-os-sync.json` zurück.

`GET /api/health` macht einen echten Redis-`PING`. `ok: true` + `storage: upstash` heißt: der Store antwortet. `503` heißt: Production hat keinen Store.

## Production (Vercel)

Env-Variablen (lokal in `.env.local`, gitignored):

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

Aktuelle Redis-DB ist geclaimt (Free-Tier, kein 72h-Ablauf). Konsole: [Upstash Console](https://console.upstash.com/).
Alte Agent-DBs von `upstash.com/start-redis` ohne Claim sterben nach 3 Tagen — diese hier nicht mehr.


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

Typen: `log` (Felder), `quick` (Freitext wie `180g protein`), `task` (`title`), `note` (Journal + Kurznotiz). Optional `date` als `YYYY-MM-DD`, sonst heute (Europe/Berlin).

Ray-Ban Meta / Meta AI: Diktat an dich selbst (WhatsApp oder Notizen) → iOS-Kurzbefehl POST `type: "note"` mit `text`. Die App holt Journal und Kurznotiz beim nächsten Pull.

```bash
curl -X POST https://DEINE-DOMAIN/api/hooks \
  -H "Content-Type: application/json" \
  -d '{"roomId":"...","deviceToken":"...","type":"note","text":"Idee vom Gehen"}'
```

```bash
curl https://DEINE-DOMAIN/api/health
```
