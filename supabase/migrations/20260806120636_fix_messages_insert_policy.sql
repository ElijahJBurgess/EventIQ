-- Fix messages INSERT policy: sender must actually be authenticated as
-- themselves (unchanged) AND the referenced match_id must be a real match
-- linking sender_id and recipient_id together, in either direction since
-- either person could be user_a_id or user_b_id on a match. Previously the
-- policy only checked auth.uid() = sender_id, so any authenticated user
-- could message any profile by fabricating a match_id/recipient_id.
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

CREATE POLICY "Users can send messages to matched users" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id
      AND (
        (m.user_a_id = sender_id AND m.user_b_id = recipient_id)
        OR
        (m.user_a_id = recipient_id AND m.user_b_id = sender_id)
      )
  )
);
