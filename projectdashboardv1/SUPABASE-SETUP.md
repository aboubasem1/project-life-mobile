# Cloud-Sync — nicht aktiv

Life OS verwendet **kein Supabase**. Primär arbeitet die PWA lokal im Browser (`localStorage`);
der optionale Geräte-Sync läuft in der bestehenden Vercel-Production über Upstash und in der
OVH-Zielarchitektur über PostgreSQL.

Ein früherer Supabase-Entwurf existiert nicht mehr im laufenden Code. Diese Datei bleibt
als Hinweis, falls jemand alte Links oder `.env`-Vorlagen findet:

- Keine `VITE_SUPABASE_*` Variablen nötig
- Keine SQL-Migrationen ausführen
- Keine Supabase-Tabellen oder SQL-Migrationen aus historischen Planungsdateien verwenden

Für Multi-Gerät-Nutzung den vorhandenen Geräte-Sync verwenden. JSON-Vollbackups bleiben als
zusätzlicher manueller Export erhalten.
