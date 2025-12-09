-- Create call_logs table to track all outbound calls
CREATE TABLE public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  caller_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  call_status TEXT NOT NULL DEFAULT 'initiated',
  duration_seconds INTEGER DEFAULT 0,
  callhippo_call_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workspace members can view call logs"
ON public.call_logs FOR SELECT
USING (
  is_workspace_owner(auth.uid(), workspace_id) OR 
  is_workspace_member(auth.uid(), workspace_id)
);

CREATE POLICY "Workspace members can create call logs"
ON public.call_logs FOR INSERT
WITH CHECK (
  is_workspace_owner(auth.uid(), workspace_id) OR 
  is_workspace_member(auth.uid(), workspace_id)
);

CREATE POLICY "Workspace members can update call logs"
ON public.call_logs FOR UPDATE
USING (
  is_workspace_owner(auth.uid(), workspace_id) OR 
  is_workspace_member(auth.uid(), workspace_id)
);

CREATE POLICY "Platform admins can view all call logs"
ON public.call_logs FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Index for faster queries
CREATE INDEX idx_call_logs_workspace ON public.call_logs(workspace_id);
CREATE INDEX idx_call_logs_lead ON public.call_logs(lead_id);
CREATE INDEX idx_call_logs_caller ON public.call_logs(caller_id);