-- "Render ATL 2026" should no longer appear as a selectable event anywhere
-- (onboarding event picker, Rooms join list -- both filter on is_published).
-- Not deleted: it has 6 real event_registrations and 15 real matches tied to
-- it, which a delete would cascade-destroy (or orphan) for users already
-- registered. Unpublishing hides it from new joins while leaving existing
-- registrants' access, matches, and history intact.

UPDATE public.events
SET is_published = false
WHERE name = 'Render ATL 2026';
