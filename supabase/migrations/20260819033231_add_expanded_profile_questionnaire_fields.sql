-- Add storage for the expanded profile questionnaire without changing any
-- existing profile columns or their behavior.
ALTER TABLE public.profiles
  ADD COLUMN first_name text,
  ADD COLUMN last_name text,
  ADD COLUMN primary_function text,
  ADD COLUMN additional_functions text[] DEFAULT '{}'::text[],
  ADD COLUMN seniority text,
  ADD COLUMN industries text[] DEFAULT '{}'::text[],
  ADD COLUMN primary_goal text,
  ADD COLUMN secondary_goals text[] DEFAULT '{}'::text[],
  ADD COLUMN needs text[] DEFAULT '{}'::text[],
  ADD COLUMN offers text[] DEFAULT '{}'::text[],
  ADD COLUMN expertise_sought text[] DEFAULT '{}'::text[],
  ADD COLUMN industry_preference text,
  ADD COLUMN career_level_preference text[] DEFAULT '{}'::text[],
  ADD COLUMN connection_preference text[] DEFAULT '{}'::text[],
  ADD COLUMN location_city text,
  ADD COLUMN location_state_code text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_industries_max_3_check
    CHECK (industries IS NULL OR cardinality(industries) <= 3),
  ADD CONSTRAINT profiles_needs_max_5_check
    CHECK (needs IS NULL OR cardinality(needs) <= 5),
  ADD CONSTRAINT profiles_offers_max_5_check
    CHECK (offers IS NULL OR cardinality(offers) <= 5),
  ADD CONSTRAINT profiles_expertise_sought_max_5_check
    CHECK (expertise_sought IS NULL OR cardinality(expertise_sought) <= 5),
  ADD CONSTRAINT profiles_career_level_preference_max_3_check
    CHECK (career_level_preference IS NULL OR cardinality(career_level_preference) <= 3);
