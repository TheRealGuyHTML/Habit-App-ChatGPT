import { useState } from 'react';
import { Check, ChevronDown, Clock3, Sparkles } from 'lucide-react';
import type { Day, Habit, HabitConfig, HabitKind, Locale, Schedule } from '../domain/types';
import { configFromTemplate, templates } from '../domain';
import { t } from '../i18n';

export function HabitEditor({ habit, today, locale, onSave, onCancel }: { habit?: Habit; today: Day; locale: Locale; onSave: (config: HabitConfig) => void; onCancel: () => void }) {
  const de = locale === 'de';
  const [config, setConfig] = useState<HabitConfig>(habit ?? {
    name: '', emoji: '✨', kind: 'check', area: 'growth', negative: false, difficulty: 'easy',
    schedule: { type: 'daily' }, special: false, target: 1, unit: 'minutes', subtasks: [], reminder: '', color: '#a78bfa',
  });
  const [subtaskText, setSubtaskText] = useState(config.subtasks.join('\n'));
  const [error, setError] = useState('');
  function patch(value: Partial<HabitConfig>) { setConfig(current => ({ ...current, ...value })); }
  function schedule(type: Schedule['type']) {
    patch({ schedule: type === 'daily' ? { type } : type === 'once' ? { type, date: today } : type === 'weekdays' ? { type, days: [1, 2, 3, 4, 5] } : { type, every: 2, anchor: today } });
  }
  const kinds: { id: HabitKind; de: string; en: string }[] = [
    { id: 'check', de: 'Einfaches Habit', en: 'Simple habit' }, { id: 'water', de: 'Wasser', en: 'Water' }, { id: 'sleep', de: 'Schlaf', en: 'Sleep' },
    { id: 'steps', de: 'Schritte', en: 'Steps' }, { id: 'checklist', de: 'Vitamine / Medikamente', en: 'Vitamins / medication' }, { id: 'produce', de: 'Obst & Gemüse', en: 'Fruit & vegetables' },
    { id: 'reading', de: 'Lesen / Lernen', en: 'Reading / learning' }, { id: 'screen', de: 'Bildschirmzeit', en: 'Screen time' }, { id: 'language', de: 'Sprache lernen', en: 'Language learning' },
    { id: 'meditation', de: 'Meditation', en: 'Meditation' }, { id: 'journal', de: 'Journaling', en: 'Journaling' }, { id: 'running', de: 'Laufen / Joggen', en: 'Running / jogging' }, { id: 'training', de: 'Training', en: 'Workout' },
  ];
  function changeKind(kind: HabitKind) {
    const template = templates.find(item => item.kind === kind);
    if (template) {
      const defaults = configFromTemplate(template, locale, today);
      patch({ kind, target: defaults.target, unit: defaults.unit, subtasks: defaults.subtasks, negative: defaults.negative });
      setSubtaskText(defaults.subtasks.join('\n'));
    } else patch({ kind, special: false, negative: false });
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!config.name.trim() || !config.emoji.trim()) { setError(de ? 'Bitte gib einen Namen und ein Emoji ein.' : 'Please enter a name and an emoji.'); return; }
    if (config.schedule.type === 'weekdays' && config.schedule.days.length === 0) { setError(de ? 'Wähle mindestens einen Wochentag.' : 'Choose at least one weekday.'); return; }
    const subtasks = [...new Set(subtaskText.split('\n').map(item => item.trim()).filter(Boolean))];
    if (subtasks.length > 50 || subtasks.some(task => task.length > 140)) { setError(de ? 'Maximal 50 Unterpunkte mit jeweils höchstens 140 Zeichen.' : 'Use up to 50 checklist items with at most 140 characters each.'); return; }
    if (config.special && config.kind === 'checklist' && !subtasks.length) { setError(de ? 'Füge mindestens einen Unterpunkt hinzu.' : 'Add at least one checklist item.'); return; }
    if (config.special && config.target <= 0) { setError(de ? 'Das Ziel muss größer als null sein.' : 'The target must be greater than zero.'); return; }
    onSave({ ...config, name: config.name.trim(), emoji: config.emoji.trim(), subtasks });
  }
  return <form onSubmit={submit} className="editor-form">
    <span className="eyebrow"><Sparkles size={14} /> {de ? 'EIN KLEINER ANFANG' : 'A SMALL BEGINNING'}</span><h2>{t(locale, habit ? 'editHabit' : 'addHabit')}</h2>
    <p className="muted">{de ? 'Mach es zu deiner Gewohnheit. Ganz in deinem Tempo.' : 'Make it your habit. At your own pace.'}</p>
    {!habit && <details className="template-picker" open><summary>{de ? 'Mit einer Vorlage starten' : 'Start with a template'}<ChevronDown size={16} /></summary><div className="template-list">{templates.map(template => <button type="button" key={template.id} className={config.kind === template.kind && config.name === template.name[locale] ? 'selected' : ''} onClick={() => { const c = configFromTemplate(template, locale, today); setConfig(c); setSubtaskText(c.subtasks.join('\n')); }}><span>{template.emoji}</span>{template.name[locale]}</button>)}</div></details>}
    <div className="name-row"><label className="field emoji-field">Emoji<input className="input" value={config.emoji} onChange={e => patch({ emoji: e.target.value })} maxLength={16} required aria-label="Emoji" /></label><label className="field grow">{de ? 'Name' : 'Name'}<input className="input" value={config.name} onChange={e => patch({ name: e.target.value })} placeholder={de ? 'Was möchtest du dir Gutes tun?' : 'What would feel good?'} maxLength={80} required autoFocus={Boolean(habit)} /></label></div>
    <div className="form-grid"><label className="field">{de ? 'Habit-Typ' : 'Tracker type'}<select className="input" value={config.kind} onChange={e => changeKind(e.target.value as HabitKind)}>{kinds.map(kind => <option key={kind.id} value={kind.id}>{de ? kind.de : kind.en}</option>)}</select></label><label className="field">{de ? 'Lebensbereich' : 'Life area'}<select className="input" value={config.area} onChange={e => patch({ area: e.target.value as HabitConfig['area'] })}><option value="health">{de ? 'Gesundheit' : 'Health'}</option><option value="movement">{de ? 'Bewegung' : 'Movement'}</option><option value="mind">{de ? 'Wohlbefinden' : 'Wellbeing'}</option><option value="growth">{de ? 'Wachstum' : 'Growth'}</option><option value="social">{de ? 'Verbindungen' : 'Connection'}</option></select></label></div>
    <label className="switch-row"><span><b>{t(locale, 'negative')}</b><small>{de ? 'Erfolg bedeutet: Du hast widerstanden.' : 'Success means you resisted the habit.'}</small></span><input type="checkbox" role="switch" checked={config.negative} onChange={e => patch({ negative: e.target.checked, special: e.target.checked && config.kind !== 'screen' ? false : config.special })} disabled={config.special && !['check', 'screen'].includes(config.kind)} /></label>
    {config.kind !== 'check' && <label className="switch-row"><span><b>{de ? 'Spezial-Tracker aktivieren' : 'Enable special tracker'}</b><small>{de ? 'Zähler, Timer und Eingaben direkt auf der Karte.' : 'Counters, timers and controls on the card.'}</small></span><input type="checkbox" role="switch" checked={config.special} onChange={e => patch({ special: e.target.checked, negative: config.kind === 'screen' ? true : e.target.checked ? false : config.negative })} /></label>}
    {config.special && <div className="config-box">
      {!['journal', 'checklist'].includes(config.kind) && <div className="form-grid"><label className="field">{config.kind === 'screen' ? (de ? 'Tägliches Maximum' : 'Daily maximum') : (de ? 'Dein Ziel' : 'Your target')}<input className="input" type="number" min={config.kind === 'sleep' || config.kind === 'running' ? 0.1 : 1} max={config.kind === 'sleep' ? 24 : 1000000} step="any" value={config.target} onChange={e => patch({ target: Number(e.target.value) })} required /></label><label className="field">{de ? 'Einheit' : 'Unit'}{config.kind === 'reading' ? <select className="input" value={config.unit} onChange={e => patch({ unit: e.target.value as HabitConfig['unit'] })}><option value="pages">{de ? 'Seiten' : 'Pages'}</option><option value="minutes">{de ? 'Minuten' : 'Minutes'}</option></select> : <input className="input" readOnly value={({ ml: 'ml', hours: de ? 'Stunden' : 'Hours', steps: de ? 'Schritte' : 'Steps', portions: de ? 'Portionen' : 'Portions', minutes: de ? 'Minuten' : 'Minutes', pages: de ? 'Seiten' : 'Pages', km: 'km' })[config.unit]} />}</label></div>}
      {config.kind === 'checklist' && <label className="field">{de ? 'Unterpunkte (ein Eintrag pro Zeile)' : 'Checklist (one item per line)'}<textarea className="input" rows={4} maxLength={3000} value={subtaskText} onChange={e => setSubtaskText(e.target.value)} placeholder={'Vitamin D\nMagnesium'} /></label>}
      {config.kind === 'journal' && <p className="muted">{de ? 'Beim Eintragen wählst du eine Stimmung. Ein kurzer Text ist optional.' : 'Choose a mood when checking in. A short note is optional.'}</p>}
    </div>}
    <fieldset><legend>{de ? 'Wiederholung' : 'Repeat'}</legend><div className="schedule-options">{(['daily', 'weekdays', 'interval', 'once'] as const).map(type => <button type="button" key={type} className={config.schedule.type === type ? 'selected' : ''} aria-pressed={config.schedule.type === type} onClick={() => schedule(type)}>{({ daily: de ? 'Täglich' : 'Daily', weekdays: de ? 'Wochentage' : 'Weekdays', interval: de ? 'Intervall' : 'Interval', once: de ? 'Einmalig' : 'Once' })[type]}</button>)}</div>
      {config.schedule.type === 'weekdays' && <div className="weekday-picker">{(de ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']).map((label, day) => <button type="button" aria-pressed={config.schedule.type === 'weekdays' && config.schedule.days.includes(day)} className={config.schedule.type === 'weekdays' && config.schedule.days.includes(day) ? 'selected' : ''} key={day} onClick={() => { const days = config.schedule.type === 'weekdays' ? config.schedule.days : []; patch({ schedule: { type: 'weekdays', days: days.includes(day) ? days.filter(d => d !== day) : [...days, day] } }); }}>{label}</button>)}</div>}
      {config.schedule.type === 'interval' && <div className="form-grid"><label className="field">{de ? 'Alle … Tage' : 'Every … days'}<select className="input" value={config.schedule.every} onChange={e => patch({ schedule: { type: 'interval', every: Number(e.target.value), anchor: config.schedule.type === 'interval' ? config.schedule.anchor : today } })}>{[2, 3, 4, 7, 30].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="field">{de ? 'Ab dem' : 'Starting on'}<input className="input" type="date" value={config.schedule.anchor} min={habit?.createdDay ?? today} max="2200-12-31" onChange={e => patch({ schedule: { type: 'interval', every: config.schedule.type === 'interval' ? config.schedule.every : 2, anchor: e.target.value } })} required /></label></div>}
      {config.schedule.type === 'once' && <label className="field">{de ? 'Am Datum' : 'On date'}<input className="input" type="date" min={today} max="2200-12-31" value={config.schedule.date} onChange={e => patch({ schedule: { type: 'once', date: e.target.value } })} required /></label>}
    </fieldset>
    <fieldset><legend>{de ? 'Wie anspruchsvoll ist es für dich?' : 'How challenging does it feel?'}</legend><div className="difficulty-picker">{(['easy', 'medium', 'complex'] as const).map((difficulty, i) => <button type="button" className={config.difficulty === difficulty ? 'selected' : ''} aria-pressed={config.difficulty === difficulty} key={difficulty} onClick={() => patch({ difficulty })}><b>{(de ? ['Leicht', 'Mittel', 'Komplex'] : ['Easy', 'Medium', 'Complex'])[i]}</b><small>{[10, 25, 50][i]} XP</small></button>)}</div></fieldset>
    <label className="switch-row"><span><b><Clock3 size={15} /> {de ? 'Persönliche Erinnerung' : 'Personal reminder'}</b><small>{de ? 'Push benötigt einen verbundenen Account und Server.' : 'Push requires a connected account and server.'}</small></span><input type="checkbox" role="switch" checked={Boolean(config.reminder)} onChange={e => patch({ reminder: e.target.checked ? '09:00' : '' })} /></label>
    {config.reminder && <label className="field">{de ? 'Erinnere mich um' : 'Remind me at'}<input className="input" type="time" value={config.reminder} onChange={e => patch({ reminder: e.target.value })} required /></label>}
    <fieldset><legend>{de ? 'Deine Farbe' : 'Your colour'}</legend><div className="color-picker">{['#a78bfa', '#4ade80', '#f472b6', '#fb923c', '#60a5fa'].map((color, index) => <button type="button" key={color} className={`swatch tone-${['lavender', 'sage', 'rose', 'peach', 'blue'][index]}`} aria-label={color} aria-pressed={config.color === color} onClick={() => patch({ color })}>{config.color === color && <Check size={17} />}</button>)}</div></fieldset>
    {habit && <p className="form-note">{de ? 'Änderungen gelten ab heute. Vergangene Pläne und Einträge bleiben erhalten.' : 'Changes apply from today. Past schedules and entries are preserved.'}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>{t(locale, 'cancel')}</button><button type="submit" className="primary-button"><Check size={17} />{t(locale, 'save')}</button></div>
  </form>;
}
