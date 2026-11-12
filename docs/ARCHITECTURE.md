# Architektur und Datenentscheidungen

Die Anwendung folgt [Konzeptplan.md](../Konzeptplan.md). Konkrete Annahmen und Produktentscheidungen sind im [Implementierungsplan](../IMPLEMENTATION_PLAN.md) festgehalten.

## Schichten

| Bereich | Verantwortung |
| --- | --- |
| `src/domain` | Typen, lokale Kalenderdaten, Wiederholungen, historische Habit-Konfiguration, Statistik, XP, Vorlagen und Importvalidierung |
| `src/components` | Zugängliche, responsive React-Oberflächen und Spezial-Tracker |
| `src/services` | Lokaler Speicher, kontogetrennte Firebase-Synchronisierung, Authentifizierung und Benachrichtigungen |
| `functions` | Serverseitige Tagesabschlüsse und zeitgesteuerte Push-Verarbeitung |
| `public/sw.js` | App-Shell-Cache, Offline-Fallback, Push-Empfang und Notification-Klicks |
| `firestore.rules` | Zugriffsschutz und Trennung zwischen Nutzer- und serververwalteten Daten |
| `tests` | Automatisierte Prüfungen kritischer Regeln und zentraler Benutzerabläufe |

Die Oberfläche verwendet dieselben Domänenfunktionen für Tagesansicht, Statistik und Gamification. So entstehen keine voneinander abweichenden Streak- oder XP-Berechnungen.

## Kalender und Historie

`AppState` enthält versionierte Habits, Tages-Einträge, Daily Reviews und Einstellungen. Ein Eintrag verwendet als stabile Identität Habit-ID plus lokalen Tag. Er speichert außerdem die Zeitzone und den Aktualisierungszeitpunkt. Der historische Kalendertag wird beim Reisen oder beim Wechsel der Zeitzone nicht nachträglich umgerechnet.

Kalenderarithmetik arbeitet auf Datumswerten. Das Addieren eines Kalendertages ist unabhängig davon, ob dieser wegen Sommerzeit 23, 24 oder 25 Stunden hat. Die eingestellte IANA-Zeitzone bestimmt „heute“ und die Zuordnung serverseitiger Erinnerungen.

Ein Habit besitzt `createdDay`, zeitlich geltende Konfigurationsrevisionen, Pausenintervalle und optional `deletedFrom`. Eine Änderung gilt ab dem Änderungstag; frühere Tage behalten ihre damalige Wiederholung und ihr damaliges Ziel. Pausen gelten einschließlich Starttag und ausschließlich Endtag (`[from, to)`). Löschen archiviert das Habit ab dem gewählten Tag und erhält frühere Einträge für Statistik und XP. Einmalige Aufgaben haben genau einen relevanten Tag und dürfen nicht pausiert werden. Wird ein pausiertes wiederkehrendes Habit in eine einmalige Aufgabe geändert, endet die laufende Pause am Änderungstag; die frühere Pause bleibt in der Historie erhalten.

Streaks zählen ausschließlich geplante, aktive Tage. Freie Wochentage und Pausen unterbrechen die Streak nicht. Ein noch nicht abgeschlossener heutiger Tag soll eine bis gestern bestehende Streak nicht vorzeitig zerstören. Statistiken betrachten keine zukünftigen Tage. Die heutige Erfolgsquote kann vorausgewählte negative Habits als vorläufig erfolgreich anzeigen; deren XP und bestätigte Erfolgsserie werden erst nach lokalem Tagesende gewertet.

## Negative Habits und Limit-Tracker

Negative Habits sind ohne Fehlermeldung vorausgewählt. Ein bewusst entfernter Haken hält den Misserfolg dieses Tages fest. Die Ansicht kann während des aktuellen Tages bereits „widerstanden“ zeigen; die automatische Erfolgsbewertung und Erfolgs-XP werden erst nach dem lokalen Tagesende berücksichtigt.

Der serverseitige Tagesabschluss ergänzt einen idempotenten Beleg. Die Historie wird dabei nicht gelöscht und kein globaler Reset durchgeführt. Der lokale Modus kann dieselbe abgeschlossene Tagesbewertung aus den vorhandenen Ereignissen ableiten, wenn die App wieder geöffnet wird. Bei Bildschirmzeit wird die manuell erfasste Zeit mit dem konfigurierten Maximum verglichen; die App liest keine iOS-Screen-Time-Daten.

## XP, Level und Meilensteine

Der Konzeptplan nennt drei Schwierigkeiten und Meilensteine, jedoch keine Zahlen. Für diese Implementierung gelten:

| Regel | Wert |
| --- | --- |
| Leicht | 10 Basis-XP |
| Mittel | 25 Basis-XP |
| Komplex | 50 Basis-XP |
| Daily Review | +5 XP je gespeichertem lokalen Tagesreview, unabhängig von Bewertungen und Habit-Erledigungen |
| 7 relevante Erfolgs-Tage in Folge | Multiplikator 1,10 |
| 21 relevante Erfolgs-Tage in Folge | Multiplikator 1,25 |
| 66 relevante Erfolgs-Tage in Folge | Multiplikator 1,50 |
| Kumulative Schwelle für Level `L` | `100 × (L − 1) × L / 2` XP |

Die höchste erreichte relevante Habit-Streak schaltet den Multiplikator frei. Nachfolgend ausgelassene Tage entfernen einen bereits erreichten Meilenstein nicht. Der Multiplikator wird chronologisch ab Erreichen angewendet; vergangene Tagesereignisse werden nicht nachträglich aufgewertet. Eine historische Datenkorrektur darf eine zuvor fälschlich erfasste Erfolgsserie korrigieren.

XP sind eine deterministische Ableitung eindeutiger Tagesereignisse. Mehrfaches Synchronisieren, Neuladen oder Verarbeiten erhöht den Betrag nicht. Eine zurückgenommene Erledigung entfernt deren Habit-XP; die 5 Review-XP bleiben erhalten, solange der Tagesreview existiert. Ein Review wird über `review:YYYY-MM-DD` genau einmal berücksichtigt, auch nach Änderungen oder Synchronisierung. Zukünftige Reviews erhalten noch keine XP. Der Review-Betrag erhält keinen Streak-Multiplikator und zählt nicht als Habit-Erledigung für Erfolge. Der frühere Willpower-Bonus entfällt auch bei der Neuberechnung bestehender Historie.

Die Pflanze visualisiert Level und Konsistenz. Sie ist Teil der Oberfläche; ihre Wachstums- und Welke-Zustände werden aus Fortschritt abgeleitet und nicht als unabhängiger manipulierbarer Zähler geführt.

## Timer und mobile Betriebssysteme

`timerStartedAt` ist ein Epoch-Zeitstempel in Millisekunden, `timerElapsed` die bereits angesammelte Zeit in Millisekunden. Anzeigenintervalle sind kein Zeitmessgerät. Das ermöglicht korrektes Fortsetzen nach Hintergrundwechsel oder Neuladen.

iOS darf eine PWA im Hintergrund anhalten. Ein Timer kann deshalb während geschlossener App keinen verlässlichen lokalen Alarm auslösen. Nach Rückkehr berechnet die App die verstrichene Zeit und den Zielstatus neu. Tagesübergreifende Timer dürfen die vergangene Sitzung nicht stillschweigend einem anderen Kalendertag zuordnen.

## Synchronisierung und Offline-Nutzung

Der lokale Modus benötigt kein Firebase-Projekt. Lokale Daten bleiben im Browserprofil; Löschen der Website-Daten entfernt sie. JSON-Export ist deshalb auch ein praktisches Backup.

Firebase Authentication bestimmt den aktiven Nutzer. Lokale Daten und Konten werden getrennt gehalten; lokale Demo-Daten werden nur nach einer ausdrücklichen Importaktion in ein Konto übernommen. Cloud-Daten liegen unter dem jeweiligen Nutzer. Einzelne Habits, Einträge und Reviews werden getrennt synchronisiert, damit Änderungen an verschiedenen Dokumenten sich nicht gegenseitig überschreiben. Gleichzeitige Änderungen desselben Dokuments verwenden Last-Write-Wins anhand eines geordneten Stempels aus Gerätezeit, Sequenz und Tab-ID. Änderungen an verschiedenen Dokumenten bleiben unabhängig. Die Geräteuhren sollten korrekt eingestellt sein; gleichzeitiges Bearbeiten desselben Eintrags wird nicht feldweise zusammengeführt. Dieser Ansatz ist kein kollaboratives CRDT. Eine persistente Outbox hält noch nicht bestätigte Änderungen pro Konto für spätere Synchronisierung vor; Nullwerte als Tombstones verhindern eine unbemerkte Wiederherstellung gelöschter Dokumente.

Firestore Security Rules müssen vor Cloud-Nutzung bereitgestellt werden. Der Client darf eigene Habit-/Review-Daten schreiben, serververwaltete Abschluss-/Zustellungsbelege jedoch nicht. Eine lokal berechnete XP-Anzeige ist kein manipulationssicherer Wettbewerbsscore.

## Service Worker und App-Updates

Der Produktions-Build erzeugt `precache-manifest.json` aus allen gebauten Assets und schreibt einen aus den Assetnamen abgeleiteten Versionshash in den Namen des Service-Worker-Caches. Ein neuer Build verändert damit auch `sw.js`; die Aktivierung entfernt ältere Bloom-Caches. Das verhindert, dass nur ein unveränderlicher Workername mit einer veralteten App-Shell weiterverwendet wird.

Die Installation lädt App-Shell, Icons und sämtliche gebauten JS-/CSS-Chunks vor. Navigation verwendet das Netzwerk mit gecachter `index.html` als Offline-Fallback. Öffentliche Assets desselben Ursprungs werden aus dem Cache gelesen. Dabei wird bei diesen öffentlichen, für alle Origin-Header identischen Ressourcen `Vary` ignoriert: Ein CDN-/Preview-Header `Vary: Origin` darf Modul-Requests nicht vom beim Installieren gefüllten Cache ausschließen. Diese Ausnahme gilt nicht für Firebase-, Auth- oder API-Antworten. Nutzerinhalte werden durch den kontogetrennten Datenspeicher gehalten und nicht im allgemeinen App-Shell-Cache abgelegt.

## Push

Push verwendet Web-Push-Subscriptions und einen VAPID-Schlüssel. Der private Schlüssel gehört ausschließlich in serverseitige Secrets. Eine Berechtigungsanfrage darf nur durch eine aktive Nutzeraktion gestartet werden. Ohne Server-Konfiguration bleibt die App benutzbar; die Oberfläche erläutert den verfügbaren Benachrichtigungsmodus.

iOS-spezifische Voraussetzungen, der Unterschied zu FCM und die geprüften Herstellerquellen stehen in [PUSH_SUPPORT.md](PUSH_SUPPORT.md). Zustellung ist vom Browser, Betriebssystem und Netzwerk abhängig; ein minutengenau geplanter Serverjob garantiert keinen minutengenauen Empfang.

## Validierung und bekannte externe Grenzen

Importierte Zustände werden vor der Übernahme vollständig nach Schema geprüft. Die Schutzgrenzen betragen 10 MB JSON, 300 Habits, 50.000 Tages-Einträge und 10.000 Reviews; unterstützte Kalenderdaten liegen zwischen 1900 und 2200. Zusätzlich werden maximal 1.000.000 kombinierte Tages-/Versionsschritte zugelassen, um übermäßig teure importierte Historien abzuweisen. Revisionen müssen zeitlich konsistent sein, Pausen dürfen sich nicht überschneiden und Tracker-Typ, Einheit sowie negative Ziele müssen miteinander vereinbar sein. Diese Importgrenzen begrenzen nicht nachträglich die bestehende Historie; es gibt keinen 365-Tage-Abbruch der Streak-Berechnung. Unbekannte oder beschädigte Daten dürfen keinen teilweise überschriebenen Zustand hinterlassen. Export enthält persönliche Habit-, Journal- und Review-Inhalte und sollte entsprechend aufbewahrt werden.

Firestore-Regeln und serverseitige Idempotenz wurden zusätzlich gegen einen echten Firestore-Emulator geprüft. Ein separater Browserablauf mit Auth-/Firestore-Emulatoren bestätigt Registrierung, explizite Gastdatenübernahme, bidirektionale Synchronisierung über zwei isolierte Browserkontexte, Offline-Outbox, Kontotrennung beim Abmelden und das Schließen veralteter kontobezogener Dialoge bei Accountwechsel über mehrere Tabs. Diese lokalen Prüfungen ersetzen keine echten Multi-Device-Tests gegen die Produktionskonfiguration. Produktions-Firebase, Cloud-Scheduler-Ausführung, Cloudflare-Veröffentlichung und physische iPhone-Push-Tests benötigen die externe Einrichtung aus [DEPLOYMENT.md](DEPLOYMENT.md).

## Abhängigkeiten

Die Root-Konfiguration setzt `@grpc/grpc-js` per npm-Override auf `^1.14.7`. Firebase zieht gRPC transitiv ein; der Override hält den behobenen Stand auch bei einer älteren Unterabhängigkeitsauflösung einheitlich fest. Beide npm-Lockfiles werden versioniert, damit lokale Installation, CI und Functions-Build denselben geprüften Abhängigkeitsstand verwenden. `npm audit --omit=dev` prüft die jeweiligen Produktionsabhängigkeiten; es ersetzt keine Geschäftslogik- oder Zugriffsschutztests.


## Mobile Überarbeitung vom 12.11.2026

Die Startansicht hält Spezialkarten unter dem Zweifachen der normalen Mindesthöhe (88 px). Wasser/Portionen und Timer haben direkte Kurzbedienung; vollständige Eingaben, Checklisten und Journaling öffnen sich in einem Dialog. Die Karte wächst dadurch nicht mit Checklisten- oder Textlänge. Die Wochenstatistik nutzt einen ungefähr halbierten Platzbedarf. Habit-Insights stehen einzeln untereinander; ab `deletedFrom <= today` erscheinen sie ausschließlich im geschlossenen Archiv „Gelöschte Habits“. Historische Einträge bleiben gespeichert.

Erfolge verwenden natives horizontales Scroll-Snap mit Tasten und Touch-Swipe. Automatisch ausgewählt wird der zeitlich zuletzt erreichte Erfolg; bei gleichem Datum der höhere Meilenstein. Ohne Erfolge wird das erste offene Ziel angezeigt. Manuelles Browsen bleibt erhalten, bis sich diese automatische Auswahl ändert. Level-, Basis-XP- und Multiplikator-Erklärung sind eine gemeinsame Karte.

`HabitConfig.custom?: boolean` kennzeichnet einen Custom Habit unabhängig von der verwendeten Tracker-Engine (`kind`). Alte Daten ohne dieses optionale Feld bleiben importierbar. Custom Habits können jede vorhandene Spezialfunktion wählen. Der Wechsel zum Custom Habit setzt Spezialmodus, Ziel, Einheit und Unterpunkte zurück; danach lässt sich eine neue Spezialfunktion bewusst auswählen. Historische Revisionen bewahren die bisherigen Tracker-Einstellungen.

Reviews zeigen bei allen Skalen die positive Seite als 5. „Wie leicht fiel dir der Anfang?“ wird zur Speicherung weiterhin in das vorhandene Widerstandsfeld umgerechnet: `resistance = 6 - angezeigte Leichtigkeit`. So behalten historische Exporte und Bewertungen ihre Bedeutung; Insights rechnen ebenfalls in Leichtigkeit um. Die Fragen belohnen keine schlechte oder gute Bewertung.

Die XP-Regeln haben Version 2. Die Serverzusammenfassung speichert `policyVersion`; der Tagesabschluss berechnet ältere Zusammenfassungen auch am selben Tag neu. Neue Frontend- und Functions-Version verwenden die gemeinsame Domäne. Beim Release müssen die Firestore-Regeln (optionales `custom`-Feld) und Functions zusammen mit dem Frontend aktualisiert werden.


## Kompakte Habit-Heatmaps

Die Monatskalender wurden durch ein Raster mit 7 Wochentagsreihen (Montag bis Sonntag) und 16 fortlaufenden Wochenspalten ersetzt. Die 11-px-Kästchen enthalten keine Tageszahlen. Erledigungen erscheinen in #ec4899 mit dezentem Leuchten; geplante offene Tage bleiben transparent abgedunkelt. Ungeplante/pausierte Tage haben einen zurückhaltenden gestrichelten Umriss, zukünftige Tage reduzierte Deckkraft. Die Planung und Erledigungen stammen unverändert aus der Domäne.

Die Karte erhält eine kompakte Statistikzeile und Wochenblock-Navigation bis zur Erstellung des Habits. Ältere Einträge bleiben erreichbar. Antippen zeigt Datum und Status in einer flachen Detailzeile; vorhandene Journaltexte sind über „Notiz ansehen“ vollständig in einem Dialog lesbar, ohne die Karte zu vergrößern. Zugängliche Labels enthalten das vollständige Datum. Ein Tab-Stopp pro Raster sowie Pfeiltasten (vertikal Tage, horizontal Wochen) und Home/End erlauben Tastaturbedienung. Aktive und archivierte Habits verwenden dasselbe Raster.
