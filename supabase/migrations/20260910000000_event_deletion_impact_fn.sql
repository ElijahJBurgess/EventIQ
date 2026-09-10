-- Impact counts for the self-serve organizer's "delete event" confirmation.
--
-- OrganizerRooms.tsx must show the organizer exactly how many matches, messages
-- and meetings a delete will cascade away. The per-row RLS on those tables only
-- exposes rows the caller participates in, so an organizer (not a participant)
-- would count zero from a direct query. This SECURITY DEFINER function returns
-- the true totals, but only to the event's own organizer.

create or replace function public.event_deletion_impact(p_event_id uuid)
returns table (match_count bigint, message_count bigint, meeting_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.organizer_id = auth.uid()
      and public.is_organizer()
  ) then
    raise exception 'not authorized to inspect this event'
      using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.matches  m   where m.event_id   = p_event_id),
    (select count(*) from public.messages msg  where msg.event_id = p_event_id),
    (select count(*) from public.meetings mt   where mt.event_id  = p_event_id);
end;
$$;

revoke all on function public.event_deletion_impact(uuid) from public, anon;
grant execute on function public.event_deletion_impact(uuid) to authenticated;

comment on function public.event_deletion_impact(uuid) is
  'match/message/meeting counts tied to an event, for the self-serve organizer '
  'delete confirmation. Authorized to the event''s organizer only; SECURITY '
  'DEFINER to bypass per-participant RLS on those tables.';
