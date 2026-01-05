-- Fix conversation_participants INSERT policy dependency on conversations SELECT RLS

-- Helper: get workspace_id for a conversation (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_conversation_workspace_id(_conversation_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.workspace_id
  FROM public.conversations c
  WHERE c.id = _conversation_id
$$;

-- Replace INSERT policy to avoid selecting conversations under RLS
DROP POLICY IF EXISTS "Workspace members can add participants" ON conversation_participants;

CREATE POLICY "Workspace members can add participants"
ON conversation_participants
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'platform_admin')
  OR public.is_workspace_member(auth.uid(), public.get_conversation_workspace_id(conversation_id))
);
