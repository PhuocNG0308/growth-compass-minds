import { sql } from './client.ts';
import type {
  Channel,
  Checkpoint,
  CheckpointKind,
  Experiment,
  Json,
  Learning,
  Prediction,
  Proposal,
  ProposalKind,
  RetentionPoint,
  Snapshot,
  Video,
} from '../types.ts';

export async function upsertChannel(input: {
  ytChannelId: string;
  title: string;
  refreshToken: string;
}): Promise<Channel> {
  const [row] = await sql<Channel[]>`
    insert into channels ${sql(input)}
    on conflict (yt_channel_id) do update
      set title = excluded.title, refresh_token = excluded.refresh_token
    returning *`;
  return row!;
}

export async function listChannels(): Promise<Channel[]> {
  return sql<Channel[]>`select * from channels order by created_at`;
}

export async function getChannel(id: string): Promise<Channel | undefined> {
  const [row] = await sql<Channel[]>`
    select * from channels where id::text = ${id} or yt_channel_id = ${id}`;
  return row;
}

export async function setReportingJob(channelId: string, jobId: string): Promise<void> {
  await sql`update channels set reporting_job_id = ${jobId} where id = ${channelId}`;
}

export async function setReachSyncedThrough(channelId: string, date: string): Promise<void> {
  await sql`update channels set reach_synced_through = ${date} where id = ${channelId}`;
}

export async function upsertVideos(
  channelId: string,
  videos: Array<Omit<Video, 'id' | 'channelId' | 'syncedAt'>>,
): Promise<Video[]> {
  if (videos.length === 0) return [];
  const rows = videos.map((v) => ({ ...v, channelId, syncedAt: new Date() }));
  return sql<Video[]>`
    insert into videos ${sql(rows)}
    on conflict (yt_video_id) do update
      set title = excluded.title,
          thumbnail_url = excluded.thumbnail_url,
          duration_s = excluded.duration_s,
          synced_at = excluded.synced_at
    returning *`;
}

export async function listVideos(channelId: string, limit = 25): Promise<Video[]> {
  return sql<Video[]>`
    select * from videos where channel_id = ${channelId}
    order by published_at desc limit ${limit}`;
}

export async function getVideo(ytVideoId: string): Promise<Video | undefined> {
  const [row] = await sql<Video[]>`select * from videos where yt_video_id = ${ytVideoId}`;
  return row;
}

export async function getVideoById(id: string): Promise<Video | undefined> {
  const [row] = await sql<Video[]>`select * from videos where id = ${id}`;
  return row;
}

export async function insertSnapshot(row: Omit<Snapshot, 'id' | 'capturedAt'>): Promise<void> {
  await sql`insert into snapshots ${sql(row)}`;
}

export async function latestSnapshots(videoIds: string[]): Promise<Snapshot[]> {
  if (videoIds.length === 0) return [];
  return sql<Snapshot[]>`
    select distinct on (video_id) * from snapshots
    where video_id = any(${videoIds}::uuid[])
    order by video_id, captured_at desc`;
}

export async function latestSnapshot(videoId: string): Promise<Snapshot | undefined> {
  const [row] = await sql<Snapshot[]>`
    select * from snapshots where video_id = ${videoId}
    order by captured_at desc limit 1`;
  return row;
}

export async function snapshotHistory(videoId: string, limit = 20): Promise<Snapshot[]> {
  return sql<Snapshot[]>`
    select * from snapshots where video_id = ${videoId}
    order by captured_at desc limit ${limit}`;
}

export async function upsertRetention(videoId: string, points: RetentionPoint[]): Promise<void> {
  await sql`
    insert into retention_curves (video_id, points) values (${videoId}, ${sql.json(points)})
    on conflict (video_id, captured_at) do update set points = excluded.points`;
}

export async function latestRetention(videoId: string): Promise<RetentionPoint[] | null> {
  const [row] = await sql<Array<{ points: RetentionPoint[] }>>`
    select points from retention_curves where video_id = ${videoId}
    order by captured_at desc limit 1`;
  return row?.points ?? null;
}

export async function createExperiment(input: {
  channelId: string;
  videoId: string | null;
  lever: string;
  hypothesis: string;
  prediction: Prediction;
}): Promise<Experiment> {
  const [row] = await sql<Experiment[]>`
    insert into experiments (channel_id, video_id, lever, hypothesis, prediction)
    values (${input.channelId}, ${input.videoId}, ${input.lever}, ${input.hypothesis},
            ${sql.json(input.prediction)})
    returning *`;
  return row!;
}

export async function listExperiments(channelId: string, status?: string): Promise<Experiment[]> {
  return sql<Experiment[]>`
    select * from experiments
    where channel_id = ${channelId} ${status ? sql`and status = ${status}` : sql``}
    order by opened_at desc`;
}

export async function getExperiment(id: string): Promise<Experiment | undefined> {
  const [row] = await sql<Experiment[]>`select * from experiments where id = ${id}`;
  return row;
}

export async function attachVideo(experimentId: string, videoId: string): Promise<void> {
  await sql`
    update experiments set video_id = ${videoId}, status = 'measuring' where id = ${experimentId}`;
}

export async function closeExperiment(
  id: string,
  outcome: Record<string, Json>,
  verdict: NonNullable<Experiment['verdict']>,
): Promise<Experiment | undefined> {
  const [row] = await sql<Experiment[]>`
    update experiments
    set status = 'closed', outcome = ${sql.json(outcome)}, verdict = ${verdict}, closed_at = now()
    where id = ${id} returning *`;
  return row;
}

export async function createCheckpoints(
  experimentId: string,
  schedule: Array<{ kind: CheckpointKind; dueAt: Date }>,
): Promise<Checkpoint[]> {
  const rows = schedule.map((s) => ({ experimentId, kind: s.kind, dueAt: s.dueAt }));
  return sql<Checkpoint[]>`
    insert into checkpoints ${sql(rows)}
    on conflict (experiment_id, kind) do update set due_at = excluded.due_at
    returning *`;
}

export type DueCheckpoint = Checkpoint & { experiment: Experiment; channelId: string };

export async function dueCheckpoints(now = new Date()): Promise<DueCheckpoint[]> {
  return sql<DueCheckpoint[]>`
    select c.*, e.channel_id, to_jsonb(e.*) as experiment
    from checkpoints c join experiments e on e.id = c.experiment_id
    where c.fired_at is null and c.due_at <= ${now} and e.status <> 'abandoned'
    order by c.due_at`;
}

export async function markFired(id: string): Promise<void> {
  await sql`update checkpoints set fired_at = now() where id = ${id}`;
}

export async function recordObservation(
  id: string,
  observation: Record<string, Json>,
): Promise<Checkpoint | undefined> {
  const [row] = await sql<Checkpoint[]>`
    update checkpoints
    set observation = ${sql.json(observation)}, observed_at = now(),
        fired_at = coalesce(fired_at, now())
    where id = ${id} returning *`;
  return row;
}

export async function pendingCheckpoints(channelId: string): Promise<Checkpoint[]> {
  return sql<Checkpoint[]>`
    select c.* from checkpoints c join experiments e on e.id = c.experiment_id
    where e.channel_id = ${channelId} and c.observed_at is null
    order by c.due_at`;
}

export async function upsertLearning(input: {
  channelId: string;
  statement: string;
  lever: string | null;
  experimentId: string | null;
  contradicted?: boolean;
}): Promise<Learning> {
  const support = input.experimentId ? [input.experimentId] : [];
  const evidence = input.contradicted ? 0 : 1;
  const contradiction = input.contradicted ? 1 : 0;
  const [row] = await sql<Learning[]>`
    insert into learnings (channel_id, statement, lever, supporting_experiments, contradiction_count)
    values (${input.channelId}, ${input.statement}, ${input.lever}, ${support}::uuid[], ${contradiction})
    on conflict (channel_id, statement) do update
      set evidence_count = learnings.evidence_count + ${evidence},
          contradiction_count = learnings.contradiction_count + ${contradiction},
          supporting_experiments = array(
            select distinct unnest(learnings.supporting_experiments || excluded.supporting_experiments)),
          updated_at = now()
    returning *`;
  return row!;
}

export async function listLearnings(channelId: string): Promise<Learning[]> {
  return sql<Learning[]>`
    select * from learnings where channel_id = ${channelId}
    order by evidence_count desc, updated_at desc`;
}

export async function markPromoted(id: string): Promise<Learning | undefined> {
  const [row] = await sql<Learning[]>`
    update learnings set promoted_to_tenet_at = now() where id = ${id} returning *`;
  return row;
}

export async function upsertComments(
  channelId: string,
  items: Array<{
    ytAuthorId: string;
    displayName: string;
    ytCommentId: string;
    videoId: string;
    text: string;
    likeCount: number;
    publishedAt: Date;
  }>,
): Promise<void> {
  if (items.length === 0) return;
  await sql.begin(async (tx) => {
    for (const item of items) {
      const [viewer] = await tx<Array<{ id: string }>>`
        insert into viewers (channel_id, yt_author_id, display_name, comment_count, last_seen_at)
        values (${channelId}, ${item.ytAuthorId}, ${item.displayName}, 1, ${item.publishedAt})
        on conflict (channel_id, yt_author_id) do update
          set comment_count = viewers.comment_count + 1,
              display_name = excluded.display_name,
              last_seen_at = greatest(viewers.last_seen_at, excluded.last_seen_at)
        returning id`;
      await tx`
        insert into comments (video_id, viewer_id, yt_comment_id, text, like_count, published_at)
        values (${item.videoId}, ${viewer!.id}, ${item.ytCommentId}, ${item.text},
                ${item.likeCount}, ${item.publishedAt})
        on conflict (yt_comment_id) do nothing`;
    }
  });
}

export type TriageCandidate = {
  ytCommentId: string;
  ytAuthorId: string;
  text: string;
  likeCount: number;
  publishedAt: Date;
  videoTitle: string;
  displayName: string;
  viewerCommentCount: number;
  viewerFirstSeenAt: Date;
};

export async function triageCandidates(channelId: string, limit = 40): Promise<TriageCandidate[]> {
  return sql<TriageCandidate[]>`
    select c.yt_comment_id, c.text, c.like_count, c.published_at,
           v.title as video_title,
           w.yt_author_id, w.display_name, w.comment_count as viewer_comment_count,
           w.first_seen_at as viewer_first_seen_at
    from comments c
      join videos v on v.id = c.video_id
      join viewers w on w.id = c.viewer_id
    where v.channel_id = ${channelId} and c.triage is null
    order by w.comment_count desc, c.like_count desc, c.published_at desc
    limit ${limit}`;
}

export async function setTriage(ytCommentId: string, triage: string): Promise<void> {
  await sql`update comments set triage = ${triage} where yt_comment_id = ${ytCommentId}`;
}

export type Superfan = {
  ytAuthorId: string;
  displayName: string;
  commentCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  tenureDays: number;
};

export async function superfans(channelId: string, limit = 20): Promise<Superfan[]> {
  return sql<Superfan[]>`
    select yt_author_id, display_name, comment_count, first_seen_at, last_seen_at,
           extract(day from last_seen_at - first_seen_at)::int as tenure_days
    from viewers
    where channel_id = ${channelId} and comment_count > 1
    order by comment_count desc, tenure_days desc
    limit ${limit}`;
}

export type Activity = {
  checkpointId: string;
  kind: CheckpointKind;
  dueAt: Date;
  firedAt: Date;
  observedAt: Date | null;
  observation: Record<string, Json> | null;
  lever: string;
  hypothesis: string;
  verdict: Experiment['verdict'];
  videoTitle: string | null;
  ytVideoId: string | null;
};

export async function recentActivity(channelId: string, limit = 25): Promise<Activity[]> {
  return sql<Activity[]>`
    select c.id as checkpoint_id, c.kind, c.due_at, c.fired_at, c.observed_at, c.observation,
           e.lever, e.hypothesis, e.verdict,
           v.title as video_title, v.yt_video_id
    from checkpoints c
      join experiments e on e.id = c.experiment_id
      left join videos v on v.id = e.video_id
    where e.channel_id = ${channelId} and c.fired_at is not null
    order by c.fired_at desc
    limit ${limit}`;
}

export async function counts(channelId: string): Promise<{
  videos: number;
  running: number;
  settled: number;
  overdue: number;
  tenets: number;
  waiting: number;
}> {
  const [row] = await sql<
    Array<{
      videos: string;
      running: string;
      settled: string;
      overdue: string;
      tenets: string;
      waiting: string;
    }>
  >`
    select
      (select count(*) from videos where channel_id = ${channelId}) as videos,
      (select count(*) from experiments
        where channel_id = ${channelId} and status in ('open', 'measuring')) as running,
      (select count(*) from experiments
        where channel_id = ${channelId} and status = 'closed') as settled,
      (select count(*) from checkpoints c join experiments e on e.id = c.experiment_id
        where e.channel_id = ${channelId} and c.observed_at is null and c.due_at <= now()) as overdue,
      (select count(*) from learnings
        where channel_id = ${channelId} and promoted_to_tenet_at is not null) as tenets,
      (select count(*) from proposals
        where channel_id = ${channelId} and status = 'pending') as waiting`;

  return {
    videos: Number(row!.videos),
    running: Number(row!.running),
    settled: Number(row!.settled),
    overdue: Number(row!.overdue),
    tenets: Number(row!.tenets),
    waiting: Number(row!.waiting),
  };
}

export async function createProposal(input: {
  channelId: string;
  videoId: string | null;
  kind: ProposalKind;
  summary: string;
  detail: string;
  rationale: string;
  options: string[];
}): Promise<Proposal> {
  const [row] = await sql<Proposal[]>`
    insert into proposals (channel_id, video_id, kind, summary, detail, rationale, options)
    values (${input.channelId}, ${input.videoId}, ${input.kind}, ${input.summary},
            ${input.detail}, ${input.rationale}, ${sql.json(input.options)})
    returning *`;
  return row!;
}

export type ProposalRow = Proposal & { videoTitle: string | null; thumbnailUrl: string | null };

export async function listProposals(channelId: string, status?: string): Promise<ProposalRow[]> {
  return sql<ProposalRow[]>`
    select p.*, v.title as video_title, v.thumbnail_url
    from proposals p left join videos v on v.id = p.video_id
    where p.channel_id = ${channelId} ${status ? sql`and p.status = ${status}` : sql``}
    order by p.created_at desc
    limit 40`;
}

export async function decideProposal(
  id: string,
  status: 'approved' | 'dismissed',
  choice: string | null,
): Promise<Proposal | undefined> {
  const [row] = await sql<Proposal[]>`
    update proposals
    set status = ${status}, decided_choice = ${choice}, decided_at = now()
    where id = ${id} and status = 'pending'
    returning *`;
  return row;
}

export type PostComment = {
  ytCommentId: string;
  ytAuthorId: string;
  text: string;
  likeCount: number;
  publishedAt: Date;
  triage: string | null;
  displayName: string;
  viewerCommentCount: number;
  viewerFirstSeenAt: Date;
};

export async function commentsForVideo(videoId: string, limit = 200): Promise<PostComment[]> {
  return sql<PostComment[]>`
    select c.yt_comment_id, c.text, c.like_count, c.published_at, c.triage,
           w.yt_author_id, w.display_name, w.comment_count as viewer_comment_count,
           w.first_seen_at as viewer_first_seen_at
    from comments c join viewers w on w.id = c.viewer_id
    where c.video_id = ${videoId}
    order by w.comment_count desc, c.like_count desc, c.published_at desc
    limit ${limit}`;
}

export async function commentCounts(channelId: string): Promise<Map<string, number>> {
  const rows = await sql<Array<{ videoId: string; total: string }>>`
    select c.video_id, count(*) as total
    from comments c join videos v on v.id = c.video_id
    where v.channel_id = ${channelId}
    group by c.video_id`;
  return new Map(rows.map((row) => [row.videoId, Number(row.total)]));
}

export type Viewer = {
  id: string;
  channelId: string;
  ytAuthorId: string;
  displayName: string;
  commentCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

export async function getViewer(channelId: string, ytAuthorId: string): Promise<Viewer | undefined> {
  const [row] = await sql<Viewer[]>`
    select * from viewers where channel_id = ${channelId} and yt_author_id = ${ytAuthorId}`;
  return row;
}

export type ViewerComment = {
  ytCommentId: string;
  text: string;
  likeCount: number;
  publishedAt: Date;
  triage: string | null;
  ytVideoId: string;
  videoTitle: string;
  thumbnailUrl: string | null;
};

export async function viewerComments(viewerId: string, limit = 100): Promise<ViewerComment[]> {
  return sql<ViewerComment[]>`
    select c.yt_comment_id, c.text, c.like_count, c.published_at, c.triage,
           v.yt_video_id, v.title as video_title, v.thumbnail_url
    from comments c join videos v on v.id = c.video_id
    where c.viewer_id = ${viewerId}
    order by c.published_at desc
    limit ${limit}`;
}

export type MentionRow = { kind: string; id: string; label: string; detail: string };

/** Everything the creator can pull into a question, in one ranked list. */
export async function mentionables(channelId: string, query: string): Promise<MentionRow[]> {
  const like = `%${query.toLowerCase()}%`;

  const [people, clips, trials] = await Promise.all([
    sql<MentionRow[]>`
      select 'viewer' as kind, yt_author_id as id, display_name as label,
             comment_count || ' comments' as detail
      from viewers
      where channel_id = ${channelId} and lower(display_name) like ${like}
      order by comment_count desc limit 8`,
    sql<MentionRow[]>`
      select 'video' as kind, yt_video_id as id, title as label,
             to_char(published_at, 'DD Mon YYYY') as detail
      from videos
      where channel_id = ${channelId} and lower(title) like ${like}
      order by published_at desc limit 6`,
    sql<MentionRow[]>`
      select 'experiment' as kind, id::text as id, hypothesis as label,
             coalesce(verdict, status) as detail
      from experiments
      where channel_id = ${channelId} and lower(hypothesis) like ${like}
      order by opened_at desc limit 5`,
  ]);

  return [...people, ...clips, ...trials];
}

export async function segmentCensus(channelId: string): Promise<
  Array<{ displayName: string; commentCount: number; firstSeenAt: Date; ytAuthorId: string }>
> {
  return sql`
    select display_name, comment_count, first_seen_at, yt_author_id
    from viewers where channel_id = ${channelId}
    order by comment_count desc limit 200`;
}
