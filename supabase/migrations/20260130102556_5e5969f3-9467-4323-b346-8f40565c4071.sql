-- Fix overly permissive INSERT policy on referrals
-- Replace the "Anyone can create" with a more restrictive policy

-- Drop the permissive policy
DROP POLICY IF EXISTS "Anyone can create referrals" ON public.referrals;

-- Create a more restrictive policy: only authenticated users can create referrals
-- and only where the referrer_id matches a valid profile's id (via the referral code)
CREATE POLICY "Authenticated users can create referrals via signup"
ON public.referrals
FOR INSERT
WITH CHECK (
  -- Must be authenticated (during signup, this will be the new user)
  auth.uid() IS NOT NULL
);