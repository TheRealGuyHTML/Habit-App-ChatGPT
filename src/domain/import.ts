import { z } from 'zod';
import { daysBetween, localDay, validDay } from './dates';
import { entryKey } from './habits';
import type { AppState } from './types';

const safeKey = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/).refine(key => !['__proto__', 'prototype', 'constructor'].includes(key), 'Unsafe record key');
// A generous supported lifespan bounds imported calendar work without truncating history.
const day = z.string().refine(value => validDay(value) && value >= '1900-01-01' && value <= '2200-12-31', 'Invalid date (supported: 1900–2200)');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const timeZone = z.string().max(100).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Invalid time zone');
const timestamp = z.string().datetime();
const schedule = z.discriminatedUnion('type', [
  z.object({ type: z.literal('daily') }).strict(),
  z.object({ type: z.literal('once'), date: day }).strict(),
  z.object({ type: z.literal('weekdays'), days: z.array(z.number().int().min(0).max(6)).min(1).max(7).refine(days => new Set(days).size === days.length) }).strict(),
  z.object({ type: z.literal('interval'), every: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(7), z.literal(30)]), anchor: day }).strict(),
]);
export const habitConfigSchema = z.object({
  custom: z.boolean().optional(),
  name: z.string().trim().min(1).max(140), emoji: z.string().min(1).max(64),
  kind: z.enum(['check', 'water', 'sleep', 'steps', 'checklist', 'produce', 'reading', 'screen', 'language', 'meditation', 'journal', 'running', 'training']),
  area: z.enum(['health', 'movement', 'mind', 'growth', 'social']), negative: z.boolean(),
  difficulty: z.enum(['easy', 'medium', 'complex']), schedule, special: z.boolean(),
  target: z.number().finite().positive().max(1000000),
  unit: z.enum(['ml', 'hours', 'steps', 'portions', 'minutes', 'pages', 'km']),
  subtasks: z.array(z.string().trim().min(1).max(140)).max(50).refine(tasks => new Set(tasks).size === tasks.length),
  reminder: z.union([z.literal(''), time]), color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
});
function validConfig(value: z.infer<typeof habitConfigSchema>): boolean {
  if (!value.special) return true;
  if (value.negative && !['check', 'screen'].includes(value.kind)) return false;
  if (value.kind === 'checklist' && value.subtasks.length === 0) return false;
  const units: Record<string, string[]> = {
    water: ['ml'], sleep: ['hours'], steps: ['steps'], checklist: ['portions'], produce: ['portions'],
    reading: ['minutes', 'pages'], screen: ['minutes', 'hours'], language: ['minutes'], meditation: ['minutes'], journal: ['minutes'], running: ['km'], training: ['minutes'],
  };
  return !units[value.kind] || units[value.kind].includes(value.unit);
}
const config = habitConfigSchema.strict().refine(validConfig, 'Incompatible special tracker configuration');
const habitSchema = habitConfigSchema.extend({
  id: safeKey, createdDay: day, createdAt: timestamp, updatedAt: timestamp,
  revisions: z.array(z.object({ effectiveFrom: day, config }).strict()).min(1).max(1000),
  pauses: z.array(z.object({ from: day, to: day.optional() }).strict()).max(1000), deletedFrom: day.optional(),
}).strict().superRefine((habit, ctx) => {
  if (!validConfig(habit)) ctx.addIssue({ code: 'custom', message: 'Incompatible special tracker configuration' });
  if (habit.revisions[0]?.effectiveFrom !== habit.createdDay) ctx.addIssue({ code: 'custom', message: 'Missing creation revision' });
  if (new Set(habit.revisions.map(revision => revision.effectiveFrom)).size !== habit.revisions.length) ctx.addIssue({ code: 'custom', message: 'Duplicate revision day' });
  if (habit.revisions.some(revision => revision.effectiveFrom < habit.createdDay)) ctx.addIssue({ code: 'custom', message: 'Revision predates creation' });
  if (habit.revisions.some((revision, index) => index > 0 && revision.effectiveFrom <= habit.revisions[index - 1].effectiveFrom)) ctx.addIssue({ code: 'custom', message: 'Unsorted revisions' });
  const latest = habit.revisions.at(-1)?.config;
  if (latest && Object.keys(habitConfigSchema.shape).some(key => JSON.stringify(habit[key as keyof typeof latest]) !== JSON.stringify(latest[key as keyof typeof latest]))) ctx.addIssue({ code: 'custom', message: 'Current configuration differs from latest revision' });
  if (habit.pauses.some(pause => pause.from < habit.createdDay || (pause.to && pause.to <= pause.from))) ctx.addIssue({ code: 'custom', message: 'Invalid pause interval' });
  const orderedPauses = [...habit.pauses].sort((a, b) => a.from.localeCompare(b.from));
  if (orderedPauses.some((pause, index) => index > 0 && (!orderedPauses[index - 1].to || pause.from < orderedPauses[index - 1].to!))) ctx.addIssue({ code: 'custom', message: 'Overlapping pause intervals' });
  if (habit.deletedFrom && habit.deletedFrom < habit.createdDay) ctx.addIssue({ code: 'custom', message: 'Deletion predates creation' });
});
const entrySchema = z.object({
  habitId: safeKey, day, completed: z.boolean(), value: z.number().finite().min(0).max(10000000),
  checked: z.array(z.string().max(140)).max(50), note: z.string().max(10000), mood: z.string().max(64),
  timerStartedAt: z.number().finite().min(0).max(9000000000000).nullable(), timerElapsed: z.number().finite().min(0).max(31536000000),
  updatedAt: timestamp, timeZone,
}).strict();
const rating = z.object({ happiness: z.number().int().min(1).max(5), resistance: z.number().int().min(1).max(5), quality: z.number().int().min(1).max(5) }).strict();
const reviewSchema = z.object({ day, ratings: z.record(safeKey, rating), note: z.string().max(10000), updatedAt: timestamp }).strict();
export const stateSchema = z.object({
  schemaVersion: z.literal(1), habits: z.record(safeKey, habitSchema).refine(items => Object.keys(items).length <= 300, 'Too many habits'),
  entries: z.record(z.string().max(160), entrySchema).refine(items => Object.keys(items).length <= 50000, 'Too many entries'),
  reviews: z.record(day, reviewSchema).refine(items => Object.keys(items).length <= 10000, 'Too many reviews'),
  settings: z.object({ locale: z.enum(['de', 'en']), theme: z.enum(['system', 'light', 'dark']), timeZone,
    reviewEnabled: z.boolean(), reviewTime: time, notificationsEnabled: z.boolean(), name: z.string().max(140),
    areas: z.array(z.enum(['health', 'movement', 'mind', 'growth', 'social'])).max(5),
  }).strict(), onboarded: z.boolean(),
}).strict().superRefine((state, ctx) => {
  const today = localDay(new Date(), state.settings.timeZone);
  const historyWork = Object.values(state.habits).reduce((sum, habit) => sum + Math.max(0, daysBetween(habit.createdDay, today) + 1) * (1 + habit.revisions.length + habit.pauses.length), 0);
  if (historyWork > 1000000) ctx.addIssue({ code: 'custom', message: 'Import exceeds the supported history evaluation budget (1,000,000 day/version operations)' });
  for (const [key, habit] of Object.entries(state.habits)) {
    if (key !== habit.id) ctx.addIssue({ code: 'custom', message: 'Habit key mismatch', path: ['habits', key] });
  }
  for (const [key, entry] of Object.entries(state.entries)) {
    if (!Object.hasOwn(state.habits, entry.habitId) || key !== entryKey(entry.habitId, entry.day)) ctx.addIssue({ code: 'custom', message: 'Orphan or mismatched entry', path: ['entries', key] });
    else if (entry.day < state.habits[entry.habitId].createdDay) ctx.addIssue({ code: 'custom', message: 'Entry predates creation', path: ['entries', key] });
  }
  for (const [key, review] of Object.entries(state.reviews)) {
    if (key !== review.day || Object.keys(review.ratings).some(id => !Object.hasOwn(state.habits, id))) ctx.addIssue({ code: 'custom', message: 'Orphan or mismatched review', path: ['reviews', key] });
  }
});

function rejectUnsafeKeys(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe record key');
    rejectUnsafeKeys((value as Record<string, unknown>)[key]);
  }
}

export function parseImport(raw: string | unknown): AppState {
  if (typeof raw === 'string' && raw.length > 10 * 1024 * 1024) throw new Error('Import is larger than 10 MB');
  const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
  rejectUnsafeKeys(value);
  return stateSchema.parse(value);
}
