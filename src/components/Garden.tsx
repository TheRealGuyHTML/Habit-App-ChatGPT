import { useId, useMemo, useState } from 'react';
import { ArrowUpRight, BadgeCheck, ChevronDown, Flame, Leaf, LockKeyhole, Sparkles, Sprout, Trophy } from 'lucide-react';
import { calculateGamification, difficultyXP } from '../domain';
import type { AppState, Day, Locale } from '../domain/types';
import './Insights.css';

interface GardenProps { state: AppState; today: Day; locale: Locale; onAddHabit?: () => void }

function Plant({ stage, wilted, locale }: { stage: 'seed' | 'sprout' | 'growing' | 'bloom'; wilted: boolean; locale: Locale }) {
  const id = useId().replace(/:/g, '');
  const stageNumber = { seed: 0, sprout: 1, growing: 2, bloom: 3 }[stage];
  return <svg className={`garden-plant ${wilted ? 'wilted' : ''}`} viewBox="0 0 380 290" role="img" aria-label={locale === 'de' ? `${wilted ? 'Leicht welke' : 'Gesunde'} Pflanze, Wachstumsphase ${stageNumber + 1} von 4` : `${wilted ? 'Slightly wilted' : 'Healthy'} plant, growth stage ${stageNumber + 1} of 4`}>
    <defs>
      <radialGradient id={`${id}-halo`}><stop stopColor="#f4bad7" stopOpacity=".65"/><stop offset="1" stopColor="#f4bad7" stopOpacity="0"/></radialGradient>
      <linearGradient id={`${id}-leaf`} x1="0" y1="1" x2="1" y2="0"><stop stopColor={wilted ? '#81956f' : '#4c8573'}/><stop offset="1" stopColor={wilted ? '#b6b48a' : '#a3c7a2'}/></linearGradient>
      <linearGradient id={`${id}-pot`} x1="0" x2="1"><stop stopColor="#d3a7a1"/><stop offset=".45" stopColor="#efd6ca"/><stop offset="1" stopColor="#c59794"/></linearGradient>
      <linearGradient id={`${id}-flower`} x1="0" x2="1"><stop stopColor="#e782b0"/><stop offset="1" stopColor="#f5bad5"/></linearGradient>
      <filter id={`${id}-shadow`}><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <ellipse cx="190" cy="133" rx="131" ry="123" fill={`url(#${id}-halo)`}/>
    <ellipse cx="190" cy="268" rx="62" ry="9" fill="#866c75" opacity=".13" filter={`url(#${id}-shadow)`}/>
    <g className="plant-sparkles" fill="#d8a26e"><path d="m96 130 3-8 3 8 8 3-8 3-3 8-3-8-8-3z"/><path d="m278 86 2-6 2 6 6 2-6 2-2 6-2-6-6-2z"/><circle cx="268" cy="169" r="2"/><circle cx="126" cy="62" r="2"/></g>
    <g className="plant-stem" style={{ transformOrigin: '190px 213px', transform: wilted ? 'rotate(9deg)' : undefined }}>
      <path d={stageNumber >= 2 ? 'M190 219C188 184 194 140 186 81' : 'M190 220Q191 177 191 146'} fill="none" stroke="#67967c" strokeWidth="5" strokeLinecap="round"/>
      {stageNumber === 0 && <><path d="M190 218Q177 207 178 194Q193 193 190 218" fill={`url(#${id}-leaf)`}/><path d="M191 213Q200 191 211 195Q208 213 191 213" fill={`url(#${id}-leaf)`}/></>}
      {stageNumber >= 1 && <><path d="M191 182C163 185 142 169 145 151C168 146 190 158 191 182Z" fill={`url(#${id}-leaf)`}/><path d="M192 165C220 169 239 151 237 133C215 131 193 145 192 165Z" fill={`url(#${id}-leaf)`}/><path d="M189 179L154 157M194 161L229 139" fill="none" stroke="#c5ddbb" strokeWidth="1.2" opacity=".7"/></>}
      {stageNumber >= 2 && <><path d="M190 130C164 132 144 114 149 96C172 93 191 108 190 130Z" fill={`url(#${id}-leaf)`}/><path d="M189 111C213 112 228 95 224 79C204 80 188 93 189 111Z" fill={`url(#${id}-leaf)`}/><path d="M188 126L156 103M191 108L218 86" stroke="#c5ddbb" fill="none" strokeWidth="1.2" opacity=".7"/></>}
      {stageNumber === 2 && <path d="M186 86C176 75 178 65 186 60C197 67 197 79 186 86Z" fill={`url(#${id}-flower)`}/>}
      {stageNumber >= 3 && <g className="plant-blossom"><path d="M185 84C168 83 159 70 167 62C160 50 169 41 180 47C183 32 197 33 201 47C214 42 224 53 215 64C224 77 210 89 198 82C194 91 189 91 185 84Z" fill={`url(#${id}-flower)`}/><circle cx="190" cy="63" r="9" fill="#fff0cc"/><circle cx="188" cy="61" r="3" fill="#e8c083"/></g>}
    </g>
    <path d="M141 214H239L227 257Q225 265 217 266H163Q155 264 153 256Z" fill={`url(#${id}-pot)`}/>
    <ellipse cx="190" cy="214" rx="49" ry="10" fill="#e4c4b9"/>
    <ellipse cx="190" cy="214" rx="40" ry="6" fill="#705549"/>
    <path d="M188 212V220" stroke="#67967c" strokeWidth="5" strokeLinecap="round"/>
    <path d="M157 228Q189 236 224 227" stroke="#fff2e4" strokeOpacity=".4" strokeWidth="2" fill="none"/>
  </svg>;
}

export function Garden({ state, today, locale, onAddHabit }: GardenProps) {
  const game = useMemo(() => calculateGamification(state, today), [state, today]);
  const [showLedger, setShowLedger] = useState(false);
  const de = locale === 'de';
  const stageNames = de ? { seed: 'Ein neuer Anfang', sprout: 'Dein Keimling wächst', growing: 'Du schlägst Wurzeln', bloom: 'Du blühst auf' } : { seed: 'A fresh beginning', sprout: 'Your seedling is growing', growing: 'Putting down roots', bloom: 'Coming into bloom' };
  const achievementText: Record<string, { name: string; description: string; emoji: string }> = {
    'first-step': { name: de ? 'Der erste Schritt' : 'The first step', description: de ? 'Dein erstes erledigtes Habit.' : 'Your first completed habit.', emoji: '🌱' },
    'week': { name: de ? 'Gut verwurzelt' : 'Taking root', description: de ? 'Eine Serie von 7 geplanten Tagen.' : 'A streak of 7 scheduled days.', emoji: '🌿' },
    'three-weeks': { name: de ? 'In deinem Rhythmus' : 'Finding your rhythm', description: de ? '21 geplante Tage in Folge.' : '21 scheduled days in a row.', emoji: '🌷' },
    'habit-formed': { name: de ? 'Teil von dir' : 'A part of you', description: de ? '66 geplante Tage. Eine feste Gewohnheit.' : '66 scheduled days. A lasting habit.', emoji: '🌳' },
    'century': { name: de ? 'Hundert kleine Siege' : 'A hundred little wins', description: de ? '100 Habits erfolgreich erledigt.' : '100 habits successfully completed.', emoji: '✨' },
  };
  const nextMilestone = [7, 21, 66].find(value => value > game.bestStreak);
  const unlocked = game.achievements.filter(achievement => achievement.unlocked).length;
  const recent = [...game.ledger].sort((a, b) => b.day.localeCompare(a.day) || b.id.localeCompare(a.id)).slice(0, 20);
  const levelEarned = game.xp - game.currentLevelXp;
  const levelNeeded = game.nextLevelXp - game.currentLevelXp;

  return <section className="insights-page garden-page">
    <header className="insights-header"><p className="eyebrow">{de ? 'DEIN PERSÖNLICHER GARTEN' : 'YOUR PERSONAL GARDEN'}</p><h1 className="page-title">{de ? 'Gib deinem Wachstum Raum.' : 'Make room for growth.'}</h1><p className="muted">{de ? 'Mit jeder kleinen Gewohnheit wächst etwas Großes.' : 'Every small habit helps something beautiful grow.'}</p></header>
    <section className="glass-card garden-hero">
      <div className="garden-hero-top"><span className="garden-level-badge"><Sprout size={16}/> Level {game.level}</span><span className="garden-multiplier"><Sparkles size={15}/>{game.multiplier.toLocaleString(de ? 'de-DE' : 'en-GB', { maximumFractionDigits: 2 })}× XP</span></div>
      <Plant stage={game.plant.stage} wilted={game.plant.wilted} locale={locale}/>
      <div className="garden-hero-copy"><h2>{stageNames[game.plant.stage]}</h2><p>{game.plant.wilted ? (de ? 'Deine Pflanze vermisst dich ein wenig. Ein kleiner Schritt bringt wieder Leben hinein.' : 'Your plant has missed you a little. One small step brings it back to life.') : (de ? 'Beständigkeit nährt deine Pflanze. Du wächst in deinem eigenen Tempo.' : 'Consistency nourishes your plant. Keep growing at your own pace.')}</p></div>
      <div className="garden-level-progress"><div><span><strong>{game.xp.toLocaleString(de ? 'de-DE' : 'en-GB')}</strong> XP</span><span>{de ? 'Nächstes Level' : 'Next level'} · {game.nextLevelXp.toLocaleString(de ? 'de-DE' : 'en-GB')} XP</span></div><div className="progress-track" role="progressbar" aria-label={de ? 'Fortschritt zum nächsten Level' : 'Progress to next level'} aria-valuemin={0} aria-valuemax={levelNeeded} aria-valuenow={levelEarned}><span className="progress-fill" style={{ width: `${game.levelProgress * 100}%` }}/></div></div>
    </section>

    <div className="garden-facts"><div className="glass-card"><Flame size={20}/><strong>{game.currentStreak}</strong><span>{de ? 'Aktuelle Serie' : 'Current streak'}</span></div><div className="glass-card"><Trophy size={20}/><strong>{unlocked}/{game.achievements.length}</strong><span>{de ? 'Erfolge' : 'Achievements'}</span></div><div className="glass-card"><Leaf size={20}/><strong>{Math.round(game.plant.health * 100)}%</strong><span>{de ? 'Pflanzenkraft' : 'Plant vitality'}</span></div></div>

    {game.bestStreak >= 7 && onAddHabit && <button className="glass-card growth-invitation" type="button" onClick={onAddHabit}><span className="growth-invitation-icon">🌼</span><span><strong>{de ? 'Bereit für etwas Neues?' : 'Ready for something new?'}</strong><span>{de ? 'Deine erste Woche ist geschafft. Ergänze eine Gewohnheit.' : 'Your first week is complete. Add another little habit.'}</span></span><ArrowUpRight size={20}/></button>}

    <section className="glass-card milestones-card"><div className="insight-card-heading"><h2>{de ? 'Deine Meilensteine' : 'Your milestones'}</h2><BadgeCheck size={20} className="muted"/></div><p className="muted insight-subtitle">{de ? 'Erreichte Meilensteine verstärken alle folgenden XP.' : 'Reached milestones boost all future XP.'}</p><div className="milestone-path">{[7, 21, 66].map((threshold, index) => <div key={threshold} className={`milestone-step ${game.bestStreak >= threshold ? 'unlocked' : ''}`}><span className="milestone-node">{game.bestStreak >= threshold ? <BadgeCheck size={22}/> : <span>{threshold}</span>}</span><strong>{threshold} {de ? 'Tage' : 'days'}</strong><small>{[1.1, 1.25, 1.5][index]}× XP</small></div>)}</div>{nextMilestone ? <p className="milestone-next">{de ? `Noch ${nextMilestone - game.bestStreak} erfolgreiche geplante Tage bis zum nächsten Meilenstein.` : `${nextMilestone - game.bestStreak} more successful scheduled days to the next milestone.`}</p> : <p className="milestone-next">{de ? 'Du hast alle Wachstumsphasen erreicht. Deine Gewohnheiten sind ein Teil von dir.' : 'You have reached every growth stage. Your habits are a part of you.'}</p>}</section>

    <section className="achievements-section"><div className="insight-card-heading"><h2>{de ? 'Momente, die bleiben' : 'Little wins that last'}</h2><span className="achievement-count">{unlocked}/{game.achievements.length}</span></div><div className="achievement-grid">{game.achievements.map(achievement => {
      const text = achievementText[achievement.id] ?? { name: achievement.id, description: '', emoji: '🏆' };
      return <article key={achievement.id} className={`glass-card achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}><span className="achievement-medallion" aria-hidden="true">{text.emoji}{achievement.unlocked ? <BadgeCheck size={15}/> : <LockKeyhole size={12}/>}</span><h3>{text.name}</h3><p>{text.description}</p><div className="achievement-progress" role="progressbar" aria-label={text.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(achievement.progress * 100)}><span style={{ width: `${achievement.progress * 100}%` }}/></div><span className="achievement-status">{achievement.unlocked ? (de ? 'Freigeschaltet' : 'Unlocked') : `${Math.round(achievement.progress * 100)}%`}</span></article>;
    })}</div></section>

    <section className="glass-card xp-explainer"><div className="insight-card-heading"><h2>{de ? 'So wächst deine Erfahrung' : 'How your experience grows'}</h2><Sparkles size={19} className="muted"/></div><div className="xp-difficulty">{(['easy', 'medium', 'complex'] as const).map((difficulty, index) => <div key={difficulty}><span>{['✧', '✦', '✺'][index]}</span><strong>{difficultyXP[difficulty]} XP</strong><small>{(de ? ['Leicht', 'Mittel', 'Komplex'] : ['Easy', 'Medium', 'Complex'])[index]}</small></div>)}</div><p className="stats-footnote">{de ? 'Basis-XP × Meilenstein-Multiplikator. Im Daily Review gibt es bei Widerstand 4 oder 5 zusätzlich 10 Willpower-XP pro erledigtem Habit. Jede Erledigung zählt genau einmal; Korrekturen berechnen die XP neu.' : 'Base XP × milestone multiplier. Daily reviews add 10 willpower XP for each completed habit with resistance 4 or 5. Each completion counts once; corrections recalculate your XP.'}</p><button type="button" className="xp-history-toggle" aria-expanded={showLedger} onClick={() => setShowLedger(value => !value)}><span>{de ? 'Deine letzten XP' : 'Your recent XP'}</span><ChevronDown size={17} style={{ transform: showLedger ? 'rotate(180deg)' : undefined }}/></button>{showLedger && <div className="xp-ledger">{recent.length ? recent.map(item => <div key={item.id}><span className="ledger-emoji">{state.habits[item.habitId]?.emoji ?? '✦'}</span><div><strong>{state.habits[item.habitId]?.name ?? (de ? 'Archiviertes Habit' : 'Archived habit')}</strong><small>{new Intl.DateTimeFormat(de ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${item.day}T12:00:00Z`))} · {item.base} × {item.multiplier}{item.bonus > 0 ? ` + ${item.bonus} Willpower` : ''}</small></div><b>+{item.xp} XP</b></div>) : <p className="muted">{de ? 'Dein erstes erledigtes Habit legt den Grundstein.' : 'Your first completed habit plants the seed.'}</p>}</div>}</section>
  </section>;
}

export default Garden;
