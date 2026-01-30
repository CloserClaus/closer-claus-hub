// ============= Latent Variable Scoring Engine =============
// NEW: 5 latent variables, each 0-20, total alignment = sum of all 5 (0-100)
// Implements deterministic gate-based scoring with NO averaging or normalization

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
}

export type LatentBottleneckKey = keyof LatentScores;

export type ReadinessLabel = 'Strong' | 'Moderate' | 'Weak';

export interface LatentScoringResult {
  alignmentScore: number;          // 0-100
  readinessLabel: ReadinessLabel;
  latentScores: LatentScores;
  latentBottleneckKey: LatentBottleneckKey;
  outboundReady: boolean;
  primaryBottleneck: string;
}

// ========== CONSTANTS ==========

// Viability gate thresholds (HARD GATES - PROMPT 2)
const VIABILITY_THRESHOLDS = {
  EFI: 6,              // Gate A: EFI < 6 = FAIL
  proofPromise: 7,     // Gate B: proofPromise < 7 = FAIL
  fulfillmentScalability: 8, // Gate C: fulfillmentScalability < 8 = FAIL
  channelFit: 7,       // Additional check for channel fit
};

// Bottleneck priority order for tie-breaking (PROMPT 4)
const BOTTLENECK_PRIORITY_ORDER: LatentBottleneckKey[] = [
  'EFI',
  'proofPromise',
  'fulfillmentScalability',
  'riskAlignment',
  'channelFit',
];

// Score labels for display
export const LATENT_SCORE_LABELS: Record<LatentBottleneckKey, string> = {
  EFI: 'Economic Feasibility (EFI)',
  proofPromise: 'Proof-to-Promise Credibility',
  fulfillmentScalability: 'Fulfillment Scalability',
  riskAlignment: 'Risk Alignment',
  channelFit: 'Channel Fit',
};

// ========== LATENT VARIABLE 1: EFI (0-20) ==========
// Economic Feasibility Index - measures whether pricing math works for ICP

function calculateEFI(formData: DiagnosticFormData): number {
  const { pricingStructure, performanceBasis, icpSize, icpMaturity, riskModel } = formData;
  
  // Base score by pricingStructure (PROMPT 3)
  let baseScore: number;
  switch (pricingStructure) {
    case 'performance_only': baseScore = 16; break;  // Best for small ICPs
    case 'hybrid': baseScore = 14; break;
    case 'recurring': baseScore = 11; break;
    case 'one_time': baseScore = 9; break;
    case 'usage_based': baseScore = 7; break;
    default: baseScore = 10;
  }
  
  let modifier = 0;
  
  // ICP Size modifiers (PROMPT 3)
  switch (icpSize) {
    case 'solo_founder':
    case '1_5_employees':
      // Small ICPs: retainer > $500 = penalty, performance = bonus
      if (pricingStructure === 'recurring') modifier -= 3;
      if (pricingStructure === 'performance_only') modifier += 2;
      if (pricingStructure === 'hybrid' && performanceBasis) modifier += 1;
      break;
    case '6_20_employees':
      // Mid-size: more flexible
      if (pricingStructure === 'hybrid') modifier += 2;
      break;
    case '21_100_employees':
    case '100_plus_employees':
      // Larger ICPs: can afford retainers
      if (pricingStructure === 'recurring') modifier += 2;
      break;
  }
  
  // ICP Maturity modifiers
  switch (icpMaturity) {
    case 'pre_revenue':
    case 'early_traction':
      // Early stage: performance-only = bonus
      if (pricingStructure === 'performance_only') modifier += 2;
      if (pricingStructure === 'recurring') modifier -= 2;
      break;
    case 'scaling':
      // Neutral
      break;
    case 'mature':
    case 'enterprise':
      // Established: can afford retainers
      if (pricingStructure === 'recurring') modifier += 1;
      break;
  }
  
  // Performance basis adjustments
  if (performanceBasis) {
    switch (performanceBasis) {
      case 'per_appointment': modifier += 1; break;
      case 'per_opportunity': break;
      case 'per_closed_deal': modifier -= 1; break;
      case 'percent_revenue': modifier -= 2; break;
      case 'percent_profit': modifier -= 2; break;
      case 'percent_ad_spend': modifier -= 1; break;
    }
  }
  
  // Risk model impact on EFI
  if (riskModel === 'pay_after_results' || riskModel === 'performance_only') {
    modifier += 2; // Lower friction
  } else if (riskModel === 'no_guarantee') {
    modifier -= 1; // Higher friction
  }
  
  return Math.max(0, Math.min(20, baseScore + modifier));
}

// ========== LATENT VARIABLE 2: PROOF-TO-PROMISE (0-20) ==========
// Measures whether existing proof supports the promise being made

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
  
  if (!proofLevel || !promise) return 10;
  
  const proofStrength = PROOF_STRENGTH[proofLevel];
  const demandLevel = PROMISE_DEMAND_LEVELS[promise];
  
  let score = 10; // Baseline
  
  // Proof vs Promise matching
  if (proofStrength >= demandLevel + 1) {
    score += 6; // Proof exceeds promise
  } else if (proofStrength >= demandLevel) {
    score += 3; // Proof matches promise
  } else if (proofStrength === demandLevel - 1) {
    score -= 2; // Slight gap
  } else {
    score -= 6; // Major gap
  }
  
  // Category killer bonus
  if (proofLevel === 'category_killer') {
    score += 4;
  }
  
  // ICP Specificity interaction
  if (icpSpecificity === 'broad' && ['none', 'weak'].includes(proofLevel)) {
    score -= 4; // Broad ICP + weak proof = credibility problem
  }
  if ((icpSpecificity === 'narrow' || icpSpecificity === 'exact') && proofStrength >= 2) {
    score += 2; // Narrow ICP + good proof = amplification
  }
  
  return Math.max(0, Math.min(20, score));
}

// ========== LATENT VARIABLE 3: FULFILLMENT SCALABILITY (0-20) ==========
// Measures how reliably the offer can be delivered repeatedly

function calculateFulfillmentScalability(formData: DiagnosticFormData): number {
  const { fulfillmentComplexity, pricingStructure, icpSize } = formData;
  
  if (!fulfillmentComplexity) return 10;
  
  let score = 10; // Baseline
  
  // Fulfillment type modifiers
  switch (fulfillmentComplexity) {
    case 'software_platform':
      score += 8;
      break;
    case 'package_based':
      score += 5;
      break;
    case 'coaching_advisory':
      score += 2;
      break;
    case 'custom_dfy':
      score -= 4;
      break;
    case 'staffing_placement':
      score -= 6;
      break;
  }
  
  // Pricing structure interaction
  if (pricingStructure === 'performance_only' && fulfillmentComplexity === 'custom_dfy') {
    score -= 3; // High risk combo
  }
  
  // ICP size interaction
  const largeSizes: ICPSize[] = ['21_100_employees', '100_plus_employees'];
  if (fulfillmentComplexity === 'custom_dfy' && icpSize && largeSizes.includes(icpSize)) {
    score -= 3; // Large clients + custom = scaling nightmare
  }
  
  const smallSizes: ICPSize[] = ['solo_founder', '1_5_employees'];
  if (fulfillmentComplexity === 'coaching_advisory' && icpSize && smallSizes.includes(icpSize)) {
    score += 2; // Coaching scales well for small clients
  }
  
  return Math.max(0, Math.min(20, score));
}

// ========== LATENT VARIABLE 4: RISK ALIGNMENT (0-20) ==========
// Measures whether risk exposure matches certainty

function calculateRiskAlignment(formData: DiagnosticFormData): number {
  const { riskModel, proofLevel, pricingStructure, icpMaturity } = formData;
  
  if (!riskModel || !proofLevel) return 10;
  
  let score = 10; // Baseline
  
  const hasStrongProof = ['strong', 'category_killer'].includes(proofLevel);
  const hasModerateProof = ['moderate', 'strong', 'category_killer'].includes(proofLevel);
  const hasWeakProof = ['none', 'weak'].includes(proofLevel);
  
  // Risk model + proof combinations
  if (riskModel === 'no_guarantee' && hasStrongProof) {
    score += 3; // Strong proof justifies no guarantee
  } else if (riskModel === 'no_guarantee' && hasWeakProof) {
    score -= 4; // No proof + no guarantee = high friction
  }
  
  if (riskModel === 'conditional_guarantee' && hasModerateProof) {
    score += 4; // Good balance
  }
  
  if (riskModel === 'full_guarantee' && hasWeakProof) {
    score -= 5; // Risky for provider
  }
  
  if ((riskModel === 'performance_only' || riskModel === 'pay_after_results') && hasWeakProof) {
    score -= 4; // High risk without proof
  } else if ((riskModel === 'performance_only' || riskModel === 'pay_after_results') && hasStrongProof) {
    score += 4; // Great combo
  }
  
  // ICP maturity interaction
  if (icpMaturity === 'enterprise' && riskModel === 'no_guarantee') {
    score -= 2; // Enterprise expects some guarantees
  }
  
  return Math.max(0, Math.min(20, score));
}

// ========== LATENT VARIABLE 5: CHANNEL FIT (0-20) ==========
// Measures whether outbound is the correct GTM channel

function calculateChannelFit(formData: DiagnosticFormData): number {
  const { offerType, promise, proofLevel, icpMaturity, icpSize } = formData;
  
  if (!offerType || !promise) return 10;
  
  let score = 10; // Baseline
  
  // Offer type + promise combinations
  const isDemandCapture = offerType === 'demand_capture';
  const isOutboundEnablement = offerType === 'outbound_sales_enablement';
  const isDemandCreation = offerType === 'demand_creation';
  const isRetention = offerType === 'retention_monetization';
  const isOperational = offerType === 'operational_enablement';
  
  const isLeadsPipeline = ['top_of_funnel_volume', 'mid_funnel_engagement'].includes(promise);
  const isRevenue = promise === 'top_line_revenue';
  const isEfficiency = promise === 'efficiency_cost_savings' || promise === 'ops_compliance_outcomes';
  
  // Best channel fit combinations
  if ((isDemandCapture || isOutboundEnablement) && isLeadsPipeline) {
    score += 5; // Perfect for outbound
  } else if (isOutboundEnablement && isRevenue) {
    score += 4;
  } else if (isRetention) {
    score -= 3; // Retention is better for existing customers
  } else if (isOperational && isEfficiency) {
    score -= 4; // Operational offers harder to sell outbound
  }
  
  // Low proof + revenue promise via outbound = poor fit
  const hasLowProof = !proofLevel || ['none', 'weak'].includes(proofLevel);
  if (hasLowProof && isRevenue) {
    score -= 5;
  }
  
  // ICP maturity interaction
  if (icpMaturity === 'pre_revenue') {
    score -= 2; // Pre-revenue companies hard to reach outbound
  }
  if (icpMaturity === 'enterprise') {
    score += 2; // Enterprise buying behavior suits outbound
  }
  
  // ICP size interaction
  if (icpSize === 'solo_founder') {
    score -= 2; // Solo founders hard to reach
  }
  if (icpSize === '21_100_employees' || icpSize === '100_plus_employees') {
    score += 2; // Larger companies more receptive to outbound
  }
  
  return Math.max(0, Math.min(20, score));
}

// ========== VIABILITY GATES (PROMPT 2) ==========
// Hard gates that MUST pass for outboundReady = true

interface ViabilityGateResult {
  passed: boolean;
  failedGate: LatentBottleneckKey | null;
  blockReason: string | null;
}

function evaluateViabilityGates(latentScores: LatentScores): ViabilityGateResult {
  // Gate A: Economic Feasibility
  if (latentScores.EFI < VIABILITY_THRESHOLDS.EFI) {
    return {
      passed: false,
      failedGate: 'EFI',
      blockReason: 'Economic Feasibility',
    };
  }
  
  // Gate B: Proof-to-Promise Credibility
  if (latentScores.proofPromise < VIABILITY_THRESHOLDS.proofPromise) {
    return {
      passed: false,
      failedGate: 'proofPromise',
      blockReason: 'Proof-to-Promise Credibility',
    };
  }
  
  // Gate C: Fulfillment Scalability
  if (latentScores.fulfillmentScalability < VIABILITY_THRESHOLDS.fulfillmentScalability) {
    return {
      passed: false,
      failedGate: 'fulfillmentScalability',
      blockReason: 'Fulfillment Scalability',
    };
  }
  
  // All gates passed
  return {
    passed: true,
    failedGate: null,
    blockReason: null,
  };
}

// ========== BOTTLENECK SELECTION (PROMPT 4) ==========
// Short-circuit: if gate failed, that's the bottleneck
// Otherwise: lowest latent score wins, with priority order for ties

function selectBottleneck(
  latentScores: LatentScores,
  gateResult: ViabilityGateResult
): LatentBottleneckKey {
  // If a gate failed, that's the bottleneck (SHORT-CIRCUIT)
  if (!gateResult.passed && gateResult.failedGate) {
    return gateResult.failedGate;
  }
  
  // Find lowest scoring latent
  const entries = Object.entries(latentScores) as [LatentBottleneckKey, number][];
  const minScore = Math.min(...entries.map(([, score]) => score));
  
  // Find all latents with the minimum score
  const lowestLatents = entries
    .filter(([, score]) => score === minScore)
    .map(([key]) => key);
  
  // Use priority order to break ties
  for (const key of BOTTLENECK_PRIORITY_ORDER) {
    if (lowestLatents.includes(key)) {
      return key;
    }
  }
  
  // Fallback (should never reach here)
  return 'EFI';
}

// ========== ALIGNMENT SCORE (PROMPT 5) ==========
// Simple sum of all 5 latents, NO scaling, NO smoothing

function calculateAlignmentScore(latentScores: LatentScores): number {
  const sum = 
    latentScores.EFI +
    latentScores.proofPromise +
    latentScores.fulfillmentScalability +
    latentScores.riskAlignment +
    latentScores.channelFit;
  
  // Sum is already 0-100 (5 latents × 20 max each)
  return Math.max(0, Math.min(100, sum));
}

// ========== READINESS LABEL ==========

function getReadinessLabel(alignmentScore: number, outboundReady: boolean): ReadinessLabel {
  if (!outboundReady) return 'Weak';
  if (alignmentScore >= 75) return 'Strong';
  if (alignmentScore >= 50) return 'Moderate';
  return 'Weak';
}

// ========== FORM VALIDATION ==========

function isFormComplete(formData: DiagnosticFormData): boolean {
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
  
  // Calculate all 5 latent scores
  const latentScores: LatentScores = {
    EFI: calculateEFI(formData),
    proofPromise: calculateProofPromise(formData),
    fulfillmentScalability: calculateFulfillmentScalability(formData),
    riskAlignment: calculateRiskAlignment(formData),
    channelFit: calculateChannelFit(formData),
  };
  
  // Evaluate viability gates
  const gateResult = evaluateViabilityGates(latentScores);
  
  // Calculate alignment score (simple sum)
  const alignmentScore = calculateAlignmentScore(latentScores);
  
  // Determine outbound readiness
  const outboundReady = gateResult.passed;
  
  // Select primary bottleneck
  const latentBottleneckKey = selectBottleneck(latentScores, gateResult);
  
  // Get readiness label
  const readinessLabel = getReadinessLabel(alignmentScore, outboundReady);
  
  // Get bottleneck label
  const primaryBottleneck = LATENT_SCORE_LABELS[latentBottleneckKey];
  
  return {
    alignmentScore,
    readinessLabel,
    latentScores,
    latentBottleneckKey,
    outboundReady,
    primaryBottleneck,
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
};
