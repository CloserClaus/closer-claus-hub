-- Add RLS policy for platform admins to update workspaces
CREATE POLICY "Platform admins can update all workspaces"
ON public.workspaces
FOR UPDATE
USING (has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));