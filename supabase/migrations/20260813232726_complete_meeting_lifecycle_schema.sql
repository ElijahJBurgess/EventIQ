-- The meetings table already contained the participants, match, event,
-- proposed/confirmed times, location, and basic status. Clarify the final
-- scheduled time and add explicit lifecycle timestamps so accepting a meeting
-- and scheduling it can remain separate actions.

ALTER TABLE public.meetings
  RENAME COLUMN confirmed_time TO scheduled_at;

ALTER TABLE public.meetings
  ADD COLUMN requested_at timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN responded_at timestamp with time zone,
  ADD COLUMN completed_at timestamp with time zone;

UPDATE public.meetings
SET status = 'requested'
WHERE status IS NULL;

ALTER TABLE public.meetings
  ALTER COLUMN match_id SET NOT NULL,
  ALTER COLUMN event_id SET NOT NULL,
  ALTER COLUMN requester_id SET NOT NULL,
  ALTER COLUMN recipient_id SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'requested',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_status_check;

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_status_check
  CHECK (status IN ('requested', 'accepted', 'declined', 'scheduled', 'completed', 'cancelled'));

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_participants_differ_check
  CHECK (requester_id <> recipient_id);
