import postgres from 'postgres';
import { env } from '../env.ts';

export const sql = postgres(env.DATABASE_URL, {
  transform: postgres.camel,
  onnotice: () => {},
});
