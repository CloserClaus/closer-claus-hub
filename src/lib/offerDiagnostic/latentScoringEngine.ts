// ============= Latent Variable Scoring Engine =============
// Replaces legacy dimension scoring with 6 latent variables
// Each latent variable scores 0-20, total alignment = sum of all 6 (0-120, scaled to 0-100)

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
  VerticalSegment,
  ICPSpecificity,
} from './types';

// ========== TYPES ==========

export interface LatentScores {
  economicHeadroom: number;       // 0-20 (derived from EFI)
  proofToPromise: number;         // 0-20
  fulfillmentScalability: number; // 0-20
  riskAlignment: number;          // 0-20
  channelFit: number;             // 0-20
  icpSpecificityStrength: number; // 0-20 (NEW)
}

export type LatentBottleneckKey = keyof LatentScores;

export type ReadinessLabel = 'Strong' | 'Moderate' | 'Weak';

// ========== ECONOMIC FRICTION INDEX (EFI) ==========
// Categorical system that replaces static pricing logic

export type EFIClass = 'VeryLow' | 'Low' | 'Moderate' | 'High' | 'Extreme';

const EFI_ORDER: EFIClass[] = ['VeryLow', 'Low', 'Moderate', 'High', 'Extreme'];

function clampEFI(index: number): EFIClass {
  const clamped = Math.max(0, Math.min(4, index));
  return EFI_ORDER[clamped];
}

function getEFIIndex(efi: EFIClass): number {
  return EFI_ORDER.indexOf(efi);
}

function shiftEFI(baseEFI: EFIClass, delta: number): EFIClass {
  const currentIndex = getEFIIndex(baseEFI);
  return clampEFI(currentIndex + delta);
}

// EFI Computation Logic
export function calculateEFI(formData: DiagnosticFormData): EFIClass {
  const { pricingStructure, performanceBasis, icpSize, icpMaturity, riskModel } = formData;
  
  // Base friction by pricingStructure
  let baseIndex: number;
  switch (pricingStructure) {
    case 'performance_only': baseIndex = 1; break; // Low
    case 'hybrid': baseIndex = 1.5; break; // Low-Moderate (rounds to 1-2)
    case 'recurring': baseIndex = 2; break; // Moderate
    case 'one_time': baseIndex = 2.5; break; // Moderate-High
    case 'usage_based': baseIndex = 3; break; // High
    default: baseIndex = 2; // Default Moderate
  }
  
  let modifier = 0;
  
  // Performance Basis modifiers (if applicable)
  if (performanceBasis) {
    switch (performanceBasis) {
      case 'per_appointment': modifier -= 1; break;
      case 'per_opportunity': modifier += 0; break;
      case 'per_closed_deal': modifier += 0; break;
      case 'percent_revenue': modifier += 1; break;
      case 'percent_profit': modifier += 1; break;
      case 'percent_ad_spend': modifier += 1; break;
    }
  }
  
  // ICP Size modifiers
  switch (icpSize) {
    case 'solo_founder':
    case '1_5_employees':
      modifier += 1;
      break;
    case '6_20_employees':
      modifier += 0;
      break;
    case '21_100_employees':
    case '100_plus_employees':
      modifier -= 1;
      break;
  }
  
  // ICP Maturity modifiers
  switch (icpMaturity) {
    case 'early_traction':
    case 'pre_revenue':
      modifier += 1;
      break;
    case 'scaling':
      modifier += 0;
      break;
    case 'mature':
    case 'enterprise':
      modifier -= 1;
      break;
  }
  
  // Risk Model modifiers
  switch (riskModel) {
    case 'no_guarantee':
      modifier += 1;
      break;
    case 'conditional_guarantee':
      modifier += 0;
      break;
    case 'full_guarantee':
    case 'performance_only':
    case 'pay_after_results':
      modifier -= 1;
      break;
  }
  
  // Calculate final EFI
  const finalIndex = Math.round(baseIndex + modifier);
  return clampEFI(finalIndex);
}

// Map EFI to Economic Headroom score (0-20)
export function mapEFIToScore(efi: EFIClass): number {
  switch (efi) {
    case 'VeryLow': return 19; // 18-20 range
    case 'Low': return 16; // 15-17 range
    case 'Moderate': return 12; // 11-14 range
    case 'High': return 8; // 6-10 range
    case 'Extreme': return 3; // 0-5 range
    default: return 12;
  }
}

export interface LatentScoringResult {
  alignmentScore: number;          // 0-100
  readinessLabel: ReadinessLabel;
  latentScores: LatentScores;
  latentBottleneckKey: LatentBottleneckKey;
  efiClass: EFIClass;              // NEW: expose EFI class for AI
}

// ========== LATENT VARIABLE 1: ECONOMIC HEADROOM (0-20) ==========
// Now derived entirely from EFI — replaces pricingFit and buyingPower

function calculateEconomicHeadroom(formData: DiagnosticFormData): { score: number; efiClass: EFIClass } {
  const efiClass = calculateEFI(formData);
  const score = mapEFIToScore(efiClass);
  return { score, efiClass };
}

// ========== LATENT VARIABLE 2: PROOF-TO-PROMISE CREDIBILITY (0-20) ==========
// Measures whether proof level justifies the promise being made
// Now integrates with ICP Specificity

type PromiseDemandLevel = 1 | 2 | 3;

const PROMISE_DEMAND_LEVELS: Record<PromiseBucket, PromiseDemandLevel> = {
  top_of_funnel_volume: 1,    // Awareness / Leads
  mid_funnel_engagement: 2,   // Pipeline
  top_line_revenue: 3,        // Direct Revenue
  efficiency_cost_savings: 1, // Ops
  ops_compliance_outcomes: 1, // Compliance
};

const PROOF_STRENGTH: Record<ProofLevel, number> = {
  none: 0,
  weak: 1,
  moderate: 2,
  strong: 3,
  category_killer: 4,
};

function calculateProofToPromise(formData: DiagnosticFormData): number {
  let score = 10; // Baseline
  
  const { proofLevel, promise, icpSpecificity } = formData;
  
  if (!proofLevel || !promise) return score;
  
  const proofStrength = PROOF_STRENGTH[proofLevel];
  const demandLevel = PROMISE_DEMAND_LEVELS[promise];
  
  if (proofStrength >= demandLevel) {
    score += 4;
  } else if (proofStrength === demandLevel - 1) {
    score += 1;
  } else {
    score -= 6;
  }
  
  // Category killer with conservative promise bonus
  if (proofLevel === 'category_killer' && demandLevel <= 2) {
    score += 6;
  }
  
  // ICP Specificity interaction with proof
  // Broad ICP + Moderate/Weak proof → credibility penalty
  if (icpSpecificity === 'broad' && ['none', 'weak'].includes(proofLevel)) {
    score -= 3;
  }
  // Narrow/Exact ICP → proof amplification
  if ((icpSpecificity === 'narrow' || icpSpecificity === 'exact') && proofStrength >= 2) {
    score += 2;
  }
  
  return Math.max(0, Math.min(20, score));
}

// ========== LATENT VARIABLE 3: FULFILLMENT SCALABILITY (0-20) ==========
// Measures how reliably the offer can be delivered repeatedly

function calculateFulfillmentScalability(formData: DiagnosticFormData): number {
  let score = 10; // Baseline
  
  const { fulfillmentComplexity, icpSize } = formData;
  
  if (!fulfillmentComplexity) return score;
  
  // Fulfillment type modifiers
  switch (fulfillmentComplexity) {
    case 'software_platform':
      score += 6;
      break;
    case 'package_based':
      score += 4;
      break;
    case 'coaching_advisory':
      score += 2;
      break;
    case 'custom_dfy':
      score -= 3;
      break;
    case 'staffing_placement':
      score -= 5;
      break;
  }
  
  // Large ICP size with custom DFY penalty
  const largeSizes: ICPSize[] = ['21_100_employees', '100_plus_employees'];
  if (fulfillmentComplexity === 'custom_dfy' && icpSize && largeSizes.includes(icpSize)) {
    score -= 4;
  }
  
  // Small ICP with coaching bonus
  const smallSizes: ICPSize[] = ['solo_founder', '1_5_employees'];
  if (fulfillmentComplexity === 'coaching_advisory' && icpSize && smallSizes.includes(icpSize)) {
    score += 2;
  }
  
  return Math.max(0, Math.min(20, score));
}

// ========== LATENT VARIABLE 4: RISK ALIGNMENT (0-20) ==========
// Measures whether risk exposure matches certainty

function calculateRiskAlignmentLatent(formData: DiagnosticFormData): number {
  let score = 10; // Baseline
  
  const { riskModel, proofLevel, pricingStructure } = formData;
  
  if (!riskModel || !proofLevel) return score;
  
  const hasStrongProof = ['strong', 'category_killer'].includes(proofLevel);
  const hasModerateProof = ['moderate', 'strong', 'category_killer'].includes(proofLevel);
  const hasWeakProof = ['none', 'weak'].includes(proofLevel);
  
  // Risk model + proof combinations
  if (riskModel === 'no_guarantee' && hasStrongProof) {
    score += 2;
  } else if (riskModel === 'conditional_guarantee' && hasModerateProof) {
    score += 4;
  } else if (riskModel === 'full_guarantee' && hasWeakProof) {
    score -= 6;
  } else if (riskModel === 'performance_only' && hasWeakProof) {
    score -= 5;
  }
  
  // Category killer with performance-based bonus
  if (proofLevel === 'category_killer' && 
      (pricingStructure === 'performance_only' || pricingStructure === 'hybrid')) {
    score += 3;
  }
  
  return Math.max(0, Math.min(20, score));
}

// ========== LATENT VARIABLE 5: CHANNEL FIT (0-20) ==========
// Measures whether outbound is appropriate for this offer

function calculateChannelFit(formData: DiagnosticFormData): number {
  let score = 10; // Baseline
  
  const { offerType, promise, proofLevel } = formData;
  
  if (!offerType || !promise) return score;
  
  // Offer type + promise combinations
  const isDemandCapture = offerType === 'demand_capture';
  const isOutboundEnablement = offerType === 'outbound_sales_enablement';
  const isLeadsPipeline = ['top_of_funnel_volume', 'mid_funnel_engagement'].includes(promise);
  const isRevenue = promise === 'top_line_revenue';
  const isAwarenessOnly = promise === 'ops_compliance_outcomes' || promise === 'efficiency_cost_savings';
  
  if (isDemandCapture && isLeadsPipeline) {
    score += 4;
  } else if (isOutboundEnablement && isRevenue) {
    score += 3;
  } else if (isAwarenessOnly) {
    score -= 6;
  }
  
  // Low proof + revenue promise via outbound penalty
  const hasLowProof = !proofLevel || ['none', 'weak'].includes(proofLevel);
  if (hasLowProof && isRevenue && (isDemandCapture || isOutboundEnablement)) {
    score -= 5;
  }
  
  return Math.max(0, Math.min(20, score));
}

// ========== LATENT VARIABLE 6: ICP SPECIFICITY STRENGTH (0-20) ==========
// NEW: Measures how narrow/focused the ICP targeting is

function calculateICPSpecificityStrength(formData: DiagnosticFormData): number {
  const { icpSpecificity } = formData;
  
  if (!icpSpecificity) return 10; // Default baseline
  
  // Direct mapping from specificity to score
  switch (icpSpecificity) {
    case 'broad': return 7; // 6-9 range, using 7
    case 'narrow': return 15; // 13-16 range, using 15
    case 'exact': return 18; // 17-20 range, using 18
    default: return 10;
  }
}

// ========== BOTTLENECK DETECTION ==========
// Uses NORMALIZED (percentage) scores, not absolute values
// STABILIZATION RULE 5: Only select as bottleneck if < 65% AND 10% worse than median

const BOTTLENECK_PRIORITY_ORDER: LatentBottleneckKey[] = [
  'proofToPromise',           // Highest downstream sales risk
  'economicHeadroom',         // EFI
  'icpSpecificityStrength',   // ICP Specificity
  'fulfillmentScalability',
  'channelFit',               // Lowest priority
  'riskAlignment',
];

function findLatentBottleneck(
  scores: LatentScores,
  pricingCanBeBottleneck: boolean = true // RULE 2: Pricing stability lock
): LatentBottleneckKey {
  // Calculate normalized scores (percentage of max 20)
  const normalized: Record<LatentBottleneckKey, number> = {
    economicHeadroom: (scores.economicHeadroom / 20) * 100,
    proofToPromise: (scores.proofToPromise / 20) * 100,
    fulfillmentScalability: (scores.fulfillmentScalability / 20) * 100,
    riskAlignment: (scores.riskAlignment / 20) * 100,
    channelFit: (scores.channelFit / 20) * 100,
    icpSpecificityStrength: (scores.icpSpecificityStrength / 20) * 100,
  };
  
  // RULE 5: Calculate median for eligibility check
  const sortedPercentages = Object.values(normalized).sort((a, b) => a - b);
  const medianPercentage = sortedPercentages[Math.floor(sortedPercentages.length / 2)];
  
  // Filter for eligible bottlenecks: < 65% AND at least 10% worse than median
  const allKeys = Object.keys(normalized) as LatentBottleneckKey[];
  const eligibleKeys = allKeys.filter(key => {
    const pct = normalized[key];
    const meetsThreshold = pct < 65 && (medianPercentage - pct) >= 10;
    
    // RULE 2: If pricing can't be bottleneck, exclude economicHeadroom
    if (key === 'economicHeadroom' && !pricingCanBeBottleneck) {
      return false;
    }
    
    return meetsThreshold;
  });
  
  // If no eligible bottlenecks, still need to return something
  // Fall back to lowest score (but this signals "no clear bottleneck")
  const searchKeys = eligibleKeys.length > 0 ? eligibleKeys : allKeys.filter(k => 
    k !== 'economicHeadroom' || pricingCanBeBottleneck
  );
  
  // Find the LOWEST RELATIVE (normalized) score among eligible
  let lowestKey: LatentBottleneckKey = 'proofToPromise';
  let lowestScore = 100;
  
  for (const key of searchKeys) {
    if (normalized[key] < lowestScore) {
      lowestScore = normalized[key];
      lowestKey = key;
    }
  }
  
  // Check for ties and use priority order
  const tiedKeys = searchKeys.filter(
    k => Math.abs(normalized[k] - lowestScore) < 1 // Within 1% considered tie
  );
  
  if (tiedKeys.length > 1) {
    // Use priority order to break tie
    for (const key of BOTTLENECK_PRIORITY_ORDER) {
      if (tiedKeys.includes(key)) {
        return key;
      }
    }
  }
  
  return lowestKey;
}

// ========== READINESS LABEL ==========

function getReadinessLabel(alignmentScore: number): ReadinessLabel {
  if (alignmentScore >= 80) return 'Strong';
  if (alignmentScore >= 60) return 'Moderate';
  return 'Weak';
}

// ========== FORM VALIDATION ==========

function isFormCompleteForLatent(formData: DiagnosticFormData): boolean {
  const { 
    offerType, promise, icpIndustry, verticalSegment,
    icpSize, icpMaturity, pricingStructure, riskModel, 
    fulfillmentComplexity, proofLevel, icpSpecificity  // Added icpSpecificity as REQUIRED
  } = formData;
  
  if (!offerType || !promise || !icpIndustry || !verticalSegment || 
      !icpSize || !icpMaturity || !pricingStructure || !riskModel || 
      !fulfillmentComplexity || !proofLevel || !icpSpecificity) {
    return false;
  }

  // Conditional validation
  if (pricingStructure === 'recurring' && !formData.recurringPriceTier) return false;
  if (pricingStructure === 'one_time' && !formData.oneTimePriceTier) return false;
  if (pricingStructure === 'usage_based' && (!formData.usageOutputType || !formData.usageVolumeTier)) return false;
  if (pricingStructure === 'hybrid' && (!formData.hybridRetainerTier || !formData.performanceBasis || !formData.performanceCompTier)) return false;
  if (pricingStructure === 'performance_only' && (!formData.performanceBasis || !formData.performanceCompTier)) return false;

  return true;
}

// ========== MAIN LATENT SCORING FUNCTION ==========

export interface LatentScoringOptions {
  pricingCanBeBottleneck?: boolean; // RULE 2: From stabilization context
}

export function calculateLatentScores(
  formData: DiagnosticFormData,
  options: LatentScoringOptions = {}
): LatentScoringResult | null {
  const { pricingCanBeBottleneck = true } = options;
  
  if (!isFormCompleteForLatent(formData)) {
    return null;
  }
  
  // Calculate Economic Headroom from EFI
  const economicResult = calculateEconomicHeadroom(formData);
  
  const latentScores: LatentScores = {
    economicHeadroom: economicResult.score,
    proofToPromise: calculateProofToPromise(formData),
    fulfillmentScalability: calculateFulfillmentScalability(formData),
    riskAlignment: calculateRiskAlignmentLatent(formData),
    channelFit: calculateChannelFit(formData),
    icpSpecificityStrength: calculateICPSpecificityStrength(formData),
  };
  
  // Sum all 6 latent variables (each 0-20) = 0-120, scale to 0-100
  const rawSum = 
    latentScores.economicHeadroom +
    latentScores.proofToPromise +
    latentScores.fulfillmentScalability +
    latentScores.riskAlignment +
    latentScores.channelFit +
    latentScores.icpSpecificityStrength;
  
  // Scale from 0-120 to 0-100
  const alignmentScore = Math.min(100, Math.round((rawSum / 120) * 100));
  
  const readinessLabel = getReadinessLabel(alignmentScore);
  const latentBottleneckKey = findLatentBottleneck(latentScores, pricingCanBeBottleneck);
  
  return {
    alignmentScore,
    readinessLabel,
    latentScores,
    latentBottleneckKey,
    efiClass: economicResult.efiClass,
  };
}

// ========== BOTTLENECK TO CATEGORY MAPPING ==========

export type AIRecommendationCategory = 
  | 'pricing_shift' 
  | 'icp_shift' 
  | 'promise_shift' 
  | 'fulfillment_shift' 
  | 'risk_shift' 
  | 'channel_shift';

export const BOTTLENECK_ALLOWED_CATEGORIES: Record<LatentBottleneckKey, AIRecommendationCategory[]> = {
  economicHeadroom: ['pricing_shift', 'icp_shift'],
  proofToPromise: ['promise_shift'],
  fulfillmentScalability: ['fulfillment_shift'],
  riskAlignment: ['risk_shift'],
  channelFit: ['channel_shift'],
  icpSpecificityStrength: ['icp_shift'],
};

// ========== LATENT SCORE LABELS ==========

export const LATENT_SCORE_LABELS: Record<LatentBottleneckKey, string> = {
  economicHeadroom: 'Economic Headroom (EFI)',
  proofToPromise: 'Proof-to-Promise Credibility',
  fulfillmentScalability: 'Fulfillment Scalability',
  riskAlignment: 'Risk Alignment',
  channelFit: 'Channel Fit',
  icpSpecificityStrength: 'ICP Specificity',
};

// ========== EFI LABEL FOR DISPLAY ==========

export const EFI_CLASS_LABELS: Record<EFIClass, string> = {
  VeryLow: 'Very Low Friction',
  Low: 'Low Friction',
  Moderate: 'Moderate Friction',
  High: 'High Friction',
  Extreme: 'Extreme Friction',
};
