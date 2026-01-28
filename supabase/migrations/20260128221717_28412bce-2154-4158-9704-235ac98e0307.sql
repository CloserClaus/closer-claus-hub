-- Add latent scoring columns to offer_diagnostic_state table
ALTER TABLE public.offer_diagnostic_state 
ADD COLUMN IF NOT EXISTS latent_economic_headroom integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS latent_proof_to_promise integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS latent_fulfillment_scalability integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS latent_risk_alignment integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS latent_channel_fit integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS latent_alignment_score integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS latent_readiness_label text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS latent_bottleneck_key text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_recommendations jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_offer_diagnostic_state_workspace_user 
ON public.offer_diagnostic_state(workspace_id, user_id);