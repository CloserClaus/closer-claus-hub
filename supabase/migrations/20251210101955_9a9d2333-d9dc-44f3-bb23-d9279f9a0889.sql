-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
DROP POLICY IF EXISTS "Participants can view messages" ON messages;
DROP POLICY IF EXISTS "Active participants can send messages" ON messages;

-- Fix conversation_participants SELECT policy - use workspace membership instead
CREATE POLICY "Users can view participants of their conversations" 
ON conversation_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_participants.conversation_id
    AND (is_workspace_owner(auth.uid(), c.workspace_id) OR is_workspace_member(auth.uid(), c.workspace_id))
  )
);

-- Fix conversations SELECT policy - use workspace membership
CREATE POLICY "Users can view conversations they participate in" 
ON conversations FOR SELECT
USING (
  is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id)
);

-- Fix messages SELECT policy - check via conversations table
CREATE POLICY "Participants can view messages" 
ON messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND (is_workspace_owner(auth.uid(), c.workspace_id) OR is_workspace_member(auth.uid(), c.workspace_id))
  )
);

-- Fix messages INSERT policy - check via conversations table
CREATE POLICY "Active participants can send messages" 
ON messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    JOIN conversations c ON c.id = cp.conversation_id
    WHERE cp.conversation_id = messages.conversation_id
    AND cp.user_id = auth.uid()
    AND cp.is_read_only = false
    AND cp.left_at IS NULL
    AND (is_workspace_owner(auth.uid(), c.workspace_id) OR is_workspace_member(auth.uid(), c.workspace_id))
  )
);