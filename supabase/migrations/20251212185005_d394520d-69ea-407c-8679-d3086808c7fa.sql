-- Create rate_limits table for tracking API request rates
CREATE TABLE public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for efficient rate limit queries
CREATE INDEX idx_rate_limits_key_timestamp ON public.rate_limits(key, timestamp);
CREATE INDEX idx_rate_limits_timestamp ON public.rate_limits(timestamp);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage rate limits (edge functions use service role)
CREATE POLICY "Service role can manage rate limits"
ON public.rate_limits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create a function to clean up old rate limit entries (call periodically)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE timestamp < now() - INTERVAL '1 hour';
END;
$$;