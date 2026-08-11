-- Prevent duplicate "Request to Connect" messages, without limiting normal
-- back-and-forth messaging in an existing conversation.
--
-- Approach: give the initial connect message its own message_type
-- ('connect_request', distinct from the default 'text' used by every normal
-- reply in MessageThread.tsx), then add a unique index scoped only to that
-- type. Normal 'text' messages are completely untouched by the index.

-- 1. Allow the new message_type value.
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text','meetup_coord','meeting_link','note','connect_request'));

-- 2. Backfill: retype the earliest pre-existing connect message per
-- (match_id, sender_id) as 'connect_request' so history is preserved and
-- step 3 below doesn't fail against legacy duplicates sent before this fix
-- existed (this happened at least once in production already). Any extra
-- duplicate copies are left as ordinary 'text' rows -- nothing is deleted.
WITH first_connect_messages AS (
  SELECT DISTINCT ON (match_id, sender_id) id
  FROM public.messages
  WHERE message_type = 'text'
    AND content = 'Hi! Looking forward to connecting at Render ATL.'
  ORDER BY match_id, sender_id, created_at ASC
)
UPDATE public.messages
SET message_type = 'connect_request'
WHERE id IN (SELECT id FROM first_connect_messages);

-- 3. One connect_request per (match_id, sender_id). Normal 'text' messages
-- are unaffected since the index only applies to connect_request rows.
CREATE UNIQUE INDEX IF NOT EXISTS messages_one_connect_request_per_sender
  ON public.messages (match_id, sender_id)
  WHERE message_type = 'connect_request';
