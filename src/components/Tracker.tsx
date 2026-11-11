import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Clock3, Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { localDay } from '../domain/dates';
import type { Day, Entry, Habit, Locale } from '../domain/types';
import { finalizeTimerPatch, formatTimer, timerElapsedAt } from './trackers/timer';
import './Tracker.css';

export interface TrackerProps {
  habit: Habit;
  entry: Entry;
  day: Day;
  today: Day;
  locale: Locale;
  onChange: (patch: Partial<Entry>) => void;
}

const text = (locale: Locale, de: string, en: string) => locale === 'de' ? de : en;
const number = (value: number, locale: Locale, digits = 1) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
const bounded = (value: number, maximum = 1_000_000) => Number.isFinite(value) ? Math.max(0, Math.min(maximum, value)) : 0;

function Meter({ value, target, label, inverted = false }: { value: number; target: number; label: string; inverted?: boolean }) {
  const ratio = target > 0 ? Math.min(100, Math.max(0, value / target * 100)) : 0;
  const reached = inverted ? value <= target : value >= target;
  return <div className={`tracker-meter ${reached ? 'is-reached' : ''}`}>
    <div className="tracker-meter-label"><span>{label}</span><span>{Math.round(ratio)}%</span></div>
    <div className="progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio)}>
      <div className="progress-fill" style={{ width: `${ratio}%` }} />
    </div>
  </div>;
}

function Counter({ value, step, unit, locale, onValue, extraStep }: { value: number; step: number; unit: string; locale: Locale; onValue: (value: number) => void; extraStep?: number }) {
  return <div className="tracker-row tracker-counter">
    <button type="button" className="mini-button" aria-label={text(locale, `${step} ${unit} weniger`, `Subtract ${step} ${unit}`)} disabled={value <= 0} onClick={() => onValue(Number(Math.max(0, value - step).toFixed(2)))}><Minus size={16} /></button>
    <span className="tracker-count"><strong>{number(value, locale, 2)}</strong><span>{unit}</span></span>
    <button type="button" className="mini-button" aria-label={text(locale, `${step} ${unit} hinzufügen`, `Add ${step} ${unit}`)} onClick={() => onValue(Number((value + step).toFixed(2)))}><Plus size={16} /></button>
    {extraStep && <button type="button" className="mini-button tracker-extra" onClick={() => onValue(Number((value + extraStep).toFixed(2)))}>+{extraStep} {unit}</button>}
  </div>;
}

function Timer({ habit, entry, day, today, locale, onChange, stopwatch = false }: TrackerProps & { stopwatch?: boolean }) {
  const [now, setNow] = useState(Date.now);
  const commandRef = useRef('');
  const latestChange = useRef(onChange);
  useEffect(() => { latestChange.current = onChange; }, [onChange]);
  const running = entry.timerStartedAt !== null;
  const goalMs = Math.max(0.01, habit.target) * 60_000;
  const elapsed = timerElapsedAt(entry, now);
  const remaining = Math.max(0, goalMs - elapsed);
  const canStart = day === today && localDay(new Date(now), entry.timeZone) === day;

  useEffect(() => { setNow(Date.now()); }, [day, today]);

  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 500);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, [running]);

  useEffect(() => {
    if (!running) { commandRef.current = ''; return; }
    const patch = finalizeTimerPatch(habit, entry, now);
    if (!patch) return;
    const command = `${entry.habitId}:${day}:${entry.timerStartedAt}:${entry.timerElapsed}`;
    if (commandRef.current === command) return;
    commandRef.current = command;
    latestChange.current(patch);
  }, [running, now, habit, entry, day]);

  const pause = () => {
    const total = timerElapsedAt(entry, Date.now());
    onChange({ timerElapsed: total, timerStartedAt: null, ...(!stopwatch ? { value: total / 60_000, completed: total >= goalMs } : {}) });
  };
  const start = () => {
    if (!canStart) return;
    setNow(Date.now());
    const restarting = !stopwatch && elapsed >= goalMs;
    onChange({ timerStartedAt: Date.now(), ...(restarting ? { timerElapsed: 0, value: 0, completed: false } : {}) });
  };
  const manualMinutes = (value: number) => {
    const minutes = bounded(value, 1440);
    onChange({ value: minutes, timerElapsed: minutes * 60_000, timerStartedAt: null, completed: minutes >= habit.target });
  };
  const timeId = useId();
  return <div className="tracker-timer">
    <div className="tracker-row">
      <Clock3 size={15} aria-hidden="true" /><span className="tracker-clock" aria-label={text(locale, 'Timer', 'Timer')}>{formatTimer(stopwatch ? elapsed : remaining)}</span>
      <span className="muted tracker-timer-mode">{text(locale, stopwatch ? 'Stoppuhr' : 'verbleibend', stopwatch ? 'Stopwatch' : 'remaining')}</span>
      <button type="button" className={`mini-button ${running ? '' : 'tracker-start'}`} disabled={!running && !canStart} onClick={running ? pause : start} aria-label={text(locale, running ? 'Timer pausieren' : 'Timer starten', running ? 'Pause timer' : 'Start timer')}>{running ? <Pause size={16} /> : <Play size={16} />}</button>
      <button type="button" className="mini-button" disabled={elapsed <= 0 && !running} onClick={() => onChange({ timerElapsed: 0, timerStartedAt: null, ...(!stopwatch ? { value: 0, completed: false } : {}) })} aria-label={text(locale, 'Timer zurücksetzen', 'Reset timer')}><RotateCcw size={14} /></button>
    </div>
    {!stopwatch && <>
      <Meter value={elapsed / 60_000} target={habit.target} label={`${number(Math.min(elapsed / 60_000, habit.target), locale)} / ${number(habit.target, locale)} min`} />
      <details className="tracker-details"><summary>{text(locale, 'Minuten manuell erfassen', 'Enter minutes manually')}</summary><label className="field" htmlFor={timeId}>{text(locale, 'Minuten', 'Minutes')}<input id={timeId} className="input" type="number" inputMode="decimal" min="0" max="1440" step="0.5" value={entry.value || ''} placeholder="0" onChange={event => manualMinutes(Number(event.target.value))} /></label></details>
    </>}
    {!canStart && !running && <small className="muted">{text(locale, 'Timer starten nur am heutigen Tag. Werte können nachgetragen werden.', 'Start timers on today’s date. You can still enter past values.')}</small>}
  </div>;
}

function Checklist({ habit, entry, locale, onChange }: TrackerProps) {
  const [open, setOpen] = useState(false);
  const checked = habit.subtasks.filter(task => entry.checked.includes(task));
  const toggleTask = (task: string) => {
    const next = checked.includes(task) ? checked.filter(value => value !== task) : [...checked, task];
    onChange({ checked: next, completed: habit.subtasks.length > 0 && habit.subtasks.every(item => next.includes(item)) });
  };
  return <div className="tracker-checklist">
    <button type="button" className="tracker-disclosure" onClick={() => setOpen(!open)} aria-expanded={open}>
      <span>{text(locale, 'Unteraufgaben', 'Subtasks')}</span><span>{checked.length}/{habit.subtasks.length} <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : undefined }} /></span>
    </button>
    <Meter value={checked.length} target={habit.subtasks.length} label={text(locale, `${checked.length} von ${habit.subtasks.length} erledigt`, `${checked.length} of ${habit.subtasks.length} complete`)} />
    {open && <div className="tracker-subtasks">{habit.subtasks.length ? habit.subtasks.map((task, index) => <button key={`${index}:${task}`} type="button" role="checkbox" aria-checked={checked.includes(task)} className={`tracker-subtask ${checked.includes(task) ? 'is-checked' : ''}`} onClick={() => toggleTask(task)}><span className="tracker-small-check">{checked.includes(task) && <Check size={13} />}</span>{task}</button>) : <p className="muted">{text(locale, 'Ergänze Unteraufgaben in den Habit-Einstellungen.', 'Add subtasks in this habit’s settings.')}</p>}</div>}
  </div>;
}

function ReadingPages({ habit, entry, locale, onChange }: TrackerProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const id = useId();
  const invalid = from !== '' && to !== '' && Number(to) < Number(from);
  const update = (start: string, end: string) => {
    setFrom(start); setTo(end);
    if (start !== '' && end !== '' && Number(end) >= Number(start)) {
      const value = bounded(Number(end) - Number(start));
      onChange({ value, completed: value >= habit.target });
    }
  };
  return <>
    <div className="tracker-range">
      <label className="field" htmlFor={`${id}-from`}>{text(locale, 'Von Seite', 'From page')}<input id={`${id}-from`} className="input" type="number" inputMode="numeric" min="0" max="1000000" value={from} placeholder="45" onChange={event => update(event.target.value, to)} /></label>
      <span aria-hidden="true">→</span>
      <label className="field" htmlFor={`${id}-to`}>{text(locale, 'Bis Seite', 'To page')}<input id={`${id}-to`} className="input" type="number" inputMode="numeric" min="0" max="1000000" value={to} placeholder="65" aria-invalid={invalid} onChange={event => update(from, event.target.value)} /></label>
    </div>
    {invalid && <small className="tracker-error" role="status">{text(locale, 'Die letzte Seite muss nach der ersten liegen.', 'The last page must come after the first.')}</small>}
    <Meter value={entry.value} target={habit.target} label={`${number(entry.value, locale, 0)} / ${number(habit.target, locale, 0)} ${text(locale, 'Seiten', 'pages')}`} />
    <label className="tracker-direct-value" htmlFor={`${id}-pages`}>{text(locale, 'Seiten direkt erfassen', 'Enter page count')}<input id={`${id}-pages`} className="input" type="number" inputMode="numeric" min="0" max="1000000" step="1" value={entry.value || ''} placeholder="0" onChange={event => { const value = Math.floor(bounded(Number(event.target.value))); onChange({ value, completed: value >= habit.target }); }} /></label>
  </>;
}

function Journal({ entry, locale, onChange }: TrackerProps) {
  const id = useId();
  return <div className="tracker-journal">
    <p className="tracker-prompt">{text(locale, 'Wie fühlst du dich heute?', 'How do you feel today?')}</p>
    <div className="tracker-moods" role="group" aria-label={text(locale, 'Tagesstimmung', 'Daily mood')}>
      {['😔', '🙁', '😐', '🙂', '🤩'].map((mood, index) => <button key={mood} type="button" className={`tracker-mood ${entry.mood === mood ? 'is-selected' : ''}`} aria-pressed={entry.mood === mood} aria-label={text(locale, ['Sehr schlecht', 'Eher schlecht', 'Neutral', 'Gut', 'Sehr gut'][index], ['Very bad', 'Bad', 'Neutral', 'Good', 'Great'][index])} onClick={() => onChange({ mood, completed: true })}>{mood}</button>)}
    </div>
    {entry.mood && <label className="field" htmlFor={id}>{text(locale, 'Dein Highlight oder ein dankbarer Gedanke (optional)', 'A highlight or grateful thought (optional)')}<textarea id={id} className="input tracker-note" rows={2} maxLength={2000} value={entry.note} placeholder={text(locale, 'Heute war ich dankbar für …', 'Today I was grateful for …')} onChange={event => onChange({ note: event.target.value })} /></label>}
  </div>;
}

export function Tracker(props: TrackerProps) {
  const { habit, entry, locale, onChange } = props;
  const id = useId();
  if (!habit.special || habit.kind === 'check') return null;
  const valueChange = (raw: number) => {
    const value = bounded(raw);
    onChange({ value, completed: habit.kind === 'screen' ? value <= habit.target : value >= habit.target });
  };
  const goal = (unit: string) => <Meter value={entry.value} target={habit.target} label={`${number(entry.value, locale, 2)} / ${number(habit.target, locale, 2)} ${unit}`} />;
  let content;
  switch (habit.kind) {
    case 'water': content = <><Counter value={entry.value} step={100} unit="ml" locale={locale} onValue={valueChange} />{goal('ml')}</>; break;
    case 'produce': content = <><Counter value={entry.value} step={1} unit={text(locale, 'Portionen', 'portions')} locale={locale} onValue={valueChange} />{goal(text(locale, 'Portionen', 'portions'))}</>; break;
    case 'sleep': content = <><div className="tracker-row"><label className="field tracker-sleep-field" htmlFor={id}>{text(locale, 'Schlafdauer', 'Sleep duration')}<select className="input tracker-sleep-wheel" id={id} value={entry.value} onChange={event => valueChange(Number(event.target.value))}>{Array.from({ length: 49 }, (_, index) => index * 0.5).map(hours => <option value={hours} key={hours}>{number(hours, locale)} {text(locale, 'Stunden', 'hours')}</option>)}</select></label><span className="tracker-sleep-icon" aria-hidden="true">☾</span></div>{goal(text(locale, 'Stunden', 'hours'))}</>; break;
    case 'steps': content = <><label className="tracker-direct-value" htmlFor={id}>{text(locale, 'Heutige Schritte', 'Today’s steps')}<input className="input" id={id} type="number" inputMode="numeric" min="0" max="1000000" step="1" value={entry.value || ''} placeholder="0" onChange={event => valueChange(Math.floor(Number(event.target.value)))} /></label>{goal(text(locale, 'Schritte', 'steps'))}<small className="muted">{text(locale, 'Manuelle Eingabe · kein Zugriff auf Apple Health', 'Manual entry · no Apple Health access')}</small></>; break;
    case 'checklist': content = <Checklist {...props} />; break;
    case 'reading': content = habit.unit === 'pages' ? <ReadingPages {...props} /> : <Timer {...props} />; break;
    case 'screen': { const hours = habit.unit === 'hours'; const unit = hours ? text(locale, 'Stunden', 'hours') : text(locale, 'Minuten', 'minutes'); content = <><label className="tracker-direct-value" htmlFor={id}>{text(locale, `Bildschirmzeit in ${unit}`, `Screen time in ${unit}`)}<input id={id} className="input" type="number" inputMode={hours ? 'decimal' : 'numeric'} min="0" max={hours ? 24 : 1440} step={hours ? 0.25 : 1} placeholder={text(locale, 'Zeit erfassen', 'Enter time')} value={entry.value || ''} onChange={event => { const value = bounded(Number(event.target.value), hours ? 24 : 1440); onChange({ value, completed: value <= habit.target }); }} /></label><Meter value={entry.value} target={habit.target} inverted label={`${number(entry.value, locale)} / ${number(habit.target, locale)} ${hours ? 'h' : 'min'} ${text(locale, 'Limit', 'limit')}`} /><small className={entry.value > habit.target ? 'tracker-error' : 'muted'}>{entry.value > habit.target ? text(locale, 'Limit heute überschritten', 'Today’s limit exceeded') : text(locale, 'Innerhalb deines Limits. Die Tagesbewertung erfolgt nach Tagesende.', 'Within your limit. Your day is evaluated after it ends.')}</small><button type="button" className="tracker-zero" onClick={() => onChange({ value: 0, completed: true })}>{text(locale, '0 Minuten bestätigen', 'Confirm 0 minutes')}</button><small className="muted">{text(locale, 'Manuelle Eingabe · iOS erlaubt keinen Zugriff auf die System-Bildschirmzeit.', 'Manual entry · iOS does not expose system Screen Time to web apps.')}</small></>; break; }
    case 'language': case 'meditation': case 'training': content = <Timer {...props} />; break;
    case 'journal': content = <Journal {...props} />; break;
    case 'running': content = <><Counter value={entry.value} step={0.1} extraStep={1} unit="km" locale={locale} onValue={valueChange} />{goal('km')}<Timer {...props} stopwatch /><small className="muted">{text(locale, 'Distanz manuell erfassen · kein GPS-Tracking', 'Enter distance manually · no GPS tracking')}</small></>; break;
  }
  return <div className={`tracker tracker-${habit.kind}`} onPointerDown={event => event.stopPropagation()}>{content}</div>;
}
