/** Exercise every query in the repo against the real database. */

import { sql } from '../src/db/client.ts';
import * as repo from '../src/db/repo.ts';
import { SEGMENT_THRESHOLDS } from '../src/memory/segments.ts';
import * as chat from '../src/db/chat.ts';
import { buildContext } from '../src/memory/context.ts';
import { encrypt } from '../src/crypto.ts';

const results: Array<[string, string]> = [];

async function step(name: string, run: () => Promise<unknown>) {
  try {
    const value = await run();
    const shape = Array.isArray(value)
      ? `${value.length} rows`
      : value && typeof value === 'object'
        ? Object.keys(value).slice(0, 4).join(',')
        : String(value);
    results.push(['ok  ', `${name} → ${shape}`]);
    return value;
  } catch (error) {
    results.push(['FAIL', `${name} → ${(error as Error).message.split('\n')[0]}`]);
    return undefined;
  }
}

const tables = await sql<Array<{ table_name: string }>>`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name`;
console.log('tables:', tables.map((t) => t.table_name).join(', '));

const indexes = await sql<Array<{ count: string }>>`
  select count(*) from pg_indexes where schemaname = 'public'`;
console.log('indexes:', indexes[0]!.count, '\n');

const channel = (await step('upsertChannel', () =>
  repo.upsertChannel({ ytChannelId: 'UC_TEST', title: 'Test Channel', refreshToken: encrypt('fake') }),
)) as Awaited<ReturnType<typeof repo.upsertChannel>>;

const videos = (await step('upsertVideos', () =>
  repo.upsertVideos(channel.id, [
    {
      ytVideoId: 'vid_test',
      title: 'A test video',
      thumbnailUrl: null,
      durationS: 600,
      publishedAt: new Date(Date.now() - 86_400_000),
    },
  ]),
)) as Awaited<ReturnType<typeof repo.upsertVideos>>;

const video = videos[0]!;

await step('insertSnapshot', () =>
  repo.insertSnapshot({
    videoId: video.id,
    ageHours: 24,
    views: 1000,
    likes: 50,
    comments: 3,
    impressions: 20000,
    ctr: 5,
    avgViewDurationS: 240,
    avgViewPct: 40,
    subscribersGained: 12,
  }),
);

await step('latestSnapshots', () => repo.latestSnapshots([video.id]));
await step('latestSnapshot', () => repo.latestSnapshot(video.id));
await step('snapshotHistory', () => repo.snapshotHistory(video.id));
await step('upsertRetention', () =>
  repo.upsertRetention(video.id, [
    { ratio: 0, watchRatio: 1, relative: 1 },
    { ratio: 1, watchRatio: 0.3, relative: 0.8 },
  ]),
);
await step('latestRetention', () => repo.latestRetention(video.id));

await step('upsertComments', () =>
  repo.upsertComments(channel.id, [
    {
      ytAuthorId: 'a_test',
      displayName: 'Tester',
      ytCommentId: 'c_test',
      videoId: video.id,
      text: 'Where did you get the arm?',
      likeCount: 7,
      publishedAt: new Date(),
    },
  ]),
);

await step('commentsForVideo', () => repo.commentsForVideo(video.id));
await step('commentCounts', () => repo.commentCounts(channel.id));
await step('triageCandidates', () => repo.triageCandidates(channel.id));
await step('setTriage', () => repo.setTriage('c_test', 'question'));
await step('segmentCounts', () => repo.segmentCounts(channel.id, SEGMENT_THRESHOLDS));
await step('viewersBySegment', () => repo.viewersBySegment(channel.id, SEGMENT_THRESHOLDS, 'superfan'));
await step('viewersBySegment/all', () => repo.viewersBySegment(channel.id, SEGMENT_THRESHOLDS, null));
await step('replyQueue', () => repo.replyQueue(channel.id));
await step('commentOwner', () => repo.commentOwner(channel.id, 'c_test'));
await step('getViewer', () => repo.getViewer(channel.id, 'a_test'));

const viewer = await repo.getViewer(channel.id, 'a_test');
await step('viewerComments', () => repo.viewerComments(viewer!.id));
await step('mentionables', () => repo.mentionables(channel.id, ''));
await step('segmentCensus', () => repo.segmentCensus(channel.id));

const experiment = (await step('createExperiment', () =>
  repo.createExperiment({
    channelId: channel.id,
    videoId: video.id,
    lever: 'thumbnail',
    hypothesis: 'A face beats a product shot on this channel.',
    prediction: { ctrPct: 6 },
  }),
)) as Awaited<ReturnType<typeof repo.createExperiment>>;

await step('createCheckpoints', () =>
  repo.createCheckpoints(experiment.id, [{ kind: 't24', dueAt: new Date(Date.now() - 3600_000) }]),
);
await step('dueCheckpoints', () => repo.dueCheckpoints());
await step('pendingCheckpoints', () => repo.pendingCheckpoints(channel.id));
await step('listExperiments', () => repo.listExperiments(channel.id));
await step('attachVideo', () => repo.attachVideo(experiment.id, video.id));

const due = await repo.dueCheckpoints();
if (due[0]) {
  await step('recordObservation', () => repo.recordObservation(due[0]!.id, { summary: 'under call' }));
  await step('markFired', () => repo.markFired(due[0]!.id));
}

await step('closeExperiment', () => repo.closeExperiment(experiment.id, { ctrPct: 4.1 }, 'refuted'));
await step('upsertLearning', () =>
  repo.upsertLearning({
    channelId: channel.id,
    statement: 'Faces beat product shots on this channel.',
    lever: 'thumbnail',
    experimentId: experiment.id,
  }),
);
await step('listLearnings', () => repo.listLearnings(channel.id));

const learnings = await repo.listLearnings(channel.id);
await step('markPromoted', () => repo.markPromoted(learnings[0]!.id));

await step('createProposal', () =>
  repo.createProposal({
    channelId: channel.id,
    videoId: video.id,
    kind: 'title',
    summary: 'Retitle with the price',
    detail: 'I rebuilt my desk for £180',
    rationale: 'Price in title has lifted CTR twice here.',
    options: ['a', 'b'],
  }),
);
await step('listProposals', () => repo.listProposals(channel.id, 'pending'));

const proposals = await repo.listProposals(channel.id, 'pending');
await step('decideProposal', () => repo.decideProposal(proposals[0]!.id, 'approved', 'a'));
await step('counts', () => repo.counts(channel.id));
await step('recentActivity', () => repo.recentActivity(channel.id));
await step('buildContext', () => buildContext(channel));

const thread = (await step('chat.ensureThread', () =>
  chat.ensureThread({
    channelId: channel.id,
    subjectKind: 'video',
    subjectId: video.ytVideoId,
    alias: 'post-vid_test',
    title: video.title,
  }),
)) as Awaited<ReturnType<typeof chat.ensureThread>>;

await step('chat.appendMessage', () =>
  chat.appendMessage(thread.id, 'creator', 'Who is watching this?', [
    { kind: 'viewer', refId: 'a_test' },
  ]),
);
await step('chat.threadMessages', () => chat.threadMessages(thread.id));
await step('chat.findThread', () => chat.findThread(channel.id, 'video', video.ytVideoId));
await step('chat.recentThreads', () => chat.recentThreads(channel.id));
await step('chat.threadsMentioning', () => chat.threadsMentioning(channel.id, 'viewer', 'a_test'));
await step('chat.searchChat (text)', () => chat.searchChat(channel.id, { text: 'watching' }));
await step('chat.searchChat (ref)', () =>
  chat.searchChat(channel.id, { refs: [{ kind: 'viewer', refId: 'a_test' }] }),
);
await step('chat.searchChat (both)', () =>
  chat.searchChat(channel.id, { text: 'watching', refs: [{ kind: 'viewer', refId: 'a_test' }] }),
);
await step('markReplied', () => repo.markReplied('c_test', 'It is the Jarvis arm.', 'reply_1'));
await step('listChannels', () => repo.listChannels());
await step('getChannel', () => repo.getChannel(channel.ytChannelId));
await step('setReportingJob', () => repo.setReportingJob(channel.id, 'job_1'));
await step('setReachSyncedThrough', () => repo.setReachSyncedThrough(channel.id, '2026-08-17'));
await step('recordSync (ok)', () => repo.recordSync(channel.id, null));
await step('recordSync (failed)', () => repo.recordSync(channel.id, 'google token 401'));

// The queries above only prove the SQL parses. These prove the schema still carries the
// guarantees the code reads as given: the indexes those queries need, the domains the
// discriminator columns are supposed to have, and the two read models.
for (const index of [
  'comments_viewer',
  'checkpoints_unobserved',
  'comments_unanswered',
  'viewers_activity',
  'experiments_video',
  'proposals_video',
  'viewers_name_trgm',
  'retention_curves_daily',
  'snapshots_video_age',
]) {
  await step(`index ${index}`, async () => {
    const [row] = await sql`select 1 from pg_indexes where schemaname = 'public' and indexname = ${index}`;
    if (!row) throw new Error('missing');
    return 'present';
  });
}

await step('check rejects a bad triage', async () => {
  try {
    await sql`update comments set triage = 'not-a-triage' where yt_comment_id = 'c_test'`;
  } catch {
    return 'rejected';
  }
  throw new Error('a bogus triage was accepted');
});

await step('check rejects a bad verdict', async () => {
  try {
    await sql`update experiments set verdict = 'maybe' where channel_id = ${channel.id}`;
  } catch {
    return 'rejected';
  }
  throw new Error('a bogus verdict was accepted');
});

await step('unique blocks a duplicate snapshot age', async () => {
  const [video] = await sql<Array<{ id: string }>>`
    select id from videos where channel_id = ${channel.id} limit 1`;
  if (!video) return 'no video to test with';
  const row = { videoId: video.id, ageHours: 999, views: 1 };
  await sql`insert into snapshots ${sql(row)} on conflict do nothing`;
  try {
    await sql`insert into snapshots ${sql(row)}`;
  } catch {
    return 'rejected';
  }
  throw new Error('a duplicate (video_id, age_hours) was accepted');
});

await step('createProposal with an experiment payload', async () => {
  const proposal = await repo.createProposal({
    channelId: channel.id,
    videoId: null,
    kind: 'experiment',
    summary: 'Test the cold open',
    detail: 'Lead with the finished build.',
    rationale: 'Retention drops nine points in the first twenty seconds.',
    options: ['Cold open'],
    payload: {
      lever: 'hook',
      ytVideoId: null,
      concepts: [
        { label: 'Cold open', hypothesis: 'Result first holds the opening.', prediction: { ctrPct: 6.1 } },
      ],
    },
  });
  const decided = await repo.decideProposal(proposal.id, 'approved', 'Cold open');
  if (decided?.payload?.concepts[0]?.prediction.ctrPct !== 6.1) {
    throw new Error('the committed number did not survive the round trip');
  }
  return 'payload round-trips';
});

await step('view experiment_scores', () => sql`
  select id, predicted_ctr, actual_ctr, ctr_delta from experiment_scores
  where channel_id = ${channel.id}`);

await step('view growth_timeline', () => sql`
  select at, kind, automated, title from growth_timeline
  where channel_id = ${channel.id} order by at desc limit 10`);

for (const [status, line] of results) console.log(status, line);

const failed = results.filter(([status]) => status === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} queries passed`);

await sql`delete from channels where yt_channel_id = 'UC_TEST'`;
await sql.end();
process.exit(failed ? 1 : 0);
