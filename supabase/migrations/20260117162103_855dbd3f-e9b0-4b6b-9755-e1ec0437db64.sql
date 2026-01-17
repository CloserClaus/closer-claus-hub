-- Part 1: Apollo Lead Marketplace Database Schema & Credit System

-- 1. Create lead_credits table - Agency credit balance
CREATE TABLE public.lead_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  credits_balance INTEGER NOT NULL DEFAULT 0,
  last_purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id)
);

-- 2. Create lead_credit_purchases table - Purchase history
CREATE TABLE public.lead_credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  credits_amount INTEGER NOT NULL,
  price_paid NUMERIC NOT NULL,
  purchased_by UUID NOT NULL,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create apollo_leads table - All Apollo leads with enrichment tracking
CREATE TABLE public.apollo_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  apollo_id TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  email_status TEXT,
  phone TEXT,
  phone_status TEXT,
  linkedin_url TEXT,
  company_name TEXT,
  company_domain TEXT,
  company_linkedin_url TEXT,
  title TEXT,
  seniority TEXT,
  department TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  industry TEXT,
  employee_count TEXT,
  enrichment_status TEXT NOT NULL DEFAULT 'pending',
  search_filters JSONB,
  enriched_by UUID,
  enriched_at TIMESTAMPTZ,
  credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, apollo_id)
);

-- 4. Create lead_lists table - User-created lead lists
CREATE TABLE public.lead_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create lead_list_items table - Junction table for leads in lists
CREATE TABLE public.lead_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_list_id UUID NOT NULL REFERENCES public.lead_lists(id) ON DELETE CASCADE,
  apollo_lead_id UUID NOT NULL REFERENCES public.apollo_leads(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lead_list_id, apollo_lead_id)
);

-- 6. Extend existing leads table with Apollo-compatible fields
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_domain TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_linkedin_url TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS seniority TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS employee_count TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS apollo_lead_id UUID REFERENCES public.apollo_leads(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Enable RLS on all new tables
ALTER TABLE public.lead_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apollo_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_list_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lead_credits
CREATE POLICY "Workspace members can view their credits"
ON public.lead_credits FOR SELECT
USING (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace owners can manage credits"
ON public.lead_credits FOR ALL
USING (is_workspace_owner(auth.uid(), workspace_id));

-- RLS Policies for lead_credit_purchases
CREATE POLICY "Workspace members can view purchase history"
ON public.lead_credit_purchases FOR SELECT
USING (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace owners can create purchases"
ON public.lead_credit_purchases FOR INSERT
WITH CHECK (is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "Platform admins can view all purchases"
ON public.lead_credit_purchases FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- RLS Policies for apollo_leads
CREATE POLICY "Workspace members can view enriched leads"
ON public.apollo_leads FOR SELECT
USING (
  (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id))
  AND enrichment_status = 'enriched'
);

CREATE POLICY "Workspace owners can view all their leads"
ON public.apollo_leads FOR SELECT
USING (is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "Platform admins can view all leads"
ON public.apollo_leads FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Workspace owners can manage apollo leads"
ON public.apollo_leads FOR ALL
USING (is_workspace_owner(auth.uid(), workspace_id));

-- RLS Policies for lead_lists
CREATE POLICY "Workspace members can view lead lists"
ON public.lead_lists FOR SELECT
USING (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can create lead lists"
ON public.lead_lists FOR INSERT
WITH CHECK (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "List creator or owner can update lists"
ON public.lead_lists FOR UPDATE
USING (created_by = auth.uid() OR is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "List creator or owner can delete lists"
ON public.lead_lists FOR DELETE
USING (created_by = auth.uid() OR is_workspace_owner(auth.uid(), workspace_id));

-- RLS Policies for lead_list_items
CREATE POLICY "Users can view list items for accessible lists"
ON public.lead_list_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.lead_lists ll
  WHERE ll.id = lead_list_id
  AND (is_workspace_owner(auth.uid(), ll.workspace_id) OR is_workspace_member(auth.uid(), ll.workspace_id))
));

CREATE POLICY "Users can add items to accessible lists"
ON public.lead_list_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.lead_lists ll
  WHERE ll.id = lead_list_id
  AND (is_workspace_owner(auth.uid(), ll.workspace_id) OR is_workspace_member(auth.uid(), ll.workspace_id))
));

CREATE POLICY "Users can remove items from accessible lists"
ON public.lead_list_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.lead_lists ll
  WHERE ll.id = lead_list_id
  AND (ll.created_by = auth.uid() OR is_workspace_owner(auth.uid(), ll.workspace_id))
));

-- Create indexes for performance
CREATE INDEX idx_apollo_leads_workspace_id ON public.apollo_leads(workspace_id);
CREATE INDEX idx_apollo_leads_enrichment_status ON public.apollo_leads(enrichment_status);
CREATE INDEX idx_apollo_leads_created_at ON public.apollo_leads(created_at);
CREATE INDEX idx_lead_lists_workspace_id ON public.lead_lists(workspace_id);
CREATE INDEX idx_lead_credit_purchases_workspace_id ON public.lead_credit_purchases(workspace_id);
CREATE INDEX idx_lead_list_items_lead_list_id ON public.lead_list_items(lead_list_id);
CREATE INDEX idx_lead_list_items_apollo_lead_id ON public.lead_list_items(apollo_lead_id);

-- Create triggers for updated_at
CREATE TRIGGER update_lead_credits_updated_at
BEFORE UPDATE ON public.lead_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_lists_updated_at
BEFORE UPDATE ON public.lead_lists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();