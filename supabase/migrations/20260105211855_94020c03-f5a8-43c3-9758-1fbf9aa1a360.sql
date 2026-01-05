-- Create table for contract signing OTPs
CREATE TABLE public.contract_signing_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  session_token UUID,
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_signing_otps ENABLE ROW LEVEL SECURITY;

-- No direct access policies - all access through edge function with service role
-- This table is managed entirely by backend for security

-- Create index for faster lookups
CREATE INDEX idx_contract_signing_otps_contract_email ON public.contract_signing_otps(contract_id, email);
CREATE INDEX idx_contract_signing_otps_session_token ON public.contract_signing_otps(session_token) WHERE session_token IS NOT NULL;