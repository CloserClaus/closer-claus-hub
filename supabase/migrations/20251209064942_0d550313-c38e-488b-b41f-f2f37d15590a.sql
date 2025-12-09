-- Create pipeline stage enum
CREATE TYPE public.pipeline_stage AS ENUM (
  'new',
  'contacted', 
  'discovery',
  'meeting',
  'proposal',
  'closed_won',
  'closed_lost'
);

-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,
  notes TEXT,
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create deals table
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  assigned_to UUID NOT NULL,
  title TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  stage pipeline_stage NOT NULL DEFAULT 'new',
  expected_close_date DATE,
  notes TEXT,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create deal activities table for history
CREATE TABLE public.deal_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;

-- Leads RLS Policies
CREATE POLICY "Workspace members can view leads"
ON public.leads FOR SELECT
USING (
  is_workspace_owner(auth.uid(), workspace_id) OR
  is_workspace_member(auth.uid(), workspace_id)
);

CREATE POLICY "Workspace members can create leads"
ON public.leads FOR INSERT
WITH CHECK (
  is_workspace_owner(auth.uid(), workspace_id) OR
  is_workspace_member(auth.uid(), workspace_id)
);

CREATE POLICY "Workspace members can update leads"
ON public.leads FOR UPDATE
USING (
  is_workspace_owner(auth.uid(), workspace_id) OR
  is_workspace_member(auth.uid(), workspace_id)
);

CREATE POLICY "Workspace owners can delete leads"
ON public.leads FOR DELETE
USING (is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "Platform admins can view all leads"
ON public.leads FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'));

-- Deals RLS Policies
CREATE POLICY "Workspace members can view deals"
ON public.deals FOR SELECT
USING (
  is_workspace_owner(auth.uid(), workspace_id) OR
  is_workspace_member(auth.uid(), workspace_id)
);

CREATE POLICY "Workspace members can create deals"
ON public.deals FOR INSERT
WITH CHECK (
  is_workspace_owner(auth.uid(), workspace_id) OR
  is_workspace_member(auth.uid(), workspace_id)
);

CREATE POLICY "Workspace members can update deals"
ON public.deals FOR UPDATE
USING (
  is_workspace_owner(auth.uid(), workspace_id) OR
  is_workspace_member(auth.uid(), workspace_id)
);

CREATE POLICY "Workspace owners can delete deals"
ON public.deals FOR DELETE
USING (is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "Platform admins can view all deals"
ON public.deals FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'));

-- Deal Activities RLS Policies
CREATE POLICY "Workspace members can view deal activities"
ON public.deal_activities FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = deal_id AND (
      is_workspace_owner(auth.uid(), d.workspace_id) OR
      is_workspace_member(auth.uid(), d.workspace_id)
    )
  )
);

CREATE POLICY "Workspace members can create deal activities"
ON public.deal_activities FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = deal_id AND (
      is_workspace_owner(auth.uid(), d.workspace_id) OR
      is_workspace_member(auth.uid(), d.workspace_id)
    )
  )
);

CREATE POLICY "Platform admins can view all deal activities"
ON public.deal_activities FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'));

-- Create triggers for updated_at
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deals_updated_at
BEFORE UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_leads_workspace ON public.leads(workspace_id);
CREATE INDEX idx_deals_workspace ON public.deals(workspace_id);
CREATE INDEX idx_deals_stage ON public.deals(stage);
CREATE INDEX idx_deals_assigned ON public.deals(assigned_to);