-- Add RLS policy to allow workspace members to view profiles of other members in their workspaces
CREATE POLICY "Workspace members can view profiles of same workspace members"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT wm.user_id 
    FROM public.workspace_members wm
    WHERE wm.workspace_id IN (
      SELECT wm2.workspace_id 
      FROM public.workspace_members wm2 
      WHERE wm2.user_id = auth.uid() 
      AND wm2.removed_at IS NULL
    )
    AND wm.removed_at IS NULL
  )
);