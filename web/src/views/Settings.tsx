/**
 * Settings — profile, data control, and the honest note about what this
 * deployment is and is not.
 */

import { PERSONAS, REGISTRY_VERSION, todayISO, type Persona } from '@carboncampus/shared';
import { useStore } from '../lib/store';
import { Card, Pill } from '../components/ui';
import { apiConfigured } from '../lib/api';

export default function Settings({ onOpenMethodology }: { onOpenMethodology: () => void }) {
  const {
    profile, logs, challenges, isDemoData, loadDemo, clearDemo, resetAll, online, serverUp
  } = useStore();

  function exportMine() {
    const payload = {
      exported: new Date().toISOString(),
      factorRegistry: REGISTRY_VERSION,
      profile,
      logs,
      challenges
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carboncampus-my-data-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="view">
      <Card title="Profile">
        {profile ? (
          <ul className="kv">
            <li><span>Name</span><strong>{profile.name}</strong></li>
            <li><span>Email</span><strong>{profile.email}</strong></li>
            <li><span>Hostel</span><strong>{profile.hostel}</strong></li>
            <li><span>Department</span><strong>{profile.dept}</strong></li>
            <li><span>Year</span><strong>{profile.year}</strong></li>
            <li><span>Joined</span><strong>{new Date(profile.joinedAt).toLocaleDateString('en-IN')}</strong></li>
          </ul>
        ) : <p className="muted">No profile yet.</p>}
      </Card>

      <Card title="Demo data" sub="For judges, demos, and anyone who wants to see the app populated.">
        {isDemoData
          ? <p className="muted">Demo history is loaded. Your own logged days are mixed in with it.</p>
          : <p className="muted">No demo data loaded — everything you see is your own logging.</p>}
        <div className="persona-grid compact">
          {PERSONAS.map(p => (
            <button key={p.id} className="persona" onClick={() => void loadDemo(p.id as Persona, 30)}>
              <strong>{p.name}</strong>
              <span>{p.blurb}</span>
            </button>
          ))}
        </div>
        <button className="btn ghost small" onClick={() => void clearDemo()}>Clear all logged days</button>
      </Card>

      <Card title="Your data" sub="It is yours: portable, and erasable in one tap.">
        <div className="btn-row">
          <button className="btn ghost small" onClick={exportMine}>Export my data (JSON)</button>
          <button className="btn danger small" onClick={() => {
            if (confirm('Erase your profile, logs and challenges from this device?')) void resetAll();
          }}>Erase everything</button>
        </div>
        <p className="fineprint">
          {logs.length} days logged · {challenges.length} challenges · stored in this browser&apos;s IndexedDB.
        </p>
      </Card>

      <Card title="This deployment">
        <ul className="kv">
          <li><span>Mode</span><strong>{apiConfigured() ? 'API-backed' : 'Offline / local'}</strong></li>
          <li><span>Network</span><strong>{online ? 'online' : 'offline'}</strong></li>
          <li><span>Campus API</span><strong>{apiConfigured() ? (serverUp ? 'reachable' : 'unreachable') : 'not configured'}</strong></li>
          <li><span>Factor registry</span><strong>v{REGISTRY_VERSION}</strong></li>
        </ul>
        <p className="fineprint">
          The public demo runs entirely in your browser — no account, no server, nothing uploaded.
          The same build points at the Fastify + PostgreSQL + Redis API in <code>server/</code> when
          <code> VITE_API_BASE</code> is set, which is what a real campus rollout would use.
        </p>
        <div className="pill-row">
          <Pill tone="good">PWA</Pill><Pill>Offline-first</Pill><Pill>No tracking</Pill>
        </div>
      </Card>

      <Card title="About">
        <p className="muted small">
          CarbonCampus was built for the Prakriti EcoInnovate Challenge at Avinya 2026, IIT Guwahati,
          by team EcoGenesis — Gaurav Vyas and Mandavi Singh.
        </p>
        <div className="btn-row">
          <button className="btn ghost small" onClick={onOpenMethodology}>Methodology &amp; sources</button>
          <a className="btn ghost small" href="https://github.com/realgauravvyas/carboncampus"
             target="_blank" rel="noreferrer noopener">Source code ↗</a>
        </div>
      </Card>
    </div>
  );
}
