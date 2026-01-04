-- Add first_subscription_at to track first-time subscribers
ALTER TABLE public.workspaces 
ADD COLUMN first_subscription_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.workspaces.first_subscription_at IS 'Timestamp of first successful subscription activation. Used to determine if 2-month minimum applies.';