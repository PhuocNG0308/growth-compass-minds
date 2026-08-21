import { readdir, readFile } from 'node:fs/promises';
import { sql } from './client.ts';

const DIR = new URL('./migrations/', import.meta.url);

// Two deploys starting at once would otherwise both run the same DDL. The lock is held for
// the whole run and released when the session ends, so a crash cannot leave it stuck.
const LOCK = 8_240_251;

await sql`
  create table if not exists schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )`;

await sql`select pg_advisory_lock(${LOCK})`;

try {
  const files = (await readdir(DIR)).filter((name) => name.endsWith('.sql')).sort();
  const done = new Set(
    (await sql<Array<{ version: string }>>`select version from schema_migrations`).map(
      (row) => row.version,
    ),
  );

  let applied = 0;
  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (done.has(version)) continue;

    const body = await readFile(new URL(file, DIR), 'utf8');
    // one transaction per file, so a failure half way leaves nothing behind to guess at
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (version) values (${version})`;
    });

    console.log(`applied ${version}`);
    applied += 1;
  }

  console.log(applied === 0 ? 'schema already up to date' : `${applied} migration(s) applied`);
} finally {
  await sql`select pg_advisory_unlock(${LOCK})`;
  await sql.end();
}
