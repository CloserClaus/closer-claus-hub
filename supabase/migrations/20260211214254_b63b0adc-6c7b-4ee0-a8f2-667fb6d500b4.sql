ALTER TABLE public.call_logs 
  ADD COLUMN direction text NOT NULL DEFAULT 'outbound';

UPDATE public.call_logs 
  SET direction = 'inbound' 
  WHERE notes LIKE 'Inbound call%';