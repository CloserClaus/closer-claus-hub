-- Add explicit deny-all policies for contract_signing_otps (used only via backend functions)

ALTER TABLE public.contract_signing_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access" ON public.contract_signing_otps;

CREATE POLICY "No direct access"
ON public.contract_signing_otps
FOR ALL
USING (false)
WITH CHECK (false);
