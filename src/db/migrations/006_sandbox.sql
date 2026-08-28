-- Rows the demo sandbox created. Marked rather than inferred from timestamps, so resetting
-- the demo is a delete with an exact predicate instead of a guess about what was seeded.
alter table proposals add column if not exists sandbox boolean not null default false;
alter table experiments add column if not exists sandbox boolean not null default false;
