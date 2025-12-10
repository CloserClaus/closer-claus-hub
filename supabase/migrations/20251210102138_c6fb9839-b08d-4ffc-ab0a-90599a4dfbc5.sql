-- Create a security definer function to check if user can access a workspace's conversations
CREATE OR REPLACE FUNCTION public.can_access_workspace_conversations(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    EXISTS (SELECT 1 FROM public.workspaces WHERE id = _workspace_id AND owner_id = _user_id)
    OR 
    EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id AND removed_at IS NULL)
  )
$$;

-- Drop and recreate all conversation-related policies with simpler approach
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Workspace members can add participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
DROP POLICY IF EXISTS "Workspace members can create conversations" ON conversations;
DROP POLICY IF EXISTS "Participants can view messages" ON messages;
DROP POLICY IF EXISTS "Active participants can send messages" ON messages;

-- Simplified conversations SELECT policy
CREATE POLICY "Users can view conversations they participate in" 
ON conversations FOR SELECT
USING (can_access_workspace_conversations(auth.uid(), workspace_id));

-- Simplified conversations INSERT policy
CREATE POLICY "Workspace members can create conversations" 
ON conversations FOR INSERT
WITH CHECK (can_access_workspace_conversations(auth.uid(), workspace_id));

-- Simplified conversation_participants SELECT policy using the workspace from conversations
CREATE POLICY "Users can view participants of their conversations" 
ON conversation_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_participants.conversation_id
    AND can_access_workspace_conversations(auth.uid(), c.workspace_id)
  )
);

-- Simplified conversation_participants INSERT policy
CREATE POLICY "Workspace members can add participants" 
ON conversation_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_participants.conversation_id
    AND can_access_workspace_conversations(auth.uid(), c.workspace_id)
  )
);

-- Simplified messages SELECT policy
CREATE POLICY "Participants can view messages" 
ON messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND can_access_workspace_conversations(auth.uid(), c.workspace_id)
  )
);

-- Simplified messages INSERT policy (must be participant and not read-only)
CREATE POLICY "Active participants can send messages" 
ON messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
    AND cp.user_id = auth.uid()
    AND cp.is_read_only = false
    AND cp.left_at IS NULL
  )
);