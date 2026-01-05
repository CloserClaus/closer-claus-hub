-- Drop duplicate/old SELECT policies 
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Participants can view messages" ON messages;

-- Drop old INSERT policies that use the problematic function
DROP POLICY IF EXISTS "Workspace members can create conversations" ON conversations;
DROP POLICY IF EXISTS "Workspace members can add participants" ON conversation_participants;

-- Recreate INSERT policies using is_workspace_member function
CREATE POLICY "Workspace members can create conversations"
ON conversations FOR INSERT
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can add participants"
ON conversation_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_participants.conversation_id
    AND public.is_workspace_member(auth.uid(), c.workspace_id)
  )
);