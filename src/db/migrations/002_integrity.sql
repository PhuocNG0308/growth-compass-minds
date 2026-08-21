-- Indexes that queries in repo.ts already depend on, constraints that keep the columns
-- meaning what the code assumes they mean, and fixes for two upserts that never matched.

-- comments.viewer_id is a cascading foreign key joined by commentsForVideo, triageCandidates,
-- replyQueue, commentOwner and viewerComments, and was seq-scanned every time.
create index if not exists comments_viewer on comments (viewer_id);

-- pendingCheckpoints and the overdue tally filter on observed_at; the existing partial index
-- covers fired_at, which is a different question.
create index if not exists checkpoints_unobserved on checkpoints (observed_at)
  where observed_at is null;

-- replyQueue asks for comments nobody has answered yet.
create index if not exists comments_unanswered on comments (video_id, published_at desc)
  where replied_at is null;

-- viewersBySegment and segmentCounts walk one channel's viewers ordered by activity.
create index if not exists viewers_activity on viewers (channel_id, comment_count desc);

-- both are `on delete set null`, so deleting a video seq-scanned these tables.
create index if not exists experiments_video on experiments (video_id);
create index if not exists proposals_video on proposals (video_id);

-- mentionables runs three unanchored LIKE '%q%' scans on every keystroke of @-autocomplete.
create extension if not exists pg_trgm;
create index if not exists viewers_name_trgm on viewers using gin (lower(display_name) gin_trgm_ops);
create index if not exists videos_title_trgm on videos using gin (lower(title) gin_trgm_ops);
create index if not exists experiments_hypothesis_trgm
  on experiments using gin (lower(hypothesis) gin_trgm_ops);

-- upsertRetention declared `on conflict (video_id, captured_at)`, but captured_at defaults to
-- now(), so the target could never match and every sync appended another curve for ever.
-- One curve per video per day is what the product actually wants.
delete from retention_curves rc
  using retention_curves keep
  where rc.video_id = keep.video_id
    and (rc.captured_at at time zone 'UTC')::date = (keep.captured_at at time zone 'UTC')::date
    and rc.captured_at < keep.captured_at;

-- a stored column rather than an index expression: casting timestamptz to date depends on
-- the session TimeZone and so is not immutable, and a plain column is a conflict target
-- anyone can read
alter table retention_curves add column if not exists captured_on date
  generated always as ((captured_at at time zone 'UTC')::date) stored;

create unique index if not exists retention_curves_daily
  on retention_curves (video_id, captured_on);

-- chat_threads.alias is globally unique but was built from a per-channel key, so the same
-- YouTube author commenting on two connected channels collided with an unhandled 23505.
update chat_threads
set alias = 'viewer-' || channel_id::text || '-' || subject_id
where subject_kind = 'viewer' and alias = 'viewer-' || subject_id;

-- Two syncs seconds apart used to write two readings at the same age, which puts two points
-- on top of each other on a trajectory chart.
delete from snapshots s
  using snapshots keep
  where s.video_id = keep.video_id
    and s.age_hours = keep.age_hours
    and s.id < keep.id;

create unique index if not exists snapshots_video_age on snapshots (video_id, age_hours);

-- Discriminator columns were plain text with no domain. Zod guards the HTTP edge, but
-- repo.setTriage takes any string and nothing stopped a typo from being stored for ever.
alter table experiments drop constraint if exists experiments_status_check;
alter table experiments add constraint experiments_status_check
  check (status in ('open', 'measuring', 'closed', 'abandoned'));

alter table experiments drop constraint if exists experiments_verdict_check;
alter table experiments add constraint experiments_verdict_check
  check (verdict is null or verdict in ('confirmed', 'refuted', 'inconclusive'));

alter table checkpoints drop constraint if exists checkpoints_kind_check;
alter table checkpoints add constraint checkpoints_kind_check
  check (kind in ('t24', 't72', 't7d', 't28d'));

alter table comments drop constraint if exists comments_triage_check;
alter table comments add constraint comments_triage_check
  check (triage is null or triage in ('superfan', 'question', 'criticism', 'noise', 'answered'));

alter table proposals drop constraint if exists proposals_kind_check;
alter table proposals add constraint proposals_kind_check
  check (kind in ('title', 'thumbnail', 'hook', 'reply', 'experiment', 'community'));

alter table proposals drop constraint if exists proposals_status_check;
alter table proposals add constraint proposals_status_check
  check (status in ('pending', 'approved', 'dismissed'));

alter table chat_threads drop constraint if exists chat_threads_subject_kind_check;
alter table chat_threads add constraint chat_threads_subject_kind_check
  check (subject_kind in ('video', 'viewer', 'segment', 'channel'));

alter table chat_messages drop constraint if exists chat_messages_role_check;
alter table chat_messages add constraint chat_messages_role_check
  check (role in ('creator', 'mind'));

-- Counters are read as loyalty signals; a negative one would silently mis-segment a viewer.
alter table viewers drop constraint if exists viewers_comment_count_check;
alter table viewers add constraint viewers_comment_count_check check (comment_count >= 0);

-- When a sync cannot refresh a channel's data we need to say so rather than let a stale
-- snapshot pass for a fresh reading.
alter table channels add column if not exists last_sync_at timestamptz;
alter table channels add column if not exists last_sync_error text;
