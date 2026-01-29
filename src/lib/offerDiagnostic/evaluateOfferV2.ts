// ============= evaluateOfferV2 — SINGLE EXECUTION AUTHORITY =============
// This is the ONLY function that produces scoring, bottleneck, and recommendation output.
// All other engines (scoringEngine, recommendationEngine, violationEngine, etc.) are DISABLED.

import type { DiagnosticFormData, StructuredRecommendation } from './types';
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
 * - bottleneck identification
 * - readiness label
 * - recommendations
 * 
 * NO OTHER FUNCTION may compute or modify these.
 * Legacy engines (calculateScore, scoringEngine, recommendationEngine, etc.) are DISABLED.
 */
export async function evaluateOfferV2(formData: DiagnosticFormData): Promise<EvaluateOfferV2Result | null> {
  // Validation check
  if (!isFormCompleteForV2(formData)) {
    console.warn('[evaluateOfferV2] Form incomplete, cannot evaluate');
    return null;
  }
  
  // ========== STEP 1: LATENT SCORING ==========
  // This is the ONLY scoring mechanism. Legacy dimensions are INERT.
  const latentResult = calculateLatentScores(formData);
  
  if (!latentResult) {
    console.error('[evaluateOfferV2] Latent scoring failed — halting evaluation');
    return null;
  }
  
  console.log('[evaluateOfferV2] Latent scores computed:', latentResult);
  
  // ========== STEP 2: AI RECOMMENDATIONS ==========
  // This is the ONLY recommendation source. Legacy engines are INERT.
  const aiInput: AIPrescriptionInput = {
    alignmentScore: latentResult.alignmentScore,
    readinessLabel: latentResult.readinessLabel,
    latentScores: latentResult.latentScores,
    latentBottleneckKey: latentResult.latentBottleneckKey,
    formData,
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
    
    // Status flags
    isOptimizationLevel: aiResult.isOptimizationLevel,
    notOutboundReady: aiResult.notOutboundReady,
    isLoading: false,
    
    // Execution verification — MANDATORY
    _executionSource: 'evaluateOfferV2',
  };
  
  // ========== EXECUTION GUARANTEE ==========
  console.log('[evaluateOfferV2] ✓ Evaluation complete. Source:', result._executionSource);
  console.log('[evaluateOfferV2] ✓ Alignment Score:', result.alignmentScore);
  console.log('[evaluateOfferV2] ✓ Primary Bottleneck:', result.bottleneckLabel);
  
  return result;
}

// ========== ASSERTION HELPER ==========

/**
 * Validates that the result came from evaluateOfferV2.
 * If not, throws an error to halt rendering.
 * 
 * USAGE:
 * const result = await evaluateOfferV2(formData);
 * assertEvaluateOfferV2Source(result);
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
  };
}
