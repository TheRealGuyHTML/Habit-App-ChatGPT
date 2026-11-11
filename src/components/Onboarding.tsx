import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Sparkles, Sprout } from 'lucide-react';
import type { AppState, Area, HabitTemplate, Locale } from '../domain/types';
import { configFromTemplate, createHabit, createInitialState, templates } from '../domain';
import { Flower } from './Flower';

const areas: { id: Area; emoji: string; de: string; en: string; descDe: string; descEn: string }[] = [
  { id: 'health', emoji: '🌿', de: 'Gesundheit', en: 'Health', descDe: 'Gut für deinen Körper', descEn: 'Care for your body' },
  { id: 'movement', emoji: '👟', de: 'Bewegung', en: 'Movement', descDe: 'Mehr Energie im Alltag', descEn: 'Find your daily energy' },
  { id: 'mind', emoji: '🧘', de: 'Wohlbefinden', en: 'Wellbeing', descDe: 'Raum für dich schaffen', descEn: 'Make space for yourself' },
  { id: 'growth', emoji: '📖', de: 'Persönliches Wachstum', en: 'Personal growth', descDe: 'Neugierig bleiben', descEn: 'Stay curious' },
  { id: 'social', emoji: '💌', de: 'Verbindungen', en: 'Connection', descDe: 'Zeit für deine Menschen', descEn: 'Time for your people' },
];
export function Onboarding({ locale, onFinish, onDemo, onLanguage }: { locale: Locale; onFinish: (state: AppState) => void; onDemo: () => void; onLanguage: (locale: Locale) => void }) {
  const [step, setStep] = useState(0);
  const [selectedAreas, setAreas] = useState<Area[]>(['health']);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const de = locale === 'de';
  const suggestions = [...templates].sort((a, b) => Number(selectedAreas.includes(b.area)) - Number(selectedAreas.includes(a.area)));
  function finish() {
    const result = createInitialState(locale);
    result.settings.name = name.trim();
    result.settings.areas = selectedAreas;
    result.onboarded = true;
    selected.forEach(id => { const template = templates.find(item => item.id === id) as HabitTemplate; const habit = createHabit(configFromTemplate(template, locale)); result.habits[habit.id] = habit; });
    onFinish(result);
  }
  return <div className="onboarding">
    <header className="onboarding-header"><a href="#" className="brand" onClick={event => event.preventDefault()}><Flower size={34} /> bloom<span className="brand-dot">.</span></a><button className="text-button" onClick={() => onLanguage(de ? 'en' : 'de')}>{de ? 'English' : 'Deutsch'}</button></header>
    <div className="onboarding-layout">
      <div className="onboarding-story"><span className="eyebrow"><Sparkles size={14} /> {de ? 'KLEINE SCHRITTE. GROSSES WACHSTUM.' : 'SMALL STEPS. BEAUTIFUL GROWTH.'}</span>
        <h1>{de ? <>Werde jeden Tag<br />ein bisschen <em>mehr du.</em></> : <>Grow into a little<br />more <em>you.</em></>}</h1>
        <p>{de ? 'Ein Glas Wasser. Ein ruhiger Moment. Eine Seite mehr. Veränderung beginnt mit den kleinen Dingen.' : 'A glass of water. A quiet moment. One more page. Change begins with the little things.'}</p>
        <div className="onboarding-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-sun" /><svg viewBox="0 0 320 300"><path d="M160 244 C155 190 179 145 160 93" stroke="#6f947a" strokeWidth="7" fill="none" strokeLinecap="round" /><path d="M158 193 C110 200 89 163 99 141 C139 139 163 166 158 193" fill="#a2c5a5" /><path d="M166 161 C209 170 240 131 230 107 C189 108 169 132 166 161" fill="#7ca78d" /><g fill="#e8a2c5">{[0, 60, 120, 180, 240, 300].map(a => <ellipse key={a} cx="159" cy="60" rx="17" ry="35" transform={`rotate(${a} 159 93)`} />)}</g><circle cx="159" cy="93" r="21" fill="#f9dfac" /><path d="M112 223 H208 L194 284 H126 Z" fill="#d8c8be" /><path d="M106 223 Q160 213 214 223 L210 237 H110 Z" fill="#e6d7ce" /></svg><span className="art-note"><Sprout size={16} /> {de ? 'Du wächst in deinem Tempo.' : 'Grow at your own pace.'}</span></div>
        <div className="milestone-strip"><span><b>7</b> {de ? 'Tage · erster Erfolg' : 'days · first milestone'}</span><span><b>21</b> {de ? 'Tage · im Rhythmus' : 'days · finding your flow'}</span><span><b>66</b> {de ? 'Tage · fest verwurzelt' : 'days · deeply rooted'}</span></div>
      </div>
      <section className="glass-card onboarding-card">
        <div className="step-indicator"><span className={step === 0 ? 'selected' : ''} /><span className={step === 1 ? 'selected' : ''} /><small>{step + 1} / 2</small></div>
        {step === 0 ? <>
          <h2>{de ? 'Was möchtest du wachsen lassen?' : 'What would you like to grow?'}</h2><p className="muted">{de ? 'Wähle die Lebensbereiche, die dir gerade wichtig sind.' : 'Choose the areas that matter to you right now.'}</p>
          <label className="field">{de ? 'Wie dürfen wir dich nennen? (optional)' : 'What should we call you? (optional)'}<input className="input" maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder={de ? 'Dein Vorname' : 'Your first name'} autoComplete="given-name" /></label>
          <div className="area-options">{areas.map(area => <button key={area.id} className={`area-option ${selectedAreas.includes(area.id) ? 'selected' : ''}`} aria-pressed={selectedAreas.includes(area.id)} onClick={() => setAreas(current => current.includes(area.id) ? current.filter(id => id !== area.id) : [...current, area.id])}><span className="area-emoji">{area.emoji}</span><span><b>{de ? area.de : area.en}</b><small>{de ? area.descDe : area.descEn}</small></span><span className="option-check">{selectedAreas.includes(area.id) && <Check size={15} />}</span></button>)}</div>
          <button className="primary-button full-width" disabled={selectedAreas.length === 0} onClick={() => setStep(1)}>{de ? 'Meine Empfehlungen' : 'My recommendations'} <ArrowRight size={17} /></button>
        </> : <>
          <button className="text-button back-button" onClick={() => setStep(0)}><ArrowLeft size={14} />{de ? 'Zurück' : 'Back'}</button>
          <h2>{de ? 'Klein anfangen. Dranbleiben.' : 'Start small. Keep growing.'}</h2><p className="muted">{de ? 'Wähle bis zu drei Habits. Später kannst du jederzeit weitere hinzufügen.' : 'Choose up to three habits. You can always add more later.'}</p>
          <div className="recommendations">{suggestions.map(template => <button key={template.id} className={`recommendation ${selected.includes(template.id) ? 'selected' : ''}`} aria-pressed={selected.includes(template.id)} disabled={selected.length === 3 && !selected.includes(template.id)} onClick={() => setSelected(current => current.includes(template.id) ? current.filter(id => id !== template.id) : [...current, template.id])}><span>{template.emoji}</span><b>{template.name[locale]}</b><span className="option-check">{selected.includes(template.id) && <Check size={14} />}</span></button>)}</div>
          <p className="selection-count">{selected.length} / 3 {de ? 'ausgewählt' : 'selected'}</p><button className="primary-button full-width" onClick={finish}>{de ? 'Mein Wachstum beginnt' : 'Let’s start growing'} <Sprout size={18} /></button>
        </>}
        <div className="onboarding-demo"><span>{de ? 'Erst einmal umschauen?' : 'Want to look around first?'}</span><button className="text-button" onClick={onDemo}>{de ? 'Demo mit Beispieldaten öffnen' : 'Explore with sample data'} <ArrowRight size={13} /></button></div>
        <small className="onboarding-privacy">{de ? 'Ohne Konto starten. Deine Daten bleiben auf diesem Gerät.' : 'Start without an account. Your data stays on this device.'}</small>
      </section>
    </div>
  </div>;
}
