-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view conversation participants for their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;

-- Create a security definer function to check conversation participation
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM conversation_participants
    WHERE user_id = _user_id
      AND conversation_id = _conversation_id
  )
$$;

-- Recreate policies using the security definer function
CREATE POLICY "Users can view their own conversations"
ON conversations FOR SELECT
USING (
  public.has_role(auth.uid(), 'platform_admin')
  OR public.is_conversation_participant(auth.uid(), id)
);

CREATE POLICY "Users can view conversation participants for their conversations"
ON conversation_participants FOR SELECT
USING (
  public.has_role(auth.uid(), 'platform_admin')
  OR public.is_conversation_participant(auth.uid(), conversation_id)
);

CREATE POLICY "Users can view messages in their conversations"
ON messages FOR SELECT
USING (
  public.has_role(auth.uid(), 'platform_admin')
  OR public.is_conversation_participant(auth.uid(), conversation_id)
);