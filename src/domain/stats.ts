import { dateRange, weekDays } from './dates';
import { canAward, configForDay, entryKey, isComplete, isScheduled } from './habits';
import type { AppState, Day, Entry, Habit, HabitStats } from './types';

export interface DayRate { day: Day; completed: number; planned: number; rate: number }

function streaks(days: Day[], complete: (day: Day) => boolean, today: Day): { currentStreak: number; bestStreak: number } {
  let currentStreak = 0;
  let bestStreak = 0;
  for (const day of days) {
    if (complete(day)) { currentStreak++; bestStreak = Math.max(bestStreak, currentStreak); }
    else if (day !== today) currentStreak = 0;
  }
  return { currentStreak, bestStreak };
}

export function computeHabitStats(habit: Habit, entries: Record<string, Entry>, today: Day, from = habit.createdDay): HabitStats {
  const days = dateRange(habit.createdDay, today).filter(day => isScheduled(habit, day));
  const repeating = days.filter(day => configForDay(habit, day).schedule.type !== 'once');
  const filtered = days.filter(day => day >= from);
  const completed = filtered.filter(day => isComplete(habit, entries[entryKey(habit.id, day)], day, today)).length;
  const streak = streaks(repeating, day => canAward(habit, entries[entryKey(habit.id, day)], day, today), today);
  return { ...streak, completed, planned: filtered.length, rate: filtered.length ? completed / filtered.length : 0 };
}

export function dayRate(state: AppState, day: Day, today: Day): DayRate {
  const habits = day > today ? [] : Object.values(state.habits).filter(habit => isScheduled(habit, day));
  const completed = habits.filter(habit => isComplete(habit, state.entries[entryKey(habit.id, day)], day, today)).length;
  return { day, completed, planned: habits.length, rate: habits.length ? completed / habits.length : 0 };
}

export function computeStats(state: AppState, today: Day, from?: Day): HabitStats {
  const habits = Object.values(state.habits);
  const start = habits.reduce((min, habit) => habit.createdDay < min ? habit.createdDay : min, today);
  const days = dateRange(start, today);
  const selectedDays = days.filter(day => !from || day >= from);
  const rates = selectedDays.map(day => dayRate(state, day, today));
  const planned = rates.reduce((sum, rate) => sum + rate.planned, 0);
  const completed = rates.reduce((sum, rate) => sum + rate.completed, 0);
  const repeatingDays = days.filter(day => habits.some(habit => isScheduled(habit, day) && configForDay(habit, day).schedule.type !== 'once'));
  const streak = streaks(repeatingDays, day => habits.filter(habit => isScheduled(habit, day) && configForDay(habit, day).schedule.type !== 'once').every(habit => canAward(habit, state.entries[entryKey(habit.id, day)], day, today)), today);
  return { ...streak, completed, planned, rate: planned ? completed / planned : 0 };
}

export function weekRates(state: AppState, day: Day, today = day): DayRate[] {
  return weekDays(day).map(date => dayRate(state, date, today));
}
