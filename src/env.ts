import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { z } from 'zod';

if (existsSync('.env')) process.loadEnvFile('.env');

// On Vercel the Mind's callback host is only known once the project has a domain, and it is
// the one URL that cannot be guessed wrong without the Mind losing its tool.
if (!process.env.PUBLIC_BASE_URL && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  process.env.PUBLIC_BASE_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
}

const schema = z.object({
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: z.string().length(64),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.url(),
  GROWTH_API_TOKEN: z.string().min(32),
  PUBLIC_BASE_URL: z.url().optional(),
  MINDS_BUILDER_API_KEY: z.string().optional(),
  // shared with the scheduler that drives /api/cron/tick where no process can hold a timer
  CRON_SECRET: z.string().optional(),
  MIND_ID: z.string().optional(),
  MIND_CONVERSATION_ALIAS: z.string().default('growth'),
  YOUTUBE_REPLIES: z.enum(['on', 'off']).default('on'),
  // public reads only: comments, durations and live chat. Never the owner-only Analytics API.
  YOUTUBE_API_KEY: z.string().min(1).optional(),
  DEMO_SOURCE_CHANNEL: z.string().default('@HardwareHaven'),
  // a channel that is always on air, so the live strip has something to show at any hour
  DEMO_LIVE_CHANNEL: z.string().default('@LofiGirl'),
  DEMO_MODE: z.enum(['on', 'off']).default('off'),
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

// Without these a deployment is not degraded, it is broken: nothing can be stored, sessions
// cannot survive a restart, and the Mind cannot authenticate. Google's three are different —
// leaving them out only closes the Connect YouTube door, which the sample channel does not use.
const REQUIRED_IN_PRODUCTION = ['DATABASE_URL', 'ENCRYPTION_KEY', 'GROWTH_API_TOKEN'];

function degraded() {
  const fatal = unsetEnv.filter((key) => REQUIRED_IN_PRODUCTION.includes(key));
  if (process.env.NODE_ENV === 'production' && fatal.length > 0) {
    throw new Error(`missing required configuration: ${fatal.join(', ')}`);
  }

  const standIn = fallbacks(process.env.PORT ?? '8080');
  const patched = { ...process.env };
  for (const key of unsetEnv) patched[key] = standIn[key];

  // spelling out only the consequences that actually apply, so the warning stays true
  const consequence: Record<string, string> = {
    DATABASE_URL: 'nothing can be stored or read',
    ENCRYPTION_KEY: 'a throwaway key is generated each boot, so sessions end at restart',
    GOOGLE_CLIENT_ID: 'connecting a YouTube channel will fail',
    GOOGLE_CLIENT_SECRET: 'connecting a YouTube channel will fail',
    GOOGLE_REDIRECT_URI: 'connecting a YouTube channel will fail',
    GROWTH_API_TOKEN: 'the Mind cannot authenticate against /v1',
  };

  console.warn(
    [
      '',
      `  Missing or invalid in .env: ${unsetEnv.join(', ')}`,
      ...[...new Set(unsetEnv.map((key) => consequence[key]).filter(Boolean))].map(
        (line) => `    - ${line}`,
      ),
      '',
      '  See docs/05-integration.md §6b. To browse the interface without Google,',
      '  set DEMO_MODE=on and run: npm run seed:demo',
      '',
    ].join('\n'),
  );

  return schema.parse(patched);
}

export const env = parsed.success ? parsed.data : degraded();

const GOOGLE_KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];

export const googleConfigured = !GOOGLE_KEYS.some((key) => unsetEnv.includes(key));
export const demoEnabled = env.DEMO_MODE === 'on';
