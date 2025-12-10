-- Create coupons table for discount codes
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_percentage INTEGER NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage coupons
CREATE POLICY "Platform admins can manage coupons"
ON public.coupons
FOR ALL
USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Anyone can read active coupons (for validation)
CREATE POLICY "Anyone can read active coupons"
ON public.coupons
FOR SELECT
USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));

-- Create coupon_redemptions table to track usage
CREATE TABLE public.coupon_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  discount_applied NUMERIC NOT NULL,
  UNIQUE(coupon_id, workspace_id)
);

-- Enable RLS
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all redemptions
CREATE POLICY "Platform admins can view redemptions"
ON public.coupon_redemptions
FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Users can insert their own redemptions
CREATE POLICY "Users can redeem coupons"
ON public.coupon_redemptions
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()
));

-- Trigger to update coupon usage count
CREATE OR REPLACE FUNCTION public.increment_coupon_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.coupons
  SET current_uses = current_uses + 1, updated_at = now()
  WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_coupon_redeemed
  AFTER INSERT ON public.coupon_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.increment_coupon_usage();

-- Add subscription_status to workspaces if not exists
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'pending';

-- Create index for faster lookups
CREATE INDEX idx_coupons_code ON public.coupons(code);
CREATE INDEX idx_workspaces_subscription_status ON public.workspaces(subscription_status);