-- Two read models. The predict-then-grade loop and the memory trail are the product's
-- core claims, and neither could be queried: both live inside jsonb blobs or are scattered
-- across five tables.

-- The Mind is free in how it spells a metric, and postgres.camel rewrites jsonb keys on the
-- way out but not on the way in, so both spellings can exist in the same column.
create or replace function jsonb_num(doc jsonb, variadic keys text[])
returns numeric language sql immutable as $$
  select (doc ->> key)::numeric
  from unnest(keys) as key
  where jsonb_typeof(doc -> key) = 'number'
  limit 1
$$;

-- Predicted versus actual, as columns. Without this you cannot ask the one question the
-- whole ledger exists to answer: is the Mind getting better at this channel?
create or replace view experiment_scores as
select
  e.id,
  e.channel_id,
  e.video_id,
  e.lever,
  e.hypothesis,
  e.status,
  e.verdict,
  e.opened_at,
  e.closed_at,
  jsonb_num(e.prediction, 'ctrPct', 'ctr_pct', 'ctr') as predicted_ctr,
  jsonb_num(e.outcome, 'ctrPct', 'ctr_pct', 'ctr') as actual_ctr,
  jsonb_num(e.prediction, 'avgViewPct', 'avg_view_pct') as predicted_avp,
  jsonb_num(e.outcome, 'avgViewPct', 'avg_view_pct') as actual_avp,
  jsonb_num(e.outcome, 'ctrPct', 'ctr_pct', 'ctr')
    - jsonb_num(e.prediction, 'ctrPct', 'ctr_pct', 'ctr') as ctr_delta,
  jsonb_num(e.outcome, 'avgViewPct', 'avg_view_pct')
    - jsonb_num(e.prediction, 'avgViewPct', 'avg_view_pct') as avp_delta
from experiments e;

-- One trail of everything that happened to this channel's memory, in order. `automated`
-- marks the rows nobody asked for — the evidence that the agent works unattended.
create or replace view growth_timeline as
select e.channel_id,
       e.opened_at as at,
       'experiment_opened' as kind,
       false as automated,
       e.id::text as ref_id,
       e.hypothesis as title,
       e.prediction::text as detail
from experiments e

union all
select e.channel_id, e.closed_at, 'experiment_closed', false, e.id::text, e.hypothesis,
       coalesce(e.verdict, 'unresolved')
from experiments e
where e.closed_at is not null

union all
select ex.channel_id, c.fired_at, 'checkpoint_fired', true, c.id::text,
       ex.hypothesis, c.kind
from checkpoints c join experiments ex on ex.id = c.experiment_id
where c.fired_at is not null

union all
select ex.channel_id, c.observed_at, 'checkpoint_observed', true, c.id::text,
       ex.hypothesis, c.observation ->> 'summary'
from checkpoints c join experiments ex on ex.id = c.experiment_id
where c.observed_at is not null

union all
select l.channel_id, l.promoted_to_tenet_at, 'tenet_written', false, l.id::text,
       l.statement, l.evidence_count::text
from learnings l
where l.promoted_to_tenet_at is not null

union all
select p.channel_id, p.decided_at, 'proposal_decided', false, p.id::text,
       p.summary, p.status
from proposals p
where p.decided_at is not null

union all
select t.channel_id, m.created_at, 'chat_' || m.role, false, t.id::text,
       t.title, left(m.body, 400)
from chat_messages m join chat_threads t on t.id = m.thread_id;
