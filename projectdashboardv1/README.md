# Life OS (Project Life)

Local-first Tages- und Gewohnheits-OS für geringe kognitive Last — offline nutzbar,
mit optionalem Geräte-Sync und externen Imports.

**Live:** https://project-life-mobile.vercel.app/

## Stack

- **React 19** + **TypeScript** + **Vite 7**
- **lucide-react** für Icons
- **vite-plugin-pwa** — installierbar als App
- **localStorage** als primäre Offline-Persistenz
- **Node API + PostgreSQL** auf OVH für Geräte-Sync, Webhooks und Health-Ingest
- **Cloudflare R2** für private Capture-Dateien; kleine Dateien fallen auf Vercel weiterhin lokal zurück
- **Vercel Functions + Upstash Redis** bleiben während der Migration als funktionierender Fallback bestehen

Es gibt bewusst keine Accounts. Ohne Kopplung bleibt alles lokal; nach dem Koppeln
wird ein privater Sync-Raum über Geräte-Token verwendet. Details stehen in
[`SYNC.md`](SYNC.md).

## Was die App macht

| Bereich | Inhalt |
|---|---|
| **Heute** | Energie, Next-Step, Tagesanker, Habits, Soft-Mode / Recovery |
| **Plan** | Anker ordnen (max. 5), Fokusdauer |
| **Check-in** | Schlaf (Bett/Aufstehen), Makros, Gewicht, Wasser, Schritte, Journal |
| **Verlauf** | Wochenreview, Heatmap, Habit Strength, Gewicht/BMI, Monatskalender |
| **Labor** | Todos/Boards, Listen, Bestände, Medis, Ziele, Kaufliste, Stats, Finanzen |

**Tagesanker** = der schlanke Tageskern (Heute/Plan).  
**Labor-Todos/Boards** = Verwaltung daneben — bewusst getrennt, damit die Startseite nicht überlädt.

## Setup

```bash
cd projectdashboardv1
npm install
npm run dev
```

Öffne http://localhost:5173/

Build:

```bash
npm run build
npm run preview
```

## Daten & Backup

- Einträge: `project-life-entries`
- Settings: `life-os-v1-settings`
- Labor: `life-os-v1-dashboard-plus`
- XP: `lifeos-xp-v1`

Einstellungen → **Backup exportieren / importieren**. Vollbackup v4 enthält Tage,
Settings, Labor, XP, Körpermessungen, Kurznotiz, Morgenritual-Fortschritt und das
append-only Tagesereignisprotokoll. Neuere Backup-Versionen als die App werden abgelehnt.

## Optionaler Sync und Automatisierung

- Geräte koppeln: Einstellungen → **Geräte-Sync**
- externe Einträge: `POST /api/hooks`
- Apple Health / Fitdays: `POST /api/health/ingest`
- Store prüfen: `GET /api/health`

Vercel benötigt weiterhin `UPSTASH_REDIS_REST_URL` und `UPSTASH_REDIS_REST_TOKEN`.
Die parallele OVH-Installation nutzt PostgreSQL und kann Upstash vorübergehend als Migrationsbrücke
lesen und spiegeln. Lokale Einrichtung, Auth-Header und Beispiele: [`SYNC.md`](SYNC.md).

## Roadmap

Siehe [`docs/feature-roadmap.md`](docs/feature-roadmap.md). Phasen 1–4 sind umgesetzt. Phase 5 (KI) bleibt bewusst blockiert, bis Anbieter/Kosten geklärt sind.
