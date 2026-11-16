import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return null;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

function applicationKey(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const data = atob(base64);
  return Uint8Array.from(data, char => char.charCodeAt(0));
}

async function subscriptionId(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export interface PushActivation { mode: 'push' | 'foreground'; message: string }
let activation: Promise<PushActivation> | null = null;
let generation = 0;
export function enablePush(): Promise<PushActivation> {
  if (activation) return activation;
  const task = activatePush();
  activation = task;
  void task.then(() => { activation = null; }, () => { activation = null; });
  return task;
}

async function activatePush(): Promise<{ mode: 'push' | 'foreground'; message: string }> {
  const uid = auth?.currentUser?.uid;
  const startedGeneration = generation;
  if (!('Notification' in window)) throw new Error('Dieser Browser unterstützt keine Benachrichtigungen. Auf iOS 16.4+ die App zuerst zum Home-Bildschirm hinzufügen. / Install this app on the iOS Home Screen first.');
  // Call immediately from a user gesture; do not await setup before this request.
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') throw new Error('Benachrichtigungen sind nicht erlaubt. Aktiviere sie in den Browser-/iOS-Einstellungen und versuche es erneut. / Allow notifications in browser or iOS Settings, then try again.');
  if (auth?.currentUser?.uid !== uid) throw new Error('Konto gewechselt. / Account changed.');
  const registration = await registerServiceWorker();
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!uid || !db) return { mode: 'foreground', message: 'Nur bei geöffneter App: Für Hintergrund-Push bitte mit deinem Cloud-Konto anmelden und hier erneut aktivieren. Die Uhrzeit bleibt gespeichert. / Foreground only: sign in to your cloud account, then activate again here. Your reminder time is kept.' };
  if (!publicKey) return { mode: 'foreground', message: 'Nur bei geöffneter App: Der Push-Server ist noch nicht konfiguriert (öffentlicher VAPID-Schlüssel fehlt). / Foreground only: the push backend is not configured (public VAPID key missing).' };
  if (!registration || !('PushManager' in window)) return { mode: 'foreground', message: 'Nur bei geöffneter App: Hintergrund-Push wird hier nicht unterstützt. Auf iOS 16.4+ zuerst zum Home-Bildschirm hinzufügen. / Foreground only: install on the iOS Home Screen to use supported background push.' };
  if (!navigator.onLine) throw new Error('Offline: Push konnte nicht registriert werden. Die Habit-Zeit bleibt gespeichert. / Offline: reconnect and try again; your reminder time is kept.');
  await navigator.serviceWorker.ready;
  if (auth?.currentUser?.uid !== uid) throw new Error('Konto gewechselt. Bitte erneut aktivieren. / Account changed; try again.');
  let subscription = await registration.pushManager.getSubscription();
  const oldKey = subscription?.options?.applicationServerKey;
  const nextKey = applicationKey(publicKey);
  if (subscription && oldKey && String(new Uint8Array(oldKey)) !== String(nextKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(publicKey) });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Ungültige Push-Registrierung. / Invalid push subscription.');
  if (generation !== startedGeneration || auth?.currentUser?.uid !== uid) { await subscription.unsubscribe(); throw new Error('Aktivierung abgebrochen: Konto oder Einstellung geändert. / Activation cancelled: account or preference changed.'); }
  const id = await subscriptionId(json.endpoint);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([setDoc(doc(db, 'users', uid!, 'pushSubscriptions', id), {
      endpoint: json.endpoint, keys: json.keys, updatedAt: new Date().toISOString(),
    }), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Push-Speicherung nicht bestätigt. Bitte online erneut versuchen. / Push storage not confirmed; reconnect and retry.')), 12000); })]);
  } finally { clearTimeout(timeout); }
  if (generation !== startedGeneration || auth?.currentUser?.uid !== uid) { await subscription.unsubscribe(); throw new Error('Konto oder Einstellung geändert. Bitte erneut aktivieren. / Account or preference changed; try again.'); }
  return { mode: 'push', message: 'Push ist auf diesem Gerät registriert. / Push registered on this device.' };
}

export async function disablePush(): Promise<void> {
  generation++;
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;
  await subscription.unsubscribe();
  if (db && auth?.currentUser) {
    const deletion = deleteDoc(doc(db, 'users', auth.currentUser.uid, 'pushSubscriptions', await subscriptionId(subscription.endpoint)));
    if (navigator.onLine) await deletion;
    else void deletion.catch(() => { /* The endpoint has already been revoked at the browser. Server expires it on 410. */ });
  }
}

export async function sendTestNotification(): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') throw new Error('Bitte Benachrichtigungen zuerst aktivieren. / Enable notifications first.');
  const registration = await registerServiceWorker();
  if (!registration) throw new Error('Service Worker nicht verfügbar. / Service worker unavailable.');
  await navigator.serviceWorker.ready;
  await registration.showNotification('Bloom · Zeit für dich', { body: 'Ein kleiner Schritt zählt. / One small step counts.', icon: '/icon-192.png', tag: 'bloom-test' });
}

/** In-app fallback: evaluate on resume and once per minute, never claim background reliability. */
export function showForegroundReminder(title: string, body: string, tag: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  void navigator.serviceWorker?.ready.then(registration => registration.showNotification(title, { body, icon: '/icon-192.png', tag })).catch(() => { /* Foreground delivery is best-effort; explicit test/activation reports errors. */ });
}
