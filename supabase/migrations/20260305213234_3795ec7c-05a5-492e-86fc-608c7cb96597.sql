
-- Add pipeline tracking columns to signal_runs
ALTER TABLE public.signal_runs 
  ADD COLUMN IF NOT EXISTS current_pipeline_stage integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pipeline_stage_count integer NOT NULL DEFAULT 1;

-- Add pipeline enrichment columns to signal_leads
ALTER TABLE public.signal_leads
  ADD COLUMN IF NOT EXISTS pipeline_stage text,
  ADD COLUMN IF NOT EXISTS website_content text,
  ADD COLUMN IF NOT EXISTS linkedin_profile_url text,
  ADD COLUMN IF NOT EXISTS company_linkedin_url text;
