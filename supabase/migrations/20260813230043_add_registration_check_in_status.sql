-- Registration and physical attendance are separate states. Existing and
-- future registrations start unchecked until an attendee explicitly checks in.
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS is_checked_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamp with time zone;
