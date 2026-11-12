import { createHash } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import webpush from 'web-push';
import { calculateGamification, XP_POLICY_VERSION } from '../../src/domain/gamification';
import { configForDay, isScheduled } from '../../src/domain/habits';
import { addDays, localDay } from '../../src/domain/dates';
import { parseImport } from '../../src/domain/import';
import type { AppState } from '../../src/domain/types';
import { isAllowedPushEndpoint, reminderOccurrence, subscriptionSchema } from './push';

initializeApp();
const db = getFirestore();
const region = 'europe-west1';
const vapidPrivate = defineSecret('VAPID_PRIVATE_KEY');
const vapidSubject = defineSecret('VAPID_SUBJECT');
const vapidPublic = defineString('VAPID_PUBLIC_KEY');
interface Envelope { value: unknown; stamp: string }

/** Shared pure business rules also run on the server: no client-provided XP is trusted. */
async function loadState(transaction: Transaction, uid: string): Promise<AppState | null> {
  const root = db.collection('users').doc(uid);
  const [profile, habits, entries, reviews] = await Promise.all([
    transaction.get(root.collection('profile').doc('main')),
    transaction.get(root.collection('habits')), transaction.get(root.collection('entries')), transaction.get(root.collection('reviews')),
  ]);
  const p = (profile.data() as Envelope | undefined)?.value as { settings: AppState['settings']; onboarded: boolean } | undefined;
  if (!p) return null;
  const records = (snapshot: typeof habits) => Object.fromEntries(snapshot.docs.map(item => [item.id, (item.data() as Envelope).value]).filter(([, value]) => value !== null));
  // Security Rules constrain the envelope. Full nested schema validation protects jobs
  // from malformed legacy clients and incomplete multi-document imports.
  return parseImport({ schemaVersion: 1, habits: records(habits), entries: records(entries), reviews: records(reviews), settings: p.settings, onboarded: p.onboarded });
}

export async function reconcileUser(uid: string): Promise<void> {
  await db.runTransaction(async transaction => {
    const state = await loadState(transaction, uid);
    if (!state) return;
    const today = localDay(new Date(), state.settings.timeZone);
    const game = calculateGamification(state, today);
    const awardsRef = db.collection('users').doc(uid).collection('negativeAwards');
    const existing = await transaction.get(awardsRef);
    const awards = new Map(game.ledger.filter(award => configForDay(state.habits[award.habitId], award.day).negative).map(award => [award.id.replace('completion:', ''), award]));
    const desired = new Map(awards);
    // Award identity is habitId + local day. Reruns upsert the same document;
    // retrospective corrections also retract or recompute its amount.
    let writes = 0;
    for (const prior of existing.docs) {
      const next = awards.get(prior.id);
      if (!next) { if (writes++ < 400) transaction.delete(prior.ref); }
      else {
        if (JSON.stringify(prior.data().award) !== JSON.stringify(next) && writes++ < 400) transaction.set(prior.ref, { award: next, evaluatedDay: today });
        desired.delete(prior.id);
      }
    }
    for (const [id, award] of desired) {
      if (writes++ >= 400) break;
      transaction.set(awardsRef.doc(id), { award, evaluatedDay: today });
    }
    transaction.set(db.doc(`users/${uid}/xp/current`), {
      policyVersion: XP_POLICY_VERSION, xp: game.xp, level: game.level, multiplier: game.multiplier,
      bestStreak: game.bestStreak, computedForDay: today, computedAt: Timestamp.now(),
      negativeAuditCatchupPending: writes > 400, reconciliationPending: false,
    });
  });
}

export const reconcileProgress = onDocumentWritten({ document: 'users/{uid}/{kind}/{id}', region, maxInstances: 10 }, async event => {
  if (!['habits', 'entries', 'reviews', 'profile'].includes(event.params.kind)) return;
  try { await reconcileUser(event.params.uid); }
  catch (error) {
    await db.doc(`users/${event.params.uid}/xp/current`).set({ reconciliationPending: true }, { merge: true });
    logger.warn('Progress reconciliation deferred; scheduled job retries after source sync.', { uid: event.params.uid, error: String(error) });
  }
});

/** Walk every profile with a cursor; never repeatedly limit work to the first users. */
async function eachProfile(action: (uid: string, profile: { settings: AppState['settings'] }) => Promise<void>): Promise<void> {
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let query = db.collectionGroup('profile').orderBy('__name__').limit(100);
    if (cursor) query = query.startAfter(cursor);
    const batch = await query.get();
    if (batch.empty) return;
    for (const profile of batch.docs) {
      if (profile.id !== 'main') continue;
      const uid = profile.ref.parent.parent?.id;
      const value = profile.data().value as { settings: AppState['settings'] } | undefined;
      if (uid && value?.settings) await action(uid, value);
    }
    cursor = batch.docs.at(-1);
    if (batch.size < 100) return;
  }
}

export const finalizeLocalDays = onSchedule({ schedule: 'every 5 minutes', timeZone: 'UTC', region, timeoutSeconds: 540, maxInstances: 1 }, async () => {
  await eachProfile(async (uid, profile) => {
    try {
      const today = localDay(new Date(), profile.settings.timeZone);
      const previous = (await db.doc(`users/${uid}/xp/current`).get()).data();
      if (previous?.policyVersion === XP_POLICY_VERSION && previous.computedForDay === today && !previous.negativeAuditCatchupPending && !previous.reconciliationPending) return;
      await reconcileUser(uid);
    }
    catch (error) { logger.error('Daily reconciliation failed', { uid, error: String(error) }); }
  });
});

async function claimReceipt(ref: DocumentReference, now: number): Promise<boolean> {
  return db.runTransaction(async transaction => {
    const receipt = await transaction.get(ref);
    const previous = receipt.data();
    if (previous?.sent || (previous?.leaseUntil?.toMillis() ?? 0) > now || (previous?.attempts ?? 0) >= 3) return false;
    transaction.set(ref, { sent: false, attempts: (previous?.attempts ?? 0) + 1, leaseUntil: Timestamp.fromMillis(now + 60000), expiresAt: Timestamp.fromMillis(now + 7 * 86400000) });
    return true;
  });
}

/** Standard RFC 8030 / VAPID Web Push works with installed iOS PWAs and APNs. */
export const sendHabitReminders = onSchedule({ schedule: 'every 1 minutes', timeZone: 'UTC', region, timeoutSeconds: 540, maxInstances: 1, secrets: [vapidPrivate, vapidSubject] }, async () => {
  webpush.setVapidDetails(vapidSubject.value(), vapidPublic.value(), vapidPrivate.value());
  const now = new Date();
  await eachProfile(async (uid, profile) => {
    try {
      const settings = profile.settings;
      if (!settings.notificationsEnabled) return;
      const today = localDay(now, settings.timeZone);
      const de = settings.locale === 'de';
      const reminders: { id: string; day: string; title: string; body: string; url: '/' | '/?action=review' }[] = [];
      const [habits, subscriptions] = await Promise.all([
        db.collection(`users/${uid}/habits`).get(), db.collection(`users/${uid}/pushSubscriptions`).get(),
      ]);
      for (const record of habits.docs) {
        const habit = record.data().value as AppState['habits'][string] | null;
        if (!habit) continue;
        for (const candidate of [today, addDays(today, -1)]) {
          const config = configForDay(habit, candidate);
          if (isScheduled(habit, candidate) && config.reminder && reminderOccurrence(now, settings.timeZone, config.reminder) === candidate) {
            reminders.push({ id: `habit:${habit.id}:${config.reminder}`, day: candidate, title: `${config.emoji} ${config.name}`, body: de ? 'Ein kleiner Schritt für dein größeres Ich.' : 'One small step for your future self.', url: '/' });
          }
        }
      }
      const reviewDay = settings.reviewEnabled ? reminderOccurrence(now, settings.timeZone, settings.reviewTime) : undefined;
      if (reviewDay && !(await db.doc(`users/${uid}/reviews/${reviewDay}`).get()).data()?.value) reminders.push({ id: `review:${settings.reviewTime}`, day: reviewDay, title: de ? 'Bloom · Dein Tagesrückblick' : 'Bloom · Your daily review', body: de ? 'Wie war dein Tag? Nimm dir einen Moment für dich.' : 'How was your day? Take a moment for yourself.', url: '/?action=review' });
      for (const subscriptionDoc of subscriptions.docs) {
        const result = subscriptionSchema.safeParse(subscriptionDoc.data());
        if (!result.success || !isAllowedPushEndpoint(result.data.endpoint)) continue;
        for (const reminder of reminders) {
          const id = createHash('sha256').update(`${reminder.day}|${reminder.id}|${subscriptionDoc.id}`).digest('hex');
          const receipt = db.doc(`users/${uid}/notificationReceipts/${id}`);
          if (!await claimReceipt(receipt, now.getTime())) continue;
          try {
            await webpush.sendNotification(result.data, JSON.stringify({ ...reminder, tag: id }), { TTL: 300, timeout: 10000 });
            await receipt.set({ sent: true, sentAt: Timestamp.now() }, { merge: true });
          } catch (failure) {
            const code = (failure as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) { await subscriptionDoc.ref.delete(); await receipt.set({ sent: true, expired: true }, { merge: true }); }
            else logger.warn('Push delivery failed; bounded retry may follow', { uid, statusCode: code });
          }
        }
      }
    } catch (failure) { logger.error('Reminder evaluation failed', { uid, error: String(failure) }); }
  });
});
