import { useRef, useState } from 'react';
import { Bell, BellRing, Check, ChevronRight, Download, Globe2, HelpCircle, LogIn, LogOut, Monitor, Moon, ShieldCheck, Smartphone, Sun, Upload } from 'lucide-react';
import type { AppState, Locale, Settings as SettingsModel } from '../domain/types';
import { localDay, parseImport } from '../domain';
import type { useAppStore } from '../services/useAppStore';
import { disablePush, enablePush, sendTestNotification } from '../services/notifications';
import { t } from '../i18n';

type Store = ReturnType<typeof useAppStore>;
export function Settings({ store, locale, onInstall, onReset }: { store: Store; locale: Locale; onInstall: () => void; onReset: () => void }) {
  const { state, user } = store;
  const de = locale === 'de';
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [incoming, setIncoming] = useState<AppState | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const [timezone, setTimezone] = useState(state.settings.timeZone);
  const update = (patch: Partial<SettingsModel>) => store.update(current => ({ ...current, settings: { ...current.settings, ...patch } }));
  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true); setMessage(''); setFailure('');
    try { await action(); if (success) setMessage(success); }
    catch (error) { setFailure(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  function exportData() {
    const file = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const a = document.createElement('a'); a.href = url; a.download = `bloom-export-${localDay(new Date(), state.settings.timeZone)}.json`; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(de ? 'Dein Export wurde erstellt.' : 'Your export is ready.');
  }
  async function readImport(file?: File) {
    if (!file) return;
    setFailure('');
    try {
      if (file.size > 10_000_000) throw new Error(de ? 'Die Datei darf höchstens 10 MB groß sein.' : 'The file must be 10 MB or smaller.');
      setIncoming(parseImport(await file.text()));
    } catch (error) { setFailure(error instanceof Error ? error.message : String(error)); }
    if (upload.current) upload.current.value = '';
  }
  return <div className="settings-page page-enter">
    <span className="eyebrow">{de ? 'GANZ NACH DEINEM GEFÜHL' : 'MAKE YOURSELF AT HOME'}</span><h1 className="page-title">{t(locale, 'settings')}</h1><p className="page-subtitle">{de ? 'Dein Rhythmus. Deine App.' : 'Your rhythm. Your app.'}</p>
    <div className="settings-grid">
    <section className="glass-card settings-section"><h2><ShieldCheck size={19} />{de ? 'Dein Konto' : 'Your account'}</h2>
      {user ? <><div className="account-badge"><span className="avatar">{(user.displayName || user.email || 'B').slice(0, 1).toUpperCase()}</span><div><b>{user.displayName || state.settings.name || (de ? 'Dein Account' : 'Your account')}</b><p className="muted">{user.email}</p></div><Check size={20} className="accent" /></div><p className="muted">{de ? 'Deine Daten werden auf deinen Geräten synchronisiert. Offline-Änderungen werden beim nächsten Verbinden übertragen.' : 'Your data syncs across devices. Offline changes upload when you reconnect.'}</p><button className="secondary-button full-width" disabled={busy} onClick={() => void run(store.importLocalToAccount, de ? 'Lokale Daten zur Synchronisierung vorgemerkt.' : 'Local data queued for sync.')}>{de ? 'Lokale Daten in dieses Konto übernehmen' : 'Copy local data into this account'}</button><small className="form-note">{de ? 'Gleichnamige Einträge mit derselben ID werden durch die lokalen Werte ersetzt.' : 'Existing records with matching IDs will be replaced by local values.'}</small><button className="text-button danger" disabled={busy} onClick={() => void run(store.signOut)}><LogOut size={16} />{de ? 'Abmelden' : 'Sign out'}</button></> : <>
        <div className="local-badge"><span className="status-dot" /><b>{t(locale, 'localMode')}</b><span>{de ? 'Kein Konto nötig' : 'No account needed'}</span></div>
        <p className="muted">{store.firebaseConfigured ? (de ? 'Melde dich an, um deine Gewohnheiten auf mehreren Geräten zu nutzen.' : 'Sign in to use your habits across devices.') : (de ? 'Deine Habits werden auf diesem Gerät gespeichert. Für Anmeldung und Synchronisierung muss Firebase eingerichtet werden. Die Anleitung liegt in docs/DEPLOYMENT.md.' : 'Your habits are saved on this device. Set up Firebase for accounts and sync. Instructions are in docs/DEPLOYMENT.md.')}</p>
        {store.firebaseConfigured && <form className="auth-form" onSubmit={event => { event.preventDefault(); void run(() => authMode === 'signin' ? store.signIn(email, password) : store.signUp(email, password)); }}>
          <div className="segmented"><button type="button" className={authMode === 'signin' ? 'active' : ''} onClick={() => setAuthMode('signin')}>{de ? 'Anmelden' : 'Sign in'}</button><button type="button" className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')}>{de ? 'Registrieren' : 'Sign up'}</button></div>
          <label className="field">E-Mail<input className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><label className="field">{de ? 'Passwort' : 'Password'}<input className="input" type="password" minLength={6} required autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>
          <button className="primary-button full-width" disabled={busy} type="submit"><LogIn size={16} />{busy ? (de ? 'Einen Moment …' : 'One moment …') : authMode === 'signin' ? (de ? 'Anmelden' : 'Sign in') : (de ? 'Konto erstellen' : 'Create account')}</button>
          <button className="secondary-button full-width" disabled={busy} type="button" onClick={() => void run(store.signInGoogle)}>{de ? 'Mit Google fortfahren' : 'Continue with Google'}</button>
          <button className="text-button" disabled={!email || busy} type="button" onClick={() => void run(() => store.resetPassword(email), de ? 'Eine E-Mail zum Zurücksetzen ist unterwegs.' : 'Password reset email sent.')}>{de ? 'Passwort vergessen?' : 'Forgot password?'}</button>
        </form>}
      </>}
    </section>
    <section className="glass-card settings-section"><h2><Sun size={19} />{de ? 'Für dich gemacht' : 'Made for you'}</h2>
      <label className="field">{de ? 'Dein Vorname' : 'Your first name'}<input className="input" maxLength={40} value={state.settings.name} onChange={event => update({ name: event.target.value })} /></label>
      <label className="field"><span><Globe2 size={14} />{de ? 'Sprache' : 'Language'}</span><select className="input" value={locale} onChange={event => update({ locale: event.target.value as Locale })}><option value="de">Deutsch</option><option value="en">English</option></select></label>
      <fieldset><legend>{de ? 'Erscheinungsbild' : 'Appearance'}</legend><div className="theme-picker">{([{ id: 'system', Icon: Monitor, label: de ? 'System' : 'System' }, { id: 'light', Icon: Sun, label: de ? 'Hell' : 'Light' }, { id: 'dark', Icon: Moon, label: de ? 'Dunkel' : 'Dark' }] as const).map(({ id, Icon, label }) => <button key={id} className={state.settings.theme === id ? 'selected' : ''} aria-pressed={state.settings.theme === id} onClick={() => update({ theme: id })}><Icon size={19} />{label}</button>)}</div></fieldset>
      <form onSubmit={event => { event.preventDefault(); try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); update({ timeZone: timezone }); setMessage(de ? 'Zeitzone gespeichert. Historische Datumsschlüssel bleiben erhalten.' : 'Time zone saved. Historical day keys are preserved.'); } catch { setFailure(de ? 'Diese IANA-Zeitzone ist ungültig.' : 'This IANA time zone is invalid.'); } }}><label className="field">{de ? 'Zeitzone für Tageswechsel' : 'Time zone for daily boundaries'}<div className="inline-field"><input className="input" value={timezone} onChange={e => setTimezone(e.target.value)} list="timezones" required /><button className="mini-button" aria-label={de ? 'Zeitzone speichern' : 'Save time zone'}><Check size={18} /></button></div><datalist id="timezones">{['Europe/Berlin', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney', 'UTC'].map(zone => <option key={zone} value={zone} />)}</datalist></label></form>
    </section>
    <section className="glass-card settings-section"><h2><Bell size={19} />{de ? 'Ein kleiner Anstoß' : 'A little nudge'}</h2>
      <label className="switch-row"><span><b>{de ? 'Daily Review' : 'Daily review'}</b><small>{de ? 'Nimm dir abends Zeit für deinen Tag.' : 'Make time to reflect on your day.'}</small></span><input type="checkbox" role="switch" checked={state.settings.reviewEnabled} onChange={e => update({ reviewEnabled: e.target.checked })} /></label>
      {state.settings.reviewEnabled && <label className="field time-field">{de ? 'Meine Review-Uhrzeit' : 'My review time'}<input className="input" type="time" value={state.settings.reviewTime} onChange={e => { if (e.target.value) update({ reviewTime: e.target.value }); }} /></label>}
      <div className="settings-divider" /><label className="switch-row"><span><b>{de ? 'Erinnerungen' : 'Reminders'}</b><small>{state.settings.notificationsEnabled ? (de ? 'Für diesen Datenbestand aktiviert' : 'Enabled for this account or local profile') : (de ? 'Du entscheidest, wann wir fragen.' : 'You choose when we ask.')}</small></span><input type="checkbox" role="switch" checked={state.settings.notificationsEnabled} disabled={busy} onChange={e => { const enabled = e.target.checked; void run(async () => { if (enabled) { const result = await enablePush(); setMessage(result.message); } else await disablePush(); update({ notificationsEnabled: enabled }); }); }} /></label>
      <p className="form-note">{de ? 'Auf dem iPhone: iOS 16.4 oder neuer und Installation auf dem Home-Bildschirm. Ohne verbundenen Push-Server gibt es Erinnerungen nur bei geöffneter App.' : 'On iPhone: iOS 16.4+ and Home Screen installation. Without a connected push server, reminders work only while the app is open.'}</p>
      {state.settings.notificationsEnabled && <button className="text-button" disabled={busy} onClick={() => void run(async () => { const result = await enablePush(); setMessage(result.message); })}>{de ? 'Dieses Gerät für Push registrieren' : 'Register this device for push'}</button>}
      <button className="secondary-button" disabled={busy || !state.settings.notificationsEnabled} onClick={() => void run(sendTestNotification, de ? 'Lokale Testbenachrichtigung angezeigt.' : 'Local test notification displayed.')}><BellRing size={16} />{de ? 'Lokale Testbenachrichtigung' : 'Local test notification'}</button>
    </section>
    <section className="glass-card settings-section"><h2><Download size={19} />{de ? 'Deine Daten gehören dir' : 'Your data is yours'}</h2><p className="muted">{de ? 'Sichere deine Gewohnheiten, Einträge und Reviews als JSON-Datei. Lokale Daten können beim Löschen der Browserdaten verloren gehen.' : 'Back up habits, entries and reviews as a JSON file. Clearing browser data can remove local records.'}</p>
      <div className="data-buttons"><button className="secondary-button" onClick={exportData}><Download size={17} />{de ? 'Exportieren' : 'Export'}</button><button className="secondary-button" onClick={() => upload.current?.click()}><Upload size={17} />{de ? 'Importieren' : 'Import'}</button><input ref={upload} type="file" accept="application/json,.json" hidden onChange={e => void readImport(e.target.files?.[0])} aria-label={de ? 'Datendatei auswählen' : 'Choose data file'} /></div>
      {incoming && <div className="import-confirm"><b>{de ? 'Import prüfen' : 'Review import'}</b><p>{Object.keys(incoming.habits).length} Habits · {Object.keys(incoming.entries).length} {de ? 'Einträge' : 'entries'} · {Object.keys(incoming.reviews).length} Reviews</p><p>{de ? 'Der Import ersetzt den aktuellen Datenbestand. Erstelle vorher einen Export.' : 'This import replaces your current data. Create an export first.'}</p><div className="form-actions"><button className="text-button" onClick={() => setIncoming(null)}>{t(locale, 'cancel')}</button><button className="primary-button" onClick={() => { const ok = store.replaceState(incoming); if (ok !== false) { setIncoming(null); setMessage(de ? 'Daten erfolgreich importiert.' : 'Data imported successfully.'); } }}>{de ? 'Daten ersetzen' : 'Replace data'}</button></div></div>}
    </section>
    <section className="glass-card settings-section install-card"><div className="install-icon"><Smartphone size={28} /></div><div><h2>{de ? 'Ein Zuhause für deine Habits' : 'A home for your habits'}</h2><p className="muted">{de ? 'Bloom auf deinem Home-Bildschirm. Ein Tippen näher an deinem nächsten kleinen Schritt.' : 'Bloom on your Home Screen. One tap closer to your next small step.'}</p><button className="primary-button" onClick={onInstall}>{t(locale, 'install')}<ChevronRight size={16} /></button></div></section>
    <section className="glass-card settings-section about-card"><h2><HelpCircle size={18} />Bloom 1.0</h2><p className="muted">{de ? 'Mit Raum zum Wachsen. Manuelle Gesundheitsdaten, echte lokale Speicherung und optionale Firebase-Synchronisierung.' : 'Room to grow. Manual health inputs, real local storage and optional Firebase sync.'}</p><button className="text-button danger" onClick={onReset}>{de ? 'Daten zurücksetzen & Onboarding starten' : 'Reset data & restart onboarding'}</button></section>
    </div>
    {failure && <div role="alert" className="settings-feedback error-message"><button className="text-button" onClick={() => setFailure('')}>×</button>{failure}</div>}
    {message && <div role="status" className="settings-feedback success-message"><button className="text-button" onClick={() => setMessage('')}>×</button>{message}</div>}
  </div>;
}
