-- Create contracts table
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'auto_generated',
  custom_pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  signed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contract_signatures table
CREATE TABLE public.contract_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signature_data TEXT,
  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create commissions table for tracking payouts
CREATE TABLE public.commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  sdr_id UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  rake_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- Contracts RLS Policies
CREATE POLICY "Workspace members can view contracts"
ON public.contracts FOR SELECT
USING (
  is_workspace_owner(auth.uid(), workspace_id) OR 
  is_workspace_member(auth.uid(), workspace_id)
);

CREATE POLICY "Workspace owners can manage contracts"
ON public.contracts FOR ALL
USING (is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "Platform admins can view all contracts"
ON public.contracts FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Contract Signatures RLS Policies (needs public insert for signing)
CREATE POLICY "Workspace members can view signatures"
ON public.contract_signatures FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_signatures.contract_id
    AND (is_workspace_owner(auth.uid(), c.workspace_id) OR is_workspace_member(auth.uid(), c.workspace_id))
  )
);

CREATE POLICY "Anyone can create signatures for sent contracts"
ON public.contract_signatures FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_signatures.contract_id
    AND c.status = 'sent'
  )
);

CREATE POLICY "Platform admins can view all signatures"
ON public.contract_signatures FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Commissions RLS Policies
CREATE POLICY "Workspace owners can manage commissions"
ON public.commissions FOR ALL
USING (is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "SDRs can view their own commissions"
ON public.commissions FOR SELECT
USING (sdr_id = auth.uid());

CREATE POLICY "Platform admins can manage all commissions"
ON public.commissions FOR ALL
USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commissions_updated_at
  BEFORE UPDATE ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_contracts_workspace ON public.contracts(workspace_id);
CREATE INDEX idx_contracts_deal ON public.contracts(deal_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_contract_signatures_contract ON public.contract_signatures(contract_id);
CREATE INDEX idx_commissions_workspace ON public.commissions(workspace_id);
CREATE INDEX idx_commissions_sdr ON public.commissions(sdr_id);
CREATE INDEX idx_commissions_deal ON public.commissions(deal_id);