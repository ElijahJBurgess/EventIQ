-- Phase 1: the actual accept/decline action on top of Phase 0's
-- connection_status column, plus notifications for it. Mirrors the existing
-- request_meeting/respond_to_meeting SECURITY DEFINER pattern exactly:
-- clients never write connection_status directly (matches has no UPDATE RLS
-- policy for authenticated, same as meetings), only this narrow RPC can.

CREATE OR REPLACE FUNCTION public.respond_to_connection(p_match_id uuid, p_response text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  acting_user uuid := auth.uid();
  match_row public.matches%ROWTYPE;
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Invalid connection response' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO match_row
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND OR acting_user NOT IN (match_row.user_a_id, match_row.user_b_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  -- Only the recipient of the pending request may respond -- the requester
  -- cannot accept/decline their own request.
  IF match_row.connection_status <> 'pending' OR acting_user = match_row.connection_requested_by THEN
    RAISE EXCEPTION 'Invalid connection transition' USING ERRCODE = '22023';
  END IF;

  UPDATE public.matches
  SET connection_status = p_response,
      connection_status_updated_at = now()
  WHERE id = p_match_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_connection(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_connection(uuid, text) TO authenticated;

-- Notifications for the two new outcomes, following the same shape as the
-- meeting-response notifications added in 20260820020000.

ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'connection_request',
    'connection_accepted',
    'connection_declined',
    'new_message',
    'meeting_requested',
    'meeting_accepted',
    'meeting_scheduled',
    'meeting_declined'
  ));

ALTER TABLE public.notifications DROP CONSTRAINT notifications_source_matches_type;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_source_matches_type
  CHECK (
    (
      type IN ('connection_request', 'new_message')
      AND message_id IS NOT NULL
      AND meeting_id IS NULL
    )
    OR
    (
      type IN ('meeting_requested', 'meeting_accepted', 'meeting_scheduled', 'meeting_declined')
      AND meeting_id IS NOT NULL
      AND message_id IS NULL
    )
    OR
    (
      type IN ('connection_accepted', 'connection_declined')
      AND match_id IS NOT NULL
      AND meeting_id IS NULL
      AND message_id IS NULL
    )
  );

CREATE UNIQUE INDEX notifications_one_per_connection_response
  ON public.notifications (match_id, type)
  WHERE type IN ('connection_accepted', 'connection_declined');

CREATE OR REPLACE FUNCTION public.create_notification_for_connection_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  acting_user uuid := auth.uid();
  notification_type text;
BEGIN
  IF acting_user IS NULL
     OR OLD.connection_status IS NOT DISTINCT FROM NEW.connection_status
     OR OLD.connection_status <> 'pending'
     OR NEW.connection_status NOT IN ('accepted', 'declined')
     OR acting_user = NEW.connection_requested_by
     OR NEW.connection_requested_by IS NULL THEN
    RETURN NEW;
  END IF;

  notification_type := CASE
    WHEN NEW.connection_status = 'accepted' THEN 'connection_accepted'
    ELSE 'connection_declined'
  END;

  INSERT INTO public.notifications (
    user_id,
    actor_id,
    type,
    match_id,
    event_id
  ) VALUES (
    NEW.connection_requested_by,
    acting_user,
    notification_type,
    NEW.id,
    NEW.event_id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification_for_connection_status_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER matches_create_connection_status_notification
  AFTER UPDATE OF connection_status ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_for_connection_status_change();
