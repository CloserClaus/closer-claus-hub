-- Add readiness evaluation fields to apollo_leads
ALTER TABLE public.apollo_leads
ADD COLUMN IF NOT EXISTS readiness_score integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS readiness_verdict text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS readiness_signals text[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS readiness_evaluated_at timestamp with time zone DEFAULT NULL;

-- Add readiness fields to leads table for CRM sync
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS readiness_score integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS readiness_segment text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS readiness_notes text DEFAULT NULL;

-- Create table to store offer diagnostic state per workspace
CREATE TABLE IF NOT EXISTS public.offer_diagnostic_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  offer_type text,
  promise text,
  vertical_segment text,
  company_size text,
  pricing_structure text,
  price_tier text,
  proof_level text,
  risk_model text,
  fulfillment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- Enable RLS
ALTER TABLE public.offer_diagnostic_state ENABLE ROW LEVEL SECURITY;

-- RLS policies for offer_diagnostic_state
CREATE POLICY "Users can view their own diagnostic state"
ON public.offer_diagnostic_state
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own diagnostic state"
ON public.offer_diagnostic_state
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own diagnostic state"
ON public.offer_diagnostic_state
FOR UPDATE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_offer_diagnostic_state_updated_at
BEFORE UPDATE ON public.offer_diagnostic_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();