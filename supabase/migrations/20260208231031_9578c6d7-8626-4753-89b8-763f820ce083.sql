-- Add columns for persisting generated scripts and delivery mechanism
ALTER TABLE public.offer_diagnostic_state
  ADD COLUMN IF NOT EXISTS delivery_mechanism text,
  ADD COLUMN IF NOT EXISTS generated_script text,
  ADD COLUMN IF NOT EXISTS generated_progression_rules text,
  ADD COLUMN IF NOT EXISTS script_types jsonb,
  ADD COLUMN IF NOT EXISTS script_is_validation_mode boolean,
  ADD COLUMN IF NOT EXISTS script_generated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS script_diagnostic_version integer;