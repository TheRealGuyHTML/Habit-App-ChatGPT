import type { Locale } from './domain/types';

const messages = {
  de: {
    home: 'Heute', stats: 'Statistiken', garden: 'Dein Garten', settings: 'Einstellungen', add: 'Hinzufügen',
    hello: 'Schön, dass du da bist', morning: 'Guten Morgen', afternoon: 'Dein Moment zum Wachsen', evening: 'Ein guter Tag zum Wachsen',
    subtitle: 'Kleine Schritte. Jeden Tag ein bisschen mehr du.', today: 'Heute', habits: 'Deine Gewohnheiten', done: 'erledigt',
    addHabit: 'Habit hinzufügen', editHabit: 'Habit bearbeiten', review: 'Daily Review', close: 'Schließen', save: 'Speichern', cancel: 'Abbrechen',
    pause: 'Pausieren', resume: 'Fortsetzen', remove: 'Löschen', edit: 'Bearbeiten', deleteConfirm: 'Habit ab heute löschen? Deine bisherigen Einträge bleiben in der Statistik erhalten.',
    empty: 'Hier ist Platz für etwas Gutes.', emptyText: 'Für diesen Tag ist noch kein Habit geplant. Kleine Gewohnheiten machen den Unterschied.',
    future: 'Ein kleiner Blick nach vorn.', futureText: 'Zukünftige Tage kannst du ansehen. Einträge sind ab dem jeweiligen Tag möglich.',
    week: 'Deine Woche', previous: 'Vorherige Woche', next: 'Nächste Woche', calendar: 'Datum wählen', completed: 'Erledigt', pending: 'Noch offen',
    local: 'Lokal gespeichert', synced: 'Synchronisiert', syncing: 'Wird synchronisiert', offline: 'Offline · lokal verfügbar', error: 'Speichern fehlgeschlagen',
    weekly: 'Wachstum beginnt im Kleinen', weeklyText: 'Du musst nicht perfekt sein. Du musst nur wieder anfangen.',
    streak: 'Tage in Folge', level: 'Level', progress: 'Dein Tagesfortschritt', allDone: 'Du hast dir diesen Moment verdient.',
    allDoneText: 'Alles erledigt. Nimm das gute Gefühl mit in den Rest deines Tages.', inspiration: 'DEIN KLEINER IMPULS',
    active: 'Aktiv', paused: 'Pausiert', manage: 'Alle Habits verwalten', negative: 'Negatives Habit', negativeHint: 'Heute vorausgewählt. XP gibt es nach Tagesende. Entferne den Haken bei einem Rückfall.',
    historical: 'Du schaust auf einen vergangenen Tag. Änderungen werden dauerhaft für dieses Datum gespeichert.',
    demo: 'Beispieldaten aktiv · Alle Änderungen werden wirklich lokal gespeichert.', startFresh: 'Neu starten',
    reviewHint: 'Ein Moment für dich.', reviewHintText: 'Was hat dir heute gutgetan? Reflektiere deinen Tag und sammle Review-XP.',
    completeGoal: 'Nutze die Eingaben auf der Karte, um dein Ziel zu erreichen.', journalFirst: 'Wähle zuerst deine Stimmung auf der Karte.',
    saved: 'Gespeichert', day: 'Tag', actions: 'Aktionen', install: 'App installieren', localMode: 'Lokaler Modus',
  },
  en: {
    home: 'Today', stats: 'Statistics', garden: 'Your garden', settings: 'Settings', add: 'Add',
    hello: 'Good to see you', morning: 'Good morning', afternoon: 'Your moment to grow', evening: 'A good day to grow',
    subtitle: 'Small steps. A little more you, every day.', today: 'Today', habits: 'Your habits', done: 'completed',
    addHabit: 'Add habit', editHabit: 'Edit habit', review: 'Daily review', close: 'Close', save: 'Save', cancel: 'Cancel',
    pause: 'Pause', resume: 'Resume', remove: 'Delete', edit: 'Edit', deleteConfirm: 'Delete this habit from today? Previous entries stay in your statistics.',
    empty: 'Make room for something good.', emptyText: 'No habits planned for this day yet. Small habits make a difference.',
    future: 'A little look ahead.', futureText: 'You can browse future days. Entries become available on that day.',
    week: 'Your week', previous: 'Previous week', next: 'Next week', calendar: 'Choose date', completed: 'Completed', pending: 'Still to do',
    local: 'Saved locally', synced: 'Synced', syncing: 'Syncing', offline: 'Offline · available locally', error: 'Could not save',
    weekly: 'Growth starts small', weeklyText: 'You don’t have to be perfect. Just begin again.',
    streak: 'day streak', level: 'Level', progress: 'Your daily progress', allDone: 'You earned this moment.',
    allDoneText: 'All done. Take this good feeling into the rest of your day.', inspiration: 'A LITTLE INSPIRATION',
    active: 'Active', paused: 'Paused', manage: 'Manage all habits', negative: 'Negative habit', negativeHint: 'Preselected today. XP arrives after the day ends. Uncheck if you slip.',
    historical: 'You are viewing a past day. Changes are permanently saved for this date.',
    demo: 'Sample data active · All changes are really saved on this device.', startFresh: 'Start fresh',
    reviewHint: 'A moment for yourself.', reviewHintText: 'What felt good today? Reflect on your day and collect review XP.',
    completeGoal: 'Use the controls on the card to reach your goal.', journalFirst: 'Choose your mood on the card first.',
    saved: 'Saved', day: 'Day', actions: 'Actions', install: 'Install app', localMode: 'Local mode',
  },
} as const;
export type MessageKey = keyof typeof messages.de;
export const t = (locale: Locale, key: MessageKey): string => messages[locale][key];
export const localeTag = (locale: Locale) => locale === 'de' ? 'de-DE' : 'en-GB';
