import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { configFromTemplate, createHabit, createInitialState, templates } from '../../src/domain/catalog';
import { createEntry } from '../../src/domain/habits';

const stamp = '001000000000000-00000001-test';
const envelope = (value: unknown) => ({ stamp, value });
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
describe.skipIf(!enabled)('Firestore account isolation and validation', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-bloom-rules', firestore: { rules: readFileSync(resolve(process.cwd(), '../firestore.rules'), 'utf8') } }); });
  beforeEach(async () => { await env.clearFirestore(); });
  afterAll(async () => { await env.cleanup(); });
  const fixture = () => createHabit(configFromTemplate(templates[0], 'de', '2026-11-11'), '2026-11-11', 'habit-test');

  it('allows owner writes and reads, denying other accounts and anonymous users', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'users/alice/habits/habit-test'), envelope(fixture())));
    await assertSucceeds(getDoc(doc(alice, 'users/alice/habits/habit-test')));
    await assertFails(getDoc(doc(env.authenticatedContext('bob').firestore(), 'users/alice/habits/habit-test')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/alice/habits/habit-test')));
    await assertFails(setDoc(doc(env.authenticatedContext('bob').firestore(), 'users/alice/habits/other'), envelope(fixture())));
  });
  it('rejects client-written XP and administrative receipts', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    for (const path of ['xp/current', 'negativeAwards/habit-test_2026-11-11', 'notificationReceipts/forged']) await assertFails(setDoc(doc(alice, `users/alice/${path}`), { xp: 999999 }));
  });
  it('validates profile enum fields and rejects hidden privileged fields', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    const state = createInitialState('de', 'Europe/Berlin');
    const profile = { settings: state.settings, onboarded: true };
    await assertSucceeds(setDoc(doc(alice, 'users/alice/profile/main'), envelope(profile)));
    await assertFails(setDoc(doc(alice, 'users/alice/profile/main'), envelope({ ...profile, xp: 900 })));
    await assertFails(setDoc(doc(alice, 'users/alice/profile/main'), envelope({ ...profile, settings: { ...state.settings, locale: 'fr' } })));
  });
  it('prevents identifier mismatch and immutable creation rewrites', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    const habit = fixture();
    await assertFails(setDoc(doc(alice, 'users/alice/habits/wrong-id'), envelope(habit)));
    await assertSucceeds(setDoc(doc(alice, 'users/alice/habits/habit-test'), envelope(habit)));
    await assertFails(setDoc(doc(alice, 'users/alice/habits/habit-test'), { stamp: stamp + 'z', value: { ...habit, createdDay: '2026-01-01' } }));
  });
  it('requires entry day and habit to match the document key', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    const entry = createEntry('habit-test', '2026-11-11', 'Europe/Berlin');
    await assertSucceeds(setDoc(doc(alice, 'users/alice/entries/habit-test_2026-11-11'), envelope(entry)));
    await assertFails(setDoc(doc(alice, 'users/alice/entries/habit-test_2026-11-12'), envelope(entry)));
    await assertFails(setDoc(doc(alice, 'users/alice/entries/habit-test_2026-11-11'), { stamp: stamp + 'z', value: { ...entry, xp: 9999 } }));
  });
  it('keeps tombstones and denies stale or hard-deleted records', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    const ref = doc(alice, 'users/alice/habits/habit-test');
    await assertSucceeds(setDoc(ref, envelope(fixture())));
    await assertFails(setDoc(ref, { stamp: '000', value: fixture() }));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(setDoc(ref, { stamp: stamp + 'z', value: null }));
    expect((await getDoc(ref)).data()?.value).toBe(null);
  });
  it('rejects arbitrary push request targets and permits known push providers', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    const ref = doc(alice, `users/alice/pushSubscriptions/${'a'.repeat(64)}`);
    const subscription = { endpoint: 'https://web.push.apple.com/token', keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) }, updatedAt: '2026-11-11T12:00:00.000Z' };
    await assertSucceeds(setDoc(ref, subscription));
    await assertFails(setDoc(ref, { ...subscription, endpoint: 'https://169.254.169.254/metadata' }));
    await assertFails(setDoc(ref, { ...subscription, endpoint: 'https://web.push.apple.com.evil.test/token' }));
  });
});
