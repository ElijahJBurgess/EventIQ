-- All existing profiles are confirmed test/seed data. Reset profile-owned
-- activity before replacing the identity vocabulary.
DELETE FROM public.profiles;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_type_check,
  DROP CONSTRAINT IF EXISTS profiles_secondary_role_types_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_type_check
    CHECK (role_type IN (
      'Founder / Co-founder',
      'Investor',
      'Recruiter',
      'Hiring Manager',
      'Corporate Professional',
      'Entrepreneur / Small Business Owner',
      'Creator / Influencer',
      'Consultant / Service Provider',
      'Brand / Partnership Leader',
      'Community Builder',
      'Nonprofit Leader',
      'Executive',
      'Student / Recent Graduate',
      'Press / Media',
      'Speaker / Thought Leader',
      'Other'
    )),
  ADD CONSTRAINT profiles_secondary_role_types_check
    CHECK (
      secondary_role_types IS NULL
      OR (
        cardinality(secondary_role_types) <= 2
        AND COALESCE(array_ndims(secondary_role_types), 1) = 1
        AND array_position(secondary_role_types, NULL) IS NULL
        AND secondary_role_types <@ ARRAY[
          'Founder / Co-founder',
          'Investor',
          'Recruiter',
          'Hiring Manager',
          'Corporate Professional',
          'Entrepreneur / Small Business Owner',
          'Creator / Influencer',
          'Consultant / Service Provider',
          'Brand / Partnership Leader',
          'Community Builder',
          'Nonprofit Leader',
          'Executive',
          'Student / Recent Graduate',
          'Press / Media',
          'Speaker / Thought Leader',
          'Other'
        ]::text[]
        AND (role_type IS NULL OR NOT (role_type = ANY (secondary_role_types)))
        AND (
          cardinality(secondary_role_types) < 2
          OR secondary_role_types[array_lower(secondary_role_types, 1)]
            IS DISTINCT FROM secondary_role_types[array_upper(secondary_role_types, 1)]
        )
      )
    );

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_primary_function_check
    CHECK (primary_function IN (
      'Executive Leadership',
      'Business Development',
      'Partnerships',
      'Marketing',
      'Brand',
      'Communications / Public Relations',
      'Sales',
      'Product',
      'Engineering',
      'Design / Creative',
      'Data / Analytics',
      'Operations',
      'Strategy',
      'Finance',
      'Investing / Venture Capital',
      'Human Resources / People',
      'Recruiting / Talent Acquisition',
      'Customer Success',
      'Legal / Compliance',
      'Community',
      'Events / Experiences',
      'Content / Media',
      'Consulting / Professional Services',
      'Other'
    )),
  ADD CONSTRAINT profiles_additional_functions_check
    CHECK (
      additional_functions IS NULL
      OR (
        cardinality(additional_functions) <= 2
        AND COALESCE(array_ndims(additional_functions), 1) = 1
        AND array_position(additional_functions, NULL) IS NULL
        AND additional_functions <@ ARRAY[
          'Executive Leadership',
          'Business Development',
          'Partnerships',
          'Marketing',
          'Brand',
          'Communications / Public Relations',
          'Sales',
          'Product',
          'Engineering',
          'Design / Creative',
          'Data / Analytics',
          'Operations',
          'Strategy',
          'Finance',
          'Investing / Venture Capital',
          'Human Resources / People',
          'Recruiting / Talent Acquisition',
          'Customer Success',
          'Legal / Compliance',
          'Community',
          'Events / Experiences',
          'Content / Media',
          'Consulting / Professional Services',
          'Other'
        ]::text[]
        AND (primary_function IS NULL OR NOT (primary_function = ANY (additional_functions)))
        AND (
          cardinality(additional_functions) < 2
          OR additional_functions[array_lower(additional_functions, 1)]
            IS DISTINCT FROM additional_functions[array_upper(additional_functions, 1)]
        )
      )
    ),
  ADD CONSTRAINT profiles_seniority_check
    CHECK (seniority IN (
      'Student',
      'Recent Graduate',
      'Early Career',
      'Individual Contributor',
      'Manager',
      'Senior Manager',
      'Director',
      'Senior Director',
      'Vice President',
      'C-Suite / Executive',
      'Founder / Owner',
      'Partner',
      'Independent / Self-employed'
    ));
