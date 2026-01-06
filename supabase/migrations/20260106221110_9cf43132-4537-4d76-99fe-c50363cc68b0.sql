-- Add Stripe Connect fields to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_status TEXT DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at TIMESTAMPTZ;

-- Add SDR payout tracking fields to commissions table
ALTER TABLE public.commissions 
  ADD COLUMN IF NOT EXISTS sdr_payout_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sdr_payout_stripe_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS sdr_paid_at TIMESTAMPTZ;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_connect_status ON public.profiles(stripe_connect_status);
CREATE INDEX IF NOT EXISTS idx_commissions_sdr_payout_status ON public.commissions(sdr_payout_status);