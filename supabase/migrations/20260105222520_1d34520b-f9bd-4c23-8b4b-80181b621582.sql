-- Add column to store saved payment method for automatic charging
ALTER TABLE public.workspaces 
ADD COLUMN IF NOT EXISTS stripe_default_payment_method text;