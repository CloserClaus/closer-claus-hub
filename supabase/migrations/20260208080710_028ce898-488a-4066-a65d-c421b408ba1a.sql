-- Add missing form fields to offer_diagnostic_state for full persistence and lead readiness context
ALTER TABLE public.offer_diagnostic_state
  ADD COLUMN IF NOT EXISTS promise_outcome text,
  ADD COLUMN IF NOT EXISTS icp_industry text,
  ADD COLUMN IF NOT EXISTS icp_maturity text,
  ADD COLUMN IF NOT EXISTS icp_specificity text,
  ADD COLUMN IF NOT EXISTS recurring_price_tier text,
  ADD COLUMN IF NOT EXISTS one_time_price_tier text,
  ADD COLUMN IF NOT EXISTS usage_output_type text,
  ADD COLUMN IF NOT EXISTS usage_volume_tier text,
  ADD COLUMN IF NOT EXISTS hybrid_retainer_tier text,
  ADD COLUMN IF NOT EXISTS performance_basis text,
  ADD COLUMN IF NOT EXISTS performance_comp_tier text,
  ADD COLUMN IF NOT EXISTS scoring_segment text,
  ADD COLUMN IF NOT EXISTS latent_icp_specificity numeric;