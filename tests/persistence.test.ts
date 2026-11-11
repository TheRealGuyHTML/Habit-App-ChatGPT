import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyState, flattenState, inflateState, mergeRecords, patchCache, readCache, validateEnvelope, writeCache } from '../src/services/persistence';
import type { Cache } from '../src/services/persistence';
import { configFromTemplate, createHabit, templates } from '../src/domain/catalog';
import { createEntry, entryKey } from '../src/domain/habits';

describe('durable account-scoped record synchronization', () => {
  beforeEach(() => {
    const disk = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => disk.get(key) ?? null, setItem: (key: string, value: string) => disk.set(key, value) });
  });
  it('restores local settings and onboarding across reloads', () => {
    const before = emptyState();
    const after = { ...before, onboarded: true, settings: { ...before.settings, name: 'Alex' } };
    const cache = patchCache({ version: 1, records: {}, dirty: [] }, before, after);
    writeCache('local', cache);
    expect(inflateState(readCache('local').records)).toEqual(after);
    expect(readCache('uid:other').records).toEqual({});
    expect(cache.dirty).toEqual(['profile/main']);
  });
  it('merges concurrent edits of different documents without losing either', () => {
    const left = { 'habits/a': { stamp: '100-a', value: { id: 'a' } } };
    const right = { 'entries/b_2026-11-11': { stamp: '100-b', value: { habitId: 'b' } } };
    expect(Object.keys(mergeRecords(left, right))).toHaveLength(2);
    expect(mergeRecords(left, right)).toEqual(mergeRecords(right, left));
  });
  it('resolves same-record conflicts by deterministic stamp and preserves tombstones', () => {
    const old = { 'habits/a': { stamp: '100-a', value: { id: 'a' } } };
    const deleted = { 'habits/a': { stamp: '200-b', value: null } };
    expect(mergeRecords(old, deleted)).toEqual(deleted);
    expect(mergeRecords(deleted, old)).toEqual(deleted);
    expect(inflateState(deleted).habits).toEqual({});
  });
  it('does not enqueue a no-op update or increment a balance', () => {
    const state = emptyState();
    const cache: Cache = { version: 1, records: {}, dirty: [] };
    expect(patchCache(cache, state, structuredClone(state))).toEqual(cache);
    expect(flattenState(state)).toHaveProperty('profile/main');
  });
  it('surfaces quota failures rather than reporting persistence success', () => {
    vi.stubGlobal('localStorage', { setItem: () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); } });
    expect(() => writeCache('local', { version: 1, records: {}, dirty: [] })).toThrow('Quota exceeded');
  });
  it('rejects malformed cloud records and invalid timezone before rendering', () => {
    expect(() => validateEnvelope('habits/bad', { stamp: '100', value: { revisions: [null] } })).toThrow('Cannot load invalid record');
    const state = emptyState();
    expect(() => validateEnvelope('profile/main', { stamp: '100', value: { settings: { ...state.settings, timeZone: 'Mars/Olympus' }, onboarded: true } })).toThrow('Cannot load invalid record');
    expect(() => validateEnvelope('habits/__proto__', { stamp: '100', value: null })).toThrow('Invalid record key');
  });
  it.each(['too-many-subtasks', 'too-long-subtask'])('rejects %s atomically before disk write and preserves the last valid cache', kind => {
    const before = emptyState();
    const good = { ...before, onboarded: true };
    const previous = patchCache({ version: 1, records: {}, dirty: [] }, before, good);
    writeCache('local', previous);
    const diskBefore = JSON.stringify(readCache('local'));
    const valid = createHabit(configFromTemplate(templates[0], 'de', '2026-11-11'), '2026-11-11', 'valid-first');
    const bad = createHabit({ ...configFromTemplate(templates[3], 'de', '2026-11-11'), special: true, subtasks: kind === 'too-many-subtasks' ? Array.from({ length: 51 }, (_, i) => `Item ${i}`) : ['a'.repeat(141)] }, '2026-11-11', 'invalid-second');
    expect(() => {
      const next = patchCache(previous, good, { ...good, habits: { [valid.id]: valid, [bad.id]: bad } });
      writeCache('local', next);
    }).toThrow('Cannot load invalid record: habits/invalid-second');
    expect(JSON.stringify(readCache('local'))).toBe(diskBefore);
    expect(previous.records).not.toHaveProperty('habits/valid-first');
  });
  it('rejects invalid timer values before persist while preserving existing data', () => {
    const state = emptyState();
    const entry = { ...createEntry('timer', '2026-11-11', 'Europe/Berlin'), timerElapsed: -1 };
    expect(() => patchCache({ version: 1, records: {}, dirty: [] }, state, { ...state, entries: { [entryKey('timer', entry.day)]: entry } })).toThrow('Cannot load invalid record');
  });
  it('rejects collection limits before producing any dirty records', () => {
    const state = emptyState();
    const habits = Object.fromEntries(Array.from({ length: 301 }, (_, i) => {
      const habit = createHabit(configFromTemplate(templates[0], 'de', '2026-11-11'), '2026-11-11', `habit-${i}`);
      return [habit.id, habit];
    }));
    expect(() => patchCache({ version: 1, records: {}, dirty: [] }, state, { ...state, habits })).toThrow('Data limit reached');
  });
});
