/**
 * Offline-first storage.
 *
 * Everything the student does is written to IndexedDB first and answered from
 * there, so the app works on hostel Wi-Fi that comes and goes. When an API is
 * configured, writes are also queued in an outbox and replayed on reconnect.
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { Challenge, DayLog, Profile } from '@carboncampus/shared';

const DB_NAME = 'carboncampus';
const DB_VERSION = 1;

export interface OutboxItem {
  id?: number;
  kind: 'log' | 'challenge' | 'profile';
  payload: unknown;
  queuedAt: string;
}

interface CCSchema extends DBSchema {
  logs: { key: string; value: DayLog };
  challenges: { key: string; value: Challenge };
  meta: { key: string; value: unknown };
  outbox: { key: number; value: OutboxItem };
}

let dbp: Promise<IDBPDatabase<CCSchema>> | null = null;

function db(): Promise<IDBPDatabase<CCSchema>> {
  if (!dbp) {
    dbp = openDB<CCSchema>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('logs')) {
          database.createObjectStore('logs', { keyPath: 'date' });
        }
        if (!database.objectStoreNames.contains('challenges')) {
          database.createObjectStore('challenges', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('meta')) {
          database.createObjectStore('meta');
        }
        if (!database.objectStoreNames.contains('outbox')) {
          database.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
        }
      }
    });
  }
  return dbp;
}

/* ----------------------------- logs ----------------------------- */

export async function putLog(log: DayLog): Promise<void> {
  await (await db()).put('logs', log);
}

export async function putLogs(logs: DayLog[]): Promise<void> {
  const tx = (await db()).transaction('logs', 'readwrite');
  await Promise.all(logs.map(l => tx.store.put(l)));
  await tx.done;
}

export async function allLogs(): Promise<DayLog[]> {
  const rows: DayLog[] = await (await db()).getAll('logs');
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getLog(date: string): Promise<DayLog | undefined> {
  return (await db()).get('logs', date);
}

export async function deleteLog(date: string): Promise<void> {
  await (await db()).delete('logs', date);
}

export async function clearLogs(): Promise<void> {
  await (await db()).clear('logs');
}

/* -------------------------- challenges -------------------------- */

export async function putChallenge(c: Challenge): Promise<void> {
  await (await db()).put('challenges', c);
}

export async function allChallenges(): Promise<Challenge[]> {
  return (await db()).getAll('challenges');
}

export async function clearChallenges(): Promise<void> {
  await (await db()).clear('challenges');
}

/* ----------------------------- meta ----------------------------- */

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db()).get('meta', key) as Promise<T | undefined>;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await db()).put('meta', value, key);
}

export async function getProfile(): Promise<Profile | undefined> {
  return getMeta<Profile>('profile');
}

export async function setProfile(p: Profile): Promise<void> {
  await setMeta('profile', p);
}

/* ---------------------------- outbox ---------------------------- */

export async function queue(kind: OutboxItem['kind'], payload: unknown): Promise<void> {
  await (await db()).add('outbox', { kind, payload, queuedAt: new Date().toISOString() });
}

export async function pending(): Promise<OutboxItem[]> {
  return (await db()).getAll('outbox');
}

export async function drain(ids: number[]): Promise<void> {
  const tx = (await db()).transaction('outbox', 'readwrite');
  await Promise.all(ids.map(id => tx.store.delete(id)));
  await tx.done;
}

/** Wipe every trace of this user from the device. */
export async function wipe(): Promise<void> {
  const database = await db();
  await Promise.all([
    database.clear('logs'),
    database.clear('challenges'),
    database.clear('meta'),
    database.clear('outbox')
  ]);
}
