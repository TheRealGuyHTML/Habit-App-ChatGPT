# Firebase und Cloudflare Pages bereitstellen

Die App funktioniert ohne diese Schritte vollständig lokal. Cloud-Anmeldung, Mehrgeräte-Synchronisierung und geplante Pushes benötigen eigene Dienste. Es werden keine fremden Zugangsdaten oder Service-Account-Dateien mitgeliefert.

## 1. Lokal prüfen

Node.js 22.12 oder neuer installieren. Im Projektverzeichnis:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

Mit `npm run dev` wird der Entwicklungsserver gestartet. Öffentliche Konfiguration anlegen:

```bash
cp .env.example .env.local
```

Nach Änderungen an `VITE_*`-Variablen den Entwicklungsserver neu starten bzw. den Produktions-Build erneut erzeugen. Vite ersetzt diese Werte beim Build; Pages-Variablen werden nicht nachträglich zur Laufzeit gelesen.

## 2. Firebase-Projekt und Web-App

1. In der [Firebase Console](https://console.firebase.google.com/) ein eigenes Projekt erstellen.
2. Unter **Projekteinstellungen → Allgemein → Deine Apps** eine Web-App registrieren. Firebase Hosting ist für Cloudflare Pages nicht erforderlich.
3. Die öffentliche Web-Konfiguration in `.env.local` und später in die Cloudflare-Pages-Buildvariablen eintragen:

| Variable | Firebase-Web-Konfiguration |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId`, optional |
| `VITE_VAPID_PUBLIC_KEY` | Öffentlicher Web-Push-VAPID-Schlüssel aus Schritt 5 |

Die Firebase-Web-Konfiguration ist öffentlich und kein Admin-Zugang. Sicherheit entsteht durch Authentication und Firestore Security Rules. Private VAPID-Schlüssel, Admin-SDK-Zugangsdaten und Service-Account-Dateien dürfen keine `VITE_*`-Werte sein.

## 3. Authentication und Firestore

1. Unter **Authentication → Anmeldemethode** **E-Mail/Passwort** aktivieren. Für Google-Anmeldung außerdem **Google** aktivieren und Support-E-Mail hinterlegen.
2. Unter **Authentication → Einstellungen → Autorisierte Domains** die Produktionsdomain und benötigte Pages-Preview-Domains eintragen. Für lokale Entwicklung `localhost` ausdrücklich hinzufügen, falls es nicht vorhanden ist. Bei neuen Firebase-Projekten wird es nicht immer automatisch eingerichtet.
3. Unter **Firestore Database** eine Datenbank im **Produktionsmodus** erstellen. Region passend zur Zielgruppe auswählen; die Datenbankregion wird später nicht beliebig verschoben.
4. Firebase CLI installieren/anmelden und das eigene Projekt auswählen. Befehle aus dem Repository-Verzeichnis:

```bash
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

Falls der Browser-Login auf einer entfernten Shell nicht verfügbar ist, die Firebase-CLI-Dokumentation für den eigenen sicheren CI-Authentifizierungsweg verwenden. Keine Tokens in Chat oder Repository schreiben.

Die bereitgestellten Regeln isolieren Nutzerdaten über die authentifizierte UID. Serververwaltete Abschluss- und Zustellungsbelege sind vom Client aus nicht schreibbar. Vor echten Nutzerdaten zusätzlich Zugriff mit zwei verschiedenen Konten testen.

Die Anmeldung wechselt in einen getrennten Kontospeicher. Lokale Demo-/Gastdaten werden erst durch die explizite Importaktion in das Konto übernommen. Vor Accountwechsel oder großem Import einen JSON-Export als Backup erstellen.

## 4. Cloud Functions und Scheduler

Für Cloud Functions und geplante Jobs ist ein Firebase-Projekt mit aktivierter Abrechnung (**Blaze**) erforderlich. Die CLI fordert gegebenenfalls das Aktivieren von Cloud Functions, Cloud Build, Artifact Registry, Cloud Scheduler und Secret Manager an.

```bash
npm --prefix functions ci
npm --prefix functions run build
```

Bereitgestellt werden in `europe-west1`:

| Funktion | Auslöser / Aufgabe |
| --- | --- |
| `reconcileProgress` | Firestore-Änderungen an Habits, Einträgen, Reviews oder Profil: Fortschritt neu ableiten |
| `finalizeLocalDays` | Alle fünf Minuten: vergangene lokale Tage prüfen und negative Erfolge nachtragen |
| `sendHabitReminders` | Jede Minute: fällige Habit-/Review-Erinnerungen pro lokaler Zeitzone versenden |

Der Fünfminutenlauf liest zuerst die gespeicherte XP-Zusammenfassung und berechnet die vollständige Historie nur bei neuem lokalem Tag, ausstehendem Fehler-Retry oder offenem Prüfbeleg-Catchup. Änderungen an Quelldaten lösen zusätzlich die Firestore-Funktion aus.

Die geplante Verarbeitung liest die eingestellte IANA-Zeitzone, schließt vergangene negative Habits ab und erzeugt eindeutige Belege. Sie löscht keine Tageshistorie. Der serverseitige automatische Abschluss kann bis zum nächsten Fünfminutenlauf nach Mitternacht erfolgen; beim Öffnen berechnet die App ihre lokale Anzeige unmittelbar aus der Tageshistorie. Pro Transaktion werden bis zu 400 negative Prüfbelege nachgezogen; umfangreiche Historien werden bei weiteren Läufen vervollständigt.

Serverjobs können nach Ausfall wiederholt laufen. Eindeutige Belege verhindern doppelte XP-Auswertung und reguläre Doppelverarbeitung desselben Erinnerungsereignisses. Push-Sendungen verwenden begrenzte Wiederholungsversuche und einen stabilen Benachrichtigungs-Tag. Ein Absturz zwischen Netzwerkzustellung und Bestätigung kann einen erneuten Sendeversuch auslösen; eine Exactly-once-Netzwerkzustellung wird nicht versprochen. Push ist ein Netzwerkdienst; auch bei korrekter serverseitiger Planung ist die tatsächliche Anzeige auf dem Gerät nicht sekundengenau garantiert.

## 5. Standardbasiertes Web Push

Herstellerunterstützung und iOS-Grenzen: [PUSH_SUPPORT.md](PUSH_SUPPORT.md).

Ein VAPID-Schlüsselpaar erzeugen, beispielsweise mit dem offiziellen `web-push`-Paket:

```bash
npx web-push generate-vapid-keys
```

Die Schlüssel lokal behandeln; Ausgabe nicht in Tickets oder Versionsverwaltung kopieren. Den **öffentlichen** Schlüssel an zwei Stellen identisch konfigurieren:

- `VITE_VAPID_PUBLIC_KEY` im Frontend-Build.
- `VAPID_PUBLIC_KEY` als Firebase-Functions-Parameter beim Deployment.

Den **privaten** Schlüssel und den VAPID-Kontakt serverseitig als Secrets setzen:

```bash
npx firebase-tools functions:secrets:set VAPID_PRIVATE_KEY
npx firebase-tools functions:secrets:set VAPID_SUBJECT
```

Beim ersten Befehl ausschließlich den privaten Schlüssel eingeben. `VAPID_SUBJECT` ist ein gültiger Kontakt wie `mailto:app@example.com` oder eine HTTPS-Kontaktadresse. Die CLI nimmt Werte interaktiv entgegen; nichts davon in `firebase.json`, `.env.example` oder Git eintragen.

Optional kann in Firestore für die Collection Group `notificationReceipts` eine TTL-Richtlinie auf dem Feld `expiresAt` aktiviert werden. Ohne TTL bleiben Zustellungsbelege gespeichert; Tageshistorie und negative Erfolgsbelege werden dadurch nicht gelöscht.

Nach Backend-Konfiguration:

```bash
npx firebase-tools deploy --only functions
```

Beim Parameter `VAPID_PUBLIC_KEY` den zum privaten Schlüssel gehörigen öffentlichen Schlüssel angeben. Anschließend das Frontend mit denselben öffentlichen Werten neu bauen.

Auf dem iPhone:

1. Produktionsadresse über HTTPS in Safari aufrufen.
2. **Teilen → Zum Home-Bildschirm** wählen und über das neue Symbol öffnen.
3. Anmelden und in den App-Einstellungen **Benachrichtigungen aktivieren** drücken.
4. Berechtigung bewusst erteilen und eine lokale Testbenachrichtigung anzeigen.
5. Eine Habit-Erinnerungszeit bzw. Review-Zeit konfigurieren und die tatsächliche serverseitige Zustellung prüfen. Die lokale Testbenachrichtigung prüft lediglich die Anzeige auf diesem Gerät und versendet keinen Netzwerk-Push.

Ohne Push-Konfiguration bleibt lokales Tracking möglich. Ein in der geöffneten App angezeigter Review ist keine simulierte Cloud-Push-Zustellung.

Die fünfminütige Verspätungsprüfung berücksichtigt auch einen Wechsel über Mitternacht. Doppelte Uhrzeiten bei Winterzeit erhalten durch den Ereignisschlüssel nur eine Erinnerung; eine beim Sommerzeitwechsel übersprungene Uhrzeit wird ausgelassen. Nach längerem Scheduler-Ausfall werden veraltete Erinnerungen nicht unbegrenzt nachgesendet.

## Lokale Firebase-Emulatoren

Für isolierte Cloud-Entwicklung können die in `firebase.json` definierten Emulatoren verwendet werden. Firebase CLI und die für den Firestore-Emulator erforderliche Java-Laufzeit installieren (Java 21 oder neuer für die aktuelle Firebase CLI), anschließend:

```bash
npx firebase-tools emulators:start --only auth,firestore,functions
```

Im Frontend `.env.local` mit einer passenden öffentlichen Entwicklungs-Konfiguration verwenden und `VITE_USE_FIREBASE_EMULATORS=true` setzen. Vite im Entwicklungsmodus starten. Die App verbindet Auth auf `127.0.0.1:9099` und Firestore auf `127.0.0.1:8080`; die Emulator-UI zeigt die CLI an. Ein über LAN verbundenes iPhone kann diese Loopback-Adressen nicht direkt erreichen.

Automatisierte Backend- und Regeltests können mit einem laufenden Firestore-Emulator ausgeführt werden:

```bash
npx firebase-tools emulators:exec --only firestore --project demo-bloom-rules 'npm --prefix functions test'
```

Ohne laufenden Emulator werden die Integrationstests ausdrücklich übersprungen; das ist keine bestandene Regelprüfung. In dieser Entwicklungsumgebung wurden die 33 Backendtests einschließlich 7 Regel- und 3 Admin-Integrationstests mit dem Emulator erfolgreich ausgeführt.

Die vollständige Auth-/Firestore-Browserintegration ist ein zusätzlicher Test:

```bash
npx firebase-tools emulators:exec --only auth,firestore --project demo-bloom-auth 'bash tests/auth/run.sh'
```

Er benötigt installierte Root-Abhängigkeiten und Chromium (`npx playwright install chromium`, alternativ `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`). Das Skript startet Vite vorübergehend auf Port 4191 (über `BLOOM_AUTH_TEST_PORT` anpassbar) und setzt eine ausschließlich lokale Demo-Firebase-Konfiguration im Prozess; keine `.env`-Datei wird geändert. Es prüft Registrierung, explizite lokale Datenübernahme, zwei Browserkontexte mit bidirektionaler Synchronisierung, Offline-Reconnect, Abmelden/Kontotrennung und das Schließen veralteter Dialoge bei kontenübergreifenden Tab-Wechseln. Diese sechs Abläufe wurden erfolgreich ausgeführt.

Emulatoren liefern keinen echten Apple-/Browser-Push und keinen produktiven Cloud Scheduler. Zeitgesteuerte Jobs und reale Pushes müssen nach Deployment separat verifiziert werden. In Produktions-Builds bleibt der Emulator-Schalter ohne Entwicklungsmodus wirkungslos.

## 6. Cloudflare Pages

1. In Cloudflare **Workers & Pages → Create application → Pages → Connect to Git** öffnen.
2. Das Repository und den gewünschten Produktionsbranch wählen. Änderungen zuerst auf dem Implementierungsbranch prüfen und anschließend nach Review übernehmen.
3. Build-Konfiguration:

| Einstellung | Wert |
| --- | --- |
| Framework | Vite / React, oder ohne Voreinstellung |
| Build-Befehl | `npm ci && npm run build` |
| Ausgabeordner | `dist` |
| Root-Verzeichnis | Repository-Wurzel |
| Node-Version | `22` oder neuer, z. B. über `NODE_VERSION=22` |

4. Für Cloud-Modus die öffentlichen Variablen aus Schritt 2 in **Settings → Variables and Secrets** als Buildvariablen hinterlegen. Preview und Production getrennt berücksichtigen. Kein privater Schlüssel gehört in den Frontend-Build.
5. Deployment starten. Danach die endgültige `*.pages.dev`-Domain bzw. eigene Domain in Firebase Authentication autorisieren.
6. Eigene Domain unter **Custom domains** verbinden und gültiges HTTPS abwarten.

Der SPA-Fallback wird von Pages automatisch bereitgestellt, solange keine oberste `404.html` existiert. Eine globale `_redirects`-Regel auf `/index.html` ist nicht nötig und wird bewusst vermieden: Workers Static Assets lehnt sie wegen möglicher Endlosschleifen ab. `public/_headers` und der Service Worker steuern Sicherheits-/Cacheverhalten. `sw.js` und das Manifest dürfen nicht durch einen dauerhaft unveränderlichen Browsercache am Update gehindert werden. Build-Assets mit Hash dürfen langfristig gecacht werden.

Cloudflare Pages hostet das gebaute Frontend. Firebase Functions werden separat im Firebase-Projekt betrieben. Pages stellt diese Jobs nicht automatisch bereit.

### Alternative: Cloudflare Workers mit Static Assets

Ein Deployment-Log mit `npx wrangler deploy` verwendet **Workers**, nicht den Pages-Buildablauf. Auch dieser Weg wird durch die eingecheckte `wrangler.jsonc` unterstützt. Es ist kein zusätzlicher Worker-Server und kein Cloudflare-Vite-Plugin erforderlich.

Im bestehenden Cloudflare-Workers-Projekt unter **Settings → Build** einstellen:

- Repository-Branch: den Branch mit diesem Fix verwenden bzw. den Fix zuerst nach `main` übernehmen.
- Root-Verzeichnis: Repository-Wurzel.
- Separater Build-Befehl: leer lassen; Wrangler führt durch `build.command` selbst `npm run build` aus.
- Deploy-Befehl: `npx wrangler deploy`.
- Worker-Name: `habit-app-chatgpt` (muss mit `wrangler.jsonc` übereinstimmen).
- Öffentliche `VITE_*`-Werte als Buildvariablen setzen, falls Firebase genutzt wird.

Dann ein neues Deployment des aktuellen Commits starten. Wrangler verwendet `dist` als Asset-Verzeichnis und den nativen SPA-Fallback `single-page-application`. Die eingecheckte Konfiguration verhindert die automatische Projektumschreibung aus dem fehlgeschlagenen Log. Sollte eine frühere Auto-Konfiguration im Repository gespeichert worden sein, zusätzliche Cloudflare-Vite-Plugin-Einträge und `.wrangler/deploy/config.json` vor einem sauberen Neubuild entfernen; dieser Repository-Stand benötigt sie nicht.

Ohne Veröffentlichung lässt sich die Paketierung lokal prüfen:

```bash
npx wrangler deploy --dry-run
```

Firebase Functions werden weiterhin separat bereitgestellt. Ein erfolgreicher Dry Run bestätigt die lokale Paketierung, noch keine erfolgreiche Cloudflare-API-Veröffentlichung.

## GitHub Actions

`.github/workflows/ci.yml` führt in zwei getrennten Jobs Root-TypeScript/Lint/Tests/Build plus Playwright sowie Functions-Build und die Firestore-/Auth-Emulatortests aus. Der Workflow läuft bei Pull Requests und Pushes nach `main` oder `codex/habit-pwa`, benötigt keine Produktions-Secrets und verwendet Demo-Projekte. Die lokale Prüfung dieser Befehle ist bestanden; ein tatsächlicher Lauf auf GitHub muss nach dem Push geprüft werden.

## Versionsupdate: Custom Habits und Review-XP

Für die Überarbeitung vom 12.11.2026 benötigen Custom Habits die aktualisierten Firestore-Regeln; die neue Review-Vergütung benötigt die aktualisierten Cloud Functions. Zuerst Backend aktualisieren, anschließend das Frontend auf Cloudflare:

```bash
npm --prefix functions ci
npx firebase-tools deploy --only firestore:rules,functions
```

Der Functions-Predeploy baut den aktuellen gemeinsamen Domänen-Code. Die neue Policy-Version erzwingt bei der nächsten geplanten Verarbeitung eine Neuberechnung alter XP-Zusammenfassungen. Bewertungen und Einträge werden nicht gelöscht. Historische Willpower-Boni entfallen; vorhandene Tagesreviews bringen stattdessen jeweils 5 XP. Deshalb kann sich der Gesamt-XP-/Levelstand ändern. In der lokalen App gilt dieselbe Regel sofort beim Laden. Keine Schlüssel oder Service-Accounts in Git speichern.

## 7. Abnahme nach Bereitstellung

- Mit zwei Konten prüfen, dass keine fremden Daten lesbar/schreibbar sind.
- Auf zwei Geräten anmelden, verschiedene Habits bearbeiten und Synchronisierung sowie Statusanzeigen prüfen.
- Nach geladenem App-Shell offline gehen, erfassen, neu öffnen und später wieder verbinden.
- Accountwechsel, lokale Datenübernahme und validierten JSON-Import ausprobieren.
- Negative Habits vor Tagesende verfehlen und nach Tageswechsel automatische Bewertung/XP prüfen.
- Review-Popup in geöffneter App und Push bei geschlossener installierter iOS-PWA getrennt testen.
- Installation, Hell/Dunkel-Systemwechsel, Safe Areas, Tastaturbedienung und reduzierte Bewegung prüfen.
- Scheduler-Logs und Belege nach wiederholter Verarbeitung kontrollieren; keine doppelten XP-/Zustellungsereignisse.

Diese Produktions- und Gerätetests sind erst nach tatsächlicher Ausführung bestanden. Lokale Geschäftslogik- und Browserprüfungen werden im [Implementierungsplan](../IMPLEMENTATION_PLAN.md#verifikationsprotokoll) gesondert protokolliert.
