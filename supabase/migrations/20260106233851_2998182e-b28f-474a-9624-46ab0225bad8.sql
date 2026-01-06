
-- Create bug_reports table
CREATE TABLE public.bug_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_role TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feature_requests table
CREATE TABLE public.feature_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_role TEXT NOT NULL,
  target_audience TEXT NOT NULL DEFAULT 'all',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  upvotes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feature_upvotes table
CREATE TABLE public.feature_upvotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_id UUID NOT NULL REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(feature_id, user_id)
);

-- Enable RLS
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_upvotes ENABLE ROW LEVEL SECURITY;

-- Bug reports policies
CREATE POLICY "Users can view their own bug reports" ON public.bug_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create bug reports" ON public.bug_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all bug reports" ON public.bug_reports FOR SELECT USING (public.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "Admins can update bug reports" ON public.bug_reports FOR UPDATE USING (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- Feature requests policies
CREATE POLICY "All users can view feature requests" ON public.feature_requests FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create feature requests" ON public.feature_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update feature requests" ON public.feature_requests FOR UPDATE USING (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- Feature upvotes policies
CREATE POLICY "Users can view all upvotes" ON public.feature_upvotes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can upvote" ON public.feature_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their upvote" ON public.feature_upvotes FOR DELETE USING (auth.uid() = user_id);

-- Function to update upvotes count
CREATE OR REPLACE FUNCTION public.update_feature_upvotes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feature_requests SET upvotes_count = upvotes_count + 1, updated_at = now() WHERE id = NEW.feature_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feature_requests SET upvotes_count = upvotes_count - 1, updated_at = now() WHERE id = OLD.feature_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for upvotes count
CREATE TRIGGER update_upvotes_count
AFTER INSERT OR DELETE ON public.feature_upvotes
FOR EACH ROW EXECUTE FUNCTION public.update_feature_upvotes_count();

-- Trigger for updated_at
CREATE TRIGGER update_bug_reports_updated_at
BEFORE UPDATE ON public.bug_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feature_requests_updated_at
BEFORE UPDATE ON public.feature_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
