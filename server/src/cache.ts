/**
 * Redis cache.
 *
 * Leaderboards are read constantly and change slowly, so they are cached for a
 * minute. Redis is treated as optional: if it is not reachable, every helper
 * degrades to "no cache" rather than taking the API down with it.
 */

import Redis from 'ioredis';

const URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

let client: Redis | null = null;
let warned = false;

export function redis(): Redis | null {
  if (client) return client;
  try {
    client = new Redis(URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      retryStrategy: times => (times > 3 ? null : Math.min(times * 200, 1000))
    });
    client.on('error', () => {
      if (!warned) {
        console.warn('[cache] Redis unavailable — serving uncached responses');
        warned = true;
      }
    });
    return client;
  } catch {
    return null;
  }
}

export async function cached<T>(key: string, ttlSeconds: number, produce: () => Promise<T>): Promise<T> {
  const r = redis();
  if (r && r.status === 'ready') {
    try {
      const hit = await r.get(key);
      if (hit) return JSON.parse(hit) as T;
    } catch { /* fall through to the source of truth */ }
  }

  const value = await produce();

  if (r && r.status === 'ready') {
    try {
      await r.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch { /* a cache write failing is not an error worth surfacing */ }
  }
  return value;
}

export async function bust(prefix: string): Promise<void> {
  const r = redis();
  if (!r || r.status !== 'ready') return;
  try {
    const keys = await r.keys(`${prefix}*`);
    if (keys.length) await r.del(...keys);
  } catch { /* ignore */ }
}

export async function cacheHealthy(): Promise<boolean> {
  const r = redis();
  if (!r) return false;
  try {
    return (await r.ping()) === 'PONG';
  } catch {
    return false;
  }
}
