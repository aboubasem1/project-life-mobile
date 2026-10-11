# Generational Run — Status

Stand: 11.10.2026. Lokale Umsetzung. Kein Deployment.

## Phase A — Befund

Geprüft im Arbeitsbaum `main` (`32fd830` plus diese lokalen Änderungen). Keine fremden uncommitted Änderungen an App-Code.

| Bereich | Status | Beleg |
|---|---|---|
| Anmeldung | vorhanden und geprüft | Keine Accounts. Daten liegen lokal. Nach Kopplung ein privater Sync-Raum über Geräte-Token. `projectdashboardv1/SYNC.md`, `src/lib/deviceSync.ts` |
| Private Daten | vorhanden, mit Befund | Primär `localStorage`. Verschlüsselter Notiztresor: `src/lib/privateVault.ts`. Gesundheitsdaten im Tresor nur, wenn der Nutzer sie dort ablegt |
| Nutzertrennung | vorhanden und geprüft | Ohne Kopplung nur dieses Gerät. Mit Kopplung nur Geräte mit Token im selben Raum. Kein Account-Login |
| Session | vorhanden und ungeprüft im Browser dieser Runde | Hash-Routing, Reload lädt denselben `localStorage`-Stand |
| Mobile Navigation | vorhanden und geprüft | Heute, Run, Erfassen, Verlauf. Einstellungen bleiben im Kopf |
| Settings und Pairing | vorhanden, Routing unverändert | Einstellungen öffnen weiter den bestehenden Sheet inklusive Geräte-Sync |
| Backup | vorhanden und geprüft | Vollbackup enthält `lifeOs`. Generational Run liegt in `lifeOs.run` und geht damit mit |
| Upload / Transkript | teilweise, extern blockiert | `/api/transcribe` existiert. Ohne belegten Dienst gibt der Reel-Import keine erfolgreiche Transkription vor |
| PWA | vorhanden und ungeprüft auf einem echten iPhone | `vite-plugin-pwa`, Standalone-Manifest. Kein Service-Worker-Reset in dieser Änderung |
| Jo / JEV | eine Komponente | Provider `src/lib/decision-engine/providers/jev.ts`. Keine getrennte Jo- oder Joe-Komponente gefunden. Generational Run priorisiert lokal und kennzeichnet das |

### Öffentliche Gesundheitsdaten

Bestätigt, nicht nur behauptet: `https://github.com/aboubasem1/project-life-mobile` antwortet ohne Login mit HTTP 200. Die Datei `01_health/Blutwerte/2025-11-21_Blutwerte.txt` ist über `raw.githubusercontent.com` auf `main` ebenfalls mit HTTP 200 abrufbar. Weitere getrackte Dateien liegen unter `01_health/Ernährung/` und `01_health/Supplements/`.

Diese Umsetzung kopiert keine Inhalte daraus in die App, in Fixtures oder in dieses Dokument. Ein neuer Commit entfernt die Dateien nicht aus der Git-Historie. Sinnvoller nächster Schritt außerhalb dieses Arbeitsbereichs: Repository privat schalten oder die Historie bereinigen, und die Arbeitskopie behalten.

Kein exponierter API-Schlüssel im Client-Quelltext dieser Prüfung gefunden. Vorhandene Zugriffe lesen serverseitige Umgebungsvariablen.

## Phase B–F — umgesetzt

Route `#/run` (Alias `#/generational-run`). Zustand in `lifeOs.run`, normalisiert in `src/lib/lifeos/store.ts`, beim Sync über `server/lifeos-merge.ts` nach `updatedAt`.

- Heute: höchstens drei Hauptaufgaben, davon bevorzugt eine Umsatzaufgabe. Termine und markierte Einnahmen bleiben in „Bleibt stehen“, auch bei Wenig Energie.
- Jetzt starten, Pause, Fertig, Blockade mit vorhandener Ersatzaufgabe.
- Schnell erfassen ohne Pflichtkategorie. Entwurf liegt in `captureDraft`. Audio nur mit Web Speech, sonst Hinweis.
- Energie Normal / Wenig Energie und Kapazität klein / normal / weit.
- Portfolio mit festem Projekt `generational-run`. Erneutes Normalisieren erzeugt kein zweites.
- Höchstens zwei aktive Umsatzexperimente. Eine höhere Vorgabe schreibt die Kapazitätsfolge.
- Experimente speichern Budgetgrenze, Zeitbudget, Testdauer und Messwerte. Nicht eingetragene Zahlen bleiben leer.
- Ziele über Big Goal, Zwischenziel, nächste Aufgabe.
- Assets: unsichere Namen als unbestätigte Entwürfe, Kennzahlen `null` statt `0`. „0→100“ ist kein Titel.
- Wochenreview speichert Weiterführen / Ändern / Pausieren einmal pro Woche. Ändern schreibt nur die Notiz, eine Variable zu ändern. Pausieren setzt aktive Umsatzexperimente und aktive Umsatzprojekte auf pausiert. Angebot, Käufergruppe und nächste Handlung bleiben stehen.
- Überfällige Aufgaben bleiben erhalten: Neu planen, Verkleinern (Minuten halbiert, mindestens 5), Delegieren (Briefing, Aufgabe pausiert) oder Pausieren.
- Heute, Ansicht Now, zeigt eine Karte mit der lokalen Priorität und „Im Run öffnen“.
- Finanzen getrennt. Deckungsbeitrag nur aus bezahlten Eingängen minus bekannten variablen Kosten. Fehlende Kostenfelder bleiben leer und zählen nicht als 0. Retouren, Versand, Einkauf und Plattformgebühren sind eigene Felder.
- Delegation als manuelles Briefing. Die Aufgabe wird dabei nicht gelöscht.
- Labor-Einnahmen erscheinen im Run nur mit Name, Uhrzeit und ob sie heute erfasst sind. Die Dosierung bleibt in Labor.
- Health-Plan ohne erfundene Ziele. Labor-Medis und Check-in werden nicht beschrieben oder geleert. Bewegung startet bei drei Einheiten pro Woche und ist editierbar. BJJ ist als spätere Achse benannt, ohne Trainingsplan.
- Schlaf nur mit Beginn, Ende und subjektiver Erholung. Die Dauer wird aus beiden Uhrzeiten gerechnet. Fehlt eine Zeit, bleibt sie offen. Kein Sleep-Score.
- Ernährung: Kalorien- und Proteinziel leer, bis sie eingetragen werden. Mahlzeiten, Einkauf, Meal Prep und Bulk-Notiz speichern nur Text.
- Pflege: Skincare, Haare, Zähne, nächste Handlung, Termin und Kostennotiz. Whitening ist ein optionaler Schalter ohne medizinische Vorgabe.
- Supplements nur mit Produkt, Menge und Bestand aus der Eingabe. Leere Menge bleibt leer.
- Arztbesuch mit Termin, Unterlagen und Follow-up. Vorrat oder Rezeptbedarf als Notiz, ohne Dosisänderung.
- Assets zusätzlich mit letzter Aktivität, Inhalten und Rechten und Produkten. Unbekannt bleibt leer.
- Delegation hat einen Status. Die Zuweisung bleibt manuell.
- Präferenzen: Fakt, Präferenz, Hypothese, deaktivierbar und löschbar.
- Reel: Textimport zur Prüfung, Freigabe schreibt genau einen Wissenseintrag. Video ohne Text bleibt „Transkript extern blockiert“. Dateien über 25 MB und unbekannte Typen werden abgelehnt. Erneuter Versuch behält dieselbe Job-ID.

## Phase G — nicht als Integration umgesetzt

- iPhone: nur Browserlayout, kein Gerät.
- Meta-Brille: kein belegter Kamera-, Audio- oder Bewegungspfad.
- Preisradar: keine Live-Quelle. Der Entscheidungs-Intent `FILTER_RADAR` ist keine Preisabfrage.

## Checks

- `npm run typecheck`: bestanden.
- `npm run test`: 12 Dateien, 120 Tests, bestanden. Darunter Persistenz, Experiment-Limit, Review, Reel-Freigabe, Merge, überfällige Aufgaben, teilweiser Deckungsbeitrag und leere Health-Felder.
- `npx eslint` auf den neuen Client-Dateien: keine Fehler.
- Browser, lokal auf `http://127.0.0.1:5173/#/run`: Aufgabe gespeichert, gestartet, pausiert, nach Reload weiterhin Pause. Wenig Energie blendet die Okay-Aufgabe aus der Heute-Liste aus und lässt sie gespeichert. Schnellerfassung landet in der Inbox. Einstellungen öffnen Geräte-Sync. Kein horizontaler Überlauf bei 390 und 430 Pixel Breite.
- Browser, lokal auf `http://127.0.0.1:5174/` (5173 war durch den älteren Dev-Server belegt): Karte „Im Run öffnen“ wechselt nach `#/run`. Überfällige Aufgabe verkleinert (25 auf 13 Minuten), delegiert und auf den 20.10.2026 neu geplant. Wochenreview „Ändern“ lässt das Angebot stehen. „Pausieren“ setzt das aktive Experiment auf pausiert. Eine Videodatei ohne Text bleibt blockiert. Eingefügter Text und einmal Freigeben erzeugen einen Wissenseintrag. Einstellungen zeigen weiter Geräte-Sync. Kein horizontaler Überlauf bei 390 und 430 Pixel Breite. Auf diesem Ursprung lagen keine Labor-Medikamente.
- Browser, lokal auf `http://localhost:5175/#/run`: Schlaf von 23:30 bis 07:00 zeigt 7 h 30 min. Mahlzeit „Hafer“ ohne Kalorienziel. Supplement ohne Menge. Experiment mit Budgetgrenze 40, Zeitbudget und Testdauer bleiben leer. Nach Reload dieselben Werte. Kein horizontaler Überlauf bei 390 und 430 Pixel Breite. Kein echtes iPhone. Kein Deployment.

## Nächste drei Schritte

1. Repository-Sichtbarkeit der Gesundheitsdateien klären, ohne die lokale Kopie zu verlieren.
2. Ein konkretes Angebot mit Preis, Käufergruppe und nächster Handlung im Experiment eintragen. Keine Kennzahl raten.
3. Transkriptionsdienst nur anbinden, wenn Credentials bewusst gesetzt sind. Bis dahin Text einfügen.
