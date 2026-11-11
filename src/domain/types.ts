export type Day = string;
export type Locale = 'de' | 'en';
export type HabitKind = 'check' | 'water' | 'sleep' | 'steps' | 'checklist' | 'produce' | 'reading' | 'screen' | 'language' | 'meditation' | 'journal' | 'running' | 'training';
export type Difficulty = 'easy' | 'medium' | 'complex';
export type Area = 'health' | 'movement' | 'mind' | 'growth' | 'social';
export type Schedule = { type: 'daily' } | { type: 'once'; date: Day } | { type: 'weekdays'; days: number[] } | { type: 'interval'; every: number; anchor: Day };
export interface HabitConfig {
  name: string; emoji: string; kind: HabitKind; area: Area; negative: boolean;
  difficulty: Difficulty; schedule: Schedule; special: boolean; target: number;
  unit: 'ml' | 'hours' | 'steps' | 'portions' | 'minutes' | 'pages' | 'km';
  subtasks: string[]; reminder: string; color: string;
}
export interface HabitRevision { effectiveFrom: Day; config: HabitConfig }
export interface Habit extends HabitConfig {
  id: string; createdDay: Day; createdAt: string; updatedAt: string;
  revisions: HabitRevision[]; pauses: { from: Day; to?: Day }[]; deletedFrom?: Day;
}
export interface Entry {
  habitId: string; day: Day; completed: boolean; value: number; checked: string[];
  note: string; mood: string; timerStartedAt: number | null; timerElapsed: number;
  updatedAt: string; timeZone: string;
}
export interface Rating { happiness: number; resistance: number; quality: number }
export interface Review { day: Day; ratings: Record<string, Rating>; note: string; updatedAt: string }
export interface Settings {
  locale: Locale; theme: 'system' | 'light' | 'dark'; timeZone: string;
  reviewEnabled: boolean; reviewTime: string; notificationsEnabled: boolean;
  name: string; areas: Area[];
}
export interface AppState {
  schemaVersion: 1; habits: Record<string, Habit>; entries: Record<string, Entry>;
  reviews: Record<Day, Review>; settings: Settings; onboarded: boolean;
}
export interface HabitTemplate { id: string; name: Record<Locale, string>; emoji: string; kind: HabitKind; area: Area; target: number; unit: HabitConfig['unit']; difficulty: Difficulty; negative?: boolean; subtasks?: string[]; color: string }
export interface HabitStats { currentStreak: number; bestStreak: number; completed: number; planned: number; rate: number }
