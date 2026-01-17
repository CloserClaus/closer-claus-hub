-- Create salary_payments table to track salary charges and payouts
CREATE TABLE public.salary_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sdr_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  
  -- Salary amount from job posting
  salary_amount NUMERIC NOT NULL,
  
  -- Agency charge (happens immediately on hire)
  agency_charged_at TIMESTAMP WITH TIME ZONE,
  agency_charge_status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed
  stripe_payment_intent_id TEXT,
  
  -- SDR payout (same date next month)
  sdr_payout_date DATE NOT NULL,
  sdr_payout_status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, processing, paid, failed, held
  sdr_payout_amount NUMERIC,
  sdr_paid_at TIMESTAMP WITH TIME ZONE,
  sdr_stripe_transfer_id TEXT,
  
  -- Tracking
  hired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

-- Workspace owners can see their salary payments
CREATE POLICY "Workspace owners can view salary payments"
ON public.salary_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE workspaces.id = salary_payments.workspace_id
    AND workspaces.owner_id = auth.uid()
  )
);

-- SDRs can see their own salary payments
CREATE POLICY "SDRs can view their salary payments"
ON public.salary_payments
FOR SELECT
USING (sdr_id = auth.uid());

-- Platform admins can view all
CREATE POLICY "Platform admins can view all salary payments"
ON public.salary_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'platform_admin'
  )
);

-- Create index for efficient queries
CREATE INDEX idx_salary_payments_workspace ON public.salary_payments(workspace_id);
CREATE INDEX idx_salary_payments_sdr ON public.salary_payments(sdr_id);
CREATE INDEX idx_salary_payments_payout_date ON public.salary_payments(sdr_payout_date) WHERE sdr_payout_status = 'scheduled';

-- Trigger for updated_at
CREATE TRIGGER update_salary_payments_updated_at
BEFORE UPDATE ON public.salary_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();