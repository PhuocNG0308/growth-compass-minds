import { DEMO_REFRESH_TOKEN } from '../demo.ts';
import { env, googleConfigured } from '../env.ts';
import { decrypt } from '../crypto.ts';
import type { Channel } from '../types.ts';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * force-ssl is what makes comments.insert possible. It is a write scope, so the promise
 * changes from "we cannot post" to "nothing posts without the creator pressing Send" —
 * enforced in the API, which has no path that publishes on the Mind's behalf.
 */
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  ...(env.YOUTUBE_REPLIES === 'off' ? [] : ['https://www.googleapis.com/auth/youtube.force-ssl']),
];

export const repliesEnabled = env.YOUTUBE_REPLIES !== 'off';

export function consentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`google token ${res.status}: ${await res.text()}`);
  return res.json() as Promise<TokenResponse>;
}

export async function exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
  const token = await requestToken({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  if (!token.refresh_token) {
    throw new Error('google returned no refresh_token; revoke prior grant and retry');
  }
  return { accessToken: token.access_token, refreshToken: token.refresh_token };
}

const cache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Whether this channel can be read from Google at all. A channel connected through OAuth
 * always can, and always should be — this is only ever false for one seeded without a real
 * refresh token, which is the sample channel. Its numbers come from the public refresher.
 */
export function syncable(channel: Channel): boolean {
  return googleConfigured && decrypt(channel.refreshToken) !== DEMO_REFRESH_TOKEN;
}

export async function accessTokenFor(channel: Channel): Promise<string> {
  const hit = cache.get(channel.id);
  if (hit && hit.expiresAt > Date.now()) return hit.token;

  const token = await requestToken({
    refresh_token: decrypt(channel.refreshToken),
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  cache.set(channel.id, {
    token: token.access_token,
    expiresAt: Date.now() + (token.expires_in - 60) * 1000,
  });
  return token.access_token;
}

export async function googleFetch<T>(accessToken: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`${new URL(url).pathname} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}
