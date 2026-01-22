-- Fix function search path warnings

-- Fix is_lead_stale function
CREATE OR REPLACE FUNCTION public.is_lead_stale(last_updated timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT last_updated < (now() - interval '12 months')
$$;

-- Fix normalize_linkedin_url function
CREATE OR REPLACE FUNCTION public.normalize_linkedin_url(url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  normalized text;
BEGIN
  IF url IS NULL OR url = '' THEN
    RETURN NULL;
  END IF;
  
  normalized := lower(url);
  normalized := regexp_replace(normalized, '^https?://', '');
  normalized := regexp_replace(normalized, '^www\.', '');
  normalized := regexp_replace(normalized, '/$', '');
  normalized := regexp_replace(normalized, '\?.*$', '');
  
  RETURN normalized;
END;
$$;

-- Fix normalize_linkedin_url_trigger function
CREATE OR REPLACE FUNCTION public.normalize_linkedin_url_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.linkedin_url IS NOT NULL AND NEW.linkedin_url != '' THEN
    NEW.linkedin_url := normalize_linkedin_url(NEW.linkedin_url);
  END IF;
  RETURN NEW;
END;
$$;