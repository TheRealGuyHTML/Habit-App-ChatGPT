import type { AppState, Settings } from '../domain/types';
import { stateSchema } from '../domain/import';
import { entryKey } from '../domain/habits';

export interface Envelope { stamp: string; value: unknown | null }
export interface Cache { version: 1; records: Record<string, Envelope>; dirty: string[] }
export const CACHE_PREFIX = 'bloom:account:v1:';
const TAB_ID = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
let sequence = 0;

/** Validate records independently so partial multi-document syncs can contain
 * entries whose habit snapshot has not arrived yet, without accepting malformed data. */
export function validateEnvelope(key: string, record: Envelope): void {
  if (!record || typeof record.stamp !== 'string' || record.stamp.length > 100 || !Object.hasOwn(record, 'value')) throw new Error(`Ungültiger Datensatz / Invalid record: ${key}`);
  const [collection, id, extra] = key.split('/');
  if (!id || extra || ['__proto__', 'prototype', 'constructor'].includes(id)) throw new Error('Ungültiger Datensatzschlüssel / Invalid record key');
  if (!['habits', 'entries', 'reviews', 'profile'].includes(collection)) throw new Error('Unbekannter Datensatztyp / Unknown record type');
  if (record.value === null && collection !== 'profile') return;
  let valid = false;
  if (collection === 'habits') {
    const result = stateSchema.shape.habits.safeParse({ [id]: record.value });
    valid = result.success && result.data[id].id === id;
  } else if (collection === 'entries') {
    const result = stateSchema.shape.entries.safeParse({ [id]: record.value });
    valid = result.success && entryKey(result.data[id].habitId, result.data[id].day) === id;
  } else if (collection === 'reviews') {
    const result = stateSchema.shape.reviews.safeParse({ [id]: record.value });
    valid = result.success && result.data[id].day === id;
  } else if (id === 'main' && record.value && typeof record.value === 'object') {
    const profile = record.value as { settings?: unknown; onboarded?: unknown };
    valid = stateSchema.shape.settings.safeParse(profile.settings).success && typeof profile.onboarded === 'boolean' && Object.keys(profile).every(item => ['settings', 'onboarded'].includes(item));
  }
  if (!valid) throw new Error(`Datensatz konnte nicht sicher geladen werden / Cannot load invalid record: ${key}`);
}

export function emptyState(): AppState {
  let timeZone = 'Europe/Berlin';
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* safe fallback */ }
  return {
    schemaVersion: 1, habits: {}, entries: {}, reviews: {}, onboarded: false,
    settings: { locale: 'de', theme: 'system', timeZone, reviewEnabled: false, reviewTime: '20:00', notificationsEnabled: false, name: '', areas: [] },
  };
}

export function nextStamp(): string {
  return `${Date.now().toString().padStart(15, '0')}-${String(++sequence).padStart(8, '0')}-${TAB_ID}`;
}

export function flattenState(state: AppState): Record<string, unknown> {
  const result: Record<string, unknown> = { 'profile/main': { settings: state.settings, onboarded: state.onboarded } };
  for (const [id, habit] of Object.entries(state.habits)) result[`habits/${id}`] = habit;
  for (const [id, entry] of Object.entries(state.entries)) result[`entries/${id}`] = entry;
  for (const [id, review] of Object.entries(state.reviews)) result[`reviews/${id}`] = review;
  return result;
}

export function inflateState(records: Cache['records']): AppState {
  const result = emptyState();
  for (const [key, envelope] of Object.entries(records)) {
    if (envelope.value === null) continue;
    const slash = key.indexOf('/');
    const collection = key.slice(0, slash);
    const id = key.slice(slash + 1);
    if (collection === 'profile' && id === 'main') {
      const profile = envelope.value as { settings: Settings; onboarded: boolean };
      result.settings = { ...result.settings, ...profile.settings };
      result.onboarded = Boolean(profile.onboarded);
    } else if (collection === 'habits') result.habits[id] = envelope.value as AppState['habits'][string];
    else if (collection === 'entries') result.entries[id] = envelope.value as AppState['entries'][string];
    else if (collection === 'reviews') result.reviews[id] = envelope.value as AppState['reviews'][string];
  }
  return result;
}

export function mergeRecords(left: Cache['records'], right: Cache['records']): Cache['records'] {
  const result = { ...left };
  for (const [key, record] of Object.entries(right)) {
    if (!result[key] || result[key].stamp < record.stamp) result[key] = record;
  }
  return result;
}

export function readCache(account: string): Cache {
  const raw = localStorage.getItem(CACHE_PREFIX + account);
  if (!raw) return { version: 1, records: {}, dirty: [] };
  const cache = JSON.parse(raw) as Cache;
  if (cache.version !== 1 || !cache.records || typeof cache.records !== 'object' || !Array.isArray(cache.dirty)) throw new Error('Der lokale Datenspeicher ist beschädigt. Bitte zuerst einen Export erstellen. / Local storage is damaged.');
  for (const [key, record] of Object.entries(cache.records)) validateEnvelope(key, record);
  if (cache.dirty.some(key => typeof key !== 'string' || !Object.hasOwn(cache.records, key))) throw new Error('Ungültige lokale Synchronisierung / Invalid local outbox');
  return cache;
}

export function writeCache(account: string, cache: Cache): void {
  localStorage.setItem(CACHE_PREFIX + account, JSON.stringify(cache));
}

export function patchCache(cache: Cache, before: AppState, after: AppState): Cache {
  if (Object.keys(after.habits).length > 300 || Object.keys(after.entries).length > 50000 || Object.keys(after.reviews).length > 10000) {
    throw new Error('Datengrenze erreicht: höchstens 300 Habits, 50.000 Einträge und 10.000 Reviews. / Data limit reached: 300 habits, 50,000 entries and 10,000 reviews.');
  }
  const a = flattenState(before);
  const b = flattenState(after);
  const records = { ...cache.records };
  const dirty = new Set(cache.dirty);
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[key]) === JSON.stringify(b[key])) continue;
    const record = { stamp: nextStamp(), value: b[key] ?? null };
    // Validate every mutation before returning the new cache. The caller writes
    // once only after this entire function succeeds, keeping mixed-validity
    // updates atomic and preventing a bad UI value from poisoning the next load.
    validateEnvelope(key, record);
    records[key] = record;
    dirty.add(key);
  }
  return { version: 1, records, dirty: [...dirty] };
}
