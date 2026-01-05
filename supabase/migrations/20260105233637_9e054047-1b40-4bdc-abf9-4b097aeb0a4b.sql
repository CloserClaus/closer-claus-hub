-- Add assigned_to column to leads table
ALTER TABLE public.leads ADD COLUMN assigned_to uuid;
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);

-- Create contract_requests table
CREATE TABLE public.contract_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  deal_id uuid NOT NULL REFERENCES public.deals(id),
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  -- Client details for agency
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_company text,
  client_title text,
  client_phone text,
  client_address text,
  -- Deal/contract details
  deal_description text NOT NULL,
  deal_value numeric NOT NULL,
  payment_terms text NOT NULL,
  contract_duration text,
  start_date date,
  special_conditions text,
  deliverables text,
  -- Agency response
  agency_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on contract_requests
ALTER TABLE public.contract_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contract_requests
-- SDRs can create requests for deals assigned to them
CREATE POLICY "SDRs can create contract requests"
ON public.contract_requests
FOR INSERT
WITH CHECK (
  requested_by = auth.uid() 
  AND is_workspace_member(auth.uid(), workspace_id)
  AND EXISTS (
    SELECT 1 FROM public.deals d 
    WHERE d.id = deal_id 
    AND d.assigned_to = auth.uid()
  )
);

-- SDRs can view their own requests
CREATE POLICY "SDRs can view their own contract requests"
ON public.contract_requests
FOR SELECT
USING (requested_by = auth.uid());

-- Agency owners can view all requests in their workspace
CREATE POLICY "Agency owners can view all contract requests"
ON public.contract_requests
FOR SELECT
USING (is_workspace_owner(auth.uid(), workspace_id));

-- Agency owners can update requests (approve/reject)
CREATE POLICY "Agency owners can update contract requests"
ON public.contract_requests
FOR UPDATE
USING (is_workspace_owner(auth.uid(), workspace_id));

-- Platform admins can view all
CREATE POLICY "Platform admins can view all contract requests"
ON public.contract_requests
FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'));

-- Update RLS policy for leads - SDRs can only see their assigned leads
DROP POLICY IF EXISTS "Workspace members can view leads" ON public.leads;
CREATE POLICY "Workspace members can view leads"
ON public.leads
FOR SELECT
USING (
  is_workspace_owner(auth.uid(), workspace_id) 
  OR (is_workspace_member(auth.uid(), workspace_id) AND assigned_to = auth.uid())
);

-- SDRs can only update leads assigned to them
DROP POLICY IF EXISTS "Workspace members can update leads" ON public.leads;
CREATE POLICY "Workspace members can update leads"
ON public.leads
FOR UPDATE
USING (
  is_workspace_owner(auth.uid(), workspace_id) 
  OR (is_workspace_member(auth.uid(), workspace_id) AND assigned_to = auth.uid())
);

-- Update leads INSERT policy - when SDR creates lead, it's auto-assigned to them
DROP POLICY IF EXISTS "Workspace members can create leads" ON public.leads;
CREATE POLICY "Workspace members can create leads"
ON public.leads
FOR INSERT
WITH CHECK (
  is_workspace_owner(auth.uid(), workspace_id) 
  OR is_workspace_member(auth.uid(), workspace_id)
);

-- Create function to reassign leads when SDR leaves
CREATE OR REPLACE FUNCTION public.reassign_leads_on_member_removal()
RETURNS TRIGGER AS $$
BEGIN
  -- When a member is removed (removed_at is set), reassign their leads to NULL (agency pool)
  IF NEW.removed_at IS NOT NULL AND OLD.removed_at IS NULL THEN
    UPDATE public.leads
    SET assigned_to = NULL, updated_at = now()
    WHERE workspace_id = NEW.workspace_id
      AND assigned_to = NEW.user_id;
    
    -- Create notification for workspace owner
    INSERT INTO public.notifications (
      user_id,
      workspace_id,
      type,
      title,
      message,
      data
    )
    SELECT 
      w.owner_id,
      NEW.workspace_id,
      'sdr_departure',
      'SDR Left - Leads Reassigned',
      'An SDR has left and their leads have been returned to the agency pool for reassignment.',
      jsonb_build_object('removed_user_id', NEW.user_id)
    FROM public.workspaces w
    WHERE w.id = NEW.workspace_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for SDR departure
DROP TRIGGER IF EXISTS trigger_reassign_leads_on_removal ON public.workspace_members;
CREATE TRIGGER trigger_reassign_leads_on_removal
  AFTER UPDATE ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.reassign_leads_on_member_removal();

-- Create updated_at trigger for contract_requests
CREATE TRIGGER update_contract_requests_updated_at
  BEFORE UPDATE ON public.contract_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();