/**
 * App shell: a five-tab layout that stays out of the way, plus the offline and
 * install affordances that make this feel like an app rather than a page.
 */

import { Suspense, lazy, useEffect, useState } from 'react';
import { fmtKg, round } from '@carboncampus/shared';
import { useStore } from './lib/store';
import Onboard from './views/Onboard';
import LogDay from './views/LogDay';

// Recharts is the heaviest dependency in the bundle and only two screens need
// it, so every view beyond the logger is split out and fetched on demand. The
// shell that loads on a slow phone stays around 30 kB gzipped.
const Dashboard = lazy(() => import('./views/Dashboard'));
const Act = lazy(() => import('./views/Act'));
const Compete = lazy(() => import('./views/Compete'));
const Admin = lazy(() => import('./views/Admin'));
const Methodology = lazy(() => import('./views/Methodology'));
const Settings = lazy(() => import('./views/Settings'));

type Tab = 'log' | 'dashboard' | 'act' | 'compete' | 'admin' | 'methodology' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'log', label: 'Log', icon: '📝' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'act', label: 'Act', icon: '🎯' },
  { id: 'compete', label: 'Compete', icon: '🏆' },
  { id: 'admin', label: 'Campus', icon: '🏛️' }
];

export default function App() {
  const { ready, profile, last30, streak, greenPoints, online, isDemoData } = useStore();
  const [tab, setTab] = useState<Tab>(() => (location.hash.slice(1) as Tab) || 'dashboard');
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onHash = () => setTab((location.hash.slice(1) as Tab) || 'dashboard');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, '', `#${t}`);
    window.scrollTo({ top: 0 });
  };

  if (!ready) {
    return <div className="boot"><div className="boot-mark">🌿</div><p>Loading CarbonCampus…</p></div>;
  }

  if (!profile) return <Onboard />;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => go('dashboard')}>
          <span className="brand-mark" aria-hidden>🌿</span>
          <span>
            <strong>CarbonCampus</strong>
            <small>{profile.hostel} · {profile.name.split(' ')[0]}</small>
          </span>
        </button>

        <div className="topbar-right">
          {!online && <span className="offline-chip" title="Working offline — logs sync when you reconnect">offline</span>}
          {isDemoData && <span className="demo-chip" title="Demo history is loaded">demo</span>}
          <span className="today-chip" title="Your average over the last 30 days">
            {last30.perDay > 0 ? `${round(last30.perDay, 1)} kg/day` : 'no data'}
          </span>
          <button className="icon-btn" aria-label="Settings" onClick={() => go('settings')}>⚙️</button>
        </div>
      </header>

      {installEvent && (
        <div className="install-bar">
          <span>Install CarbonCampus for one-tap logging, even offline.</span>
          <button className="btn small primary" onClick={async () => {
            await installEvent.prompt();
            setInstallEvent(null);
          }}>Install</button>
          <button className="linkbtn" onClick={() => setInstallEvent(null)}>Not now</button>
        </div>
      )}

      <main>
        <Suspense fallback={<div className="view-loading">Loading…</div>}>
          {tab === 'log' && <LogDay onSaved={() => go('dashboard')} />}
          {tab === 'dashboard' && <Dashboard onLog={() => go('log')} />}
          {tab === 'act' && <Act onLog={() => go('log')} />}
          {tab === 'compete' && <Compete />}
          {tab === 'admin' && <Admin />}
          {tab === 'methodology' && <Methodology />}
          {tab === 'settings' && <Settings onOpenMethodology={() => go('methodology')} />}
        </Suspense>
      </main>

      <footer className="appfoot">
        <button className="linkbtn" onClick={() => go('methodology')}>Methodology &amp; sources</button>
        <span>·</span>
        <a href="https://github.com/realgauravvyas/carboncampus" target="_blank" rel="noreferrer noopener">
          Source ↗
        </a>
        <span>·</span>
        <span>{streak}🔥 · {greenPoints}💚 · {fmtKg(last30.total)} in 30 days</span>
      </footer>

      <nav className="tabbar" aria-label="Main">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}
                  aria-current={tab === t.id ? 'page' : undefined}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/** The install prompt event is not in the standard DOM lib yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
