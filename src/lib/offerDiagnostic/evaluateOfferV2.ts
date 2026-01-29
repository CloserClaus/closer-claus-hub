// ============= evaluateOfferV2 — SINGLE EXECUTION AUTHORITY =============
// This is the ONLY function that produces scoring, bottleneck, and recommendation output.
// All other engines (scoringEngine, recommendationEngine, violationEngine, etc.) are DISABLED.
// INCLUDES: Viability Gates + 8 Stabilization Rules for Outbound Diagnostic

import type { 
  DiagnosticFormData, 
  StructuredRecommendation,
  ViabilityGateName,
  ViabilityGateResult,
  ViabilityGatesOutput,
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
import {
  computeStabilizationContext,
  checkPricingStability,
  checkBottleneckEligibility,
  checkLocalOptimum,
  type StabilizationContext,
} from './stabilizationRules';

// ========== VIABILITY GATE THRESHOLDS (PROMPT 2) ==========

const GATE_THRESHOLDS: Record<ViabilityGateName, number> = {
  economicFeasibility: 8,         // EFI < 8 = FAIL
  proofToPromiseCredibility: 10,  // ProofToPromise < 10 = FAIL
  fulfillmentScalability: 9,      // FulfillmentScalability < 9 = FAIL
  channelFit: 9,                  // ChannelFit < 9 = FAIL
};

// Gate priority order (CRITICAL - PROMPT 2.B)
const GATE_PRIORITY_ORDER: ViabilityGateName[] = [
  'economicFeasibility',
  'proofToPromiseCredibility',
  'fulfillmentScalability',
  'channelFit',
];

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
  
  // Viability Gates (NEW - PROMPT 1 & 2)
  outboundReady: boolean;        // MANDATORY - computed boolean
  failedGate: ViabilityGateName | null;  // MANDATORY - explicit failed gate
  viabilityGates: ViabilityGatesOutput;
  
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

// ========== VIABILITY GATES COMPUTATION (PROMPT 1 & 2) ==========

function computeViabilityGates(latentScores: LatentScores): ViabilityGatesOutput {
  // Map latent scores to gate scores
  const gateScoreMap: Record<ViabilityGateName, number> = {
    economicFeasibility: latentScores.economicHeadroom,
    proofToPromiseCredibility: latentScores.proofToPromise,
    fulfillmentScalability: latentScores.fulfillmentScalability,
    channelFit: latentScores.channelFit,
  };
  
  // Evaluate each gate
  const gates: ViabilityGateResult[] = GATE_PRIORITY_ORDER.map(gate => ({
    gate,
    score: gateScoreMap[gate],
    threshold: GATE_THRESHOLDS[gate],
    passed: gateScoreMap[gate] >= GATE_THRESHOLDS[gate],
  }));
  
  // Find first failed gate by priority (PROMPT 2.B)
  let failedGate: ViabilityGateName | null = null;
  for (const gate of GATE_PRIORITY_ORDER) {
    const gateResult = gates.find(g => g.gate === gate);
    if (gateResult && !gateResult.passed) {
      failedGate = gate;
      break; // Only ONE gate may be marked as failed
    }
  }
  
  // Compute outboundReady boolean (PROMPT 2.C)
  const outboundReady = failedGate === null;
  
  // Compute score capping logic (PROMPT 2.D)
  let scoreCap: number | null = null;
  let scoreFloor: number | null = null;
  
  if (!outboundReady) {
    scoreCap = 69; // If not ready, max score is 69
  } else {
    // Check if all gates >= 12
    const allGatesAbove12 = gates.every(g => g.score >= 12);
    if (allGatesAbove12) {
      scoreFloor = 70;
    }
    
    // Check if all gates >= 15
    const allGatesAbove15 = gates.every(g => g.score >= 15);
    if (allGatesAbove15) {
      scoreFloor = 80;
    }
    
    // Check if all gates >= 18
    const allGatesAbove18 = gates.every(g => g.score >= 18);
    if (allGatesAbove18) {
      scoreFloor = 90;
    }
  }
  
  return {
    gates,
    failedGate,
    outboundReady,
    scoreCap,
    scoreFloor,
  };
}

// ========== APPLY SCORE CAPPING ==========

function applyScoreCapping(rawScore: number, viabilityGates: ViabilityGatesOutput): number {
  let score = rawScore;
  
  // Apply cap (bad offers cannot look good)
  if (viabilityGates.scoreCap !== null && score > viabilityGates.scoreCap) {
    console.log(`[evaluateOfferV2] Capping score from ${score} to ${viabilityGates.scoreCap}`);
    score = viabilityGates.scoreCap;
  }
  
  // Apply floor (good offers cannot look mediocre)
  if (viabilityGates.scoreFloor !== null && score < viabilityGates.scoreFloor) {
    console.log(`[evaluateOfferV2] Raising score from ${score} to ${viabilityGates.scoreFloor}`);
    score = viabilityGates.scoreFloor;
  }
  
  return score;
}

// ========== DERIVE READINESS LABEL (PROMPT 2.F) ==========

function deriveReadinessLabel(alignmentScore: number, outboundReady: boolean): ReadinessLabel {
  // Labels are DERIVED, not inferred
  if (!outboundReady) {
    return 'Weak'; // Not Ready = Weak
  }
  
  if (alignmentScore >= 80) {
    return 'Strong';
  }
  
  if (alignmentScore >= 70) {
    return 'Moderate';
  }
  
  return 'Weak';
}

// ========== BOTTLENECK FROM GATES (PROMPT 2.E) ==========

function determineBottleneckFromGates(
  viabilityGates: ViabilityGatesOutput,
  latentScores: LatentScores
): LatentBottleneckKey {
  // If a gate failed, bottleneck = failed gate
  if (viabilityGates.failedGate) {
    // Map gate name to latent key
    const gateToLatentMap: Record<ViabilityGateName, LatentBottleneckKey> = {
      economicFeasibility: 'economicHeadroom',
      proofToPromiseCredibility: 'proofToPromise',
      fulfillmentScalability: 'fulfillmentScalability',
      channelFit: 'channelFit',
    };
    return gateToLatentMap[viabilityGates.failedGate];
  }
  
  // Else, bottleneck = LOWEST scoring gate
  const gateScores = viabilityGates.gates.map(g => ({
    gate: g.gate,
    score: g.score,
  }));
  
  // Sort by score ascending
  gateScores.sort((a, b) => a.score - b.score);
  
  const lowestGate = gateScores[0]?.gate || 'proofToPromiseCredibility';
  
  // Map back to latent key
  const gateToLatentMap: Record<ViabilityGateName, LatentBottleneckKey> = {
    economicFeasibility: 'economicHeadroom',
    proofToPromiseCredibility: 'proofToPromise',
    fulfillmentScalability: 'fulfillmentScalability',
    channelFit: 'channelFit',
  };
  
  return gateToLatentMap[lowestGate];
}

// ========== MAIN EVALUATION FUNCTION ==========

/**
 * evaluateOfferV2 — THE SINGLE EXECUTION AUTHORITY
 * 
 * This function is the ONLY source of:
 * - alignmentScore (0-100)
 * - outboundReady (boolean) — MANDATORY
 * - failedGate (string | null) — MANDATORY
 * - primaryBottleneck — MANDATORY
 * - readiness label
 * - recommendations
 * 
 * NO OTHER FUNCTION may compute or modify these.
 * Legacy engines (calculateScore, scoringEngine, recommendationEngine, etc.) are DELETED.
 * 
 * INCLUDES: Viability Gates + 8 Stabilization Rules
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
  // This is the ONLY scoring mechanism.
  const latentResult = calculateLatentScores(formData, {
    pricingCanBeBottleneck: pricingStability.canSelectAsBottleneck,
  });
  
  if (!latentResult) {
    console.error('[evaluateOfferV2] Latent scoring failed — halting evaluation');
    return null;
  }
  
  console.log('[evaluateOfferV2] Latent scores computed:', latentResult);
  
  // ========== STEP 3: VIABILITY GATES (NEW - PROMPT 1 & 2) ==========
  const viabilityGates = computeViabilityGates(latentResult.latentScores);
  
  console.log('[evaluateOfferV2] Viability Gates:', {
    outboundReady: viabilityGates.outboundReady,
    failedGate: viabilityGates.failedGate,
    gates: viabilityGates.gates.map(g => `${g.gate}: ${g.score}/${g.threshold} (${g.passed ? 'PASS' : 'FAIL'})`),
  });
  
  // ========== STEP 4: APPLY SCORE CAPPING ==========
  const cappedAlignmentScore = applyScoreCapping(latentResult.alignmentScore, viabilityGates);
  
  // ========== STEP 5: DERIVE READINESS LABEL ==========
  const readinessLabel = deriveReadinessLabel(cappedAlignmentScore, viabilityGates.outboundReady);
  
  // ========== STEP 6: DETERMINE BOTTLENECK FROM GATES ==========
  const bottleneckKey = determineBottleneckFromGates(viabilityGates, latentResult.latentScores);
  
  // ========== STEP 7: COMPUTE FULL STABILIZATION CONTEXT ==========
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
  
  // ========== STEP 8: AI RECOMMENDATIONS ==========
  // Pass viability gates to AI for guardrails
  const aiInput: AIPrescriptionInput = {
    alignmentScore: cappedAlignmentScore,
    readinessLabel,
    latentScores: latentResult.latentScores,
    latentBottleneckKey: bottleneckKey,
    formData,
    stabilizationContext,
    viabilityGates, // NEW: Pass gates to AI
  };
  
  const aiResult = await generateAIPrescription(aiInput);
  
  console.log('[evaluateOfferV2] AI recommendations generated:', aiResult.recommendations.length);
  console.log('[evaluateOfferV2] Blocked recommendations:', aiResult.blockedRecommendations);
  
  // ========== STEP 9: BUILD RESULT ==========
  const result: EvaluateOfferV2Result = {
    // Core outputs — ONLY SOURCE OF TRUTH
    alignmentScore: cappedAlignmentScore,
    readinessLabel,
    latentScores: latentResult.latentScores,
    latentBottleneckKey: bottleneckKey,
    bottleneckLabel: LATENT_SCORE_LABELS[bottleneckKey],
    
    // AI-generated recommendations
    recommendations: convertToStructuredRecommendations(aiResult.recommendations),
    
    // Viability Gates (MANDATORY - PROMPT 1.E)
    outboundReady: viabilityGates.outboundReady,
    failedGate: viabilityGates.failedGate,
    viabilityGates,
    
    // Status flags
    isOptimizationLevel: aiResult.isOptimizationLevel,
    notOutboundReady: !viabilityGates.outboundReady,
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
  console.log('[evaluateOfferV2] ✓ Outbound Ready:', result.outboundReady);
  console.log('[evaluateOfferV2] ✓ Failed Gate:', result.failedGate);
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
  
  // PROMPT 1.E: Validate mandatory output contract
  if (castResult.outboundReady === undefined) {
    throw new Error('[EXECUTION HALT] Missing outboundReady in result');
  }
  if (castResult.failedGate === undefined) {
    throw new Error('[EXECUTION HALT] Missing failedGate in result');
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
  failedGate: ViabilityGateName | null;
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
  
  // Compute viability gates
  const viabilityGates = computeViabilityGates(latentResult.latentScores);
  
  // Apply score capping
  const cappedScore = applyScoreCapping(latentResult.alignmentScore, viabilityGates);
  
  // Derive readiness label
  const readinessLabel = deriveReadinessLabel(cappedScore, viabilityGates.outboundReady);
  
  // Determine bottleneck from gates
  const bottleneckKey = determineBottleneckFromGates(viabilityGates, latentResult.latentScores);
  
  // Check local optimum for UI display
  const localOptimumResult = checkLocalOptimum(latentResult.latentScores);
  
  return {
    alignmentScore: cappedScore,
    readinessLabel,
    latentScores: latentResult.latentScores,
    latentBottleneckKey: bottleneckKey,
    bottleneckLabel: LATENT_SCORE_LABELS[bottleneckKey],
    outboundReady: viabilityGates.outboundReady,
    failedGate: viabilityGates.failedGate,
    isAtLocalOptimum: localOptimumResult.isAtLocalOptimum,
  };
}