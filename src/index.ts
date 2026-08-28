import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { app } from './app.ts';
import { sql } from './db/client.ts';
import { demoEnabled, env, unsetEnv } from './env.ts';
import { startCheckpointRunner } from './mind/checkpoints.ts';
import { startNurtureRunner } from './mind/nurture.ts';
import { startDemoRefresh } from './demo-refresh.ts';
import { mindEnabled, refreshCognition } from './mind/client.ts';
import { reachableAt } from './net.ts';

// registered here rather than in the app itself: on a serverless host the CDN owns the
// built frontend and the function never sees a request for it
app.use('/*', serveStatic({ root: './web/dist' }));

const hasDatabase = !unsetEnv.includes('DATABASE_URL');
if (!hasDatabase) console.warn('  Checkpoint runner is off until DATABASE_URL is set.\n');

// warmed at boot so the first page load already knows whether to warn
if (mindEnabled) void refreshCognition();

const stopRunner = hasDatabase ? startCheckpointRunner() : () => {};
const stopNurture = hasDatabase ? startNurtureRunner() : () => {};
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
    stopNurture();
    stopDemo();
    server.close(() => void sql.end({ timeout: 5 }).then(() => process.exit(0)));
  });
}
