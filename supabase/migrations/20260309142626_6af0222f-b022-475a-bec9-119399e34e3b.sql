ALTER TABLE public.sdr_applications ADD COLUMN resume_url text;

INSERT INTO storage.buckets (id, name, public) VALUES ('sdr-resumes', 'sdr-resumes', true);

CREATE POLICY "Anyone can upload resumes"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'sdr-resumes');

CREATE POLICY "Public read access for resumes"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'sdr-resumes');