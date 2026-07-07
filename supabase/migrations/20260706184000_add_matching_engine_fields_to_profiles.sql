-- =========================================================
-- Matching engine fields for public.profiles
-- Adds structured attributes required by the matching engine:
-- who to meet, desired outcomes, areas of expertise, dynamic
-- role-based answers, and the primary matching goal for an event.
-- =========================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS who_to_meet TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS desired_outcomes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS areas_of_expertise TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS role_details JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS matching_goal TEXT;
