-- Concierge V1 telemetry is written only by trusted server-side code. Client
-- roles must not be able to manufacture usage events or alter existing logs.
DROP POLICY IF EXISTS "Anyone can record concierge prompts" ON public.concierge_logs;
DROP POLICY IF EXISTS "Visitors can record valid concierge prompts" ON public.concierge_logs;

REVOKE ALL ON TABLE public.concierge_logs FROM PUBLIC, anon, authenticated;
GRANT INSERT ON TABLE public.concierge_logs TO service_role;

-- V1 logging contract for the future Edge Function:
--   prompt = '[redacted]'
--   context = {
--     "source": "concierge_v1",
--     "request_id": <client-generated UUID reused for retries>,
--     "user_id": <authenticated user UUID derived by trusted server code>,
--     "event_id": <validated event UUID or null>,
--     "status": "success" | "controlled_failure" | "provider_failure"
--   }
-- recommended_matches may contain trusted match_id values. The partial index
-- deliberately ignores every historical/non-V1 row, including rows without a
-- request_id, while ensuring one V1 search is counted at most once on retries.
CREATE UNIQUE INDEX concierge_logs_v1_request_id_unique
ON public.concierge_logs ((context ->> 'request_id'))
WHERE context ->> 'source' = 'concierge_v1'
  AND context ? 'request_id';
