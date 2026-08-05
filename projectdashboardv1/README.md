# Life OS (Project Life)

Lokales Tages- und Gewohnheits-OS für geringe kognitive Last — ohne Cloud-Sync.

**Live:** https://project-life-mobile.vercel.app/

## Stack

- **React 19** + **TypeScript** + **Vite 7**
- **lucide-react** für Icons
- **vite-plugin-pwa** — installierbar als App
- **localStorage** — einzige Persistenz (Vollbackup per JSON-Export/Import)

Kein Supabase, kein Backend, keine Accounts. Frühere Cloud-Docs sind veraltet.

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

Einstellungen → **Backup exportieren / importieren**. Vollbackup enthält Tage, Settings, Labor und XP. Neuere Backup-Versionen als die App werden abgelehnt.

## Roadmap

Siehe [`docs/feature-roadmap.md`](docs/feature-roadmap.md). Phasen 1–4 sind umgesetzt. Phase 5 (KI) bleibt bewusst blockiert, bis Anbieter/Kosten geklärt sind.
