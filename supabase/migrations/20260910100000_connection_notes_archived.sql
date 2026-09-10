-- Per-user "archive" flag for a connection. The Connections tab reads/writes
-- connection_notes (keyed by match_id + user_id) for private notes already;
-- archive state is the same per-user, per-connection shape, so it lives here
-- rather than in a new table. Archived connections drop out of the active list
-- into the "Archived" filter; fully reversible via Unarchive.

alter table public.connection_notes
  add column if not exists archived boolean not null default false;

comment on column public.connection_notes.archived is
  'Per-user archive flag for a connection (Connections tab). Reversible.';
