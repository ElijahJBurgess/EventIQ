-- Minimal, durable V1 notification feed. Notification rows are created only
-- by the trusted trigger functions below; clients can read their own rows and
-- mark one owned row read through the narrow RPC at the end of this migration.

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'connection_request',
    'new_message',
    'meeting_requested',
    'meeting_accepted',
    'meeting_scheduled',
    'meeting_declined'
  )),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone,
  CONSTRAINT notifications_actor_differs_from_owner CHECK (actor_id <> user_id),
  CONSTRAINT notifications_source_matches_type CHECK (
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
  )
);

CREATE UNIQUE INDEX notifications_one_per_message
  ON public.notifications (message_id)
  WHERE message_id IS NOT NULL;

CREATE UNIQUE INDEX notifications_one_per_meeting_type
  ON public.notifications (meeting_id, type)
  WHERE meeting_id IS NOT NULL;

CREATE INDEX notifications_owner_created_at
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX notifications_owner_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.create_notification_for_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  notification_type text;
BEGIN
  -- The messages INSERT policy already requires the authenticated sender and
  -- a real match participant. Recheck identity here so trusted notification
  -- ownership never comes from a forged row or a self-message.
  IF auth.uid() IS NULL
     OR auth.uid() <> NEW.sender_id
     OR NEW.recipient_id IS NULL
     OR NEW.sender_id IS NULL
     OR NEW.recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  notification_type := CASE
    WHEN NEW.message_type = 'connect_request' THEN 'connection_request'
    ELSE 'new_message'
  END;

  INSERT INTO public.notifications (
    user_id,
    actor_id,
    type,
    match_id,
    event_id,
    message_id
  ) VALUES (
    NEW.recipient_id,
    NEW.sender_id,
    notification_type,
    NEW.match_id,
    NEW.event_id,
    NEW.id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification_for_message() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER messages_create_notification
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_for_message();

CREATE OR REPLACE FUNCTION public.create_notification_for_meeting_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status <> 'requested'
     OR auth.uid() IS NULL
     OR auth.uid() <> NEW.requester_id
     OR NEW.requester_id = NEW.recipient_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    actor_id,
    type,
    match_id,
    event_id,
    meeting_id
  ) VALUES (
    NEW.recipient_id,
    NEW.requester_id,
    'meeting_requested',
    NEW.match_id,
    NEW.event_id,
    NEW.id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification_for_meeting_request() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER meetings_create_request_notification
  AFTER INSERT ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_for_meeting_request();

CREATE OR REPLACE FUNCTION public.create_notification_for_meeting_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  acting_user uuid := auth.uid();
  notification_owner uuid;
  notification_type text;
BEGIN
  IF acting_user IS NULL OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'requested'
     AND NEW.status IN ('accepted', 'declined')
     AND acting_user = NEW.recipient_id THEN
    notification_owner := NEW.requester_id;
    notification_type := CASE
      WHEN NEW.status = 'accepted' THEN 'meeting_accepted'
      ELSE 'meeting_declined'
    END;
  ELSIF NEW.status = 'scheduled'
        AND acting_user IN (NEW.requester_id, NEW.recipient_id) THEN
    notification_owner := CASE
      WHEN acting_user = NEW.requester_id THEN NEW.recipient_id
      ELSE NEW.requester_id
    END;
    notification_type := 'meeting_scheduled';
  ELSE
    -- Includes completed, cancelled, invalid actor/transition combinations,
    -- and every lifecycle event intentionally excluded from V1.
    RETURN NEW;
  END IF;

  IF notification_owner = acting_user THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    actor_id,
    type,
    match_id,
    event_id,
    meeting_id
  ) VALUES (
    notification_owner,
    acting_user,
    notification_type,
    NEW.match_id,
    NEW.event_id,
    NEW.id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification_for_meeting_status_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER meetings_create_status_notification
  AFTER UPDATE OF status ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_for_meeting_status_change();

CREATE OR REPLACE FUNCTION public.mark_notification_read(notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.notifications
  SET read_at = COALESCE(read_at, now())
  WHERE id = notification_id
    AND user_id = auth.uid();

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;
