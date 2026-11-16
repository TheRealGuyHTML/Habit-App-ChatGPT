import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ auth: { currentUser: { uid: 'alice' } as { uid: string } | null }, db: {} }));
vi.mock('../src/services/firebase', () => mock);
vi.mock('firebase/firestore', () => ({ doc: vi.fn((...args) => args), setDoc: vi.fn(async () => {}), deleteDoc: vi.fn(async () => {}) }));
import { setDoc } from 'firebase/firestore';
let request: ReturnType<typeof vi.fn>;
let subscribe: ReturnType<typeof vi.fn>;
let getSubscription: ReturnType<typeof vi.fn>;
const subscription = { endpoint: 'https://web.push.apple.com/test', toJSON: () => ({ endpoint: 'https://web.push.apple.com/test', keys: { p256dh: 'key', auth: 'auth' } }), unsubscribe: vi.fn(async () => true) };
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'AQID');
  mock.auth.currentUser = { uid: 'alice' };
  request = vi.fn(async () => 'granted');
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: request });
  subscribe = vi.fn(async () => subscription);
  getSubscription = vi.fn(async () => null);
  const registration = { pushManager: { getSubscription, subscribe } };
  vi.stubGlobal('window', { Notification: globalThis.Notification, isSecureContext: true, PushManager: {} });
  vi.stubGlobal('navigator', { onLine: true, serviceWorker: { register: vi.fn(async () => registration), ready: Promise.resolve(registration) } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('requests permission synchronously from activation and registers before reporting success', async () => {
  const { enablePush } = await import('../src/services/notifications');
  const pending = enablePush();
  expect(request).toHaveBeenCalledTimes(1);
  expect(await pending).toMatchObject({ mode: 'push' });
  expect(setDoc).toHaveBeenCalledTimes(1);
});
it('skips an already granted permission prompt and reuses an existing subscription', async () => {
  vi.stubGlobal('Notification', { permission: 'granted', requestPermission: request });
  getSubscription.mockResolvedValue(subscription);
  const { enablePush } = await import('../src/services/notifications');
  await enablePush(); await enablePush();
  expect(request).not.toHaveBeenCalled(); expect(subscribe).not.toHaveBeenCalled();
});
it('deduplicates parallel activations', async () => {
  const { enablePush } = await import('../src/services/notifications');
  const a = enablePush(); const b = enablePush(); expect(a).toBe(b);
  await Promise.all([a, b]); expect(subscribe).toHaveBeenCalledTimes(1);
});
it('preserves a denied permission without requesting it again', async () => {
  vi.stubGlobal('Notification', { permission: 'denied', requestPermission: request });
  const { enablePush } = await import('../src/services/notifications');
  await expect(enablePush()).rejects.toThrow(/Einstellungen/);
  expect(request).not.toHaveBeenCalled(); expect(subscribe).not.toHaveBeenCalled();
});
it.each(['account', 'key'])('reports foreground-only mode for missing %s', async missing => {
  if (missing === 'account') mock.auth.currentUser = null; else vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
  const { enablePush } = await import('../src/services/notifications');
  expect(await enablePush()).toMatchObject({ mode: 'foreground' });
  expect(setDoc).not.toHaveBeenCalled();
});
it('does not report success for subscription failure and permits retry', async () => {
  subscribe.mockRejectedValueOnce(new Error('subscription failed'));
  const { enablePush } = await import('../src/services/notifications');
  await expect(enablePush()).rejects.toThrow('subscription failed');
  expect(await enablePush()).toMatchObject({ mode: 'push' });
});
it('does not report success for failed Firestore writes', async () => {
  vi.mocked(setDoc).mockRejectedValueOnce(new Error('permission-denied'));
  const { enablePush } = await import('../src/services/notifications');
  await expect(enablePush()).rejects.toThrow('permission-denied');
});
it('fails promptly offline without subscribing', async () => {
  Object.assign(navigator, { onLine: false });
  const { enablePush } = await import('../src/services/notifications');
  await expect(enablePush()).rejects.toThrow('Offline'); expect(subscribe).not.toHaveBeenCalled();
});
it('rejects account changes during the permission prompt', async () => {
  request.mockImplementation(async () => { mock.auth.currentUser = { uid: 'bob' }; return 'granted'; });
  const { enablePush } = await import('../src/services/notifications');
  await expect(enablePush()).rejects.toThrow('Konto'); expect(setDoc).not.toHaveBeenCalled();
});
it('revokes a subscription created while the account changes', async () => {
  subscribe.mockImplementation(async () => { mock.auth.currentUser = { uid: 'bob' }; return subscription; });
  const { enablePush } = await import('../src/services/notifications');
  await expect(enablePush()).rejects.toThrow('abgebrochen');
  expect(subscription.unsubscribe).toHaveBeenCalledTimes(1); expect(setDoc).not.toHaveBeenCalled();
});
it('reports service-worker registration errors', async () => {
  vi.mocked(navigator.serviceWorker.register).mockRejectedValueOnce(new Error('worker failed'));
  const { enablePush } = await import('../src/services/notifications');
  await expect(enablePush()).rejects.toThrow('worker failed'); expect(setDoc).not.toHaveBeenCalled();
});
it('reports rejected native permission requests without subscribing', async () => {
  request.mockRejectedValueOnce(new Error('permission request failed'));
  const { enablePush } = await import('../src/services/notifications');
  await expect(enablePush()).rejects.toThrow('permission request failed'); expect(subscribe).not.toHaveBeenCalled();
});
