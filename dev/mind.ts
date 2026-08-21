/** Operator console for the Mind: what it is configured with, and the setup conversation. */

import { appendFileSync, mkdirSync } from 'node:fs';
import { env } from '../src/env.ts';
import { plain } from '../src/mind/ask.ts';
import { conversation, mindEnabled, mindSession } from '../src/mind/client.ts';
import { TURNS, turn, type Turn } from './mind-bootstrap.ts';

const TRANSCRIPT = 'docs/_evidence/mind-bootstrap.md';
const SKILLS = TURNS.filter((t) => t.id.startsWith('skill-')).map((t) => t.id.slice('skill-'.length));

function render(t: Turn): string {
  if (t.text.includes('{{BASE}}') && !env.PUBLIC_BASE_URL) {
    throw new Error(
      `turn "${t.id}" hands the Mind a URL it has to call. Set PUBLIC_BASE_URL in .env to a host\n` +
        'reachable from outside this machine (a tunnel or a deploy) — the Mind cannot reach localhost.',
    );
  }
  return t.text
    .replaceAll('{{BASE}}', env.PUBLIC_BASE_URL ?? '')
    .replaceAll('{{TOKEN}}', env.GROWTH_API_TOKEN)
    .split('{{TUNNEL_NOTE}}\n')
    .join(tunnelNote());
}

/**
 * An ngrok free tunnel answers browser-shaped requests with an HTML interstitial instead of
 * the response, and we do not control what user agent the Mind sends.
 */
function tunnelNote(): string {
  if (!/ngrok/.test(env.PUBLIC_BASE_URL ?? '')) return '';
  return [
    '- The host is an ngrok tunnel. It answers browser-shaped requests with an HTML warning',
    '  page instead of the data, so send  ngrok-skip-browser-warning: 1  as a second header',
    '  on every call.',
    '',
  ].join('\n');
}

/** The bearer token travels to the Mind but must not land in a file we commit. */
const redact = (text: string) => text.replaceAll(env.GROWTH_API_TOKEN, '<GROWTH_API_TOKEN>');

function record(title: string, sent: string, reply: string | null) {
  mkdirSync('docs/_evidence', { recursive: true });
  appendFileSync(
    TRANSCRIPT,
    [
      '',
      `## ${title}`,
      '',
      `*${new Date().toISOString()}*`,
      '',
      '**Operator**',
      '',
      '```text',
      redact(sent),
      '```',
      '',
      '**Mind**',
      '',
      '```text',
      reply ?? '(no reply within the timeout)',
      '```',
      '',
    ].join('\n'),
  );
}

async function repliesSince(alias: string, sentAt: string): Promise<string> {
  const { client } = await conversation(alias);
  const rows = await client.getHistory(alias, { limit: 20 }).catch(() => []);
  return rows
    .filter((row) => row.senderType !== 1 && (row.createdAt ?? '') > sentAt)
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
    .map((row) => row.messageText ?? '')
    .join('\n\n');
}

async function say(title: string, messageText: string) {
  const { client, alias } = await conversation(env.MIND_CONVERSATION_ALIAS);
  const since = await client.getLatestHistoryFingerprint(alias).catch(() => undefined);

  console.log(`\n→ ${title}  (waiting, up to 5 min)`);
  const sentAt = new Date().toISOString();
  await client.sendMessage({ alias, messageText });
  const outcome = await client.waitForReply({ alias, timeoutMs: 300_000, afterFingerprint: since });
  // A build turn comes back as several messages, and waitForReply returns only the first —
  // which, mid-run, can still be the tail of the previous turn. Read the window instead.
  const window = outcome.timedOut ? '' : await repliesSince(alias, sentAt);
  const reply = outcome.timedOut ? null : plain(window || (outcome.reply.messageText ?? ''));

  record(title, messageText, reply);
  console.log(reply ? `\n${reply}\n` : '\n  timed out — it may still answer; check `npm run mind history`\n');
}

const row = (label: string, value: string | null, fix: string) =>
  `    ${value ? '[x]' : '[ ]'} ${label.padEnd(28)} ${value ?? fix}`;

async function status() {
  const { client, mindId } = await mindSession();
  const [mind, balance, skills, apps, conversations] = await Promise.all([
    client.getMind(mindId),
    client.getCognitionBalance(mindId).catch(() => null),
    client.listEquippedSkills(mindId),
    client.listEquippedApps(mindId),
    client.listConversations().catch(() => []),
  ]);

  const equipped = (name: string) => skills.some((s) => (s.name ?? '').toLowerCase().includes(name));
  const growthApp = apps.find((a) => /growth/i.test(a.appName ?? ''));

  console.log(
    [
      '',
      `  ${mind.name}  ${mindId}`,
      `  ${mind.email}   ${mind.isEnabled ? 'enabled' : 'DISABLED'}   cognition ${balance?.cognition.toFixed(1) ?? '?'}   conversations ${conversations.length}`,
      '',
      '  equipped skills:',
      ...skills.map((s) => `    ${s.name}`),
      '  equipped apps:',
      ...apps.map((a) => `    ${a.appName}`),
      '',
      '  integration depth:',
      row('Growth API app equipped', growthApp ? (growthApp.appName ?? 'equipped') : null, 'send the `connect` turn'),
      ...SKILLS.map((name) => row(`skill ${name}`, equipped(name) ? 'equipped' : null, `send the \`skill-${name}\` turn`)),
      row('Telegram connected', mind.telegramBotId ? String(mind.telegramBotId) : null, 'connect it on hellominds.ai, then send the `autonomy` turn'),
      row('public base URL', env.PUBLIC_BASE_URL ?? null, 'set PUBLIC_BASE_URL — the Mind cannot call localhost'),
      '',
    ].join('\n'),
  );
}

async function history() {
  const { client, alias } = await conversation(env.MIND_CONVERSATION_ALIAS);
  const rows = await client.getHistory(alias, { limit: 20 });
  for (const row of rows.slice().reverse()) {
    const who = row.senderType === 1 ? 'operator' : 'mind';
    console.log(`\n[${row.createdAt ?? ''}] ${who}\n${redact(plain(row.messageText ?? '')).slice(0, 1500)}`);
  }
}

const [command = 'status', ...rest] = process.argv.slice(2);

if (!mindEnabled) {
  console.error('MINDS_BUILDER_API_KEY is unset — nothing to talk to.');
  process.exit(1);
}

switch (command) {
  case 'status':
    await status();
    break;

  case 'script':
    console.log(['', ...TURNS.map((t) => `  ${t.id.padEnd(24)} ${t.title}`), ''].join('\n'));
    break;

  case 'show':
    for (const id of rest) {
      const t = turn(id);
      if (!t) throw new Error(`no turn "${id}" — run \`npm run mind script\``);
      console.log(`\n--- ${t.title} ---\n${redact(render(t))}`);
    }
    break;

  case 'send':
    for (const id of rest) {
      const t = turn(id);
      if (!t) throw new Error(`no turn "${id}" — run \`npm run mind script\``);
      await say(t.title, render(t));
    }
    break;

  case 'ask':
    await say('Ad-hoc', rest.join(' '));
    break;

  case 'history':
    await history();
    break;

  default:
    console.log('usage: npm run mind [status|script|show <id>|send <id...>|ask "<text>"|history]');
}

process.exit(0);
