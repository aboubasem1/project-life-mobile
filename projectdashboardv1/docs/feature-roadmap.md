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

- [ ] Echtes XP/Level aus `xp-store.ts` anzeigen (Level, Fortschrittsbalken zum
      nächsten Level, Gesamt-XP)
- [ ] Score-Breakdown (Morgen/Training/Mindset/Abend) im Verlauf sichtbar machen
- [ ] Echte Streaks & Erfolgsquote pro Gewohnheit statt der bisherigen
      Wochen-Zählung per Hand
- [ ] Die zwei parallelen Level-Systeme vereinheitlichen (ein Source of Truth:
      `xp-store.ts`, `LVLS`-Namen als Anzeige-Layer obendrauf)

## Phase 2 — Fundament: neue Datentypen mit echtem Alltagswert

**Aufwand: M · pro Feature ca. 2–4 Std.**

- [ ] Medikamente als eigener Typ (Dosierung, Einnahme, Erinnerung, Wirkung) —
      aktuell 0 % vorhanden
- [ ] Ziele (Jahr/Quartal/Monat/Woche mit Prozent & Milestones) — komplett neu
- [ ] Prioritäten P1–P4 für Aufgaben (Feld existiert in Dashboard+ schon, nur
      nicht editierbar)
- [ ] Universeller Quick-Add mit einfachem Pattern-Matching (Zahl+„kg“ →
      Gewicht, „HH:MM“ → Zeit) — bewusst ohne KI
- [ ] Floating Action Button für Aufgabe/Notiz/Gewicht

## Phase 3 — Health-Tracking vertiefen

**Aufwand: M · ca. 1 Tag.**

- [ ] Gewichtsverlauf mit Trendlinie, BMI, Wochen-/Monatsänderung aus
      vorhandenen Tageseinträgen berechnen
- [ ] Ernährung: Fett, Kohlenhydrate, Ballaststoffe ergänzen, als
      Fortschrittsringe statt Zahlen
- [ ] Schlaf: echte Bettzeit/Aufstehzeit statt Text-Buckets, Wochendurchschnitt
- [ ] Bewegung: Schritte & Trainings-Log statt reiner Ja/Nein-Checkboxen
- [ ] Dashboard+ Finanzen & Stats an echte Daten anschließen statt manuell
      editierbarer Mock-Werte

## Phase 4 — Struktur & Bedienung

**Aufwand: L · mehrere Tage.**

- [ ] Swipe-Gesten (links = erledigt, rechts = verschieben) auf Aufgabenlisten
- [ ] Long-Press-Kontextmenü (bearbeiten/verschieben/löschen/Priorität)
- [ ] Restliche Listentypen als ein generisches „Listen“-System (Packliste,
      Wunschliste, Bücher, Rezepte, …) statt Einzelbauten
- [ ] Einfache Wochen-/Monats-Kalenderansicht (kein Time Blocking in dieser Phase)
- [ ] Suche über Aufgaben + Listen (reiner Textfilter, keine KI nötig)

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
- **Personalisierbare Drag-and-Drop-Dashboard-Kacheln** — hoher Aufwand, kein
  konkret beschriebenes Problem dahinter
- **AMOLED-Theme als vierte Variante** — Light/Dark/System deckt den Bedarf
- **Confetti/Haptik als flächendeckendes System** — punktuell ja (z. B. Ziel
  erreicht), nicht überall
