import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useLeadCredits } from '@/hooks/useLeadCredits';
import { toast } from 'sonner';

export interface EvaluationProgress {
  current: number;
  total: number;
  status: 'idle' | 'evaluating' | 'complete' | 'error';
  message?: string;
}

export interface EvaluationResult {
  evaluated: number;
  errors: number;
  credits_used: number;
}

const CREDIT_COST_PER_LEAD = 0.5;

export function useLeadReadinessEvaluation() {
  const { currentWorkspace } = useWorkspace();
  const { credits, refetch: refetchCredits } = useLeadCredits();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<EvaluationProgress>({
    current: 0,
    total: 0,
    status: 'idle',
  });

  const resetProgress = useCallback(() => {
    setProgress({
      current: 0,
      total: 0,
      status: 'idle',
    });
  }, []);

  const evaluationMutation = useMutation({
    mutationFn: async (leadIds: string[]): Promise<EvaluationResult> => {
      if (!currentWorkspace?.id) {
        throw new Error('No workspace selected');
      }

      const requiredCredits = leadIds.length * CREDIT_COST_PER_LEAD;
      if (credits < requiredCredits) {
        throw new Error(`Not enough credits. Need ${requiredCredits}, have ${credits}`);
      }

      setProgress({
        current: 0,
        total: leadIds.length,
        status: 'evaluating',
      });

      const { data, error } = await supabase.functions.invoke('evaluate-lead-readiness', {
        body: {
          lead_ids: leadIds,
          workspace_id: currentWorkspace.id,
        },
      });

      if (error) {
        throw new Error(error.message || 'Evaluation failed');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return {
        evaluated: data.evaluated || 0,
        errors: data.errors || 0,
        credits_used: data.credits_used || 0,
      };
    },
    onSuccess: (data) => {
      setProgress({
        current: data.evaluated,
        total: data.evaluated + data.errors,
        status: 'complete',
        message: `Evaluated ${data.evaluated} lead${data.evaluated !== 1 ? 's' : ''} (${data.credits_used} credits used)`,
      });

      toast.success(`Readiness evaluated for ${data.evaluated} leads`);
      
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['apollo-leads'] });
      refetchCredits();
    },
    onError: (error: Error) => {
      setProgress(prev => ({
        ...prev,
        status: 'error',
        message: error.message,
      }));
      toast.error('Evaluation failed: ' + error.message);
    },
  });

  const evaluateLeads = async (leadIds: string[]) => {
    return evaluationMutation.mutateAsync(leadIds);
  };

  // Check if user can afford to evaluate a given number of leads
  const canAffordEvaluation = (leadCount: number) => {
    return credits >= leadCount * CREDIT_COST_PER_LEAD;
  };

  const getEvaluationCost = (leadCount: number) => {
    return leadCount * CREDIT_COST_PER_LEAD;
  };

  return {
    evaluateLeads,
    isEvaluating: evaluationMutation.isPending,
    progress,
    resetProgress,
    canAffordEvaluation,
    getEvaluationCost,
    CREDIT_COST_PER_LEAD,
  };
}
