-- Applied to the remote project via the Supabase MCP on 2026-09-08.
--
-- home_company_colleagues(p_event_id): names of the OTHER checked-in attendees
-- at an event whose company matches the caller's own (case-insensitive,
-- trimmed). Returns nothing when the caller's company is blank. Powers the Home
-- "Your company is in the room" banner.
--
-- SECURITY DEFINER so it can read registrations beyond the caller's own row
-- (event_registrations SELECT is self-only under RLS), but it only ever returns
-- people who already share the caller's exact company string.

create or replace function public.home_company_colleagues(p_event_id uuid)
returns table (profile_id uuid, full_name text, company text)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select nullif(lower(btrim(company)), '') as company_key
    from public.profiles
    where id = auth.uid()
  )
  select p.id, p.full_name, p.company
  from public.event_registrations r
  join public.profiles p on p.id = r.profile_id
  cross join me
  where r.event_id = p_event_id
    and r.is_checked_in = true
    and p.id <> auth.uid()
    and me.company_key is not null
    and lower(btrim(p.company)) = me.company_key
    and coalesce(btrim(p.full_name), '') <> ''
  order by p.full_name;
$$;

revoke all on function public.home_company_colleagues(uuid) from public, anon;
grant execute on function public.home_company_colleagues(uuid) to authenticated;
