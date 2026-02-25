
-- Create page_views table
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text NOT NULL,
  path text NOT NULL,
  referrer text,
  user_agent text,
  screen_width integer,
  screen_height integer,
  language text,
  timezone text,
  country text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create active_sessions table
CREATE TABLE public.active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text NOT NULL UNIQUE,
  current_path text NOT NULL,
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NOT NULL DEFAULT now(),
  country text,
  city text
);

-- Enable RLS
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- page_views policies
CREATE POLICY "Service role can manage page_views"
  ON public.page_views FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY "Platform admins can view page_views"
  ON public.page_views FOR SELECT
  USING (has_role(auth.uid(), 'platform_admin'));

-- active_sessions policies
CREATE POLICY "Service role can manage active_sessions"
  ON public.active_sessions FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY "Platform admins can view active_sessions"
  ON public.active_sessions FOR SELECT
  USING (has_role(auth.uid(), 'platform_admin'));

-- Cleanup function for stale sessions
CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.active_sessions WHERE last_seen_at < now() - INTERVAL '2 minutes';
END;
$$;

-- Index for performance
CREATE INDEX idx_page_views_created_at ON public.page_views (created_at DESC);
CREATE INDEX idx_page_views_path ON public.page_views (path);
CREATE INDEX idx_active_sessions_last_seen ON public.active_sessions (last_seen_at);
