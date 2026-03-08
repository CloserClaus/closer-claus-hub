
-- Create atomic increment function for sends_today
CREATE OR REPLACE FUNCTION public.increment_inbox_sends_today(p_inbox_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE email_inboxes SET sends_today = sends_today + 1 WHERE id = p_inbox_id;
$$;
