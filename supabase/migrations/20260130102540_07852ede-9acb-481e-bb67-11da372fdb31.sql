-- Referral system for Closer Claus
-- Users get 500 free lead credits for each agency they refer

-- Add referral_code to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES auth.users(id),
  referred_user_id UUID REFERENCES auth.users(id),
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  credits_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for referrals
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users can see their own referrals (where they are the referrer)
CREATE POLICY "Users can view their own referrals"
ON public.referrals
FOR SELECT
USING (referrer_id = auth.uid());

-- Users can insert referrals (signup flow creates them)
CREATE POLICY "Anyone can create referrals"
ON public.referrals
FOR INSERT
WITH CHECK (true);

-- Admin can view all referrals
CREATE POLICY "Admins can view all referrals"
ON public.referrals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'platform_admin'
  )
);

-- Admin can update referrals (for marking as completed)
CREATE POLICY "Admins can update all referrals"
ON public.referrals
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'platform_admin'
  )
);

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  initials TEXT;
BEGIN
  -- Get initials from full_name or use 'CC' as default
  IF NEW.full_name IS NOT NULL AND NEW.full_name != '' THEN
    initials := UPPER(SUBSTRING(SPLIT_PART(NEW.full_name, ' ', 1), 1, 1) || 
                COALESCE(SUBSTRING(SPLIT_PART(NEW.full_name, ' ', 2), 1, 1), ''));
  ELSE
    initials := 'CC';
  END IF;
  
  -- Generate code: CC-XX-XXXXXX (initials + random 6 chars)
  new_code := 'CC-' || initials || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6));
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = new_code) LOOP
    new_code := 'CC-' || initials || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6));
  END LOOP;
  
  NEW.referral_code := new_code;
  RETURN NEW;
END;
$$;

-- Apply referral code on profile creation (only if not set)
CREATE OR REPLACE TRIGGER generate_referral_code_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
WHEN (NEW.referral_code IS NULL)
EXECUTE FUNCTION public.generate_referral_code();

-- Update existing profiles to have referral codes
UPDATE public.profiles
SET referral_code = 'CC-' || 
  UPPER(COALESCE(SUBSTRING(SPLIT_PART(full_name, ' ', 1), 1, 1), 'C')) ||
  COALESCE(UPPER(SUBSTRING(SPLIT_PART(full_name, ' ', 2), 1, 1)), 'C') ||
  '-' || UPPER(SUBSTR(MD5(id::TEXT || RANDOM()::TEXT), 1, 6))
WHERE referral_code IS NULL;