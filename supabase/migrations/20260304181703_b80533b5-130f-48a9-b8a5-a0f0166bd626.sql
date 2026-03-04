
-- Signal runs table
CREATE TABLE public.signal_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) NOT NULL,
  signal_name TEXT,
  signal_query TEXT NOT NULL,
  signal_plan JSONB,
  estimated_cost INTEGER NOT NULL DEFAULT 0,
  actual_cost INTEGER,
  estimated_leads INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  schedule_type TEXT NOT NULL DEFAULT 'once',
  schedule_hour INTEGER,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  leads_discovered INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Signal leads table
CREATE TABLE public.signal_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES public.signal_runs(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) NOT NULL,
  company_name TEXT,
  website TEXT,
  domain TEXT,
  phone TEXT,
  linkedin TEXT,
  location TEXT,
  source TEXT,
  extra_data JSONB,
  added_to_crm BOOLEAN NOT NULL DEFAULT false,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deduplication keys table
CREATE TABLE public.signal_dedup_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) NOT NULL,
  dedup_key TEXT NOT NULL,
  dedup_type TEXT NOT NULL,
  signal_lead_id UUID REFERENCES public.signal_leads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, dedup_key, dedup_type)
);

-- Dataset cache table
CREATE TABLE public.signal_dataset_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  dataset JSONB,
  row_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(query_hash, source)
);

-- Enable RLS
ALTER TABLE public.signal_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_dedup_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_dataset_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies for signal_runs
CREATE POLICY "Users can view own workspace signal runs"
  ON public.signal_runs FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(auth.uid(), workspace_id)
    OR public.is_workspace_member(auth.uid(), workspace_id)
  );

CREATE POLICY "Users can insert signal runs in own workspace"
  ON public.signal_runs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own signal runs"
  ON public.signal_runs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own signal runs"
  ON public.signal_runs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- RLS policies for signal_leads
CREATE POLICY "Users can view own workspace signal leads"
  ON public.signal_leads FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(auth.uid(), workspace_id)
    OR public.is_workspace_member(auth.uid(), workspace_id)
  );

CREATE POLICY "Service role can insert signal leads"
  ON public.signal_leads FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_owner(auth.uid(), workspace_id)
    OR public.is_workspace_member(auth.uid(), workspace_id)
  );

-- RLS policies for signal_dedup_keys
CREATE POLICY "Users can view own workspace dedup keys"
  ON public.signal_dedup_keys FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(auth.uid(), workspace_id)
    OR public.is_workspace_member(auth.uid(), workspace_id)
  );

CREATE POLICY "Users can insert dedup keys"
  ON public.signal_dedup_keys FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_owner(auth.uid(), workspace_id)
    OR public.is_workspace_member(auth.uid(), workspace_id)
  );

-- Dataset cache is readable by all authenticated (shared cache)
CREATE POLICY "Authenticated users can read cache"
  ON public.signal_dataset_cache FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cache"
  ON public.signal_dataset_cache FOR INSERT TO authenticated
  WITH CHECK (true);

-- Updated_at trigger for signal_runs
CREATE TRIGGER update_signal_runs_updated_at
  BEFORE UPDATE ON public.signal_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
