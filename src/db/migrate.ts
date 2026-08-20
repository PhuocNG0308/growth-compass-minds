import { readFile } from 'node:fs/promises';
import { sql } from './client.ts';

const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
await sql.unsafe(schema);
console.log('schema applied');
await sql.end();
