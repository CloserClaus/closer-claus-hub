
-- Email connections per user per workspace
CREATE TABLE public.email_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('gmail', 'instantly', 'smartlead', 'lemlist', 'other')),
  provider_name text,
  api_key text,
  gmail_refresh_token text,
  gmail_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own email connections"
  ON public.email_connections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Email templates
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view email templates"
  ON public.email_templates FOR SELECT
  USING (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can manage their own templates"
  ON public.email_templates FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Email logs
CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  sent_by uuid NOT NULL,
  provider text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  sequence_id uuid,
  sequence_step integer,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view email logs"
  ON public.email_logs FOR SELECT
  USING (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can create email logs"
  ON public.email_logs FOR INSERT
  WITH CHECK (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id));

-- Follow-up sequences
CREATE TABLE public.follow_up_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.follow_up_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view sequences"
  ON public.follow_up_sequences FOR SELECT
  USING (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can manage their own sequences"
  ON public.follow_up_sequences FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Sequence steps
CREATE TABLE public.follow_up_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.follow_up_sequences(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  delay_days integer NOT NULL DEFAULT 0,
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.follow_up_sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view steps of accessible sequences"
  ON public.follow_up_sequence_steps FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.follow_up_sequences fs
    WHERE fs.id = follow_up_sequence_steps.sequence_id
    AND (is_workspace_owner(auth.uid(), fs.workspace_id) OR is_workspace_member(auth.uid(), fs.workspace_id))
  ));

CREATE POLICY "Users can manage steps of their sequences"
  ON public.follow_up_sequence_steps FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.follow_up_sequences fs
    WHERE fs.id = follow_up_sequence_steps.sequence_id AND fs.created_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.follow_up_sequences fs
    WHERE fs.id = follow_up_sequence_steps.sequence_id AND fs.created_by = auth.uid()
  ));

-- Active follow-ups (running sequences for leads)
CREATE TABLE public.active_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES public.follow_up_sequences(id) ON DELETE CASCADE,
  started_by uuid NOT NULL,
  current_step integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  next_send_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.active_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view active follow-ups"
  ON public.active_follow_ups FOR SELECT
  USING (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can manage active follow-ups"
  ON public.active_follow_ups FOR ALL
  USING (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_owner(auth.uid(), workspace_id) OR is_workspace_member(auth.uid(), workspace_id));

-- Insert default email templates (system-wide, workspace_id will be set per workspace)
-- We'll seed these via the application code instead
