import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import * as repo from '../db/repo.ts';
import { encrypt } from '../crypto.ts';
import { DEMO_YT_CHANNEL_ID } from '../demo.ts';
import { demoEnabled, env, googleConfigured } from '../env.ts';
import { SESSION_COOKIE, sign } from '../session.ts';
import { channelInfo } from '../youtube/data.ts';
import { consentUrl, exchangeCode } from '../youtube/oauth.ts';
import { ensureJob } from '../youtube/reporting.ts';
import { syncChannel } from '../youtube/sync.ts';

export const authRoutes = new Hono();

const secureCookies = new URL(env.GOOGLE_REDIRECT_URI).protocol === 'https:';

function startSession(c: Context, channelId: string) {
  setCookie(c, SESSION_COOKIE, sign(channelId), {
    httpOnly: true,
    sameSite: 'Lax',
    secure: secureCookies,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

authRoutes.get('/youtube', (c) =>
  // without credentials Google answers the redirect with `invalid_client`, which tells the
  // creator nothing; say what is actually missing instead of bouncing them off-site
  googleConfigured
    ? c.redirect(consentUrl(randomUUID()))
    : c.html(popupResult({ ok: false, error: 'google-unconfigured' }), 503),
);

authRoutes.post('/demo', async (c) => {
  if (!demoEnabled) return c.json({ error: 'demo-disabled' }, 404);

  const channel = await repo.getChannel(DEMO_YT_CHANNEL_ID);
  if (!channel) return c.json({ error: 'demo-not-seeded' }, 404);

  startSession(c, channel.id);
  return c.json({ ok: true, title: channel.title });
});

authRoutes.get('/youtube/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.html(popupResult({ ok: false, error: c.req.query('error') ?? 'missing code' }), 400);

  try {
    const { accessToken, refreshToken } = await exchangeCode(code);
    const info = await channelInfo(accessToken);
    const channel = await repo.upsertChannel({
      ytChannelId: info.ytChannelId,
      title: info.title,
      refreshToken: encrypt(refreshToken),
    });

    // Reach reports only start accruing once the job exists, so create it before the first sync.
    const jobId = await ensureJob(accessToken);
    await repo.setReportingJob(channel.id, jobId);

    void syncChannel({ ...channel, reportingJobId: jobId }, { videoLimit: 25, withComments: true }).catch(
      (err) => console.error('[initial-sync]', err),
    );

    startSession(c, channel.id);
    return c.html(popupResult({ ok: true, title: channel.title, channelId: channel.id }));
  } catch (err) {
    console.error('[oauth-callback]', err);
    return c.html(popupResult({ ok: false, error: 'could not connect the channel' }), 500);
  }
});

function popupResult(payload: Record<string, string | boolean>): string {
  const json = JSON.stringify({ type: 'youtube-connect', ...payload }).replaceAll('<', '\\u003c');
  const message = payload.ok ? 'Channel connected. You can close this window.' : String(payload.error);

  return `<!doctype html>
<meta charset="utf-8">
<title>Growth Compass</title>
<style>
  body { margin:0; display:grid; place-items:center; height:100vh; background:#0d1117; color:#e6edf3;
         font:15px/1.5 ui-sans-serif, system-ui, sans-serif; }
</style>
<p>${message}</p>
<script>
  const result = ${json};
  if (window.opener) {
    window.opener.postMessage(result, window.location.origin);
    window.close();
  } else {
    location.replace('/');
  }
</script>`;
}
