# Supabase Setup — Project Life Dashboard

## 1. Tabelle erstellen

Öffne **Supabase Dashboard → SQL Editor** und führe aus:

```sql
-- ─── daily_entries Tabelle ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_entries (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             text        NOT NULL,
  date                date        NOT NULL,

  -- Befinden & Schlaf
  mood                text        DEFAULT '',
  sleep_quality       text        DEFAULT '',
  sleep_duration      text        DEFAULT '',
  meditation_minutes  int         DEFAULT 0,

  -- Daily Habits (Gruppe: habits)
  cold_shower         boolean     DEFAULT false,
  protein_shake       boolean     DEFAULT false,
  pushups_done        boolean     DEFAULT false,
  squats_done         boolean     DEFAULT false,
  wallsit_done        boolean     DEFAULT false,
  plank_done          boolean     DEFAULT false,

  -- Mindset (Gruppe: mindset)
  gratitude_done      boolean     DEFAULT false,
  focus_done          boolean     DEFAULT false,
  winner_mode_done    boolean     DEFAULT false,

  -- Abend Ritual (Gruppe: evening)
  journal_done        boolean     DEFAULT false,
  family_time_done    boolean     DEFAULT false,

  -- Körper & Ernährung
  protein_grams       int         DEFAULT 0,
  calories            int         DEFAULT 0,
  water_liters        numeric(4,2) DEFAULT 0,
  weight_kg           numeric(5,2) DEFAULT 0,

  -- Work & Fokus
  deep_work_hours     numeric(4,2) DEFAULT 0,
  tasks_done          int         DEFAULT 0,

  -- Journal & Score
  journal_text        text        DEFAULT '',
  daily_score         int         DEFAULT 0,

  -- Timestamps
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),

  UNIQUE (user_id, date)
);

-- ─── Index für schnelle Abfragen ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_entries_user_date
  ON daily_entries (user_id, date DESC);

-- ─── Auto-Update für updated_at ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_daily_entries_updated_at ON daily_entries;
CREATE TRIGGER trg_daily_entries_updated_at
  BEFORE UPDATE ON daily_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 2. Row Level Security (RLS) aktivieren

```sql
-- RLS einschalten
ALTER TABLE daily_entries ENABLE ROW LEVEL SECURITY;

-- Anon-Zugriff: Nur eigene Daten lesen & schreiben
-- Da wir keine Auth nutzen, arbeiten wir mit user_id (per device-ID)
CREATE POLICY "Users see own entries"
  ON daily_entries FOR SELECT
  USING (true);

CREATE POLICY "Users insert own entries"
  ON daily_entries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users update own entries"
  ON daily_entries FOR UPDATE
  USING (true);
```

> **Hinweis:** Da diese App ohne Login-System arbeitet (user_id = zufällige UUID pro Gerät),
> erlauben die Policies allen Lesezugriff — aber jedes Gerät greift nur auf seine eigene
> user_id zu, da sie im Code gefiltert wird.
>
> Für mehr Sicherheit: Supabase Auth + JWT-basierte Policies ergänzen.

---

## 3. .env.local prüfen

Stelle sicher, dass in `projectdashboardv1/.env.local` steht:

```env
VITE_SUPABASE_URL=https://jdsojjjrxsknffuogdux.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-key-hier
```

Den Anon Key findest du unter **Supabase → Settings → API → Project API keys → anon public**.

---

## 4. Deployment auf Vercel

Die Root `vercel.json` ist bereits konfiguriert:

```json
{
  "cleanUrls": true,
  "buildCommand": "cd projectdashboardv1 && npm install && npm run build",
  "outputDirectory": "projectdashboardv1/dist",
  "installCommand": "echo 'deps installed in buildCommand'"
}
```

**Umgebungsvariablen in Vercel setzen:**

1. Vercel Dashboard → Projekt → Settings → Environment Variables
2. `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` eintragen
3. Redeploy

---

## 5. Datenbank-Schema prüfen

```sql
-- Alle Einträge anzeigen
SELECT user_id, date, daily_score, mood FROM daily_entries ORDER BY date DESC LIMIT 20;

-- Tabellenspalten prüfen
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'daily_entries' ORDER BY ordinal_position;
```
