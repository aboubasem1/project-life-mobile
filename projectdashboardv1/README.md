# Project Life Dashboard

Persoenliches Gewohnheits- und Produktivitaets-Dashboard mit Supabase Cloud-Sync und PWA-Support.

## Stack

- **React 19** + **TypeScript 5.9** + **Vite 7**
- **Supabase** -- Cloud-Sync, offline-kompatibel
- **Chart.js 4** -- Wochenscore + Verlaufsdiagramme
- **vite-plugin-pwa** -- Installierbar als App (iOS/Android/Desktop)

## Features

- **Today View** -- Morgens/Abends Tabs: Habits, Schlaf, Ernaehrung, Deep Work, Journal
- **Stats View** -- KPI-Grid, Wochenchart, Habit-Streaks, Score-Verlauf
- **Score-System** -- 100 Punkte taeglich (76 Habit-Punkte + 24 Numeric-Thresholds)
- **Offline-First** -- LocalStorage als Fallback, Sync-Queue fuer offline Aenderungen
- **PWA** -- Installierbar, Service Worker mit Supabase Network-First Caching

## Setup

### 1. Dependencies installieren

```bash
npm install
```

### 2. Umgebungsvariablen

Erstelle `.env.local` im Projektordner:

```env
VITE_SUPABASE_URL=https://dein-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=dein-VITE_SUPABASE_ANON_KEY=dein-VITE_DatenbVITE_SUPABASE_ANON_KEY=dein-VITE_SUPABASE_ANON_KEY=dein-VITE_DatenbVITE_SUPABASE_ANON_KE# 4. LokaleV Dev-Server

```bash
npm run dev
```

Oeffne http://Oeffne http://Oeffne http://Oeffne http://Obash
nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnneviennnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnneviennnnnnnnnn ist fertig konfigurnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnneviennnnnnnnnnnnnnnnnnnnnnnnnnnnnnr Setnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnneviennnnnnnnnnnnnnn
src/
  types/         DashboardEntry.ts -- Alle Typen, HABITS-Array
  lib/           sc  lib/           sc  lib/           sc  lib/           sc  lib/           supabase+Loc  lib/           sc  lib/           sc  lib/           sc  lib/          rts/      ScoreG  lib/           sc  lib/   views/  lib/   DashboardView.tsx, StatsView.tsx
  App.tsx        -- View-Routing, TopBar
  App.css        -- Alle Sty  App.css        ```
