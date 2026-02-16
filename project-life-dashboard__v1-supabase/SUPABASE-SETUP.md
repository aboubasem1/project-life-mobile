# Supabase Setup für Project Life Dashboard

## Schritt 1: Supabase-Projekt erstellen

1. Gehe zu https://supabase.com
2. Klicke auf "Start your project" (kostenlos)
3. Melde dich mit GitHub an
4. Klicke auf "New Project"
5. Gib ein:
   - **Name:** project-life
   - **Database Password:** (wähle ein sicheres Passwort - SPEICHERE ES!)
   - **Region:** Frankfurt (Germany) - am nächsten
6. Klicke auf "Create new project" (dauert ~2 Minuten)

## Schritt 2: Datenbank-Tabelle erstellen

1. In deinem Supabase-Projekt, gehe zu **SQL Editor** (linke Sidebar)
2. Kopiere diesen SQL-Code und führe ihn aus:

```sql
-- Tabelle für tägliche Einträge (Mobile App) erstellen
CREATE TABLE daily_entries (
   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
   datum DATE NOT NULL UNIQUE,

   -- Morgen-Daten
   am_training BOOLEAN,
   am_sleep_hours NUMERIC,
   am_sleep_quality_1_10 INTEGER,
   am_mood_1_10 INTEGER,
   am_weight_kg NUMERIC,
   am_focus_goal TEXT,
   am_winner_mode BOOLEAN,
   am_body_move BOOLEAN,

   -- Abend-Daten
   pm_training BOOLEAN,
   pm_sleep_hours NUMERIC,
   pm_sleep_quality_1_10 INTEGER,
   pm_mood_1_10 INTEGER,
   pm_weight_kg NUMERIC,
   pm_discipline_1_10 INTEGER,
   tasks_done INTEGER,
   deep_work_minutes INTEGER,
   revenue_eur NUMERIC,
   notes TEXT,

   -- Score & Streak (optional)
   score_zone_a INTEGER,
   score_mindset INTEGER,
   score_recovery INTEGER,
   streak_current INTEGER,
   streak_best INTEGER,

   created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
   updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index für schnellere Datumsabfragen
CREATE INDEX idx_daily_entries_datum ON daily_entries(datum DESC);

-- Automatisches Update von updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_daily_entries_updated_at BEFORE UPDATE ON daily_entries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security aktivieren (für später, wenn du Auth hinzufügst)
ALTER TABLE daily_entries ENABLE ROW LEVEL SECURITY;

-- Temporär: Erlaube allen Zugriff (für Entwicklung)
-- WICHTIG: Später durch echte Auth-Policies ersetzen!
CREATE POLICY "Enable all access for development" ON daily_entries
FOR ALL
USING (true)
WITH CHECK (true);
```

### Optional: Neue Tabelle für das v1 Dashboard

Wenn du das neue React Dashboard mit allen editierbaren Feldern nutzen willst, lege zusätzlich diese Tabelle an:

```sql
CREATE TABLE dashboard_entries (
   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
   entry_date DATE NOT NULL UNIQUE,

   mood TEXT,
   sleep_quality INTEGER,
   sleep_duration TEXT,
   meditation_minutes INTEGER,
   cold_shower BOOLEAN,
   protein_shake BOOLEAN,

   pushups_done BOOLEAN,
   squats_done BOOLEAN,
   wallsit_done BOOLEAN,
   plank_done BOOLEAN,

   gratitude_done BOOLEAN,
   focus_done BOOLEAN,
   winner_mode_done BOOLEAN,

   protein_grams INTEGER,
   calories INTEGER,
   tasks_done INTEGER,
   journal_done BOOLEAN,
   family_time_done BOOLEAN,

   created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
   updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_dashboard_entries_date ON dashboard_entries(entry_date DESC);

CREATE TRIGGER update_dashboard_entries_updated_at BEFORE UPDATE ON dashboard_entries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE dashboard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for development" ON dashboard_entries
FOR ALL
USING (true)
WITH CHECK (true);
```

3. Klicke auf "Run" (grüner Button)
4. Du solltest "Success. No rows returned" sehen

## Schritt 3: API-Schlüssel kopieren

1. Gehe zu **Project Settings** → **API** (linke Sidebar)
2. Kopiere diese beiden Werte:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon public key:** `eyJhbGc...` (langer String)

## Schritt 4: Werte in die App eintragen

Ich erstelle jetzt die angepassten Dateien. Du musst dann nur noch:

1. Die **Project URL** eintragen
2. Den **anon public key** eintragen

→ Dann synchronisieren sich alle Geräte automatisch! 🚀
