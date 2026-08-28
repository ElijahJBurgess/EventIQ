-- Phase 3: "Did you connect with [Name]?" self-report. One row per
-- (match, user) -- once answered, never re-asked for that connection.
-- was_valuable is only meaningful when response = 'met' and mirrors the
-- existing feedback.overall_rating scale's intent, but lives here (not in
-- `feedback`) because this covers connections with no formal meeting at
-- all, which `feedback` has no way to reference (it only links to
-- meeting_id, not match_id).

CREATE TABLE public.connection_self_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  response text NOT NULL CHECK (response IN ('met', 'exchanged_messages', 'scheduled_for_later', 'not_yet', 'no_longer_interested')),
  was_valuable boolean,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id),
  CONSTRAINT connection_self_reports_valuable_only_when_met
    CHECK (was_valuable IS NULL OR response = 'met')
);

ALTER TABLE public.connection_self_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.connection_self_reports FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.connection_self_reports TO authenticated;
GRANT ALL ON TABLE public.connection_self_reports TO service_role;

CREATE POLICY "Users can view own connection self-reports"
  ON public.connection_self_reports
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create own connection self-reports"
  ON public.connection_self_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (SELECT auth.uid()) IN (m.user_a_id, m.user_b_id)
        AND m.connection_status = 'accepted'
    )
  );
