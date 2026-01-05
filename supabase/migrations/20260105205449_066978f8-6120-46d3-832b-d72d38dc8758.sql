-- Add RLS policy to allow workspace owners to view profiles of their workspace members
CREATE POLICY "Workspace owners can view profiles of their workspace members"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT wm.user_id 
    FROM public.workspace_members wm
    INNER JOIN public.workspaces w ON w.id = wm.workspace_id
    WHERE w.owner_id = auth.uid()
    AND wm.removed_at IS NULL
  )
  OR
  id IN (
    SELECT w.owner_id
    FROM public.workspaces w
    INNER JOIN public.workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = auth.uid()
    AND wm.removed_at IS NULL
  )
);