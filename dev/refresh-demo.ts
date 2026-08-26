import { sql } from '../src/db/client.ts';
import { refreshDemo } from '../src/demo-refresh.ts';

const result = await refreshDemo();
console.log(
  result
    ? `refreshed ${result.videos} videos, ${result.comments} comments`
    : 'no demo channel — run: npm run seed:demo',
);
await sql.end();
