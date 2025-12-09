-- Create employment type enum
CREATE TYPE public.employment_type AS ENUM ('commission_only', 'salary');

-- Create application status enum
CREATE TYPE public.application_status AS ENUM ('applied', 'shortlisted', 'interviewing', 'hired', 'rejected');

-- Create jobs table
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  employment_type employment_type NOT NULL DEFAULT 'commission_only',
  commission_percentage NUMERIC(5,2),
  salary_amount NUMERIC(10,2),
  requirements TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create job applications table
CREATE TABLE public.job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status application_status NOT NULL DEFAULT 'applied',
  cover_letter TEXT,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, user_id)
);

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Jobs RLS Policies
-- Everyone can view active jobs
CREATE POLICY "Anyone can view active jobs"
ON public.jobs
FOR SELECT
USING (is_active = true);

-- Agency owners can view all their jobs (including inactive)
CREATE POLICY "Agency owners can view all their jobs"
ON public.jobs
FOR SELECT
USING (is_workspace_owner(auth.uid(), workspace_id));

-- Agency owners can create jobs for their workspaces
CREATE POLICY "Agency owners can create jobs"
ON public.jobs
FOR INSERT
WITH CHECK (is_workspace_owner(auth.uid(), workspace_id));

-- Agency owners can update their jobs
CREATE POLICY "Agency owners can update their jobs"
ON public.jobs
FOR UPDATE
USING (is_workspace_owner(auth.uid(), workspace_id));

-- Agency owners can delete their jobs
CREATE POLICY "Agency owners can delete their jobs"
ON public.jobs
FOR DELETE
USING (is_workspace_owner(auth.uid(), workspace_id));

-- Platform admins can view all jobs
CREATE POLICY "Platform admins can view all jobs"
ON public.jobs
FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'));

-- Job Applications RLS Policies
-- SDRs can view their own applications
CREATE POLICY "SDRs can view their own applications"
ON public.job_applications
FOR SELECT
USING (user_id = auth.uid());

-- SDRs can create applications
CREATE POLICY "SDRs can apply to jobs"
ON public.job_applications
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Agency owners can view applications for their jobs
CREATE POLICY "Agency owners can view applications for their jobs"
ON public.job_applications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_id AND is_workspace_owner(auth.uid(), j.workspace_id)
  )
);

-- Agency owners can update application status for their jobs
CREATE POLICY "Agency owners can update application status"
ON public.job_applications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_id AND is_workspace_owner(auth.uid(), j.workspace_id)
  )
);

-- Platform admins can view all applications
CREATE POLICY "Platform admins can view all applications"
ON public.job_applications
FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'));

-- Create trigger for jobs updated_at
CREATE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for applications updated_at
CREATE TRIGGER update_job_applications_updated_at
BEFORE UPDATE ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();