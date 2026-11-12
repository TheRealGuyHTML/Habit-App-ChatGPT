import { useEffect, useState } from 'react';
import { ChevronRight, Minus, Pause, Play, Plus } from 'lucide-react';
import { localDay } from '../domain/dates';
import type { TrackerProps } from './Tracker';
import { formatTimer, timerElapsedAt } from './trackers/timer';

export function CompactTracker({ habit, entry, day, today, locale, onChange, onExpand }: TrackerProps & { onExpand: () => void }) {
  const de = locale === 'de';
  const [now, setNow] = useState(Date.now);
  const running = entry.timerStartedAt !== null;
  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 500);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [running]);
  const isTimer = ['meditation', 'language', 'training', 'running'].includes(habit.kind) || (habit.kind === 'reading' && habit.unit === 'minutes');
  const counter = habit.kind === 'water' || habit.kind === 'produce';
  const step = habit.kind === 'water' ? 100 : 1;
  const unit = ({ ml: 'ml', hours: de ? 'Std.' : 'h', steps: de ? 'Schritte' : 'steps', portions: de ? 'Portionen' : 'portions', minutes: 'min', pages: de ? 'Seiten' : 'pages', km: 'km' })[habit.unit];
  const value = (v: number) => v.toLocaleString(de ? 'de-DE' : 'en-GB', { maximumFractionDigits: 1 });
  const summary = habit.kind === 'checklist' ? `${entry.checked.filter(item => habit.subtasks.includes(item)).length}/${habit.subtasks.length} ${de ? 'Unteraufgaben' : 'subtasks'}` : habit.kind === 'journal' ? (entry.mood || (de ? 'Wie war dein Tag?' : 'How was your day?')) : `${value(entry.value)} / ${value(habit.target)} ${unit}`;
  const elapsed = timerElapsedAt(entry, now);
  const canStart = day === today && localDay(new Date(now), entry.timeZone) === day;
  const toggleTimer = () => {
    if (!running && !canStart) return;
    const ms = timerElapsedAt(entry, Date.now());
    if (running) onChange({ timerStartedAt: null, timerElapsed: ms, ...(habit.kind !== 'running' ? { value: ms / 60000, completed: ms >= habit.target * 60000 } : {}) });
    else onChange({ timerStartedAt: Date.now(), ...(habit.kind !== 'running' && ms >= habit.target * 60000 ? { timerElapsed: 0, value: 0, completed: false } : {}) });
  };
  return <div className="tracker compact-tracker" onPointerDown={event => event.stopPropagation()}>
    {counter && <><button className="mini-button" disabled={entry.value === 0} aria-label={de ? `${step} ${unit} weniger` : `Subtract ${step} ${unit}`} onClick={() => { const next = Math.max(0, entry.value - step); onChange({ value: next, completed: next >= habit.target }); }}><Minus size={16}/></button><span className="tracker-count"><strong>{value(entry.value)}</strong> {unit}</span><button className="mini-button" aria-label={de ? `${step} ${unit} hinzufügen` : `Add ${step} ${unit}`} onClick={() => { const next = entry.value + step; onChange({ value: next, completed: next >= habit.target }); }}><Plus size={16}/></button></>}
    {isTimer && <><span className="compact-clock">{formatTimer(habit.kind === 'running' ? elapsed : Math.max(0, habit.target * 60000 - elapsed))}</span><button className="mini-button" disabled={!running && !canStart} onClick={toggleTimer} aria-label={de ? (running ? 'Timer pausieren' : 'Timer starten') : (running ? 'Pause timer' : 'Start timer')}>{running ? <Pause size={16}/> : <Play size={16}/>}</button></>}
    <button className="compact-tracker-open" onClick={onExpand} aria-label={de ? `Tracker öffnen: ${habit.name}` : `Open tracker: ${habit.name}`}><span>{summary}</span><ChevronRight size={16}/></button>
  </div>;
}
