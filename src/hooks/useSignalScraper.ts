import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';

// ── Legacy flat plan format ──
export interface SignalPlanItem {
  signal_name: string;
  source: string;
  search_query: string;
  search_params: Record<string, any>;
  fields_to_collect: string[];
  filters: { field: string; operator: string; value: string }[];
  ai_classification: string | null;
  estimated_rows: number;
  estimated_leads_after_filter: number;
}

// ── New pipeline format ──
export interface PipelineStage {
  stage: number;
  name: string;
  type: 'scrape' | 'ai_filter';
  actors?: string[];
  params_per_actor?: Record<string, any>;
  input_from?: string | null;
  search_titles?: string[];
  dedup_after?: boolean;
  updates_fields?: string[];
  search_query?: string;
  expected_output_count?: number;
  prompt?: string;
  input_fields?: string[];
  expected_pass_rate?: number;
}

export interface PipelinePlan {
  signal_name: string;
  pipeline: PipelineStage[];
}

// SignalPlan can be legacy flat array or new pipeline format
export type SignalPlan = SignalPlanItem | SignalPlanItem[] | PipelinePlan;

export interface StageFunnelItem {
  stage: number;
  name: string;
  estimated_count: number;
}

export interface SignalEstimation {
  estimated_rows: number;
  estimated_leads: number;
  credits_to_charge: number;
  cost_per_lead: string;
  source_label: string;
  stage_funnel?: StageFunnelItem[];
  yield_rate?: number;
  yield_label?: string;
  yield_guidance?: string;
}

export interface SignalRun {
  id: string;
  signal_name: string | null;
  signal_query: string;
  signal_plan: SignalPlan | null;
  estimated_cost: number;
  actual_cost: number | null;
  estimated_leads: number | null;
  leads_discovered: number;
  status: string;
  schedule_type: string;
  last_run_at: string | null;
  created_at: string;
  started_at: string | null;
  retry_count: number;
  error_message: string | null;
  processing_phase: string | null;
  collected_dataset_index: number | null;
  current_pipeline_stage: number;
  pipeline_stage_count: number;
}

export interface SignalLead {
  id: string;
  company_name: string | null;
  website: string | null;
  domain: string | null;
  phone: string | null;
  email: string | null;
  linkedin: string | null;
  location: string | null;
  source: string | null;
  added_to_crm: boolean;
  enriched: boolean;
  discovered_at: string;
  contact_name: string | null;
  title: string | null;
  industry: string | null;
  employee_count: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pipeline_stage: string | null;
  website_content: string | null;
  linkedin_profile_url: string | null;
  company_linkedin_url: string | null;
}

// ── Helpers ──

export function isPipelinePlan(plan: SignalPlan | null): plan is PipelinePlan {
  return plan !== null && typeof plan === 'object' && !Array.isArray(plan) && 'pipeline' in plan;
}

export function useSignalScraper() {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentPlan, setCurrentPlan] = useState<{
    run_id: string;
    plan: SignalPlan;
    estimation: SignalEstimation;
    warnings?: string[];
  } | null>(null);

  const { data: signalHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['signal-runs', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from('signal_runs')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SignalRun[];
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: (query) => {
      const runs = query.state.data as SignalRun[] | undefined;
      const hasActive = runs?.some(r => r.status === 'queued' || r.status === 'running');
      return hasActive ? 5000 : false;
    },
  });

  const generatePlanMutation = useMutation({
    mutationFn: async (params: { query: string; plan_override?: any; advanced_settings?: any } | string) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');
      const query = typeof params === 'string' ? params : params.query;
      const plan_override = typeof params === 'string' ? undefined : params.plan_override;
      const advanced_settings = typeof params === 'string' ? undefined : params.advanced_settings;
      const { data, error } = await supabase.functions.invoke('signal-planner', {
        body: { action: 'generate_plan', query, workspace_id: currentWorkspace.id, plan_override, advanced_settings },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setCurrentPlan(data);
      toast({ title: 'Signal Plan Generated', description: `Source: ${data.estimation.source_label}` });
    },
    onError: (error: any) => {
      toast({ title: 'Plan Generation Failed', description: error.message, variant: 'destructive' });
    },
  });

  const executeSignalMutation = useMutation({
    mutationFn: async (params: { run_id: string; schedule_type: string; schedule_hour?: number }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');
      const { data, error } = await supabase.functions.invoke('signal-planner', {
        body: { action: 'execute_signal', workspace_id: currentWorkspace.id, ...params },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data?.status === 'queued' || data?.status === 'running') {
        toast({ title: 'Signal Queued', description: 'Your signal is in the queue. Results will appear shortly.' });
      } else {
        toast({ title: 'Signal Complete!', description: `${data.leads_discovered} leads discovered. ${data.credits_charged} credits charged.` });
      }
      queryClient.invalidateQueries({ queryKey: ['signal-runs'] });
      queryClient.invalidateQueries({ queryKey: ['lead-credits'] });
      queryClient.invalidateQueries({ queryKey: ['signal-leads'] });
      setCurrentPlan(null);
    },
    onError: (error: any) => {
      toast({ title: 'Signal Execution Failed', description: error.message, variant: 'destructive' });
      queryClient.invalidateQueries({ queryKey: ['signal-runs'] });
    },
  });

  const useSignalLeads = (runId: string | null) => {
    return useQuery({
      queryKey: ['signal-leads', runId],
      queryFn: async () => {
        if (!runId) return [];
        const { data, error } = await supabase
          .from('signal_leads')
          .select('*')
          .eq('run_id', runId)
          .order('discovered_at', { ascending: false })
          .limit(10000);
        if (error) throw error;
        return (data || []) as SignalLead[];
      },
      enabled: !!runId,
    });
  };

  const deleteSignalMutation = useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase.from('signal_runs').delete().eq('id', runId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Signal deleted' });
      queryClient.invalidateQueries({ queryKey: ['signal-runs'] });
    },
  });

  return {
    currentPlan,
    setCurrentPlan,
    signalHistory,
    historyLoading,
    generatePlan: generatePlanMutation.mutate,
    isGenerating: generatePlanMutation.isPending,
    executeSignal: executeSignalMutation.mutate,
    isExecuting: executeSignalMutation.isPending,
    useSignalLeads,
    deleteSignal: deleteSignalMutation.mutate,
  };
}
