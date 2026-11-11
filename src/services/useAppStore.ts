import { useCallback, useEffect, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import type { AppState } from '../domain/types';
import { auth, db, firebaseConfigured, googleProvider } from './firebase';
import { CACHE_PREFIX, emptyState, inflateState, mergeRecords, nextStamp, patchCache, readCache, validateEnvelope, writeCache, type Cache, type Envelope } from './persistence';
import { disablePush } from './notifications';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error';
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const FIRST_ACCOUNT_OFFLINE = 'Dieses Konto muss einmal online geladen werden. Verbinde dich erneut oder melde dich ab, um lokale Daten zu nutzen. / Connect once to load this account, or sign out to use local data.';

export function useAppStore() {
  const [state, setState] = useState<AppState>(emptyState);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SyncStatus>('local');
  const [error, setError] = useState<string | null>(null);
  const current = useRef({ state, cache: { version: 1, records: {}, dirty: [] } as Cache, account: 'local', user: null as User | null, knownAccount: false });
  const listeners = useRef<Unsubscribe[]>([]);
  const saving = useRef(new Set<string>());

  const flush: () => void = useCallback(() => {
    const client = db;
    const active = current.current;
    if (!client || !active.user) { setStatus(navigator.onLine ? 'local' : 'offline'); return; }
    if (!navigator.onLine) { setStatus('offline'); return; }
    const account = active.account;
    const uid = active.user.uid;
    for (const key of active.cache.dirty) {
      const marker = `${uid}/${key}`;
      if (saving.current.has(marker)) continue;
      const envelope = active.cache.records[key];
      if (!envelope) continue;
      saving.current.add(marker);
      setStatus('syncing');
      void setDoc(doc(client, `users/${uid}/${key}`), envelope).then(() => {
        if (current.current.account !== account) return;
        const now = current.current;
        if (now.cache.records[key]?.stamp === envelope.stamp) {
          now.cache.dirty = now.cache.dirty.filter(item => item !== key);
          writeCache(account, now.cache);
        }
        setStatus(now.cache.dirty.length ? 'syncing' : 'synced');
      }).catch((failure: unknown) => {
        if (current.current.account === account) { setError(message(failure)); setStatus('error'); }
      }).finally(() => {
        saving.current.delete(marker);
        // A second local edit may have arrived while the first write was pending.
        if (current.current.account === account && current.current.cache.records[key]?.stamp !== envelope.stamp) flush();
      });
    }
    if (!active.cache.dirty.length) setStatus('synced');
  }, []);

  const applyCache = useCallback((cache: Cache, persist = true) => {
    const active = current.current;
    if (persist) writeCache(active.account, cache);
    active.cache = cache;
    active.state = inflateState(cache.records);
    setState(active.state);
  }, []);

  useEffect(() => {
    let alive = true;
    const switchAccount = (nextUser: User | null) => {
      if (!alive) return;
      listeners.current.forEach(stop => stop());
      listeners.current = [];
      const account = nextUser ? `uid:${nextUser.uid}` : 'local';
      setReady(false);
      setError(null);
      current.current.account = account;
      current.current.user = nextUser;
      setUser(nextUser);
      try { applyCache(readCache(account), false); }
      catch (failure) { current.current.state = emptyState(); current.current.cache = { version: 1, records: {}, dirty: [] }; setState(emptyState()); setError(message(failure)); setStatus('error'); }
      if (!nextUser || !db) { setReady(true); setStatus(navigator.onLine ? 'local' : 'offline'); return; }
      // A new account must receive its profile before showing onboarding. Cached
      // accounts remain immediately usable offline while the network reconciles.
      current.current.knownAccount = Boolean(current.current.cache.records['profile/main']);
      setReady(current.current.knownAccount);
      if (!navigator.onLine && !current.current.knownAccount) { setStatus('offline'); setError(FIRST_ACCOUNT_OFFLINE); }
      const client = db;
      const initial = new Set(['habits', 'entries', 'reviews', 'profile']);
      for (const path of ['habits', 'entries', 'reviews', 'profile']) {
        listeners.current.push(onSnapshot(collection(client, `users/${nextUser.uid}/${path}`), { includeMetadataChanges: true }, snapshot => {
          if (current.current.account !== account) return;
          try {
            const active = current.current;
            const incoming: Record<string, Envelope> = {};
            const dirty = new Set(active.cache.dirty);
            for (const item of snapshot.docs) {
              const key = `${path}/${item.id}`;
              const record = item.data() as Envelope;
              validateEnvelope(key, record);
              incoming[key] = record;
              if (active.cache.records[key]?.stamp > record.stamp) dirty.add(key);
              else if (!snapshot.metadata.hasPendingWrites && active.cache.records[key]?.stamp === record.stamp) dirty.delete(key);
            }
            // Locally persisted outbox survives a page reload and is reconciled by record.
            applyCache({ version: 1, records: mergeRecords(active.cache.records, incoming), dirty: [...dirty] });
            if (!snapshot.metadata.fromCache) initial.delete(path);
            if (!initial.size) {
              current.current.knownAccount = true;
              setReady(true);
              setError(previous => previous === FIRST_ACCOUNT_OFFLINE ? null : previous);
            }
            if (!snapshot.metadata.fromCache) flush();
          } catch (failure) { setError(message(failure)); setStatus('error'); setReady(current.current.knownAccount); }
        }, failure => { setError(message(failure)); setStatus('error'); setReady(current.current.knownAccount); }));
      }
      flush();
    };
    if (!auth) switchAccount(null);
    const stopAuth = auth ? onAuthStateChanged(auth, switchAccount, failure => { setError(message(failure)); setReady(true); }) : () => {};
    const network = () => {
      if (navigator.onLine) flush();
      else {
        setStatus('offline');
        if (current.current.user && !current.current.knownAccount) { setError(FIRST_ACCOUNT_OFFLINE); setReady(false); }
      }
    };
    const crossTab = (event: StorageEvent) => {
      if (event.key !== CACHE_PREFIX + current.current.account || !event.newValue) return;
      try {
        const incoming = readCache(current.current.account);
        applyCache({ version: 1, records: mergeRecords(current.current.cache.records, incoming.records), dirty: [...new Set([...current.current.cache.dirty, ...incoming.dirty])] }, false);
        flush();
      } catch (failure) { setError(message(failure)); setStatus('error'); }
    };
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    window.addEventListener('storage', crossTab);
    return () => { alive = false; stopAuth(); listeners.current.forEach(stop => stop()); window.removeEventListener('online', network); window.removeEventListener('offline', network); window.removeEventListener('storage', crossTab); };
  }, [applyCache, flush]);

  const update = useCallback((updater: (previous: AppState) => AppState) => {
    try {
      const active = current.current;
      const disk = readCache(active.account);
      const merged = { version: 1 as const, records: mergeRecords(active.cache.records, disk.records), dirty: [...new Set([...active.cache.dirty, ...disk.dirty])] };
      const before = inflateState(merged.records);
      const after = updater(before);
      applyCache(patchCache(merged, before, after));
      setError(null);
      flush();
      return true;
    } catch (failure) { setError(message(failure)); setStatus('error'); return false; }
  }, [applyCache, flush]);

  const requireAuth = () => { if (!auth) throw new Error('Firebase ist noch nicht konfiguriert. / Firebase is not configured.'); return auth; };
  return {
    state, update, replaceState: (next: AppState) => update(() => next), user, ready, status, error,
    clearError: () => setError(null), firebaseConfigured,
    signIn: (email: string, password: string) => signInWithEmailAndPassword(requireAuth(), email.trim(), password),
    signUp: (email: string, password: string) => createUserWithEmailAndPassword(requireAuth(), email.trim(), password),
    signInGoogle: () => signInWithPopup(requireAuth(), googleProvider),
    signOut: async () => { await disablePush(); await firebaseSignOut(requireAuth()); },
    resetPassword: (email: string) => sendPasswordResetEmail(requireAuth(), email.trim()),
    importLocalToAccount: async () => {
      if (!current.current.user) throw new Error('Bitte zuerst anmelden. / Sign in first.');
      const local = readCache('local');
      const active = current.current;
      const records = { ...active.cache.records };
      const dirty = new Set(active.cache.dirty);
      for (const [key, envelope] of Object.entries(local.records)) { records[key] = { ...envelope, stamp: nextStamp() }; dirty.add(key); }
      applyCache({ version: 1, records, dirty: [...dirty] });
      flush();
    },
    retrySync: flush,
  };
}
