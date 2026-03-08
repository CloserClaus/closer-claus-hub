ALTER TABLE public.signal_runs 
ADD COLUMN IF NOT EXISTS plan_phase text,
ADD COLUMN IF NOT EXISTS plan_test_runs jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS plan_stage_outputs jsonb DEFAULT '{}'::jsonb;