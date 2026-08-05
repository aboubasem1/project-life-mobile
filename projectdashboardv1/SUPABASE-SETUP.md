# Cloud-Sync — nicht aktiv

Life OS speichert **nur lokal** im Browser (`localStorage`) und per JSON-Backup.

Ein früherer Supabase-Entwurf existiert nicht mehr im laufenden Code. Diese Datei bleibt
als Hinweis, falls jemand alte Links oder `.env`-Vorlagen findet:

- Keine `VITE_SUPABASE_*` Variablen nötig
- Keine SQL-Migrationen ausführen
- Sync-Status in der UI meint „Lokal auf diesem Gerät“, nicht Cloud

Für echte Multi-Gerät-Nutzung: regelmäßig Vollbackup exportieren und auf dem anderen Gerät importieren — oder später bewusst eine Sync-Architektur wählen (nicht in Phase 5-KI vermischen).
