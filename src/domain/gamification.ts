import { addDays, dateRange } from './dates';
import { canAward, configForDay, entryKey, isScheduled } from './habits';
import { computeHabitStats, dayRate } from './stats';
import type { AppState, Day, Difficulty } from './types';

export const difficultyXP: Record<Difficulty, number> = { easy: 10, medium: 25, complex: 50 };
export interface XpAward { id: string; habitId: string; day: Day; base: number; multiplier: number; bonus: number; xp: number }
export interface Achievement { id: string; threshold: number; unlocked: boolean; progress: number }
export interface Gamification {
  xp: number; level: number; levelProgress: number; nextLevelXp: number; currentLevelXp: number;
  multiplier: number; bestStreak: number; currentStreak: number; achievements: Achievement[];
  plant: { stage: 'seed' | 'sprout' | 'growing' | 'bloom'; health: number; wilted: boolean };
  ledger: XpAward[];
}
export function streakMultiplier(streak: number): number { return streak >= 66 ? 1.5 : streak >= 21 ? 1.25 : streak >= 7 ? 1.1 : 1; }

/** Derive once per completion identity. Repeated syncs cannot increment a balance. */
export function calculateGamification(state: AppState, today: Day): Gamification {
  const habits = Object.values(state.habits);
  const start = habits.reduce((day, habit) => habit.createdDay < day ? habit.createdDay : day, today);
  const streaks: Record<string, number> = {};
  let bestStreak = 0;
  const ledger: XpAward[] = [];
  for (const day of dateRange(start, today)) {
    const due = habits.filter(habit => isScheduled(habit, day));
    for (const habit of due) {
      if (configForDay(habit, day).schedule.type === 'once') continue;
      if (canAward(habit, state.entries[entryKey(habit.id, day)], day, today)) {
        streaks[habit.id] = (streaks[habit.id] ?? 0) + 1;
        bestStreak = Math.max(bestStreak, streaks[habit.id]);
      } else if (day !== today) streaks[habit.id] = 0;
    }
    const multiplier = streakMultiplier(bestStreak);
    for (const habit of due) {
      if (!canAward(habit, state.entries[entryKey(habit.id, day)], day, today)) continue;
      const config = configForDay(habit, day);
      const base = difficultyXP[config.difficulty];
      const rating = state.reviews[day]?.ratings[habit.id];
      const bonus = rating && rating.resistance >= 4 ? 10 : 0;
      ledger.push({ id: `completion:${entryKey(habit.id, day)}`, habitId: habit.id, day, base, multiplier, bonus, xp: Math.round(base * multiplier) + bonus });
    }
  }
  const xp = ledger.reduce((total, award) => total + award.xp, 0);
  const level = Math.floor((1 + Math.sqrt(1 + xp * 0.08)) / 2);
  const currentLevelXp = 100 * (level - 1) * level / 2;
  const nextLevelXp = 100 * level * (level + 1) / 2;
  const levelProgress = (xp - currentLevelXp) / (nextLevelXp - currentLevelXp);
  const currentStreak = habits.reduce((maximum, habit) => Math.max(maximum, computeHabitStats(habit, state.entries, today).currentStreak), 0);
  const milestones: [string, number, number][] = [
    ['first-step', 1, ledger.length], ['week', 7, bestStreak], ['three-weeks', 21, bestStreak], ['habit-formed', 66, bestStreak], ['century', 100, ledger.length],
  ];
  const achievements = milestones.map(([id, threshold, value]) => ({ id, threshold, unlocked: value >= threshold, progress: Math.min(1, value / threshold) }));
  const recent = dateRange(addDays(today, -7), addDays(today, -1)).map(day => dayRate(state, day, today));
  const planned = recent.reduce((sum, day) => sum + day.planned, 0);
  const health = planned ? recent.reduce((sum, day) => sum + day.completed, 0) / planned : 1;
  const wilted = planned > 0 && health < 0.4;
  const stage = bestStreak >= 66 || level >= 7 ? 'bloom' : bestStreak >= 21 || level >= 4 ? 'growing' : bestStreak >= 7 || level >= 2 ? 'sprout' : 'seed';
  return { xp, level, levelProgress, nextLevelXp, currentLevelXp, multiplier: streakMultiplier(bestStreak), bestStreak, currentStreak, achievements, plant: { stage, health, wilted }, ledger };
}
