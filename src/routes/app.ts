import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import * as repo from '../db/repo.ts';
import { buildContext } from '../memory/context.ts';
import { mindEnabled } from '../mind/client.ts';
import { SESSION_COOKIE, verify } from '../session.ts';
import { describeComment, segmentOf } from '../memory/segments.ts';
import { resolve, suggest, type Mention } from '../memory/mentions.ts';
import * as chat from '../db/chat.ts';
import { ask, history, type AskContext } from '../mind/ask.ts';
import { steepestDropOffs } from '../youtube/analytics.ts';
import { syncChannel, syncVideo } from '../youtube/sync.ts';
import type { Channel } from '../types.ts';

export const appRoutes = new Hono<{ Variables: { channel: Channel } }>();

appRoutes.use('*', async (c, next) => {
  const channelId = verify(getCookie(c, SESSION_COOKIE));
  const channel = channelId ? await repo.getChannel(channelId) : undefined;
  if (!channel) return c.json({ error: 'not connected' }, 401);
  c.set('channel', channel);
  await next();
});

appRoutes.get('/me', async (c) => {
  const channel = c.get('channel');
  return c.json({
    channelId: channel.id,
    ytChannelId: channel.ytChannelId,
    title: channel.title,
    connectedAt: channel.createdAt,
    reachThrough: channel.reachSyncedThrough,
    mindEnabled,
    counts: await repo.counts(channel.id),
  });
});

appRoutes.get('/ledger', async (c) => c.json(await buildContext(c.get('channel'))));

appRoutes.get('/activity', async (c) => c.json(await repo.recentActivity(c.get('channel').id)));

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

// the feed: each video is a post, carrying the conversation that formed under it
appRoutes.get('/feed', async (c) => {
  const channel = c.get('channel');
  const videos = await repo.listVideos(channel.id, 30);
  const [snapshots, counts] = await Promise.all([
    repo.latestSnapshots(videos.map((v) => v.id)),
    repo.commentCounts(channel.id),
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

appRoutes.post('/posts/:ytVideoId/ask', async (c) => {
  const channel = c.get('channel');
  const video = await repo.getVideo(c.req.param('ytVideoId'));
  if (!video || video.channelId !== channel.id) return c.json({ error: 'video not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (question.length < 3) return c.json({ error: 'ask something' }, 400);

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

  const mentions = readMentions(body);
  context.extra = await resolve(channel, mentions);

  const thread = await chat.ensureThread({
    channelId: channel.id,
    subjectKind: 'video',
    subjectId: video.ytVideoId,
    alias: `post-${video.ytVideoId}`,
    title: video.title,
  });
  await chat.appendMessage(thread.id, 'creator', question, toRefs(mentions));

  const answer = await ask(context, question);
  if (answer.reply) await chat.appendMessage(thread.id, 'mind', answer.reply);
  return c.json(answer);
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

  const thread = await chat.ensureThread({
    channelId: channel.id,
    subjectKind: 'viewer',
    subjectId: viewer.ytAuthorId,
    alias: `viewer-${viewer.ytAuthorId}`,
    title: viewer.displayName,
  });
  await chat.appendMessage(thread.id, 'creator', question, [
    { kind: 'viewer', refId: viewer.ytAuthorId },
    ...toRefs(mentions),
  ]);

  const answer = await ask(
    {
      alias: `viewer-${viewer.ytAuthorId}`,
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
  const messages = await chat.threadMessages(thread.id);
  return messages.map((message) => ({
    role: message.role,
    text: message.body,
    at: message.createdAt,
  }));
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

appRoutes.get('/audience', async (c) => {
  const channel = c.get('channel');
  const [fans, queue] = await Promise.all([
    repo.superfans(channel.id),
    repo.triageCandidates(channel.id, 25),
  ]);
  return c.json({
    superfans: fans.map((fan) => ({
      ...fan,
      segment: segmentOf({ viewerCommentCount: fan.commentCount, viewerFirstSeenAt: fan.firstSeenAt }),
    })),
    queue: queue.map((comment) => ({ ...comment, segment: segmentOf(comment) })),
  });
});

appRoutes.get('/proposals', async (c) =>
  c.json(await repo.listProposals(c.get('channel').id, 'pending')),
);

appRoutes.post('/proposals/:id/decide', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const status = body?.status === 'approved' ? 'approved' : 'dismissed';
  const choice = typeof body?.choice === 'string' ? body.choice : null;

  const proposal = await repo.decideProposal(c.req.param('id'), status, choice);
  if (!proposal) return c.json({ error: 'proposal not found or already decided' }, 404);
  return c.json(proposal);
});

appRoutes.post('/sync', async (c) =>
  c.json(await syncChannel(c.get('channel'), { videoLimit: 25, withComments: true })),
);
