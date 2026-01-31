-- Fix Security Issues
-- ==================

-- 1. FIX: Jobs table public exposure
-- Remove the overly permissive "Anyone can view active jobs" policy
-- Replace with authenticated SDR-only access to active jobs (hiding sensitive business details)

DROP POLICY IF EXISTS "Anyone can view active jobs" ON public.jobs;

-- Create a new policy that only allows authenticated users with 'sdr' role to view active jobs
CREATE POLICY "Authenticated SDRs can view active jobs" 
  ON public.jobs 
  FOR SELECT 
  USING (
    is_active = true 
    AND has_role(auth.uid(), 'sdr'::app_role)
  );

-- 2. FIX: Contract signatures protection
-- The current policy "Workspace members can view signatures" is good but we should ensure
-- anonymous users cannot view signatures even if they created them
-- The INSERT policy allows anyone to create for sent contracts (needed for external signing)
-- But we need to ensure SELECT is properly restricted

-- Current policies look correct, but let's add an explicit check for authenticated users
-- First drop and recreate with explicit auth check
DROP POLICY IF EXISTS "Workspace members can view signatures" ON public.contract_signatures;

CREATE POLICY "Workspace members can view signatures" 
  ON public.contract_signatures 
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.id = contract_signatures.contract_id 
      AND (is_workspace_owner(auth.uid(), c.workspace_id) OR is_workspace_member(auth.uid(), c.workspace_id))
    )
  );

-- Also allow the signer to view their own signature after signing (for confirmation page)
CREATE POLICY "Signers can view their own signatures" 
  ON public.contract_signatures 
  FOR SELECT 
  USING (signer_email = current_setting('request.jwt.claims', true)::json->>'email');

-- 3. FIX: Apollo leads - Restrict SDR access to only leads assigned to them or created by them
-- This prevents data harvesting by compromised SDR accounts

-- First, we need to add an assigned_to or created_by tracking column if it doesn't exist
-- Looking at the apollo_leads table, it has enriched_by column which tracks who enriched it
-- We'll use this to restrict access

DROP POLICY IF EXISTS "Workspace members can view enriched leads" ON public.apollo_leads;

-- Replace with stricter policy: SDRs can only view leads they enriched or that are in their assigned lead lists
CREATE POLICY "SDRs can view their enriched leads" 
  ON public.apollo_leads 
  FOR SELECT 
  USING (
    (is_workspace_member(auth.uid(), workspace_id) AND enriched_by = auth.uid() AND enrichment_status = 'enriched')
    OR
    (is_workspace_member(auth.uid(), workspace_id) AND EXISTS (
      SELECT 1 FROM lead_list_items lli
      JOIN lead_lists ll ON ll.id = lli.lead_list_id
      WHERE lli.apollo_lead_id = apollo_leads.id
      AND ll.created_by = auth.uid()
    ))
  );

-- Workspace owners still have full access via their existing ALL policy

-- 4. Commission financial exposure warning - The current policies are acceptable
-- SDRs can only see their own commissions (sdr_id = auth.uid())
-- Workspace owners manage all in their workspace
-- Platform admins manage all
-- This is already properly restricted. Mark as reviewed.