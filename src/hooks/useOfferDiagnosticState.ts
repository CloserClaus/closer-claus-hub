import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface OfferDiagnosticState {
  offer_type: string | null;
  promise: string | null;
  vertical_segment: string | null;
  company_size: string | null;
  pricing_structure: string | null;
  price_tier: string | null;
  proof_level: string | null;
  risk_model: string | null;
  fulfillment: string | null;
}

export function useOfferDiagnosticState() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: savedState, isLoading } = useQuery({
    queryKey: ['offer-diagnostic-state', currentWorkspace?.id, user?.id],
    queryFn: async (): Promise<OfferDiagnosticState | null> => {
      if (!currentWorkspace?.id || !user?.id) return null;

      const { data, error } = await supabase
        .from('offer_diagnostic_state')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching offer diagnostic state:', error);
        return null;
      }

      if (!data) return null;

      return {
        offer_type: data.offer_type,
        promise: data.promise,
        vertical_segment: data.vertical_segment,
        company_size: data.company_size,
        pricing_structure: data.pricing_structure,
        price_tier: data.price_tier,
        proof_level: data.proof_level,
        risk_model: data.risk_model,
        fulfillment: data.fulfillment,
      };
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (state: OfferDiagnosticState) => {
      if (!currentWorkspace?.id || !user?.id) {
        throw new Error('No workspace or user');
      }

      const { error } = await supabase
        .from('offer_diagnostic_state')
        .upsert(
          {
            workspace_id: currentWorkspace.id,
            user_id: user.id,
            ...state,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'workspace_id,user_id',
          }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offer-diagnostic-state'] });
      toast.success('Offer diagnostic settings saved');
    },
    onError: (error) => {
      console.error('Failed to save offer diagnostic state:', error);
      toast.error('Failed to save settings');
    },
  });

  const saveState = (state: OfferDiagnosticState) => {
    saveMutation.mutate(state);
  };

  return {
    savedState,
    isLoading,
    saveState,
    isSaving: saveMutation.isPending,
  };
}
