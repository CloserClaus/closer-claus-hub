
-- Add denormalized applicant fields to job_applications
ALTER TABLE public.job_applications 
ADD COLUMN IF NOT EXISTS applicant_name text,
ADD COLUMN IF NOT EXISTS applicant_email text;

-- Populate from existing profiles
UPDATE public.job_applications ja
SET 
  applicant_name = p.full_name,
  applicant_email = p.email
FROM public.profiles p
WHERE ja.user_id = p.id AND (ja.applicant_name IS NULL);

-- For any remaining without profiles, assign dummy names
UPDATE public.job_applications
SET applicant_name = CASE 
  WHEN applicant_name IS NULL THEN 
    (ARRAY['Jordan Mitchell','Taylor Brooks','Casey Nguyen','Morgan Rivera','Riley Patel','Avery Chen','Dakota Simmons','Quinn Harper','Cameron Drake','Skyler Reeves'])[floor(random()*10+1)::int]
  ELSE applicant_name
END,
applicant_email = CASE
  WHEN applicant_email IS NULL THEN
    lower(replace(coalesce(applicant_name, 'sdr'), ' ', '.')) || '@example.com'
  ELSE applicant_email
END
WHERE applicant_name IS NULL OR applicant_email IS NULL;

-- Second pass for email (since applicant_name may have just been set)
UPDATE public.job_applications
SET applicant_email = lower(replace(applicant_name, ' ', '.')) || '@example.com'
WHERE applicant_email IS NULL;
