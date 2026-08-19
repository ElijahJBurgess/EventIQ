ALTER TABLE public.profiles
  ADD COLUMN location_preference text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_location_preference_check
  CHECK (
    location_preference IS NULL
    OR location_preference IN (
      'prioritize_city',
      'prioritize_outside_city',
      'mix',
      'no_preference'
    )
  );
