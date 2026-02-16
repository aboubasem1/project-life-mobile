# Project Life Dashboard – Supabase Sync Setup

## 🚀 Was ist neu?

Dein Dashboard synchronisiert sich jetzt **automatisch** zwischen:
- 📱 Mobile App (Handy/Tablet)
- 💻 Desktop Dashboard (Streamlit)
- ☁️ Supabase Cloud-Datenbank

**Kostenlos** und **sofort synchronisiert**!

---

## 📋 Setup-Schritte

### 1️⃣ Supabase-Projekt erstellen

Folge der Anleitung in **SUPABASE-SETUP.md**:
1. Projekt auf https://supabase.com erstellen
2. SQL-Code ausführen (erstellt Datenbank-Tabelle)
3. API-Schlüssel kopieren

### 2️⃣ Mobile App konfigurieren

1. Öffne die deployed App: https://project-life-mobile.vercel.app/
   (oder lokal: `index-supabase.html`)
2. Trage ein:
   - **Supabase URL:** `https://xxxxx.supabase.co`
   - **Supabase Anon Key:** `eyJhbGc...`
3. Klicke auf "Konfiguration speichern"
4. ✅ Fertig! Die App synchronisiert sich jetzt automatisch

### 3️⃣ Desktop Dashboard konfigurieren

1. **Erstelle `.env` Datei:**
   ```bash
   cd project-life-dashboard-de
   cp .env.example .env
   ```

2. **Trage deine Supabase-Daten ein:**
   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_KEY=eyJhbGc...
   ```

3. **Installiere Supabase-Package:**
   ```bash
   source .venv/bin/activate  # Falls nicht schon aktiviert
   pip install supabase
   ```

4. **Starte das Dashboard:**
   ```bash
   streamlit run app-supabase.py
   ```

---

## ✨ Features

### Mobile App (`index-supabase.html`)
- ✅ Auto-Sync bei jedem Speichern
- ✅ Offline-First (funktioniert auch ohne Internet)
- ✅ Sync-Status Anzeige (✓ Synced, ⟳ Syncing, ⚠ Offline)
- ✅ Morgen/Abend Tabs
- ✅ Responsive Design

### Desktop Dashboard (`app-supabase.py`)
- ✅ Live-Daten aus Supabase
- ✅ Analyse & Charts
- ✅ CSV Export
- ✅ Morgen/Abend Eingabe
- ✅ Automatische Sync

---

## 🔄 Deployment

### Mobile App auf Vercel aktualisieren

1. **Ersetze `index.html` mit der Supabase-Version:**
   ```bash
   cd "/Users/eliaspol/Desktop/Project Life"
   cp index-supabase.html index.html
   git add index.html
   git commit -m "Add Supabase sync to mobile app"
   git push
   ```

2. Vercel deployt automatisch die neue Version!

### Desktop Dashboard lokal nutzen

```bash
cd project-life-dashboard-de
source .venv/bin/activate
streamlit run app-supabase.py
```

---

## 🎯 Workflow

### Morgens (am Handy):
1. Öffne https://project-life-mobile.vercel.app/
2. Wähle Datum → Tab "Morgens"
3. Trage Daten ein
4. "Morgen speichern"
5. ✅ Wird sofort in Supabase gespeichert

### Abends (am Handy oder Desktop):
1. Öffne die App (Handy oder Desktop)
2. Wähle Datum → Tab "Abends"
3. Trage Daten ein
4. "Abend speichern"
5. ✅ Wird sofort synchronisiert

### Analyse (am Desktop):
1. Öffne Desktop-Dashboard
2. Tab "Analyse" → Siehst alle Daten in Charts
3. Tab "Daten" → CSV Export möglich

---

## 🔐 Sicherheit

- ✅ Deine Daten liegen in **deiner eigenen** Supabase-Datenbank
- ✅ Nur du hast Zugriff (mit deinen API-Keys)
- ✅ Kostenlos für immer (Supabase Free Tier)
- ✅ Row Level Security aktiviert (für später Auth)

---

## 🆘 Troubleshooting

### Mobile App zeigt "Nicht konfiguriert"
→ Trage Supabase URL & Key ein und klicke "Konfiguration speichern"

### Desktop Dashboard zeigt Fehler
→ Prüfe `.env` Datei: Sind URL und Key korrekt?
→ Installiere Supabase: `pip install supabase`

### Sync funktioniert nicht
→ Prüfe Internet-Verbindung
→ Prüfe Supabase-Projekt Status (https://supabase.com)
→ Prüfe Browser-Console für Fehler (F12)

---

## 📦 Dateien

- `index-supabase.html` → Mobile App mit Supabase
- `app-supabase.py` → Desktop Dashboard mit Supabase
- `SUPABASE-SETUP.md` → Detaillierte Supabase-Anleitung
- `.env.example` → Beispiel-Konfiguration

---

## 🎉 Du bist fertig!

Sobald du Supabase konfiguriert hast, synchronisieren sich **alle deine Geräte automatisch**!

Bei Fragen: Schau in die `SUPABASE-SETUP.md` oder frag mich! 🚀
