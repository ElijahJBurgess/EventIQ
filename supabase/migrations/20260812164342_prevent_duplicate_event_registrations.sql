-- A profile may join many events, but may only register once for each event.
-- Guard the operation so this migration is safe if the constraint already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_registrations_event_id_profile_id_key'
      AND conrelid = 'public.event_registrations'::regclass
  ) THEN
    ALTER TABLE public.event_registrations
      ADD CONSTRAINT event_registrations_event_id_profile_id_key
      UNIQUE (event_id, profile_id);
  END IF;
END
$$;
