-- Same gap as request_meeting: the messages INSERT policy never checked
-- connection_status, so free-text messages could be sent (bypassing the
-- client's UI gate) on a match that isn't accepted yet. The connect_request
-- message itself must always be sendable (it's what creates the pending
-- state in the first place); every other message type now requires an
-- accepted connection.

DROP POLICY IF EXISTS "Users can send messages to matched users" ON public.messages;

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
      AND (
        message_type = 'connect_request'
        OR m.connection_status = 'accepted'
      )
  )
);
