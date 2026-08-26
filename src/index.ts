import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { sql } from './db/client.ts';
import { demoEnabled, env, googleConfigured, unsetEnv } from './env.ts';
import { appRoutes } from './routes/app.ts';
import { authRoutes } from './routes/auth.ts';
import { mindRoutes } from './routes/mind.ts';
import { startCheckpointRunner } from './mind/checkpoints.ts';
import { startDemoRefresh } from './demo-refresh.ts';
import { mindEnabled, refreshCognition } from './mind/client.ts';
import { openapi } from './openapi.ts';
import { reachableAt } from './net.ts';

const app = new Hono();

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
app.route('/auth', authRoutes);
app.route('/api', appRoutes);
app.route('/v1', mindRoutes);
app.use('/*', serveStatic({ root: './web/dist' }));

app.onError((err, c) => {
  console.error('[http]', err);
  return c.json({ error: err.message }, 500);
});

const hasDatabase = !unsetEnv.includes('DATABASE_URL');
if (!hasDatabase) console.warn('  Checkpoint runner is off until DATABASE_URL is set.\n');

// warmed at boot so the first page load already knows whether to warn
if (mindEnabled) void refreshCognition();

const stopRunner = hasDatabase ? startCheckpointRunner() : () => {};
// the sample channel mirrors a real one, so it has to keep up with it
const stopDemo = hasDatabase && demoEnabled ? startDemoRefresh() : () => {};
const server = serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, ({ port }) =>
  console.log(
    ['', ...reachableAt(port).map((url) => `  ${url}`), mindEnabled ? '' : '  Mind notifications off', ''].join('\n'),
  ),
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopRunner();
    stopDemo();
    server.close(() => void sql.end({ timeout: 5 }).then(() => process.exit(0)));
  });
}
