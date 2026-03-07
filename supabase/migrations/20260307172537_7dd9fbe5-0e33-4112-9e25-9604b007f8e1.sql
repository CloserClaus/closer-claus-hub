
-- Cache for dynamically discovered Apify actors
CREATE TABLE public.signal_actor_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text NOT NULL UNIQUE,
  actor_key text,
  label text,
  category text,
  description text,
  input_schema jsonb DEFAULT '{}',
  output_fields jsonb DEFAULT '{}',
  monthly_users integer DEFAULT 0,
  total_runs integer DEFAULT 0,
  rating numeric(3,2),
  cached_at timestamptz DEFAULT now()
);

-- Allow service role access only (no user-facing RLS needed)
ALTER TABLE public.signal_actor_cache ENABLE ROW LEVEL SECURITY;

-- Track mid-run pipeline adjustments
ALTER TABLE public.signal_runs 
  ADD COLUMN IF NOT EXISTS pipeline_adjustments jsonb DEFAULT '[]';
