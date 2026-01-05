-- Allow workspace owners (and platform admins) to create conversations

DROP POLICY IF EXISTS "Workspace members can create conversations" ON public.conversations;

CREATE POLICY "Workspace members can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'platform_admin')
  OR public.can_access_workspace_conversations(auth.uid(), workspace_id)
);
