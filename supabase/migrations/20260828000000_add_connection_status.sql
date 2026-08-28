-- Phase 0 of the connection-status system: an explicit source of truth for
-- "are these two people connected," replacing the implicit "both replied =
-- connected" inference that MessageThread.tsx, connectionSummary.ts, and
-- Concierge's context.ts each currently re-derive independently.
--
-- This migration ONLY adds and backfills the column. No consumer's
-- behavior changes here -- that's Phase 1 (gating messaging/scheduling on
-- this status) and later phases.

ALTER TABLE public.matches
  ADD COLUMN connection_status text NOT NULL DEFAULT 'none'
    CHECK (connection_status IN ('none', 'pending', 'accepted', 'declined')),
  ADD COLUMN connection_requested_by uuid REFERENCES public.profiles(id),
  ADD COLUMN connection_status_updated_at timestamp with time zone;

-- Backfill. Per-match message facts:
--   senders          -- distinct sender_id values seen on this match_id
--   is_reciprocal    -- both user_a_id and user_b_id appear as a sender
--   first_request    -- earliest message with message_type = 'connect_request'
--   last_message_at  -- most recent message on this match, any type
WITH message_facts AS (
  SELECT
    m.id AS match_id,
    (bool_or(msg.sender_id = m.user_a_id) AND bool_or(msg.sender_id = m.user_b_id)) AS is_reciprocal,
    (array_agg(msg.sender_id ORDER BY msg.created_at) FILTER (WHERE msg.message_type = 'connect_request'))[1] AS first_requester,
    max(msg.created_at) AS last_message_at
  FROM public.matches m
  JOIN public.messages msg ON msg.match_id = m.id
  GROUP BY m.id, m.user_a_id, m.user_b_id
)
UPDATE public.matches m
SET
  connection_status = CASE
    WHEN f.is_reciprocal THEN 'accepted'
    WHEN f.first_requester IS NOT NULL THEN 'pending'
    ELSE 'none'
  END,
  connection_requested_by = f.first_requester,
  connection_status_updated_at = f.last_message_at
FROM message_facts f
WHERE f.match_id = m.id
  AND (f.is_reciprocal OR f.first_requester IS NOT NULL);

COMMENT ON COLUMN public.matches.connection_status IS
  'Explicit connection lifecycle state. none = no connect request sent yet. pending = a connect_request message was sent and not yet reciprocated. accepted = both participants have sent at least one message (today''s definition of "connected"; Phase 1 replaces this with a real accept action). declined = reserved for the future explicit decline flow, not yet produced by any code path.';
COMMENT ON COLUMN public.matches.connection_requested_by IS
  'profiles.id of whichever participant sent the first connect_request message on this match, if any.';
COMMENT ON COLUMN public.matches.connection_status_updated_at IS
  'Timestamp of the most recent message that produced the current connection_status, backfilled from message history. Not a full audit trail.';
