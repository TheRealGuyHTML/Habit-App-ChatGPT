import { useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { configForDay, entryKey, isComplete, isScheduled, localDay } from '../domain';
import type { AppState, Day, Locale, Rating, Review } from '../domain/types';
import './Insights.css';

interface DailyReviewProps { state: AppState; day: Day; locale: Locale; onSave: (review: Review) => void; onClose: () => void }
const moodEmojis = ['😞', '😕', '😐', '🙂', '🤩'];
const defaultRating = (): Rating => ({ happiness: 3, resistance: 3, quality: 3 });

export function DailyReview({ state, day, locale, onSave, onClose }: DailyReviewProps) {
  const habits = Object.values(state.habits).filter(habit => isScheduled(habit, day));
  const previous = state.reviews[day];
  const [ratings, setRatings] = useState<Record<string, Rating>>(() => Object.fromEntries(habits.map(habit => [habit.id, previous?.ratings[habit.id] ?? defaultRating()])));
  const [note, setNote] = useState(previous?.note ?? '');
  const today = localDay(new Date(), state.settings.timeZone);
  const updateRating = (id: string, metric: keyof Rating, value: number) => setRatings(previousRatings => ({ ...previousRatings, [id]: { ...(previousRatings[id] ?? defaultRating()), [metric]: value } }));
  const text = locale === 'de' ? {
    title: 'Ein Moment für dich.', subtitle: 'Schau kurz zurück. Wie haben sich deine Gewohnheiten heute angefühlt?', close: 'Review schließen', happiness: 'Wie zufrieden bist du?', resistance: 'Wie schwer war der Anfang?', quality: 'Wie gut hat es sich angefühlt?', easy: 'Sehr leicht', hard: 'Extrem schwer', low: 'Wenig', high: 'Sehr gut', note: 'Was möchtest du mitnehmen?', optional: 'Ein Gedanke, ein Highlight oder etwas, wofür du dankbar bist …', save: 'Review speichern', saved: 'Review aktualisieren', empty: 'Für diesen Tag sind keine Gewohnheiten geplant.', bonus: 'Willpower-Bonus: +10 XP für jedes erledigte Habit mit Widerstand 4 oder 5. Negative Habits werden erst nach Tagesende belohnt.', completed: 'Erledigt', pending: 'Noch offen', negative: 'Bewertung nach Tagesende', scale: ['Sehr schlecht', 'Eher schlecht', 'Neutral', 'Gut', 'Sehr gut'],
  } : {
    title: 'A moment for yourself.', subtitle: 'Take a breath and look back. How did your habits feel today?', close: 'Close review', happiness: 'How happy are you with it?', resistance: 'How hard was it to begin?', quality: 'How well did it go?', easy: 'Very easy', hard: 'Extremely hard', low: 'Low', high: 'Very good', note: 'What will you take with you?', optional: 'A thought, a highlight, or something you are grateful for …', save: 'Save review', saved: 'Update review', empty: 'No habits are scheduled for this day.', bonus: 'Willpower bonus: +10 XP for each completed habit with resistance 4 or 5. Negative habits receive XP after the day ends.', completed: 'Completed', pending: 'Still open', negative: 'Scored after the day ends', scale: ['Very unhappy', 'Unhappy', 'Neutral', 'Happy', 'Very happy'],
  };
  const date = new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));

  return <div className="daily-review">
    <header className="review-sheet-header"><div><p className="eyebrow">DAILY REVIEW · {date}</p><h2>{text.title}</h2></div><button className="mini-button" type="button" onClick={onClose} aria-label={text.close}><X size={20}/></button></header>
    <p className="muted review-intro">{text.subtitle}</p>
    <div className="review-bonus-note"><Sparkles size={18}/><span>{text.bonus}</span></div>
    <form onSubmit={event => { event.preventDefault(); onSave({ day, ratings: Object.fromEntries(habits.map(habit => [habit.id, ratings[habit.id] ?? defaultRating()])), note: note.trim(), updatedAt: new Date().toISOString() }); }}>
      {habits.map(habit => {
        const config = configForDay(habit, day);
        const completed = isComplete(habit, state.entries[entryKey(habit.id, day)], day, today);
        const rating = ratings[habit.id] ?? defaultRating();
        return <fieldset className="review-habit" key={habit.id}><legend><span>{config.emoji}</span> {config.name}</legend><p className={`review-habit-status ${completed ? 'complete' : ''}`}>{completed && <Check size={13}/>} {config.negative && day >= today ? text.negative : completed ? text.completed : text.pending}</p>
          <div className="review-metric"><span id={`happiness-${habit.id}`}>{text.happiness}</span><div className="review-emoji-scale" role="group" aria-labelledby={`happiness-${habit.id}`}>{moodEmojis.map((emoji, i) => <button key={emoji} type="button" className={rating.happiness === i + 1 ? 'selected' : ''} aria-label={`${i + 1}: ${text.scale[i]}`} aria-pressed={rating.happiness === i + 1} onClick={() => updateRating(habit.id, 'happiness', i + 1)}>{emoji}</button>)}</div></div>
          {(['resistance', 'quality'] as const).map(metric => <div className="review-metric" key={metric}><span id={`${metric}-${habit.id}`}>{metric === 'resistance' ? text.resistance : text.quality}</span><div className="review-number-scale" role="group" aria-labelledby={`${metric}-${habit.id}`}>{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" className={rating[metric] === value ? 'selected' : ''} aria-label={`${metric === 'resistance' ? text.resistance : text.quality} ${value}/5`} aria-pressed={rating[metric] === value} onClick={() => updateRating(habit.id, metric, value)}>{value}</button>)}</div><div className="review-scale-ends"><span>{metric === 'resistance' ? text.easy : text.low}</span><span>{metric === 'resistance' ? text.hard : text.high}</span></div></div>)}
        </fieldset>;
      })}
      {!habits.length && <p className="insight-empty muted">{text.empty}</p>}
      <label className="field review-note"><span>{text.note}</span><textarea className="input" value={note} maxLength={4000} rows={3} onChange={event => setNote(event.target.value)} placeholder={text.optional}/></label>
      <div className="review-save"><button className="primary-button" type="submit"><Check size={18}/>{previous ? text.saved : text.save}</button></div>
    </form>
  </div>;
}

export default DailyReview;
