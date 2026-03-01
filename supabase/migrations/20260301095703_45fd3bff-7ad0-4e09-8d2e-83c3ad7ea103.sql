ALTER TABLE public.offer_diagnostic_leads 
ADD COLUMN IF NOT EXISTS ai_suggestions jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS time_on_results_seconds integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_watched boolean DEFAULT false;