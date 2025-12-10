-- Create call_scripts table
CREATE TABLE public.call_scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_scripts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workspace members can view scripts"
ON public.call_scripts FOR SELECT
USING (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace owners can manage scripts"
ON public.call_scripts FOR ALL
USING (is_workspace_owner(auth.uid(), workspace_id));

-- Trigger for updated_at
CREATE TRIGGER update_call_scripts_updated_at
BEFORE UPDATE ON public.call_scripts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one default script per workspace
CREATE UNIQUE INDEX idx_call_scripts_default_per_workspace 
ON public.call_scripts(workspace_id) 
WHERE is_default = true;