-- Phase 2: private notes on a connection. Strictly owner-only -- the other
-- participant never sees these, unlike everything else on a match.

CREATE TABLE public.connection_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)
);

ALTER TABLE public.connection_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.connection_notes FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.connection_notes TO authenticated;
GRANT ALL ON TABLE public.connection_notes TO service_role;

CREATE POLICY "Users can view own connection notes"
  ON public.connection_notes
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create own connection notes"
  ON public.connection_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (SELECT auth.uid()) IN (m.user_a_id, m.user_b_id)
    )
  );

CREATE POLICY "Users can update own connection notes"
  ON public.connection_notes
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
