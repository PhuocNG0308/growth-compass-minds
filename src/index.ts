import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { env, unsetEnv } from './env.ts';
import { appRoutes } from './routes/app.ts';
import { authRoutes } from './routes/auth.ts';
import { mindRoutes } from './routes/mind.ts';
import { startCheckpointRunner } from './mind/checkpoints.ts';
import { mindEnabled } from './mind/client.ts';
import { openapi } from './openapi.ts';
import { reachableAt } from './net.ts';

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true, mindEnabled }));
app.get('/api/mode', (c) => c.json({ preview: false }));
// public so it can be pasted into the Minds chat without juggling the bearer token
app.get('/v1/openapi.json', (c) => c.json(openapi));
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

const stopRunner = hasDatabase ? startCheckpointRunner() : () => {};
const server = serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, ({ port }) =>
  console.log(
    ['', ...reachableAt(port).map((url) => `  ${url}`), mindEnabled ? '' : '  Mind notifications off', ''].join('\n'),
  ),
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopRunner();
    server.close(() => process.exit(0));
  });
}
