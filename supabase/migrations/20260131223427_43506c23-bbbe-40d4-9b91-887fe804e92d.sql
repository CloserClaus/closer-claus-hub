-- Create table for offer diagnostic lead magnet submissions
CREATE TABLE public.offer_diagnostic_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT,
  email TEXT NOT NULL,
  source TEXT DEFAULT 'offer_diagnostic_lead_magnet',
  alignment_score INTEGER,
  readiness_label TEXT,
  primary_bottleneck TEXT,
  latent_scores JSONB,
  form_data JSONB,
  recommendations_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.offer_diagnostic_leads ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (for unauthenticated users submitting the form)
CREATE POLICY "Allow public insert for lead magnet" 
ON public.offer_diagnostic_leads 
FOR INSERT 
WITH CHECK (true);

-- Only allow admins to select/update
CREATE POLICY "Admins can view leads" 
ON public.offer_diagnostic_leads 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
  )
);

-- Create index on email for quick lookups
CREATE INDEX idx_offer_diagnostic_leads_email ON public.offer_diagnostic_leads(email);

-- Create index on created_at for sorting
CREATE INDEX idx_offer_diagnostic_leads_created_at ON public.offer_diagnostic_leads(created_at DESC);