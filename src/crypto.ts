import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from './env.ts';

const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
const IV_LEN = 12;
const TAG_LEN = 16;

export function encrypt(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, IV_LEN));
  decipher.setAuthTag(raw.subarray(IV_LEN, IV_LEN + TAG_LEN));
  return Buffer.concat([decipher.update(raw.subarray(IV_LEN + TAG_LEN)), decipher.final()]).toString('utf8');
}
