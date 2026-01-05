-- Add new columns to jobs table for structured job posting
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS company_description text,
ADD COLUMN IF NOT EXISTS offer_description text,
ADD COLUMN IF NOT EXISTS dream_outcome text,
ADD COLUMN IF NOT EXISTS icp_job_titles text[],
ADD COLUMN IF NOT EXISTS icp_industry text,
ADD COLUMN IF NOT EXISTS icp_company_type text,
ADD COLUMN IF NOT EXISTS icp_company_size_min integer,
ADD COLUMN IF NOT EXISTS icp_company_size_max integer,
ADD COLUMN IF NOT EXISTS icp_revenue_min integer,
ADD COLUMN IF NOT EXISTS icp_revenue_max integer,
ADD COLUMN IF NOT EXISTS icp_founding_year_min integer,
ADD COLUMN IF NOT EXISTS icp_founding_year_max integer,
ADD COLUMN IF NOT EXISTS icp_intent_signal text,
ADD COLUMN IF NOT EXISTS average_ticket_size numeric,
ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'one_time';

-- Add comments for documentation
COMMENT ON COLUMN public.jobs.company_description IS 'Company description, max 500 characters';
COMMENT ON COLUMN public.jobs.offer_description IS 'What the company offers, max 300 characters';
COMMENT ON COLUMN public.jobs.dream_outcome IS 'We help X achieve Y without Z format';
COMMENT ON COLUMN public.jobs.icp_job_titles IS 'Target prospect job titles';
COMMENT ON COLUMN public.jobs.icp_industry IS 'Target industry';
COMMENT ON COLUMN public.jobs.icp_company_type IS 'Type of company (startup, enterprise, etc.)';
COMMENT ON COLUMN public.jobs.icp_company_size_min IS 'Minimum number of employees';
COMMENT ON COLUMN public.jobs.icp_company_size_max IS 'Maximum number of employees';
COMMENT ON COLUMN public.jobs.icp_revenue_min IS 'Minimum annual revenue in thousands';
COMMENT ON COLUMN public.jobs.icp_revenue_max IS 'Maximum annual revenue in thousands';
COMMENT ON COLUMN public.jobs.icp_founding_year_min IS 'Minimum founding year';
COMMENT ON COLUMN public.jobs.icp_founding_year_max IS 'Maximum founding year';
COMMENT ON COLUMN public.jobs.icp_intent_signal IS 'Optional intent signals';
COMMENT ON COLUMN public.jobs.average_ticket_size IS 'Average deal value';
COMMENT ON COLUMN public.jobs.payment_type IS 'recurring or one_time';