-- A proposal carries `options` as plain strings, which is enough for a title or a hook but
-- not for an experiment: the whole point of the loop is that each concept arrives with a
-- number committed to it before anything is published. `payload` holds the structured part
-- the string list cannot.
alter table proposals add column if not exists payload jsonb;
