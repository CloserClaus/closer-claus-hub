
-- Add run_log JSONB column to signal_runs for debugging visibility
ALTER TABLE public.signal_runs ADD COLUMN IF NOT EXISTS run_log jsonb DEFAULT '[]'::jsonb;

-- Create signal_templates table for pre-built signal configurations
CREATE TABLE IF NOT EXISTS public.signal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  icon text DEFAULT 'Zap',
  query_template text NOT NULL,
  plan_override jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Allow all authenticated users to read templates
ALTER TABLE public.signal_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active templates" ON public.signal_templates FOR SELECT TO authenticated USING (is_active = true);

-- Insert Closer Claus-specific templates
INSERT INTO public.signal_templates (name, description, category, icon, query_template, plan_override, sort_order) VALUES
(
  'Agencies Hiring Sales Reps',
  'Find marketing/digital agencies posting sales or BDR roles — strong purchase intent signal for outsourced sales services.',
  'hiring_intent',
  'Briefcase',
  'Digital marketing agencies hiring sales representatives or business development reps',
  '{"source": "linkedin_jobs", "search_params": {"keyword": "sales representative", "location": "United States", "timePosted": "pastWeek"}, "ai_classification": "Only include results where the hiring company is a marketing agency, digital agency, or advertising agency with fewer than 50 employees. Exclude staffing agencies and large corporations."}'::jsonb,
  1
),
(
  'Small Agencies on Google Maps',
  'Discover small marketing and advertising agencies via Google Maps with contact info ready for outreach.',
  'discovery',
  'MapPin',
  'Marketing agencies and advertising agencies in United States',
  '{"source": "google_maps", "search_params": {}, "ai_classification": "Only include businesses that are clearly marketing agencies, digital agencies, or advertising agencies. Exclude freelancers, print shops, and unrelated businesses."}'::jsonb,
  2
),
(
  'SaaS Startups Hiring Outbound Sales',
  'Find SaaS companies hiring outbound sales — likely need more pipeline and could benefit from sales services.',
  'hiring_intent',
  'Rocket',
  'SaaS startups hiring outbound sales representatives or SDRs',
  '{"source": "linkedin_jobs", "search_params": {"keyword": "outbound sales representative SDR", "location": "United States", "timePosted": "pastWeek"}, "ai_classification": "Only include SaaS or software companies with under 100 employees. Exclude staffing agencies and enterprise companies."}'::jsonb,
  3
);
