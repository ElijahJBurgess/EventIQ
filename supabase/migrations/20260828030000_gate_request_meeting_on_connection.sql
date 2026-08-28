-- request_meeting previously only enforced event registration + no active
-- meeting. It did not check connection_status at all, so a client could call
-- the RPC directly and request a meeting on a pending/declined/none match
-- even though the UI hid the button. Client-side gating alone is not
-- enforcement -- close the gap server-side, matching how respond_to_meeting
-- and every other write in this table already work.

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

  IF matched_row.connection_status <> 'accepted' THEN
    RAISE EXCEPTION 'Connection must be accepted before scheduling' USING ERRCODE = '42501';
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
