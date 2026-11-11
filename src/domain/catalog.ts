import { addDays, localDay, validDay } from './dates';
import { createEntry, entryKey, snapshotConfig } from './habits';
import type { AppState, Day, Habit, HabitConfig, HabitTemplate, Locale } from './types';

export const templates: HabitTemplate[] = [
  { id: 'water', name: { de: 'Wasser trinken', en: 'Drink water' }, emoji: '💧', kind: 'water', area: 'health', target: 2000, unit: 'ml', difficulty: 'easy', color: '#60a5fa' },
  { id: 'sleep', name: { de: 'Erholsam schlafen', en: 'Sleep well' }, emoji: '🌙', kind: 'sleep', area: 'health', target: 8, unit: 'hours', difficulty: 'medium', color: '#a78bfa' },
  { id: 'steps', name: { de: 'Schritte sammeln', en: 'Walk more' }, emoji: '👟', kind: 'steps', area: 'movement', target: 8000, unit: 'steps', difficulty: 'medium', color: '#fb923c' },
  { id: 'vitamins', name: { de: 'Vitamine nehmen', en: 'Take vitamins' }, emoji: '🍊', kind: 'checklist', area: 'health', target: 1, unit: 'portions', difficulty: 'easy', subtasks: ['Vitamin D', 'Magnesium'], color: '#fbbf24' },
  { id: 'medication', name: { de: 'Medikamente nehmen', en: 'Take medication' }, emoji: '💊', kind: 'checklist', area: 'health', target: 1, unit: 'portions', difficulty: 'easy', subtasks: [], color: '#f9a8d4' },
  { id: 'produce', name: { de: 'Obst & Gemüse essen', en: 'Eat fruit & vegetables' }, emoji: '🥑', kind: 'produce', area: 'health', target: 5, unit: 'portions', difficulty: 'easy', color: '#4ade80' },
  { id: 'reading', name: { de: 'Ein Kapitel lesen', en: 'Read a chapter' }, emoji: '📖', kind: 'reading', area: 'growth', target: 20, unit: 'pages', difficulty: 'medium', color: '#f472b6' },
  { id: 'learning', name: { de: 'Etwas Neues lernen', en: 'Learn something new' }, emoji: '🧠', kind: 'reading', area: 'growth', target: 25, unit: 'minutes', difficulty: 'complex', color: '#a78bfa' },
  { id: 'screen', name: { de: 'Bildschirmzeit begrenzen', en: 'Limit screen time' }, emoji: '📱', kind: 'screen', area: 'mind', target: 120, unit: 'minutes', difficulty: 'complex', negative: true, color: '#f472b6' },
  { id: 'language', name: { de: 'Sprache lernen', en: 'Practice a language' }, emoji: '🌍', kind: 'language', area: 'growth', target: 15, unit: 'minutes', difficulty: 'medium', color: '#2dd4bf' },
  { id: 'meditation', name: { de: 'Zeit für mich', en: 'Take a mindful moment' }, emoji: '🧘', kind: 'meditation', area: 'mind', target: 10, unit: 'minutes', difficulty: 'medium', color: '#a78bfa' },
  { id: 'journal', name: { de: 'Gedanken festhalten', en: 'Write in my journal' }, emoji: '✍️', kind: 'journal', area: 'mind', target: 1, unit: 'minutes', difficulty: 'easy', color: '#f472b6' },
  { id: 'running', name: { de: 'Eine Runde joggen', en: 'Go for a run' }, emoji: '🏃', kind: 'running', area: 'movement', target: 3, unit: 'km', difficulty: 'complex', color: '#fb923c' },
  { id: 'walking', name: { de: 'Spazieren gehen', en: 'Go for a walk' }, emoji: '🚶', kind: 'running', area: 'movement', target: 2, unit: 'km', difficulty: 'medium', color: '#34d399' },
  { id: 'training', name: { de: 'Training', en: 'Work out' }, emoji: '🏋️', kind: 'training', area: 'movement', target: 30, unit: 'minutes', difficulty: 'complex', color: '#fb7185' },
  { id: 'social', name: { de: 'Jemandem Freude machen', en: 'Make someone smile' }, emoji: '💌', kind: 'check', area: 'social', target: 1, unit: 'portions', difficulty: 'easy', color: '#f472b6' },
  { id: 'no-fastfood', name: { de: 'Kein Fastfood', en: 'Skip fast food' }, emoji: '🥗', kind: 'check', area: 'health', target: 1, unit: 'portions', difficulty: 'medium', negative: true, color: '#4ade80' },
];

export function configFromTemplate(template: HabitTemplate, locale: Locale = 'de', day?: Day): HabitConfig {
  if (day && !validDay(day)) throw new Error('Invalid start day');
  return { name: template.name[locale], emoji: template.emoji, kind: template.kind, area: template.area, negative: template.negative ?? false, difficulty: template.difficulty, schedule: { type: 'daily' }, special: false, target: template.target, unit: template.unit, subtasks: template.subtasks ? [...template.subtasks] : [], reminder: '', color: template.color };
}

export function createHabit(config: HabitConfig, day = localDay(), id: string = crypto.randomUUID()): Habit {
  const now = new Date().toISOString();
  const snapshot = snapshotConfig(config);
  return { ...snapshot, id, createdDay: day, createdAt: now, updatedAt: now, revisions: [{ effectiveFrom: day, config: snapshotConfig(snapshot) }], pauses: [] };
}

export function createInitialState(locale: Locale = 'de', timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): AppState {
  return { schemaVersion: 1, habits: {}, entries: {}, reviews: {}, settings: { locale, theme: 'system', timeZone, reviewEnabled: false, reviewTime: '20:30', notificationsEnabled: false, name: '', areas: [] }, onboarded: false };
}

/** Opt-in example data. All subsequent interactions persist in the same local store. */
export function createDemoState(locale: Locale = 'de', timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): AppState {
  const state = createInitialState(locale, timeZone);
  const today = localDay(new Date(), timeZone);
  state.onboarded = true;
  state.settings.name = locale === 'de' ? 'Alex' : 'Alex';
  state.settings.areas = ['health', 'mind', 'growth'];
  for (const [index, id] of ['water', 'meditation', 'reading'].entries()) {
    const config = { ...configFromTemplate(templates.find(template => template.id === id)!, locale), special: true };
    const habit = createHabit(config, addDays(today, -6), `demo-${id}`);
    state.habits[habit.id] = habit;
    for (let ago = 6; ago >= 0; ago--) {
      if (ago === 3 && index === 2) continue;
      const day = addDays(today, -ago);
      const entry = createEntry(habit.id, day, timeZone);
      entry.value = ago ? config.target : index === 0 ? 600 : index === 1 ? 0 : 10;
      entry.completed = entry.value >= config.target;
      state.entries[entryKey(habit.id, day)] = entry;
    }
  }
  return state;
}
