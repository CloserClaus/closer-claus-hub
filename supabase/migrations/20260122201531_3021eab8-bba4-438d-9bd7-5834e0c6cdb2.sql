-- ============================================
-- COMPREHENSIVE PLATFORM HARDENING MIGRATION
-- ============================================

-- ============================================
-- ISSUE 1: Fix RLS Policy Warnings
-- ============================================

-- Drop existing permissive service role policies
DROP POLICY IF EXISTS "Service role can insert stats" ON public.daily_stats;
DROP POLICY IF EXISTS "Service role can manage tokens" ON public.email_verification_tokens;
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limits;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Recreate with proper auth.jwt() role check for service_role
CREATE POLICY "Service role can insert stats" ON public.daily_stats
FOR INSERT WITH CHECK (
  (auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Service role can manage tokens" ON public.email_verification_tokens
FOR ALL USING (
  (auth.jwt() ->> 'role') = 'service_role'
) WITH CHECK (
  (auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Service role can manage rate limits" ON public.rate_limits
FOR ALL USING (
  (auth.jwt() ->> 'role') = 'service_role'
) WITH CHECK (
  (auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Service role can insert notifications" ON public.notifications
FOR INSERT WITH CHECK (
  (auth.jwt() ->> 'role') = 'service_role'
);

-- ============================================
-- ISSUE 2: Lead Data Freshness (12-Month Staleness)
-- ============================================

-- Add function to check staleness
CREATE OR REPLACE FUNCTION public.is_lead_stale(last_updated timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT last_updated < (now() - interval '12 months')
$$;

-- ============================================
-- ISSUE 3: Stripe Payout Failure Handling
-- ============================================

-- Add retry tracking columns to salary_payments
ALTER TABLE public.salary_payments 
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at timestamptz,
ADD COLUMN IF NOT EXISTS failure_reason text;

-- Add retry tracking columns to commissions
ALTER TABLE public.commissions
ADD COLUMN IF NOT EXISTS payout_retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS payout_last_retry_at timestamptz,
ADD COLUMN IF NOT EXISTS payout_failure_reason text;

-- ============================================
-- ISSUE 4: Concurrent Deal Closure Protection
-- ============================================

-- Add unique constraint to prevent duplicate commissions for same deal (use DO block for IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commissions_unique_deal'
  ) THEN
    ALTER TABLE public.commissions ADD CONSTRAINT commissions_unique_deal UNIQUE (deal_id);
  END IF;
END$$;

-- Add version column for optimistic locking on deals
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- Create function for atomic deal closure with optimistic locking
CREATE OR REPLACE FUNCTION public.close_deal_atomic(
  p_deal_id uuid,
  p_expected_version integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows integer;
BEGIN
  UPDATE public.deals
  SET 
    stage = 'closed_won',
    closed_at = now(),
    version = version + 1,
    updated_at = now()
  WHERE id = p_deal_id
    AND version = p_expected_version
    AND stage NOT IN ('closed_won', 'closed_lost');
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

-- ============================================
-- ISSUE 5: Power Dialer Heartbeat/Cleanup
-- ============================================

-- Create dialer_sessions table
CREATE TABLE IF NOT EXISTS public.dialer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  current_lead_id uuid,
  current_call_sid text,
  status text NOT NULL DEFAULT 'active',
  total_calls integer DEFAULT 0,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_dialer_sessions_status ON public.dialer_sessions(status);
CREATE INDEX IF NOT EXISTS idx_dialer_sessions_heartbeat ON public.dialer_sessions(last_heartbeat_at) WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.dialer_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for dialer_sessions
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.dialer_sessions;
CREATE POLICY "Users can manage their own sessions"
ON public.dialer_sessions FOR ALL
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Workspace owners can view all sessions" ON public.dialer_sessions;
CREATE POLICY "Workspace owners can view all sessions"
ON public.dialer_sessions FOR SELECT
USING (is_workspace_owner(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Service role can manage all sessions" ON public.dialer_sessions;
CREATE POLICY "Service role can manage all sessions"
ON public.dialer_sessions FOR ALL
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- ============================================
-- ISSUE 6: Partial Enrichment Visibility
-- ============================================

-- Update RLS policy to exclude partial leads from regular users
DROP POLICY IF EXISTS "Workspace members can view enriched leads" ON public.apollo_leads;

CREATE POLICY "Workspace members can view enriched leads" 
ON public.apollo_leads FOR SELECT
USING (
  (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id))
  AND enrichment_status = 'enriched'
);

-- Owners can see partial leads for debugging
DROP POLICY IF EXISTS "Workspace owners can view partial leads" ON public.apollo_leads;
CREATE POLICY "Workspace owners can view partial leads"
ON public.apollo_leads FOR SELECT
USING (
  is_workspace_owner(auth.uid(), workspace_id)
  AND enrichment_status = 'partial'
);

-- ============================================
-- ISSUE 8: LinkedIn URL Deduplication/Normalization
-- ============================================

-- Create normalization function
CREATE OR REPLACE FUNCTION public.normalize_linkedin_url(url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized text;
BEGIN
  IF url IS NULL OR url = '' THEN
    RETURN NULL;
  END IF;
  
  -- Lowercase
  normalized := lower(url);
  
  -- Remove protocol
  normalized := regexp_replace(normalized, '^https?://', '');
  
  -- Remove www.
  normalized := regexp_replace(normalized, '^www\.', '');
  
  -- Remove trailing slash
  normalized := regexp_replace(normalized, '/$', '');
  
  -- Remove query parameters
  normalized := regexp_replace(normalized, '\?.*$', '');
  
  RETURN normalized;
END;
$$;

-- Create trigger function for automatic normalization
CREATE OR REPLACE FUNCTION public.normalize_linkedin_url_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.linkedin_url IS NOT NULL AND NEW.linkedin_url != '' THEN
    NEW.linkedin_url := normalize_linkedin_url(NEW.linkedin_url);
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on master_leads and apollo_leads
DROP TRIGGER IF EXISTS master_leads_normalize_linkedin ON public.master_leads;
CREATE TRIGGER master_leads_normalize_linkedin
BEFORE INSERT OR UPDATE ON public.master_leads
FOR EACH ROW EXECUTE FUNCTION normalize_linkedin_url_trigger();

DROP TRIGGER IF EXISTS apollo_leads_normalize_linkedin ON public.apollo_leads;
CREATE TRIGGER apollo_leads_normalize_linkedin
BEFORE INSERT OR UPDATE ON public.apollo_leads
FOR EACH ROW EXECUTE FUNCTION normalize_linkedin_url_trigger();

-- Normalize existing data in master_leads
UPDATE public.master_leads 
SET linkedin_url = normalize_linkedin_url(linkedin_url)
WHERE linkedin_url IS NOT NULL AND linkedin_url != '';

-- Normalize existing data in apollo_leads
UPDATE public.apollo_leads 
SET linkedin_url = normalize_linkedin_url(linkedin_url)
WHERE linkedin_url IS NOT NULL AND linkedin_url != '';