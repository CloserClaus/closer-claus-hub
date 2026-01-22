-- Create master_leads table for centralized enriched lead storage
CREATE TABLE public.master_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_url text UNIQUE NOT NULL,
  apollo_id text,
  first_name text,
  last_name text,
  email text,
  email_status text,
  phone text,
  phone_status text,
  company_name text,
  company_domain text,
  company_linkedin_url text,
  title text,
  seniority text,
  department text,
  city text,
  state text,
  country text,
  industry text,
  employee_count text,
  first_enriched_at timestamptz DEFAULT now(),
  last_updated_at timestamptz DEFAULT now(),
  enrichment_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Create index for fast lookups by LinkedIn URL
CREATE INDEX idx_master_leads_linkedin_url ON public.master_leads(linkedin_url);

-- Create index for alphabetical ordering by name
CREATE INDEX idx_master_leads_name ON public.master_leads(last_name, first_name);

-- Enable Row Level Security
ALTER TABLE public.master_leads ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all master leads
CREATE POLICY "Platform admins can view all master leads"
  ON public.master_leads FOR SELECT
  USING (has_role(auth.uid(), 'platform_admin'));

-- Platform admins can manage master leads
CREATE POLICY "Platform admins can manage master leads"
  ON public.master_leads FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'));