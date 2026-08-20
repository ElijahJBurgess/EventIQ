CREATE OR REPLACE FUNCTION public.mark_message_thread_read(p_match_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.messages
  SET read_at = now()
  WHERE match_id = p_match_id
    AND recipient_id = auth.uid()
    AND read_at IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL
ON FUNCTION public.mark_message_thread_read(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.mark_message_thread_read(uuid)
TO authenticated;
