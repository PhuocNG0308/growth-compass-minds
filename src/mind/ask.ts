import { cognition, conversation, mindEnabled, refreshCognition } from './client.ts';

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

/**
 * The Mind answers in one finished message — there is no token stream to forward — so what a
 * caller can be told while it waits is which step is running, and for how long.
 */
export type AskStage =
  | { stage: 'reading' }
  | { stage: 'briefed'; comments: number }
  | { stage: 'sent' }
  | { stage: 'waiting'; elapsedS: number };

export type OnStage = (update: AskStage) => void;

const HEARTBEAT_MS = 5_000;

// measured replies have taken 135-153s, so the old 150s ceiling was inside the normal range
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

export async function ask(
  context: AskContext,
  question: string,
  timeoutMs = REPLY_TIMEOUT_MS,
  onStage?: OnStage,
): Promise<AskOutcome> {
  const alias = aliasFor(context.alias ?? `post-${context.ytVideoId}`);
  if (!mindEnabled) return { alias, reply: null, timedOut: false, mindOffline: true };

  const { client } = await conversation(alias);
  const messageText = brief(context, question);
  const since = await client.getLatestHistoryFingerprint(alias).catch(() => undefined);

  await client.sendMessage({ alias, messageText });
  onStage?.({ stage: 'sent' });

  const started = Date.now();
  const beat = onStage
    ? setInterval(
        () => onStage({ stage: 'waiting', elapsedS: Math.round((Date.now() - started) / 1000) }),
        HEARTBEAT_MS,
      )
    : null;

  try {
    const outcome = await client.waitForReply({ alias, timeoutMs, afterFingerprint: since });
    if (!outcome.timedOut) {
      return { alias, reply: plain(outcome.reply.messageText ?? ''), timedOut: false };
    }

    // say whether an empty balance is why the wait ran out
    await refreshCognition();
    const balance = cognition();
    return { alias, reply: null, timedOut: true, outOfCognition: balance != null && balance <= 0 };
  } finally {
    if (beat) clearInterval(beat);
  }
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
