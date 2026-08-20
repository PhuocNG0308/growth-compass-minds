import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env.ts';

const secret = Buffer.from(env.ENCRYPTION_KEY, 'hex');
export const SESSION_COOKIE = 'gc_channel';

const mac = (value: string) => createHmac('sha256', secret).update(value).digest('base64url');

export function sign(channelId: string): string {
  return `${channelId}.${mac(channelId)}`;
}

export function verify(cookie: string | undefined): string | null {
  const cut = cookie?.lastIndexOf('.') ?? -1;
  if (!cookie || cut < 1) return null;

  const channelId = cookie.slice(0, cut);
  const presented = Buffer.from(cookie.slice(cut + 1));
  const expected = Buffer.from(mac(channelId));
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) return null;
  return channelId;
}
