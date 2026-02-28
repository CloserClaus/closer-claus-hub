
-- System Events table for the Event Spine
CREATE TABLE public.system_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'system',
  actor_id uuid,
  organization_id uuid,
  object_type text,
  object_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_system_events_event_type ON public.system_events (event_type);
CREATE INDEX idx_system_events_actor_id ON public.system_events (actor_id);
CREATE INDEX idx_system_events_organization_id ON public.system_events (organization_id);
CREATE INDEX idx_system_events_created_at ON public.system_events (created_at DESC);
CREATE INDEX idx_system_events_object_type ON public.system_events (object_type);

-- RLS
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all events
CREATE POLICY "Platform admins can view all events"
  ON public.system_events FOR SELECT
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Service role can insert events (edge functions)
CREATE POLICY "Service role can manage events"
  ON public.system_events FOR ALL
  USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text))
  WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

-- Authenticated users can insert events
CREATE POLICY "Authenticated users can insert events"
  ON public.system_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can view events in their workspace
CREATE POLICY "Workspace members can view events"
  ON public.system_events FOR SELECT
  USING (
    organization_id IS NOT NULL AND (
      is_workspace_owner(auth.uid(), organization_id) OR 
      is_workspace_member(auth.uid(), organization_id)
    )
  );

-- Klaus memory table
CREATE TABLE public.klaus_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  memory_type text NOT NULL,
  memory_key text NOT NULL,
  memory_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, memory_type, memory_key)
);

ALTER TABLE public.klaus_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view klaus memory"
  ON public.klaus_memory FOR SELECT
  USING (
    is_workspace_owner(auth.uid(), organization_id) OR 
    is_workspace_member(auth.uid(), organization_id)
  );

CREATE POLICY "Workspace members can manage klaus memory"
  ON public.klaus_memory FOR ALL
  USING (
    is_workspace_owner(auth.uid(), organization_id) OR 
    is_workspace_member(auth.uid(), organization_id)
  )
  WITH CHECK (
    is_workspace_owner(auth.uid(), organization_id) OR 
    is_workspace_member(auth.uid(), organization_id)
  );

CREATE POLICY "Service role can manage klaus memory"
  ON public.klaus_memory FOR ALL
  USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text))
  WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

-- Klaus conversation history
CREATE TABLE public.klaus_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.klaus_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own conversations"
  ON public.klaus_conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage conversations"
  ON public.klaus_conversations FOR ALL
  USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text))
  WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

CREATE INDEX idx_klaus_conversations_user ON public.klaus_conversations (user_id, created_at DESC);
CREATE INDEX idx_klaus_memory_org ON public.klaus_memory (organization_id);
