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

export async function enablePush(): Promise<{ mode: 'push' | 'foreground'; message: string }> {
  if (!('Notification' in window)) throw new Error('Dieser Browser unterstützt keine Benachrichtigungen. Auf iOS 16.4+ die App zuerst zum Home-Bildschirm hinzufügen. / Install this app on the iOS Home Screen first.');
  // This function is called exclusively by the settings button. Never request at startup.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Benachrichtigungen wurden nicht erlaubt. / Notifications were not allowed.');
  const registration = await registerServiceWorker();
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!registration || !('PushManager' in window) || !publicKey || !auth?.currentUser || !db) {
    return { mode: 'foreground', message: 'Nur bei geöffneter App: Für Hintergrund-Push sind Anmeldung, VAPID und bereitgestellte Cloud Functions nötig. / Foreground only until signed in and the push backend is configured.' };
  }
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(publicKey) });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Ungültige Push-Registrierung. / Invalid push subscription.');
  const id = await subscriptionId(json.endpoint);
  await setDoc(doc(db, 'users', auth.currentUser.uid, 'pushSubscriptions', id), {
    endpoint: json.endpoint, keys: json.keys, updatedAt: new Date().toISOString(),
  });
  return { mode: 'push', message: 'Push ist auf diesem Gerät registriert. / Push registered on this device.' };
}

export async function disablePush(): Promise<void> {
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
  void navigator.serviceWorker?.ready.then(registration => registration.showNotification(title, { body, icon: '/icon-192.png', tag }));
}
