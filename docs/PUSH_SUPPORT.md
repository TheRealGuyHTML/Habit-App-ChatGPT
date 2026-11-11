# iOS-PWA und Push-Unterstützung

Geprüft am **11. November 2026** anhand der offiziellen Dokumentation.

## Ergebnis der Kompatibilitätsprüfung

- [Firebase: Supported environments for the JavaScript SDK](https://firebase.google.com/docs/web/environments-js-sdk) weist **Cloud Messaging für iOS Safari und Safari als unterstützt aus**. Eine pauschale Aussage „FCM funktioniert auf iOS nicht“ wäre falsch.
- [Firebase: Set up a JavaScript Firebase Cloud Messaging client app](https://firebase.google.com/docs/cloud-messaging/js/client) beschreibt HTTPS, Service Worker, Push API, VAPID und Benachrichtigungsberechtigungen als Web-Voraussetzungen.
- [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) dokumentiert Web Push **ab iOS/iPadOS 16.4 für zum Home-Bildschirm hinzugefügte Web-Apps**. Die Berechtigungsfrage muss direkt auf eine Nutzeraktion folgen. Apple-Developer-Mitgliedschaft ist dafür nicht erforderlich; die Zustellung läuft über APNs.

Bloom verwendet eine **standardbasierte Web-Push-Implementierung mit VAPID**. Firebase bleibt für Authentifizierung, Firestore und Cloud Functions zuständig. Der direkte Web-Push-Ansatz ist eine kompatible Alternative zu FCM und benötigt keinen zweiten Messaging-Service-Worker oder FCM-Token. Er wird nicht mit einer behaupteten fehlenden FCM-Unterstützung begründet.

## Implementierung

1. Nur der Button in Einstellungen ruft `Notification.requestPermission()` auf. Beim Start oder Onboarding gibt es keine Berechtigungsfrage.
2. `PushManager.subscribe()` registriert das Gerät; die Subscription wird unter dem angemeldeten Nutzer in Firestore gespeichert. Der öffentliche VAPID-Schlüssel darf im Frontend stehen; der private Schlüssel steht ausschließlich in Google Secret Manager.
3. `sendHabitReminders` läuft minütlich in `europe-west1`, berechnet die lokale Uhrzeit anhand der IANA-Zeitzone des Profils und prüft den historischen Habit-Zeitplan. Erinnerungen werden innerhalb eines fünfminütigen Verspätungsfensters zugestellt.
4. Pro lokalem Tag, Erinnerung und Subscription gibt es eine deterministische Zustellungsquittung. Eine Transaktions-Lease verhindert parallele Sendungen; Fehler werden höchstens dreimal erneut versucht. Ein identischer Notification-Tag fasst Wiederholungen am Gerät zusammen. Bei 404/410 wird die Subscription gelöscht. Eine Netzwerkunterbrechung nach erfolgreichem Senden, aber vor dem Schreiben der Quittung kann dennoch eine erneute Transportzustellung verursachen; Web Push bietet kein exakt-einmaliges Transportversprechen.
5. Abmelden oder Deaktivieren widerruft die Browser-Subscription. Andere Geräte behalten ihre eigene Subscription und ihr eigenes Login.
6. Der Service Worker zeigt Push-Nachrichten auch bei geschlossener App. Klicks fokussieren/öffnen die App. Das Review-Popup selbst kann nur in der geöffneten App erscheinen; iOS erlaubt keine Website, eigenmächtig UI über anderen Apps einzublenden.

Endpunkte werden im Servercode auf die bekannten HTTPS-Push-Dienste von Apple, Google, Mozilla und Microsoft begrenzt. Benutzername, Passwort, benutzerdefinierte Ports und andere Zielhosts werden abgewiesen, um fremde URLs nicht als serverseitige Request-Ziele zu akzeptieren. Neue Browser-Push-Dienste brauchen eine geprüfte Erweiterung dieser Liste.

## Einrichtung

Siehe [DEPLOYMENT.md](DEPLOYMENT.md). Erforderlich sind Firebase-Anmeldung, Firestore-Regeln, bereitgestellte Functions und Scheduler mit aktiviertem Blaze-Tarif sowie ein VAPID-Schlüsselpaar:

```sh
npx web-push generate-vapid-keys
firebase functions:secrets:set VAPID_PRIVATE_KEY
firebase functions:secrets:set VAPID_SUBJECT
```

Die Befehle fragen interaktiv nach den Werten. `VAPID_SUBJECT` ist z. B. eine Kontaktadresse im Format `mailto:admin@example.com`. Niemals private Schlüssel in die Shell-History oder das Repository kopieren. Den öffentlichen Schlüssel als `VITE_VAPID_PUBLIC_KEY` in der Frontend-Build-Konfiguration setzen und denselben Wert beim Deployment der Functions für den Parameter `VAPID_PUBLIC_KEY` angeben.

Optional in Firestore für die Collection Group `notificationReceipts` eine TTL-Regel auf `expiresAt` aktivieren; die Quittungen werden sonst aufbewahrt. Für den Scheduler-Serviceaccount gelten die von Firebase erstellten minimalen Standardrollen; keine Service-Account-Datei ist nötig.

## Fallbacks und reale Grenzen

- Ohne Firebase/VAPID/Functions meldet die UI ausdrücklich den **Vordergrundmodus**. Dann funktionieren Erinnerungen nur, solange die App geöffnet ist und der Browser ihre Ausführung zulässt. Es gibt keine zuverlässigen lokalen Hintergrund-Alarme für eine geschlossene PWA.
- Der Button „Testbenachrichtigung“ prüft **lokal** Berechtigung und Service Worker mittels `showNotification()`. Er bestätigt keine serverseitige oder APNs-Zustellung.
- Eine in der Hintergrundphase angehaltene PWA kann Timer nicht kontinuierlich ausführen. Timer rekonstruieren beim Öffnen den verstrichenen Zeitraum aus gespeicherten Zeitstempeln. Ein Signal exakt zum Ablauf bei geschlossener App ist nicht zugesichert.
- Web Push ist keine Wecker-Funktion: Betriebssystem, Netzwerk, Focus, Energiesparen und deaktivierte Berechtigungen können Meldungen verzögern oder unterdrücken. Das fünfminütige Fenster begrenzt alte Meldungen; es verhindert auch Zustellung nach längeren Scheduler-Ausfällen.
- Wiederholte lokale Uhrzeiten bei Winterzeit erhalten durch den Tag-/Erinnerungs-Schlüssel nur eine Nachricht. Eine bei Sommerzeit übersprungene Uhrzeit wird nicht nachträglich simuliert.
- Ein Wechsel der Zeitzone wirkt auf neue Tageszuordnungen und zukünftige Reminder. Vorhandene Einträge behalten ihren gespeicherten Kalendertag und ihre ursprüngliche Zeitzone.

Automatisierte Tests prüfen Push-Endpunktvalidierung, lokale Uhrzeiten, DST und Firestore-Zugriffsregeln. Echte APNs-/iPhone-Zustellung und Cloud-Scheduler-Betrieb benötigen ein konfiguriertes Projekt und ein reales installiertes Gerät und sind in der nicht konfigurierten Demo nicht überprüft.
