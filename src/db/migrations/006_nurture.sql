-- A segment is derived from comment_count and tenure, so the moment a viewer crosses into a
-- higher tier leaves no trace: nothing is written, and a runner cannot tell "already told the
-- Mind about this one" from "never looked". These two columns are that trace. Seeding is left
-- to the runner rather than done here, so the ladder stays defined in one place.
alter table viewers add column if not exists nurtured_segment text;
alter table viewers add column if not exists nurtured_at timestamptz;

alter table viewers drop constraint if exists viewers_nurtured_segment_check;
alter table viewers add constraint viewers_nurtured_segment_check
  check (nurtured_segment is null or nurtured_segment in ('superfan', 'potential', 'newcomer'));

create index if not exists viewers_nurtured on viewers (channel_id, nurtured_segment);

-- A proposal about a person had nowhere to point: video_id is the only target, and a reply
-- the Mind drafts for one viewer would arrive as text with no way to open who it is about.
alter table proposals add column if not exists viewer_id uuid references viewers(id) on delete set null;

-- growth_timeline gains a branch, and a view cannot be extended in place.
drop view if exists growth_timeline;

create view growth_timeline as
select s.channel_id,
       s.opened_at as at,
       'experiment_opened' as kind,
       false as automated,
       s.id::text as ref_id,
       s.hypothesis as title,
       jsonb_build_object(
         'lever', s.lever,
         'predictedCtr', s.predicted_ctr,
         'predictedAvp', s.predicted_avp
       ) as detail
from experiment_scores s

union all
select s.channel_id, s.closed_at, 'experiment_closed', false, s.id::text, s.hypothesis,
       jsonb_build_object(
         'verdict', coalesce(s.verdict, 'unresolved'),
         'predictedCtr', s.predicted_ctr,
         'actualCtr', s.actual_ctr,
         'ctrDelta', s.ctr_delta
       )
from experiment_scores s
where s.closed_at is not null

union all
select ex.channel_id, c.fired_at, 'checkpoint_fired', true, c.id::text, ex.hypothesis,
       jsonb_build_object('checkpoint', c.kind)
from checkpoints c join experiments ex on ex.id = c.experiment_id
where c.fired_at is not null

union all
select ex.channel_id, c.observed_at, 'checkpoint_observed', true, c.id::text, ex.hypothesis,
       jsonb_build_object('checkpoint', c.kind, 'summary', c.observation ->> 'summary')
from checkpoints c join experiments ex on ex.id = c.experiment_id
where c.observed_at is not null

union all
select l.channel_id, l.promoted_to_tenet_at, 'tenet_written', false, l.id::text, l.statement,
       jsonb_build_object(
         'evidenceCount', l.evidence_count,
         'contradictionCount', l.contradiction_count,
         'backing', coalesce((
           select jsonb_agg(e.hypothesis order by e.opened_at)
           from experiments e
           where e.id = any (l.supporting_experiments)
         ), '[]'::jsonb)
       )
from learnings l
where l.promoted_to_tenet_at is not null

union all
select p.channel_id, p.decided_at, 'proposal_decided', false, p.id::text, p.summary,
       jsonb_build_object('status', p.status, 'kind', p.kind, 'choice', p.decided_choice)
from proposals p
where p.decided_at is not null

union all
select w.channel_id, w.nurtured_at, 'viewer_crossed', true, w.yt_author_id, w.display_name,
       jsonb_build_object('segment', w.nurtured_segment, 'commentCount', w.comment_count)
from viewers w
where w.nurtured_at is not null

union all
select t.channel_id, m.created_at, 'chat_' || m.role, false, t.id::text, t.title,
       jsonb_build_object('excerpt', left(m.body, 400), 'subjectKind', t.subject_kind,
                          'subjectId', t.subject_id)
from chat_messages m join chat_threads t on t.id = m.thread_id;
