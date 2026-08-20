import * as repo from '../db/repo.ts';
import type { Channel } from '../types.ts';
import { describe } from './learnings.ts';

const hoursSince = (d: Date) => Math.round((Date.now() - new Date(d).getTime()) / 3_600_000);

const describeVideo = (video: { ytVideoId: string; title: string; thumbnailUrl: string | null } | undefined) =>
  video ? { ytVideoId: video.ytVideoId, title: video.title, thumbnailUrl: video.thumbnailUrl } : null;

export async function buildContext(channel: Channel) {
  const [videos, experiments, learnings, pending] = await Promise.all([
    repo.listVideos(channel.id, 12),
    repo.listExperiments(channel.id),
    repo.listLearnings(channel.id),
    repo.pendingCheckpoints(channel.id),
  ]);

  const snapshots = await repo.latestSnapshots(videos.map((v) => v.id));
  const snapshotByVideo = new Map(snapshots.map((s) => [s.videoId, s]));
  const videoById = new Map(videos.map((v) => [v.id, v]));

  const checkpointsByExperiment = new Map<string, typeof pending>();
  for (const cp of pending) {
    const list = checkpointsByExperiment.get(cp.experimentId) ?? [];
    list.push(cp);
    checkpointsByExperiment.set(cp.experimentId, list);
  }

  const open = experiments.filter((e) => e.status === 'open' || e.status === 'measuring');
  const closed = experiments.filter((e) => e.status === 'closed').slice(0, 8);

  return {
    channel: { id: channel.id, ytChannelId: channel.ytChannelId, title: channel.title },

    recentVideos: videos.map((video) => {
      const snap = snapshotByVideo.get(video.id);
      return {
        ytVideoId: video.ytVideoId,
        title: video.title,
        publishedAt: video.publishedAt,
        ageHours: hoursSince(video.publishedAt),
        views: snap?.views ?? null,
        ctrPct: snap?.ctr ?? null,
        avgViewPct: snap?.avgViewPct ?? null,
        avgViewDurationS: snap?.avgViewDurationS ?? null,
      };
    }),

    openExperiments: open.map((experiment) => ({
      id: experiment.id,
      lever: experiment.lever,
      hypothesis: experiment.hypothesis,
      prediction: experiment.prediction,
      status: experiment.status,
      openedAt: experiment.openedAt,
      video: describeVideo(experiment.videoId ? videoById.get(experiment.videoId) : undefined),
      checkpoints: (checkpointsByExperiment.get(experiment.id) ?? []).map((cp) => ({
        id: cp.id,
        kind: cp.kind,
        dueAt: cp.dueAt,
        overdue: new Date(cp.dueAt).getTime() <= Date.now(),
      })),
    })),

    settledExperiments: closed.map((experiment) => ({
      hypothesis: experiment.hypothesis,
      lever: experiment.lever,
      verdict: experiment.verdict,
      prediction: experiment.prediction,
      outcome: experiment.outcome,
      closedAt: experiment.closedAt,
    })),

    channelRules: {
      tenets: learnings.filter((l) => l.promotedToTenetAt !== null).map(describe),
      candidates: learnings.filter((l) => l.promotedToTenetAt === null).map(describe),
    },

    dataCoverage: {
      reachThrough: channel.reachSyncedThrough,
      note: 'ctrPct and impressions come from the Reporting API and lag ~2 days behind views.',
    },
  };
}
