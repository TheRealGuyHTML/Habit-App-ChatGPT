# Bloom · Habit-Tracking als iOS-PWA

Eine nutzbare React-/TypeScript-Anwendung nach [Konzeptplan.md](Konzeptplan.md): tägliche Habits, Spezial-Tracker, historische Statistiken, Daily Reviews und ein wachsender virtueller Garten. Ohne Firebase läuft sie mit echter lokaler Datenspeicherung; mit eigener Firebase-Konfiguration kommen Anmeldung und Cloud-Synchronisierung hinzu.

TypeScript, Lint, Produktions-Build, 105 Root-Tests und 33 Backend-/Firestore-Emulatortests sind erfolgreich. Zusätzlich sind sechs Auth-/Synchronisierungsabläufe mit echten lokalen Emulatoren und zwei Browserkontexten sowie 13 Playwright-Fälle bestanden. Die Produktionsabhängigkeiten von App und Functions haben bei `npm audit --omit=dev` keine bekannten Schwachstellen gemeldet.

Der konkrete Fortschritt, Testergebnisse und offene externe Prüfungen stehen in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Architekturentscheidungen: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Lokal starten

Voraussetzung: Node.js 22.12 oder neuer und npm.

```bash
npm install
npm run dev
```

Die von Vite ausgegebene lokale Adresse im Browser öffnen. Ohne `.env.local` startet der lokale Modus. Das Onboarding fragt Lebensbereiche ab und erlaubt maximal drei anfängliche Habits. Beispieldaten werden über eine ausdrücklich bezeichnete Demo-Aktion geladen; sie sind kein echtes Cloud-Konto.

Daten bleiben im Browserprofil gespeichert. Änderungen, Journaltexte, Timer und Reviews sind funktional. Über Einstellungen können Daten als JSON exportiert und validiert importiert werden. Ein Export dient auch als Backup vor dem Löschen von Browserdaten.

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run preview

# Einmalig für Browserprüfungen, falls kein konfigurierter Chromium vorhanden ist:
npx playwright install chromium
npm run test:e2e
```

Die Browserprüfungen verwenden Chromium mit iPhone-Größe/Touch-Eingabe und einen Desktop-Viewport; sie ersetzen keinen Test mit echtem Safari oder einem physischen iPhone. Ein anderer Browserpfad kann mit `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` angegeben werden.

Der Produktions-Build liegt in `dist/`. Für Installation und Push ist HTTPS erforderlich; `localhost` gilt für Entwicklung als sichere Ausnahme. Eine LAN-Adresse über unverschlüsseltes HTTP bietet keine vollständige PWA-/Push-Funktion.

## Verwendung

- **Home:** Woche oder historischen Tag wählen, Habits abhaken und eingebettete Zähler/Timer bedienen. Unerledigte Habits stehen oben. Rechts wischen erledigt, links wischen bearbeitet; langes Drücken oder das Habit-Menü bietet weitere Aktionen.
- **Plus:** Neue Gewohnheit mit Vorlage oder eigenem Namen anlegen. Spezialfunktionen sind standardmäßig deaktiviert und können im Editor zugeschaltet werden. Bei aktiviertem Review-Modus bietet Plus zusätzlich einen Daily Review an.
- **Statistiken:** Quoten für heute, 7 oder 30 Tage, Wochenfortschritt, aktuelle/beste Streak und monatliche Habit-Insights.
- **Garten:** XP, Level, Erfolge nach 7/21/66 relevanten Erfolgs-Tagen und virtuelle Pflanze.
- **Einstellungen:** Deutsch/Englisch, System-/Hell-/Dunkel-Darstellung, Review-Uhrzeit, Anmeldung, Benachrichtigungen und Import/Export.

Negative Habits beginnen vorausgewählt. Den Haken entfernen, wenn das unerwünschte Verhalten stattgefunden hat. Die automatische Erfolgsbewertung erhält erst nach Tagesende XP. Wiederholungsfreie und pausierte Tage unterbrechen eine Habit-Streak nicht. Änderungen gelten ab dem Änderungstag; historische Daten bleiben erhalten.

Schritte, Schlaf, Bildschirmzeit und Laufdistanz werden manuell erfasst. Timer werden über Zeitstempel fortgesetzt; iOS kann die App im Hintergrund anhalten, weshalb ein lokaler Alarm bei geschlossener App nicht zugesichert wird.

## Auf dem iPhone installieren

1. Die HTTPS-Adresse in Safari öffnen.
2. **Teilen → Zum Home-Bildschirm → Hinzufügen** wählen.
3. Die App über das neue Symbol starten.
4. Für Push in der App unter Einstellungen die Benachrichtigungen aktivieren. Die Berechtigung wird erst nach dieser Aktion angefragt.

Web Push auf iOS benötigt eine unterstützte iOS-Version und eine installierte Home-Screen-Web-App. Details, Herstellerquellen und Fallbacks: [docs/PUSH_SUPPORT.md](docs/PUSH_SUPPORT.md).

## Firebase und Cloudflare einrichten

Cloudflare Pages und Workers Static Assets werden unterstützt. Beim Deploy-Befehl `npx wrangler deploy` gilt der Workers-Abschnitt der Deployment-Anleitung; `wrangler.jsonc` baut die App und verwendet den nativen SPA-Fallback.

Die vollständige Schrittfolge mit öffentlichen Umgebungsvariablen, Auth-Domains, Firestore-Regeln, Cloud Functions, Web-Push-Secrets und Cloudflare Pages steht in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

```bash
cp .env.example .env.local
```

Nur die öffentliche Firebase-Web-Konfiguration und der öffentliche VAPID-Schlüssel gehören in `VITE_*`-Variablen. Private Schlüssel und Service-Account-Dateien niemals in die App oder das Repository übernehmen.

## Projektstruktur

```text
src/domain/       Datumslogik, Wiederholungen, Statistik, XP, Vorlagen, Validierung
src/components/   Oberfläche, Spezial-Tracker, Reviews und Garten
src/services/     Lokaler Speicher, Firebase, Auth und Benachrichtigungen
functions/        Serverseitige Tagesabschlüsse und geplante Pushes
public/           Manifest, Icons, Service Worker und Hosting-Dateien
tests/            Geschäftslogik und zentrale Browserabläufe
docs/             Architektur, Bereitstellung und iOS-Push-Unterstützung
```

## Status und verbleibende Einrichtung

Die lokale Anwendung ist von externer Infrastruktur unabhängig. Firebase- und Cloudflare-Betrieb benötigen ein eigenes Projekt und die dort dokumentierten Einstellungen. Echte Mehrgeräte-Synchronisierung, Produktions-Scheduler und Push auf einem physischen iPhone müssen nach deren Einrichtung separat geprüft werden. Welche Prüfungen in dieser Entwicklungsumgebung tatsächlich ausgeführt wurden, steht im [Verifikationsprotokoll](IMPLEMENTATION_PLAN.md#verifikationsprotokoll).
