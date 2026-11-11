import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteApp, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { addDays, localDay } from '../../src/domain/dates';
import { configFromTemplate, createHabit, createInitialState, templates } from '../../src/domain/catalog';
import { createEntry, entryKey } from '../../src/domain/habits';
import type { Habit } from '../../src/domain/types';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('server progress reconciliation', () => {
  let reconcile: (uid: string) => Promise<void>;
  const uid = 'progress-test';
  const today = localDay(new Date(), 'Europe/Berlin');
  const yesterday = addDays(today, -1);
  const stamp = '001000000000000-00000001-test';
  const value = (item: unknown) => ({ value: item, stamp });
  beforeAll(async () => {
    process.env.GCLOUD_PROJECT = 'demo-bloom-progress';
    reconcile = (await import('./index')).reconcileUser;
  });
  beforeEach(async () => {
    const db = getFirestore();
    await db.recursiveDelete(db.doc(`users/${uid}`));
    const state = createInitialState('de', 'Europe/Berlin');
    await db.doc(`users/${uid}/profile/main`).set(value({ settings: state.settings, onboarded: true }));
  });
  afterAll(async () => { await deleteApp(getApp()); });
  function habit(negative: boolean, day = yesterday): Habit {
    return createHabit({ ...configFromTemplate(templates[0], 'de', day), kind: 'check', special: false, negative }, day, 'habit-server');
  }

  it('automatically finalizes the past negative day exactly once while today stays provisional', async () => {
    const db = getFirestore();
    await db.doc(`users/${uid}/habits/habit-server`).set(value(habit(true)));
    await reconcile(uid); await reconcile(uid);
    const awards = await db.collection(`users/${uid}/negativeAwards`).get();
    expect(awards.size).toBe(1);
    expect(awards.docs[0].id).toBe(entryKey('habit-server', yesterday));
    expect((await db.doc(`users/${uid}/xp/current`).get()).data()?.xp).toBe(10);
  });
  it('retracts a past award after failure correction and restores it without duplication', async () => {
    const db = getFirestore();
    await db.doc(`users/${uid}/habits/habit-server`).set(value(habit(true)));
    await reconcile(uid);
    const ref = db.doc(`users/${uid}/entries/${entryKey('habit-server', yesterday)}`);
    await ref.set(value(createEntry('habit-server', yesterday, 'Europe/Berlin')));
    await reconcile(uid);
    expect((await db.collection(`users/${uid}/negativeAwards`).get()).size).toBe(0);
    expect((await db.doc(`users/${uid}/xp/current`).get()).data()?.xp).toBe(0);
    await ref.set(value(null)); await reconcile(uid); await reconcile(uid);
    expect((await db.collection(`users/${uid}/negativeAwards`).get()).size).toBe(1);
    expect((await db.doc(`users/${uid}/xp/current`).get()).data()?.xp).toBe(10);
  });
  it('derives willpower bonus from completed source records and removes it when undone', async () => {
    const db = getFirestore();
    await db.doc(`users/${uid}/habits/habit-server`).set(value(habit(false, today)));
    const entry = createEntry('habit-server', today, 'Europe/Berlin');
    const ref = db.doc(`users/${uid}/entries/${entryKey('habit-server', today)}`);
    await ref.set(value({ ...entry, completed: true }));
    await db.doc(`users/${uid}/reviews/${today}`).set(value({ day: today, ratings: { 'habit-server': { happiness: 5, resistance: 5, quality: 4 } }, note: '', updatedAt: new Date().toISOString() }));
    await reconcile(uid); await reconcile(uid);
    expect((await db.doc(`users/${uid}/xp/current`).get()).data()?.xp).toBe(20);
    await ref.set(value(entry)); await reconcile(uid);
    expect((await db.doc(`users/${uid}/xp/current`).get()).data()?.xp).toBe(0);
  });
});
