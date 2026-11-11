# Projektregeln für Codex

## Spezifikation und Struktur

- `Konzeptplan.md` ist die funktionale Spezifikation. `IMPLEMENTATION_PLAN.md` bildet Fortschritt, Annahmen, verifizierte Prüfungen und offene Aufgaben ab. Keine Funktion stillschweigend entfernen oder mit einem leeren Platzhalter ersetzen.
- React + TypeScript + Vite + Tailwind im Frontend, Firebase Auth/Firestore und benötigte Cloud Functions; Hosting-Ziel Cloudflare Pages.
- UI in `src/components`, Geschäftslogik in `src/domain`, Speicherung/Netzwerk in `src/services`. UI berechnet weder unabhängige XP-Regeln noch alternative Wiederholungslogik.
- Alle nutzerseitigen Texte in Deutsch und Englisch pflegen. Systemeinstellung für Darstellung, iOS-Safe-Areas, Touch-Größen, Tastaturbedienung und reduzierte Bewegung erhalten.

## Datenintegrität

- Erledigungen gehören zu einer unveränderlichen Kombination aus Habit-ID und lokalem Kalenderdatum `YYYY-MM-DD`. Historie niemals bei Tageswechsel überschreiben.
- Die eingestellte IANA-Zeitzone verwenden. Kalenderdaten nicht über `toISOString().slice(0,10)` aus lokaler Uhrzeit ableiten; DST-taugliche Datumshelfer verwenden.
- Wiederholungen, Pausen, Erstellung, historische Revisionen und Löschdatum bestimmen die relevanten Tage. Einmalige Aufgaben nicht pausieren und nicht in wiederkehrende Habit-Insights aufnehmen.
- Negative Habits tagsüber vorauswählen; automatische Erfolgs-XP erst für abgeschlossene lokale Tage. Fehlermeldungen und echte Fehlschläge unterscheiden.
- XP aus eindeutigen Tagesereignissen ableiten; serverseitige Verarbeitung muss wiederholbar und idempotent sein. Kein Client darf serververwaltete XP-/Abschlussbelege schreiben.
- Lokale Daten und Firebase-Konten strikt trennen. Kein stiller Import des lokalen Demospeichers in ein Konto. Fehler bei Speicherung/Synchronisierung sichtbar behandeln.
- Importdaten vollständig validieren, bevor bestehende Daten geändert werden. Änderungen an Exportformaten brauchen Schema-/Migrationsstrategie.
- Timer beruhen auf persistierten Zeitstempeln; Intervalle aktualisieren nur die Anzeige. Keine Zusage, dass JavaScript bei geschlossener iOS-PWA weiterläuft.

## Sicherheit und externe Dienste

- Keine Zugangsdaten, Service-Account-Dateien, private Schlüssel oder echte `.env`-Dateien committen. Öffentliche Web-Konfiguration gehört in `.env.example`, private VAPID-Schlüssel in Cloud Secret Manager.
- Firestore-Zugriffe immer unter dem authentifizierten Nutzer. Security Rules mitpflegen; schreibbare Felder, IDs, Datumswerte und serververwaltete Collections beachten.
- Push-Berechtigung ausschließlich nach bewusster Nutzeraktion anfragen. iOS-Voraussetzungen und Fallbacks transparent halten.
- Geplante Pushes über serverseitige Verarbeitung; Endpoint-Validierung und Zustellungsbelege nicht umgehen.
- Produktion nicht ohne konkreten Auftrag veröffentlichen; externe Live-Tests nicht als bestanden darstellen, wenn nur lokale Tests liefen.

## Qualität und Abschluss

- Vor Abschluss passende Prüfungen ausführen: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; bei zentralen UI-Änderungen `npm run test:e2e`.
- Tests vor allem für Wiederholungen, geplante Tage, Streaks, Zeitzonen/DST, negative Habits, XP-Duplikate, Import und Zugriffsschutz schreiben. Keine Tests, die nur triviale Implementierungsschritte spiegeln.
- Nach Änderungen README/Deployment-Hinweise und Implementierungsplan aktualisieren. Testergebnis, Einschränkungen, fehlende externe Konfiguration und Startbefehl konkret benennen.
- Lockfiles einchecken; `node_modules`, Buildausgaben und lokale Testartefakte nicht einchecken.
