# Implementierungsplan

## Weitere UI-Korrekturen: Zeitfeld, Review, Ziele und Funktionsnamen

- [x] Native Zeit-/Datumsfelder mit Safari-tauglichen Breitenbegrenzungen; Review-Zeitfeld bleibt in seiner Karte.
- [x] Nur ein Schließen-X für manuell und automatisch geöffnete Reviews.
- [x] Achievement-Karussell zeigt automatisch das nächste offene Ziel; sind alle erreicht, den zuletzt erreichten Erfolg.
- [x] Custom-Spezialfunktionen nach Werkzeugen benannt (Liste, Timer, Zähler usw.); vorhandene Timer-Dauern bleiben erhalten.

Verifiziert: TypeScript, ESLint, Produktions-Build und 107 Root-Tests erfolgreich. Alle 22 Browserfälle geprüft; der automatische Review-/Zeitfeld-Fall wurde nach Korrektur des Reload-Testablaufs erneut erfolgreich ausgeführt. Eingabebreite bei 320/390/820 px innerhalb der Karte geprüft; automatische Review-Abfrage einschließlich Reload hat genau ein Schließen-X. Offenes Achievement-Ziel, Custom-Listenbedienung und Erhalt bestehender Timer-Einstellungen geprüft. Physische Safari-Abnahme bleibt extern.


## Weitere Nutzeränderung: kompakte Habit-Insights als Heatmap

- [x] Monatskalender und Tageszahlen entfernt; 7 Wochentagsreihen × 16 fortlaufende Wochen mit kleinen abgerundeten Kästchen.
- [x] Erledigte Tage leuchten in #ec4899; offene, ungeplante und zukünftige Tage unterscheidbar abgedunkelt.
- [x] Kompakte Statistikzeile und flache Detailzeile statt großer Streak-Blöcke und Kalenderlegende.
- [x] Frühere Wochen bleiben bis zur Erstellung erreichbar, auch bei gelöschten Habits im Archiv.
- [x] Vollständige Datums-/Statuslabels und Tastaturnavigation; keine Änderung an Daten oder XP.

Verifiziert: 107 Root-Tests, TypeScript, ESLint und Produktions-Build bestanden. Alle 20 Browserfälle wurden geprüft; nach Ergänzung des Notizdialogs wurden die drei betroffenen Insights-/Heatmap-Flows erneut erfolgreich ausgeführt. Kartenhöhe ≤220 px bei 320/390/820 px; 7×16-Anordnung, keine Tageszahlen, exakte Pink-Farbe, geplante/offene/pausierte/zukünftige Tage, historische Navigation und Tastaturbedienung getestet. Physische Safari-Abnahme bleibt extern.


## Änderungen nach Nutzerfeedback vom 12.11.2026

Die folgenden Vorgaben ersetzen die entsprechenden Stellen des ursprünglichen Konzepts:

- [x] iPhone/iPad: kompakte Spezialkarten, höchstens doppelte Höhe einer normalen Karte; vollständige Eingaben als Dialog.
- [x] Wochenchart ungefähr halbiert, ohne Aufstrecken auf die Höhe der Nachbarkarte.
- [x] Einzelne Habit-Insights untereinander; gelöschte Habits ab Löschdatum nur im eingeklappten Archiv.
- [x] Ein durchwischbarer Erfolg statt eines großen Achievement-Rasters; zuletzt erreichter Erfolg automatisch ausgewählt.
- [x] Level-/Meilenstein-/XP-Erklärungen zu einer kompakten Karte zusammengeführt.
- [x] Custom Habit statt Simple Habit; freie Spezialfunktionswahl mit persistiertem Custom-Kennzeichen und kompatiblem Import.
- [x] Review-Skalen einheitlich: 5 ist positiv. Vorhandene Widerstandswerte bleiben intern unverändert interpretiert.
- [x] Willpower-Bonus entfernt. 5 XP je gespeichertem Tagesreview, unabhängig von Bewertungen/Erledigungen; erneutes Speichern vergibt nichts zusätzlich.
- [x] Wechsel von aktiviertem Preset-Tracker zu Custom setzt alte Ziele/Einheiten/Unterpunkte zurück.

Prüfungen dieses Updates: 107 Root-Tests, 34 Backend-/Firestore-Emulatortests und 19 Playwright-Szenarien bestanden; TypeScript, ESLint, Frontend- und Functions-Build erfolgreich. Kartengrößen für alle Spezialtypen bei 320, 390 und 820 px geprüft; Wochenkarte unter 190 px. Visuelle Kontrolle von Home und Garten, außerdem echte Detail-Tracker-Bedienung nach automatischer Sortierung. Browserprüfung mit Chromium, keine physische Safari-Abnahme. Für Firebase müssen Regeln und Functions neu bereitgestellt werden; produktive iOS-Geräteabnahme bleibt extern.


Deployment-Korrektur: Die globale `_redirects`-Regel wurde entfernt, da Workers Static Assets sie mit Fehler 100324 als Endlosschleife ablehnt. `wrangler.jsonc` konfiguriert den Build, `dist` und den nativen SPA-Fallback explizit. Pages nutzt seinen automatischen SPA-Fallback. Beide Einrichtungswege stehen in `docs/DEPLOYMENT.md`; eine produktive Veröffentlichung benötigt weiterhin den Cloudflare-Account.

Verifiziert für diese Korrektur: `npm run check` mit 105 bestandenen Tests sowie TypeScript, ESLint und Produktions-Build; `wrangler@4.160.0 deploy --dry-run` erfolgreich, 17 statische Dateien paketiert. Keine Veröffentlichung gegen die Cloudflare-API durchgeführt.

Verbindliche Spezifikation: [Konzeptplan.md](Konzeptplan.md). Analyse am 11.11.2026: Das Ausgangsrepository enthielt ausschließlich den Konzeptplan und eine README. Es gab keine bestehende Anwendung, Infrastruktur oder Tests.

Stand: Alle vier Implementierungsphasen sind im Quellstand umgesetzt; die lokale und emulierte Qualitätssicherung ist abgeschlossen. Ein Haken bedeutet im Quellstand implementiert; Testergebnisse stehen gesondert. Cloud-Funktionen und Push werden erst nach Einrichtung eigener Dienste aktiv. Konfiguration oder Live-Verifikation externer Dienste werden nicht als abgeschlossen dargestellt.

## Annahmen und technische Entscheidungen

- Die App arbeitet ohne Firebase als echte lokale Anwendung mit persistierten Daten. Beispieldaten werden ausdrücklich vom Nutzer geladen; lokaler Modus wird in der Oberfläche ausgewiesen.
- Ein Tag ist ein Kalenderdatum `YYYY-MM-DD` in der eingestellten IANA-Zeitzone. Tageswechsel überschreiben keine Daten. Kalenderarithmetik zählt Datumswerte, keine 24-Stunden-Zeitspannen; dadurch bleiben Sommer-/Winterzeitwechsel korrekt.
- „Täglicher Reset“ bedeutet einen neuen Tageskontext und serverseitigen Abschluss des vergangenen Tages. Historische Einträge werden nie zurückgesetzt.
- Änderungen an Wiederholung, Ziel oder Habit-Typ gelten ab dem Änderungstag; vorherige Tage verwenden die damalige Konfiguration. Pausen und Löschzeitpunkte bleiben in der Historie erhalten.
- Eine negative Gewohnheit erscheint tagsüber erfolgreich, kann bis Tagesende als verfehlt markiert werden und erhält ihre automatische Erfolgsbewertung erst nach Tagesende. Keine vorzeitigen XP für die laufende Tagesbewertung.
- Einmalige Aufgaben haben genau einen geplanten Tag, können nicht pausiert werden und werden aus den wiederkehrenden Habit-Insights ausgeschlossen.
- Schrittzahl, Schlaf, Bildschirmzeit und Distanz werden manuell erfasst. Eine PWA hat keinen allgemeinen Zugriff auf Apple Health, Screen Time oder iPhone-Schrittsensoren.
- Timer berechnen die Laufzeit aus persistierten Zeitstempeln. Ein geschlossener Browser führt kein JavaScript zuverlässig aus; beim Wiederöffnen wird der tatsächliche Zeitablauf ausgewertet. Systemweite Timeralarme sind kein zugesichertes PWA-Verhalten.
- Push ist nur nach aktiver Nutzeraktion erlaubt. iOS benötigt eine installierte Home-Screen-Web-App und eine unterstützte Systemversion. Erinnerungen verwenden standardbasiertes Web Push; Unterstützung und Grenzen werden in [PUSH_SUPPORT.md](docs/PUSH_SUPPORT.md) dokumentiert.
- Nicht spezifizierte XP-Werte und Levelgrenzen werden als überprüfbare Produktentscheidungen in [ARCHITECTURE.md](docs/ARCHITECTURE.md) dokumentiert.
- System-Darstellung ist der Standard; ein expliziter heller oder dunkler Modus darf zusätzlich gewählt werden.

## Phase 1 – Funktionsfähiges Fundament

- [x] React, TypeScript, Vite und Tailwind mit modularer Struktur initialisieren.
- [x] Responsives Liquid-Glass-Design, Safe Areas, reduzierte Bewegung und zugängliche Steuerelemente.
- [x] Fünfteilige Bottom-Navigation mit kontextabhängigem zentralem Plus.
- [x] Onboarding mit Lebensbereichen, personalisierten Empfehlungen und maximal drei Start-Habits.
- [x] Firebase Authentication: E-Mail/Passwort, Registrierung, Passwort-Reset und Google.
- [x] Lokaler Modus mit ausdrücklich wählbaren Beispieldaten, dauerhaftem Speicher und Fehleranzeige.
- [x] Nutzergetrennte Firestore-Synchronisierung und Offline-Verhalten.
- [x] Datenmodelle mit lokalen Tagesidentitäten, Revisionen und Einträgen.
- [x] Habit erstellen, bearbeiten, pausieren/fortsetzen und archivieren/löschen.
- [x] Tagesansicht mit Erledigungsstatus, automatischer Sortierung, Woche und Datumsauswahl.
- [x] Namen, Emojis, negative Habits, Schwierigkeitsgrad, Wiederholungen und individuelle Erinnerungszeit.

**Phase-Ergebnis / Ausführen:** Nach der Implementierung `npm install`, `npm run dev`; ohne `.env.local` lokal nutzbar. Firebase-Schritte: [DEPLOYMENT.md](docs/DEPLOYMENT.md).

**Noch offen:** Eigenes Firebase-Projekt konfigurieren und diese bereits lokal emulierten Auth-/Synchronisierungsabläufe gegen die spätere Produktionskonfiguration abnehmen.

**Prüfungen:** App-TypeScript, Lint und Produktions-Build bestanden. Gegen echte Auth-/Firestore-Emulatoren wurden sechs Browserabläufe erfolgreich geprüft: Registrierung mit expliziter lokaler Datenübernahme, Anmeldung in zweitem Browserkontext und bidirektionale Synchronisierung, Offline-Outbox mit Reconnect, Abmelden mit Kontotrennung, Schließen veralteter Dialoge bei kontenübergreifendem Tab-Wechsel sowie fehlerfreie Browserausführung. Die 13 bestandenen allgemeinen Playwright-Fälle sind unten separat protokolliert.

## Phase 2 – Erweiterte Habit-Funktionen

- [x] Alle Vorlagen; Spezialfunktionen sind standardmäßig ausgeschaltet und zuschaltbar.
- [x] Wasser in 100-ml-Schritten mit Ziel; Schlaf-Stundenauswahl mit Fortschritt; manuelle Schritteingabe.
- [x] Vitamine/Medikamente mit konfigurierbaren Unterpunkten, aufklappbarer Liste und Micro-Progress.
- [x] Obst/Gemüse in ganzen Portionen mit Tagesziel.
- [x] Lesen/Lernen: Minuten oder Seiten, Seitendifferenz und Timer.
- [x] Bildschirmzeit mit individuellem Maximum und manuellem Tageswert.
- [x] Sprachlern-, Meditations- und Trainingstimer; Meditation wird nach Zielzeit erledigt.
- [x] Journaling mit Stimmung und optionalem Text.
- [x] Joggen/Laufen mit 100-m-/1-km-Schritten und Timer.
- [x] Wiederholungen täglich, einmalig, Wochentage und Intervalle 2/3/4/7/30.
- [x] Swipe rechts erledigt, Swipe links bearbeitet, Long Press öffnet das Habit-Menü; gleichwertige Schaltflächen.
- [x] Negative Tagesbewertung, Kalenderhistorie, relevante geplante Tage und rückwirkende Erfassung.
- [x] Statistik: aktuell/beste Streak, erledigte Aufgaben, Quote heute/7/30 Tage, Wochenbalken.
- [x] Habit-Insights mit Monatskalender, Tagespunkten und Einzelstatistiken; einmalige Aufgaben ausgeschlossen.

**Phase-Ergebnis / Ausführen:** Dieselbe App; Spezialfunktionen im Habit-Editor aktivieren. Historische Tage über Wochenleiste/Datum wählen.

**Noch offen:** Touch-/Swipe-/Timer-Wiederaufnahme auf einem physischen iPhone mit Safari prüfen. Gesundheits-/Bildschirmzeitwerte bleiben bewusst manuelle Eingaben, wie bei den jeweiligen Trackern ausgewiesen.

**Prüfungen:** 76 Domänentests und 9 Timerprüfungen bestanden, einschließlich Wiederholungen, DST/Zeitzonen, historische Revisionen, Pausen, negative Habits, lange Streaks und Importvalidierung. TypeScript-, Lint- und Produktions-Build sind erfolgreich; der vollständige Browserstatus steht im Verifikationsprotokoll.

## Phase 3 – Gamification und Review

- [x] XP für drei Schwierigkeitsstufen; wiederholte Verarbeitung erzeugt keine zusätzlichen XP.
- [x] Levelsystem, Fortschrittsanzeige und nachvollziehbare XP-Berechnung.
- [x] Erfolge und permanente Multiplikatoren nach 7/21/66 relevanten Erfolgen.
- [x] Virtuelle Pflanze mit Wachstumsphasen und sichtbarem Welken bei Vernachlässigung.
- [x] Optionaler Daily Review mit persönlicher Uhrzeit und automatischem Dialog in der geöffneten App.
- [x] Glücklichkeit, Widerstand und Qualität je Habit auf Skala 1–5; historische Speicherung und Bearbeitung.
- [x] Durch Nutzeränderung vom 12.11.2026 ersetzt: 5 XP pro gespeichertem Tagesreview statt Willpower-Bonus.
- [x] Historische Review-Auswertungen.
- [x] Kontextabhängiger Plus-Dialog mit Habit- und Review-Aktion.

**Phase-Ergebnis / Ausführen:** Garten für Level/Erfolge öffnen; Daily Review in Einstellungen aktivieren. Server-Push separat konfigurieren.

**Noch offen:** Reale Review-Pushes nach Bereitstellung des Firebase-Schedulers auf einem installierten iPhone prüfen. XP-, Review- und Pflanzenlogik sind lokal implementiert und ohne Cloud verwendbar.

**Prüfungen:** Die bestandenen Domänentests decken XP-Idempotenz, Bonusbedingungen, Rücknahme von Erledigungen und Streak-Multiplikatoren ab. Die Review-/Garten-Browserabläufe einschließlich einmaligen Review-XP und stabilen XP nach Neuladen wurden zusätzlich über Playwright erfolgreich geprüft.

## Phase 4 – Fertigstellung

- [x] Installierbare PWA: Manifest, Icons, Standalone, iOS-Metadaten und Installationshilfe.
- [x] Service Worker mit App-Shell-Cache und Offline-Fallback; keine Firebase-/Auth-Antworten im allgemeinen Cache.
- [x] Push-Registrierung nach Nutzeraktion, individuelle Habit- und Review-Erinnerungen.
- [x] Scheduler/Cloud Functions mit lokalen Zeitzonen, negativen Tagesabschlüssen und idempotenten Belegen.
- [x] Deutsch und Englisch in sämtlichen Oberflächen.
- [x] Vollständiger JSON-Export und validierter Import; keine unvalidierten Speicherüberschreibungen.
- [x] Firestore Security Rules für ausschließlich eigene Daten und serververwaltete Dokumente.
- [x] TypeScript-, Lint-, Build-, Geschäftslogik- und Browserprüfungen vollständig abschließen.
- [x] README, AGENTS, `.env.example`, `.gitignore`, Firebase-/Cloudflare-Konfiguration und Bereitstellungsanleitung.
- [x] Bekannte Browsergrenzen und externe Einrichtung transparent dokumentieren.

**Phase-Ergebnis / Ausführen:** Produktions-Build mit `npm run build`, lokal mit `npm run preview` ansehen. PWA/Push brauchen HTTPS oder localhost. Hosting: [DEPLOYMENT.md](docs/DEPLOYMENT.md).

**Prüfungen:** 105 Root-Tests, 33 Backend-/Firestore-Emulatortests, sechs Auth-/Firestore-Browserabläufe und 13 Playwright-Fälle bestanden; App-/Functions-Build, TypeScript und Lint erfolgreich. Produktionsabhängigkeiten ohne bekannte Audit-Befunde.

**Noch offen:** Nur die folgenden externen Bereitstellungs- und Geräteprüfungen. Es wurde noch keine öffentliche Website veröffentlicht.

## Noch extern einzurichten / live zu verifizieren

Diese Aufgaben benötigen ein eigenes Firebase-/Cloudflare-Projekt oder ein physisches iPhone und bleiben auch nach lokalen Tests ausdrücklich offen:

- Firebase-Projekt, Auth-Provider, Firestore-Datenbank, autorisierte Domains und öffentliche Web-Konfiguration eintragen.
- Firestore-Regeln/Indizes bereitstellen und Isolation zusätzlich mit tatsächlichen Firebase-Konten prüfen.
- Cloud Functions, Scheduler und Push-Secrets bereitstellen; Kosten-/Abrechnungseinstellungen im eigenen Projekt prüfen.
- Cross-Device-Synchronisierung, Offline-Reconnect und Accountwechsel gegen ein reales Backend testen.
- Cloudflare Pages mit Produktionsdomain/HTTPS verbinden.
- Installation, Safe Areas, Standalone, Push-Zustellung und Hintergrund-/Wiederaufnahmeverhalten auf einem physischen iPhone prüfen.
- Push-Zustellung nach DST-Wechsel, bei ausgeschaltetem Gerät und unter iOS-Energiesparbedingungen beobachten. Web Push garantiert keinen sekundengenauen Lieferzeitpunkt.

## Verifikationsprotokoll der ursprünglichen Umsetzung (11.11.2026)

| Bereich | Tatsächliches Ergebnis |
| --- | --- |
| Domänen-Geschäftslogik | 76/76 Tests bestanden; Kalender/DST, Wiederholungen, Pausen, Revisionen, negative Habits, Streaks, XP, Review-Bonus und Import |
| Domänen-Lint | Bestanden |
| Root-Testlauf | `npm test`: **105/105 bestanden** – 76 Domäne, 9 Timer, 10 Persistenz, 10 Service Worker |
| Persistenz | 10/10 bestanden: Kontotrennung, Outbox, No-op, Tombstones, Merge, Speicherfehler, Konflikte und fehlerhafte Remote-Daten |
| Service Worker | 10/10 bestanden; Push-Payloads und Benachrichtigungsnavigation. Offline-Caching zusätzlich im Browser geprüft. |
| Cloud-Functions-Build | `npm --prefix functions run build` bestanden |
| Backend mit echtem Firestore-Emulator | 33/33 Tests bestanden: 23 Push-/Zeitzonenprüfungen, 7 Security-Rules-Prüfungen, 3 Admin-Reconcile-Prüfungen |
| App-TypeScript | `npm run typecheck` bestanden |
| App-Lint | `npm run lint` bestanden |
| Produktions-Build | `npm run build` bestanden; Firebase und React als getrennte Chunks, sämtliche Chunks unter 500 kB |
| Auth-/Firestore-Browserintegration | **6/6 Abläufe bestanden** mit tatsächlichen lokalen Auth-/Firestore-Emulatoren und getrennten Browserkontexten |
| Allgemeine Playwright-Browserabläufe | **13/13 bestanden**, davon 12 mobile und 1 Desktop; keine unbehandelten App-Fehler |
| Produktionsabhängigkeiten | `npm audit --omit=dev`: 0 bekannte Schwachstellen im Root-Projekt und in `functions` |
| GitHub Actions | Automatische App-/Browser- und Firebase-/Auth-Prüfungen; aktueller Remote-Status in den Checks von Pull Request #1. |
| Externe Firebase-/Cloudflare-/iPhone-Abnahme | Nicht durchgeführt; eigene Infrastruktur/Gerät erforderlich |

Reproduzierbare Prüfungen:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm --prefix functions run build
npx firebase-tools emulators:exec --only firestore --project demo-bloom-rules 'npm --prefix functions test'
npx firebase-tools emulators:exec --only auth,firestore --project demo-bloom-auth 'bash tests/auth/run.sh'
```

Die Auth-/Firestore-Browserprüfung startet einen separaten Entwicklungsserver auf Port 4191 (mit `BLOOM_AUTH_TEST_PORT` anpassbar), setzt ausschließlich Emulator-Konfiguration für diesen Prozess und verändert keine `.env`-Datei. Java 21 oder neuer und ein installierter Chromium werden benötigt. Die 105 Root-Tests und 33 Backend-Tests sind getrennte Suiten; die sechs Auth-/Firestore-Abläufe sind zusätzliche Browserprüfungen.

Die 13 bestandenen Playwright-Fälle prüfen Onboarding-Limit, Neuladen/Cross-Tab-Zähler, Erstellen/Pausieren/Historie/Fortsetzen, Sprachen/Darstellung/Export/Import, Statistiken und idempotenten Review-Bonus, negative Habits am Tageswechsel, Unteraufgaben/Journaling, Timer nach Neuladen/Autovervollständigung, echten Service-Worker-Offline-Reload mit Offline-Erfassung/Reconnect, Tastatur-/Modalbedienung, responsive Ansichten ohne horizontalen Überlauf, Swipe rechts/links und Long Press einschließlich negativer Habits, Erhaltung des Erledigungsstatus bei wiederholtem Swipe sowie Zurückweisung zu umfangreicher Unterlisten ohne Datenverlust. Die Prüfungen verwenden Chromium einschließlich mobilem Viewport/Touch-Eingabe; echte Safari-/iPhone-Abnahme bleibt extern. Bestehender Quellcode allein gilt nicht als Testerfolg.
