import { Hono } from 'hono';
import * as repo from './db/repo.ts';
import { refreshDemo } from './demo-refresh.ts';
import { demoEnabled, env, googleConfigured } from './env.ts';
import { appRoutes } from './routes/app.ts';
import { authRoutes } from './routes/auth.ts';
import { mindRoutes } from './routes/mind.ts';
import { fire } from './mind/checkpoints.ts';
import { mindEnabled } from './mind/client.ts';
import { fireCrossings } from './mind/nurture.ts';
import { openapi } from './openapi.ts';

export const app = new Hono();

app.get('/health', (c) => c.json({ ok: true, mindEnabled }));
app.get('/api/mode', (c) => c.json({ demo: demoEnabled, googleConfigured, liveMind: mindEnabled }));
// public so it can be pasted into the Minds chat without juggling the bearer token.
// The Mind builds its tool schema from `servers`, so the URL has to be absolute and has
// to be the one it can actually reach — a tunnel host, not localhost.
app.get('/v1/openapi.json', (c) =>
  c.json({
    ...openapi,
    servers: [{ url: env.PUBLIC_BASE_URL ?? new URL(c.req.url).origin, description: 'Growth API' }],
  }),
);

/**
 * One pass of the work the long-running server does on a timer. A serverless host has no
 * process to hold a timer in, so there it is driven by a scheduler calling this instead.
 * Registered ahead of `appRoutes`, whose session guard would answer 401 first.
 */
app.get('/api/cron/tick', async (c) => {
  const secret = env.CRON_SECRET ?? env.GROWTH_API_TOKEN;
  if (c.req.header('authorization') !== `Bearer ${secret}`) return c.json({ error: 'bad cron secret' }, 401);

  const due = await repo.dueCheckpoints();
  for (const checkpoint of due) {
    await fire(checkpoint).catch((err) => console.error('[checkpoint]', checkpoint.id, err));
  }
  await fireCrossings().catch((err) => console.error('[nurture]', err));
  const demo = demoEnabled ? await refreshDemo().catch(() => null) : null;

  return c.json({ checkpoints: due.length, demo });
});

app.route('/auth', authRoutes);
app.route('/api', appRoutes);
app.route('/v1', mindRoutes);

app.onError((err, c) => {
  console.error('[http]', err);
  return c.json({ error: err.message }, 500);
});
