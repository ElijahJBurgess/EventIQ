-- Registration and check-in base rows contain attendee identity and onboarding
-- data. Keep complete rows owner-only and expose only match-scoped presence to
-- attendee networking surfaces.

DROP POLICY IF EXISTS "Visitors can submit valid event registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "v2 users can register themselves" ON public.event_registrations;
DROP POLICY IF EXISTS "v2 users can view registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "v2 users can update own registration" ON public.event_registrations;

REVOKE ALL ON TABLE public.event_registrations FROM anon;
REVOKE DELETE ON TABLE public.event_registrations FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.event_registrations TO authenticated;
GRANT ALL ON TABLE public.event_registrations TO service_role;

CREATE POLICY "Users can create own registration"
  ON public.event_registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = profile_id
    AND event_id IS NOT NULL
  );

CREATE POLICY "Users can view own registration"
  ON public.event_registrations
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = profile_id);

CREATE POLICY "Users can update own registration"
  ON public.event_registrations
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = profile_id)
  WITH CHECK ((SELECT auth.uid()) = profile_id);

DROP POLICY IF EXISTS "Authenticated can view check-ins" ON public.check_ins;
DROP POLICY IF EXISTS "Users can manage own check-in" ON public.check_ins;

REVOKE ALL ON TABLE public.check_ins FROM anon;
REVOKE DELETE ON TABLE public.check_ins FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.check_ins TO authenticated;
GRANT ALL ON TABLE public.check_ins TO service_role;

CREATE POLICY "Users can view own check-in"
  ON public.check_ins
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create own check-in"
  ON public.check_ins
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own check-in"
  ON public.check_ins
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP VIEW IF EXISTS public.matched_event_attendance;

CREATE VIEW public.matched_event_attendance
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  registration.event_id,
  registration.profile_id,
  registration.is_checked_in
FROM public.event_registrations AS registration
WHERE auth.uid() IS NOT NULL
  AND registration.event_id IS NOT NULL
  AND registration.profile_id IS NOT NULL
  AND registration.status = 'registered'
  AND EXISTS (
    SELECT 1
    FROM public.event_registrations AS own_registration
    WHERE own_registration.event_id = registration.event_id
      AND own_registration.profile_id = auth.uid()
      AND own_registration.status = 'registered'
  )
  AND (
    registration.profile_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.matches AS match
      WHERE match.event_id = registration.event_id
        AND (
          (match.user_a_id = auth.uid() AND match.user_b_id = registration.profile_id)
          OR (match.user_b_id = auth.uid() AND match.user_a_id = registration.profile_id)
        )
    )
  );

REVOKE ALL ON TABLE public.matched_event_attendance FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.matched_event_attendance TO authenticated, service_role;

COMMENT ON VIEW public.matched_event_attendance IS
  'Event, profile, and check-in presence for the caller and persisted matches in Rooms the caller joined.';

CREATE OR REPLACE FUNCTION public.get_event_attendance_counts(p_event_id uuid)
RETURNS TABLE (registered_count bigint, checked_in_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.event_registrations AS registration
    WHERE registration.event_id = p_event_id
      AND registration.profile_id = auth.uid()
      AND registration.status = 'registered'
  ) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    count(*)::bigint,
    count(*) FILTER (WHERE registration.is_checked_in)::bigint
  FROM public.event_registrations AS registration
  WHERE registration.event_id = p_event_id
    AND registration.status = 'registered';
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_attendance_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_attendance_counts(uuid) TO authenticated;

-- Meeting rows remain readable by their participants, but all client writes
-- now pass through narrow SECURITY DEFINER functions that derive and validate
-- identity, participants, event, match, role, and lifecycle state.

DROP POLICY IF EXISTS "Users can create meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can update own meetings" ON public.meetings;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.meetings FROM authenticated;
GRANT SELECT ON TABLE public.meetings TO authenticated;
GRANT ALL ON TABLE public.meetings TO service_role;

CREATE OR REPLACE FUNCTION public.request_meeting(p_match_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  acting_user uuid := auth.uid();
  matched_row public.matches%ROWTYPE;
  other_user uuid;
  new_meeting_id uuid;
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO matched_row
  FROM public.matches
  WHERE id = p_match_id
    AND event_id IS NOT NULL
    AND acting_user IN (user_a_id, user_b_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.event_registrations
    WHERE event_id = matched_row.event_id
      AND profile_id = acting_user
      AND status = 'registered'
  ) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  other_user := CASE
    WHEN matched_row.user_a_id = acting_user THEN matched_row.user_b_id
    ELSE matched_row.user_a_id
  END;

  IF other_user IS NULL OR other_user = acting_user THEN
    RAISE EXCEPTION 'Invalid match participants' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.meetings
    WHERE match_id = p_match_id
      AND status IN ('requested', 'accepted', 'scheduled')
  ) THEN
    RAISE EXCEPTION 'A meeting is already active' USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.meetings
    WHERE match_id = p_match_id
      AND requester_id = acting_user
      AND status = 'declined'
  ) THEN
    RAISE EXCEPTION 'Meeting retry is not allowed for this requester' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.meetings (
    match_id,
    event_id,
    requester_id,
    recipient_id,
    status,
    requested_at
  ) VALUES (
    matched_row.id,
    matched_row.event_id,
    acting_user,
    other_user,
    'requested',
    now()
  )
  RETURNING id INTO new_meeting_id;

  RETURN new_meeting_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_meeting(p_meeting_id uuid, p_response text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  acting_user uuid := auth.uid();
  meeting_row public.meetings%ROWTYPE;
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Invalid meeting response' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO meeting_row
  FROM public.meetings
  WHERE id = p_meeting_id
  FOR UPDATE;

  IF NOT FOUND OR meeting_row.recipient_id <> acting_user THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  IF meeting_row.status <> 'requested' THEN
    RAISE EXCEPTION 'Invalid meeting transition' USING ERRCODE = '22023';
  END IF;

  UPDATE public.meetings
  SET status = p_response,
      responded_at = now()
  WHERE id = p_meeting_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_meeting(
  p_meeting_id uuid,
  p_scheduled_at timestamp with time zone,
  p_location_note text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  acting_user uuid := auth.uid();
  meeting_row public.meetings%ROWTYPE;
  clean_location text := btrim(p_location_note);
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_scheduled_at IS NULL OR clean_location IS NULL OR length(clean_location) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Invalid schedule details' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO meeting_row
  FROM public.meetings
  WHERE id = p_meeting_id
  FOR UPDATE;

  IF NOT FOUND OR acting_user NOT IN (meeting_row.requester_id, meeting_row.recipient_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  IF meeting_row.status <> 'accepted' THEN
    RAISE EXCEPTION 'Invalid meeting transition' USING ERRCODE = '22023';
  END IF;

  UPDATE public.meetings
  SET status = 'scheduled',
      scheduled_at = p_scheduled_at,
      location_note = clean_location
  WHERE id = p_meeting_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_meeting(p_meeting_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  acting_user uuid := auth.uid();
  meeting_row public.meetings%ROWTYPE;
BEGIN
  IF acting_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO meeting_row
  FROM public.meetings
  WHERE id = p_meeting_id
  FOR UPDATE;

  IF NOT FOUND OR acting_user NOT IN (meeting_row.requester_id, meeting_row.recipient_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  IF meeting_row.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Invalid meeting transition' USING ERRCODE = '22023';
  END IF;

  UPDATE public.meetings
  SET status = 'completed',
      completed_at = now()
  WHERE id = p_meeting_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.request_meeting(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_to_meeting(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.schedule_meeting(uuid, timestamp with time zone, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_meeting(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.request_meeting(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_meeting(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_meeting(uuid, timestamp with time zone, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_meeting(uuid) TO authenticated;
