-- Cache for the Enterprise dashboard's "Insights" tab. One row per event.
-- Written and read only by the service-role `admin-auth` edge function
-- (the organizer dashboard is password-gated, not auth-gated), so there are
-- no anon/authenticated RLS policies -- service_role bypasses RLS.
--
-- `stats_fingerprint` is a SHA-256 of the aggregated EventStats payload the
-- insights were generated from; the edge function regenerates only when it
-- changes or on an explicit refresh.

CREATE TABLE public.event_ai_insights (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  stats_fingerprint text NOT NULL,
  model text NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.event_ai_insights ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_ai_insights FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.event_ai_insights TO service_role;
