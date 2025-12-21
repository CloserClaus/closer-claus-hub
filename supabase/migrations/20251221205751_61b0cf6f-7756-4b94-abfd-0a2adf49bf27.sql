-- Add Twilio-specific columns to call_logs table
ALTER TABLE public.call_logs 
ADD COLUMN IF NOT EXISTS twilio_call_sid text;

-- Add Twilio-specific columns to workspace_phone_numbers table
ALTER TABLE public.workspace_phone_numbers 
ADD COLUMN IF NOT EXISTS twilio_phone_sid text;

-- Create index for faster lookups by Twilio call SID
CREATE INDEX IF NOT EXISTS idx_call_logs_twilio_call_sid ON public.call_logs(twilio_call_sid);

-- Create index for faster lookups by Twilio phone SID
CREATE INDEX IF NOT EXISTS idx_workspace_phone_numbers_twilio_phone_sid ON public.workspace_phone_numbers(twilio_phone_sid);