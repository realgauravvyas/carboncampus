/**
 * CarbonCampus API.
 *
 * Fastify + PostgreSQL + Redis, exactly as scoped in the proposal. It shares
 * the emission engine with the PWA, so the number on a student's dashboard and
 * the number in the institute's inventory come from one implementation.
 *
 * The public demo on GitHub Pages runs without this service — the PWA falls
 * back to IndexedDB. Bring the whole stack up with `docker compose up`.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { REGISTRY_VERSION } from '@carboncampus/shared';
import { healthy, migrate } from './db.js';
import { cacheHealthy } from './cache.js';
import logRoutes from './routes/logs.js';
import leaderboardRoutes from './routes/leaderboard.js';
import adminRoutes from './routes/admin.js';

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
  }
});

await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(',') ?? true,
  methods: ['GET', 'POST', 'OPTIONS']
});

app.get('/api/health', async () => ({
  ok: true,
  service: 'carboncampus-api',
  factorVersion: REGISTRY_VERSION,
  database: await healthy(),
  cache: await cacheHealthy(),
  time: new Date().toISOString()
}));

await app.register(logRoutes);
await app.register(leaderboardRoutes);
await app.register(adminRoutes);

try {
  await migrate();
  app.log.info('schema applied');
} catch (err) {
  // A missing database should not stop the process during local development:
  // the health endpoint reports it, and the PWA carries on in offline mode.
  app.log.error({ err }, 'could not apply schema — is PostgreSQL running?');
}

await app.listen({ port: PORT, host: HOST });
app.log.info(`CarbonCampus API listening on ${HOST}:${PORT} (factors v${REGISTRY_VERSION})`);
