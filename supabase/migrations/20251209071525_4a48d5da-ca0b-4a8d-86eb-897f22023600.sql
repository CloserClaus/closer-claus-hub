-- Create training_materials table
CREATE TABLE public.training_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size INTEGER,
  content_type TEXT NOT NULL DEFAULT 'document',
  video_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_materials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workspace owners can manage training materials"
ON public.training_materials FOR ALL
USING (is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can view training materials"
ON public.training_materials FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Platform admins can view all training materials"
ON public.training_materials FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_training_materials_updated_at
  BEFORE UPDATE ON public.training_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for training files
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('training-files', 'training-files', false, 52428800);

-- Storage policies
CREATE POLICY "Workspace owners can upload training files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'training-files' AND
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id::text = (storage.foldername(name))[1]
    AND w.owner_id = auth.uid()
  )
);

CREATE POLICY "Workspace owners can update training files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'training-files' AND
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id::text = (storage.foldername(name))[1]
    AND w.owner_id = auth.uid()
  )
);

CREATE POLICY "Workspace owners can delete training files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'training-files' AND
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id::text = (storage.foldername(name))[1]
    AND w.owner_id = auth.uid()
  )
);

CREATE POLICY "Workspace members can view training files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'training-files' AND
  (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id::text = (storage.foldername(name))[1]
      AND w.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[1]
      AND wm.user_id = auth.uid()
      AND wm.removed_at IS NULL
    )
  )
);

-- Index for faster queries
CREATE INDEX idx_training_materials_workspace ON public.training_materials(workspace_id);