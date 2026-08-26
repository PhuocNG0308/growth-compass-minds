/**
 * Fills the demo channel from a real one using public reads only.
 *
 * The same function seeds and refreshes. Seeding backfills a modelled view history so the
 * trajectory chart has more than one point; each refresh appends a measured one. Owner-only
 * metrics are never written here — see `model()`.
 */
import * as repo from '../db/repo.ts';
import { MODELLED_FIELDS, median, model } from '../demo.ts';
import {
  channelFeed,
  liveNow,
  publicApiKey,
  publicComments,
  publicDetails,
  resolveChannel,
  watchPage,
  type FeedVideo,
  type LiveDetail,
  type LiveNow,
  type PublicDetail,
} from './public.ts';

export type PublicSource = {
  handle: string;
  ytChannelId: string;
  title: string;
  url: string;
  /** What the interface has to admit about itself. */
  realComments: boolean;
  modelled: readonly string[];
};

export type PullResult = {
  source: PublicSource;
  videos: Array<{ id: string; ytVideoId: string; title: string; publishedAt: Date; durationS: number }>;
  live: { ytVideoId: string; detail: LiveDetail } | null;
  comments: number;
};

// where the modelled history is sampled, oldest first, in hours since publication
const BACKFILL_AGES = [6, 24, 48, 72, 120, 168, 336, 504, 672, 1008, 1344, 2016];
const COMMENT_VIDEOS = 8;

export async function resolveSource(handle: string): Promise<PublicSource> {
  const { ytChannelId, title } = await resolveChannel(handle);
  return {
    handle,
    ytChannelId,
    title,
    url: `https://www.youtube.com/channel/${ytChannelId}`,
    realComments: publicApiKey != null,
    modelled: MODELLED_FIELDS,
  };
}

export async function pullPublicChannel(
  channelId: string,
  source: PublicSource,
  opts: { backfill?: boolean } = {},
): Promise<PullResult> {
  const feed = await channelFeed(source.ytChannelId);
  // the feed edge 404s for a channel that is fine a minute later, so an empty answer means
  // "nothing new right now", never "wipe what we know"
  if (feed.length === 0) return { source, videos: [], live: null, comments: 0 };

  const details = publicApiKey
    ? await publicDetails(feed.map((video) => video.ytVideoId), publicApiKey)
    : new Map<string, PublicDetail>();

  const durations = await realDurations(channelId, feed, details);
  const middle = median(feed.map((video) => video.views));
  const drafts = feed.map((video) => {
    const detail = details.get(video.ytVideoId) ?? null;
    return {
      video,
      detail,
      modelled: model(video, middle, { ...detail, durationS: durations.get(video.ytVideoId) ?? null }),
    };
  });

  const rows = await repo.upsertVideos(
    channelId,
    drafts.map(({ video, modelled }) => ({
      ytVideoId: video.ytVideoId,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      durationS: modelled.durationS,
      publishedAt: video.publishedAt,
    })),
  );
  const byYtId = new Map(rows.map((row) => [row.ytVideoId, row]));

  for (const { video, detail, modelled } of drafts) {
    const stored = byYtId.get(video.ytVideoId);
    if (!stored) continue;

    if (opts.backfill) await backfill(stored.id, video, modelled);
    await repo.insertSnapshot({
      videoId: stored.id,
      ageHours: hoursSince(video.publishedAt),
      views: video.views,
      likes: detail?.likes ?? video.ratings,
      comments: detail?.comments ?? 0,
      impressions: modelled.impressions,
      ctr: modelled.ctrPct,
      avgViewDurationS: modelled.avgViewDurationS,
      avgViewPct: modelled.avgViewPct,
      subscribersGained: modelled.subscribersGained,
    });
    await repo.upsertRetention(stored.id, modelled.retention);
  }

  const comments = publicApiKey ? await pullComments(channelId, drafts, byYtId) : 0;
  const onAir = drafts.find(({ detail }) => detail?.live);

  return {
    source,
    videos: drafts.map(({ video, modelled }) => ({
      id: byYtId.get(video.ytVideoId)!.id,
      ytVideoId: video.ytVideoId,
      title: video.title,
      publishedAt: video.publishedAt,
      durationS: modelled.durationS,
    })),
    live: onAir ? { ytVideoId: onAir.video.ytVideoId, detail: onAir.detail!.live! } : null,
    comments,
  };
}

/** Durations never change, so each video costs one page fetch once. */
async function realDurations(
  channelId: string,
  feed: FeedVideo[],
  details: Map<string, PublicDetail>,
): Promise<Map<string, number>> {
  const known = new Map<string, number>();

  for (const video of await repo.listVideos(channelId, 200)) {
    if (video.durationS != null) known.set(video.ytVideoId, video.durationS);
  }
  for (const [ytVideoId, detail] of details) {
    if (detail.durationS != null) known.set(ytVideoId, detail.durationS);
  }

  for (const video of feed) {
    if (known.has(video.ytVideoId)) continue;
    const watch = await watchPage(video.ytVideoId);
    if (watch?.durationS != null) known.set(video.ytVideoId, watch.durationS);
  }

  return known;
}

async function pullComments(
  channelId: string,
  drafts: Array<{ video: FeedVideo }>,
  byYtId: Map<string, { id: string }>,
): Promise<number> {
  let total = 0;

  for (const { video } of drafts.slice(0, COMMENT_VIDEOS)) {
    const stored = byYtId.get(video.ytVideoId);
    if (!stored) continue;

    const rows = await publicComments(video.ytVideoId, publicApiKey!);
    if (rows.length === 0) continue;

    await repo.upsertComments(
      channelId,
      rows.map((row) => ({ ...row, videoId: stored.id })),
    );
    total += rows.length;
  }

  return total;
}

/** A trajectory needs more than one point. Fast climb then flattening, anchored to real views. */
async function backfill(
  videoId: string,
  video: FeedVideo,
  modelled: ReturnType<typeof model>,
): Promise<void> {
  const age = hoursSince(video.publishedAt);

  for (const mark of BACKFILL_AGES) {
    if (mark >= age) break;
    const maturity = Math.min(1, Math.log10(1 + (mark / age) * 9));
    const views = Math.round(video.views * maturity);

    await repo.insertSnapshot({
      videoId,
      ageHours: mark,
      views,
      likes: Math.round(video.ratings * maturity),
      comments: 0,
      impressions: Math.round(views / (modelled.ctrPct / 100)),
      ctr: modelled.ctrPct,
      avgViewDurationS: modelled.avgViewDurationS,
      avgViewPct: modelled.avgViewPct,
      subscribersGained: Math.round(modelled.subscribersGained * maturity),
    });
  }
}

const hoursSince = (date: Date) => Math.max(1, Math.round((Date.now() - date.getTime()) / 3_600_000));

/** Live state for the configured channel. Only the chat messages need an API key. */
export async function currentLive(handle: string): Promise<LiveNow | null> {
  return liveNow(handle).catch(() => null);
}
