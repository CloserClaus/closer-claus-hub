// ============= evaluateOfferV2 — SINGLE EXECUTION AUTHORITY =============
// This is the ONLY function that produces scoring, bottleneck, and recommendation output.
// All other engines (scoringEngine, recommendationEngine, violationEngine, etc.) are DISABLED.
// INCLUDES: 8 Stabilization Rules for Outbound Diagnostic

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
import {
  computeStabilizationContext,
  checkPricingStability,
  checkBottleneckEligibility,
  checkLocalOptimum,
  type StabilizationContext,
} from './stabilizationRules';

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
  
  // Stabilization context
  stabilizationApplied: boolean;
  isAtLocalOptimum: boolean;
  hasEligibleBottleneck: boolean;
  
  // Execution verification
  _executionSource: 'evaluateOfferV2';
}

// ========== VALIDATION ==========

function isFormCompleteForV2(formData: DiagnosticFormData): boolean {
  const { 
    offerType, promise, icpIndustry, verticalSegment,
    icpSize, icpMaturity, icpSpecificity, pricingStructure, riskModel, 
    fulfillmentComplexity, proofLevel 
  } = formData;
  
  // icpSpecificity is now REQUIRED
  if (!offerType || !promise || !icpIndustry || !verticalSegment || 
      !icpSize || !icpMaturity || !icpSpecificity || !pricingStructure || !riskModel || 
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
 * 
 * INCLUDES: 8 Stabilization Rules to prevent infinite optimization loops
 */
export async function evaluateOfferV2(formData: DiagnosticFormData): Promise<EvaluateOfferV2Result | null> {
  // Validation check
  if (!isFormCompleteForV2(formData)) {
    console.warn('[evaluateOfferV2] Form incomplete, cannot evaluate');
    return null;
  }
  
  // ========== STEP 1: PRE-COMPUTE STABILIZATION CHECKS ==========
  // RULE 2: Check pricing stability before computing bottleneck
  const pricingStability = checkPricingStability(formData);
  
  // ========== STEP 2: LATENT SCORING ==========
  // This is the ONLY scoring mechanism. Legacy dimensions are INERT.
  // Pass pricing bottleneck eligibility to scoring engine
  const latentResult = calculateLatentScores(formData, {
    pricingCanBeBottleneck: pricingStability.canSelectAsBottleneck,
  });
  
  if (!latentResult) {
    console.error('[evaluateOfferV2] Latent scoring failed — halting evaluation');
    return null;
  }
  
  console.log('[evaluateOfferV2] Latent scores computed:', latentResult);
  
  // ========== STEP 3: COMPUTE FULL STABILIZATION CONTEXT ==========
  const stabilizationContext = computeStabilizationContext(formData, latentResult.latentScores);
  
  // RULE 4: Check local optimum
  const localOptimumResult = checkLocalOptimum(latentResult.latentScores);
  
  // RULE 5: Check bottleneck eligibility
  const bottleneckEligibility = checkBottleneckEligibility(latentResult.latentScores);
  
  console.log('[evaluateOfferV2] Stabilization context:', {
    pricingWithinBand: pricingStability.isWithinViableBand,
    atLocalOptimum: localOptimumResult.isAtLocalOptimum,
    hasEligibleBottleneck: bottleneckEligibility.shouldForceRecommendations,
  });
  
  // ========== STEP 4: AI RECOMMENDATIONS ==========
  // This is the ONLY recommendation source. Legacy engines are INERT.
  const aiInput: AIPrescriptionInput = {
    alignmentScore: latentResult.alignmentScore,
    readinessLabel: latentResult.readinessLabel,
    latentScores: latentResult.latentScores,
    latentBottleneckKey: latentResult.latentBottleneckKey,
    formData,
    stabilizationContext,
  };
  
  const aiResult = await generateAIPrescription(aiInput);
  
  console.log('[evaluateOfferV2] AI recommendations generated:', aiResult.recommendations.length);
  console.log('[evaluateOfferV2] Blocked recommendations:', aiResult.blockedRecommendations);
  
  // ========== STEP 5: BUILD RESULT ==========
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
    
    // Stabilization flags
    stabilizationApplied: aiResult.stabilizationApplied,
    isAtLocalOptimum: localOptimumResult.isAtLocalOptimum,
    hasEligibleBottleneck: bottleneckEligibility.shouldForceRecommendations,
    
    // Execution verification — MANDATORY
    _executionSource: 'evaluateOfferV2',
  };
  
  // ========== EXECUTION GUARANTEE ==========
  console.log('[evaluateOfferV2] ✓ Evaluation complete. Source:', result._executionSource);
  console.log('[evaluateOfferV2] ✓ Alignment Score:', result.alignmentScore);
  console.log('[evaluateOfferV2] ✓ Primary Bottleneck:', result.bottleneckLabel);
  console.log('[evaluateOfferV2] ✓ At Local Optimum:', result.isAtLocalOptimum);
  
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
  isAtLocalOptimum?: boolean;
} | null {
  if (!isFormCompleteForV2(formData)) {
    return null;
  }
  
  // Check pricing stability for bottleneck eligibility
  const pricingStability = checkPricingStability(formData);
  
  const latentResult = calculateLatentScores(formData, {
    pricingCanBeBottleneck: pricingStability.canSelectAsBottleneck,
  });
  if (!latentResult) return null;
  
  // Check local optimum for UI display
  const localOptimumResult = checkLocalOptimum(latentResult.latentScores);
  
  return {
    alignmentScore: latentResult.alignmentScore,
    readinessLabel: latentResult.readinessLabel,
    latentScores: latentResult.latentScores,
    latentBottleneckKey: latentResult.latentBottleneckKey,
    bottleneckLabel: LATENT_SCORE_LABELS[latentResult.latentBottleneckKey],
    isAtLocalOptimum: localOptimumResult.isAtLocalOptimum,
  };
}
