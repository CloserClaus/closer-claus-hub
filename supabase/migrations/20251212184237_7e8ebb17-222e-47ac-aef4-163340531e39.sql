-- Fix: Restrict coupon visibility to authenticated users only
-- This prevents public scraping of coupon codes including the 100% discount SANTA coupon

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can read active coupons" ON public.coupons;

-- Create new policy that requires authentication
CREATE POLICY "Authenticated users can read active coupons"
ON public.coupons FOR SELECT
TO authenticated
USING (
  is_active = true 
  AND (valid_until IS NULL OR valid_until > now())
);