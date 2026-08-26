import { Hono } from 'hono';
import { deleteCookie, getCookie } from 'hono/cookie';
import { streamSSE } from 'hono/streaming';
import * as repo from '../db/repo.ts';
import { isDemoChannel } from '../demo.ts';
import { demoSource, liveState } from '../demo-refresh.ts';
import { buildContext } from '../memory/context.ts';
import { cognition, mindEnabled } from '../mind/client.ts';
import { SESSION_COOKIE, verify } from '../session.ts';
import { describeComment, SEGMENT_THRESHOLDS, SEGMENTS, segmentOf } from '../memory/segments.ts';
import { resolve, suggest, type Mention } from '../memory/mentions.ts';
import * as chat from '../db/chat.ts';
import { ask, history, type AskContext, type AskOutcome, type AskStage, type OnStage } from '../mind/ask.ts';
import { steepestDropOffs } from '../youtube/analytics.ts';
import { syncChannel, syncVideo } from '../youtube/sync.ts';
import { accessTokenFor, repliesEnabled } from '../youtube/oauth.ts';
import { replyToComment } from '../youtube/data.ts';
import { scheduleFor } from '../mind/checkpoints.ts';
import type { Channel, Proposal, Video } from '../types.ts';

export const appRoutes = new Hono<{ Variables: { channel: Channel } }>();

appRoutes.use('*', async (c, next) => {
  const channelId = verify(getCookie(c, SESSION_COOKIE));
  const channel = channelId ? await repo.getChannel(channelId) : undefined;
  if (!channel) return c.json({ error: 'not connected' }, 401);
  c.set('channel', channel);
  await next();
});

appRoutes.post('/signout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

appRoutes.get('/me', async (c) => {
  const channel = c.get('channel');
  return c.json({
    channelId: channel.id,
    ytChannelId: channel.ytChannelId,
    title: channel.title,
    connectedAt: channel.createdAt,
    reachThrough: channel.reachSyncedThrough,
    lastSyncAt: channel.lastSyncAt,
    syncFailing: channel.lastSyncError !== null,
    demo: isDemoChannel(channel),
    // a screen that shows derived numbers has to be able to say so, and to say which real
    // channel the real ones came from
    demoSource: isDemoChannel(channel) ? await demoSource() : null,
    mindEnabled,
    // enabled and able to think are different states, and a creator who asks a question
    // deserves to know which one they are in before they wait two minutes for silence
    mindCognition: cognition(),
    repliesEnabled: repliesEnabled && !isDemoChannel(channel),
    counts: await repo.counts(channel.id),
  });
});

appRoutes.get('/ledger', async (c) => {
  const channel = c.get('channel');
  // buildContext is the Mind's briefing and stays exactly as it is; the scored series is
  // an extra the dashboard draws from
  const [context, scores] = await Promise.all([
    buildContext(channel),
    repo.experimentScores(channel.id),
  ]);
  return c.json({ ...context, scores });
});

appRoutes.get('/activity', async (c) => c.json(await repo.recentActivity(c.get('channel').id)));

// what is on air right now, for the sample channel only — a connected creator's own live
// state comes from their own OAuth sync, not from reading a page in public
appRoutes.get('/live', async (c) =>
  c.json(isDemoChannel(c.get('channel')) ? await liveState() : null),
);

// everything that touched this channel's memory, in order, with the unattended work marked
appRoutes.get('/timeline', async (c) => {
  const channel = c.get('channel');
  const before = c.req.query('before');
  const [events, accuracy, totals] = await Promise.all([
    repo.timeline(channel.id, {
      limit: Number(c.req.query('limit')) || 60,
      before: before ? new Date(before) : undefined,
      automatedOnly: c.req.query('automated') === '1',
    }),
    repo.accuracy(channel.id),
    repo.memoryTotals(channel.id),
  ]);

  return c.json({ events, accuracy, totals });
});

appRoutes.get('/videos', async (c) => {
  const channel = c.get('channel');
  const videos = await repo.listVideos(channel.id, 50);
  const snapshots = await repo.latestSnapshots(videos.map((v) => v.id));
  const byVideo = new Map(snapshots.map((s) => [s.videoId, s]));

  return c.json(
    videos.map((video) => {
      const snap = byVideo.get(video.id);
      return {
        ytVideoId: video.ytVideoId,
        title: video.title,
        thumbnailUrl: video.thumbnailUrl,
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

/**
 * A sparkline needs the shape, not the values: normalise against the video's own peak and
 * thin it to at most twelve points so a card carries a glyph rather than a dataset.
 */
function shape(views: number[]): number[] {
  if (views.length < 3) return [];
  const peak = Math.max(...views);
  if (peak === 0) return [];

  const step = Math.max(1, Math.ceil(views.length / 12));
  return views.filter((_, index) => index % step === 0 || index === views.length - 1)
    .map((value) => Number((value / peak).toFixed(3)));
}

// the feed: each video is a post, carrying the conversation that formed under it
appRoutes.get('/feed', async (c) => {
  const channel = c.get('channel');
  const videos = await repo.listVideos(channel.id, 30);
  const [snapshots, counts, trajectories] = await Promise.all([
    repo.latestSnapshots(videos.map((v) => v.id)),
    repo.commentCounts(channel.id),
    repo.viewTrajectories(videos.map((v) => v.id)),
  ]);
  const byVideo = new Map(snapshots.map((s) => [s.videoId, s]));

  const posts = await Promise.all(
    videos.map(async (video) => {
      const snap = byVideo.get(video.id);
      const top = await repo.commentsForVideo(video.id, 2);
      return {
        ytVideoId: video.ytVideoId,
        title: video.title,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt,
        durationS: video.durationS,
        views: snap?.views ?? null,
        likes: snap?.likes ?? null,
        ctrPct: snap?.ctr ?? null,
        avgViewPct: snap?.avgViewPct ?? null,
        subscribersGained: snap?.subscribersGained ?? null,
        commentCount: counts.get(video.id) ?? 0,
        trajectory: shape(trajectories.get(video.id) ?? []),
        topComments: top.map(describeComment),
      };
    }),
  );

  return c.json(posts);
});

appRoutes.get('/posts/:ytVideoId', async (c) => {
  const channel = c.get('channel');
  const video = await repo.getVideo(c.req.param('ytVideoId'));
  if (!video || video.channelId !== channel.id) return c.json({ error: 'video not found' }, 404);

  const [snapshot, curve, comments, history] = await Promise.all([
    repo.latestSnapshot(video.id),
    repo.latestRetention(video.id),
    repo.commentsForVideo(video.id),
    repo.snapshotHistory(video.id),
  ]);

  return c.json({
    post: {
      ytVideoId: video.ytVideoId,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt,
      durationS: video.durationS,
      views: snapshot?.views ?? null,
      likes: snapshot?.likes ?? null,
      ctrPct: snapshot?.ctr ?? null,
      avgViewPct: snapshot?.avgViewPct ?? null,
      avgViewDurationS: snapshot?.avgViewDurationS ?? null,
      subscribersGained: snapshot?.subscribersGained ?? null,
      commentCount: comments.length,
    },
    comments: comments.map(describeComment),
    retention: curve ? { points: curve, steepestDropOffs: steepestDropOffs(curve) } : null,
    history,
  });
});

/** Reports each step, since gathering the briefing is a noticeable part of the wait. */
async function answerAboutVideo(
  channel: Channel,
  video: Video,
  question: string,
  mentions: Mention[],
  onStage?: OnStage,
): Promise<Omit<AskOutcome, 'alias'>> {
  onStage?.({ stage: 'reading' });

  const [snapshot, curve, comments] = await Promise.all([
    repo.latestSnapshot(video.id),
    repo.latestRetention(video.id),
    repo.commentsForVideo(video.id, 60),
  ]);

  const segments: Record<string, number> = { superfan: 0, potential: 0, newcomer: 0 };
  for (const comment of comments) segments[segmentOf(comment)] = (segments[segmentOf(comment)] ?? 0) + 1;

  const context: AskContext = {
    channelTitle: channel.title,
    ytVideoId: video.ytVideoId,
    title: video.title,
    publishedAt: video.publishedAt.toISOString(),
    metrics: {
      views: snapshot?.views ?? null,
      ctrPct: snapshot?.ctr ?? null,
      avgViewPct: snapshot?.avgViewPct ?? null,
      subscribersGained: snapshot?.subscribersGained ?? null,
    },
    dropOffs: curve ? steepestDropOffs(curve) : null,
    segments,
    comments: comments.slice(0, 40).map((comment) => ({
      segment: segmentOf(comment),
      displayName: comment.displayName,
      viewerCommentCount: comment.viewerCommentCount,
      text: comment.text,
    })),
  };

  context.extra = await resolve(channel, mentions);
  onStage?.({ stage: 'briefed', comments: context.comments.length });

  const thread = await chat.ensureThread({
    channelId: channel.id,
    subjectKind: 'video',
    subjectId: video.ytVideoId,
    alias: `post-${video.ytVideoId}`,
    title: video.title,
  });
  await chat.appendMessage(thread.id, 'creator', question, toRefs(mentions));

  const answer = await ask(context, question, undefined, onStage);
  if (answer.reply) await chat.appendMessage(thread.id, 'mind', answer.reply);

  const { alias, ...outcome } = answer;
  void alias;
  return outcome;
}

appRoutes.post('/posts/:ytVideoId/ask', async (c) => {
  const channel = c.get('channel');
  const video = await repo.getVideo(c.req.param('ytVideoId'));
  if (!video || video.channelId !== channel.id) return c.json({ error: 'video not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (question.length < 3) return c.json({ error: 'ask something' }, 400);
  const mentions = readMentions(body);

  if (!c.req.header('accept')?.includes('text/event-stream')) {
    return c.json(await answerAboutVideo(channel, video, question, mentions));
  }

  return streamSSE(c, async (stream) => {
    const say = (event: string, data: unknown) =>
      stream.writeSSE({ event, data: JSON.stringify(data) });

    try {
      const answer = await answerAboutVideo(channel, video, question, mentions, (update: AskStage) => {
        void say('stage', update);
      });
      await say('done', answer);
    } catch {
      await say('failed', {});
    }
  });
});

appRoutes.get('/posts/:ytVideoId/chat', async (c) =>
  c.json(await storedChat(c.get('channel').id, 'video', c.req.param('ytVideoId'))),
);

appRoutes.get('/mentions', async (c) =>
  c.json(await suggest(c.get('channel'), c.req.query('q') ?? '')),
);

appRoutes.get('/viewers/:ytAuthorId', async (c) => {
  const channel = c.get('channel');
  const viewer = await repo.getViewer(channel.id, c.req.param('ytAuthorId'));
  if (!viewer) return c.json({ error: 'viewer not found' }, 404);

  const comments = await repo.viewerComments(viewer.id);
  const videos = new Set(comments.map((comment) => comment.ytVideoId));

  return c.json({
    viewer: {
      ytAuthorId: viewer.ytAuthorId,
      displayName: viewer.displayName,
      commentCount: viewer.commentCount,
      firstSeenAt: viewer.firstSeenAt,
      lastSeenAt: viewer.lastSeenAt,
      // the same span the audience list shows, computed once so the two cannot disagree
      tenureDays: Math.round(
        (viewer.lastSeenAt.getTime() - viewer.firstSeenAt.getTime()) / 86_400_000,
      ),
      segment: segmentOf({
        viewerCommentCount: viewer.commentCount,
        viewerFirstSeenAt: viewer.firstSeenAt,
      }),
      videosTouched: videos.size,
      totalLikes: comments.reduce((sum, comment) => sum + comment.likeCount, 0),
    },
    comments,
  });
});

appRoutes.post('/viewers/:ytAuthorId/ask', async (c) => {
  const channel = c.get('channel');
  const viewer = await repo.getViewer(channel.id, c.req.param('ytAuthorId'));
  if (!viewer) return c.json({ error: 'viewer not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (question.length < 3) return c.json({ error: 'ask something' }, 400);

  const [self] = await resolve(channel, [{ kind: 'viewer', id: viewer.ytAuthorId }]);
  const mentions = readMentions(body);
  const extra = await resolve(channel, mentions);

  // chat_threads.alias is unique across every channel, but a viewer id is only unique
  // within one, so the channel has to be part of the key
  const alias = `viewer-${channel.id}-${viewer.ytAuthorId}`;
  const thread = await chat.ensureThread({
    channelId: channel.id,
    subjectKind: 'viewer',
    subjectId: viewer.ytAuthorId,
    alias,
    title: viewer.displayName,
  });
  await chat.appendMessage(thread.id, 'creator', question, [
    { kind: 'viewer', refId: viewer.ytAuthorId },
    ...toRefs(mentions),
  ]);

  const answer = await ask(
    {
      alias,
        channelTitle: channel.title,
        ytVideoId: '',
        title: `the viewer ${viewer.displayName}`,
        publishedAt: viewer.firstSeenAt.toISOString(),
        metrics: { comments: viewer.commentCount },
        dropOffs: null,
        segments: {},
        comments: [],
        extra: [self ?? '', ...extra].filter(Boolean),
      },
      question,
  );

  if (answer.reply) await chat.appendMessage(thread.id, 'mind', answer.reply);
  return c.json(answer);
});

appRoutes.get('/viewers/:ytAuthorId/chat', async (c) =>
  c.json(await storedChat(c.get('channel').id, 'viewer', c.req.param('ytAuthorId'))),
);

/** Their chat history split by the video each conversation was about. */
appRoutes.get('/viewers/:ytAuthorId/threads', async (c) =>
  c.json(await chat.threadsMentioning(c.get('channel').id, 'viewer', c.req.param('ytAuthorId'))),
);

appRoutes.get('/chats', async (c) => c.json(await chat.recentThreads(c.get('channel').id)));

appRoutes.get('/chats/search', async (c) => {
  const refs = (c.req.query('ref') ?? '')
    .split(',')
    .filter(Boolean)
    .map((token) => {
      const [kind, ...rest] = token.split(':');
      return { kind: kind!, refId: rest.join(':') };
    })
    .filter((ref) => ref.refId.length > 0);

  return c.json(
    await chat.searchChat(c.get('channel').id, { text: c.req.query('q') ?? undefined, refs }),
  );
});

async function storedChat(channelId: string, kind: 'video' | 'viewer', subjectId: string) {
  const thread = await chat.findThread(channelId, kind, subjectId);
  if (!thread) return [];

  await catchUp(thread);
  const messages = await chat.threadMessages(thread.id);
  return messages.map((message) => ({
    role: message.role,
    text: message.body,
    at: message.createdAt,
  }));
}

/**
 * Replies can land after the request timed out. Minds keeps them, so a thread whose last
 * message is the creator's checks there before returning.
 */
async function catchUp(thread: { id: string; alias: string }): Promise<void> {
  const stored = await chat.threadMessages(thread.id);
  const last = stored.at(-1);
  if (!last || last.role !== 'creator') return;

  const remote = await history(thread.alias).catch(() => []);
  const answer = remote
    .filter((turn) => turn.role === 'mind' && new Date(turn.at) > last.createdAt)
    .at(-1);

  // an identical body already on the thread means a concurrent read got there first
  if (!answer || stored.some((message) => message.body === answer.text)) return;
  await chat.appendMessage(thread.id, 'mind', answer.text);
}

const toRefs = (mentions: Mention[]) => mentions.map((m) => ({ kind: m.kind, refId: m.id }));

function readMentions(body: unknown): Mention[] {
  const raw = (body as { mentions?: unknown })?.mentions;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is Mention =>
        typeof item?.kind === 'string' &&
        typeof item?.id === 'string' &&
        ['viewer', 'segment', 'video', 'experiment'].includes(item.kind),
    )
    .slice(0, 6);
}

appRoutes.get('/videos/:ytVideoId', async (c) => {
  const channel = c.get('channel');
  const ytVideoId = c.req.param('ytVideoId');

  let video = await repo.getVideo(ytVideoId);
  if (!video || video.channelId !== channel.id) return c.json({ error: 'video not found' }, 404);

  let curve = await repo.latestRetention(video.id);
  if (!curve) {
    video = (await syncVideo(channel, ytVideoId).catch(() => video)) ?? video;
    curve = await repo.latestRetention(video.id);
  }

  return c.json({
    video,
    history: await repo.snapshotHistory(video.id),
    retention: curve ? { points: curve, steepestDropOffs: steepestDropOffs(curve) } : null,
  });
});

appRoutes.get('/replies', async (c) => {
  const channel = c.get('channel');
  const queue = await repo.replyQueue(channel.id);
  return c.json({
    enabled: repliesEnabled && !isDemoChannel(channel),
    queue: queue.map((target) => ({ ...target, segment: segmentOf(target) })),
  });
});

/** The Mind writes the draft; the creator is the only thing that can publish it. */
appRoutes.post('/comments/:ytCommentId/draft', async (c) => {
  const channel = c.get('channel');
  const target = await repo.commentOwner(channel.id, c.req.param('ytCommentId'));
  if (!target) return c.json({ error: 'comment not found' }, 404);

  const [about] = await resolve(channel, [{ kind: 'viewer', id: (await c.req.json().catch(() => ({}))).ytAuthorId ?? '' }]);

  return c.json(
    await ask(
      {
        alias: `reply-${c.req.param('ytCommentId')}`,
        channelTitle: channel.title,
        ytVideoId: '',
        title: target.videoTitle,
        publishedAt: new Date().toISOString(),
        metrics: {},
        dropOffs: null,
        segments: {},
        comments: [],
        extra: [about ?? '', `COMMENT from ${target.displayName}: ${target.text}`].filter(Boolean),
      },
      'Draft a reply I can send as the creator. Match how this channel already talks to ' +
        'people. One or two sentences, no emoji unless the comment used one, answer the ' +
        'actual question. Return only the reply text.',
    ),
  );
});

appRoutes.post('/comments/:ytCommentId/reply', async (c) => {
  if (!repliesEnabled) return c.json({ error: 'replies are switched off' }, 403);

  const channel = c.get('channel');
  if (isDemoChannel(channel)) return c.json({ error: 'demo-read-only' }, 403);

  const ytCommentId = c.req.param('ytCommentId');
  const target = await repo.commentOwner(channel.id, ytCommentId);
  if (!target) return c.json({ error: 'comment not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (text.length < 2) return c.json({ error: 'write something' }, 400);

  const token = await accessTokenFor(channel);
  const posted = await replyToComment(token, ytCommentId, text);
  await repo.markReplied(ytCommentId, text, posted.ytCommentId);
  await repo.setTriage(ytCommentId, 'answered');

  return c.json({ ok: true, ytCommentId: posted.ytCommentId });
});

appRoutes.get('/audience', async (c) => {
  const channel = c.get('channel');
  const asked = c.req.query('segment');
  const segment = SEGMENTS.includes(asked as never) ? asked! : null;
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 40, 1), 200);

  // the tier counts come from every viewer, not from the page we happen to be showing —
  // a chip that says "20" when the channel has 900 regulars is worse than no chip
  const [people, counts, queue] = await Promise.all([
    repo.viewersBySegment(channel.id, SEGMENT_THRESHOLDS, segment, limit),
    repo.segmentCounts(channel.id, SEGMENT_THRESHOLDS),
    repo.triageCandidates(channel.id, 25),
  ]);

  return c.json({
    superfans: people.map((fan) => ({
      ...fan,
      segment: segmentOf({ viewerCommentCount: fan.commentCount, viewerFirstSeenAt: fan.firstSeenAt }),
    })),
    segmentCounts: counts,
    queue: queue.map((comment) => ({ ...comment, segment: segmentOf(comment) })),
  });
});

appRoutes.get('/proposals', async (c) =>
  c.json(await repo.listProposals(c.get('channel').id, 'pending')),
);

appRoutes.post('/proposals/:id/decide', async (c) => {
  const channel = c.get('channel');
  const body = await c.req.json().catch(() => ({}));
  const status = body?.status === 'approved' ? 'approved' : 'dismissed';
  const choice = typeof body?.choice === 'string' ? body.choice : null;

  const proposal = await repo.decideProposal(c.req.param('id'), status, choice);
  if (!proposal) return c.json({ error: 'proposal not found or already decided' }, 404);

  // This is the COMMIT step of the loop: the creator picking a concept is what puts the
  // Mind's number on the record. Until now only the Mind could open an experiment, so the
  // one decision the product is built around had no way in.
  const opened =
    status === 'approved' && proposal.kind === 'experiment'
      ? await openFromProposal(channel.id, proposal, choice)
      : null;

  return c.json({ ...proposal, opened });
});

async function openFromProposal(
  channelId: string,
  proposal: Proposal,
  choice: string | null,
): Promise<{ experimentId: string; checkpoints: number } | null> {
  const payload = proposal.payload;
  if (!payload?.concepts.length) return null;

  const concept = payload.concepts.find((item) => item.label === choice) ?? payload.concepts[0]!;
  const named = payload.ytVideoId ? await repo.getVideo(payload.ytVideoId) : undefined;
  const target =
    named?.channelId === channelId
      ? named
      : proposal.videoId
        ? await repo.getVideoById(proposal.videoId)
        : undefined;

  const experiment = await repo.createExperiment({
    channelId,
    videoId: null,
    lever: payload.lever,
    hypothesis: concept.hypothesis,
    prediction: concept.prediction,
  });

  // same path the Mind takes: attaching is what moves it to 'measuring' and starts the clock
  if (!target) return { experimentId: experiment.id, checkpoints: 0 };

  await repo.attachVideo(experiment.id, target.id);
  const checkpoints = await repo.createCheckpoints(experiment.id, scheduleFor(target.publishedAt));
  return { experimentId: experiment.id, checkpoints: checkpoints.length };
}

appRoutes.post('/sync', async (c) => {
  const channel = c.get('channel');
  if (isDemoChannel(channel)) return c.json({ error: 'demo-read-only' }, 403);
  return c.json(await syncChannel(channel, { videoLimit: 25, withComments: true }));
});
