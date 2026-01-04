-- Add free minutes columns to workspace_credits
ALTER TABLE public.workspace_credits 
ADD COLUMN IF NOT EXISTS free_minutes_remaining INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS free_minutes_reset_at TIMESTAMP WITH TIME ZONE DEFAULT (date_trunc('month', now()) + interval '1 month');

-- Create workspace_dialer_features table to track enabled add-on features
CREATE TABLE IF NOT EXISTS public.workspace_dialer_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL, -- 'recording', 'transcription', 'amd', 'voice_insights'
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, feature_type)
);

-- Enable RLS
ALTER TABLE public.workspace_dialer_features ENABLE ROW LEVEL SECURITY;

-- RLS policies for workspace_dialer_features
CREATE POLICY "Workspace members can view dialer features"
ON public.workspace_dialer_features
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_dialer_features.workspace_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Workspace owners can manage dialer features"
ON public.workspace_dialer_features
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = workspace_dialer_features.workspace_id
    AND w.owner_id = auth.uid()
  )
);

-- Create function to reset free minutes monthly
CREATE OR REPLACE FUNCTION public.reset_free_minutes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE workspace_credits
  SET 
    free_minutes_remaining = 1000,
    free_minutes_reset_at = date_trunc('month', now()) + interval '1 month',
    updated_at = now()
  WHERE free_minutes_reset_at <= now();
END;
$$;