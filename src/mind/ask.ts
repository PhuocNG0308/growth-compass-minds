import { cognition, conversation, mindEnabled, refreshCognition } from './client.ts';
import { sandbox, sandboxEnabled } from '../sandbox.ts';

export type AskContext = {
  /** Conversation to speak into; defaults to one per video. */
  alias?: string;
  channelTitle: string;
  ytVideoId: string;
  title: string;
  publishedAt: string;
  metrics: Record<string, number | null>;
  dropOffs: Array<{ ratio: number; drop: number }> | null;
  segments: Record<string, number>;
  comments: Array<{ segment: string; displayName: string; viewerCommentCount: number; text: string }>;
  /** Blocks pulled in by @-mentions, so the Mind sees what the creator was pointing at. */
  extra?: string[];
};

export type ChatTurn = { role: 'creator' | 'mind'; text: string; at: string };

export const aliasFor = (subject: string) =>
  subject.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 60);

/**
 * Without this briefing the Mind answers about the channel in general. With it, it
 * answers about the audience of this one video, which is what the creator asked.
 */
function brief(context: AskContext, question: string): string {
  return [
    `The creator is asking about one video on "${context.channelTitle}".`,
    `video: ${context.ytVideoId} — ${context.title}`,
    `published: ${context.publishedAt.slice(0, 10)}`,
    `metrics: ${JSON.stringify(context.metrics)}`,
    context.dropOffs ? `steepestDropOffs: ${JSON.stringify(context.dropOffs)}` : 'retention: unavailable',
    `audience on this video: ${JSON.stringify(context.segments)}`,
    '',
    'comments, each with the tag to cite it by:',
    ...context.comments.map(
      (c, i) =>
        `- [c${i + 1}] [${c.segment}, ${c.viewerCommentCount}x] ${c.displayName}: ${c.text.replace(/\s+/g, ' ').slice(0, 240)}`,
    ),
    '',
    ...(context.extra?.length ? ['Also in scope, because the creator pointed at it:', '', ...context.extra, ''] : []),
    `Question: ${question}`,
    '',
    'Answer from the numbers and comments above plus what you remember about this channel.',
    'Say plainly when the sample is too small to conclude. Keep it under 120 words.',
    // the creator has the same numbers open on screen; a claim they can click back to is a
    // claim they can check, and one they cannot is one they have to take on faith
    'When a comment is what makes you say something, put its tag right after that sentence,',
    'like [c3]. When a moment in the video is, cite it the same way with the elapsed ratio',
    'from steepestDropOffs, like [t=0.42]. Only ever cite tags and ratios that appear above.',
  ].join('\n');
}

// measured replies have taken 135-163s regardless of how long the briefing is, so the wait
// is the platform's, not ours: a caller gets the alias now and the answer minutes later
const REPLY_TIMEOUT_MS = 240_000;

export type AskOutcome = {
  alias: string;
  reply: string | null;
  timedOut: boolean;
  /** No key configured. The message was never sent. */
  mindOffline?: boolean;
  /** Reported with a timeout, never instead of sending: a Mind in the red still answers. */
  outOfCognition?: boolean;
};

export type Handoff = {
  alias: string;
  /** Null when nothing was sent: no key, or the sandbox is holding the Mind offline. */
  settled: Promise<AskOutcome> | null;
};

type Client = Awaited<ReturnType<typeof conversation>>['client'];

// long enough to read as a real wait, short enough to sit through on stage
const SIMULATED_WAIT_MS = 24_000;

/**
 * The sandbox holds the Mind in a state the demo could not otherwise reach. Offline and
 * out-of-cognition both end in silence, and the difference between them is the whole reason
 * the app says which one happened.
 */
async function simulate(alias: string, held: string): Promise<AskOutcome> {
  await new Promise((done) => setTimeout(done, SIMULATED_WAIT_MS));
  return { alias, reply: null, timedOut: true, outOfCognition: held === 'empty' };
}

async function awaitReply(
  client: Client,
  alias: string,
  since: string | undefined,
  timeoutMs: number,
): Promise<AskOutcome> {
  const outcome = await client.waitForReply({ alias, timeoutMs, afterFingerprint: since });
  if (!outcome.timedOut) {
    return { alias, reply: plain(outcome.reply.messageText ?? ''), timedOut: false };
  }

  // say whether an empty balance is why the wait ran out
  await refreshCognition();
  const balance = cognition();
  return { alias, reply: null, timedOut: true, outOfCognition: balance != null && balance <= 0 };
}

/** Returns once the question is on the wire, which takes about two seconds. */
export async function send(
  context: AskContext,
  question: string,
  timeoutMs = REPLY_TIMEOUT_MS,
): Promise<Handoff> {
  const alias = aliasFor(context.alias ?? `post-${context.ytVideoId}`);
  const held = sandboxEnabled ? sandbox().mind : 'normal';
  if (held === 'offline' || !mindEnabled) return { alias, settled: null };
  if (held !== 'normal') return { alias, settled: simulate(alias, held) };

  const { client } = await conversation(alias);
  const since = await client.getLatestHistoryFingerprint(alias).catch(() => undefined);
  await client.sendMessage({ alias, messageText: brief(context, question) });

  return { alias, settled: awaitReply(client, alias, since, timeoutMs) };
}

/** For the callers with nowhere to deliver a late answer to. */
export async function ask(
  context: AskContext,
  question: string,
  timeoutMs = REPLY_TIMEOUT_MS,
): Promise<AskOutcome> {
  const { alias, settled } = await send(context, question, timeoutMs);
  return settled ?? { alias, reply: null, timedOut: false, mindOffline: true };
}

/** The wire carries the whole briefing; the creator should only ever see their question. */
function spoken(text: string): string {
  const asked = text.match(/^Question: (.+)$/m);
  return asked ? asked[1]!.trim() : text;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

/**
 * The Mind answers in HTML. Rendering that as markup would mean trusting model output,
 * so paragraphs become blank lines and every other tag is dropped.
 */
export function plain(text: string): string {
  return text
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function history(subject: string): Promise<ChatTurn[]> {
  const alias = aliasFor(subject);
  if (!mindEnabled) return [];

  const { client } = await conversation(alias);
  const rows = await client.getHistory(alias, { limit: 40 }).catch(() => []);

  // the API returns newest first; a chat reads the other way round
  return rows
    .filter((row) => typeof row.messageText === 'string' && row.messageText.trim().length > 0)
    .map((row) => ({
      role: row.senderType === 1 ? ('creator' as const) : ('mind' as const),
      text: row.senderType === 1 ? spoken(row.messageText!) : plain(row.messageText!),
      at: row.createdAt ?? '',
    }))
    .sort((a, b) => a.at.localeCompare(b.at));
}
