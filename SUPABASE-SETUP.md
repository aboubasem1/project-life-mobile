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
-- Tabelle für tägliche Einträge erstellen
CREATE TABLE daily_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  datum DATE NOT NULL UNIQUE,
  
  -- Morgen-Daten
  aufgestanden TIME,
  meditation_min INTEGER,
  cold_shower BOOLEAN,
  protein_shake BOOLEAN,
  deep_work_1_min INTEGER,
  deep_work_2_min INTEGER,
  
  -- Abend-Daten
  training BOOLEAN,
  schritte INTEGER,
  protein_gramm INTEGER,
  schlafen_gegangen TIME,
  bildschirmzeit_min INTEGER,
  wasser_liter DECIMAL(3,1),
  journal BOOLEAN,
  reading_min INTEGER,
  
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
