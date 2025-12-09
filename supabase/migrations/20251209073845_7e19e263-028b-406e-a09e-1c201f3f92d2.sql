-- Create disputes table for SDR deal disputes
CREATE TABLE public.disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  raised_by UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_more_info')),
  admin_notes TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all disputes
CREATE POLICY "Platform admins can manage all disputes"
ON public.disputes
FOR ALL
USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Workspace members can view disputes for their workspace
CREATE POLICY "Workspace members can view disputes"
ON public.disputes
FOR SELECT
USING (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id));

-- SDRs can create disputes for their deals
CREATE POLICY "SDRs can create disputes"
ON public.disputes
FOR INSERT
WITH CHECK (raised_by = auth.uid() AND is_workspace_member(auth.uid(), workspace_id));

-- Add updated_at trigger
CREATE TRIGGER update_disputes_updated_at
BEFORE UPDATE ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes
CREATE INDEX idx_disputes_deal_id ON public.disputes(deal_id);
CREATE INDEX idx_disputes_workspace_id ON public.disputes(workspace_id);
CREATE INDEX idx_disputes_status ON public.disputes(status);