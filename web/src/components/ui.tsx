/**
 * Small shared UI pieces. Deliberately plain — the interesting code is in the
 * engine, and the interface should stay out of a student's way for the sixty
 * seconds a day they spend in it.
 */

import type { ReactNode } from 'react';
import { sourcesFor, type Source } from '@carboncampus/shared';

export function Card({
  title, sub, right, children, className = '', id
}: {
  title?: ReactNode; sub?: ReactNode; right?: ReactNode;
  children: ReactNode; className?: string; id?: string;
}) {
  return (
    <section className={`card ${className}`} id={id}>
      {(title || right) && (
        <header className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <p className="card-sub">{sub}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label, value, unit, hint, tone
}: {
  label: string; value: ReactNode; unit?: string; hint?: ReactNode;
  tone?: 'good' | 'bad' | 'neutral';
}) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}{unit && <small>{unit}</small>}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function Pill({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

/** Numeric stepper with big tap targets — the core of the sixty-second log. */
export function Stepper({
  label, icon, value, onChange, step = 1, min = 0, max = 99, unit, hint
}: {
  label: string; icon?: string; value: number;
  onChange: (v: number) => void;
  step?: number; min?: number; max?: number; unit?: string; hint?: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v * 100) / 100));
  return (
    <div className={`stepper${value > 0 ? ' active' : ''}`}>
      <div className="stepper-label">
        {icon && <span className="stepper-icon">{icon}</span>}
        <span>
          {label}
          {hint && <small>{hint}</small>}
        </span>
      </div>
      <div className="stepper-controls">
        <button type="button" aria-label={`Less ${label}`} onClick={() => onChange(clamp(value - step))}
                disabled={value <= min}>−</button>
        <span className="stepper-value">
          {value % 1 === 0 ? value : value.toFixed(1)}{unit && <small>{unit}</small>}
        </span>
        <button type="button" aria-label={`More ${label}`} onClick={() => onChange(clamp(value + step))}
                disabled={value >= max}>+</button>
      </div>
    </div>
  );
}

export function ChipGroup<T extends string>({
  options, value, onChange, multiple = false
}: {
  options: { value: T; label: string; icon?: string }[];
  value: T | T[];
  onChange: (v: T) => void;
  multiple?: boolean;
}) {
  const selected = (v: T) => (multiple ? (value as T[]).includes(v) : value === v);
  return (
    <div className="chips" role={multiple ? 'group' : 'radiogroup'}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          className={`chip${selected(o.value) ? ' on' : ''}`}
          aria-pressed={selected(o.value)}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <span aria-hidden>{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Renders "Source: CEA ↗" links from a factor's srcId. */
export function SourceLinks({ ids, prefix = 'Source' }: { ids?: string | string[]; prefix?: string }) {
  const list: Source[] = sourcesFor(ids);
  if (!list.length) return null;
  return (
    <p className="srcline">
      {prefix}:{' '}
      {list.map((s, i) => (
        <span key={s.id}>
          {i > 0 && ', '}
          <a href={s.url} target="_blank" rel="noreferrer noopener" title={`${s.name} — ${s.org}`}>
            {s.org.split('(')[0].trim().split(',')[0]} ↗
          </a>
        </span>
      ))}
    </p>
  );
}

export function EmptyState({ icon, title, body, action }: {
  icon: string; title: string; body: string; action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden>{icon}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function ProgressRing({ pct, size = 54, label }: { pct: number; size?: number; label?: string }) {
  const thickness = 6;
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="ring"
         role="img" aria-label={label ?? `${Math.round(p * 100)} percent`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--green)" strokeWidth={thickness}
              strokeDasharray={`${p * circ} ${circ}`} strokeLinecap="round"
              transform={`rotate(-90 ${c} ${c})`} />
      <text x={c} y={c} textAnchor="middle" dy="0.35em" className="ring-text">
        {Math.round(p * 100)}%
      </text>
    </svg>
  );
}
