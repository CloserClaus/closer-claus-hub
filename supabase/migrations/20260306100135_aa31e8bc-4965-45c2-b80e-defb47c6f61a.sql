
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS subscription_due_date timestamptz;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS grace_period_end timestamptz;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS skip_two_month_minimum boolean NOT NULL DEFAULT false;
