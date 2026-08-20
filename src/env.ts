import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { z } from 'zod';

if (existsSync('.env')) process.loadEnvFile('.env');

const schema = z.object({
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: z.string().length(64),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.url(),
  GROWTH_API_TOKEN: z.string().min(32),
  MINDS_BUILDER_API_KEY: z.string().optional(),
  MIND_ID: z.string().optional(),
  MIND_CONVERSATION_ALIAS: z.string().default('growth'),
  CHECKPOINT_POLL_MS: z.coerce.number().default(60_000),
});

const parsed = schema.safeParse(process.env);

export const unsetEnv = parsed.success
  ? []
  : [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];

function fallbacks(port: string) {
  return {
    DATABASE_URL: 'postgres://unset',
    ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    GOOGLE_CLIENT_ID: 'unset',
    GOOGLE_CLIENT_SECRET: 'unset',
    GOOGLE_REDIRECT_URI: `http://localhost:${port}/auth/youtube/callback`,
    GROWTH_API_TOKEN: randomBytes(32).toString('hex'),
  } as Record<string, string>;
}

function degraded() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`missing required configuration: ${unsetEnv.join(', ')}`);
  }

  const standIn = fallbacks(process.env.PORT ?? '8080');
  const patched = { ...process.env };
  for (const key of unsetEnv) patched[key] = standIn[key];

  console.warn(
    [
      '',
      `  Missing or invalid in .env: ${unsetEnv.join(', ')}`,
      '  Copy .env.example to .env and fill them in — see docs/05-integration.md §6b.',
      '',
      '  Booting with throwaway values. Connecting a channel and reading the ledger will fail,',
      '  and ENCRYPTION_KEY is regenerated on every boot, so sessions end at restart.',
      '  To browse the interface without any of this, run: npm run preview',
      '',
    ].join('\n'),
  );

  return schema.parse(patched);
}

export const env = parsed.success ? parsed.data : degraded();
