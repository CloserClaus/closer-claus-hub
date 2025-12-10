-- Fix search_path for immutable functions
CREATE OR REPLACE FUNCTION public.calculate_sdr_level(total_value numeric)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN total_value >= 100000 THEN 3
    WHEN total_value >= 30000 THEN 2
    ELSE 1
  END
$$;

CREATE OR REPLACE FUNCTION public.get_platform_cut_percentage(level integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN level >= 3 THEN 5
    WHEN level = 2 THEN 10
    ELSE 15
  END
$$;