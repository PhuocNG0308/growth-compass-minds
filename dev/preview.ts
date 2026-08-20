import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { ask, type AskContext } from '../src/mind/ask.ts';
import { mindEnabled } from '../src/mind/client.ts';
import { reachableAt } from '../src/net.ts';
import * as demo from './fixtures.ts';

const PORT = Number(process.env.PREVIEW_PORT ?? 8081);
const NL = String.fromCharCode(10);

const app = new Hono();

app.get('/api/mode', (c) => c.json({ preview: true, liveMind: mindEnabled }));

// preview exists to look at the interface, so it opens straight into the dashboard
app.get('/auth/youtube', (c) =>
  c.html(`<!doctype html>
<meta charset="utf-8">
<title>Preview</title>
<script>
  window.opener?.postMessage({ type: 'youtube-connect', ok: true }, location.origin);
  window.close();
</script>`),
);

app.get('/api/me', (c) => c.json(demo.me));
app.get('/api/ledger', (c) => c.json(demo.ledger));
app.get('/api/activity', (c) => c.json(demo.activity));
app.get('/api/videos', (c) => c.json(demo.videos));
app.get('/api/feed', (c) => c.json(demo.feed));
app.get('/api/audience', (c) => c.json(demo.audience));
app.get('/api/proposals', (c) => c.json(demo.proposals));
app.post('/api/proposals/:id/decide', (c) => c.json({ ok: true }));
app.post('/api/sync', (c) => c.json({ videos: demo.videos.length, reachThrough: demo.me.reachThrough }));
app.get('/api/mentions', (c) => c.json(demo.mentionSuggestions(c.req.query('q') ?? '')));

app.get('/api/posts/:ytVideoId', (c) => {
  const detail = demo.postDetail(c.req.param('ytVideoId'));
  return detail ? c.json(detail) : c.json({ error: 'no sample post' }, 404);
});

app.get('/api/videos/:ytVideoId', (c) => {
  const detail = demo.videoDetails[c.req.param('ytVideoId')];
  return detail ? c.json(detail) : c.json({ error: 'no sample detail for this video' }, 404);
});

app.get('/api/viewers/:ytAuthorId', (c) => {
  const profile = demo.viewerProfile(c.req.param('ytAuthorId'));
  return profile ? c.json(profile) : c.json({ error: 'no sample viewer' }, 404);
});

app.get('/api/posts/:ytVideoId/chat', (c) => {
  const key = `video:${c.req.param('ytVideoId')}`;
  return c.json(threads.get(key)?.messages ?? demo.chatFor(c.req.param('ytVideoId')));
});

app.get('/api/viewers/:ytAuthorId/chat', (c) =>
  c.json(threads.get(`viewer:${c.req.param('ytAuthorId')}`)?.messages ?? []),
);

app.get('/api/chats', (c) =>
  c.json(
    [...threads.values()]
      .filter((item) => item.messages.length > 0)
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
      .map(digest),
  ),
);

app.get('/api/viewers/:ytAuthorId/threads', (c) => {
  const tag = `viewer:${c.req.param('ytAuthorId')}`;
  return c.json(
    [...threads.values()]
      .filter((item) => item.messages.some((message) => message.refs.includes(tag)))
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
      .map(digest),
  );
});

// the video, viewers and comments are sample data; the Mind answering about them is real
app.post('/api/posts/:ytVideoId/ask', async (c) => {
  const detail = demo.postDetail(c.req.param('ytVideoId'));
  if (!detail) return c.json({ error: 'no sample post' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const question = readQuestion(body);
  if (!question) return c.json({ error: 'ask something' }, 400);
  if (!mindEnabled) return c.json(OFFLINE);

  const segments: Record<string, number> = { superfan: 0, potential: 0, newcomer: 0 };
  for (const comment of detail.comments) {
    segments[comment.segment] = (segments[comment.segment] ?? 0) + 1;
  }

  const retention = detail.retention as { steepestDropOffs?: Array<{ ratio: number; drop: number }> } | null;

  const context: AskContext = {
    channelTitle: demo.me.title,
    ytVideoId: detail.post.ytVideoId,
    title: detail.post.title,
    publishedAt: detail.post.publishedAt,
    metrics: {
      views: detail.post.views,
      ctrPct: detail.post.ctrPct,
      avgViewPct: detail.post.avgViewPct,
      subscribersGained: detail.post.subscribersGained,
    },
    dropOffs: retention?.steepestDropOffs ?? null,
    segments,
    comments: detail.comments.map((comment) => ({
      segment: comment.segment,
      displayName: comment.displayName,
      viewerCommentCount: comment.viewerCommentCount,
      text: comment.text,
    })),
    extra: resolveSample(body),
  };

  const target = thread('video', detail.post.ytVideoId, detail.post.title);
  record(target, 'creator', question, refsOf(body));

  const answer = await ask(context, question);
  if (answer.reply) record(target, 'mind', answer.reply);
  return c.json(answer);
});

app.post('/api/viewers/:ytAuthorId/ask', async (c) => {
  const profile = demo.viewerProfile(c.req.param('ytAuthorId'));
  if (!profile) return c.json({ error: 'no sample viewer' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const question = readQuestion(body);
  if (!question) return c.json({ error: 'ask something' }, 400);
  if (!mindEnabled) return c.json(OFFLINE);

  const { viewer, comments } = profile;
  const self = [
    `VIEWER ${viewer.displayName} — ${viewer.segment}`,
    `${viewer.commentCount} comments, first seen ${viewer.firstSeenAt.slice(0, 10)}`,
    ...comments.map((row) => `- on "${row.videoTitle}": ${row.text}`),
  ].join(NL);

  const target = thread('viewer', viewer.ytAuthorId, viewer.displayName);
  record(target, 'creator', question, [`viewer:${viewer.ytAuthorId}`, ...refsOf(body)]);

  const answer = await ask(
      {
        alias: `viewer-${viewer.ytAuthorId}`,
        channelTitle: demo.me.title,
        ytVideoId: '',
        title: `the viewer ${viewer.displayName}`,
        publishedAt: viewer.firstSeenAt,
        metrics: { comments: viewer.commentCount },
        dropOffs: null,
        segments: {},
        comments: [],
        extra: [self, ...resolveSample(body)],
      },
      question,
  );

  if (answer.reply) record(target, 'mind', answer.reply);
  return c.json(answer);
});

const OFFLINE = { alias: 'preview', reply: null, timedOut: false, mindOffline: true };

// preview keeps threads in memory so the conversation lists behave like the real store
type Thread = {
  id: string;
  subjectKind: 'video' | 'viewer';
  subjectId: string;
  title: string;
  lastMessageAt: string;
  messages: Array<{ role: 'creator' | 'mind'; text: string; at: string; refs: string[] }>;
};

const threads = new Map<string, Thread>();

function thread(subjectKind: 'video' | 'viewer', subjectId: string, title: string): Thread {
  const key = `${subjectKind}:${subjectId}`;
  const existing = threads.get(key);
  if (existing) return existing;
  const created: Thread = { id: key, subjectKind, subjectId, title, lastMessageAt: '', messages: [] };
  threads.set(key, created);
  return created;
}

function record(target: Thread, role: 'creator' | 'mind', text: string, refs: string[] = []) {
  const at = new Date().toISOString();
  target.messages.push({ role, text, at, refs });
  target.lastMessageAt = at;
}

const digest = (target: Thread) => ({
  id: target.id,
  subjectKind: target.subjectKind,
  subjectId: target.subjectId,
  title: target.title,
  lastMessageAt: target.lastMessageAt,
  messageCount: target.messages.length,
  lastBody: target.messages.at(-1)?.text ?? '',
});

const refsOf = (body: unknown) =>
  ((body as { mentions?: Array<{ kind: string; id: string }> })?.mentions ?? []).map(
    (mention) => `${mention.kind}:${mention.id}`,
  );

function readQuestion(body: unknown): string | null {
  const question = (body as { question?: unknown })?.question;
  if (typeof question !== 'string') return null;
  const trimmed = question.trim();
  return trimmed.length >= 3 ? trimmed : null;
}

/** Preview has no database, so mentions resolve straight out of the fixtures. */
function resolveSample(body: unknown): string[] {
  const raw = (body as { mentions?: Array<{ kind: string; id: string }> })?.mentions;
  if (!Array.isArray(raw)) return [];

  return raw.slice(0, 6).flatMap((mention) => {
    if (mention.kind === 'viewer') {
      const profile = demo.viewerProfile(mention.id);
      if (!profile) return [];
      return [
        [
          `VIEWER ${profile.viewer.displayName} — ${profile.viewer.segment}`,
          ...profile.comments.map((row) => `- on "${row.videoTitle}": ${row.text}`),
        ].join(NL),
      ];
    }

    if (mention.kind === 'segment') {
      const members = [...demo.viewers.values()].filter(
        (entry) => entry.comments[0]?.segment === mention.id,
      );
      return [
        [
          `SEGMENT ${mention.id} — ${members.length} people`,
          ...members.map((entry) => `- ${entry.displayName}: ${entry.comments.length} comments here`),
        ].join(NL),
      ];
    }

    if (mention.kind === 'video') {
      const detail = demo.postDetail(mention.id);
      if (!detail) return [];
      return [
        [
          `VIDEO "${detail.post.title}"`,
          `metrics: ${JSON.stringify({ views: detail.post.views, ctrPct: detail.post.ctrPct })}`,
          ...detail.comments.map((row) => `- ${row.displayName}: ${row.text}`),
        ].join(NL),
      ];
    }

    const experiment = demo.ledger.openExperiments.find((item) => item.id === mention.id);
    if (!experiment) return [];
    return [
      [
        `EXPERIMENT ${experiment.lever} — ${experiment.status}`,
        `hypothesis: ${experiment.hypothesis}`,
        `predicted: ${JSON.stringify(experiment.prediction)}`,
      ].join(NL),
    ];
  });
}

app.use('/*', serveStatic({ root: './web/dist' }));

serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, ({ port }) =>
  console.log(
    [
      '',
      '  Growth Compass preview — opens straight into the dashboard',
      ...reachableAt(port).map((url) => `    ${url}`),
      '',
      '  Videos, viewers and comments come from dev/fixtures.ts.',
      mindEnabled
        ? '  MINDS_BUILDER_API_KEY is set — asking a question talks to your real Mind.'
        : '  MINDS_BUILDER_API_KEY is unset — asking a question returns nothing.',
      '',
    ].join(NL),
  ),
);
