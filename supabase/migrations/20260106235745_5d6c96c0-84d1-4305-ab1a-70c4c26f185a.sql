-- Create ticket_replies table for admin responses
CREATE TABLE public.ticket_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

-- RLS policies for ticket_replies
CREATE POLICY "Platform admins can manage all ticket replies" 
ON public.ticket_replies 
FOR ALL 
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
);

CREATE POLICY "Users can view replies to their tickets" 
ON public.ticket_replies 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets 
    WHERE id = ticket_replies.ticket_id AND user_id = auth.uid()
  )
);

-- Add progress_percentage to feature_requests for roadmap tracking
ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0;

-- Create feature_followers table for users to follow features
CREATE TABLE public.feature_followers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_id UUID NOT NULL REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(feature_id, user_id)
);

-- Enable RLS
ALTER TABLE public.feature_followers ENABLE ROW LEVEL SECURITY;

-- RLS policies for feature_followers
CREATE POLICY "Users can manage their own follows"
ON public.feature_followers
FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view follow counts"
ON public.feature_followers
FOR SELECT
USING (true);