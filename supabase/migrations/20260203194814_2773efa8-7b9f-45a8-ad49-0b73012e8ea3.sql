-- Add disposition and tags columns to call_logs table for better call tracking
ALTER TABLE public.call_logs
ADD COLUMN IF NOT EXISTS disposition text,
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create index on disposition for analytics queries
CREATE INDEX IF NOT EXISTS idx_call_logs_disposition ON public.call_logs(disposition);

-- Add comment for documentation
COMMENT ON COLUMN public.call_logs.disposition IS 'Call outcome classification: interested, not_interested, callback, meeting_booked, wrong_number, gatekeeper, left_voicemail, no_answer';
COMMENT ON COLUMN public.call_logs.tags IS 'User-defined tags for categorizing calls';