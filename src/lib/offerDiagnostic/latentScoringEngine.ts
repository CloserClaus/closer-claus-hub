// ============= Latent Variable Scoring Engine =============
// NEW: 6 latent variables with HARD + SOFT viability gates
// Implements deterministic gate-based scoring with score caps and decompression

import type {
  DiagnosticFormData,
  ICPSize,
  ICPMaturity,
  PricingStructure,
  FulfillmentComplexity,
  RiskModel,
  ProofLevel,
  PromiseBucket,
  OfferType,
  ICPSpecificity,
} from './types';

// ========== TYPES ==========

export interface LatentScores {
  EFI: number;                      // 0-20: Economic Feasibility Index
  proofPromise: number;             // 0-20: Proof-to-Promise Credibility
  fulfillmentScalability: number;   // 0-20: Fulfillment Scalability
  riskAlignment: number;            // 0-20: Risk Alignment
  channelFit: number;               // 0-20: Channel Fit
  icpSpecificity: number;           // 0-20: ICP Specificity Strength
}

export type LatentBottleneckKey = keyof LatentScores;

export type ReadinessLabel = 'Strong' | 'Moderate' | 'Weak';

export type BottleneckSeverity = 'blocking' | 'constraining';

export interface PrimaryBottleneck {
  dimension: LatentBottleneckKey;
  severity: BottleneckSeverity;
  explanation: string;
}

export interface LatentScoringResult {
  alignmentScore: number;          // 0-100
  readinessLabel: ReadinessLabel;
  latentScores: LatentScores;
  latentBottleneckKey: LatentBottleneckKey;
  outboundReady: boolean;
  primaryBottleneck: PrimaryBottleneck;
  triggeredHardGates: string[];
  triggeredSoftGates: string[];
  scoreCap: number | null;
}

// ========== CONSTANTS ==========

// HARD VIABILITY GATE THRESHOLDS (from Prompt 1)
// If ANY of these fail, outbound is BLOCKED
const HARD_GATE_THRESHOLDS = {
  EFI: 4,                    // EFI ≤ 4 = BLOCKED
  proofPromise: 6,           // ProofToPromise ≤ 6 = BLOCKED
  fulfillmentScalability: 6, // FulfillmentScalability ≤ 6 = BLOCKED
  channelFit: 6,             // ChannelFit ≤ 6 = BLOCKED
};

// BOTTLENECK DOMINANCE ORDER (from Prompt 2)
// Used for tie-breaking and hierarchy
const BOTTLENECK_DOMINANCE_ORDER: LatentBottleneckKey[] = [
  'EFI',
  'proofPromise',
  'fulfillmentScalability',
  'channelFit',
  'riskAlignment',
  'icpSpecificity',
];

// Score labels for display
export const LATENT_SCORE_LABELS: Record<LatentBottleneckKey, string> = {
  EFI: 'Economic Feasibility (EFI)',
  proofPromise: 'Proof-to-Promise Credibility',
  fulfillmentScalability: 'Fulfillment Scalability',
  riskAlignment: 'Risk Alignment',
  channelFit: 'Channel Fit',
  icpSpecificity: 'ICP Specificity',
};

// ========== LATENT VARIABLE 1: EFI (0-20) ==========

function calculateEFI(formData: DiagnosticFormData): number {
  const { pricingStructure, performanceBasis, icpSize, icpMaturity, riskModel } = formData;
  
  let baseScore: number;
  switch (pricingStructure) {
    case 'performance_only': baseScore = 16; break;
    case 'hybrid': baseScore = 14; break;
    case 'recurring': baseScore = 11; break;
    case 'one_time': baseScore = 9; break;
    case 'usage_based': baseScore = 7; break;
    default: baseScore = 10;
  }
  
  let modifier = 0;
  
  // ICP Size modifiers
  switch (icpSize) {
    case 'solo_founder':
    case '1_5_employees':
      if (pricingStructure === 'recurring') modifier -= 4;
      if (pricingStructure === 'performance_only') modifier += 3;
      if (pricingStructure === 'hybrid' && performanceBasis) modifier += 1;
      break;
    case '6_20_employees':
      if (pricingStructure === 'hybrid') modifier += 2;
      break;
    case '21_100_employees':
    case '100_plus_employees':
      if (pricingStructure === 'recurring') modifier += 3;
      break;
  }
  
  // ICP Maturity modifiers
  switch (icpMaturity) {
    case 'pre_revenue':
    case 'early_traction':
      if (pricingStructure === 'performance_only') modifier += 3;
      if (pricingStructure === 'recurring') modifier -= 3;
      break;
    case 'scaling':
      break;
    case 'mature':
    case 'enterprise':
      if (pricingStructure === 'recurring') modifier += 2;
      break;
  }
  
  // Performance basis adjustments
  if (performanceBasis) {
    switch (performanceBasis) {
      case 'per_appointment': modifier += 2; break;
      case 'per_opportunity': modifier += 1; break;
      case 'per_closed_deal': modifier -= 1; break;
      case 'percent_revenue': modifier -= 3; break;
      case 'percent_profit': modifier -= 3; break;
      case 'percent_ad_spend': modifier -= 2; break;
    }
  }
  
  // Risk model impact on EFI
  if (riskModel === 'pay_after_results' || riskModel === 'performance_only') {
    modifier += 3;
  } else if (riskModel === 'no_guarantee') {
    modifier -= 2;
  }
  
  return Math.max(0, Math.min(20, baseScore + modifier));
}

// ========== LATENT VARIABLE 2: PROOF-TO-PROMISE (0-20) ==========

const PROOF_STRENGTH: Record<ProofLevel, number> = {
  none: 0,
  weak: 1,
  moderate: 2,
  strong: 3,
  category_killer: 4,
};

type PromiseDemandLevel = 1 | 2 | 3;

const PROMISE_DEMAND_LEVELS: Record<PromiseBucket, PromiseDemandLevel> = {
  top_of_funnel_volume: 1,
  mid_funnel_engagement: 2,
  top_line_revenue: 3,
  efficiency_cost_savings: 1,
  ops_compliance_outcomes: 1,
};

function calculateProofPromise(formData: DiagnosticFormData): number {
  const { proofLevel, promise, icpSpecificity } = formData;
  
  if (!proofLevel || !promise) return 8;
  
  const proofStrength = PROOF_STRENGTH[proofLevel];
  const demandLevel = PROMISE_DEMAND_LEVELS[promise];
  
  let score = 10;
  
  // Proof vs Promise matching with wider spread
  if (proofStrength >= demandLevel + 1) {
    score += 8;
  } else if (proofStrength >= demandLevel) {
    score += 4;
  } else if (proofStrength === demandLevel - 1) {
    score -= 4;
  } else {
    score -= 8;
  }
  
  // Category killer bonus
  if (proofLevel === 'category_killer') {
    score += 4;
  }
  
  // ICP Specificity interaction
  if (icpSpecificity === 'broad' && ['none', 'weak'].includes(proofLevel)) {
    score -= 6;
  }
  if ((icpSpecificity === 'narrow' || icpSpecificity === 'exact') && proofStrength >= 2) {
    score += 3;
  }
  
  return Math.max(0, Math.min(20, score));
}

// ========== LATENT VARIABLE 3: FULFILLMENT SCALABILITY (0-20) ==========

function calculateFulfillmentScalability(formData: DiagnosticFormData): number {
  const { fulfillmentComplexity, pricingStructure, icpSize } = formData;
  
  if (!fulfillmentComplexity) return 8;
  
  let score = 10;
  
  switch (fulfillmentComplexity) {
    case 'software_platform':
      score += 10;
      break;
    case 'package_based':
      score += 6;
      break;
    case 'coaching_advisory':
      score += 2;
      break;
    case 'custom_dfy':
      score -= 5;
      break;
    case 'staffing_placement':
      score -= 8;
      break;
  }
  
  // Pricing structure interaction
  if (pricingStructure === 'performance_only' && fulfillmentComplexity === 'custom_dfy') {
    score -= 4;
  }
  
  // ICP size interaction
  const largeSizes: ICPSize[] = ['21_100_employees', '100_plus_employees'];
  if (fulfillmentComplexity === 'custom_dfy' && icpSize && largeSizes.includes(icpSize)) {
    score -= 4;
  }
  
  const smallSizes: ICPSize[] = ['solo_founder', '1_5_employees'];
  if (fulfillmentComplexity === 'coaching_advisory' && icpSize && smallSizes.includes(icpSize)) {
    score += 2;
  }
  
  return Math.max(0, Math.min(20, score));
}

// ========== LATENT VARIABLE 4: RISK ALIGNMENT (0-20) ==========

function calculateRiskAlignment(formData: DiagnosticFormData): number {
  const { riskModel, proofLevel, pricingStructure, icpMaturity } = formData;
  
  if (!riskModel || !proofLevel) return 8;
  
  let score = 10;
  
  const hasStrongProof = ['strong', 'category_killer'].includes(proofLevel);
  const hasModerateProof = ['moderate', 'strong', 'category_killer'].includes(proofLevel);
  const hasWeakProof = ['none', 'weak'].includes(proofLevel);
  
  if (riskModel === 'no_guarantee' && hasStrongProof) {
    score += 4;
  } else if (riskModel === 'no_guarantee' && hasWeakProof) {
    score -= 5;
  }
  
  if (riskModel === 'conditional_guarantee' && hasModerateProof) {
    score += 5;
  }
  
  if (riskModel === 'full_guarantee' && hasWeakProof) {
    score -= 6;
  }
  
  if ((riskModel === 'performance_only' || riskModel === 'pay_after_results') && hasWeakProof) {
    score -= 5;
  } else if ((riskModel === 'performance_only' || riskModel === 'pay_after_results') && hasStrongProof) {
    score += 5;
  }
  
  if (icpMaturity === 'enterprise' && riskModel === 'no_guarantee') {
    score -= 3;
  }
  
  return Math.max(0, Math.min(20, score));
}

// ========== LATENT VARIABLE 5: CHANNEL FIT (0-20) ==========
// REFACTORED: Channel Fit should ONLY answer one question:
// "Can this offer be SOLD EFFECTIVELY via outbound?"
// It should NOT judge: overall offer quality, pricing attractiveness,
// fulfillment scalability, or ICP purchasing power (those are handled by other latents).

interface ChannelFitResult {
  score: number; // 0–20
  blocking: boolean;
  reason?: string;
}

function deriveChannelFit(formData: DiagnosticFormData): ChannelFitResult {
  const { offerType, fulfillmentComplexity, promise } = formData;

  // 1. HARD OUTBOUND-COMPATIBLE CASES (DEFAULT PASS)
  // These should NEVER score below 14/20 on channel fit
  const outboundCompatibleOfferTypes = [
    'demand_capture',
    'demand_creation',
    'outbound_sales_enablement',
    'retention_monetization',
  ];

  if (offerType && outboundCompatibleOfferTypes.includes(offerType)) {
    return {
      score: 16,
      blocking: false,
    };
  }

  // 2. CONDITIONAL COMPATIBILITY (MINOR FRICTION, NOT BLOCKING)
  if (
    offerType === 'operational_enablement' &&
    fulfillmentComplexity === 'package_based'
  ) {
    return {
      score: 14,
      blocking: false,
    };
  }

  // 3. TRUE CHANNEL MISMATCH (RARE, STRUCTURAL ONLY)
  // Note: We check for promises that are not directly triggerable via outbound
  const outboundIncompatiblePromises = [
    'brand_awareness_only',
    'organic_growth_only',
  ];

  if (promise && outboundIncompatiblePromises.includes(promise)) {
    return {
      score: 6,
      blocking: true,
      reason: 'Promise is not directly triggerable via outbound',
    };
  }

  // 4. DEFAULT SAFE FALLBACK (DO NOT OVER-PENALIZE)
  return {
    score: 12,
    blocking: false,
  };
}

// Wrapper for compatibility with existing calculateChannelFit signature
function calculateChannelFit(formData: DiagnosticFormData): number {
  return deriveChannelFit(formData).score;
}

// Export for use in viability gates
export { deriveChannelFit };

// ========== LATENT VARIABLE 6: ICP SPECIFICITY (0-20) ==========

function calculateICPSpecificity(formData: DiagnosticFormData): number {
  const { icpSpecificity, proofLevel } = formData;
  
  if (!icpSpecificity) return 10;
  
  let score = 10;
  
  switch (icpSpecificity) {
    case 'exact':
      score += 8;
      break;
    case 'narrow':
      score += 4;
      break;
    case 'broad':
      score -= 4;
      break;
  }
  
  // Proof level interaction
  if (icpSpecificity === 'broad' && proofLevel && ['none', 'weak'].includes(proofLevel)) {
    score -= 4;
  }
  
  if (icpSpecificity === 'exact' && proofLevel && ['strong', 'category_killer'].includes(proofLevel)) {
    score += 2;
  }
  
  return Math.max(0, Math.min(20, score));
}

// ========== HARD VIABILITY GATES (PROMPT 1) ==========

interface HardGateResult {
  passed: boolean;
  triggeredGates: string[];
  failedDimension: LatentBottleneckKey | null;
}

function evaluateHardGates(latentScores: LatentScores, formData: DiagnosticFormData): HardGateResult {
  const triggeredGates: string[] = [];
  let firstFailedDimension: LatentBottleneckKey | null = null;
  
  // Gate 1: EFI ≤ 4
  if (latentScores.EFI <= HARD_GATE_THRESHOLDS.EFI) {
    triggeredGates.push('Economic Feasibility');
    if (!firstFailedDimension) firstFailedDimension = 'EFI';
  }
  
  // Gate 2: ProofToPromise ≤ 6
  if (latentScores.proofPromise <= HARD_GATE_THRESHOLDS.proofPromise) {
    triggeredGates.push('Proof-to-Promise Credibility');
    if (!firstFailedDimension) firstFailedDimension = 'proofPromise';
  }
  
  // Gate 3: FulfillmentScalability ≤ 6
  if (latentScores.fulfillmentScalability <= HARD_GATE_THRESHOLDS.fulfillmentScalability) {
    triggeredGates.push('Fulfillment Scalability');
    if (!firstFailedDimension) firstFailedDimension = 'fulfillmentScalability';
  }
  
  // Gate 4: ChannelFit ≤ 6
  if (latentScores.channelFit <= HARD_GATE_THRESHOLDS.channelFit) {
    triggeredGates.push('Channel Fit');
    if (!firstFailedDimension) firstFailedDimension = 'channelFit';
  }
  
  // Gate 5: ICPSpecificity = Broad AND ProofLevel ≤ Moderate
  if (formData.icpSpecificity === 'broad' && 
      formData.proofLevel && ['none', 'weak', 'moderate'].includes(formData.proofLevel)) {
    triggeredGates.push('ICP Specificity + Proof');
    if (!firstFailedDimension) firstFailedDimension = 'icpSpecificity';
  }
  
  return {
    passed: triggeredGates.length === 0,
    triggeredGates,
    failedDimension: firstFailedDimension,
  };
}

// ========== SOFT VIABILITY GATES (PROMPT 1) ==========

interface SoftGateResult {
  triggeredGates: string[];
  scorePressure: number;
}

function evaluateSoftGates(latentScores: LatentScores, formData: DiagnosticFormData): SoftGateResult {
  const triggeredGates: string[] = [];
  let scorePressure = 0;
  
  // Soft Gate 1: EFI between 5–7 → minus 5
  if (latentScores.EFI >= 5 && latentScores.EFI <= 7) {
    triggeredGates.push('EFI in marginal range (5-7)');
    scorePressure += 5;
  }
  
  // Soft Gate 2: ProofLevel = Moderate AND PromiseType = VolumeBased → minus 5
  if (formData.proofLevel === 'moderate' && formData.promise === 'top_of_funnel_volume') {
    triggeredGates.push('Moderate proof with volume-based promise');
    scorePressure += 5;
  }
  
  // Soft Gate 3: HybridPricing AND ICPSegment size = 1–5 employees → minus 5
  if (formData.pricingStructure === 'hybrid' && 
      formData.icpSize && ['solo_founder', '1_5_employees'].includes(formData.icpSize)) {
    triggeredGates.push('Hybrid pricing with small ICP');
    scorePressure += 5;
  }
  
  // Soft Gate 4: ConditionalGuarantee AND ProofLevel = Low → minus 5
  if (formData.riskModel === 'conditional_guarantee' && 
      formData.proofLevel && ['none', 'weak'].includes(formData.proofLevel)) {
    triggeredGates.push('Conditional guarantee with low proof');
    scorePressure += 5;
  }
  
  return {
    triggeredGates,
    scorePressure,
  };
}

// ========== SCORE CAPS (PROMPT 1) ==========

function calculateScoreCap(
  hardGateResult: HardGateResult,
  softGateResult: SoftGateResult,
  latentScores: LatentScores
): number | null {
  // Cap 1: Any HARD gate triggered → max score = 49
  if (!hardGateResult.passed) {
    return 49;
  }
  
  // Cap 2: Three or more SOFT gates triggered → max score = 64
  if (softGateResult.triggeredGates.length >= 3) {
    return 64;
  }
  
  // Cap 3: EFI ≤ 7 → max score = 69
  if (latentScores.EFI <= 7) {
    return 69;
  }
  
  return null;
}

// ========== BOTTLENECK SELECTION WITH DOMINANCE (PROMPT 2) ==========

function selectBottleneckWithDominance(
  latentScores: LatentScores,
  hardGateResult: HardGateResult
): PrimaryBottleneck {
  // RULE 1: If ANY hard gate failed, that's the bottleneck (SHORT-CIRCUIT)
  if (!hardGateResult.passed && hardGateResult.failedDimension) {
    return {
      dimension: hardGateResult.failedDimension,
      severity: 'blocking',
      explanation: `Outbound is blocked due to ${LATENT_SCORE_LABELS[hardGateResult.failedDimension]}. This must be fixed before any other optimizations.`,
    };
  }
  
  // RULE 2: Find lowest score using dominance hierarchy for tie-breaking
  const entries = Object.entries(latentScores) as [LatentBottleneckKey, number][];
  const minScore = Math.min(...entries.map(([, score]) => score));
  
  // Find all latents at the minimum score
  const lowestLatents = entries
    .filter(([, score]) => score === minScore)
    .map(([key]) => key);
  
  // Use dominance order to break ties (higher in list = higher priority)
  let selectedBottleneck: LatentBottleneckKey = lowestLatents[0];
  for (const key of BOTTLENECK_DOMINANCE_ORDER) {
    if (lowestLatents.includes(key)) {
      selectedBottleneck = key;
      break;
    }
  }
  
  return {
    dimension: selectedBottleneck,
    severity: 'constraining',
    explanation: `${LATENT_SCORE_LABELS[selectedBottleneck]} is your primary constraint limiting outbound effectiveness.`,
  };
}

// ========== ALIGNMENT SCORE (DECOMPRESSED) ==========

function calculateAlignmentScore(
  latentScores: LatentScores,
  softGatePressure: number,
  scoreCap: number | null
): number {
  // Base sum of all 6 latents (max 120)
  const sum = 
    latentScores.EFI +
    latentScores.proofPromise +
    latentScores.fulfillmentScalability +
    latentScores.riskAlignment +
    latentScores.channelFit +
    latentScores.icpSpecificity;
  
  // Scale to 0-100 (120 max → 100)
  let score = Math.round((sum / 120) * 100);
  
  // Apply soft gate pressure
  score = Math.max(0, score - softGatePressure);
  
  // Apply score cap if present
  if (scoreCap !== null) {
    score = Math.min(score, scoreCap);
  }
  
  return Math.max(0, Math.min(100, score));
}

// ========== READINESS LABEL ==========

function getReadinessLabel(alignmentScore: number, outboundReady: boolean): ReadinessLabel {
  if (!outboundReady || alignmentScore < 50) return 'Weak';
  if (alignmentScore >= 75) return 'Strong';
  if (alignmentScore >= 50) return 'Moderate';
  return 'Weak';
}

// ========== FORM VALIDATION ==========

function isFormComplete(formData: DiagnosticFormData): boolean {
  const { 
    offerType, promise, icpIndustry, verticalSegment,
    icpSize, icpMaturity, icpSpecificity, pricingStructure, riskModel, 
    fulfillmentComplexity, proofLevel
  } = formData;
  
  if (!offerType || !promise || !icpIndustry || !verticalSegment || 
      !icpSize || !icpMaturity || !icpSpecificity || !pricingStructure || !riskModel || 
      !fulfillmentComplexity || !proofLevel) {
    return false;
  }

  if (pricingStructure === 'recurring' && !formData.recurringPriceTier) return false;
  if (pricingStructure === 'one_time' && !formData.oneTimePriceTier) return false;
  if (pricingStructure === 'usage_based' && (!formData.usageOutputType || !formData.usageVolumeTier)) return false;
  if (pricingStructure === 'hybrid' && (!formData.hybridRetainerTier || !formData.performanceBasis || !formData.performanceCompTier)) return false;
  if (pricingStructure === 'performance_only' && (!formData.performanceBasis || !formData.performanceCompTier)) return false;

  return true;
}

// ========== MAIN SCORING FUNCTION ==========

export interface LatentScoringOptions {
  pricingCanBeBottleneck?: boolean;
}

export function calculateLatentScores(
  formData: DiagnosticFormData,
  _options: LatentScoringOptions = {}
): LatentScoringResult | null {
  if (!isFormComplete(formData)) {
    return null;
  }
  
  // ========== STEP 1: Compute latent scores ==========
  const latentScores: LatentScores = {
    EFI: calculateEFI(formData),
    proofPromise: calculateProofPromise(formData),
    fulfillmentScalability: calculateFulfillmentScalability(formData),
    riskAlignment: calculateRiskAlignment(formData),
    channelFit: calculateChannelFit(formData),
    icpSpecificity: calculateICPSpecificity(formData),
  };
  
  // ========== STEP 2: Apply Viability Gates ==========
  const hardGateResult = evaluateHardGates(latentScores, formData);
  const softGateResult = evaluateSoftGates(latentScores, formData);
  
  // ========== STEP 3: Apply Score Caps ==========
  const scoreCap = calculateScoreCap(hardGateResult, softGateResult, latentScores);
  
  // ========== STEP 4: Compute final Alignment Score ==========
  const alignmentScore = calculateAlignmentScore(
    latentScores, 
    softGateResult.scorePressure,
    scoreCap
  );
  
  // ========== STEP 5: Output outboundReady boolean ==========
  const outboundReady = hardGateResult.passed;
  
  // ========== STEP 6: Select Primary Bottleneck with Dominance ==========
  const primaryBottleneck = selectBottleneckWithDominance(latentScores, hardGateResult);
  
  // Get readiness label
  const readinessLabel = getReadinessLabel(alignmentScore, outboundReady);
  
  return {
    alignmentScore,
    readinessLabel,
    latentScores,
    latentBottleneckKey: primaryBottleneck.dimension,
    outboundReady,
    primaryBottleneck,
    triggeredHardGates: hardGateResult.triggeredGates,
    triggeredSoftGates: softGateResult.triggeredGates,
    scoreCap,
  };
}

// ========== AI RECOMMENDATION CATEGORY MAPPING ==========

export type AIRecommendationCategory = 
  | 'pricing_shift' 
  | 'icp_shift' 
  | 'promise_shift' 
  | 'fulfillment_shift' 
  | 'risk_shift' 
  | 'channel_shift';

export const BOTTLENECK_ALLOWED_CATEGORIES: Record<LatentBottleneckKey, AIRecommendationCategory[]> = {
  EFI: ['pricing_shift', 'icp_shift'],
  proofPromise: ['promise_shift'],
  fulfillmentScalability: ['fulfillment_shift'],
  riskAlignment: ['risk_shift'],
  channelFit: ['channel_shift'],
  icpSpecificity: ['icp_shift'],
};
