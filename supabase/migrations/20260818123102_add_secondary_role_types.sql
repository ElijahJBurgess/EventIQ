-- Keep role_type as the single primary identity while allowing up to two
-- additional identities. Existing profiles receive an empty array by default.
ALTER TABLE public.profiles
  ADD COLUMN secondary_role_types text[] DEFAULT '{}'::text[];

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_secondary_role_types_check
  CHECK (
    secondary_role_types IS NULL
    OR (
      cardinality(secondary_role_types) <= 2
      AND COALESCE(array_ndims(secondary_role_types), 1) = 1
      AND array_position(secondary_role_types, NULL) IS NULL
      AND secondary_role_types <@ ARRAY[
        'Founder',
        'Investor',
        'Recruiter',
        'Hiring Manager',
        'Creator',
        'Professional',
        'Brand Partner',
        'Community Builder',
        'Student',
        'Sponsor',
        'Other'
      ]::text[]
      AND (
        role_type IS NULL
        OR NOT (role_type = ANY (secondary_role_types))
      )
      AND (
        cardinality(secondary_role_types) < 2
        OR secondary_role_types[array_lower(secondary_role_types, 1)]
          IS DISTINCT FROM secondary_role_types[array_upper(secondary_role_types, 1)]
      )
    )
  );
