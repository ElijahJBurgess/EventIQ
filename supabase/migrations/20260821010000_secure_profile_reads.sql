-- The base profiles table contains authentication contact details, personal
-- URLs, internal completion fields, and the complete matching questionnaire.
-- Complete rows are private to their owner; other attendees receive only the
-- networking fields required by V1, and only when a persisted match connects
-- them to the caller.

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own complete profile" ON public.profiles;

REVOKE SELECT ON TABLE public.profiles FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.profiles TO authenticated;

CREATE POLICY "Users can view own complete profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

DROP VIEW IF EXISTS public.attendee_profiles;

CREATE VIEW public.attendee_profiles
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  profile.id,
  profile.full_name,
  profile.avatar_url,
  profile.title,
  profile.company,
  profile.location,
  profile.role_type,
  profile.secondary_role_types,
  profile.matching_goal,
  profile.primary_goal,
  profile.secondary_goals,
  profile.desired_outcomes,
  profile.needs,
  profile.offers,
  profile.areas_of_expertise,
  profile.interests,
  profile.communities,
  profile.who_to_meet,
  profile.connection_preference,
  profile.industry_focus
FROM public.profiles AS profile
WHERE auth.uid() IS NOT NULL
  AND (
    profile.id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.matches AS match
      WHERE (match.user_a_id = auth.uid() AND match.user_b_id = profile.id)
         OR (match.user_b_id = auth.uid() AND match.user_a_id = profile.id)
    )
  );

REVOKE ALL ON TABLE public.attendee_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.attendee_profiles TO authenticated, service_role;

COMMENT ON VIEW public.attendee_profiles IS
  'Safe V1 networking profile fields for the authenticated user and people connected to them by a persisted match.';
