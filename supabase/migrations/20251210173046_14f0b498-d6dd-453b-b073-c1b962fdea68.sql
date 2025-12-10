-- Add email_verified column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- Create email verification tokens table
CREATE TABLE public.email_verification_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  used_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own tokens
CREATE POLICY "Users can view their own tokens"
ON public.email_verification_tokens
FOR SELECT
USING (user_id = auth.uid());

-- Service role can manage all tokens (for edge functions)
CREATE POLICY "Service role can manage tokens"
ON public.email_verification_tokens
FOR ALL
USING (true)
WITH CHECK (true);

-- Create daily_stats table for analytics
CREATE TABLE public.daily_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_date date NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid,
  stat_type text NOT NULL,
  stat_value numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(stat_date, workspace_id, user_id, stat_type)
);

-- Enable RLS on daily_stats
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all stats
CREATE POLICY "Platform admins can view all stats"
ON public.daily_stats
FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Workspace owners can view their workspace stats
CREATE POLICY "Workspace owners can view their stats"
ON public.daily_stats
FOR SELECT
USING (is_workspace_owner(auth.uid(), workspace_id));

-- SDRs can view their own stats
CREATE POLICY "SDRs can view their own stats"
ON public.daily_stats
FOR SELECT
USING (user_id = auth.uid());

-- Service role can insert stats
CREATE POLICY "Service role can insert stats"
ON public.daily_stats
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_daily_stats_date_workspace ON public.daily_stats(stat_date, workspace_id);
CREATE INDEX idx_daily_stats_date_user ON public.daily_stats(stat_date, user_id);