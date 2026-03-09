
CREATE TABLE IF NOT EXISTS public.sdr_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  country text NOT NULL,
  experience text NOT NULL,
  resume_text text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.sdr_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit application" ON public.sdr_applications;
CREATE POLICY "Anyone can submit application"
  ON public.sdr_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Platform admins can view applications" ON public.sdr_applications;
CREATE POLICY "Platform admins can view applications"
  ON public.sdr_applications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'));

DROP POLICY IF EXISTS "Platform admins can update applications" ON public.sdr_applications;
CREATE POLICY "Platform admins can update applications"
  ON public.sdr_applications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'));
