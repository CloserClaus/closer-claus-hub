-- Create tasks table for CRM follow-ups and reminders
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  assigned_to UUID NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
  completed_at TIMESTAMP WITH TIME ZONE,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Platform admins can view all tasks"
ON public.tasks FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Workspace members can view tasks"
ON public.tasks FOR SELECT
USING (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can create tasks"
ON public.tasks FOR INSERT
WITH CHECK (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can update tasks"
ON public.tasks FOR UPDATE
USING (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace owners can delete tasks"
ON public.tasks FOR DELETE
USING (is_workspace_owner(auth.uid(), workspace_id));

-- Create index for efficient querying
CREATE INDEX idx_tasks_workspace_id ON public.tasks(workspace_id);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_status ON public.tasks(status);

-- Trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();