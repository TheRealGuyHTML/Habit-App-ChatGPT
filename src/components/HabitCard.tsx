import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { Check, Flame, MoreHorizontal, ShieldCheck } from 'lucide-react';
import type { Day, Entry, Habit, Locale } from '../domain/types';
import { computeHabitStats, configForDay, createEntry, isComplete } from '../domain';
import { difficultyXP } from '../domain/gamification';
import { t } from '../i18n';
import { Tracker } from './Tracker';
import { CompactTracker } from './CompactTracker';
import { Modal } from './Modal';
import { useCallback } from 'react';

export function HabitCard({ habit, entry, entries, day, today, timeZone, locale, onChange, onToggle, onEdit, onMenu }: {
  habit: Habit; entry?: Entry; entries: Record<string, Entry>; day: Day; today: Day; timeZone: string; locale: Locale;
  onChange: (patch: Partial<Entry>) => void; onToggle: () => void; onEdit: () => void; onMenu: () => void;
}) {
  const config = configForDay(habit, day);
  const done = isComplete(habit, entry, day, today);
  const { currentStreak } = computeHabitStats(habit, entries, today);
  const [expanded, setExpanded] = useState(false);
  const closeTracker = useCallback(() => setExpanded(false), []);
  const [drag, setDrag] = useState(0);
  const pointer = useRef<{ x: number; y: number; id: number; held: boolean; timer: ReturnType<typeof setTimeout> } | null>(null);
  useEffect(() => () => { if (pointer.current) clearTimeout(pointer.current.timer); }, []);
  const interactive = (target: EventTarget) => target instanceof Element && Boolean(target.closest('button,input,select,textarea,a,summary'));
  function down(event: PointerEvent<HTMLElement>) {
    if (interactive(event.target) || !event.isPrimary) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const timer = setTimeout(() => { if (pointer.current) pointer.current.held = true; setDrag(0); onMenu(); }, 550);
    pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId, held: false, timer };
  }
  function move(event: PointerEvent<HTMLElement>) {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(p.timer);
    if (Math.abs(dx) > Math.abs(dy) * 1.5) setDrag(Math.max(-90, Math.min(90, dx)));
  }
  function up(event: PointerEvent<HTMLElement>) {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    clearTimeout(p.timer);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    if (!p.held && Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx > 0 && day <= today && !done) onToggle(); else if (dx < 0) onEdit(); }
    pointer.current = null; setDrag(0);
  }
  const base = { ...createEntry(habit.id, day, timeZone), completed: config.negative, ...entry };
  return <article className={`habit-card ${done ? 'habit-done' : ''} ${config.special ? 'habit-with-tracker' : ''}`} style={{ '--habit-color': config.color, transform: drag ? `translateX(${drag * 0.35}px)` : undefined } as CSSProperties} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={event => { if (pointer.current) clearTimeout(pointer.current.timer); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); pointer.current = null; setDrag(0); }}>
    <div className="habit-card-top"><span className="habit-emoji" aria-hidden="true">{config.emoji}</span><div className="habit-copy"><h3>{config.name}</h3><div className="habit-meta">{currentStreak > 0 && <span><Flame size={12} /> {currentStreak} {t(locale, 'day')}{currentStreak > 1 && locale === 'en' ? 's' : locale === 'de' && currentStreak > 1 ? 'e' : ''}</span>}<span className="habit-xp">+{difficultyXP[config.difficulty]} XP</span>{config.negative && <span><ShieldCheck size={12} />{locale === 'de' ? 'Widerstehen' : 'Resist'}</span>}</div></div><button className="icon-button habit-menu" aria-label={`${t(locale, 'actions')}: ${config.name}`} onClick={onMenu}><MoreHorizontal size={20} /></button><button className={`habit-check ${done ? 'checked' : ''}`} aria-label={`${config.name}: ${done ? (locale === 'de' ? 'Erledigung zurücknehmen' : 'Undo completion') : (locale === 'de' ? 'Als erledigt markieren' : 'Mark complete')}`} aria-pressed={done} disabled={day > today} onClick={onToggle}>{done && <Check size={19} strokeWidth={2.5} />}</button></div>
    {config.special && <fieldset className="tracker-fieldset" disabled={day > today}><legend className="sr-only">{config.name}</legend><CompactTracker habit={{ ...habit, ...config }} entry={base} day={day} today={today} locale={locale} onChange={onChange} onExpand={() => setExpanded(true)} /></fieldset>}
    {expanded && <Modal label={config.name} onClose={closeTracker}><h2>{config.emoji} {config.name}</h2><fieldset className="tracker-fieldset" disabled={day > today}><Tracker habit={{ ...habit, ...config }} entry={base} day={day} today={today} locale={locale} onChange={onChange}/></fieldset><button className="primary-button full-width" style={{ marginTop: 20 }} onClick={closeTracker}>{locale === 'de' ? 'Fertig' : 'Done'}</button></Modal>}
    {config.negative && day === today && <p className="negative-note" title={t(locale, 'negativeHint')}>{t(locale, 'negativeHint')}</p>}
  </article>;
}
