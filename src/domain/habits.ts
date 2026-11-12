import { dayOfWeek, daysBetween } from './dates';
import type { Day, Entry, Habit, HabitConfig } from './types';

export const entryKey = (habitId: string, day: Day): string => `${habitId}_${day}`;

/** TypeScript structural values may carry Habit metadata; snapshots only store config. */
export function snapshotConfig(config: HabitConfig): HabitConfig {
  return {
    ...(config.custom !== undefined ? { custom: config.custom } : {}),
    name: config.name, emoji: config.emoji, kind: config.kind, area: config.area, negative: config.negative,
    difficulty: config.difficulty, schedule: structuredClone(config.schedule), special: config.special,
    target: config.target, unit: config.unit, subtasks: [...config.subtasks], reminder: config.reminder, color: config.color,
  };
}

export function configForDay(habit: Habit, day: Day): HabitConfig {
  // Creation, edits and validated imports keep revisions in ascending order.
  for (let index = habit.revisions.length - 1; index >= 0; index--) {
    if (habit.revisions[index].effectiveFrom <= day) return habit.revisions[index].config;
  }
  return habit;
}

export function isScheduled(habit: Habit, day: Day): boolean {
  if (day < habit.createdDay || (habit.deletedFrom && day >= habit.deletedFrom)) return false;
  if (habit.pauses.some(pause => pause.from <= day && (!pause.to || day < pause.to))) return false;
  const { schedule } = configForDay(habit, day);
  switch (schedule.type) {
    case 'daily': return true;
    case 'once': return schedule.date === day;
    case 'weekdays': return schedule.days.includes(dayOfWeek(day));
    case 'interval': return day >= schedule.anchor && daysBetween(schedule.anchor, day) % schedule.every === 0;
  }
}

/** Negative habits are provisionally checked today; XP only finalizes after the day. */
export function isComplete(habit: Habit, entry: Entry | undefined, day: Day, today: Day): boolean {
  if (day > today || !isScheduled(habit, day)) return false;
  const config = configForDay(habit, day);
  if (config.negative && entry?.completed === false) return false;
  if (config.special) {
    if (config.kind === 'screen') return config.negative ? (entry?.value ?? 0) <= config.target : !!entry?.completed && entry.value <= config.target;
    if (config.kind === 'checklist') return config.subtasks.length > 0 && config.subtasks.every(task => entry?.checked.includes(task));
    if (config.kind === 'journal') return !!entry?.completed && !!entry.mood;
    if (config.kind !== 'check') return (entry?.value ?? 0) >= config.target;
  }
  return entry?.completed ?? config.negative;
}

export function createEntry(habitId: string, day: Day, timeZone: string): Entry {
  return { habitId, day, completed: false, value: 0, checked: [], note: '', mood: '', timerStartedAt: null, timerElapsed: 0, updatedAt: new Date().toISOString(), timeZone };
}

export function updateHabit(habit: Habit, config: HabitConfig, day: Day): Habit {
  if (day < habit.createdDay) throw new Error('A habit cannot be edited before its creation');
  const snapshot = snapshotConfig(config);
  const revisions = habit.revisions.filter(revision => revision.effectiveFrom !== day);
  revisions.push({ effectiveFrom: day, config: snapshot });
  revisions.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const latestConfig = revisions.at(-1)!.config;
  // One-time tasks cannot be paused. Converting a paused recurring habit must
  // resume it at the revision boundary, keeping all earlier paused days intact.
  const pauses = habit.pauses.flatMap(pause => {
    const active = pause.from <= day && (!pause.to || day < pause.to);
    if (snapshot.schedule.type !== 'once' || !active) return [{ ...pause }];
    return pause.from === day ? [] : [{ ...pause, to: day }];
  });
  return { ...habit, ...latestConfig, revisions, pauses, updatedAt: new Date().toISOString() };
}

export function togglePause(habit: Habit, day: Day): Habit {
  if (configForDay(habit, day).schedule.type === 'once') return habit;
  const pauses = habit.pauses.map(pause => ({ ...pause }));
  const current = pauses.find(pause => pause.from <= day && (!pause.to || day < pause.to));
  if (current) {
    if (current.from === day) pauses.splice(pauses.indexOf(current), 1);
    else current.to = day;
  } else pauses.push({ from: day });
  return { ...habit, pauses, updatedAt: new Date().toISOString() };
}

export function canAward(habit: Habit, entry: Entry | undefined, day: Day, today: Day): boolean {
  return isComplete(habit, entry, day, today) && (!configForDay(habit, day).negative || day < today);
}
