
-- Phase 2A: Add opted_out columns to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS opted_out boolean NOT NULL DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS opted_out_at timestamptz;

-- Phase 6A: Add retry_count to active_follow_ups
ALTER TABLE public.active_follow_ups ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;
