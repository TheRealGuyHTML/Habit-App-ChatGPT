import { describe, expect, it } from 'vitest';
import {
  addDays, calculateGamification, computeHabitStats, computeStats, configForDay,
  createEntry, createHabit, createInitialState, dayOfWeek, daysBetween, entryKey,
  isComplete, isScheduled, localDay, monthDays, parseImport, togglePause,
  updateHabit, weekDays, weekRates,
} from '../src/domain';
import type { AppState, Entry, Habit, HabitConfig } from '../src/domain/types';

const config = (patch: Partial<HabitConfig> = {}): HabitConfig => ({
  name: 'Walk outside', emoji: '🌿', kind: 'check', area: 'movement', negative: false,
  difficulty: 'easy', schedule: { type: 'daily' }, special: false, target: 1,
  unit: 'minutes', subtasks: [], reminder: '', color: '#34d399', ...patch,
});
const habit = (patch: Partial<HabitConfig> = {}, day = '2026-01-01', id = 'walk') => createHabit(config(patch), day, id);
const completed = (h: Habit, day: string): Entry => ({ ...createEntry(h.id, day, 'Europe/Berlin'), completed: true });
function stateWith(h: Habit, entries: Entry[] = []): AppState {
  const state = createInitialState('de', 'Europe/Berlin');
  state.habits[h.id] = h;
  for (const entry of entries) state.entries[entryKey(entry.habitId, entry.day)] = entry;
  return state;
}
function history(h: Habit, count: number, start = h.createdDay) {
  return Array.from({ length: count }, (_, i) => completed(h, addDays(start, i)));
}

describe('local calendar dates and DST', () => {
  it('assigns the same instant to the configured local day', () => {
    const instant = new Date('2026-01-01T23:30:00Z');
    expect(localDay(instant, 'Europe/Berlin')).toBe('2026-01-02');
    expect(localDay(instant, 'America/New_York')).toBe('2026-01-01');
  });
  it('does not drift around the 23-hour summer-time transition', () => {
    expect(localDay(new Date('2026-03-29T00:30:00Z'), 'Europe/Berlin')).toBe('2026-03-29');
    expect(localDay(new Date('2026-03-29T22:30:00Z'), 'Europe/Berlin')).toBe('2026-03-30');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });
  it('does not create two days around the repeated winter-time hour', () => {
    expect(localDay(new Date('2026-10-25T00:30:00Z'), 'Europe/Berlin')).toBe('2026-10-25');
    expect(localDay(new Date('2026-10-25T01:30:00Z'), 'Europe/Berlin')).toBe('2026-10-25');
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });
  it('handles year boundaries and leap days by calendar arithmetic', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-01-02', '2026-01-01')).toBe(-1);
  });
  it('returns a complete Monday-first week and leap-year month', () => {
    expect(weekDays('2026-01-04')).toEqual(['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']);
    expect(dayOfWeek('2026-01-04')).toBe(0);
    expect(monthDays('2028-02-15')).toHaveLength(29);
    expect(monthDays('2028-02-15').at(-1)).toBe('2028-02-29');
  });
});

describe('schedule relevance and history', () => {
  it('never schedules a habit before it existed', () => {
    const h = habit();
    expect(isScheduled(h, '2025-12-31')).toBe(false);
    expect(isScheduled(h, '2026-01-01')).toBe(true);
  });
  it('uses selected weekdays rather than every calendar day', () => {
    const h = habit({ schedule: { type: 'weekdays', days: [1, 3, 5] } });
    expect(isScheduled(h, '2026-01-02')).toBe(true);
    expect(isScheduled(h, '2026-01-03')).toBe(false);
    expect(isScheduled(h, '2026-01-05')).toBe(true);
  });
  it('anchors interval schedules across DST and month boundaries', () => {
    const h = habit({ schedule: { type: 'interval', every: 3, anchor: '2026-03-28' } }, '2026-03-28');
    expect(isScheduled(h, '2026-03-28')).toBe(true);
    expect(isScheduled(h, '2026-03-29')).toBe(false);
    expect(isScheduled(h, '2026-03-31')).toBe(true);
    expect(isScheduled(h, '2026-04-03')).toBe(true);
  });
  it('schedules a one-time task only on its date', () => {
    const h = habit({ schedule: { type: 'once', date: '2026-01-03' } });
    expect(isScheduled(h, '2026-01-02')).toBe(false);
    expect(isScheduled(h, '2026-01-03')).toBe(true);
    expect(isScheduled(h, '2026-01-04')).toBe(false);
  });
  it('pauses recurring habits without discarding earlier schedule history', () => {
    const original = habit();
    const paused = togglePause(original, '2026-01-03');
    expect(isScheduled(paused, '2026-01-02')).toBe(true);
    expect(isScheduled(paused, '2026-01-03')).toBe(false);
    const resumed = togglePause(paused, '2026-01-05');
    expect(isScheduled(resumed, '2026-01-04')).toBe(false);
    expect(isScheduled(resumed, '2026-01-05')).toBe(true);
    expect(original.pauses).toEqual([]);
  });
  it('does not pause a one-time task', () => {
    const h = habit({ schedule: { type: 'once', date: '2026-01-03' } });
    const result = togglePause(h, '2026-01-02');
    expect(result.pauses).toEqual([]);
    expect(isScheduled(result, '2026-01-03')).toBe(true);
  });
  it('removes a same-day pause when converting a recurring habit into a one-time task', () => {
    const original = habit();
    const paused = togglePause(original, '2026-01-03');
    const once = updateHabit(paused, config({ schedule: { type: 'once', date: '2026-01-05' } }), '2026-01-03');
    expect(once.pauses).toEqual([]);
    expect(isScheduled(once, '2026-01-02')).toBe(true);
    expect(isScheduled(once, '2026-01-03')).toBe(false);
    expect(isScheduled(once, '2026-01-05')).toBe(true);
    expect(configForDay(once, '2026-01-02').schedule.type).toBe('daily');
    expect(paused.pauses).toEqual([{ from: '2026-01-03' }]);
    expect(parseImport(stateWith(once)).habits.walk).toEqual(once);
  });
  it('closes an older pause at conversion while preserving prior paused history', () => {
    const paused = togglePause(habit(), '2026-01-02');
    const once = updateHabit(paused, config({ schedule: { type: 'once', date: '2026-01-07' } }), '2026-01-05');
    expect(once.pauses).toEqual([{ from: '2026-01-02', to: '2026-01-05' }]);
    expect(isScheduled(once, '2026-01-01')).toBe(true);
    expect(isScheduled(once, '2026-01-02')).toBe(false);
    expect(isScheduled(once, '2026-01-04')).toBe(false);
    expect(isScheduled(once, '2026-01-07')).toBe(true);
    expect(isScheduled(once, '2026-01-08')).toBe(false);
    expect(configForDay(once, '2026-01-04').schedule.type).toBe('daily');
    expect(paused.pauses).toEqual([{ from: '2026-01-02' }]);
    expect(parseImport(stateWith(once)).habits.walk).toEqual(once);
  });
  it('keeps the old frequency and target for historical dates after an edit', () => {
    const original = habit({ kind: 'water', special: true, target: 1000, unit: 'ml' });
    const edited = updateHabit(original, config({ name: 'New water target', kind: 'water', special: true, target: 2000, unit: 'ml', schedule: { type: 'weekdays', days: [1] } }), '2026-01-05');
    expect(configForDay(edited, '2026-01-04').target).toBe(1000);
    expect(configForDay(edited, '2026-01-05').target).toBe(2000);
    expect(isScheduled(edited, '2026-01-04')).toBe(true);
    expect(isScheduled(edited, '2026-01-05')).toBe(true);
    expect(isScheduled(edited, '2026-01-06')).toBe(false);
    expect(original.target).toBe(1000);
  });
  it('never nests Habit metadata inside a revision when an editor returns a structural Habit value', () => {
    const original = habit();
    const edited = updateHabit(original, { ...original, name: 'Edited name' }, '2026-01-02');
    const state = stateWith(edited);
    expect(edited.revisions.at(-1)?.config).not.toHaveProperty('revisions');
    expect(parseImport(state).habits.walk.name).toBe('Edited name');
  });
  it('keeps newer settings current when correcting an older revision', () => {
    let h = habit({ difficulty: 'easy' });
    h = updateHabit(h, config({ difficulty: 'complex', name: 'Current version' }), '2026-01-03');
    h = updateHabit(h, config({ difficulty: 'medium', name: 'Historical correction' }), '2026-01-02');
    expect(h.name).toBe('Current version');
    expect(configForDay(h, '2026-01-02').name).toBe('Historical correction');
    const state = stateWith(h, history(h, 3));
    expect(calculateGamification(state, '2026-01-03').xp).toBe(85);
    expect(parseImport(state).habits.walk.name).toBe('Current version');
  });
  it('retains historical completions after a soft deletion', () => {
    const h = { ...habit(), deletedFrom: '2026-01-04' };
    expect(isScheduled(h, '2026-01-03')).toBe(true);
    expect(isScheduled(h, '2026-01-04')).toBe(false);
    const stats = computeHabitStats(h, { [entryKey(h.id, '2026-01-01')]: completed(h, '2026-01-01') }, '2026-01-05');
    expect(stats.completed).toBe(1);
    expect(stats.planned).toBe(3);
  });
});

describe('completion semantics', () => {
  it('requires an explicit completion for an ordinary habit', () => {
    const h = habit();
    expect(isComplete(h, undefined, '2026-01-01', '2026-01-01')).toBe(false);
    expect(isComplete(h, completed(h, '2026-01-01'), '2026-01-01', '2026-01-01')).toBe(true);
  });
  it('presets a negative habit as resisted, but records a lapse explicitly', () => {
    const h = habit({ negative: true });
    expect(isComplete(h, undefined, '2026-01-01', '2026-01-01')).toBe(true);
    expect(isComplete(h, undefined, '2026-01-01', '2026-01-02')).toBe(true);
    expect(isComplete(h, createEntry(h.id, '2026-01-01', 'Europe/Berlin'), '2026-01-01', '2026-01-02')).toBe(false);
  });
  it('does not count a future date or unscheduled day as completed', () => {
    const h = habit({ schedule: { type: 'weekdays', days: [1] } });
    expect(isComplete(h, completed(h, '2026-01-05'), '2026-01-05', '2026-01-04')).toBe(false);
    expect(isComplete(h, completed(h, '2026-01-02'), '2026-01-02', '2026-01-04')).toBe(false);
  });
  it.each([['water', 'ml', 2000], ['steps', 'steps', 8000], ['sleep', 'hours', 8], ['produce', 'portions', 5], ['reading', 'pages', 20], ['running', 'km', 5]] as const)('uses the configured %s target for special trackers', (kind, unit, target) => {
    const h = habit({ kind, unit, target, special: true });
    const entry = { ...createEntry(h.id, '2026-01-01', 'Europe/Berlin'), value: target - 0.1 };
    expect(isComplete(h, entry, '2026-01-01', '2026-01-01')).toBe(false);
    expect(isComplete(h, { ...entry, value: target }, '2026-01-01', '2026-01-01')).toBe(true);
  });
  it('keeps specialty tracking opt-in, allowing simple completion while disabled', () => {
    const h = habit({ kind: 'water', special: false, target: 2000, unit: 'ml' });
    expect(isComplete(h, completed(h, '2026-01-01'), '2026-01-01', '2026-01-01')).toBe(true);
  });
  it('checks a screen maximum inclusively and detects an exceeded limit', () => {
    const h = habit({ kind: 'screen', special: true, target: 120, unit: 'minutes', negative: true });
    const entry = { ...completed(h, '2026-01-01'), value: 120 };
    expect(isComplete(h, entry, '2026-01-01', '2026-01-01')).toBe(true);
    expect(isComplete(h, { ...entry, value: 121 }, '2026-01-01', '2026-01-01')).toBe(false);
  });
  it('requires a mood before completing a journal entry', () => {
    const h = habit({ kind: 'journal', special: true });
    const entry = completed(h, '2026-01-01');
    expect(isComplete(h, entry, '2026-01-01', '2026-01-01')).toBe(false);
    expect(isComplete(h, { ...entry, mood: '🙂' }, '2026-01-01', '2026-01-01')).toBe(true);
  });
  it('cannot bypass all required checklist subtasks by setting completed alone', () => {
    const h = habit({ kind: 'checklist', special: true, subtasks: ['Vitamin D', 'Magnesium'] });
    const entry = { ...completed(h, '2026-01-01'), checked: ['Vitamin D'] };
    expect(isComplete(h, entry, '2026-01-01', '2026-01-01')).toBe(false);
    expect(isComplete(h, { ...entry, checked: ['Vitamin D', 'Magnesium'] }, '2026-01-01', '2026-01-01')).toBe(true);
  });
});

describe('streaks, rates, and relevant days', () => {
  it('does not break a streak on unplanned weekends or pending today', () => {
    const h = habit({ schedule: { type: 'weekdays', days: [1, 3, 5] } }, '2026-01-02');
    const entries = ['2026-01-02', '2026-01-05', '2026-01-07'].map(day => completed(h, day));
    const state = stateWith(h, entries);
    expect(computeHabitStats(h, state.entries, '2026-01-09').currentStreak).toBe(3);
    expect(computeHabitStats(h, state.entries, '2026-01-09').bestStreak).toBe(3);
  });
  it('breaks a streak only when a past scheduled day is missed', () => {
    const h = habit();
    const state = stateWith(h, ['2026-01-01', '2026-01-02', '2026-01-04'].map(day => completed(h, day)));
    const stats = computeHabitStats(h, state.entries, '2026-01-05');
    expect(stats.currentStreak).toBe(1);
    expect(stats.bestStreak).toBe(2);
    expect(stats.completed).toBe(3);
    expect(stats.planned).toBe(5);
    expect(stats.rate).toBeCloseTo(0.6);
  });
  it('counts neither paused days nor pre-creation days in the rate denominator', () => {
    let h = habit({}, '2026-01-03');
    h = togglePause(h, '2026-01-04');
    h = togglePause(h, '2026-01-06');
    const state = stateWith(h, ['2026-01-03', '2026-01-06'].map(day => completed(h, day)));
    const stats = computeHabitStats(h, state.entries, '2026-01-06', '2026-01-01');
    expect(stats.completed).toBe(2);
    expect(stats.planned).toBe(2);
    expect(stats.currentStreak).toBe(2);
    expect(stats.rate).toBe(1);
  });
  it('bounds period statistics without clipping lifetime streaks', () => {
    const h = habit();
    const state = stateWith(h, history(h, 10));
    const stats = computeHabitStats(h, state.entries, '2026-01-10', '2026-01-08');
    expect(stats.completed).toBe(3);
    expect(stats.planned).toBe(3);
    expect(stats.currentStreak).toBe(10);
  });
  it('keeps streak history older than one year', () => {
    const h = habit({}, '2024-01-01');
    const state = stateWith(h, history(h, 800));
    expect(computeHabitStats(h, state.entries, addDays(h.createdDay, 799)).bestStreak).toBe(800);
  });
  it('excludes once-only tasks from recurring streak calculations', () => {
    const h = habit({ schedule: { type: 'once', date: '2026-01-02' } });
    const state = stateWith(h, [completed(h, '2026-01-02')]);
    const stats = computeHabitStats(h, state.entries, '2026-01-03');
    expect(stats.completed).toBe(1);
    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(0);
  });
  it('returns finite empty-state statistics', () => {
    const stats = computeStats(createInitialState(), '2026-01-10');
    expect(stats.completed).toBe(0);
    expect(stats.planned).toBe(0);
    expect(stats.rate).toBe(0);
    expect(stats.currentStreak).toBe(0);
  });
  it('never includes future days in weekly denominators', () => {
    const h = habit({}, '2026-01-05');
    const state = stateWith(h, [completed(h, '2026-01-05')]);
    const rates = weekRates(state, '2026-01-07', '2026-01-07');
    expect(rates).toHaveLength(7);
    expect(rates[0]).toMatchObject({ day: '2026-01-05', completed: 1, planned: 1, rate: 1 });
    expect(rates.find(rate => rate.day === '2026-01-08')?.planned).toBe(0);
  });
});

describe('deterministic gamification', () => {
  it.each([['easy', 10], ['medium', 25], ['complex', 50]] as const)('uses the %s difficulty base XP', (difficulty, xp) => {
    const h = habit({ difficulty });
    const state = stateWith(h, [completed(h, '2026-01-01')]);
    expect(calculateGamification(state, '2026-01-01').xp).toBe(xp);
  });
  it('derives the same XP when processed repeatedly and removes XP after undo', () => {
    const h = habit();
    const state = stateWith(h, [completed(h, '2026-01-01')]);
    const first = calculateGamification(state, '2026-01-02');
    expect(calculateGamification(state, '2026-01-02')).toEqual(first);
    state.entries[entryKey(h.id, '2026-01-01')].completed = false;
    expect(calculateGamification(state, '2026-01-02').xp).toBe(0);
  });
  it('does not award a preset negative habit until its local day has ended', () => {
    const h = habit({ negative: true });
    const state = stateWith(h);
    expect(calculateGamification(state, '2026-01-01').xp).toBe(0);
    expect(calculateGamification(state, '2026-01-02').xp).toBe(10);
    state.entries[entryKey(h.id, '2026-01-01')] = createEntry(h.id, '2026-01-01', 'Europe/Berlin');
    expect(calculateGamification(state, '2026-01-02').xp).toBe(0);
  });
  it('does not award XP for future, unplanned, or paused completions', () => {
    let h = habit({ schedule: { type: 'weekdays', days: [1] } });
    h = togglePause(h, '2026-01-05');
    const state = stateWith(h, ['2026-01-02', '2026-01-05', '2026-01-12'].map(day => completed(h, day)));
    expect(calculateGamification(state, '2026-01-07').xp).toBe(0);
  });
  it.each([[7, 1.1], [21, 1.25], [66, 1.5]])('unlocks the %i-day milestone multiplier', (count, multiplier) => {
    const h = habit();
    const state = stateWith(h, history(h, count));
    const today = addDays(h.createdDay, count - 1);
    expect(calculateGamification(state, today).multiplier).toBe(multiplier);
    expect(calculateGamification(state, addDays(today, 3)).multiplier).toBe(multiplier);
  });
  it('gives willpower XP only for completed habits with high resistance', () => {
    const a = habit({}, '2026-01-01', 'a');
    const b = habit({}, '2026-01-01', 'b');
    const state = stateWith(a, [completed(a, '2026-01-01')]);
    state.habits[b.id] = b;
    state.reviews['2026-01-01'] = { day: '2026-01-01', note: '', updatedAt: '2026-01-01T20:00:00.000Z', ratings: {
      a: { happiness: 4, resistance: 5, quality: 4 }, b: { happiness: 4, resistance: 5, quality: 4 },
    } };
    expect(calculateGamification(state, '2026-01-01').xp).toBe(20);
    state.reviews['2026-01-01'].ratings.a.resistance = 3;
    expect(calculateGamification(state, '2026-01-01').xp).toBe(10);
  });
  it.each([[0, 1, 0, 100], [1, 1, 0, 100], [2, 2, 100, 300], [6, 3, 300, 600], [12, 4, 600, 1000]])('maps %i independent complex completions to level %i with correct thresholds', (count, level, currentLevelXp, nextLevelXp) => {
    const state = createInitialState();
    for (let index = 0; index < count; index++) {
      const h = habit({ difficulty: 'complex' }, '2026-01-01', `level-${index}`);
      state.habits[h.id] = h;
      state.entries[entryKey(h.id, '2026-01-01')] = completed(h, '2026-01-01');
    }
    const progress = calculateGamification(state, '2026-01-01');
    expect(progress.level).toBe(level);
    expect(progress.currentLevelXp).toBe(currentLevelXp);
    expect(progress.nextLevelXp).toBe(nextLevelXp);
    expect(progress.levelProgress).toBeGreaterThanOrEqual(0);
    expect(progress.levelProgress).toBeLessThan(1);
  });
  it('uses chronological multipliers without retroactively increasing earlier awards', () => {
    const h = habit();
    const state = stateWith(h, history(h, 8));
    const progress = calculateGamification(state, '2026-01-08');
    expect(progress.xp).toBe(82);
    expect(progress.ledger.slice(0, 6).every(award => award.multiplier === 1)).toBe(true);
    expect(progress.ledger.slice(6).every(award => award.multiplier === 1.1)).toBe(true);
    expect(new Set(progress.ledger.map(award => award.id)).size).toBe(progress.ledger.length);
  });
  it('continues a permanent milestone multiplier after a later failed day', () => {
    const h = habit();
    const state = stateWith(h, [...history(h, 7), completed(h, '2026-01-09')]);
    const progress = calculateGamification(state, '2026-01-09');
    expect(progress.currentStreak).toBe(1);
    expect(progress.bestStreak).toBe(7);
    expect(progress.multiplier).toBe(1.1);
    expect(progress.ledger.at(-1)?.xp).toBe(11);
  });
  it('never multiplies old XP using a later difficulty revision', () => {
    const original = habit({ difficulty: 'easy' });
    const edited = updateHabit(original, config({ difficulty: 'complex' }), '2026-01-02');
    const state = stateWith(edited, [completed(edited, '2026-01-01'), completed(edited, '2026-01-02')]);
    expect(calculateGamification(state, '2026-01-02').xp).toBe(60);
  });
  it('unlocks milestones using relevant weekly days rather than calendar-day gaps', () => {
    const h = habit({ schedule: { type: 'weekdays', days: [1] } }, '2026-01-05');
    const entries = Array.from({ length: 7 }, (_, i) => completed(h, addDays(h.createdDay, i * 7)));
    const state = stateWith(h, entries);
    const game = calculateGamification(state, '2026-02-16');
    expect(game.bestStreak).toBe(7);
    expect(game.multiplier).toBe(1.1);
    expect(game.xp).toBe(71);
  });
  it('awards a negative one-time task only after its planned day without creating a recurring streak', () => {
    const h = habit({ negative: true, schedule: { type: 'once', date: '2026-01-02' } });
    const state = stateWith(h);
    expect(calculateGamification(state, '2026-01-02').xp).toBe(0);
    const nextDay = calculateGamification(state, '2026-01-03');
    expect(nextDay.xp).toBe(10);
    expect(nextDay.bestStreak).toBe(0);
    expect(nextDay.currentStreak).toBe(0);
  });
});

describe('validated import boundaries', () => {
  it('round-trips full data without losing history or settings', () => {
    const h = habit();
    const state = stateWith(h, [completed(h, '2026-01-01')]);
    expect(parseImport(JSON.stringify(state))).toEqual(state);
  });
  it('accepts both screen-time minute and hour units supported by the manual tracker', () => {
    const h = habit({ kind: 'screen', special: true, target: 2, unit: 'hours', negative: true });
    expect(parseImport(stateWith(h)).habits.walk.unit).toBe('hours');
  });
  it('rejects enabled minimum-goal trackers configured as negative habits', () => {
    const h = habit({ kind: 'water', special: true, target: 2000, unit: 'ml', negative: true });
    expect(() => parseImport(stateWith(h))).toThrow();
  });
  it('rejects enabled empty checklists and incompatible timer units', () => {
    const checklist = habit({ kind: 'checklist', special: true, subtasks: [], unit: 'portions' });
    const timer = habit({ kind: 'meditation', special: true, target: 10, unit: 'pages' });
    expect(() => parseImport(stateWith(checklist))).toThrow();
    expect(() => parseImport(stateWith(timer))).toThrow();
  });
  it('rejects current settings that disagree with their last historical revision', () => {
    const h = habit();
    h.name = 'Changed without a revision';
    expect(() => parseImport(stateWith(h))).toThrow();
  });
  it('rejects out-of-order historical revisions', () => {
    let h = habit();
    h = updateHabit(h, config({ name: 'Second' }), '2026-01-02');
    h = updateHabit(h, config({ name: 'Third' }), '2026-01-03');
    h.revisions = [h.revisions[0], h.revisions[2], h.revisions[1]];
    expect(() => parseImport(stateWith(h))).toThrow();
  });
  it('rejects overlapping pause histories that make resuming ambiguous', () => {
    const h = habit();
    h.pauses = [{ from: '2026-01-02', to: '2026-01-08' }, { from: '2026-01-04', to: '2026-01-10' }];
    expect(() => parseImport(stateWith(h))).toThrow();
  });
  it('bounds aggregate calendar work instead of freezing on small but adversarial imports', () => {
    const state = createInitialState('de', 'UTC');
    for (let i = 0; i < 20; i++) {
      const h = habit({ negative: true }, '1900-01-01', `ancient-${i}`);
      state.habits[h.id] = h;
    }
    expect(() => parseImport(state)).toThrow(/history evaluation budget/);
  });
  it('rejects malformed JSON and unsupported schema versions', () => {
    expect(() => parseImport('{broken')).toThrow();
    expect(() => parseImport({ ...createInitialState(), schemaVersion: 999 })).toThrow();
  });
  it.each(['2026-02-30', '2026-13-01', '2026-1-01', 'yesterday'])('rejects invalid calendar date %s', day => {
    const state = stateWith(habit());
    state.habits.walk.createdDay = day;
    expect(() => parseImport(state)).toThrow();
  });
  it('rejects invalid timezones and notification times', () => {
    const state = createInitialState();
    expect(() => parseImport({ ...state, settings: { ...state.settings, timeZone: 'Mars/Olympus' } })).toThrow();
    expect(() => parseImport({ ...state, settings: { ...state.settings, reviewTime: '29:99' } })).toThrow();
  });
  it('rejects inconsistent habit ids and orphan entries', () => {
    const h = habit();
    const state = stateWith(h);
    state.habits.walk.id = 'different';
    expect(() => parseImport(state)).toThrow();
    const state2 = createInitialState();
    state2.entries[entryKey('missing', '2026-01-01')] = createEntry('missing', '2026-01-01', 'Europe/Berlin');
    expect(() => parseImport(state2)).toThrow();
  });
  it('rejects entry keys that would overwrite the wrong calendar day', () => {
    const h = habit();
    const state = stateWith(h);
    state.entries[entryKey(h.id, '2026-01-02')] = completed(h, '2026-01-01');
    expect(() => parseImport(state)).toThrow();
  });
  it('rejects prototype pollution payloads without modifying Object.prototype', () => {
    const state = JSON.stringify(createInitialState());
    const dangerous = state.replace('"habits":{}', '"habits":{"__proto__":{"polluted":true}}');
    expect(() => parseImport(dangerous)).toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('rejects non-finite values, invalid ratings, and oversized journal content', () => {
    const h = habit();
    const state = stateWith(h, [completed(h, '2026-01-01')]);
    const key = entryKey(h.id, '2026-01-01');
    expect(() => parseImport({ ...state, entries: { [key]: { ...state.entries[key], value: Infinity } } })).toThrow();
    expect(() => parseImport({ ...state, entries: { [key]: { ...state.entries[key], note: 'x'.repeat(100_001) } } })).toThrow();
    expect(() => parseImport({ ...state, reviews: { '2026-01-01': { day: '2026-01-01', note: '', updatedAt: '2026-01-01T20:00:00.000Z', ratings: { walk: { happiness: 9, resistance: 4, quality: 3 } } } } })).toThrow();
  });
});
