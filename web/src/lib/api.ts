/**
 * API client with an offline fallback.
 *
 * Set VITE_API_BASE at build time to point the PWA at the Fastify service in
 * server/ (docker compose up brings it, Postgres and Redis online). With no API
 * configured — the case for the public GitHub Pages demo — the app runs in
 * local mode: IndexedDB is the store of record and the campus population comes
 * from the shared cohort model.
 *
 * Either way the UI calls the same functions, so nothing downstream has to know
 * which mode it is in.
 */

import type { Challenge, DayLog, LeagueRow, Profile } from '@carboncampus/shared';
import { drain, pending, queue } from './db';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

export type Mode = 'local' | 'api';

export const configuredMode: Mode = BASE ? 'api' : 'local';

let reachable = false;

export function apiConfigured(): boolean {
  return Boolean(BASE);
}

export function apiReachable(): boolean {
  return reachable;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

/** Cheap liveness probe; also decides whether the outbox should be replayed. */
export async function ping(): Promise<boolean> {
  if (!BASE) { reachable = false; return false; }
  try {
    const ctl = AbortController ? new AbortController() : undefined;
    const timer = ctl ? setTimeout(() => ctl.abort(), 2500) : undefined;
    const res = await fetch(`${BASE}/api/health`, { signal: ctl?.signal });
    if (timer) clearTimeout(timer);
    reachable = res.ok;
  } catch {
    reachable = false;
  }
  return reachable;
}

/* ------------------------------------------------------------------ *
 * Writes — always local first, queued for the server when there is one
 * ------------------------------------------------------------------ */

export async function syncLog(log: DayLog): Promise<void> {
  if (!BASE) return;
  try {
    await call('/api/logs', { method: 'POST', body: JSON.stringify(log) });
  } catch {
    await queue('log', log);
  }
}

export async function syncChallenge(c: Challenge): Promise<void> {
  if (!BASE) return;
  try {
    await call('/api/challenges', { method: 'POST', body: JSON.stringify(c) });
  } catch {
    await queue('challenge', c);
  }
}

export async function syncProfile(p: Profile): Promise<void> {
  if (!BASE) return;
  try {
    await call('/api/profile', { method: 'POST', body: JSON.stringify(p) });
  } catch {
    await queue('profile', p);
  }
}

/** Replay anything that was written while the network was down. */
export async function flushOutbox(): Promise<number> {
  if (!BASE || !(await ping())) return 0;
  const items = await pending();
  const done: number[] = [];
  for (const item of items) {
    const path = item.kind === 'log' ? '/api/logs'
      : item.kind === 'challenge' ? '/api/challenges'
      : '/api/profile';
    try {
      await call(path, { method: 'POST', body: JSON.stringify(item.payload) });
      if (item.id != null) done.push(item.id);
    } catch {
      break;                 // still down; keep the rest queued in order
    }
  }
  if (done.length) await drain(done);
  return done.length;
}

/* ------------------------------------------------------------------ *
 * Reads — the server wins when it is up, the cohort model fills in
 * ------------------------------------------------------------------ */

export async function fetchHostelLeague(): Promise<LeagueRow[] | null> {
  if (!BASE) return null;
  try {
    return await call<LeagueRow[]>('/api/leaderboard/hostel');
  } catch {
    return null;
  }
}

export async function fetchDeptLeague(): Promise<LeagueRow[] | null> {
  if (!BASE) return null;
  try {
    return await call<LeagueRow[]>('/api/leaderboard/dept');
  } catch {
    return null;
  }
}

export async function fetchCampusReport(days = 30): Promise<unknown | null> {
  if (!BASE) return null;
  try {
    return await call(`/api/admin/report?days=${days}`);
  } catch {
    return null;
  }
}
