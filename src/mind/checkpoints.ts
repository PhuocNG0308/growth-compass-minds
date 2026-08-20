import * as repo from '../db/repo.ts';
import { env } from '../env.ts';
import { steepestDropOffs } from '../youtube/analytics.ts';
import { syncVideo } from '../youtube/sync.ts';
import { CHECKPOINT_OFFSETS_H, type CheckpointKind } from '../types.ts';
import { notifyMind } from './client.ts';

export function scheduleFor(publishedAt: Date): Array<{ kind: CheckpointKind; dueAt: Date }> {
  return Object.entries(CHECKPOINT_OFFSETS_H).map(([kind, hours]) => ({
    kind: kind as CheckpointKind,
    dueAt: new Date(publishedAt.getTime() + hours * 3_600_000),
  }));
}

async function fire(checkpoint: repo.DueCheckpoint): Promise<void> {
  const channel = await repo.getChannel(checkpoint.channelId);
  if (!channel) return;

  const experiment = checkpoint.experiment;
  const video = experiment.videoId ? await repo.getVideoById(experiment.videoId) : undefined;
  if (video) await syncVideo(channel, video.ytVideoId).catch((err) => console.error('[sync]', err));

  const snapshot = video ? await repo.latestSnapshot(video.id) : undefined;
  const curve = video ? await repo.latestRetention(video.id) : null;

  await repo.markFired(checkpoint.id);
  await notifyMind(buildBrief({ checkpoint, channelTitle: channel.title, video, snapshot, curve }));
}

function buildBrief(input: {
  checkpoint: repo.DueCheckpoint;
  channelTitle: string;
  video: Awaited<ReturnType<typeof repo.getVideoById>>;
  snapshot: Awaited<ReturnType<typeof repo.latestSnapshot>>;
  curve: Awaited<ReturnType<typeof repo.latestRetention>>;
}): string {
  const { checkpoint, channelTitle, video, snapshot, curve } = input;
  const observed = {
    views: snapshot?.views ?? null,
    ctrPct: snapshot?.ctr ?? null,
    avgViewPct: snapshot?.avgViewPct ?? null,
    avgViewDurationS: snapshot?.avgViewDurationS ?? null,
    subscribersGained: snapshot?.subscribersGained ?? null,
    ageHours: snapshot?.ageHours ?? null,
  };

  return [
    `CHECKPOINT ${checkpoint.kind} — channel "${channelTitle}"`,
    `experimentId: ${checkpoint.experimentId}`,
    `checkpointId: ${checkpoint.id}`,
    `video: ${video?.ytVideoId ?? 'not attached'} — ${video?.title ?? ''}`,
    `lever: ${checkpoint.experiment.lever}`,
    `hypothesis: ${checkpoint.experiment.hypothesis}`,
    `predicted: ${JSON.stringify(checkpoint.experiment.prediction)}`,
    `observed: ${JSON.stringify(observed)}`,
    curve ? `steepestDropOffs: ${JSON.stringify(steepestDropOffs(curve))}` : 'retention: unavailable',
    '',
    'Do now:',
    `1. POST /v1/checkpoints/${checkpoint.id}/observe with your reading of predicted vs observed.`,
    '2. If a durable pattern is confirmed or contradicted, POST /v1/learnings.',
    checkpoint.kind === 't28d'
      ? `3. Close the experiment: POST /v1/experiments/${checkpoint.experimentId}/close.`
      : '3. Leave the experiment open until its final checkpoint.',
    `4. If there is a concrete change worth making, POST /v1/proposals so the creator can approve it.`,
    '5. Message the creator with the single most useful action, or stay silent if there is none.',
    'State sample size and say so plainly when the data is too thin to conclude.',
    'You cannot change anything on the channel. Propose; the creator decides.',
  ].join('\n');
}

export function startCheckpointRunner(): () => void {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      for (const checkpoint of await repo.dueCheckpoints()) {
        await fire(checkpoint).catch((err) => console.error('[checkpoint]', checkpoint.id, err));
      }
    } catch (err) {
      console.error('[checkpoint-runner]', err);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, env.CHECKPOINT_POLL_MS);
  void tick();
  return () => clearInterval(timer);
}
