-- Update platform cut percentage function with new rates: 5% L1, 4% L2, 2.5% L3
CREATE OR REPLACE FUNCTION public.get_platform_cut_percentage(level integer)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN level >= 3 THEN 2.5
    WHEN level = 2 THEN 4
    ELSE 5
  END
$function$;

-- Add agency_rake_amount column to commissions table for clarity
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS agency_rake_amount NUMERIC(10,2) DEFAULT 0;