-- Create support_tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS policies for support_tickets
CREATE POLICY "Users can create support tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own tickets"
ON public.support_tickets
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Platform admins can view all tickets"
ON public.support_tickets
FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins can update tickets"
ON public.support_tickets
FOR UPDATE
USING (has_role(auth.uid(), 'platform_admin'));

-- Add attachment_urls to bug_reports
ALTER TABLE public.bug_reports
ADD COLUMN attachment_urls TEXT[] DEFAULT '{}';

-- Create storage bucket for bug attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-attachments', 'bug-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for bug-attachments bucket
CREATE POLICY "Authenticated users can upload bug attachments"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'bug-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view bug attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'bug-attachments');

CREATE POLICY "Users can delete their own attachments"
ON storage.objects
FOR DELETE
USING (bucket_id = 'bug-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger for updated_at on support_tickets
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();