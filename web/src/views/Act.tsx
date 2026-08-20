/**
 * Act — the half of the product that a plain calculator does not have.
 *
 * Three swaps a week, each priced from the user's own logs, each showing its
 * arithmetic. Accepting one starts a seven-day challenge worth green points.
 */

import { useMemo, useState } from 'react';
import {
  RULE_COUNT, allSuggestions, fmtKg, round, type Suggestion
} from '@carboncampus/shared';
import { useStore } from '../lib/store';
import { Card, EmptyState, Pill, ProgressRing } from '../components/ui';

export default function Act({ onLog }: { onLog: () => void }) {
  const {
    logs, suggestions, challenges, acceptChallenge, completeChallenge, badges, greenPoints
  } = useStore();
  const [showAll, setShowAll] = useState(false);

  const everything = useMemo(() => allSuggestions(logs.slice(-21)), [logs]);
  const active = challenges.filter(c => !c.done);
  const done = challenges.filter(c => c.done);
  const monthlyPotential = suggestions.reduce((a, s) => a + s.saving, 0);

  if (!logs.length) {
    return (
      <div className="view">
        <EmptyState
          icon="🎯"
          title="Log a few days first"
          body={`The action engine reads your own habits — all ${RULE_COUNT} rules stay quiet until there is something real to work with.`}
          action={<button className="btn primary" onClick={onLog}>Log a day</button>}
        />
      </div>
    );
  }

  return (
    <div className="view">
      <Card
        title="Your three swaps this week"
        sub={
          suggestions.length
            ? <>Ranked by impact × ease from your last {Math.min(logs.length, 21)} days. Together worth about <strong>{fmtKg(monthlyPotential)} a month</strong>.</>
            : 'Nothing high-impact left in your logs — that is a good problem to have.'
        }
      >
        {suggestions.length === 0 && (
          <p className="muted">
            Every rule that applies to your habits is already an active challenge, or your logged
            habits are below the threshold where a swap would save anything meaningful.
          </p>
        )}
        <div className="swaps">
          {suggestions.map((s, i) => (
            <SwapCard key={s.id} s={s} rank={i + 1} onAccept={() => void acceptChallenge(s)} />
          ))}
        </div>
      </Card>

      {active.length > 0 && (
        <Card title="Active challenges" sub="Seven days each. Mark it done when you have held it.">
          <ul className="challenges">
            {active.map(c => {
              const total = new Date(c.endsAt).getTime() - new Date(c.startedAt).getTime();
              const gone = Date.now() - new Date(c.startedAt).getTime();
              const pct = Math.max(0, Math.min(1, gone / total));
              const daysLeft = Math.max(0, Math.ceil((new Date(c.endsAt).getTime() - Date.now()) / 86400000));
              return (
                <li key={c.id} className="challenge">
                  <ProgressRing pct={pct} label={`${Math.round(pct * 100)} percent of the week elapsed`} />
                  <div className="challenge-body">
                    <strong>{c.icon} {c.title}</strong>
                    <span className="muted small">
                      {fmtKg(c.saving)}/month · {c.points} points · {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                    </span>
                  </div>
                  <button className="btn small" onClick={() => void completeChallenge(c.id)}>Mark done</button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card title="Badges" sub={`${greenPoints} green points earned`}>
        <div className="badges">
          {badges.map(b => (
            <div key={b.id} className={`badge${b.got ? ' got' : ''}`} title={b.need}>
              <span aria-hidden>{b.icon}</span>
              <strong>{b.name}</strong>
              <small>{b.got ? 'Earned' : b.need}</small>
            </div>
          ))}
        </div>
      </Card>

      {done.length > 0 && (
        <Card title="Completed" sub={`${done.length} challenge${done.length === 1 ? '' : 's'} held`}>
          <ul className="done-list">
            {done.map(c => (
              <li key={c.id}>
                <span aria-hidden>{c.icon}</span>
                <span>{c.title}</span>
                <Pill tone="good">+{c.points}</Pill>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title="Everything the engine can suggest"
        sub={`${RULE_COUNT} rules in the action engine, ${everything.length} of them currently apply to you.`}
        right={
          <button className="btn ghost small" onClick={() => setShowAll(v => !v)}>
            {showAll ? 'Hide' : 'Show all'}
          </button>
        }
      >
        {showAll && (
          <ul className="all-swaps">
            {everything.map(s => (
              <li key={s.id}>
                <span aria-hidden>{s.icon}</span>
                <div>
                  <strong>{s.title}</strong>
                  <small>{s.math}</small>
                </div>
                <span className="saving">{fmtKg(s.saving)}<small>/mo</small></span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SwapCard({ s, rank, onAccept }: { s: Suggestion; rank: number; onAccept: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`swap cat-${s.category}`}>
      <header>
        <span className="swap-rank">#{rank}</span>
        <span className="swap-icon" aria-hidden>{s.icon}</span>
        <div>
          <h3>{s.title}</h3>
          <p className="muted small">{s.habit}</p>
        </div>
      </header>

      <div className="swap-metrics">
        <div>
          <strong>{fmtKg(s.saving)}</strong>
          <small>saved a month</small>
        </div>
        <div>
          <strong>{fmtKg(s.saving * 12)}</strong>
          <small>a year</small>
        </div>
        <div>
          <strong>{'●'.repeat(s.ease)}<span className="dim">{'●'.repeat(5 - s.ease)}</span></strong>
          <small>{['very hard', 'hard', 'moderate', 'easy', 'trivial'][s.ease - 1]}</small>
        </div>
        <div>
          <strong>+{s.points}</strong>
          <small>green points</small>
        </div>
      </div>

      <p className="swap-do">{s.swap}</p>

      <div className="swap-actions">
        <button className="btn primary small" onClick={onAccept}>Accept for 7 days</button>
        <button className="linkbtn" onClick={() => setOpen(o => !o)}>
          {open ? 'Hide the maths' : 'Show the maths'}
        </button>
      </div>

      {open && (
        <pre className="swap-math">
          {s.math}
          {'\n= '}{round(s.saving, 2)} kg CO2e per month
        </pre>
      )}
    </article>
  );
}
