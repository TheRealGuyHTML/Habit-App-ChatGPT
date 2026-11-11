import { localDay } from '../../domain/dates';
import { configForDay } from '../../domain/habits';
import type { AppState, Entry, HabitConfig } from '../../domain/types';

const boundaries = new Map<string, number>();

/** First instant after a local calendar day, including 23/25-hour DST days. */
export function endOfLocalDay(day: string, timeZone: string): number {
  const key = `${day}:${timeZone}`;
  const cached = boundaries.get(key);
  if (cached !== undefined) return cached;
  const noon = Date.parse(`${day}T12:00:00.000Z`);
  let lower = noon - 48 * 60 * 60 * 1000;
  let upper = noon + 48 * 60 * 60 * 1000;
  while (upper - lower > 1) {
    const midpoint = Math.floor((lower + upper) / 2);
    if (localDay(new Date(midpoint), timeZone) > day) upper = midpoint;
    else lower = midpoint;
  }
  boundaries.set(key, upper);
  return upper;
}

/** Timers belong to their original local day; background time never spills over. */
export function timerElapsedAt(entry: Pick<Entry, 'timerStartedAt' | 'timerElapsed' | 'day' | 'timeZone'>, now: number): number {
  const base = Math.max(0, entry.timerElapsed);
  if (entry.timerStartedAt === null) return base;
  const cutoff = Math.min(now, endOfLocalDay(entry.day, entry.timeZone));
  return base + Math.max(0, cutoff - entry.timerStartedAt);
}

export function formatTimer(milliseconds: number): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

/** Reconcile persisted running timers, including cards that are not mounted. */
export function finalizeTimerPatch(habit: HabitConfig, entry: Entry, now: number): Partial<Entry> | null {
  if (entry.timerStartedAt === null) return null;
  const stopwatch = habit.kind === 'running';
  const elapsed = timerElapsedAt(entry, now);
  const timerKind = habit.special && (stopwatch || ['meditation', 'language', 'training'].includes(habit.kind) || (habit.kind === 'reading' && habit.unit === 'minutes'));
  if (!timerKind) return { timerStartedAt: null, timerElapsed: elapsed };
  const goal = Math.max(0.01, habit.target) * 60_000;
  const finished = !stopwatch && elapsed >= goal;
  if (!finished && now < endOfLocalDay(entry.day, entry.timeZone)) return null;
  const total = finished ? goal : elapsed;
  return { timerStartedAt: null, timerElapsed: total, ...(!stopwatch ? { value: total / 60_000, completed: finished } : {}) };
}

/** Pure and idempotent startup/rollover reconciliation for unmounted cards. */
export function reconcileTimers(state: AppState, now = Date.now()): AppState {
  let entries: AppState['entries'] | undefined;
  for (const [key, entry] of Object.entries(state.entries)) {
    if (entry.timerStartedAt === null) continue;
    const habit = state.habits[entry.habitId];
    if (!habit) continue;
    const patch = finalizeTimerPatch(configForDay(habit, entry.day), entry, now);
    if (!patch) continue;
    entries ??= { ...state.entries };
    entries[key] = { ...entry, ...patch, updatedAt: new Date(now).toISOString() };
  }
  return entries ? { ...state, entries } : state;
}
