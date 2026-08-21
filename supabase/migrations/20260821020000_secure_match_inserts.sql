-- Match rows are trusted scoring output. Authenticated clients may read only
-- matches in which they participate, but may not manufacture persisted scores
-- or explanations directly.

DROP POLICY IF EXISTS "Authenticated can insert matches" ON public.matches;
REVOKE INSERT ON TABLE public.matches FROM authenticated;

GRANT SELECT ON TABLE public.matches TO authenticated;
GRANT ALL ON TABLE public.matches TO service_role;
