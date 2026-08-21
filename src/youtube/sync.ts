import * as repo from '../db/repo.ts';
import type { Channel, Video } from '../types.ts';
import { accessTokenFor } from './oauth.ts';
import { channelInfo, comments, uploadIds, videoDetails, type VideoDetail } from './data.ts';
import { retentionCurve, videoMetrics, type VideoMetrics } from './analytics.ts';
import { ensureJob, reachByVideo, type Reach } from './reporting.ts';

const day = (d: Date) => d.toISOString().slice(0, 10);
const hoursSince = (d: Date) => Math.round((Date.now() - d.getTime()) / 3_600_000);

export async function syncChannel(
  channel: Channel,
  opts: { videoLimit?: number; withComments?: boolean } = {},
): Promise<{ videos: number; reachThrough: string | null }> {
  return track(channel, () => pullChannel(channel, opts));
}

async function pullChannel(
  channel: Channel,
  opts: { videoLimit?: number; withComments?: boolean },
): Promise<{ videos: number; reachThrough: string | null }> {
  const token = await accessTokenFor(channel);
  const info = await channelInfo(token);
  const ids = await uploadIds(token, info.uploadsPlaylistId, opts.videoLimit ?? 25);
  const details = await videoDetails(token, ids);
  if (details.length === 0) return { videos: 0, reachThrough: null };

  const videos = await repo.upsertVideos(channel.id, details);
  const byYtId = new Map(videos.map((v) => [v.ytVideoId, v]));

  const earliest = details.reduce((min, d) => (d.publishedAt < min ? d.publishedAt : min), details[0]!.publishedAt);
  const metrics = await videoMetrics(token, ids, day(earliest), day(new Date()));
  const { reach, through } = await syncReach(channel, token, earliest);

  for (const detail of details) {
    const video = byYtId.get(detail.ytVideoId);
    if (video) await writeSnapshot(video, detail, metrics.get(detail.ytVideoId), reach.get(detail.ytVideoId));
  }

  if (opts.withComments) {
    for (const detail of details.slice(0, 5)) {
      const video = byYtId.get(detail.ytVideoId);
      if (!video) continue;
      const rows = await comments(token, detail.ytVideoId);
      await repo.upsertComments(
        channel.id,
        rows.map((row) => ({ ...row, videoId: video.id })),
      );
    }
  }

  if (through) await repo.setReachSyncedThrough(channel.id, through);
  return { videos: videos.length, reachThrough: through };
}

export async function syncVideo(channel: Channel, ytVideoId: string): Promise<Video | undefined> {
  return track(channel, () => pullVideo(channel, ytVideoId));
}

/**
 * A refresh token dies after seven days while the consent screen is in Testing, and the
 * failure is silent everywhere it matters: the snapshot simply stays where it was. Recording
 * the outcome is what lets the checkpoint brief admit the numbers are old.
 */
async function track<T>(channel: Channel, run: () => Promise<T>): Promise<T> {
  try {
    const result = await run();
    await repo.recordSync(channel.id, null);
    return result;
  } catch (err) {
    await repo.recordSync(channel.id, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

async function pullVideo(channel: Channel, ytVideoId: string): Promise<Video | undefined> {
  const token = await accessTokenFor(channel);
  const [detail] = await videoDetails(token, [ytVideoId]);
  if (!detail) return undefined;

  const [video] = await repo.upsertVideos(channel.id, [detail]);
  if (!video) return undefined;

  const from = day(detail.publishedAt);
  const to = day(new Date());
  const metrics = await videoMetrics(token, [ytVideoId], from, to);
  const { reach } = await syncReach(channel, token, detail.publishedAt);
  await writeSnapshot(video, detail, metrics.get(ytVideoId), reach.get(ytVideoId));

  const curve = await retentionCurve(token, ytVideoId, from, to).catch(() => []);
  if (curve.length > 0) await repo.upsertRetention(video.id, curve);

  return video;
}

async function syncReach(
  channel: Channel,
  token: string,
  since: Date,
): Promise<{ reach: Map<string, Reach>; through: string | null }> {
  let jobId = channel.reportingJobId;
  if (!jobId) {
    jobId = await ensureJob(token);
    await repo.setReportingJob(channel.id, jobId);
  }
  return reachByVideo(token, jobId, since).catch(() => ({ reach: new Map(), through: null }));
}

async function writeSnapshot(
  video: Video,
  detail: VideoDetail,
  metrics: VideoMetrics | undefined,
  reach: Reach | undefined,
): Promise<void> {
  await repo.insertSnapshot({
    videoId: video.id,
    ageHours: hoursSince(detail.publishedAt),
    views: detail.views,
    likes: detail.likes,
    comments: detail.comments,
    impressions: reach?.impressions ?? null,
    ctr: reach?.ctrPct ?? null,
    avgViewDurationS: metrics?.avgViewDurationS ?? null,
    avgViewPct: metrics?.avgViewPct ?? null,
    subscribersGained: metrics?.subscribersGained ?? null,
  });
}
