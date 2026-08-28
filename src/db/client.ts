import postgres from 'postgres';
import { env } from '../env.ts';

// A serverless invocation is one request in a container that may be frozen straight after,
// so it opens one connection and holds none idle. Named prepared statements are dropped
// because the pooled endpoints these hosts hand out (PgBouncer in transaction mode) give a
// different backend to every statement.
const serverless = process.env.VERCEL === '1';

export const sql = postgres(env.DATABASE_URL, {
  transform: postgres.camel,
  onnotice: () => {},
  ...(serverless ? { max: 1, idle_timeout: 20, prepare: false } : {}),
  types: {
    // postgres.js hands back int8 and numeric as strings, but src/types.ts declares views,
    // impressions, ctr and avg_view_pct as `number` and the API ships them straight to the
    // charts — where "4.3" plots at a different place from 4.3, silently.
    bigint: { to: 20, from: [20], serialize: String, parse: Number },
    numeric: { to: 1700, from: [1700], serialize: String, parse: Number },
  },
});
