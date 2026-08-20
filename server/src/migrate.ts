/** Applies db/schema.sql and exits. Run with: npm run migrate --workspace @carboncampus/server */
import { migrate, pool } from './db.js';

await migrate();
console.log('Schema applied.');
await pool.end();
