import { useState, useRef, useCallback, useEffect } from 'react';
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

// ── Planning progress types ──
export interface PlanStageProgress {
  stage: number;
  name: string;
  type: string;
  status: 'pending' | 'discovering' | 'testing' | 'validated' | 'failed' | 'auto_validated' | 'skipped';
  actor_label?: string;
  chain_warning?: string;
}

export interface PlanningProgress {
  run_id: string;
  status: string;
  phase: string;
  stages: PlanStageProgress[];
  signal_name?: string;
  total_stages?: number;
  test_results?: any[];
  // When validated:
  plan?: any;
  estimation?: SignalEstimation;
  warnings?: string[];
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

  // Planning progress state
  const [planningProgress, setPlanningProgress] = useState<PlanningProgress | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollPlanStatus = useCallback(async (runId: string) => {
    if (!currentWorkspace?.id) return;
    try {
      const { data, error } = await supabase.functions.invoke('signal-planner', {
        body: { action: 'check_plan_status', run_id: runId, workspace_id: currentWorkspace.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const progress: PlanningProgress = {
        run_id: runId,
        status: data.status,
        phase: data.phase,
        stages: data.stages || [],
        signal_name: data.signal_name,
        total_stages: data.total_stages,
        test_results: data.test_results,
        plan: data.plan,
        estimation: data.estimation,
        warnings: data.warnings,
      };

      setPlanningProgress(progress);

      // Check if planning is complete
      if (data.status === 'planned' && data.plan && data.estimation) {
        stopPolling();
        setIsGeneratingPlan(false);
        setCurrentPlan({
          run_id: runId,
          plan: data.plan,
          estimation: data.estimation,
          warnings: data.warnings,
        });
        setPlanningProgress(null);
        toast({ title: 'Signal Plan Generated', description: `Source: ${data.estimation?.source_label || 'Signal Search'}` });
      } else if (data.status === 'failed') {
        stopPolling();
        setIsGeneratingPlan(false);
        setPlanningProgress(null);
        toast({ title: 'Plan Generation Failed', description: data.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('Plan polling error:', err);
      // Don't stop polling on transient errors
    }
  }, [currentWorkspace?.id, stopPolling, toast]);

  const startPolling = useCallback((runId: string) => {
    stopPolling();
    // Poll immediately, then every 5 seconds
    pollPlanStatus(runId);
    pollingRef.current = setInterval(() => pollPlanStatus(runId), 5000);
  }, [pollPlanStatus, stopPolling]);

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
      if (data.status === 'planning' && data.run_id) {
        // New validate-as-you-build flow: start polling
        setIsGeneratingPlan(true);
        setPlanningProgress({
          run_id: data.run_id,
          status: 'planning',
          phase: data.phase || 'plan_validating_stage_1',
          stages: data.stages || [],
          signal_name: data.signal_name,
          total_stages: data.total_stages,
        });
        startPolling(data.run_id);
      } else if (data.plan && data.estimation) {
        // Legacy immediate response
        setCurrentPlan(data);
        toast({ title: 'Signal Plan Generated', description: `Source: ${data.estimation?.source_label || 'Signal Search'}` });
      }
    },
    onError: (error: any) => {
      setIsGeneratingPlan(false);
      setPlanningProgress(null);
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

  const dryRunMutation = useMutation({
    mutationFn: async (runId: string) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');
      const { data, error } = await supabase.functions.invoke('signal-planner', {
        body: { action: 'dry_run', run_id: runId, workspace_id: currentWorkspace.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onError: (error: any) => {
      toast({ title: 'Dry Run Failed', description: error.message, variant: 'destructive' });
    },
  });

  const cancelPlanning = useCallback(() => {
    stopPolling();
    setIsGeneratingPlan(false);
    setPlanningProgress(null);
  }, [stopPolling]);

  return {
    currentPlan,
    setCurrentPlan,
    signalHistory,
    historyLoading,
    generatePlan: generatePlanMutation.mutate,
    isGenerating: generatePlanMutation.isPending || isGeneratingPlan,
    executeSignal: executeSignalMutation.mutate,
    isExecuting: executeSignalMutation.isPending,
    useSignalLeads,
    deleteSignal: deleteSignalMutation.mutate,
    dryRun: dryRunMutation.mutateAsync,
    isDryRunning: dryRunMutation.isPending,
    // New planning progress
    planningProgress,
    cancelPlanning,
  };
}
