import { useMemo, useState } from 'react';
import { CalendarDays, CheckCheck, ChevronLeft, ChevronRight, Flame, Sparkles, Trophy } from 'lucide-react';
import { addDays, computeHabitStats, computeStats, entryKey, isComplete, isScheduled, weekRates } from '../domain';
import type { AppState, Day, Habit, Locale, Rating } from '../domain/types';
import './Insights.css';

interface StatsProps { state: AppState; today: Day; locale: Locale }
type Range = 1 | 7 | 30;
const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

function dateLabel(day: Day, locale: Locale, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
}

function MonthInsight({ habit, state, today, locale }: { habit: Habit; state: AppState; today: Day; locale: Locale }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<Day | null>(null);
  const first = `${month}-01`;
  const firstWeekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const monthLength = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const earliestMonth = habit.createdDay.slice(0, 7);
  const moveMonth = (by: number) => {
    const next = new Date(`${first}T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + by);
    setMonth(next.toISOString().slice(0, 7));
    setSelectedDay(null);
  };
  const stats = computeHabitStats(habit, state.entries, today);
  const weekdays = locale === 'de' ? ['M', 'D', 'M', 'D', 'F', 'S', 'S'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const status = (day: Day) => day > today ? 'future' : !isScheduled(habit, day) ? 'rest' : isComplete(habit, state.entries[entryKey(habit.id, day)], day, today) ? 'done' : 'missed';
  const statusText = (day: Day) => {
    const kind = status(day);
    return kind === 'future' ? (locale === 'de' ? 'Liegt in der Zukunft' : 'In the future') : kind === 'rest' ? (locale === 'de' ? 'Nicht geplant' : 'Not scheduled') : kind === 'done' ? (locale === 'de' ? 'Erledigt' : 'Completed') : (locale === 'de' ? 'Nicht erledigt' : 'Not completed');
  };

  return <div className="month-insight">
    <div className="insight-mini-stats">
      <div><strong>{stats.completed}</strong><span>{locale === 'de' ? 'Erledigt' : 'Completed'}</span></div>
      <div><strong>{stats.currentStreak}<span className="inline-flame"> 🔥</span></strong><span>{locale === 'de' ? 'Aktuelle Serie' : 'Current streak'}</span></div>
      <div><strong>{stats.bestStreak}</strong><span>{locale === 'de' ? 'Beste Serie' : 'Best streak'}</span></div>
    </div>
    <div className="month-heading">
      <button className="mini-button" type="button" aria-label={locale === 'de' ? 'Vorheriger Monat' : 'Previous month'} onClick={() => moveMonth(-1)} disabled={month <= earliestMonth}><ChevronLeft size={18}/></button>
      <strong>{dateLabel(first, locale, { month: 'long', year: 'numeric' })}</strong>
      <button className="mini-button" type="button" aria-label={locale === 'de' ? 'Nächster Monat' : 'Next month'} onClick={() => moveMonth(1)} disabled={month >= today.slice(0, 7)}><ChevronRight size={18}/></button>
    </div>
    <div className="insight-calendar" aria-label={locale === 'de' ? 'Habit-Kalender' : 'Habit calendar'}>
      {weekdays.map((label, i) => <span key={`weekday-${i}`} className="calendar-weekday" aria-hidden="true">{label}</span>)}
      {Array.from({ length: firstWeekday }, (_, i) => <span key={`blank-${i}`} aria-hidden="true"/>)}
      {Array.from({ length: monthLength }, (_, i) => {
        const day = `${month}-${String(i + 1).padStart(2, '0')}`;
        const kind = status(day);
        return <button key={day} type="button" className={`calendar-dot ${kind} ${day === today ? 'today' : ''} ${day === selectedDay ? 'selected' : ''}`} aria-label={`${dateLabel(day, locale, { day: 'numeric', month: 'long' })}: ${statusText(day)}`} aria-pressed={day === selectedDay} onClick={() => setSelectedDay(day)}><span>{i + 1}</span></button>;
      })}
    </div>
    <div className="calendar-legend"><span><i className="legend-dot done"/>{locale === 'de' ? 'Erledigt' : 'Completed'}</span><span><i className="legend-dot missed"/>{locale === 'de' ? 'Offen' : 'Incomplete'}</span><span><i className="legend-dot rest"/>{locale === 'de' ? 'Nicht geplant' : 'Not scheduled'}</span></div>
    {selectedDay && <div className="calendar-day-detail" aria-live="polite"><strong>{dateLabel(selectedDay, locale, { weekday: 'short', day: 'numeric', month: 'long' })}</strong><span>{statusText(selectedDay)}</span>{state.entries[entryKey(habit.id, selectedDay)]?.note && <p>{state.entries[entryKey(habit.id, selectedDay)].mood} {state.entries[entryKey(habit.id, selectedDay)].note}</p>}</div>}
  </div>;
}

export function Stats({ state, today, locale }: StatsProps) {
  const [range, setRange] = useState<Range>(7);
  const habits = Object.values(state.habits).filter(habit => habit.schedule.type !== 'once');
  const active = habits.filter(habit => !habit.deletedFrom || habit.deletedFrom > today);
  const deleted = habits.filter(habit => habit.deletedFrom && habit.deletedFrom <= today);
  const renderHabit = (habit: Habit) => <article className="glass-card habit-insight-card" key={habit.id} data-habit-id={habit.id}><h3>{habit.emoji} {habit.name}</h3>{habit.deletedFrom && habit.deletedFrom <= today && <p className="muted">{locale === 'de' ? 'Gelöscht ab' : 'Deleted from'} {dateLabel(habit.deletedFrom, locale, { dateStyle: 'medium' })}</p>}<MonthInsight habit={habit} state={state} today={today} locale={locale}/></article>;
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
