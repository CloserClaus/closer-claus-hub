
-- Add delivery control columns to email_inboxes
ALTER TABLE public.email_inboxes 
  ADD COLUMN IF NOT EXISTS daily_send_limit integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS warmup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sends_today integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sends_today_reset_at timestamptz NOT NULL DEFAULT (date_trunc('day', now()) + interval '1 day');

-- Create workspace-level email campaign settings
CREATE TABLE IF NOT EXISTS public.email_campaign_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
  default_daily_send_limit integer NOT NULL DEFAULT 50,
  sending_window_start time NOT NULL DEFAULT '08:00',
  sending_window_end time NOT NULL DEFAULT '18:00',
  sending_timezone text NOT NULL DEFAULT 'America/New_York',
  random_delay_min_seconds integer NOT NULL DEFAULT 45,
  random_delay_max_seconds integer NOT NULL DEFAULT 120,
  max_concurrent_sends integer NOT NULL DEFAULT 3,
  bounce_threshold_percent numeric NOT NULL DEFAULT 5.0,
  auto_pause_on_bounce_threshold boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_campaign_settings ENABLE ROW LEVEL SECURITY;

-- Owners can manage settings
CREATE POLICY "Workspace owners manage email settings"
  ON public.email_campaign_settings
  FOR ALL
  TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id) OR public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.is_workspace_owner(auth.uid(), workspace_id) OR public.has_role(auth.uid(), 'platform_admin'));

-- Members can read settings
CREATE POLICY "Workspace members read email settings"
  ON public.email_campaign_settings
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- Add enhanced fields to follow_up_sequences for campaign features
ALTER TABLE public.follow_up_sequences
  ADD COLUMN IF NOT EXISTS sending_inbox_id uuid REFERENCES public.email_inboxes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sending_window_start time DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS sending_window_end time DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS sending_timezone text DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS random_delay_min_seconds integer DEFAULT 45,
  ADD COLUMN IF NOT EXISTS random_delay_max_seconds integer DEFAULT 120,
  ADD COLUMN IF NOT EXISTS daily_send_cap integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

-- Add error tracking to email_logs
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS error_reason text,
  ADD COLUMN IF NOT EXISTS thread_id text,
  ADD COLUMN IF NOT EXISTS message_id text;

-- Add email_sending_state to leads if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leads' AND column_name='email_sending_state') THEN
    ALTER TABLE public.leads ADD COLUMN email_sending_state text DEFAULT 'idle';
  END IF;
END $$;

-- Create email conversations table for CRM-linked email threads
CREATE TABLE IF NOT EXISTS public.email_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  inbox_id uuid REFERENCES public.email_inboxes(id) ON DELETE SET NULL,
  assigned_to uuid NOT NULL,
  campaign_name text,
  sequence_id uuid REFERENCES public.follow_up_sequences(id) ON DELETE SET NULL,
  thread_id text,
  status text NOT NULL DEFAULT 'active',
  last_message_preview text,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members access email conversations"
  ON public.email_conversations
  FOR ALL
  TO authenticated
  USING (
    public.is_workspace_owner(auth.uid(), workspace_id) 
    OR public.is_workspace_member(auth.uid(), workspace_id)
    OR public.has_role(auth.uid(), 'platform_admin')
  )
  WITH CHECK (
    public.is_workspace_owner(auth.uid(), workspace_id) 
    OR public.is_workspace_member(auth.uid(), workspace_id)
    OR public.has_role(auth.uid(), 'platform_admin')
  );

-- Create email conversation messages table
CREATE TABLE IF NOT EXISTS public.email_conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.email_conversations(id) ON DELETE CASCADE NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  subject text,
  body text NOT NULL,
  sender_email text NOT NULL,
  message_type text NOT NULL DEFAULT 'email',
  gmail_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access conversation messages via conversation"
  ON public.email_conversation_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.email_conversations ec
      WHERE ec.id = conversation_id
      AND (
        public.is_workspace_owner(auth.uid(), ec.workspace_id)
        OR public.is_workspace_member(auth.uid(), ec.workspace_id)
        OR public.has_role(auth.uid(), 'platform_admin')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.email_conversations ec
      WHERE ec.id = conversation_id
      AND (
        public.is_workspace_owner(auth.uid(), ec.workspace_id)
        OR public.is_workspace_member(auth.uid(), ec.workspace_id)
        OR public.has_role(auth.uid(), 'platform_admin')
      )
    )
  );

-- Function to reset daily send counts
CREATE OR REPLACE FUNCTION public.reset_daily_send_counts()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.email_inboxes
  SET sends_today = 0,
      sends_today_reset_at = date_trunc('day', now()) + interval '1 day'
  WHERE sends_today_reset_at <= now();
END;
$$;
