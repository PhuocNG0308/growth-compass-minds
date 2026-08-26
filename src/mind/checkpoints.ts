import * as repo from '../db/repo.ts';
import { env } from '../env.ts';
import { steepestDropOffs } from '../youtube/analytics.ts';
import { syncVideo } from '../youtube/sync.ts';
import { CHECKPOINT_OFFSETS_H, type CheckpointKind, type ProposalKind } from '../types.ts';
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

  let staleSince: Date | null = null;
  if (video) {
    await syncVideo(channel, video.ytVideoId).catch((err) => {
      console.error('[sync]', err);
      staleSince = channel.lastSyncAt;
    });
  }

  const snapshot = video ? await repo.latestSnapshot(video.id) : undefined;
  const curve = video ? await repo.latestRetention(video.id) : null;

  await repo.markFired(checkpoint.id);
  await notifyMind(
    buildBrief({ checkpoint, channelTitle: channel.title, video, snapshot, curve, staleSince }),
  );
}

// A video is still being pushed out at 24h and 72h, so repackaging it still changes where it
// lands. By 7d the run is settled and asking the creator to redo the thumbnail buys nothing.
const RESCUE_WINDOW: readonly CheckpointKind[] = ['t24', 't72'];
const SHORTFALL = 0.15;

// impressions that did not convert are a packaging problem and a click that did not stay is an
// opening problem, so the metric that missed is what decides which lever the Mind is sent at
const AIM: Record<string, { kind: ProposalKind; lever: string }> = {
  ctrPct: { kind: 'thumbnail', lever: 'the thumbnail and title' },
  avgViewPct: { kind: 'hook', lever: 'the first thirty seconds' },
  avgViewDurationS: { kind: 'hook', lever: 'the first thirty seconds' },
  views: {
    kind: 'community',
    lever: 'distribution — a community post, a pinned comment, an end screen on an older video',
  },
};

function shortfalls(prediction: Record<string, number>, observed: Record<string, number | null>) {
  return Object.entries(prediction)
    .flatMap(([metric, predicted]) => {
      const actual = observed[metric];
      if (actual == null || predicted <= 0) return [];
      const relative = (predicted - actual) / predicted;
      return relative >= SHORTFALL ? [{ metric, predicted, actual, relative }] : [];
    })
    .sort((a, b) => b.relative - a.relative);
}

function buildBrief(input: {
  checkpoint: repo.DueCheckpoint;
  channelTitle: string;
  video: Awaited<ReturnType<typeof repo.getVideoById>>;
  snapshot: Awaited<ReturnType<typeof repo.latestSnapshot>>;
  curve: Awaited<ReturnType<typeof repo.latestRetention>>;
  staleSince: Date | null;
}): string {
  const { checkpoint, channelTitle, video, snapshot, curve, staleSince } = input;
  const observed = {
    views: snapshot?.views ?? null,
    ctrPct: snapshot?.ctr ?? null,
    avgViewPct: snapshot?.avgViewPct ?? null,
    avgViewDurationS: snapshot?.avgViewDurationS ?? null,
    subscribersGained: snapshot?.subscribersGained ?? null,
    ageHours: snapshot?.ageHours ?? null,
  };

  // a stale reading cannot show that a video is underperforming, so nothing is graded on it
  const missed = staleSince ? [] : shortfalls(checkpoint.experiment.prediction, observed);
  // the worst miss may be a metric no lever maps to, and that is no reason to skip a rescue
  const aim = RESCUE_WINDOW.includes(checkpoint.kind)
    ? missed.map((m) => AIM[m.metric]).find((entry) => entry != null)
    : undefined;

  return [
    `CHECKPOINT ${checkpoint.kind} — channel "${channelTitle}"`,
    `experimentId: ${checkpoint.experimentId}`,
    `checkpointId: ${checkpoint.id}`,
    `video: ${video?.ytVideoId ?? 'not attached'} — ${video?.title ?? ''}`,
    `lever: ${checkpoint.experiment.lever}`,
    `hypothesis: ${checkpoint.experiment.hypothesis}`,
    `predicted: ${JSON.stringify(checkpoint.experiment.prediction)}`,
    `observed: ${JSON.stringify(observed)}`,
    missed.length
      ? `shortfall: ${missed
          .map(
            (m) =>
              `${m.metric} came in at ${m.actual} against the ${m.predicted} you promised, ` +
              `${Math.round(m.relative * 100)}% under`,
          )
          .join('; ')}`
      : 'shortfall: none — nothing you committed to is materially under.',
    curve ? `steepestDropOffs: ${JSON.stringify(steepestDropOffs(curve))}` : 'retention: unavailable',
    // saying nothing here would hand the Mind a stale reading as if it were this morning's
    staleSince
      ? `WARNING: YouTube could not be reached, so these numbers are unchanged since ` +
        `${staleSince.toISOString()}. Treat them as old, say so to the creator, and do not ` +
        `grade the prediction on them.`
      : 'freshness: numbers were refreshed from YouTube just now.',
    '',
    'Do now:',
    `1. POST /v1/checkpoints/${checkpoint.id}/observe with your reading of predicted vs observed.`,
    '2. If a durable pattern is confirmed or contradicted, POST /v1/learnings.',
    checkpoint.kind === 't28d'
      ? `3. Close the experiment: POST /v1/experiments/${checkpoint.experimentId}/close.`
      : '3. Leave the experiment open until its final checkpoint.',
    aim
      ? `4. REQUIRED: this video is ${CHECKPOINT_OFFSETS_H[checkpoint.kind]}h old and still being ` +
        `distributed, so a change today still moves it. POST /v1/proposals with kind "${aim.kind}" ` +
        `aimed at ${aim.lever}, carrying two or three options the creator can apply within the hour, ` +
        `each with the number you expect it to reach. If the sample is too thin to be sure, propose ` +
        `anyway and say so in the rationale.`
      : '4. If there is a concrete change worth making, POST /v1/proposals so the creator can approve it.',
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
