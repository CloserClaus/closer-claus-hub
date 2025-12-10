-- Add SDR level tracking columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS sdr_level integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_deals_closed_value numeric DEFAULT 0;

-- Add platform cut tracking to commissions table
ALTER TABLE public.commissions
ADD COLUMN IF NOT EXISTS platform_cut_percentage numeric DEFAULT 15,
ADD COLUMN IF NOT EXISTS platform_cut_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS sdr_payout_amount numeric DEFAULT 0;

-- Create function to calculate SDR level based on total deals closed
CREATE OR REPLACE FUNCTION public.calculate_sdr_level(total_value numeric)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN total_value >= 100000 THEN 3
    WHEN total_value >= 30000 THEN 2
    ELSE 1
  END
$$;

-- Create function to get platform cut percentage based on level
CREATE OR REPLACE FUNCTION public.get_platform_cut_percentage(level integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN level >= 3 THEN 5
    WHEN level = 2 THEN 10
    ELSE 15
  END
$$;

-- Create trigger function to update SDR level when deals close
CREATE OR REPLACE FUNCTION public.update_sdr_level_on_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deal_value numeric;
  new_total numeric;
  new_level integer;
BEGIN
  -- Get the deal value
  SELECT value INTO deal_value FROM public.deals WHERE id = NEW.deal_id;
  
  -- Update the SDR's total deals closed value
  UPDATE public.profiles
  SET total_deals_closed_value = COALESCE(total_deals_closed_value, 0) + deal_value
  WHERE id = NEW.sdr_id
  RETURNING total_deals_closed_value INTO new_total;
  
  -- Calculate and update the new level
  new_level := calculate_sdr_level(new_total);
  
  UPDATE public.profiles
  SET sdr_level = new_level
  WHERE id = NEW.sdr_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger on commissions table
DROP TRIGGER IF EXISTS update_sdr_level_trigger ON public.commissions;
CREATE TRIGGER update_sdr_level_trigger
AFTER INSERT ON public.commissions
FOR EACH ROW
EXECUTE FUNCTION public.update_sdr_level_on_commission();