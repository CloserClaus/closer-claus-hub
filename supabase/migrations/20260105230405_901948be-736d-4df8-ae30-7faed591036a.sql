
-- Drop existing policies that use can_access_workspace_conversations incorrectly
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;

-- Create new policy: Users can only view conversations they are a participant of
CREATE POLICY "Users can view conversations they participate in"
ON public.conversations
FOR SELECT
USING (
  has_role(auth.uid(), 'platform_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
    AND cp.user_id = auth.uid()
  )
);

-- Create new policy: Users can only view participants of conversations they're in
CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants
FOR SELECT
USING (
  has_role(auth.uid(), 'platform_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
    AND cp.user_id = auth.uid()
  )
);

-- Create new policy: Users can only view messages in conversations they participate in
CREATE POLICY "Participants can view messages"
ON public.messages
FOR SELECT
USING (
  has_role(auth.uid(), 'platform_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
    AND cp.user_id = auth.uid()
  )
);

-- Drop redundant platform admin policies since they're now included in the main policies
DROP POLICY IF EXISTS "Platform admins can view all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Platform admins can view all participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Platform admins can view all messages" ON public.messages;
