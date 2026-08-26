import { sql } from './client.ts';
import { DEMO_YT_CHANNEL_ID } from '../demo.ts';
import type {
  Channel,
  ExperimentPayload,
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

/** Whether the last attempt reached YouTube, so nothing downstream passes stale for fresh. */
export async function recordSync(channelId: string, error: string | null): Promise<void> {
  await sql`
    update channels
    set last_sync_error = ${error},
        last_sync_at = case when ${error}::text is null then now() else last_sync_at end
    where id = ${channelId}`;
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

/** snapshots_video_age allows one row per video per hour, so a re-sync corrects it in place. */
export async function insertSnapshot(row: Omit<Snapshot, 'id' | 'capturedAt'>): Promise<void> {
  await sql`
    insert into snapshots ${sql(row)}
    on conflict (video_id, age_hours) do update
      set captured_at = now(), views = excluded.views, likes = excluded.likes,
          comments = excluded.comments, impressions = excluded.impressions, ctr = excluded.ctr,
          avg_view_duration_s = excluded.avg_view_duration_s,
          avg_view_pct = excluded.avg_view_pct,
          subscribers_gained = excluded.subscribers_gained`;
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

/**
 * The view curve for many videos in one round trip. Fetching this per card would be thirty
 * queries to draw thirty sparklines.
 */
export async function viewTrajectories(videoIds: string[]): Promise<Map<string, number[]>> {
  if (videoIds.length === 0) return new Map();
  const rows = await sql<Array<{ videoId: string; views: number | null }>>`
    select video_id, views from snapshots
    where video_id = any(${videoIds}::uuid[]) and views is not null
    order by video_id, age_hours`;

  const byVideo = new Map<string, number[]>();
  for (const row of rows) {
    byVideo.set(row.videoId, [...(byVideo.get(row.videoId) ?? []), row.views!]);
  }
  return byVideo;
}

export async function upsertRetention(videoId: string, points: RetentionPoint[]): Promise<void> {
  await sql`
    insert into retention_curves (video_id, points) values (${videoId}, ${sql.json(points)})
    on conflict (video_id, captured_on) do update set points = excluded.points`;
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
    from checkpoints c
      join experiments e on e.id = c.experiment_id
      join channels ch on ch.id = e.channel_id
    where c.fired_at is null and c.due_at <= ${now} and e.status <> 'abandoned'
      -- the sample channel holds no Google credentials, so driving it would hit Google with
      -- a fake token and, worse, teach the Mind about a channel that does not exist
      and ch.yt_channel_id <> ${DEMO_YT_CHANNEL_ID}
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

  // Postgres refuses to touch the same row twice in one statement, so both sets have to be
  // unique before they reach the multi-row upsert.
  const people = new Map<string, { displayName: string; firstSeen: Date; lastSeen: Date }>();
  for (const item of items) {
    const seen = people.get(item.ytAuthorId);
    people.set(item.ytAuthorId, {
      displayName: item.displayName,
      firstSeen: seen && seen.firstSeen < item.publishedAt ? seen.firstSeen : item.publishedAt,
      lastSeen: seen && seen.lastSeen > item.publishedAt ? seen.lastSeen : item.publishedAt,
    });
  }

  const fresh = new Map(items.map((item) => [item.ytCommentId, item]));

  await sql.begin(async (tx) => {
    const viewers = await tx<Array<{ id: string; ytAuthorId: string }>>`
      insert into viewers ${tx(
        [...people].map(([ytAuthorId, person]) => ({
          channelId,
          ytAuthorId,
          displayName: person.displayName,
          commentCount: 0,
          firstSeenAt: person.firstSeen,
          lastSeenAt: person.lastSeen,
        })),
      )}
      on conflict (channel_id, yt_author_id) do update
        set display_name = excluded.display_name,
            first_seen_at = least(viewers.first_seen_at, excluded.first_seen_at),
            last_seen_at = greatest(viewers.last_seen_at, excluded.last_seen_at)
      returning id, yt_author_id`;

    const viewerIds = new Map(viewers.map((row) => [row.ytAuthorId, row.id]));

    // every sync re-fetches the same comments, so the counter may only move for rows that
    // were genuinely new — otherwise a newcomer inflates into a superfan
    await tx`
      with added as (
        insert into comments ${tx(
          [...fresh.values()].map((item) => ({
            videoId: item.videoId,
            viewerId: viewerIds.get(item.ytAuthorId)!,
            ytCommentId: item.ytCommentId,
            text: item.text,
            likeCount: item.likeCount,
            publishedAt: item.publishedAt,
          })),
        )}
        on conflict (yt_comment_id) do nothing
        returning viewer_id
      ),
      tally as (select viewer_id, count(*) as added from added group by viewer_id)
      update viewers set comment_count = viewers.comment_count + tally.added
      from tally where viewers.id = tally.viewer_id`;
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

export type SegmentThresholds = {
  superfanComments: number;
  potentialComments: number;
  superfanTenureDays: number;
};

/**
 * The same ladder `segmentOf` walks, expressed in SQL so a channel with 90k commenters can
 * be counted and paged without loading every viewer into memory. Thresholds are passed in
 * rather than repeated here, so the definition still lives in one place.
 */
const segmentCase = (t: SegmentThresholds) => sql`
  case
    when comment_count >= ${t.superfanComments}
      and first_seen_at <= now() - make_interval(days => ${t.superfanTenureDays}) then 'superfan'
    when comment_count >= ${t.potentialComments} then 'potential'
    else 'newcomer'
  end`;

export async function segmentCounts(
  channelId: string,
  thresholds: SegmentThresholds,
): Promise<Record<string, number>> {
  const rows = await sql<Array<{ segment: string; total: number }>>`
    select ${segmentCase(thresholds)} as segment, count(*)::int as total
    from viewers where channel_id = ${channelId}
    group by 1`;
  return Object.fromEntries(rows.map((row) => [row.segment, row.total]));
}

export async function viewersBySegment(
  channelId: string,
  thresholds: SegmentThresholds,
  segment: string | null,
  limit = 40,
): Promise<Superfan[]> {
  return sql<Superfan[]>`
    select yt_author_id, display_name, comment_count, first_seen_at, last_seen_at,
           extract(day from last_seen_at - first_seen_at)::int as tenure_days
    from viewers
    where channel_id = ${channelId}
      and ${segment ? sql`${segmentCase(thresholds)} = ${segment}` : sql`true`}
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

export type TimelineEvent = {
  at: Date;
  kind: string;
  automated: boolean;
  refId: string;
  title: string;
  detail: Record<string, Json>;
};

export async function timeline(
  channelId: string,
  opts: { limit?: number; before?: Date; automatedOnly?: boolean } = {},
): Promise<TimelineEvent[]> {
  return sql<TimelineEvent[]>`
    select at, kind, automated, ref_id, title, detail from growth_timeline
    where channel_id = ${channelId}
      ${opts.before ? sql`and at < ${opts.before}` : sql``}
      ${opts.automatedOnly ? sql`and automated` : sql``}
    order by at desc
    limit ${Math.min(Math.max(opts.limit ?? 60, 1), 200)}`;
}

export type ScoredExperiment = {
  id: string;
  lever: string;
  hypothesis: string;
  verdict: string | null;
  closedAt: Date;
  predictedCtr: number | null;
  actualCtr: number | null;
  ctrDelta: number | null;
};

export async function experimentScores(channelId: string): Promise<ScoredExperiment[]> {
  return sql<ScoredExperiment[]>`
    select id, lever, hypothesis, verdict, closed_at, predicted_ctr, actual_ctr, ctr_delta
    from experiment_scores
    where channel_id = ${channelId} and closed_at is not null and ctr_delta is not null
    order by closed_at`;
}

export type Accuracy = {
  graded: number;
  meanAbsCtrError: number | null;
  meanAbsAvpError: number | null;
  recentAbsCtrError: number | null;
  earlierAbsCtrError: number | null;
};

/**
 * Recent versus earlier is the only number that answers "is it getting better at my
 * channel?", which is the whole claim. Split at the halfway point of what has been graded.
 */
export async function accuracy(channelId: string): Promise<Accuracy> {
  const [row] = await sql<Accuracy[]>`
    with graded as (
      select abs(ctr_delta) as ctr_error, abs(avp_delta) as avp_error,
             row_number() over (order by closed_at desc) as recency,
             count(*) over () as total
      from experiment_scores
      where channel_id = ${channelId} and actual_ctr is not null and closed_at is not null
    )
    select count(*)::int as graded,
           avg(ctr_error) as mean_abs_ctr_error,
           avg(avp_error) as mean_abs_avp_error,
           avg(ctr_error) filter (where recency <= total / 2.0) as recent_abs_ctr_error,
           avg(ctr_error) filter (where recency > total / 2.0) as earlier_abs_ctr_error
    from graded`;
  return row!;
}

export async function memoryTotals(
  channelId: string,
): Promise<{ sessions: number; automated: number; tenets: number }> {
  const [row] = await sql<Array<{ sessions: number; automated: number; tenets: number }>>`
    select
      (select count(*)::int from chat_threads where channel_id = ${channelId}) as sessions,
      (select count(*)::int from growth_timeline
        where channel_id = ${channelId} and automated) as automated,
      (select count(*)::int from learnings
        where channel_id = ${channelId} and promoted_to_tenet_at is not null) as tenets`;
  return row!;
}

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
  payload?: ExperimentPayload | null;
}): Promise<Proposal> {
  const [row] = await sql<Proposal[]>`
    insert into proposals (channel_id, video_id, kind, summary, detail, rationale, options, payload)
    values (${input.channelId}, ${input.videoId}, ${input.kind}, ${input.summary},
            ${input.detail}, ${input.rationale}, ${sql.json(input.options)},
            ${input.payload ? sql.json(input.payload) : null})
    returning *`;
  return row!;
}

export type ProposalRow = Proposal & {
  videoTitle: string | null;
  thumbnailUrl: string | null;
  videoPublishedAt: Date | null;
};

export async function listProposals(channelId: string, status?: string): Promise<ProposalRow[]> {
  return sql<ProposalRow[]>`
    select p.*, v.title as video_title, v.thumbnail_url, v.published_at as video_published_at
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
  repliedAt: Date | null;
  replyText: string | null;
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
           c.replied_at, c.reply_text,
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

export type ReplyTarget = PostComment & { videoTitle: string; ytVideoId: string; thumbnailUrl: string | null };

/**
 * The reply queue, ranked the way a creator would triage it: the people who keep coming
 * back first, then the ones the audience upvoted, then everything else by recency.
 */
export async function replyQueue(channelId: string, limit = 40): Promise<ReplyTarget[]> {
  return sql<ReplyTarget[]>`
    select c.yt_comment_id, c.text, c.like_count, c.published_at, c.triage,
           c.replied_at, c.reply_text,
           w.yt_author_id, w.display_name, w.comment_count as viewer_comment_count,
           w.first_seen_at as viewer_first_seen_at,
           v.title as video_title, v.yt_video_id, v.thumbnail_url
    from comments c
      join viewers w on w.id = c.viewer_id
      join videos v on v.id = c.video_id
    where v.channel_id = ${channelId} and c.replied_at is null
    order by w.comment_count desc, c.like_count desc, c.published_at desc
    limit ${limit}`;
}

export async function markReplied(
  ytCommentId: string,
  text: string,
  replyYtId: string | null,
): Promise<void> {
  await sql`
    update comments
    set replied_at = now(), reply_text = ${text}, reply_yt_id = ${replyYtId}
    where yt_comment_id = ${ytCommentId}`;
}

export async function commentOwner(
  channelId: string,
  ytCommentId: string,
): Promise<{ displayName: string; text: string; videoTitle: string } | undefined> {
  const [row] = await sql<Array<{ displayName: string; text: string; videoTitle: string }>>`
    select w.display_name, c.text, v.title as video_title
    from comments c join viewers w on w.id = c.viewer_id join videos v on v.id = c.video_id
    where c.yt_comment_id = ${ytCommentId} and v.channel_id = ${channelId}`;
  return row;
}
