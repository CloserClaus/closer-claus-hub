import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { 
  StructuredRecommendation,
  ReadinessLabel as TypesReadinessLabel,
} from '@/lib/offerDiagnostic/types';
import type { 
  LatentScores, 
  LatentBottleneckKey, 
  ReadinessLabel,
} from '@/lib/offerDiagnostic/latentScoringEngine';

export interface OfferDiagnosticState {
  // Form data fields
  offer_type: string | null;
  promise: string | null;
  vertical_segment: string | null;
  company_size: string | null;
  pricing_structure: string | null;
  price_tier: string | null;
  proof_level: string | null;
  risk_model: string | null;
  fulfillment: string | null;
  // Latent scoring fields
  latent_economic_headroom: number | null;
  latent_proof_to_promise: number | null;
  latent_fulfillment_scalability: number | null;
  latent_risk_alignment: number | null;
  latent_channel_fit: number | null;
  latent_alignment_score: number | null;
  latent_readiness_label: ReadinessLabel | null;
  latent_bottleneck_key: LatentBottleneckKey | null;
  ai_recommendations: StructuredRecommendation[] | null;
  version: number;
}

export interface LatentScoresSaveData {
  latentScores: LatentScores;
  alignmentScore: number;
  readinessLabel: ReadinessLabel;
  latentBottleneckKey: LatentBottleneckKey;
  aiRecommendations?: StructuredRecommendation[];
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
        // Latent scoring fields
        latent_economic_headroom: data.latent_economic_headroom,
        latent_proof_to_promise: data.latent_proof_to_promise,
        latent_fulfillment_scalability: data.latent_fulfillment_scalability,
        latent_risk_alignment: data.latent_risk_alignment,
        latent_channel_fit: data.latent_channel_fit,
        latent_alignment_score: data.latent_alignment_score,
        latent_readiness_label: data.latent_readiness_label as ReadinessLabel | null,
        latent_bottleneck_key: data.latent_bottleneck_key as LatentBottleneckKey | null,
        ai_recommendations: (data.ai_recommendations as unknown) as StructuredRecommendation[] | null,
        version: data.version || 1,
      };
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (state: Partial<OfferDiagnosticState>) => {
      if (!currentWorkspace?.id || !user?.id) {
        throw new Error('No workspace or user');
      }

      // Get current version
      const currentVersion = savedState?.version || 0;

      const upsertData = {
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        ...state,
        version: currentVersion + 1,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('offer_diagnostic_state')
        .upsert(upsertData as any, {
          onConflict: 'workspace_id,user_id',
        });

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

  const saveState = (state: Partial<OfferDiagnosticState>) => {
    saveMutation.mutate(state);
  };

  // Helper to save latent scores separately (NEW: 6 latent variables)
  const saveLatentScores = (data: LatentScoresSaveData) => {
    saveMutation.mutate({
      latent_economic_headroom: data.latentScores.EFI,
      latent_proof_to_promise: data.latentScores.proofPromise,
      latent_fulfillment_scalability: data.latentScores.fulfillmentScalability,
      latent_risk_alignment: data.latentScores.riskAlignment,
      latent_channel_fit: data.latentScores.channelFit,
      // icpSpecificity is not stored separately in DB, but included in LatentScores
      latent_alignment_score: data.alignmentScore,
      latent_readiness_label: data.readinessLabel,
      latent_bottleneck_key: data.latentBottleneckKey,
      ai_recommendations: data.aiRecommendations || null,
    });
  };

  // Get active offer context for Leads integration (NEW: 6 latent variables)
  const getActiveOfferContext = () => {
    if (!savedState) return null;
    
    return {
      latentScores: savedState.latent_alignment_score ? {
        EFI: savedState.latent_economic_headroom || 0,
        proofPromise: savedState.latent_proof_to_promise || 0,
        fulfillmentScalability: savedState.latent_fulfillment_scalability || 0,
        riskAlignment: savedState.latent_risk_alignment || 0,
        channelFit: savedState.latent_channel_fit || 0,
        icpSpecificity: 10, // Default value when not stored
      } : null,
      latentBottleneckKey: savedState.latent_bottleneck_key,
      promise: savedState.promise,
      offerType: savedState.offer_type,
      pricingStructure: savedState.pricing_structure,
      proofLevel: savedState.proof_level,
      fulfillmentComplexity: savedState.fulfillment,
      alignmentScore: savedState.latent_alignment_score,
      readinessLabel: savedState.latent_readiness_label,
    };
  };

  return {
    savedState,
    isLoading,
    saveState,
    saveLatentScores,
    getActiveOfferContext,
    isSaving: saveMutation.isPending,
  };
}
