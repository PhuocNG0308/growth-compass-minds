import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import * as repo from '../db/repo.ts';
import { SEGMENT_THRESHOLDS } from '../memory/segments.ts';
import { env } from '../env.ts';
import { buildContext } from '../memory/context.ts';
import { describe } from '../memory/learnings.ts';
import { scheduleFor } from '../mind/checkpoints.ts';
import { steepestDropOffs } from '../youtube/analytics.ts';
import { syncChannel, syncVideo } from '../youtube/sync.ts';
import { PROPOSAL_KINDS } from '../types.ts';
import * as chat from '../db/chat.ts';

export const mindRoutes = new Hono();

mindRoutes.use('*', async (c, next) => {
  const presented = Buffer.from(c.req.header('authorization')?.replace(/^Bearer /, '') ?? '');
  const expected = Buffer.from(env.GROWTH_API_TOKEN);
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});

async function requireChannel(id: string) {
  const channel = await repo.getChannel(id);
  if (!channel) throw new HttpError(404, `channel ${id} not connected`);
  return channel;
}

class HttpError extends Error {
  constructor(
    readonly status: 400 | 404,
    message: string,
  ) {
    super(message);
  }
}

mindRoutes.onError((err, c) =>
  err instanceof HttpError ? c.json({ error: err.message }, err.status) : c.json({ error: String(err) }, 500),
);

mindRoutes.get('/channels', async (c) => {
  const channels = await repo.listChannels();
  return c.json(
    channels.map((ch) => ({ channelId: ch.id, ytChannelId: ch.ytChannelId, title: ch.title })),
  );
});

mindRoutes.get('/channels/:id/context', async (c) =>
  c.json(await buildContext(await requireChannel(c.req.param('id')))),
);

mindRoutes.post('/channels/:id/sync', async (c) => {
  const channel = await requireChannel(c.req.param('id'));
  return c.json(await syncChannel(channel, { videoLimit: 25, withComments: true }));
});

mindRoutes.get('/channels/:id/videos', async (c) => {
  const channel = await requireChannel(c.req.param('id'));
  const videos = await repo.listVideos(channel.id, Number(c.req.query('limit') ?? 25));
  const snapshots = await repo.latestSnapshots(videos.map((v) => v.id));
  const byVideo = new Map(snapshots.map((s) => [s.videoId, s]));

  return c.json(
    videos.map((video) => {
      const snap = byVideo.get(video.id);
      return {
        ytVideoId: video.ytVideoId,
        title: video.title,
        publishedAt: video.publishedAt,
        durationS: video.durationS,
        views: snap?.views ?? null,
        impressions: snap?.impressions ?? null,
        ctrPct: snap?.ctr ?? null,
        avgViewPct: snap?.avgViewPct ?? null,
        avgViewDurationS: snap?.avgViewDurationS ?? null,
        subscribersGained: snap?.subscribersGained ?? null,
      };
    }),
  );
});

mindRoutes.get('/videos/:ytVideoId', async (c) => {
  const video = await repo.getVideo(c.req.param('ytVideoId'));
  if (!video) throw new HttpError(404, 'video not synced');
  return c.json({ video, history: await repo.snapshotHistory(video.id) });
});

mindRoutes.get('/videos/:ytVideoId/retention', async (c) => {
  const ytVideoId = c.req.param('ytVideoId');
  let video = await repo.getVideo(ytVideoId);
  let curve = video ? await repo.latestRetention(video.id) : null;

  if (video && !curve) {
    const channel = await requireChannel(video.channelId);
    video = await syncVideo(channel, ytVideoId);
    curve = video ? await repo.latestRetention(video.id) : null;
  }
  if (!curve) throw new HttpError(404, 'no retention data for this video yet');

  return c.json({ ytVideoId, points: curve, steepestDropOffs: steepestDropOffs(curve) });
});

const experimentBody = z.object({
  channelId: z.string(),
  ytVideoId: z.string().optional(),
  lever: z.enum(['thumbnail', 'title', 'hook', 'topic', 'format', 'cadence', 'community']),
  hypothesis: z.string().min(10),
  prediction: z.record(z.string(), z.number()).refine((p) => Object.keys(p).length > 0, {
    message: 'prediction must contain at least one numeric target',
  }),
});

mindRoutes.post('/experiments', async (c) => {
  const body = experimentBody.parse(await c.req.json());
  const channel = await requireChannel(body.channelId);
  const video = body.ytVideoId ? await repo.getVideo(body.ytVideoId) : undefined;

  const experiment = await repo.createExperiment({
    channelId: channel.id,
    videoId: video?.id ?? null,
    lever: body.lever,
    hypothesis: body.hypothesis,
    prediction: body.prediction,
  });

  const checkpoints = video ? await repo.createCheckpoints(experiment.id, scheduleFor(video.publishedAt)) : [];
  return c.json({ experiment, checkpoints }, 201);
});

mindRoutes.get('/channels/:id/experiments', async (c) => {
  const channel = await requireChannel(c.req.param('id'));
  return c.json(await repo.listExperiments(channel.id, c.req.query('status')));
});

mindRoutes.post('/experiments/:id/attach', async (c) => {
  const { ytVideoId } = z.object({ ytVideoId: z.string() }).parse(await c.req.json());
  const video = await repo.getVideo(ytVideoId);
  if (!video) throw new HttpError(404, 'video not synced; run channel sync first');

  await repo.attachVideo(c.req.param('id'), video.id);
  const checkpoints = await repo.createCheckpoints(c.req.param('id'), scheduleFor(video.publishedAt));
  return c.json({ ytVideoId, checkpoints });
});

mindRoutes.post('/experiments/:id/close', async (c) => {
  const body = z
    .object({
      outcome: z.record(z.string(), z.json()),
      verdict: z.enum(['confirmed', 'refuted', 'inconclusive']),
    })
    .parse(await c.req.json());

  const experiment = await repo.closeExperiment(c.req.param('id'), body.outcome, body.verdict);
  if (!experiment) throw new HttpError(404, 'experiment not found');
  return c.json(experiment);
});

mindRoutes.post('/checkpoints/:id/observe', async (c) => {
  const body = z.object({ observation: z.record(z.string(), z.json()) }).parse(await c.req.json());
  const checkpoint = await repo.recordObservation(c.req.param('id'), body.observation);
  if (!checkpoint) throw new HttpError(404, 'checkpoint not found');
  return c.json(checkpoint);
});

mindRoutes.get('/channels/:id/learnings', async (c) => {
  const channel = await requireChannel(c.req.param('id'));
  return c.json((await repo.listLearnings(channel.id)).map(describe));
});

mindRoutes.post('/learnings', async (c) => {
  const body = z
    .object({
      channelId: z.string(),
      statement: z.string().min(10),
      lever: z.string().nullable().default(null),
      experimentId: z.string().nullable().default(null),
      contradicted: z.boolean().default(false),
    })
    .parse(await c.req.json());

  const channel = await requireChannel(body.channelId);
  const learning = await repo.upsertLearning({ ...body, channelId: channel.id });
  return c.json(describe(learning));
});

mindRoutes.post('/learnings/:id/promoted', async (c) => {
  const learning = await repo.markPromoted(c.req.param('id'));
  if (!learning) throw new HttpError(404, 'learning not found');
  return c.json(describe(learning));
});

/** Same rule as opening an experiment directly: a prediction with no number is not one. */
const numericPrediction = z
  .record(z.string(), z.number())
  .refine((prediction) => Object.keys(prediction).length > 0, 'predict at least one number');

const conceptBody = z.object({
  label: z.string().min(3).max(140),
  hypothesis: z.string().min(10),
  prediction: numericPrediction,
});

const proposalBody = z.object({
  channelId: z.string(),
  ytVideoId: z.string().optional(),
  ytAuthorId: z.string().optional(),
  kind: z.enum(PROPOSAL_KINDS),
  summary: z.string().min(5).max(140),
  detail: z.string().min(5),
  rationale: z.string().min(10),
  options: z.array(z.string()).max(5).default([]),
  experiment: z
    .object({
      lever: z.string().min(2),
      ytVideoId: z.string().nullish(),
      concepts: z.array(conceptBody).min(1).max(5),
    })
    .optional(),
});

mindRoutes.post('/proposals', async (c) => {
  const body = proposalBody.parse(await c.req.json());
  const channel = await requireChannel(body.channelId);
  const video = body.ytVideoId ? await repo.getVideo(body.ytVideoId) : undefined;
  const viewer = body.ytAuthorId ? await repo.getViewer(channel.id, body.ytAuthorId) : undefined;

  if (body.kind === 'experiment' && !body.experiment) {
    throw new HttpError(400, 'an experiment proposal needs `experiment` with at least one concept');
  }

  const proposal = await repo.createProposal({
    channelId: channel.id,
    videoId: video?.id ?? null,
    viewerId: viewer?.id ?? null,
    kind: body.kind,
    summary: body.summary,
    detail: body.detail,
    rationale: body.rationale,
    // the creator picks by label, so the options list has to mirror the concepts
    options: body.experiment ? body.experiment.concepts.map((c) => c.label) : body.options,
    payload: body.experiment
      ? { ...body.experiment, ytVideoId: body.experiment.ytVideoId ?? body.ytVideoId ?? null }
      : null,
  });
  return c.json(proposal, 201);
});

mindRoutes.get('/channels/:id/proposals', async (c) => {
  const channel = await requireChannel(c.req.param('id'));
  return c.json(await repo.listProposals(channel.id, c.req.query('status')));
});

/** The Mind recalling its own past analysis, filtered by tag the way a search narrows. */
mindRoutes.get('/channels/:id/chats/search', async (c) => {
  const channel = await requireChannel(c.req.param('id'));
  const refs = (c.req.query('ref') ?? '')
    .split(',')
    .filter(Boolean)
    .map((token) => {
      const [kind, ...rest] = token.split(':');
      return { kind: kind!, refId: rest.join(':') };
    })
    .filter((ref) => ref.refId.length > 0);

  return c.json(
    await chat.searchChat(channel.id, { text: c.req.query('q') ?? undefined, refs }),
  );
});

mindRoutes.get('/channels/:id/chats', async (c) =>
  c.json(await chat.recentThreads(await requireChannel(c.req.param('id')).then((ch) => ch.id))),
);

mindRoutes.get('/channels/:id/triage', async (c) => {
  const channel = await requireChannel(c.req.param('id'));
  return c.json(await repo.triageCandidates(channel.id, Number(c.req.query('limit') ?? 40)));
});

mindRoutes.post('/comments/:ytCommentId/triage', async (c) => {
  const body = z
    .object({ triage: z.enum(['superfan', 'question', 'criticism', 'noise']) })
    .parse(await c.req.json());
  await repo.setTriage(c.req.param('ytCommentId'), body.triage);
  return c.json({ ok: true });
});

mindRoutes.get('/channels/:id/superfans', async (c) => {
  const channel = await requireChannel(c.req.param('id'));
  return c.json(await repo.viewersBySegment(channel.id, SEGMENT_THRESHOLDS, 'superfan'));
});
