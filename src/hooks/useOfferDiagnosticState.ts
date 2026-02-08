import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { 
  DiagnosticFormData,
  StructuredRecommendation,
} from '@/lib/offerDiagnostic/types';
import type { 
  LatentScores, 
  LatentBottleneckKey, 
  ReadinessLabel,
} from '@/lib/offerDiagnostic/latentScoringEngine';

export interface OfferDiagnosticState {
  // Form data fields
  offer_type: string | null;
  promise_outcome: string | null;
  promise: string | null;
  icp_industry: string | null;
  vertical_segment: string | null;
  scoring_segment: string | null;
  company_size: string | null;
  icp_maturity: string | null;
  icp_specificity: string | null;
  pricing_structure: string | null;
  price_tier: string | null;
  recurring_price_tier: string | null;
  one_time_price_tier: string | null;
  usage_output_type: string | null;
  usage_volume_tier: string | null;
  hybrid_retainer_tier: string | null;
  performance_basis: string | null;
  performance_comp_tier: string | null;
  proof_level: string | null;
  risk_model: string | null;
  fulfillment: string | null;
  // Latent scoring fields
  latent_economic_headroom: number | null;
  latent_proof_to_promise: number | null;
  latent_fulfillment_scalability: number | null;
  latent_risk_alignment: number | null;
  latent_channel_fit: number | null;
  latent_icp_specificity: number | null;
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
        promise_outcome: (data as any).promise_outcome || null,
        promise: data.promise,
        icp_industry: (data as any).icp_industry || null,
        vertical_segment: data.vertical_segment,
        scoring_segment: (data as any).scoring_segment || null,
        company_size: data.company_size,
        icp_maturity: (data as any).icp_maturity || null,
        icp_specificity: (data as any).icp_specificity || null,
        pricing_structure: data.pricing_structure,
        price_tier: data.price_tier,
        recurring_price_tier: (data as any).recurring_price_tier || null,
        one_time_price_tier: (data as any).one_time_price_tier || null,
        usage_output_type: (data as any).usage_output_type || null,
        usage_volume_tier: (data as any).usage_volume_tier || null,
        hybrid_retainer_tier: (data as any).hybrid_retainer_tier || null,
        performance_basis: (data as any).performance_basis || null,
        performance_comp_tier: (data as any).performance_comp_tier || null,
        proof_level: data.proof_level,
        risk_model: data.risk_model,
        fulfillment: data.fulfillment,
        // Latent scoring fields
        latent_economic_headroom: data.latent_economic_headroom,
        latent_proof_to_promise: data.latent_proof_to_promise,
        latent_fulfillment_scalability: data.latent_fulfillment_scalability,
        latent_risk_alignment: data.latent_risk_alignment,
        latent_channel_fit: data.latent_channel_fit,
        latent_icp_specificity: (data as any).latent_icp_specificity || null,
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
    },
    onError: (error) => {
      console.error('Failed to save offer diagnostic state:', error);
      toast.error('Failed to save settings');
    },
  });

  const saveState = (state: Partial<OfferDiagnosticState>) => {
    saveMutation.mutate(state);
  };

  // Save full form + latent scores together
  const saveFullDiagnostic = (formData: DiagnosticFormData, latentData: LatentScoresSaveData) => {
    saveMutation.mutate({
      offer_type: formData.offerType,
      promise_outcome: formData.promiseOutcome,
      promise: formData.promise,
      icp_industry: formData.icpIndustry,
      vertical_segment: formData.verticalSegment,
      scoring_segment: formData.scoringSegment,
      company_size: formData.icpSize,
      icp_maturity: formData.icpMaturity,
      icp_specificity: formData.icpSpecificity,
      pricing_structure: formData.pricingStructure,
      price_tier: formData.recurringPriceTier || formData.oneTimePriceTier || formData.hybridRetainerTier || null,
      recurring_price_tier: formData.recurringPriceTier,
      one_time_price_tier: formData.oneTimePriceTier,
      usage_output_type: formData.usageOutputType,
      usage_volume_tier: formData.usageVolumeTier,
      hybrid_retainer_tier: formData.hybridRetainerTier,
      performance_basis: formData.performanceBasis,
      performance_comp_tier: formData.performanceCompTier,
      proof_level: formData.proofLevel,
      risk_model: formData.riskModel,
      fulfillment: formData.fulfillmentComplexity,
      // Latent scores
      latent_economic_headroom: latentData.latentScores.EFI,
      latent_proof_to_promise: latentData.latentScores.proofPromise,
      latent_fulfillment_scalability: latentData.latentScores.fulfillmentScalability,
      latent_risk_alignment: latentData.latentScores.riskAlignment,
      latent_channel_fit: latentData.latentScores.channelFit,
      latent_icp_specificity: latentData.latentScores.icpSpecificity,
      latent_alignment_score: latentData.alignmentScore,
      latent_readiness_label: latentData.readinessLabel,
      latent_bottleneck_key: latentData.latentBottleneckKey,
      ai_recommendations: latentData.aiRecommendations || null,
    });
  };

  // Restore form data from saved state
  const restoreFormData = (): DiagnosticFormData | null => {
    if (!savedState || !savedState.offer_type) return null;

    return {
      offerType: savedState.offer_type as any,
      promiseOutcome: savedState.promise_outcome as any,
      promise: savedState.promise as any,
      icpIndustry: savedState.icp_industry as any,
      verticalSegment: savedState.vertical_segment as any,
      scoringSegment: savedState.scoring_segment as any,
      icpSize: savedState.company_size as any,
      icpMaturity: savedState.icp_maturity as any,
      icpSpecificity: savedState.icp_specificity as any,
      pricingStructure: savedState.pricing_structure as any,
      recurringPriceTier: savedState.recurring_price_tier as any,
      oneTimePriceTier: savedState.one_time_price_tier as any,
      usageOutputType: savedState.usage_output_type as any,
      usageVolumeTier: savedState.usage_volume_tier as any,
      hybridRetainerTier: savedState.hybrid_retainer_tier as any,
      performanceBasis: savedState.performance_basis as any,
      performanceCompTier: savedState.performance_comp_tier as any,
      riskModel: savedState.risk_model as any,
      fulfillmentComplexity: savedState.fulfillment as any,
      proofLevel: savedState.proof_level as any,
    };
  };

  // Helper to save latent scores separately
  const saveLatentScores = (data: LatentScoresSaveData) => {
    saveMutation.mutate({
      latent_economic_headroom: data.latentScores.EFI,
      latent_proof_to_promise: data.latentScores.proofPromise,
      latent_fulfillment_scalability: data.latentScores.fulfillmentScalability,
      latent_risk_alignment: data.latentScores.riskAlignment,
      latent_channel_fit: data.latentScores.channelFit,
      latent_icp_specificity: data.latentScores.icpSpecificity,
      latent_alignment_score: data.alignmentScore,
      latent_readiness_label: data.readinessLabel,
      latent_bottleneck_key: data.latentBottleneckKey,
      ai_recommendations: data.aiRecommendations || null,
    });
  };

  // Get active offer context for Leads integration
  const getActiveOfferContext = () => {
    if (!savedState) return null;
    
    return {
      latentScores: savedState.latent_alignment_score ? {
        EFI: savedState.latent_economic_headroom || 0,
        proofPromise: savedState.latent_proof_to_promise || 0,
        fulfillmentScalability: savedState.latent_fulfillment_scalability || 0,
        riskAlignment: savedState.latent_risk_alignment || 0,
        channelFit: savedState.latent_channel_fit || 0,
        icpSpecificity: savedState.latent_icp_specificity || 10,
      } : null,
      latentBottleneckKey: savedState.latent_bottleneck_key,
      promise: savedState.promise,
      offerType: savedState.offer_type,
      pricingStructure: savedState.pricing_structure,
      proofLevel: savedState.proof_level,
      fulfillmentComplexity: savedState.fulfillment,
      alignmentScore: savedState.latent_alignment_score,
      readinessLabel: savedState.latent_readiness_label,
      // Extended context for lead evaluation
      icpIndustry: savedState.icp_industry,
      icpMaturity: savedState.icp_maturity,
      icpSpecificity: savedState.icp_specificity,
      verticalSegment: savedState.vertical_segment,
      riskModel: savedState.risk_model,
      companySize: savedState.company_size,
    };
  };

  return {
    savedState,
    isLoading,
    saveState,
    saveFullDiagnostic,
    saveLatentScores,
    restoreFormData,
    getActiveOfferContext,
    isSaving: saveMutation.isPending,
  };
}
