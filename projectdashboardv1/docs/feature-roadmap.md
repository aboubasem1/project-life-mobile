# Feature-Roadmap

Ergebnis eines vollständigen Audits der App gegen eine große Feature-Wunschliste
(Notion/Apple Health/Linear/Sunsama/Habitica-Niveau). Fünf Phasen, aufsteigender
Aufwand — wir arbeiten sie nacheinander ab und haken hier ab, was fertig ist.

## Wichtigste Erkenntnisse aus dem Audit

- **Vier Systeme sind bereits fertig programmiert, aber nirgends sichtbar**: das
  XP/Level-System (`src/lib/xp-store.ts`), der Score-Breakdown und die
  Streak-/Erfolgsquote-Funktionen (`src/lib/score.ts`). `App.tsx` importiert nur
  die Schreib-Funktion (`awardDailyXP`), nie die Lese-Funktionen.
- **Zwei parallele, widersprüchliche Level-Systeme** existieren: ein
  Score-Summen-basiertes (`getLevelFromScore`, `LVLS`/`XPT` in `App.tsx`) und ein
  echtes, persistiertes XP-System (`xp-store.ts`). Sie zeigen unterschiedliche
  Level für denselben Nutzer.
- **Dashboard+ „Finanzen“ und „Stats“ sind eine manuell ausgefüllte Tabelle**,
  keine Live-Analytics — alle Zahlen kommen aus `createDashboardPlusSeed()` und
  werden per Hand editiert, nichts wird aus echten Tageseinträgen berechnet.
- **Keine KI-Infrastruktur vorhanden** — kein LLM-SDK, kein API-Key-Handling,
  kein Backend-Proxy. Jedes KI-Feature braucht zuerst eine Architektur- und
  Kostenentscheidung (siehe Phase 5).
- **Der eigene Anspruch an geringe kognitive Last** (3–5 Aktionen auf der
  Startseite, kein Overload — besonders wichtig für ADHS-Nutzer) steht in
  Spannung zur Größe der Wunschliste. Empfehlung: Datenmodell/Logik breit
  ausbauen, aber die Startseite bewusst schlank halten und alles andere hinter
  Tabs/Progressive-Disclosure verstecken.

## Phase 1 — Verstecktes sichtbar machen

**Aufwand: S · kein neuer Code, nur bestehende Logik verbinden. Kein Risiko.**

- [x] Echtes XP/Level aus `xp-store.ts` anzeigen (Level, Fortschrittsbalken zum
      nächsten Level, Gesamt-XP)
- [x] Score-Breakdown (Morgen/Training/Mindset/Abend) im Verlauf sichtbar machen
- [x] Echte Streaks & Erfolgsquote pro Gewohnheit statt der bisherigen
      Wochen-Zählung per Hand
- [x] Die zwei parallelen Level-Systeme vereinheitlichen (ein Source of Truth:
      `xp-store.ts`, `LVLS`-Namen als Anzeige-Layer obendrauf)

## Phase 2 — Fundament: neue Datentypen mit echtem Alltagswert

**Aufwand: M · pro Feature ca. 2–4 Std.**

- [x] Medikamente als eigener Typ (Dosierung, Einnahme, Erinnerung, Wirkung) —
      neuer Dashboard+ Reiter „Medis“
- [x] Ziele (Jahr/Quartal/Monat/Woche mit Prozent & Countdown/ETA) — neuer
      Dashboard+ Reiter „Ziele“
- [x] Prioritäten P1–P4 für Aufgaben (klickbares Badge, zyklisch, auf allen
      Dashboard+ Task-Listen)
- [x] Floating Action Button (unten rechts, ausgeblendet auf Dashboard+, das
      bereits eigene Add-Buttons je Reiter hat)
- [x] Universeller Quick-Add mit einfachem Pattern-Matching („74.2kg“ →
      Gewicht, „3000kcal“ → Kalorien, „2.5l“ → Wasser, sonst → neue Aufgabe) —
      bewusst ohne KI, ein Eingabefeld hinter dem FAB

## Phase 3 — Health-Tracking vertiefen

**Aufwand: M · ca. 1 Tag.**

- [x] Gewichtsverlauf mit Trendlinie, BMI, Wochen-/Monatsänderung aus
      vorhandenen Tageseinträgen berechnen
- [x] Ernährung: Fett, Kohlenhydrate, Ballaststoffe ergänzen, als
      Fortschrittsringe statt Zahlen
- [x] Schlaf: echte Bettzeit/Aufstehzeit statt Text-Buckets, Wochendurchschnitt
- [x] Bewegung: Schritte & Trainings-Log statt reiner Ja/Nein-Checkboxen
      (Schritte im Check-in; Trainings-Checkboxen bleiben ergänzend)
- [x] Dashboard+ Finanzen & Stats an echte Daten anschließen statt manuell
      editierbarer Mock-Werte
      (KPIs live aus Einträgen/Rechnungen; Projekt-% bleibt Labor-Notiz)

## Phase 4 — Struktur & Bedienung

**Aufwand: L · mehrere Tage.**

- [x] Swipe-Gesten (links = erledigt, rechts = verschieben) auf Aufgabenlisten
- [x] Long-Press-Kontextmenü (bearbeiten/verschieben/löschen/Priorität)
- [x] Restliche Listentypen als ein generisches „Listen“-System (Packliste,
      Wunschliste, Bücher, Rezepte, …) statt Einzelbauten
- [x] Einfache Wochen-/Monats-Kalenderansicht (kein Time Blocking in dieser Phase)
- [x] Suche über Aufgaben + Listen (reiner Textfilter, keine KI nötig)

## Phase 5 — KI-Features (blockiert bis Grundsatzentscheidung)

**Aufwand: XL · offen.**

- [ ] Anbieter/Modell festlegen, Kostenmodell klären
- [ ] API-Key-Handling über einen Backend-Proxy (Ansatzpunkt: vorhandener
      `api/`-Ordner), niemals im Client-Code
- [ ] Danach zuerst die zwei günstigsten Bausteine: natürlichsprachiger
      Quick-Add und Wochenzusammenfassung mit Empfehlungen — nicht alle 9
      KI-Punkte gleichzeitig

## Bewusst nicht empfohlen

Im Konflikt mit dem eigenen Minimalismus-Prinzip, daher zurückgestellt statt
eingeplant:

- **Wetter-Widget** — externe API-Abhängigkeit ohne direkten Life-OS-Bezug
- **AMOLED-Theme als vierte Variante** — Light/Dark/System deckt den Bedarf
- **Confetti/Haptik als flächendeckendes System** — punktuell ja (z. B. Ziel
  erreicht), nicht überall

**Nachträglich umgesetzt (auf expliziten Wunsch):** Die Dashboard+ Reiter
(Übersicht/Todos/Bestände/Medis/Ziele/Kaufliste/Stats/Finanzen) lassen sich
jetzt in den Einstellungen per Auf/Ab-Pfeilen umsortieren und einzeln
aus-/einblenden (mindestens ein Reiter bleibt immer sichtbar). Bewusst als
Einstellungsseite mit Pfeilen statt Drag-and-Drop-Kacheln direkt in der
Ansicht — robuster auf Touch und ohne Risiko für versehentliches Verschieben
im Alltag. Heute/Plan/Check-in/Verlauf bleiben unverändert fix, damit die
Startseite schlank bleibt.
