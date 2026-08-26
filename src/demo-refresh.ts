/**
 * Keeps the demo channel moving on its own.
 *
 * The seed writes one modelled history so the charts have a shape on the first run; this
 * writes real ones. Every pass records what the counts actually are right now, so a demo
 * left open for a day ends up with a trajectory that was measured rather than invented — and
 * a new upload appears in the feed without anyone reseeding.
 */
import * as repo from './db/repo.ts';
import { DEMO_YT_CHANNEL_ID } from './demo.ts';
import { env } from './env.ts';
import { liveChat, publicApiKey, publicDetails, type LiveNow } from './youtube/public.ts';
import { currentLive, pullPublicChannel, resolveSource, type PublicSource } from './youtube/public-sync.ts';

export const DEMO_REFRESH_MS = 10 * 60_000;
// a viewer count a minute stale still reads as live; asking YouTube per request does not
const LIVE_TTL_MS = 60_000;
const CHAT_KEEP = 12;

let source: PublicSource | null = null;

/** Resolved once and remembered: the handle cannot change while the process is running. */
export async function demoSource(): Promise<PublicSource | null> {
  if (source) return source;
  source = await resolveSource(env.DEMO_SOURCE_CHANNEL).catch(() => null);
  return source;
}

export async function refreshDemo(): Promise<{ videos: number; comments: number } | null> {
  const channel = await repo.getChannel(DEMO_YT_CHANNEL_ID);
  if (!channel) return null;

  const from = await demoSource();
  if (!from) return null;

  const pulled = await pullPublicChannel(channel.id, from);
  await repo.recordSync(channel.id, pulled.videos.length > 0 ? null : 'youtube feed returned nothing');
  return { videos: pulled.videos.length, comments: pulled.comments };
}

export type LiveState = LiveNow & {
  channel: string;
  /** Null without an API key: chat messages are the one live field a key is genuinely needed for. */
  chat: Array<{ displayName: string; text: string; at: string }> | null;
};

let cached: { at: number; state: LiveState | null } = { at: 0, state: null };
let chatCursor: string | null = null;

export async function liveState(): Promise<LiveState | null> {
  const handle = env.DEMO_LIVE_CHANNEL;
  if (!handle) return null;
  if (Date.now() - cached.at < LIVE_TTL_MS) return cached.state;

  const on = await currentLive(handle);
  // a stream that ended takes its chat cursor with it
  if (!on) chatCursor = null;

  cached = {
    at: Date.now(),
    state: on ? { ...on, channel: handle.replace(/^@/, ''), chat: await recentChat(on.ytVideoId) } : null,
  };
  return cached.state;
}

async function recentChat(ytVideoId: string): Promise<LiveState['chat']> {
  if (!publicApiKey) return null;

  const details = await publicDetails([ytVideoId], publicApiKey).catch(() => null);
  const chatId = details?.get(ytVideoId)?.live?.liveChatId;
  if (!chatId) return null;

  const page = await liveChat(chatId, publicApiKey, chatCursor).catch(() => null);
  if (!page) return null;

  chatCursor = page.nextPageToken;
  return page.messages.slice(-CHAT_KEEP).map((message) => ({
    displayName: message.displayName,
    text: message.text,
    at: message.publishedAt.toISOString(),
  }));
}

export function startDemoRefresh(): () => void {
  const tick = () => {
    void liveState().catch(() => null);
    return refreshDemo().catch((err) =>
      console.error('[demo] refresh', err instanceof Error ? err.message : err),
    );
  };

  void tick();
  const timer = setInterval(tick, DEMO_REFRESH_MS);
  console.log(
    `  Demo channel refreshes from ${env.DEMO_SOURCE_CHANNEL} every ${DEMO_REFRESH_MS / 60_000} min` +
      (publicApiKey ? ' (with comments)' : ' (public feed only)'),
  );
  return () => clearInterval(timer);
}
