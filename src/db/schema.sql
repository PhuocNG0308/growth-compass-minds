create extension if not exists pgcrypto;

create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  yt_channel_id text unique not null,
  title text not null,
  refresh_token text not null,
  reporting_job_id text,
  reach_synced_through date,
  created_at timestamptz not null default now()
);

create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  yt_video_id text unique not null,
  title text not null,
  thumbnail_url text,
  duration_s int,
  published_at timestamptz not null,
  synced_at timestamptz
);
create index if not exists videos_channel_published on videos (channel_id, published_at desc);

create table if not exists snapshots (
  id bigserial primary key,
  video_id uuid not null references videos(id) on delete cascade,
  captured_at timestamptz not null default now(),
  age_hours int not null,
  views bigint,
  likes int,
  comments int,
  impressions bigint,
  ctr numeric(7,4),
  avg_view_duration_s int,
  avg_view_pct numeric(5,2),
  subscribers_gained int
);
create index if not exists snapshots_video_time on snapshots (video_id, captured_at desc);

create table if not exists retention_curves (
  video_id uuid not null references videos(id) on delete cascade,
  captured_at timestamptz not null default now(),
  points jsonb not null,
  primary key (video_id, captured_at)
);

create table if not exists experiments (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  video_id uuid references videos(id) on delete set null,
  lever text not null,
  hypothesis text not null,
  prediction jsonb not null,
  status text not null default 'open',
  outcome jsonb,
  verdict text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists experiments_channel_status on experiments (channel_id, status);

create table if not exists checkpoints (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references experiments(id) on delete cascade,
  kind text not null,
  due_at timestamptz not null,
  fired_at timestamptz,
  observed_at timestamptz,
  observation jsonb,
  unique (experiment_id, kind)
);
create index if not exists checkpoints_pending on checkpoints (due_at) where fired_at is null;

create table if not exists learnings (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  statement text not null,
  lever text,
  evidence_count int not null default 1,
  contradiction_count int not null default 0,
  supporting_experiments uuid[] not null default '{}',
  promoted_to_tenet_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, statement)
);

create table if not exists viewers (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  yt_author_id text not null,
  display_name text not null,
  comment_count int not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (channel_id, yt_author_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  viewer_id uuid not null references viewers(id) on delete cascade,
  yt_comment_id text unique not null,
  text text not null,
  like_count int not null default 0,
  published_at timestamptz not null,
  triage text
);
create index if not exists comments_video_time on comments (video_id, published_at desc);

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  video_id uuid references videos(id) on delete set null,
  kind text not null,
  summary text not null,
  detail text not null,
  rationale text not null,
  options jsonb not null default '[]',
  status text not null default 'pending',
  decided_at timestamptz,
  decided_choice text,
  created_at timestamptz not null default now()
);
create index if not exists proposals_channel_status on proposals (channel_id, status, created_at desc);

-- conversations are scoped to a subject the way a Discord channel is scoped to a topic,
-- and every @-mention is indexed so past analysis can be recalled by tag
create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  subject_kind text not null,
  subject_id text not null,
  alias text not null unique,
  title text not null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (channel_id, subject_kind, subject_id)
);
create index if not exists chat_threads_recent on chat_threads (channel_id, last_message_at desc);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  role text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread on chat_messages (thread_id, created_at);
create index if not exists chat_messages_search on chat_messages using gin (to_tsvector('simple', body));

create table if not exists chat_refs (
  message_id uuid not null references chat_messages(id) on delete cascade,
  kind text not null,
  ref_id text not null,
  primary key (message_id, kind, ref_id)
);
create index if not exists chat_refs_lookup on chat_refs (kind, ref_id);
