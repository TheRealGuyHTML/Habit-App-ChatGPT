import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, CircleAlert, Cloud, CloudOff, Home as HomeIcon, LoaderCircle, MoreHorizontal, Pause, Pencil, Plus, Settings2, Share2, Smartphone, Sparkles, Sprout, Trash2, TrendingUp, X } from 'lucide-react';
import { calculateGamification, configForDay, createDemoState, createEntry, createHabit, createInitialState, entryKey, isComplete, isScheduled, localDay, stateSchema, togglePause, updateHabit } from './domain';
import type { Day, Entry, Habit, HabitConfig, Locale, Review } from './domain/types';
import { useAppStore } from './services/useAppStore';
import { registerServiceWorker, showForegroundReminder } from './services/notifications';
import { reconcileTimers } from './components/trackers/timer';
import { Onboarding } from './components/Onboarding';
import { Flower } from './components/Flower';
import { Home } from './components/Home';
import { HabitEditor } from './components/HabitEditor';
import { Modal } from './components/Modal';
import { Stats } from './components/Stats';
import { Garden } from './components/Garden';
import { DailyReview } from './components/DailyReview';
import { Settings } from './components/Settings';
import { Tracker } from './components/Tracker';
import { t } from './i18n';

type Tab = 'home' | 'stats' | 'garden' | 'settings';
type Panel = { type: 'editor'; habit?: Habit } | { type: 'actions'; habit: Habit } | { type: 'journal'; habit: Habit } | { type: 'add' } | { type: 'review' } | { type: 'install' } | { type: 'manage' } | { type: 'reset' } | { type: 'delete'; habit: Habit } | null;
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export default function App() {
  const store = useAppStore();
  const { state, update, ready } = store;
  const locale = state.settings.locale;
  const de = locale === 'de';
  const [tab, setTab] = useState<Tab>('home');
  const [today, setToday] = useState<Day>(() => localDay());
  const [day, setDay] = useState<Day>(() => localDay());
  const previousToday = useRef(today);
  const accountKey = store.user?.uid ?? 'local';
  const [storedPanel, setStoredPanel] = useState<{ account: string; value: Panel } | null>(null);
  const panel = storedPanel?.account === accountKey ? storedPanel.value : null;
  const setPanel = useCallback((value: Panel) => setStoredPanel(value ? { account: accountKey, value } : null), [accountKey]);
  const [toast, setToast] = useState('');
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [sampleData, setSampleData] = useState(() => { try { return localStorage.getItem('bloom:sample-data') === 'yes'; } catch { return false; } });
  const reviewShown = useRef('');
  const reminderReceipts = useRef(new Set<string>());
  const game = useMemo(() => calculateGamification(state, today), [state, today]);
  const close = useCallback(() => setStoredPanel(null), []);

  useEffect(() => { setStoredPanel(null); setToast(''); reviewShown.current = ''; }, [accountKey]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dataset.theme = state.settings.theme;
    document.title = de ? 'Bloom · Deine Gewohnheiten wachsen' : 'Bloom · Grow your habits';
    const system = matchMedia('(prefers-color-scheme: dark)');
    const color = () => {
      const dark = state.settings.theme === 'dark' || (state.settings.theme === 'system' && system.matches);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#18151f' : '#f6f3f8');
    };
    color();
    system.addEventListener('change', color);
    return () => system.removeEventListener('change', color);
  }, [locale, de, state.settings.theme]);

  useEffect(() => {
    const tick = () => {
      const next = localDay(new Date(), state.settings.timeZone);
      setToday(next);
      if (previousToday.current !== next) { const previous = previousToday.current; setDay(current => current === previous ? next : current); previousToday.current = next; }
    };
    tick();
    const timer = window.setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [state.settings.timeZone]);

  useEffect(() => {
    if (!ready) return;
    // Reconcile timestamps even when yesterday's cards are not mounted.
    update(current => reconcileTimers(current));
  }, [ready, today, store.user?.uid, update]);

  useEffect(() => {
    if (!ready || !Object.values(state.entries).some(entry => entry.timerStartedAt !== null)) return;
    const reconcile = () => { if (reconcileTimers(state) !== state) update(current => reconcileTimers(current)); };
    reconcile();
    const interval = window.setInterval(reconcile, 1000);
    document.addEventListener('visibilitychange', reconcile);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', reconcile); };
  }, [ready, state, update]);

  useEffect(() => {
    if (import.meta.env.PROD) void registerServiceWorker().catch(() => setToast(de ? 'Offline-Cache konnte noch nicht vorbereitet werden.' : 'The offline cache could not be prepared yet.'));
    const install = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    window.addEventListener('beforeinstallprompt', install);
    return () => window.removeEventListener('beforeinstallprompt', install);
  }, [de]);

  useEffect(() => {
    if (!ready || !state.onboarded) return;
    const openReview = () => { if (state.settings.reviewEnabled) { setDay(localDay(new Date(), state.settings.timeZone)); setPanel({ type: 'review' }); } };
    const message = (event: MessageEvent) => { if (event.data?.type === 'OPEN_REVIEW') openReview(); else if (event.data?.type === 'OPEN_HOME') { setDay(localDay(new Date(), state.settings.timeZone)); setTab('home'); } };
    navigator.serviceWorker?.addEventListener('message', message);
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'review') { openReview(); history.replaceState({}, '', location.pathname); }
    return () => navigator.serviceWorker?.removeEventListener('message', message);
  }, [ready, state.onboarded, state.settings.reviewEnabled, state.settings.timeZone, setPanel]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!ready || !state.onboarded) return;
    function checkReminders() {
      if (document.visibilityState !== 'visible') return;
      const now = new Date();
      const currentDay = localDay(now, state.settings.timeZone);
      const time = new Intl.DateTimeFormat('en-GB', { timeZone: state.settings.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
      const reviewKey = `${store.user?.uid ?? 'local'}:${currentDay}`;
      if (state.settings.reviewEnabled && time >= state.settings.reviewTime && !state.reviews[currentDay] && reviewShown.current !== reviewKey && !panel) {
        reviewShown.current = reviewKey;
        setDay(currentDay); setPanel({ type: 'review' });
      }
      if (!state.settings.notificationsEnabled) return;
      for (const habit of Object.values(state.habits)) {
        const config = configForDay(habit, currentDay);
        const id = `bloom-reminder:${reviewKey}:${habit.id}`;
        if (!config.reminder || time < config.reminder || !isScheduled(habit, currentDay) || isComplete(habit, state.entries[entryKey(habit.id, currentDay)], currentDay, currentDay) || reminderReceipts.current.has(id)) continue;
        // Persist delivery receipt across reloads. Background delivery is server-owned.
        try { if (localStorage.getItem(id)) continue; localStorage.setItem(id, 'sent'); } catch { /* In-memory receipt still prevents repeated prompts this session. */ }
        reminderReceipts.current.add(id);
        showForegroundReminder(`${config.emoji} ${config.name}`, de ? 'Zeit für deinen kleinen nächsten Schritt.' : 'Time for your next small step.', id);
      }
    }
    checkReminders();
    const timer = window.setInterval(checkReminders, 30_000);
    document.addEventListener('visibilitychange', checkReminders);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', checkReminders); };
  }, [ready, state, panel, store.user?.uid, de, setPanel]);

  function changeEntry(habit: Habit, patch: Partial<Entry>, targetDay = day) {
    if (targetDay > today || !isScheduled(habit, targetDay)) return;
    update(current => {
      const key = entryKey(habit.id, targetDay);
      const activeHabit = current.habits[habit.id];
      if (!activeHabit || !isScheduled(activeHabit, targetDay)) return current;
      const existing = current.entries[key];
      const entry = { ...(existing || createEntry(habit.id, targetDay, current.settings.timeZone)), completed: existing?.completed ?? configForDay(activeHabit, targetDay).negative, ...patch, habitId: habit.id, day: targetDay, updatedAt: new Date().toISOString() };
      return { ...current, entries: { ...current.entries, [key]: entry } };
    });
  }
  function toggle(habit: Habit) {
    if (day > today) return;
    const config = configForDay(habit, day);
    const entry = state.entries[entryKey(habit.id, day)];
    const complete = isComplete(habit, entry, day, today);
    if (config.special && config.kind !== 'check' && !config.negative) {
      if (!complete) { if (config.kind === 'journal') setPanel({ type: 'journal', habit }); else setToast(t(locale, 'completeGoal')); return; }
      changeEntry(habit, { completed: false, value: 0, checked: [], mood: '', timerStartedAt: null, timerElapsed: 0 });
    } else changeEntry(habit, { completed: !complete });
    navigator.vibrate?.(8);
  }
  function saveHabit(config: HabitConfig) {
    const editing = panel?.type === 'editor' ? panel.habit : undefined;
    const ok = update(current => {
      const habit = editing && current.habits[editing.id] ? updateHabit(current.habits[editing.id], config, today) : createHabit(config, today);
      stateSchema.shape.habits.parse({ [habit.id]: habit });
      return { ...current, habits: { ...current.habits, [habit.id]: habit } };
    });
    if (ok) { close(); setToast(t(locale, 'saved')); }
  }
  function saveReview(review: Review) {
    const ok = update(current => ({ ...current, reviews: { ...current.reviews, [review.day]: review } }));
    if (ok) { reviewShown.current = `${store.user?.uid ?? 'local'}:${review.day}`; close(); setToast(t(locale, 'saved')); }
  }
  function markSample(value: boolean) { setSampleData(value); try { localStorage.setItem('bloom:sample-data', value ? 'yes' : 'no'); } catch { /* Cosmetic marker only; actual persistence errors are surfaced by the store. */ } }
  const addHabit = () => setPanel({ type: 'editor' });
  const editHabit = (habit: Habit) => setPanel({ type: 'editor', habit });
  const paused = (habit: Habit) => habit.pauses.some(pause => pause.from <= today && (!pause.to || pause.to > today));
  const statusLabel = t(locale, store.status === 'synced' ? 'synced' : store.status === 'syncing' ? 'syncing' : store.status === 'offline' ? 'offline' : store.status === 'error' ? 'error' : 'local');

  if (!ready) return <div className="app-loading"><Flower size={48} /><span>Bloom</span><LoaderCircle className="spin" size={22} />{store.error && <div className="error-message"><p>{store.error}</p><button className="text-button" onClick={() => void store.signOut().catch(error => setToast(String(error)))}>{de ? 'Zum lokalen Modus' : 'Continue locally'}</button></div>}</div>;
  return <>
    {!state.onboarded ? <>
      {store.user && <div className="account-onboarding">{store.user.email}<button className="text-button" onClick={() => void store.importLocalToAccount().catch(error => setToast(String(error)))}>{de ? 'Lokale Daten übernehmen' : 'Import local data'}</button><button className="text-button" onClick={() => void store.signOut()}>{de ? 'Abmelden' : 'Sign out'}</button></div>}
      <Onboarding locale={locale} onLanguage={(language: Locale) => update(current => ({ ...current, settings: { ...current.settings, locale: language } }))} onFinish={next => { if (store.replaceState(next)) markSample(false); }} onDemo={() => { if (store.replaceState(createDemoState(locale, state.settings.timeZone))) markSample(true); }} />
    </> : <div className="app-shell">
      <header className="app-header"><button className="brand" onClick={() => setTab('home')} aria-label="Bloom Home"><Flower size={32} /> bloom<span className="brand-dot">.</span></button><div className="header-right"><button className={`sync-status status-${store.status}`} onClick={() => { if (store.status === 'error') store.retrySync(); else setTab('settings'); }} aria-label={statusLabel}>{store.status === 'syncing' ? <LoaderCircle size={13} className="spin" /> : store.status === 'offline' ? <CloudOff size={13} /> : store.user ? <Cloud size={13} /> : <span className="status-dot" />}<span>{statusLabel}</span></button><button className="avatar header-avatar" onClick={() => setTab('settings')} aria-label={t(locale, 'settings')}>{state.settings.name ? state.settings.name.charAt(0).toUpperCase() : <Sprout size={19} />}</button></div></header>
      {sampleData && !store.user && <div className="sample-banner"><span><Sparkles size={13} />{t(locale, 'demo')}</span><button onClick={() => setPanel({ type: 'reset' })}>{t(locale, 'startFresh')}<ArrowRight size={12} /></button></div>}
      <main id="main-content" className="main-content">
        {tab === 'home' && <Home state={state} today={today} day={day} locale={locale} game={game} onDay={setDay} onEntry={changeEntry} onToggle={toggle} onEdit={editHabit} onMenu={habit => setPanel({ type: 'actions', habit })} onAdd={addHabit} onReview={() => { if (day > today) setDay(today); setPanel({ type: 'review' }); }} onGarden={() => setTab('garden')} onManage={() => setPanel({ type: 'manage' })} />}
        {tab === 'stats' && <Stats state={state} today={today} locale={locale} />}
        {tab === 'garden' && <Garden state={state} today={today} locale={locale} onAddHabit={addHabit} />}
        {tab === 'settings' && <Settings store={store} locale={locale} onInstall={() => setPanel({ type: 'install' })} onReset={() => setPanel({ type: 'reset' })} />}
      </main>
      <nav className="bottom-nav" aria-label={de ? 'Hauptnavigation' : 'Main navigation'}><button className={tab === 'home' ? 'active' : ''} aria-current={tab === 'home' ? 'page' : undefined} onClick={() => setTab('home')}><HomeIcon size={21} strokeWidth={tab === 'home' ? 2 : 1.7} /><span>{t(locale, 'home')}</span></button><button className={tab === 'stats' ? 'active' : ''} aria-current={tab === 'stats' ? 'page' : undefined} onClick={() => setTab('stats')}><TrendingUp size={21} /><span>{t(locale, 'stats')}</span></button><button className="nav-add" aria-label={t(locale, 'add')} onClick={() => state.settings.reviewEnabled ? setPanel({ type: 'add' }) : addHabit()}><Plus size={27} /><span className="sr-only">{t(locale, 'add')}</span></button><button className={tab === 'garden' ? 'active' : ''} aria-current={tab === 'garden' ? 'page' : undefined} onClick={() => setTab('garden')}><Sprout size={22} /><span>{de ? 'Garten' : 'Garden'}</span></button><button className={tab === 'settings' ? 'active' : ''} aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => setTab('settings')}><Settings2 size={21} /><span>{t(locale, 'settings')}</span></button></nav>
    </div>}
    {store.error && <div role="alert" className="global-error"><CircleAlert size={18} /><div><b>{t(locale, 'error')}</b><p>{store.error}</p></div><button className="text-button" onClick={store.retrySync}>{de ? 'Erneut versuchen' : 'Retry'}</button><button className="icon-button" aria-label={t(locale, 'close')} onClick={store.clearError}><X size={15} /></button></div>}
    {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    {panel && <Modal key={accountKey} onClose={close} label={panel.type === 'editor' ? t(locale, panel.habit ? 'editHabit' : 'addHabit') : panel.type === 'review' ? t(locale, 'review') : t(locale, 'actions')} wide={panel.type === 'review'}>
      {panel.type === 'editor' && <HabitEditor habit={panel.habit} today={today} locale={locale} onSave={saveHabit} onCancel={close} />}
      {panel.type === 'review' && <DailyReview state={state} day={day > today ? today : day} locale={locale} onSave={saveReview} onClose={close} />}
      {panel.type === 'journal' && <div className="action-sheet"><span className="eyebrow">{de ? 'EIN MOMENT ZUM INNEHALTEN' : 'A MOMENT TO REFLECT'}</span><h2>{configForDay(panel.habit, day).name}</h2><Tracker habit={{ ...panel.habit, ...configForDay(panel.habit, day) }} entry={state.entries[entryKey(panel.habit.id, day)] || createEntry(panel.habit.id, day, state.settings.timeZone)} day={day} today={today} locale={locale} onChange={patch => changeEntry(panel.habit, patch)} /><button className="primary-button full-width" style={{ marginTop: 22 }} onClick={close}><Check size={16} />{de ? 'Fertig' : 'Done'}</button></div>}
      {panel.type === 'add' && <div className="action-sheet"><span className="eyebrow">{de ? 'DEIN NÄCHSTER SCHRITT' : 'YOUR NEXT STEP'}</span><h2>{de ? 'Was möchtest du tun?' : 'What would you like to do?'}</h2><button className="action-option" onClick={addHabit}><span className="action-icon"><Plus size={22} /></span><div><b>{t(locale, 'addHabit')}</b><p>{de ? 'Etwas Gutes in deinen Alltag bringen.' : 'Bring something good to your day.'}</p></div><ArrowRight size={17} /></button><button className="action-option" onClick={() => { if (day > today) setDay(today); setPanel({ type: 'review' }); }}><span className="action-icon sage"><BookOpen size={21} /></span><div><b>{t(locale, 'review')}</b><p>{de ? 'Innehalten und den Tag reflektieren.' : 'Pause and reflect on your day.'}</p></div><ArrowRight size={17} /></button></div>}
      {panel.type === 'actions' && <div className="action-sheet"><span className="action-emoji">{panel.habit.emoji}</span><h2>{panel.habit.name}</h2><button className="action-option" onClick={() => editHabit(panel.habit)}><Pencil size={18} />{t(locale, 'edit')}<ArrowRight size={16} /></button>{configForDay(panel.habit, today).schedule.type !== 'once' && <button className="action-option" onClick={() => { const id = panel.habit.id; if (update(current => ({ ...current, habits: { ...current.habits, [id]: togglePause(current.habits[id], today) } }))) close(); }}><Pause size={18} />{t(locale, paused(panel.habit) ? 'resume' : 'pause')}<ArrowRight size={16} /></button>}<button className="action-option danger" onClick={() => setPanel({ type: 'delete', habit: panel.habit })}><Trash2 size={18} />{t(locale, 'remove')}<ArrowRight size={16} /></button></div>}
      {panel.type === 'manage' && <div className="action-sheet"><span className="eyebrow">{de ? 'DEIN ALLTAG, DEINE HABITS' : 'YOUR DAY, YOUR HABITS'}</span><h2>{t(locale, 'manage')}</h2><div className="managed-list">{Object.values(state.habits).filter(habit => !habit.deletedFrom || habit.deletedFrom > today).map(habit => <button className="action-option" key={habit.id} onClick={() => setPanel({ type: 'actions', habit })}><span className="manage-emoji">{habit.emoji}</span><div><b>{habit.name}</b><p>{t(locale, paused(habit) ? 'paused' : 'active')}{habit.schedule.type === 'once' ? ` · ${de ? 'Einmalig' : 'Once'} ${habit.schedule.date}` : ''}</p></div><MoreHorizontal size={18} /></button>)}</div><button className="primary-button full-width" onClick={addHabit}><Plus size={17} />{t(locale, 'addHabit')}</button></div>}
      {panel.type === 'delete' && <div className="action-sheet"><span className="action-emoji">🌱</span><h2>{de ? 'Platz für Neues schaffen?' : 'Make room for something new?'}</h2><p className="muted">{t(locale, 'deleteConfirm')}</p><div className="form-actions"><button className="secondary-button" onClick={close}>{t(locale, 'cancel')}</button><button className="primary-button danger-button" onClick={() => { const id = panel.habit.id; if (update(current => ({ ...current, habits: { ...current.habits, [id]: { ...current.habits[id], deletedFrom: today, updatedAt: new Date().toISOString() } } }))) close(); }}>{t(locale, 'remove')}</button></div></div>}
      {panel.type === 'reset' && <div className="action-sheet"><span className="action-emoji">🌾</span><h2>{de ? 'Ganz neu anfangen?' : 'Begin again?'}</h2><p className="muted">{de ? 'Alle Habits, Einträge und Reviews dieses Datenbestands werden gelöscht. Erstelle zuerst einen Export in den Einstellungen, wenn du sie behalten möchtest.' : 'All habits, entries and reviews in this data set will be deleted. Export your data from settings first if you want to keep it.'}</p><div className="form-actions"><button className="secondary-button" onClick={close}>{t(locale, 'cancel')}</button><button className="primary-button danger-button" onClick={() => { if (store.replaceState(createInitialState(locale, state.settings.timeZone))) { markSample(false); close(); setTab('home'); } }}>{de ? 'Daten zurücksetzen' : 'Reset data'}</button></div></div>}
      {panel.type === 'install' && <div className="install-sheet"><span className="install-icon"><Smartphone size={30} /></span><h2>{de ? 'Bloom immer bei dir.' : 'Take Bloom with you.'}</h2><p className="muted">{de ? 'Deine Gewohnheiten verdienen einen Platz auf deinem Home-Bildschirm.' : 'Your habits deserve a place on your Home Screen.'}</p>{matchMedia('(display-mode: standalone)').matches ? <div className="success-message"><Check size={17} />{de ? 'Bloom ist bereits als App geöffnet.' : 'Bloom is already open as an app.'}</div> : <><ol className="install-steps"><li><span>1</span><div><b>{de ? 'In Safari öffnen' : 'Open in Safari'}</b><p>{de ? 'Öffne diese Seite auf deinem iPhone in Safari.' : 'Open this page on your iPhone in Safari.'}</p></div></li><li><span><Share2 size={17} /></span><div><b>{de ? 'Teilen antippen' : 'Tap Share'}</b><p>{de ? 'Tippe auf das Teilen-Symbol in der Browserleiste.' : 'Tap the Share icon in the browser toolbar.'}</p></div></li><li><span><Plus size={19} /></span><div><b>{de ? 'Zum Home-Bildschirm' : 'Add to Home Screen'}</b><p>{de ? 'Wähle „Zum Home-Bildschirm“ und dann „Hinzufügen“.' : 'Choose “Add to Home Screen”, then “Add”.'}</p></div></li></ol>{installPrompt && <button className="primary-button full-width" onClick={() => void installPrompt.prompt().then(() => installPrompt.userChoice).then(() => setInstallPrompt(null)).catch(error => setToast(String(error)))}>{t(locale, 'install')} <ArrowRight size={17} /></button>}</>}<small className="muted">{de ? 'Android & Desktop: Im Browsermenü „App installieren“ wählen. Die Offline-Funktion wird nach dem ersten vollständigen Laden bereitgestellt.' : 'Android & desktop: choose “Install app” in your browser menu. Offline support is prepared after your first complete visit.'}</small></div>}
    </Modal>}
  </>;
}
