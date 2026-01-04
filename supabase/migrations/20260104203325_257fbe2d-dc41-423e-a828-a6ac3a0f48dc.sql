-- Add subscription anchor day to track when subscription renews each month
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS subscription_anchor_day INTEGER DEFAULT 1;

-- Add stripe_session_id to credit_purchases for tracking Stripe payments
ALTER TABLE credit_purchases ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- Create index for faster lookups on stripe_session_id
CREATE INDEX IF NOT EXISTS idx_credit_purchases_stripe_session ON credit_purchases(stripe_session_id);

-- Update the reset_free_minutes function to be more robust
CREATE OR REPLACE FUNCTION public.reset_free_minutes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Reset free minutes for workspaces where the reset date has passed
  -- and they have an active subscription
  UPDATE workspace_credits wc
  SET 
    free_minutes_remaining = 1000,
    free_minutes_reset_at = CASE 
      WHEN w.subscription_anchor_day IS NOT NULL THEN
        -- Calculate next month's reset date based on subscription anchor
        (date_trunc('month', now()) + interval '1 month' + (w.subscription_anchor_day - 1) * interval '1 day')::timestamptz
      ELSE
        -- Fallback to 1st of next month
        date_trunc('month', now()) + interval '1 month'
    END,
    updated_at = now()
  FROM workspaces w
  WHERE wc.workspace_id = w.id
    AND wc.free_minutes_reset_at <= now()
    AND w.subscription_status = 'active';
END;
$$;