-- Create table for workspace call credits
CREATE TABLE public.workspace_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  credits_balance INTEGER NOT NULL DEFAULT 0,
  last_purchased_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

-- Create table for purchased phone numbers
CREATE TABLE public.workspace_phone_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'US',
  monthly_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  callhippo_number_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for credit purchase history
CREATE TABLE public.credit_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  credits_amount INTEGER NOT NULL,
  price_paid NUMERIC(10,2) NOT NULL,
  purchased_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workspace_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

-- RLS policies for workspace_credits
CREATE POLICY "Workspace members can view credits" ON public.workspace_credits
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = workspace_credits.workspace_id AND wm.user_id = auth.uid())
  );

CREATE POLICY "Workspace owners can manage credits" ON public.workspace_credits
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_credits.workspace_id AND w.owner_id = auth.uid())
  );

-- RLS policies for workspace_phone_numbers
CREATE POLICY "Workspace members can view phone numbers" ON public.workspace_phone_numbers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = workspace_phone_numbers.workspace_id AND wm.user_id = auth.uid())
  );

CREATE POLICY "Workspace owners can manage phone numbers" ON public.workspace_phone_numbers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_phone_numbers.workspace_id AND w.owner_id = auth.uid())
  );

-- RLS policies for credit_purchases
CREATE POLICY "Workspace members can view purchase history" ON public.credit_purchases
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = credit_purchases.workspace_id AND wm.user_id = auth.uid())
  );

CREATE POLICY "Workspace owners can create purchases" ON public.credit_purchases
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = credit_purchases.workspace_id AND w.owner_id = auth.uid())
  );

-- Trigger for updated_at
CREATE TRIGGER update_workspace_credits_updated_at
  BEFORE UPDATE ON public.workspace_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();