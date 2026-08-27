import { createHash } from 'node:crypto';
import type { FeedVideo } from './youtube/public.ts';

export const DEMO_YT_CHANNEL_ID = 'UC_DEMO';

export const isDemoChannel = (channel: { ytChannelId: string }) =>
  channel.ytChannelId === DEMO_YT_CHANNEL_ID;

/** Stored where a real refresh token would be, so `syncable()` can tell the two apart. */
export const DEMO_REFRESH_TOKEN = 'demo-channel-has-no-google-token';

/**
 * Impressions, click-through and retention are owner-only, so they are derived here from the
 * counts that are public.
 *
 * Two constraints: output is deterministic per video id, so figures never change without a
 * reason; and every output is driven by a real input — reach against the channel median sets
 * click-through, engagement and length set watch percentage — so they track the real counts.
 */
export type Modelled = {
  durationS: number;
  ctrPct: number;
  impressions: number;
  avgViewPct: number;
  avgViewDurationS: number;
  subscribersGained: number;
  retention: Array<{ ratio: number; watchRatio: number; relative: number }>;
};

/** The fields on this screen that are modelled rather than read. Kept beside the model. */
export const MODELLED_FIELDS = ['ctrPct', 'impressions', 'avgViewPct', 'retention'] as const;

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/** A stable stream of jitter per video, so "modelled" never means "different every run". */
function jitter(ytVideoId: string) {
  const digest = createHash('sha256').update(ytVideoId).digest();
  let at = 0;
  return () => {
    const byte = digest[at % digest.length]!;
    at += 1;
    return byte / 255;
  };
}

const RETENTION_POINTS = 21;

export function model(
  video: FeedVideo,
  channelMedianViews: number,
  known: { durationS?: number | null; comments?: number | null; likes?: number | null } = {},
): Modelled {
  const next = jitter(video.ytVideoId);

  const durationS =
    known.durationS ??
    // no key means no duration; a Short is capped by the format, everything else lands in
    // the band this kind of channel actually publishes in
    (video.isShort ? Math.round(28 + next() * 32) : Math.round(480 + next() * 1200));

  const likes = known.likes ?? video.ratings;
  const comments = known.comments ?? 0;
  const views = Math.max(video.views, 1);

  // how much of the audience reacted — the only public evidence that they stayed
  const engagement = clamp((likes + comments) / views / 0.05, 0, 2);
  // how far this video reached against what this channel normally reaches
  const reach = Math.log(views / Math.max(channelMedianViews, 1));

  const ctrPct = Number(clamp(4.6 + 1.6 * reach + (next() - 0.5) * 0.6, 1.8, 11.5).toFixed(2));
  const minutes = Math.max(durationS / 60, 1);
  const avgViewPct = Number(
    clamp(62 * (1 - Math.log10(minutes) * 0.28) * (0.8 + 0.25 * engagement), 16, 82).toFixed(2),
  );

  return {
    durationS,
    ctrPct,
    impressions: Math.round(views / (ctrPct / 100)),
    avgViewPct,
    avgViewDurationS: Math.round((durationS * avgViewPct) / 100),
    subscribersGained: Math.round(views * (likes / views) * (0.08 + next() * 0.08)),
    retention: retention(avgViewPct, next),
  };
}

/** Decay plus one cliff and one rewatched stretch, both placed by the video's own jitter. */
function retention(avgViewPct: number, next: () => number) {
  const cliff = 0.12 + next() * 0.5;
  const replay = clamp(cliff + 0.2 + next() * 0.2, 0, 0.92);

  return Array.from({ length: RETENTION_POINTS }, (_, index) => {
    const ratio = index / (RETENTION_POINTS - 1);
    const decay = 1 - ratio * (1 - avgViewPct / 100) * 1.35;
    const watchRatio = Math.max(
      0.08,
      decay -
        (Math.abs(ratio - cliff) < 0.03 ? 0.14 : 0) +
        (Math.abs(ratio - replay) < 0.03 ? 0.05 : 0),
    );

    // YouTube reports a percentile against videos of a similar length, not a raw figure, so
    // this tracks how far the curve sits from an ordinary one rather than the watch ratio
    const ordinary = 1 - ratio * 0.62;
    return {
      ratio,
      watchRatio: Number(watchRatio.toFixed(4)),
      relative: Number(clamp(0.5 + (watchRatio - ordinary) * 2.4, 0.05, 0.95).toFixed(4)),
    };
  });
}

export const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)]!;
};
