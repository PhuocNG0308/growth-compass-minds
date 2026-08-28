import { Hono } from 'hono';
import { sql } from '../db/client.ts';
import * as repo from '../db/repo.ts';
import { isDemoChannel } from '../demo.ts';
import { SUPERFAN_COMMENTS } from '../memory/segments.ts';
import { clearSandbox, MIND_STATES, patchSandbox, sandbox, sandboxEnabled } from '../sandbox.ts';
import { PROPOSAL_KINDS, type Channel, type ProposalKind } from '../types.ts';

export const sandboxRoutes = new Hono<{ Variables: { channel: Channel } }>();

sandboxRoutes.use('*', async (c, next) => {
  if (!sandboxEnabled || !isDemoChannel(c.get('channel'))) {
    return c.json({ error: 'the sandbox is off outside the sample channel' }, 403);
  }
  await next();
});

sandboxRoutes.get('/', async (c) => {
  const channel = c.get('channel');
  const [videos, next] = await Promise.all([
    repo.listVideos(channel.id, 12),
    repo.nextCheckpoint(channel.id),
  ]);
  const video = next?.experiment.videoId ? await repo.getVideoById(next.experiment.videoId) : undefined;

  return c.json({
    mind: sandbox().mind,
    live: sandbox().liveSince !== null,
    videos: videos.map((row) => ({ ytVideoId: row.ytVideoId, title: row.title })),
    next: next
      ? {
          kind: next.kind,
          dueAt: next.dueAt,
          videoTitle: video?.title ?? null,
          hypothesis: next.experiment.hypothesis,
        }
      : null,
  });
});

sandboxRoutes.post('/state', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const mind = MIND_STATES.find((state) => state === body?.mind);
  const live = typeof body?.live === 'boolean' ? body.live : null;

  const next = patchSandbox({
    ...(mind ? { mind } : {}),
    // flipping a switch that is already on must not restart the stream's clock
    ...(live !== null && live !== (sandbox().liveSince !== null)
      ? { liveSince: live ? Date.now() : null }
      : {}),
  });

  return c.json({ mind: next.mind, live: next.liveSince !== null });
});

const FLAVOURS = {
  superfan: [
    'Been here since the pegboard video and this is the best one yet.',
    'You called this two years ago and everyone in the comments told you no.',
    'Third rewatch. The measuring section is worth the whole video.',
    'I have sent this to four people who kept asking me the same question.',
    'Still the only channel that shows the version that failed.',
  ],
  question: [
    'What is the part number for the bracket at 6:40?',
    'Does this hold up on a hollow-core door desk or is that asking too much?',
    'Which of the two would you buy again knowing what you know now?',
    'Any chance of the spreadsheet in the description?',
    'What torque did you settle on in the end?',
  ],
  criticism: [
    'The first two minutes are you explaining what you are about to do. Just do it.',
    'Thumbnail promised a teardown and there was no teardown.',
    'Music is louder than your voice again this week.',
    'You skipped the part everyone came for and showed the easy bit twice.',
    'This is the fourth video mentioning it in passing. Review it or drop it.',
  ],
} as const;

type Flavour = keyof typeof FLAVOURS;
const FLAVOUR_ORDER: Flavour[] = ['question', 'criticism', 'superfan'];

const INJECTED_NAMES = [
  'shelfhelp', 'Nadia', 'torqueoff', 'Kwame', 'benchvice', 'Linh', 'undermount',
  'Marta', 'clampclub', 'Owen', 'dowelpin', 'Saoirse',
];

const HOUR_MS = 3_600_000;

/**
 * A surge of comments, carrying the tiers the audience screens actually compute. A superfan
 * is not a label on a row — it is five comments across three weeks — so producing one means
 * writing the history that earns it rather than asserting it.
 */
sandboxRoutes.post('/comments', async (c) => {
  const channel = c.get('channel');
  const body = await c.req.json().catch(() => ({}));
  const asked = FLAVOUR_ORDER.find((flavour) => flavour === body?.flavour);
  const count = Math.min(Math.max(Math.round(Number(body?.count) || 5), 1), 20);

  const catalogue = await repo.listVideos(channel.id, 40);
  const target = body?.ytVideoId
    ? catalogue.find((video) => video.ytVideoId === body.ytVideoId)
    : catalogue[0];
  if (!target) return c.json({ error: 'no video to comment on' }, 404);

  // the backdated half has to land on videos that are genuinely old, or a viewer ends up
  // commenting before the video they commented on existed
  const older = catalogue.slice(-Math.min(SUPERFAN_COMMENTS - 1, catalogue.length));
  const stamp = Date.now();
  const batch: Parameters<typeof repo.upsertComments>[1] = [];

  for (let index = 0; index < count; index += 1) {
    const flavour = asked ?? FLAVOUR_ORDER[index % FLAVOUR_ORDER.length]!;
    const texts = FLAVOURS[flavour];
    const person = {
      ytAuthorId: `sandbox-${stamp}-${index}`,
      displayName: INJECTED_NAMES[(stamp + index) % INJECTED_NAMES.length]!,
    };

    if (flavour === 'superfan') {
      for (const [seat, video] of older.entries()) {
        batch.push({
          ...person,
          ytCommentId: `sandbox-${stamp}-${index}-${seat}`,
          videoId: video.id,
          text: texts[(index + seat) % texts.length]!,
          likeCount: 3 + seat,
          publishedAt: new Date(video.publishedAt.getTime() + 6 * HOUR_MS),
        });
      }
    }

    batch.push({
      ...person,
      ytCommentId: `sandbox-${stamp}-${index}-now`,
      videoId: target.id,
      text: texts[index % texts.length]!,
      likeCount: index % 7,
      publishedAt: new Date(),
    });
  }

  await repo.upsertComments(channel.id, batch);
  return c.json({ added: batch.length, people: count, videoTitle: target.title });
});

const RECIPE: Record<ProposalKind, { summary: string; lever: string; options: string[] }> = {
  title: {
    summary: 'Lead the title with the price, not the build',
    lever: 'the title',
    options: ['I built this for 40 quid', 'The 40-quid version of a 400-quid desk', 'Under 50, and it holds'],
  },
  thumbnail: {
    summary: 'Reshoot the thumbnail with one face and four words',
    lever: 'the thumbnail',
    options: ['Face left, part held up right', 'Before and after, no text', 'One word: HOLDS'],
  },
  hook: {
    summary: 'Open on the finished build and cut the setup',
    lever: 'the first thirty seconds',
    options: ['Open on the finished desk', 'Open on the failure at 8:10', 'Open on the price tag'],
  },
  community: {
    summary: 'Push it again with a Community post while it is still being distributed',
    lever: 'distribution',
    options: ['Community poll on the two brackets', 'Pinned comment with the part list', 'End screen on an older video'],
  },
  reply: {
    summary: 'Answer the three questions holding up the comment thread',
    lever: 'replies',
    options: ['Answer the part-number question first', 'Answer the loudest critic first'],
  },
  experiment: {
    summary: 'Commit to one thumbnail concept and grade it at 24h',
    lever: 'thumbnail',
    options: ['Face left, part held up right', 'Before and after, no text'],
  },
};

/** A proposal built from the figures typed into the sandbox, so the Inbox can be driven on demand. */
sandboxRoutes.post('/proposals', async (c) => {
  const channel = c.get('channel');
  const body = await c.req.json().catch(() => ({}));
  const kind = PROPOSAL_KINDS.find((option) => option === body?.kind) ?? 'thumbnail';
  const recipe = RECIPE[kind];

  const catalogue = await repo.listVideos(channel.id, 40);
  const video = body?.ytVideoId
    ? catalogue.find((row) => row.ytVideoId === body.ytVideoId)
    : catalogue[0];

  const predicted = clampPct(body?.predictedCtr, 8.2);
  const observed = clampPct(body?.observedCtr, 5.1);
  const under = Math.round(((predicted - observed) / predicted) * 100);
  const typed = typeof body?.summary === 'string' ? body.summary.trim() : '';

  const proposal = await repo.createProposal({
    channelId: channel.id,
    videoId: video?.id ?? null,
    kind,
    summary: typed || recipe.summary,
    detail:
      `Click-through is ${observed}% against the ${predicted}% this run was graded on, ` +
      `${under}% under. The impressions are being served, so ${recipe.lever} is what is losing ` +
      `them, and it is still worth changing while the video is being pushed.`,
    // the creator has to be able to tell a reading from a fixture, and the row itself is the
    // only place that survives a screen recording
    rationale: `Built in the sandbox from the figures entered there, not from a reading of ${video?.title ?? 'this channel'}.`,
    options: recipe.options,
    payload:
      kind === 'experiment'
        ? {
            lever: recipe.lever,
            ytVideoId: video?.ytVideoId ?? null,
            concepts: recipe.options.map((label, seat) => ({
              label,
              hypothesis: `${label} lifts click-through above the ${predicted}% this run was graded on.`,
              prediction: { ctrPct: Number((predicted + seat * 0.4).toFixed(2)) },
            })),
          }
        : null,
    sandbox: true,
  });

  return c.json({ id: proposal.id, kind, summary: proposal.summary, videoTitle: video?.title ?? null });
});

function clampPct(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Number(Math.min(parsed, 100).toFixed(2));
}

/**
 * Back to a state worth presenting: every decision made during the run is undone and
 * everything the sandbox added is gone. It does not rebuild the channel — `npm run seed:demo`
 * does that — so the seeded history, checkpoints and learnings are left where they are.
 */
sandboxRoutes.post('/reset', async (c) => {
  const { id } = c.get('channel');

  const counts = await sql.begin(async (tx) => {
    const experiments = await tx`delete from experiments where channel_id = ${id} and sandbox returning id`;
    const proposals = await tx`delete from proposals where channel_id = ${id} and sandbox returning id`;
    const viewers = await tx`
      delete from viewers where channel_id = ${id} and yt_author_id like 'sandbox-%' returning id`;
    const restored = await tx`
      update proposals set status = 'pending', decided_at = null, decided_choice = null
      where channel_id = ${id} and status <> 'pending' returning id`;

    return {
      experiments: experiments.length,
      proposals: proposals.length,
      viewers: viewers.length,
      restored: restored.length,
    };
  });

  clearSandbox();
  return c.json(counts);
});
