import { useCallback, useMemo, useState } from 'react';
import { CalendarDays, CheckCheck, ChevronLeft, ChevronRight, Flame, Sparkles, Trophy } from 'lucide-react';
import { addDays, computeHabitStats, computeStats, entryKey, dayOfWeek, isComplete, isScheduled, weekRates } from '../domain';
import type { AppState, Day, Habit, Locale, Rating } from '../domain/types';
import './Insights.css';
import { Modal } from './Modal';

interface StatsProps { state: AppState; today: Day; locale: Locale }
type Range = 1 | 7 | 30;
const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

function dateLabel(day: Day, locale: Locale, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
}

function HabitHeatmap({ habit, state, today, locale }: { habit: Habit; state: AppState; today: Day; locale: Locale }) {
  const de = locale === 'de';
  const monday = (day: Day) => addDays(day, -((dayOfWeek(day) + 6) % 7));
  const latestEnd = addDays(monday(today), 6);
  const [end, setEnd] = useState(latestEnd);
  const [selectedDay, setSelectedDay] = useState<Day | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const closeNote = useCallback(() => setNoteOpen(false), []);
  const start = addDays(end, -111); // 16 complete weeks, Monday to Sunday.
  const earliestStart = monday(habit.createdDay);
  const stats = computeHabitStats(habit, state.entries, today);
  const weekdays = de ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const status = (day: Day) => day > today ? 'future' : !isScheduled(habit, day) ? 'rest' : isComplete(habit, state.entries[entryKey(habit.id, day)], day, today) ? 'done' : 'missed';
  const statusText = (day: Day) => ({ future: de ? 'Zukünftig' : 'Future', rest: de ? 'Nicht geplant' : 'Not scheduled', done: de ? 'Erledigt' : 'Completed', missed: de ? 'Nicht erledigt' : 'Not completed' })[status(day)];
  const move = (direction: number) => {
    setEnd(current => {
      const candidate = addDays(current, direction * 112);
      const earliestEnd = addDays(earliestStart, 111);
      return direction < 0 ? (candidate < earliestEnd ? earliestEnd : candidate) : (candidate > latestEnd ? latestEnd : candidate);
    });
    setSelectedDay(null);
  };
  const focused = selectedDay && selectedDay >= start && selectedDay <= end ? selectedDay : today >= start && today <= end ? today : end;
  const note = selectedDay ? state.entries[entryKey(habit.id, selectedDay)] : undefined;
  return <div className="habit-heatmap">
    <div className="heatmap-summary"><span><b>{stats.completed}</b> {de ? 'erledigt' : 'done'}</span><span><b>{stats.currentStreak}</b> {de ? 'Serie' : 'streak'}</span><span><b>{stats.bestStreak}</b> {de ? 'Rekord' : 'best'}</span></div>
    <div className="heatmap-toolbar"><span>{dateLabel(start, locale, { month: 'short', year: 'numeric' })} – {dateLabel(end, locale, { month: 'short', year: 'numeric' })}</span><div><button className="heatmap-nav" type="button" aria-label={de ? 'Frühere Wochen' : 'Earlier weeks'} disabled={start <= earliestStart} onClick={() => move(-1)}><ChevronLeft size={16}/></button><button className="heatmap-nav" type="button" aria-label={de ? 'Spätere Wochen' : 'Later weeks'} disabled={end >= latestEnd} onClick={() => move(1)}><ChevronRight size={16}/></button></div></div>
    <div className="heatmap-scroll"><div className="heatmap-weekdays" aria-hidden="true">{weekdays.map((label, index) => <span key={index}>{label}</span>)}</div><div className="heatmap-grid" role="group" aria-label={de ? 'Habit-Verlauf: 16 Wochen, Montag bis Sonntag' : 'Habit history: 16 weeks, Monday to Sunday'}>
      {Array.from({ length: 112 }, (_, index) => {
        const day = addDays(start, index);
        const label = `${dateLabel(day, locale, { dateStyle: 'full' })}: ${statusText(day)}`;
        return <button key={day} type="button" data-day={day} className={`heatmap-dot ${status(day)} ${day === today ? 'today' : ''}`} aria-label={label} title={label} aria-pressed={selectedDay === day} tabIndex={day === focused ? 0 : -1} onClick={() => setSelectedDay(day)} onKeyDown={event => {
          const offsets: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7, Home: -index, End: 111 - index };
          const offset = offsets[event.key];
          if (offset === undefined) return;
          event.preventDefault();
          const target = addDays(day, offset);
          const button = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-day="${target}"]`);
          if (button) { setSelectedDay(target); button.focus(); }
        }}/>;
      })}
    </div></div>
    <div className="heatmap-detail" aria-live="polite" title={note?.note}>{selectedDay ? <><span>{dateLabel(selectedDay, locale, { day: 'numeric', month: 'short', year: 'numeric' })} · {statusText(selectedDay)}{note?.mood ? ` · ${note.mood}` : ''}</span>{note?.note && <button className="heatmap-note-button" onClick={() => setNoteOpen(true)}>{de ? 'Notiz ansehen' : 'View note'}</button>}</> : <span><i/> {de ? 'Erledigt · Tag antippen für Details' : 'Completed · tap a day for details'}</span>}</div>
    {noteOpen && note?.note && selectedDay && <Modal label={de ? 'Journalnotiz' : 'Journal note'} onClose={closeNote}><h2>{dateLabel(selectedDay, locale, { dateStyle: 'long' })} {note.mood}</h2><p className="heatmap-note-text">{note.note}</p></Modal>}
  </div>;
}

export function Stats({ state, today, locale }: StatsProps) {
  const [range, setRange] = useState<Range>(7);
  const habits = Object.values(state.habits).filter(habit => habit.schedule.type !== 'once');
  const active = habits.filter(habit => !habit.deletedFrom || habit.deletedFrom > today);
  const deleted = habits.filter(habit => habit.deletedFrom && habit.deletedFrom <= today);
  const renderHabit = (habit: Habit) => <article className="glass-card habit-insight-card" key={habit.id} data-habit-id={habit.id}><h3>{habit.emoji} {habit.name}</h3>{habit.deletedFrom && habit.deletedFrom <= today && <p className="muted">{locale === 'de' ? 'Gelöscht ab' : 'Deleted from'} {dateLabel(habit.deletedFrom, locale, { dateStyle: 'medium' })}</p>}<HabitHeatmap habit={habit} state={state} today={today} locale={locale}/></article>;
  const from = addDays(today, 1 - range);
  const allStats = useMemo(() => computeStats(state, today), [state, today]);
  const rangeStats = useMemo(() => computeStats(state, today, from), [state, today, from]);
  const week = useMemo(() => weekRates(state, today, today), [state, today]);
  const percent = Math.round(rangeStats.rate * 100);
  const reviews = Object.values(state.reviews).filter(review => review.day >= from && review.day <= today).sort((a, b) => b.day.localeCompare(a.day));
  const ratings: Rating[] = reviews.flatMap(review => Object.values(review.ratings));
  const circleSize = 2 * Math.PI * 58;

  return <section className="insights-page">
    <header className="insights-header"><p className="eyebrow">{locale === 'de' ? 'DEIN FORTSCHRITT' : 'YOUR PROGRESS'}</p><h1 className="page-title">{locale === 'de' ? 'Kleine Schritte. Große Wirkung.' : 'Small steps. Real change.'}</h1><p className="muted">{locale === 'de' ? 'Jede Wiederholung zählt. Sieh, was du schon geschafft hast.' : 'Every repetition counts. See how far you have come.'}</p></header>

    <div className="stats-overview">
      <div className="glass-card stat-tile"><span className="stat-symbol coral"><Flame size={21}/></span><strong>{allStats.currentStreak}<small>{locale === 'de' ? 'Tage' : 'days'}</small></strong><span>{locale === 'de' ? 'Aktuelle Serie' : 'Current streak'}</span></div>
      <div className="glass-card stat-tile"><span className="stat-symbol violet"><Trophy size={21}/></span><strong>{allStats.bestStreak}<small>{locale === 'de' ? 'Tage' : 'days'}</small></strong><span>{locale === 'de' ? 'Dein Rekord' : 'Personal best'}</span></div>
      <div className="glass-card stat-tile"><span className="stat-symbol sage"><CheckCheck size={21}/></span><strong>{allStats.completed}</strong><span>{locale === 'de' ? 'Habits erledigt' : 'Habits completed'}</span></div>
    </div>

    <div className="insight-main-grid">
      <section className="glass-card completion-card">
        <div className="insight-card-heading"><h2>{locale === 'de' ? 'Deine Erfolgsquote' : 'Your completion rate'}</h2><Sparkles size={19} className="muted"/></div>
        <div className="segmented range-control" aria-label={locale === 'de' ? 'Zeitraum' : 'Time period'}>{([1, 7, 30] as const).map(value => <button key={value} className={range === value ? 'active' : ''} type="button" aria-pressed={range === value} onClick={() => setRange(value)}>{value === 1 ? (locale === 'de' ? 'Heute' : 'Today') : `${value} ${locale === 'de' ? 'Tage' : 'days'}`}</button>)}</div>
        <div className="completion-donut" role="img" aria-label={`${percent}% ${locale === 'de' ? 'erledigt' : 'completed'}`}>
          <svg viewBox="0 0 144 144" aria-hidden="true"><circle className="donut-track" cx="72" cy="72" r="58"/><circle className="donut-fill" cx="72" cy="72" r="58" strokeDasharray={`${circleSize * percent / 100} ${circleSize}`} transform="rotate(-90 72 72)"/></svg>
          <div><strong>{percent}<span>%</span></strong><span>{locale === 'de' ? 'geschafft' : 'complete'}</span></div>
        </div>
        <p className="donut-caption"><strong>{rangeStats.completed}</strong> {locale === 'de' ? 'von' : 'of'} <strong>{rangeStats.planned}</strong> {locale === 'de' ? 'geplanten Habits' : 'scheduled habits'}</p>
        <p className="stats-footnote">{locale === 'de' ? 'Pausen und freie Tage zählen nicht als verpasst. Negative Habits werden nach Tagesende bewertet.' : 'Paused and unscheduled days do not count as missed. Negative habits are scored after the day ends.'}</p>
      </section>
      <section className="glass-card weekly-card">
        <div className="insight-card-heading"><h2>{locale === 'de' ? 'Diese Woche' : 'This week'}</h2><CalendarDays size={19} className="muted"/></div>
        <p className="muted insight-subtitle">{locale === 'de' ? 'Dein Rhythmus, Tag für Tag.' : 'Your rhythm, one day at a time.'}</p>
        <div className="week-chart" role="img" aria-label={locale === 'de' ? 'Wochenfortschritt' : 'Weekly progress'}>
          {week.map(item => <div className={`week-chart-column ${item.day === today ? 'current' : ''} ${item.day > today ? 'future' : ''}`} key={item.day} title={`${dateLabel(item.day, locale, { weekday: 'long' })}: ${item.completed}/${item.planned}`}>
            <span className="week-chart-value">{item.day > today ? '—' : `${Math.round(item.rate * 100)}%`}</span>
            <div className="week-chart-track"><span style={{ height: `${item.day > today ? 0 : Math.max(item.rate * 100, item.planned ? 3 : 0)}%` }}/></div>
            <span className="week-chart-day">{dateLabel(item.day, locale, { weekday: 'short' }).replace('.', '')}</span>
            <span className="sr-only">{item.completed} / {item.planned}</span>
          </div>)}
        </div>
      </section>
    </div>

    <section className="habit-insights-list" aria-label="Habit Insights">
      <div className="insight-card-heading"><h2>Habit Insights</h2><span className="insight-decoration">✧</span></div>
      {active.length ? active.map(renderHabit) : <p className="muted">{locale === 'de' ? 'Keine aktiven wiederkehrenden Habits.' : 'No active recurring habits.'}</p>}
      {deleted.length > 0 && <details className="deleted-habits"><summary>{locale === 'de' ? 'Gelöschte Habits' : 'Deleted habits'} <span>{deleted.length}</span></summary><div>{deleted.map(renderHabit)}</div></details>}
    </section>

    {state.settings.reviewEnabled && <section className="glass-card review-insights-card">
      <div className="insight-card-heading"><h2>{locale === 'de' ? 'Wie es sich anfühlt' : 'How it feels'}</h2><span>💭</span></div>
      <p className="muted insight-subtitle">{locale === 'de' ? `Deine Reviews der letzten ${range} Tage.` : `Your reviews from the last ${range} days.`}</p>
      {ratings.length ? <><div className="review-averages">{(['happiness', 'resistance', 'quality'] as const).map((key, index) => <div key={key}><span>{['😊', '💪', '✨'][index]}</span><strong>{average(ratings.map(rating => key === 'resistance' ? 6 - rating[key] : rating[key])).toFixed(1)}<small>/5</small></strong><span>{(locale === 'de' ? ['Glücklichkeit', 'Leichtigkeit', 'Qualität'] : ['Happiness', 'Ease of starting', 'Quality'])[index]}</span></div>)}</div><div className="review-history">{reviews.slice(0, 7).map(review => <details key={review.day}><summary><span>{dateLabel(review.day, locale, { weekday: 'short', day: 'numeric', month: 'short' })}</span><span className="muted">{Object.keys(review.ratings).length} Habits</span></summary><div>{Object.entries(review.ratings).map(([id, rating]) => <p key={id}><strong>{state.habits[id]?.name ?? (locale === 'de' ? 'Archiviertes Habit' : 'Archived habit')}</strong><span>😊 {rating.happiness} · 💪 {6 - rating.resistance} · ✨ {rating.quality}</span></p>)}{review.note && <blockquote>{review.note}</blockquote>}</div></details>)}</div></> : <p className="insight-empty muted">{locale === 'de' ? 'Dein erstes Daily Review macht mehr sichtbar als eine Erfolgsquote. Speichere es über den Plus-Button.' : 'Your first daily review reveals more than a completion rate. Save one using the plus button.'}</p>}
    </section>}
  </section>;
}

export default Stats;
