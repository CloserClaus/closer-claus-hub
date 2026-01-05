-- Add pending_leave_at column to workspace_members for 24-hour notice period
ALTER TABLE public.workspace_members 
ADD COLUMN IF NOT EXISTS pending_leave_at timestamptz DEFAULT NULL;