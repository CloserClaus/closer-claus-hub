
# Comprehensive Platform Hardening Plan

## Overview

This plan addresses 8 critical improvements: RLS policy security, lead data freshness, Stripe payout failure handling, deal closure race conditions, power dialer heartbeat cleanup, partial enrichment visibility, salary payout timing, and LinkedIn URL normalization.

---

## Issue 1: Fix RLS Policy Warnings

**Current State**: The database linter identified 3 RLS policies with `USING (true)` or `WITH CHECK (true)`:
- `daily_stats` - Service role INSERT
- `email_verification_tokens` - Service role ALL
- `rate_limits` - Service role ALL
- `notifications` - Service role INSERT

**Problem**: While these are labeled as "service role" policies, they use `USING (true)` which technically allows any authenticated user to access them in permissive mode.

**Solution**: Convert to RESTRICTIVE policies that check for service role OR use proper authentication checks.

**Database Migration**:
```sql
-- Drop and recreate policies with proper restrictions
DROP POLICY IF EXISTS "Service role can insert stats" ON public.daily_stats;
DROP POLICY IF EXISTS "Service role can manage tokens" ON public.email_verification_tokens;
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limits;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Recreate with auth.jwt() role check for service_role
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

-- Notifications need service role for edge functions
CREATE POLICY "Service role can insert notifications" ON public.notifications
FOR INSERT WITH CHECK (
  (auth.jwt() ->> 'role') = 'service_role'
);
```

---

## Issue 2: Lead Data Freshness (12-Month Staleness)

**Current State**: `master_leads` has `last_updated_at` but no staleness tracking or refresh capability.

**Solution**:
1. Add a computed staleness check (12 months)
2. Show "Stale" badge in Admin MasterLeadsTable only
3. Add "Refresh" action to re-enrich stale leads

**Database Changes**:
```sql
-- Add function to check staleness
CREATE OR REPLACE FUNCTION public.is_lead_stale(last_updated timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT last_updated < (now() - interval '12 months')
$$;
```

**Frontend Changes (MasterLeadsTable.tsx)**:
- Add "Stale" badge column using `date-fns` comparison
- Add "Refresh" button for stale rows that triggers re-enrichment
- Create new edge function `refresh-master-lead` that:
  - Calls Apollo API to get fresh data
  - Updates `master_leads` record
  - Does NOT charge credits (admin-only operation)

---

## Issue 3: Stripe Payout Failure Handling

**Current State**: `process-salary-payouts` handles immediate failures but lacks:
- Retry mechanism for failed payouts
- Detection of closed/disabled Stripe Connect accounts
- Admin visibility into persistent failures

**Solution**:
1. Add retry count and last attempt tracking to `salary_payments`
2. Add automatic retry logic (max 3 attempts)
3. Handle account status edge cases
4. Admin notification for persistent failures

**Database Migration**:
```sql
ALTER TABLE public.salary_payments 
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at timestamptz,
ADD COLUMN IF NOT EXISTS failure_reason text;

-- Same for commissions
ALTER TABLE public.commissions
ADD COLUMN IF NOT EXISTS payout_retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS payout_last_retry_at timestamptz,
ADD COLUMN IF NOT EXISTS payout_failure_reason text;
```

**Edge Function Updates (process-salary-payouts)**:
```typescript
// Before attempting payout, verify Connect account status
const account = await stripe.accounts.retrieve(connectAccountId);
if (!account.charges_enabled || !account.payouts_enabled) {
  // Account disabled/restricted - update profile status
  await supabase.from('profiles').update({
    stripe_connect_status: 'disabled'
  }).eq('id', sdr_id);
  
  // Mark as held with reason
  await supabase.from('salary_payments').update({
    sdr_payout_status: 'held',
    failure_reason: 'Connect account disabled or restricted'
  }).eq('id', payout.id);
}

// Add retry logic
if (payout.retry_count < 3) {
  // Increment retry count on failure
  await supabase.from('salary_payments').update({
    retry_count: payout.retry_count + 1,
    last_retry_at: new Date().toISOString()
  }).eq('id', payout.id);
}
```

---

## Issue 4: Concurrent Deal Closure Protection

**Current State**: `create-commission` uses `maybeSingle()` check but lacks database-level protection against race conditions.

**Solution**:
1. Add unique constraint on `commissions(deal_id)`
2. Use database-level locking for deal updates
3. Add optimistic locking with version column

**Database Migration**:
```sql
-- Add unique constraint to prevent duplicate commissions
ALTER TABLE public.commissions 
ADD CONSTRAINT commissions_unique_deal UNIQUE (deal_id);

-- Add version column for optimistic locking on deals
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- Create function for atomic deal closure
CREATE OR REPLACE FUNCTION public.close_deal_atomic(
  p_deal_id uuid,
  p_expected_version integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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
```

**Edge Function Updates (create-commission)**:
```typescript
// Wrap in try-catch for unique constraint violation
try {
  const { error: commissionError } = await supabase
    .from('commissions')
    .insert({ ... });
  
  if (commissionError?.code === '23505') { // Unique violation
    return { success: true, message: 'Commission already exists', existing: true };
  }
} catch (e) {
  // Handle race condition gracefully
}
```

---

## Issue 5: Power Dialer Heartbeat/Cleanup

**Current State**: No mechanism to detect abandoned dialer sessions or clean up stale Twilio connections.

**Solution**:
1. Create `dialer_sessions` table to track active sessions
2. Add heartbeat mechanism from frontend
3. Create cleanup edge function (cron)

**Database Migration**:
```sql
CREATE TABLE public.dialer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  current_lead_id uuid REFERENCES leads(id),
  current_call_sid text,
  status text NOT NULL DEFAULT 'active',
  total_calls integer DEFAULT 0,
  ended_at timestamptz
);

ALTER TABLE public.dialer_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sessions"
ON public.dialer_sessions FOR ALL
USING (user_id = auth.uid());
```

**Frontend Changes (PowerDialer.tsx)**:
```typescript
// Create session on start
const { data: session } = await supabase
  .from('dialer_sessions')
  .insert({ workspace_id, user_id, status: 'active' })
  .select()
  .single();

// Heartbeat every 30 seconds
useEffect(() => {
  const heartbeat = setInterval(async () => {
    if (sessionId && dialerStatus !== 'idle') {
      await supabase
        .from('dialer_sessions')
        .update({ last_heartbeat_at: new Date().toISOString() })
        .eq('id', sessionId);
    }
  }, 30000);
  return () => clearInterval(heartbeat);
}, [sessionId, dialerStatus]);
```

**New Edge Function (cleanup-dialer-sessions)**:
```typescript
// Run every 5 minutes via cron
// Find sessions with no heartbeat in last 2 minutes
const { data: staleSessions } = await supabase
  .from('dialer_sessions')
  .select('*')
  .eq('status', 'active')
  .lt('last_heartbeat_at', new Date(Date.now() - 2 * 60 * 1000).toISOString());

for (const session of staleSessions) {
  // End any active Twilio call
  if (session.current_call_sid) {
    await twilioClient.calls(session.current_call_sid).update({ status: 'completed' });
  }
  // Mark session as abandoned
  await supabase.from('dialer_sessions').update({
    status: 'abandoned',
    ended_at: new Date().toISOString()
  }).eq('id', session.id);
}
```

---

## Issue 6: Partial Enrichment Visibility

**Current State**: All leads are shown to users regardless of enrichment completeness. Users are charged for all enrichments.

**Solution**:
1. Define "fully enriched" as having BOTH email AND phone
2. Only show fully enriched leads to users
3. Store partially enriched leads but mark them differently
4. Only charge credits for fully enriched leads

**Edge Function Updates (apollo-enrich)**:
```typescript
// After getting Apollo response, check completeness
const isFullyEnriched = !!(enrichedData.email && enrichedData.phone);

if (isFullyEnriched) {
  // Update apollo_leads with enrichment_status = 'enriched'
  // Charge credits
  creditsUsed += CREDITS_PER_LEAD;
  enrichedFromApi++;
} else {
  // Update apollo_leads with enrichment_status = 'partial'
  // Save data but don't charge credits
  await supabase.from('apollo_leads').update({
    ...enrichedData,
    enrichment_status: 'partial', // New status
    credits_used: 0, // No charge
  }).eq('id', lead.id);
  
  // Still save to master_leads for potential future use
  // But don't count toward enrichment stats
}

// Response includes partial count
return {
  enriched_count: fullyEnrichedCount,
  partial_count: partialCount,
  message: partialCount > 0 
    ? `${partialCount} leads had incomplete data (no email or phone) and were not charged.`
    : undefined
};
```

**RLS Policy Update**:
```sql
-- Update workspace member policy to exclude partial leads
DROP POLICY IF EXISTS "Workspace members can view enriched leads" ON public.apollo_leads;
CREATE POLICY "Workspace members can view enriched leads" 
ON public.apollo_leads FOR SELECT
USING (
  (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id))
  AND enrichment_status = 'enriched'  -- Excludes 'partial'
);

-- Owners can still see partial leads
CREATE POLICY "Workspace owners can view partial leads"
ON public.apollo_leads FOR SELECT
USING (
  is_workspace_owner(auth.uid(), workspace_id)
  AND enrichment_status = 'partial'
);
```

---

## Issue 7: SDR Salary Month-to-Month Timing

**Current State**: Already correctly implemented. The `charge-salary` function calculates payout date as:
```typescript
const payoutDate = new Date(hiredAt);
payoutDate.setMonth(payoutDate.getMonth() + 1);
```

This correctly handles month-to-month (Jan 15 -> Feb 15), with edge case handling for months with fewer days.

**Verification**: No changes needed. The existing implementation is correct.

---

## Issue 8: LinkedIn URL Deduplication/Normalization

**Current State**: LinkedIn URLs are stored as-is from Apollo. Variations like:
- `https://linkedin.com/in/johndoe`
- `https://www.linkedin.com/in/johndoe`
- `http://linkedin.com/in/johndoe/`
- `linkedin.com/in/johndoe`

Would be treated as different leads, causing duplicates.

**Solution**: Create a normalization function and apply it consistently.

**Database Function**:
```sql
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
  
  -- Ensure linkedin.com prefix
  IF NOT normalized LIKE 'linkedin.com/%' THEN
    RETURN NULL; -- Invalid LinkedIn URL
  END IF;
  
  -- Remove trailing slash
  normalized := regexp_replace(normalized, '/$', '');
  
  -- Remove query parameters
  normalized := regexp_replace(normalized, '\?.*$', '');
  
  RETURN normalized;
END;
$$;

-- Create trigger to normalize on insert/update
CREATE OR REPLACE FUNCTION public.normalize_linkedin_url_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.linkedin_url := normalize_linkedin_url(NEW.linkedin_url);
  RETURN NEW;
END;
$$;

CREATE TRIGGER master_leads_normalize_linkedin
BEFORE INSERT OR UPDATE ON public.master_leads
FOR EACH ROW EXECUTE FUNCTION normalize_linkedin_url_trigger();

CREATE TRIGGER apollo_leads_normalize_linkedin
BEFORE INSERT OR UPDATE ON public.apollo_leads
FOR EACH ROW EXECUTE FUNCTION normalize_linkedin_url_trigger();
```

**Edge Function Updates**: Apply normalization before lookups:
```typescript
// In apollo-enrich, normalize before cache lookup
const normalizeLinkedinUrl = (url: string | null): string | null => {
  if (!url) return null;
  let normalized = url.toLowerCase();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  normalized = normalized.replace(/\/$/, '');
  normalized = normalized.replace(/\?.*$/, '');
  return normalized;
};

const linkedinUrls = leadsToEnrich
  .map(lead => normalizeLinkedinUrl(lead.linkedin_url))
  .filter((url): url is string => !!url);
```

---

## Implementation Summary

| Component | Type | Priority | Files Affected |
|-----------|------|----------|----------------|
| RLS Policy Fixes | Migration | Critical | New migration |
| Lead Freshness | Migration + UI | Medium | Migration, MasterLeadsTable.tsx, new edge function |
| Stripe Retry Logic | Migration + Edge | High | Migration, process-salary-payouts, stripe-webhook |
| Deal Race Condition | Migration + Edge | High | Migration, create-commission, PipelineBoard.tsx |
| Dialer Heartbeat | Migration + UI + Edge | Medium | Migration, PowerDialer.tsx, new cleanup function |
| Partial Enrichment | Migration + Edge + RLS | High | Migration, apollo-enrich, new RLS policies |
| LinkedIn Normalization | Migration + Edge | Medium | Migration, apollo-enrich, apollo-search |

---

## Technical Cron Job Setup

Add to `supabase/config.toml`:
```toml
[functions.cleanup-dialer-sessions]
schedule = "*/5 * * * *"  # Every 5 minutes
```
