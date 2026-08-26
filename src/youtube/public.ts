/**
 * Public reads of a channel nobody here owns.
 *
 * Without `YOUTUBE_API_KEY`: the Atom feed gives video ids, titles, descriptions, publish
 * times, thumbnails and view counts. With a key: also durations, comment counts, comments
 * and live chat — `videos.list`, `commentThreads.list` and `liveChat/messages` accept a key
 * instead of OAuth.
 *
 * Out of reach at any tier: impressions, click-through, retention. The Analytics API answers
 * UNAUTHENTICATED to anything but the owner's OAuth token, so those are modelled in
 * `src/demo.ts` and labelled as modelled in the interface.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '../env.ts';
import type { CommentRow } from './data.ts';

const FEED = 'https://www.youtube.com/feeds/videos.xml';
const API = 'https://www.googleapis.com/youtube/v3';

export const publicApiKey = env.YOUTUBE_API_KEY ?? null;

export type FeedVideo = {
  ytVideoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: Date;
  views: number;
  /** Star-rating count — the public feed's stand-in for the like count. */
  ratings: number;
  isShort: boolean;
};

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
};

const decode = (text: string) =>
  text.replace(/&(?:[a-z]+|#\d+);/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity);

const capture = (block: string, pattern: RegExp): string | null => pattern.exec(block)?.[1] ?? null;

/** These pages sometimes declare a charset they are not written in; the bytes are UTF-8. */
async function utf8(res: Response): Promise<string> {
  return new TextDecoder('utf-8').decode(await res.arrayBuffer());
}

/**
 * Handle to UC id, which is all the feed accepts. Read `externalId` rather than the first
 * `UC…` in the HTML: that one belongs to a recommended channel, not this one.
 */
export async function resolveChannel(handleOrId: string): Promise<{ ytChannelId: string; title: string }> {
  const handle = handleOrId.startsWith('@') ? handleOrId : `@${handleOrId}`;
  const url = /^UC[\w-]{22}$/.test(handleOrId)
    ? `https://www.youtube.com/channel/${handleOrId}`
    : `https://www.youtube.com/${handle}`;

  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`channel ${handleOrId}: ${res.status}`);
  const page = await utf8(res);

  const id =
    capture(page, /"externalId":"(UC[\w-]{22})"/) ??
    capture(page, /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/);
  if (!id) throw new Error(`channel ${handleOrId}: no channel id on the page`);

  return { ytChannelId: id, title: decode(capture(page, /<meta property="og:title" content="([^"]+)"/) ?? handle) };
}

const CACHE = '.cache';
const ATTEMPTS = 3;
const RETRY_MS = 1500;

/**
 * The feed edge returns 404 or 500 for a healthy channel, sometimes for minutes. Retries
 * cover a blip; the disk copy covers a longer outage so the catalogue is never empty.
 */
async function feedXml(ytChannelId: string): Promise<string | null> {
  const file = join(CACHE, `feed-${ytChannelId}.xml`);

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const res = await fetch(`${FEED}?channel_id=${ytChannelId}`).catch(() => null);
    if (res?.ok) {
      const xml = await utf8(res);
      try {
        mkdirSync(CACHE, { recursive: true });
        writeFileSync(file, xml);
      } catch {
        // a read-only working directory is not a reason to drop a good response
      }
      return xml;
    }
    if (attempt < ATTEMPTS - 1) await new Promise((wake) => setTimeout(wake, RETRY_MS));
  }

  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** The newest fifteen uploads, live if YouTube is answering and from disk if it is not. */
export async function channelFeed(ytChannelId: string): Promise<FeedVideo[]> {
  const xml = await feedXml(ytChannelId);
  if (!xml) return [];

  const videos: FeedVideo[] = [];

  for (const [, block] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const ytVideoId = capture(block!, /<yt:videoId>([\w-]+)<\/yt:videoId>/);
    const published = capture(block!, /<published>(.*?)<\/published>/);
    if (!ytVideoId || !published) continue;

    videos.push({
      ytVideoId,
      title: decode(capture(block!, /<media:title>([\s\S]*?)<\/media:title>/) ?? ytVideoId),
      description: decode(capture(block!, /<media:description>([\s\S]*?)<\/media:description>/) ?? ''),
      thumbnailUrl: `https://i.ytimg.com/vi/${ytVideoId}/maxresdefault.jpg`,
      publishedAt: new Date(published),
      views: Number(capture(block!, /<media:statistics views="(\d+)"/) ?? 0),
      ratings: Number(capture(block!, /<media:starRating count="(\d+)"/) ?? 0),
      isShort: /<link rel="alternate" href="[^"]*\/shorts\//.test(block!),
    });
  }

  return videos;
}

/**
 * Duration and live state, both in the watch page's bootstrap JSON. Worth a page fetch per
 * video: a duration printed on a thumbnail reads as measured, and there is no room to
 * caveat it there.
 */
export type WatchPage = {
  durationS: number | null;
  isLive: boolean;
  /** Viewers on the stream right now, not the total view count. */
  watching: number | null;
  startedAt: Date | null;
};

async function watchHtml(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  return res.ok ? utf8(res) : null;
}

export async function watchPage(ytVideoId: string): Promise<WatchPage | null> {
  const page = await watchHtml(`https://www.youtube.com/watch?v=${ytVideoId}`);
  return page ? readWatch(page) : null;
}

function readWatch(page: string): WatchPage {
  const length = Number(capture(page, /"lengthSeconds":"(\d+)"/) ?? 0);
  const started = capture(page, /"startTimestamp":"([^"]+)"/);

  return {
    // a live stream reports zero, which is not a duration
    durationS: length > 0 ? length : null,
    isLive: capture(page, /"isLiveNow":(true|false)/) === 'true',
    watching: Number(capture(page, /"originalViewCount":"(\d+)"/) ?? 0) || null,
    startedAt: started ? new Date(started) : null,
  };
}

export type LiveNow = {
  ytVideoId: string;
  title: string;
  thumbnailUrl: string;
  watching: number | null;
  startedAt: Date | null;
};

/** `/@handle/live` redirects to the current stream, or serves the channel page if there is none. */
export async function liveNow(handle: string): Promise<LiveNow | null> {
  const at = handle.startsWith('@') ? handle : `@${handle}`;
  const page = await watchHtml(`https://www.youtube.com/${at}/live`);
  if (!page) return null;

  const watch = readWatch(page);
  const ytVideoId = capture(page, /"videoId":"([\w-]{11})"/);
  if (!watch.isLive || !ytVideoId) return null;

  return {
    ytVideoId,
    title: decode(capture(page, /<meta name="title" content="([^"]*)"/) ?? ytVideoId),
    thumbnailUrl: `https://i.ytimg.com/vi/${ytVideoId}/maxresdefault.jpg`,
    watching: watch.watching,
    startedAt: watch.startedAt,
  };
}

export type LiveDetail = {
  startedAt: Date;
  concurrentViewers: number | null;
  liveChatId: string | null;
};

export type PublicDetail = {
  ytVideoId: string;
  durationS: number | null;
  comments: number | null;
  likes: number | null;
  live: LiveDetail | null;
};

// ISO 8601 durations split on T so PT2M means minutes, not months.
function durationToSeconds(iso: string): number {
  const [, time = ''] = iso.split('T');
  const unit: Record<string, number> = { H: 3600, M: 60, S: 1 };
  let total = 0;
  for (const [, value, key] of time.matchAll(/(\d+)([HMS])/g)) total += Number(value) * unit[key!]!;
  return total;
}

async function apiGet<T>(path: string, key: string): Promise<T | null> {
  const res = await fetch(`${API}/${path}&key=${key}`);
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

/** Duration, comment count and live state — the public fields the feed leaves out. */
export async function publicDetails(ids: string[], key: string): Promise<Map<string, PublicDetail>> {
  const out = new Map<string, PublicDetail>();

  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50).join(',');
    const res = await apiGet<{
      items?: Array<{
        id: string;
        contentDetails?: { duration?: string };
        statistics?: { commentCount?: string; likeCount?: string };
        liveStreamingDetails?: {
          actualStartTime?: string;
          actualEndTime?: string;
          concurrentViewers?: string;
          activeLiveChatId?: string;
        };
      }>;
    }>(`videos?part=contentDetails,statistics,liveStreamingDetails&id=${batch}`, key);

    for (const item of res?.items ?? []) {
      const streaming = item.liveStreamingDetails;
      // a finished premiere keeps its liveStreamingDetails forever; only one without an end
      // time is actually on air
      const onAir = streaming?.actualStartTime != null && streaming.actualEndTime == null;

      out.set(item.id, {
        ytVideoId: item.id,
        durationS: item.contentDetails?.duration ? durationToSeconds(item.contentDetails.duration) : null,
        comments: item.statistics?.commentCount == null ? null : Number(item.statistics.commentCount),
        likes: item.statistics?.likeCount == null ? null : Number(item.statistics.likeCount),
        live: onAir
          ? {
              startedAt: new Date(streaming!.actualStartTime!),
              concurrentViewers:
                streaming!.concurrentViewers == null ? null : Number(streaming!.concurrentViewers),
              liveChatId: streaming!.activeLiveChatId ?? null,
            }
          : null,
      });
    }
  }

  return out;
}

export async function publicComments(ytVideoId: string, key: string, limit = 100): Promise<CommentRow[]> {
  const res = await apiGet<{
    items?: Array<{
      snippet: {
        topLevelComment: {
          id: string;
          snippet: {
            authorDisplayName: string;
            authorChannelId?: { value: string };
            textOriginal: string;
            likeCount: number;
            publishedAt: string;
          };
        };
      };
    }>;
  }>(
    `commentThreads?part=snippet&order=relevance&maxResults=${Math.min(limit, 100)}&videoId=${ytVideoId}`,
    key,
  );

  return (res?.items ?? []).map((item) => {
    const comment = item.snippet.topLevelComment;
    return {
      ytCommentId: comment.id,
      ytAuthorId: comment.snippet.authorChannelId?.value ?? comment.snippet.authorDisplayName,
      displayName: comment.snippet.authorDisplayName,
      text: comment.snippet.textOriginal,
      likeCount: comment.snippet.likeCount,
      publishedAt: new Date(comment.snippet.publishedAt),
    };
  });
}

export type LiveChatPage = {
  messages: CommentRow[];
  nextPageToken: string | null;
  /** What YouTube says to wait before asking again. Polling faster than this wastes quota. */
  pollAfterMs: number;
};

export async function liveChat(
  liveChatId: string,
  key: string,
  pageToken?: string | null,
): Promise<LiveChatPage> {
  const res = await apiGet<{
    items?: Array<{
      id: string;
      snippet: { displayMessage?: string; publishedAt: string };
      authorDetails: { channelId: string; displayName: string };
    }>;
    nextPageToken?: string;
    pollingIntervalMillis?: number;
  }>(
    `liveChat/messages?part=snippet,authorDetails&liveChatId=${encodeURIComponent(liveChatId)}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''),
    key,
  );

  return {
    messages: (res?.items ?? [])
      .filter((item) => item.snippet.displayMessage)
      .map((item) => ({
        ytCommentId: item.id,
        ytAuthorId: item.authorDetails.channelId,
        displayName: item.authorDetails.displayName,
        text: item.snippet.displayMessage!,
        likeCount: 0,
        publishedAt: new Date(item.snippet.publishedAt),
      })),
    nextPageToken: res?.nextPageToken ?? null,
    pollAfterMs: res?.pollingIntervalMillis ?? 10_000,
  };
}
