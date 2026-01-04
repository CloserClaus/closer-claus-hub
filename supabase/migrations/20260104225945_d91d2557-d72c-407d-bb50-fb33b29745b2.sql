-- Create scheduled_callbacks table for Power Dialer follow-ups
CREATE TABLE public.scheduled_callbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  reason TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_by UUID NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_callbacks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Workspace members can view callbacks"
  ON public.scheduled_callbacks FOR SELECT
  USING (
    is_workspace_owner(auth.uid(), workspace_id) OR 
    is_workspace_member(auth.uid(), workspace_id)
  );

CREATE POLICY "Workspace members can create callbacks"
  ON public.scheduled_callbacks FOR INSERT
  WITH CHECK (
    is_workspace_owner(auth.uid(), workspace_id) OR 
    is_workspace_member(auth.uid(), workspace_id)
  );

CREATE POLICY "Workspace members can update callbacks"
  ON public.scheduled_callbacks FOR UPDATE
  USING (
    is_workspace_owner(auth.uid(), workspace_id) OR 
    is_workspace_member(auth.uid(), workspace_id)
  );

CREATE POLICY "Workspace members can delete callbacks"
  ON public.scheduled_callbacks FOR DELETE
  USING (
    is_workspace_owner(auth.uid(), workspace_id) OR 
    is_workspace_member(auth.uid(), workspace_id)
  );

-- Add trigger for updated_at
CREATE TRIGGER update_scheduled_callbacks_updated_at
  BEFORE UPDATE ON public.scheduled_callbacks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient querying
CREATE INDEX idx_scheduled_callbacks_workspace_status ON public.scheduled_callbacks(workspace_id, status, scheduled_for);