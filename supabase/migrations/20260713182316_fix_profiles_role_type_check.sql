-- =========================================================
-- Fix profiles_role_type_check to match the Page 1 dropdown exactly.
--
-- The original constraint (migration 20260624020108) allowed 'Corporate
-- Leader' (never an actual dropdown option) but was missing 'Hiring
-- Manager' and 'Brand Partner' (both live options in
-- src/components/profile-setup/Page1BasicInfo.tsx). Any user selecting
-- either of those two roles would complete the full 4-page setup flow
-- and then fail on final submit with no way to recover.
-- =========================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_type_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_type_check
  CHECK (role_type IN (
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
  ));
