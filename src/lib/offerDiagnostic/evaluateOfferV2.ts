// ============= evaluateOfferV2 — SINGLE EXECUTION AUTHORITY =============
// This is the ONLY function that produces scoring, bottleneck, and recommendation output.
// All other engines are DISABLED.
// Implements 5 latent variables with viability gates

import type { 
  DiagnosticFormData, 
  StructuredRecommendation,
} from './types';
import { 
  calculateLatentScores, 
  type LatentScores, 
  type LatentBottleneckKey, 
  type ReadinessLabel,
  LATENT_SCORE_LABELS
} from './latentScoringEngine';
import { 
  generateAIPrescription, 
  convertToStructuredRecommendations,
  type AIPrescriptionInput
} from './aiPrescriptionEngine';

// ========== OUTPUT TYPE ==========

export interface EvaluateOfferV2Result {
  // Core outputs — ONLY SOURCE OF TRUTH
  alignmentScore: number;
  readinessLabel: ReadinessLabel;
  latentScores: LatentScores;
  latentBottleneckKey: LatentBottleneckKey;
  bottleneckLabel: string;
  
  // AI-generated recommendations — ONLY SOURCE OF TRUTH
  recommendations: StructuredRecommendation[];
  
  // Outbound readiness (MANDATORY)
  outboundReady: boolean;
  
  // Status flags
  isOptimizationLevel: boolean;
  notOutboundReady: boolean;
  isLoading: boolean;
  
  // Execution verification
  _executionSource: 'evaluateOfferV2';
}

// ========== VALIDATION ==========

function isFormCompleteForV2(formData: DiagnosticFormData): boolean {
  const { 
    offerType, promise, icpIndustry, verticalSegment,
    icpSize, icpMaturity, pricingStructure, riskModel, 
    fulfillmentComplexity, proofLevel 
  } = formData;
  
  if (!offerType || !promise || !icpIndustry || !verticalSegment || 
      !icpSize || !icpMaturity || !pricingStructure || !riskModel || 
      !fulfillmentComplexity || !proofLevel) {
    return false;
  }

  // Conditional validation for pricing structures
  if (pricingStructure === 'recurring' && !formData.recurringPriceTier) return false;
  if (pricingStructure === 'one_time' && !formData.oneTimePriceTier) return false;
  if (pricingStructure === 'usage_based' && (!formData.usageOutputType || !formData.usageVolumeTier)) return false;
  if (pricingStructure === 'hybrid' && (!formData.hybridRetainerTier || !formData.performanceBasis || !formData.performanceCompTier)) return false;
  if (pricingStructure === 'performance_only' && (!formData.performanceBasis || !formData.performanceCompTier)) return false;

  return true;
}

// ========== MAIN EVALUATION FUNCTION ==========

/**
 * evaluateOfferV2 — THE SINGLE EXECUTION AUTHORITY
 * 
 * This function is the ONLY source of:
 * - alignmentScore (0-100)
 * - outboundReady (boolean) — MANDATORY
 * - primaryBottleneck — MANDATORY
 * - readiness label
 * - recommendations
 * 
 * NO OTHER FUNCTION may compute or modify these.
 * 
 * IMPLEMENTS: 5 latent variables with viability gates
 */
export async function evaluateOfferV2(formData: DiagnosticFormData): Promise<EvaluateOfferV2Result | null> {
  // Validation check
  if (!isFormCompleteForV2(formData)) {
    console.warn('[evaluateOfferV2] Form incomplete, cannot evaluate');
    return null;
  }
  
  // ========== STEP 1: LATENT SCORING ==========
  const latentResult = calculateLatentScores(formData);
  
  if (!latentResult) {
    console.error('[evaluateOfferV2] Latent scoring failed — halting evaluation');
    return null;
  }
  
  console.log('[evaluateOfferV2] Latent scores computed:', latentResult);
  console.log('[evaluateOfferV2] Outbound Ready:', latentResult.outboundReady);
  console.log('[evaluateOfferV2] Primary Bottleneck:', latentResult.primaryBottleneck);
  
  // ========== STEP 2: AI RECOMMENDATIONS ==========
  const aiInput: AIPrescriptionInput = {
    alignmentScore: latentResult.alignmentScore,
    readinessLabel: latentResult.readinessLabel,
    latentScores: latentResult.latentScores,
    latentBottleneckKey: latentResult.latentBottleneckKey,
    formData,
    outboundReady: latentResult.outboundReady,
    primaryBottleneck: latentResult.primaryBottleneck,
  };
  
  const aiResult = await generateAIPrescription(aiInput);
  
  console.log('[evaluateOfferV2] AI recommendations generated:', aiResult.recommendations.length);
  
  // ========== STEP 3: BUILD RESULT ==========
  const result: EvaluateOfferV2Result = {
    // Core outputs — ONLY SOURCE OF TRUTH
    alignmentScore: latentResult.alignmentScore,
    readinessLabel: latentResult.readinessLabel,
    latentScores: latentResult.latentScores,
    latentBottleneckKey: latentResult.latentBottleneckKey,
    bottleneckLabel: LATENT_SCORE_LABELS[latentResult.latentBottleneckKey],
    
    // AI-generated recommendations
    recommendations: convertToStructuredRecommendations(aiResult.recommendations),
    
    // Outbound readiness (MANDATORY)
    outboundReady: latentResult.outboundReady,
    
    // Status flags
    isOptimizationLevel: latentResult.alignmentScore >= 75 && latentResult.outboundReady,
    notOutboundReady: !latentResult.outboundReady,
    isLoading: false,
    
    // Execution verification — MANDATORY
    _executionSource: 'evaluateOfferV2',
  };
  
  // ========== EXECUTION GUARANTEE ==========
  console.log('[evaluateOfferV2] ✓ Evaluation complete. Source:', result._executionSource);
  console.log('[evaluateOfferV2] ✓ Alignment Score:', result.alignmentScore);
  console.log('[evaluateOfferV2] ✓ Outbound Ready:', result.outboundReady);
  console.log('[evaluateOfferV2] ✓ Primary Bottleneck:', result.bottleneckLabel);
  
  return result;
}

// ========== ASSERTION HELPER ==========

/**
 * Validates that the result came from evaluateOfferV2.
 * If not, throws an error to halt rendering.
 */
export function assertEvaluateOfferV2Source(result: unknown): asserts result is EvaluateOfferV2Result {
  if (!result || typeof result !== 'object') {
    throw new Error('[EXECUTION HALT] evaluateOfferV2 result is null or invalid');
  }
  
  const castResult = result as Partial<EvaluateOfferV2Result>;
  
  if (castResult._executionSource !== 'evaluateOfferV2') {
    console.error('[EXECUTION HALT] Result did not come from evaluateOfferV2!');
    console.error('Received:', castResult);
    throw new Error(
      '[EXECUTION HALT] alignmentScore source is not evaluateOfferV2. ' +
      'Legacy engines MUST be disabled. Check execution flow.'
    );
  }
  
  // Validate mandatory output contract
  if (castResult.outboundReady === undefined) {
    throw new Error('[EXECUTION HALT] Missing outboundReady in result');
  }
  if (castResult.latentBottleneckKey === undefined) {
    throw new Error('[EXECUTION HALT] Missing primaryBottleneck in result');
  }
}

// ========== SYNC VERSION FOR IMMEDIATE LATENT SCORES ==========

/**
 * Get latent scores synchronously (without AI recommendations).
 * Use this for immediate preview while AI loads.
 */
export function getLatentScoresSync(formData: DiagnosticFormData): {
  alignmentScore: number;
  readinessLabel: ReadinessLabel;
  latentScores: LatentScores;
  latentBottleneckKey: LatentBottleneckKey;
  bottleneckLabel: string;
  outboundReady: boolean;
} | null {
  if (!isFormCompleteForV2(formData)) {
    return null;
  }
  
  const latentResult = calculateLatentScores(formData);
  if (!latentResult) return null;
  
  return {
    alignmentScore: latentResult.alignmentScore,
    readinessLabel: latentResult.readinessLabel,
    latentScores: latentResult.latentScores,
    latentBottleneckKey: latentResult.latentBottleneckKey,
    bottleneckLabel: LATENT_SCORE_LABELS[latentResult.latentBottleneckKey],
    outboundReady: latentResult.outboundReady,
  };
}
