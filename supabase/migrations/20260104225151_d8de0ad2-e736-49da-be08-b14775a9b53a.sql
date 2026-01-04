-- Create table for saved power dialer sequences
CREATE TABLE public.dialer_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lead_ids UUID[] NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dialer_sequences ENABLE ROW LEVEL SECURITY;

-- Policies for workspace access
CREATE POLICY "Users can view sequences in their workspace"
ON public.dialer_sequences
FOR SELECT
USING (
  is_workspace_owner(auth.uid(), workspace_id) 
  OR is_workspace_member(auth.uid(), workspace_id)
);

CREATE POLICY "Users can create sequences in their workspace"
ON public.dialer_sequences
FOR INSERT
WITH CHECK (
  is_workspace_owner(auth.uid(), workspace_id) 
  OR is_workspace_member(auth.uid(), workspace_id)
);

CREATE POLICY "Users can update their own sequences"
ON public.dialer_sequences
FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own sequences"
ON public.dialer_sequences
FOR DELETE
USING (created_by = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_dialer_sequences_updated_at
BEFORE UPDATE ON public.dialer_sequences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();