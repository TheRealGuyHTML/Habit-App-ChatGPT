import { describe, expect, it } from 'vitest';
import { endOfLocalDay, finalizeTimerPatch, formatTimer, reconcileTimers, timerElapsedAt } from '../src/components/trackers/timer';
import type { Entry, HabitConfig } from '../src/domain/types';
import { configFromTemplate, createHabit, createInitialState, templates } from '../src/domain/catalog';
import { createEntry, entryKey, updateHabit } from '../src/domain/habits';

describe('persistent habit timers', () => {
  it('uses elapsed wall time after a suspended tab without accumulating interval ticks', () => {
    const start = Date.parse('2026-11-11T09:00:00Z');
    expect(timerElapsedAt({ day: '2026-11-11', timeZone: 'Europe/Berlin', timerStartedAt: start, timerElapsed: 120_000 }, start + 180_000)).toBe(300_000);
  });

  it('does not accrue time on the following local calendar day', () => {
    const start = Date.parse('2026-11-11T22:59:00Z');
    expect(timerElapsedAt({ day: '2026-11-11', timeZone: 'Europe/Berlin', timerStartedAt: start, timerElapsed: 0 }, Date.parse('2026-11-12T01:00:00Z'))).toBe(60_000);
  });

  it('finds local midnight through both DST transitions', () => {
    expect(new Date(endOfLocalDay('2026-03-29', 'Europe/Berlin')).toISOString()).toBe('2026-03-29T22:00:00.000Z');
    expect(new Date(endOfLocalDay('2026-10-25', 'Europe/Berlin')).toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });

  it('handles offset time zones on either side of UTC', () => {
    expect(new Date(endOfLocalDay('2026-11-11', 'Pacific/Kiritimati')).toISOString()).toBe('2026-11-11T10:00:00.000Z');
    expect(new Date(endOfLocalDay('2026-11-11', 'America/Los_Angeles')).toISOString()).toBe('2026-11-12T08:00:00.000Z');
  });

  it('preserves paused time and clamps backwards wall-clock changes', () => {
    const base = { day: '2026-11-11', timeZone: 'UTC', timerStartedAt: null, timerElapsed: 42_000 };
    expect(timerElapsedAt(base, 0)).toBe(42_000);
    expect(timerElapsedAt({ ...base, timerStartedAt: 50_000 }, 40_000)).toBe(42_000);
  });

  it('formats countdowns and long workouts without negative values', () => {
    expect(formatTimer(-1000)).toBe('00:00');
    expect(formatTimer(125_000)).toBe('02:05');
    expect(formatTimer(3_725_000)).toBe('1:02:05');
  });

  it('finalizes a timer from yesterday without giving credit for time after midnight', () => {
    const entry = { day: '2026-11-11', timeZone: 'Europe/Berlin', timerStartedAt: Date.parse('2026-11-11T22:59:00Z'), timerElapsed: 0 } as Entry;
    const habit = { kind: 'meditation', target: 5, special: true } as HabitConfig;
    expect(finalizeTimerPatch(habit, entry, Date.parse('2026-11-12T02:00:00Z'))).toEqual({ timerStartedAt: null, timerElapsed: 60_000, value: 1, completed: false });
    expect(finalizeTimerPatch({ ...habit, target: 1 }, entry, Date.parse('2026-11-12T02:00:00Z'))).toEqual({ timerStartedAt: null, timerElapsed: 60_000, value: 1, completed: true });
  });

  it('reconciles unmounted historical countdowns using historical targets and is idempotent', () => {
    const state = createInitialState('de', 'Europe/Berlin');
    const config = { ...configFromTemplate(templates.find(template => template.id === 'meditation')!), special: true, target: 5 };
    const habit = createHabit(config, '2026-11-11', 'meditate');
    state.habits[habit.id] = updateHabit(habit, { ...config, target: 60 }, '2026-11-12');
    const entry = { ...createEntry(habit.id, '2026-11-11', 'Europe/Berlin'), timerStartedAt: Date.parse('2026-11-11T18:00:00Z') };
    const key = entryKey(habit.id, entry.day);
    state.entries[key] = entry;
    const now = Date.parse('2026-11-12T07:00:00Z');
    const reconciled = reconcileTimers(state, now);
    expect(reconciled.entries[key]).toMatchObject({ value: 5, completed: true, timerElapsed: 300_000, timerStartedAt: null, timeZone: 'Europe/Berlin', updatedAt: new Date(now).toISOString() });
    expect(state.entries[key].timerStartedAt).not.toBeNull();
    expect(reconcileTimers(reconciled, now)).toBe(reconciled);
  });

  it('stops an overnight running stopwatch without awarding a distance goal', () => {
    const entry = { day: '2026-11-11', timeZone: 'Europe/Berlin', timerStartedAt: Date.parse('2026-11-11T22:59:00Z'), timerElapsed: 0, value: 0.5, completed: false } as Entry;
    expect(finalizeTimerPatch({ kind: 'running', special: true, target: 3 } as HabitConfig, entry, Date.parse('2026-11-12T01:00:00Z'))).toEqual({ timerStartedAt: null, timerElapsed: 60_000 });
  });
});
