-- Self-serve room creation for organizer-flagged accounts.
--
-- Distinct from the owner's password-gated OrganizerAdmin flow (admin-auth
-- create-event, service-role, bypasses RLS). This path is real per-user auth:
-- a profile with is_organizer = true inserts straight into public.events and
-- RLS does the rest.

-- ---------------------------------------------------------------------------
-- 1. Organizer flag on profiles. Manually granted only — no signup flow.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_organizer boolean not null default false;

comment on column public.profiles.is_organizer is
  'Manually granted (SQL / Supabase Studio only). Gates self-serve room creation. '
  'No self-serve path to true — see trigger block_self_service_organizer_grant.';

-- ---------------------------------------------------------------------------
-- 2. Stop end users from granting themselves organizer status. The
--    "Users can update own profile" policy lets a user write any column of
--    their own row, so without this guard a user could just set
--    is_organizer = true. Admin grants run with no JWT (SQL editor / Studio /
--    service role), where auth.uid() is null, and are allowed through.
-- ---------------------------------------------------------------------------
create or replace function public.block_self_service_organizer_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and coalesce(new.is_organizer, false) then
      raise exception 'is_organizer can only be set by an administrator';
    end if;
    return new;
  end if;

  if auth.uid() is not null and new.is_organizer is distinct from old.is_organizer then
    raise exception 'is_organizer can only be changed by an administrator';
  end if;
  return new;
end;
$$;

drop trigger if exists block_self_service_organizer_grant on public.profiles;
create trigger block_self_service_organizer_grant
  before insert or update on public.profiles
  for each row execute function public.block_self_service_organizer_grant();

-- ---------------------------------------------------------------------------
-- 3. SECURITY DEFINER organizer check, so the events policy does not depend on
--    profiles' own (self-only) RLS.
-- ---------------------------------------------------------------------------
create or replace function public.is_organizer(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_organizer from public.profiles p where p.id = uid), false);
$$;

-- Supabase's default privileges grant EXECUTE on new functions to
-- anon/authenticated/service_role directly, so revoke explicitly rather than
-- just from PUBLIC. authenticated keeps it — the events policy below calls
-- is_organizer() while running as that role.
revoke all on function public.is_organizer(uuid) from public, anon;
grant execute on function public.is_organizer(uuid) to authenticated, service_role;

-- The guard is a trigger function; nothing should call it over the REST RPC.
revoke all on function public.block_self_service_organizer_grant() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Fix the events RLS.
--
--    "Authenticated can insert events" (from the 2026-06 base schema) let ANY
--    signed-in user create an event with ANY organizer_id. It predates every
--    security-lockdown migration and no client path uses it — the owner's
--    create-event goes through the service role. Drop it.
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated can insert events" on public.events;

--    Rebuild "Organizers can manage events": the old one was FOR ALL with only
--    a USING clause (no explicit WITH CHECK — the same gap the lockdown fixed
--    on profiles) and no organizer gate. Now it requires the caller's profile
--    to be is_organizer AND the row to be owned by the caller, for both the
--    visible (USING) and written (WITH CHECK) row.
drop policy if exists "Organizers can manage events" on public.events;

create policy "Organizers can manage events"
  on public.events
  for all
  to authenticated
  using (organizer_id = (select auth.uid()) and public.is_organizer())
  with check (organizer_id = (select auth.uid()) and public.is_organizer());

--    "Anyone can view published events" is unchanged and still correct:
--    USING (is_published = true OR organizer_id = auth.uid()) — published rooms
--    are world-readable, and any owner (organizer-flagged or not) can read
--    their own drafts. No conflict with the manage policy (permissive, OR-ed).
