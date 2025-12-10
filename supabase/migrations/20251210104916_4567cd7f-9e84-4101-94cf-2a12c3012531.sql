-- Add recording_url column to call_logs table
ALTER TABLE public.call_logs ADD COLUMN recording_url text;

-- Create storage bucket for call recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for call recordings bucket
CREATE POLICY "Workspace members can upload recordings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'call-recordings' AND
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.user_id = auth.uid()
    AND wm.removed_at IS NULL
  )
);

CREATE POLICY "Workspace members can view their recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'call-recordings' AND
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.user_id = auth.uid()
    AND wm.removed_at IS NULL
  )
);

CREATE POLICY "Workspace owners can view all recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'call-recordings' AND
  EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.owner_id = auth.uid()
  )
);