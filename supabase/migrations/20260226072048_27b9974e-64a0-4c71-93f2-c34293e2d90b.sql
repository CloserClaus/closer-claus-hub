
-- Email providers (workspace-level provider connections)
CREATE TABLE public.email_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider_type text NOT NULL CHECK (provider_type IN ('gmail', 'instantly', 'smartlead', 'lemlist', 'other')),
  provider_name text,
  api_key text,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  last_validated_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Email inboxes (individual sending addresses under a provider)
CREATE TABLE public.email_inboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.email_providers(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email_address text NOT NULL,
  external_inbox_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'paused')),
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Email audit log
CREATE TABLE public.email_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  actor_id uuid,
  inbox_id uuid REFERENCES public.email_inboxes(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES public.email_providers(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  sequence_id uuid REFERENCES public.follow_up_sequences(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add sender locking to active_follow_ups
ALTER TABLE public.active_follow_ups 
  ADD COLUMN IF NOT EXISTS sender_inbox_id uuid REFERENCES public.email_inboxes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sender_provider_id uuid REFERENCES public.email_providers(id) ON DELETE SET NULL;

-- Add email sending state to leads
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS email_sending_state text NOT NULL DEFAULT 'idle';

-- Add inbox_id to email_logs for tracking
ALTER TABLE public.email_logs 
  ADD COLUMN IF NOT EXISTS inbox_id uuid REFERENCES public.email_inboxes(id) ON DELETE SET NULL;

-- Updated_at triggers
CREATE TRIGGER update_email_providers_updated_at BEFORE UPDATE ON public.email_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_inboxes_updated_at BEFORE UPDATE ON public.email_inboxes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.email_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_inboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies for email_providers
CREATE POLICY "Workspace owners can manage providers" ON public.email_providers
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can view providers" ON public.email_providers
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- Policies for email_inboxes
CREATE POLICY "Workspace owners can manage inboxes" ON public.email_inboxes
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "Members can view inboxes" ON public.email_inboxes
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id) OR public.is_workspace_owner(auth.uid(), workspace_id));

-- Policies for email_audit_log
CREATE POLICY "Workspace owners can view audit log" ON public.email_audit_log
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "Members can insert audit entries" ON public.email_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(auth.uid(), workspace_id) OR public.is_workspace_owner(auth.uid(), workspace_id)
  );

CREATE POLICY "Members can view own audit entries" ON public.email_audit_log
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid());
