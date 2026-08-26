-- Item 8: lightweight "Was this connection valuable?" prompt after a
-- meeting is marked complete. Reuses the existing event-level `feedback`
-- table instead of a new one -- nullable so existing event-level rows stay
-- valid. Response is stored as a 1-5 rating (yes=5, no=1) via the existing
-- overall_rating column so this can later become a real 1-5 scale prompt
-- without a schema change.
ALTER TABLE public.feedback
  ADD COLUMN meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE;
