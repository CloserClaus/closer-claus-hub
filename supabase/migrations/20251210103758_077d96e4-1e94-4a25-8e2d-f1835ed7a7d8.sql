-- Add assigned_to column to workspace_phone_numbers to track SDR assignments
ALTER TABLE public.workspace_phone_numbers 
ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add city column to store location info
ALTER TABLE public.workspace_phone_numbers 
ADD COLUMN city text;