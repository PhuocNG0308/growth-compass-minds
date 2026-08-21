import postgres from 'postgres';
import { env } from '../env.ts';

export const sql = postgres(env.DATABASE_URL, {
  transform: postgres.camel,
  onnotice: () => {},
  types: {
    // postgres.js hands back int8 and numeric as strings, but src/types.ts declares views,
    // impressions, ctr and avg_view_pct as `number` and the API ships them straight to the
    // charts — where "4.3" plots at a different place from 4.3, silently.
    bigint: { to: 20, from: [20], serialize: String, parse: Number },
    numeric: { to: 1700, from: [1700], serialize: String, parse: Number },
  },
});
