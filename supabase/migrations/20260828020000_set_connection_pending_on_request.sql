-- Fixes a gap in Phase 0/1: the backfill set connection_status for
-- *existing* messages, and respond_to_connection handles accept/decline, but
-- nothing set connection_status = 'pending' when a NEW connect_request
-- message is sent going forward. Without this, every connect request sent
-- after this feature shipped would sit at 'none' forever and never show the
-- Accept/Decline banner.

CREATE OR REPLACE FUNCTION public.set_connection_pending_on_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.message_type <> 'connect_request' OR NEW.match_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only the first connect_request on a match moves it out of 'none'. If a
  -- second one lands (e.g. both sides send an intro before seeing the
  -- other's), connection_status is already pending/accepted/declined and
  -- this is a deliberate no-op rather than clobbering it.
  UPDATE public.matches
  SET connection_status = 'pending',
      connection_requested_by = NEW.sender_id,
      connection_status_updated_at = NEW.created_at
  WHERE id = NEW.match_id
    AND connection_status = 'none';

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_connection_pending_on_request() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER messages_set_connection_pending
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_connection_pending_on_request();
