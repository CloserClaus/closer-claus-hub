
-- Add email column and enriched flag to signal_leads
ALTER TABLE public.signal_leads ADD COLUMN IF NOT EXISTS email text DEFAULT NULL;
ALTER TABLE public.signal_leads ADD COLUMN IF NOT EXISTS enriched boolean NOT NULL DEFAULT false;
