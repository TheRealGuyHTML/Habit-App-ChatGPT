import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

interface WorkerEvent {
  data?: { json(): unknown };
  notification?: { close(): void; data: { url: string } };
  waitUntil(promise: Promise<unknown>): void;
}

function worker(existingWindows: unknown[] = []) {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const showNotification = vi.fn(async () => {});
  const openWindow = vi.fn(async () => {});
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL,
    self: {
      location: { origin: 'https://bloom.example' },
      addEventListener: (name: string, callback: (event: WorkerEvent) => void) => listeners.set(name, callback),
      registration: { showNotification },
      clients: { matchAll: async () => existingWindows, openWindow },
    },
  });
  async function dispatch(name: string, event: Omit<WorkerEvent, 'waitUntil'>) {
    let completion: Promise<unknown> | undefined;
    listeners.get(name)!({ ...event, waitUntil: promise => { completion = promise; } });
    await completion;
  }
  return { dispatch, showNotification, openWindow };
}

describe('service worker push navigation', () => {
  it.each(['/?action=review', '/', 'https://evil.example/?action=review', 'javascript:alert(1)'])('sanitizes notification destination %s', async url => {
    const sw = worker();
    await sw.dispatch('push', { data: { json: () => ({ title: 'Bloom', body: 'Time for yourself', url }) } });
    expect(sw.showNotification).toHaveBeenCalledWith('Bloom', expect.objectContaining({ data: { url: url === '/?action=review' ? url : '/' } }));
  });
  it('shows a safe generic notification for malformed payloads', async () => {
    const sw = worker();
    await sw.dispatch('push', { data: { json: () => { throw new Error('Malformed JSON'); } } });
    expect(sw.showNotification).toHaveBeenCalledWith('Bloom', expect.objectContaining({ data: { url: '/' } }));
  });
  it.each([['/', 'OPEN_HOME'], ['/?action=review', 'OPEN_REVIEW']])('focuses an existing app and routes %s to %s', async (url, type) => {
    const client = { url: 'https://bloom.example/', focus: vi.fn(async () => {}), postMessage: vi.fn() };
    const sw = worker([client]);
    const close = vi.fn();
    await sw.dispatch('notificationclick', { notification: { close, data: { url } } });
    expect(close).toHaveBeenCalled(); expect(client.focus).toHaveBeenCalled();
    expect(client.postMessage).toHaveBeenCalledWith({ type });
    expect(sw.openWindow).not.toHaveBeenCalled();
  });
  it.each(['/', '/?action=review', 'https://evil.example'])('opens the correct safe route when no app window exists: %s', async url => {
    const sw = worker([{ url: 'https://other.example/' }]);
    await sw.dispatch('notificationclick', { notification: { close: vi.fn(), data: { url } } });
    expect(sw.openWindow).toHaveBeenCalledWith(url === '/?action=review' ? url : '/');
  });
});
