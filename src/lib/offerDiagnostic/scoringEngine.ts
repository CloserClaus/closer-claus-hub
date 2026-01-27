import type {
  DiagnosticFormData,
  DimensionScores,
  ExtendedScores,
  ScoringResult,
  Grade,
  OfferType,
  Promise,
  ICPMaturity,
  ICPSize,
  ICPIndustry,
  PricingStructure,
  RecurringPriceTier,
  OneTimePriceTier,
  UsageVolumeTier,
  UsageOutputType,
  FulfillmentComplexity,
  RiskModel,
  ScoringSegment,
  ProofLevel,
  PromiseBucket,
} from './types';

// ========== DIMENSION 1: Pain/Urgency (0-20) ==========
// Based on ScoringSegment

const SEGMENT_PAIN_URGENCY: Record<ScoringSegment, number> = {
  SaaS: 20,
  Professional: 17,
  DTC: 15,
  RealEstate: 15,
  Healthcare: 14,
  OtherB2B: 14,
  Info: 12,
  Local: 10,
};

function calculatePainUrgency(scoringSegment: ScoringSegment): number {
  return Math.min(SEGMENT_PAIN_URGENCY[scoringSegment], 20);
}

// ========== DIMENSION 2: Buying Power (0-20) ==========
// Based on ScoringSegment

const SEGMENT_BUYING_POWER: Record<ScoringSegment, number> = {
  SaaS: 20,
  RealEstate: 18,
  Healthcare: 18,
  Professional: 16,
  DTC: 14,
  OtherB2B: 14,
  Info: 12,
  Local: 10,
};

function calculateBuyingPower(scoringSegment: ScoringSegment): number {
  return Math.min(SEGMENT_BUYING_POWER[scoringSegment], 20);
}

// ========== DIMENSION 3: Execution Feasibility (0-15) ==========
// Based on FulfillmentComplexity: Software > Advisory > Productized > Custom > Staffing

const FULFILLMENT_FEASIBILITY: Record<FulfillmentComplexity, number> = {
  software_platform: 15,
  coaching_advisory: 12,
  package_based: 10,
  custom_dfy: 7,
  staffing_placement: 5,
};

function calculateExecutionFeasibility(fulfillmentComplexity: FulfillmentComplexity): number {
  return Math.min(FULFILLMENT_FEASIBILITY[fulfillmentComplexity], 15);
}

// ========== DIMENSION 4: Pricing Fit (0-15) ==========
// Compare PriceTier to SegmentBudgetRange

// Segment budget ranges (1 = lowest, 5 = highest)
const SEGMENT_BUDGET_TIER: Record<ScoringSegment, number> = {
  SaaS: 5,
  RealEstate: 4,
  Healthcare: 4,
  Professional: 4,
  DTC: 3,
  OtherB2B: 3,
  Info: 2,
  Local: 1,
};

// Price tiers (1 = lowest, 5 = highest)
const RECURRING_PRICE_TO_TIER: Record<RecurringPriceTier, number> = {
  'under_150': 1,
  '150_500': 2,
  '500_2k': 3,
  '2k_5k': 4,
  '5k_plus': 5,
};

const ONE_TIME_PRICE_TO_TIER: Record<OneTimePriceTier, number> = {
  'under_3k': 1,
  '3k_10k': 3,
  '10k_plus': 5,
};

function calculatePricingFit(
  scoringSegment: ScoringSegment,
  pricingStructure: PricingStructure,
  recurringPriceTier: RecurringPriceTier | null,
  oneTimePriceTier: OneTimePriceTier | null,
  usageVolumeTier: UsageVolumeTier | null
): number {
  const segmentBudgetTier = SEGMENT_BUDGET_TIER[scoringSegment];
  
  let priceTier = 3; // default mid-tier
  
  if (pricingStructure === 'recurring' && recurringPriceTier) {
    priceTier = RECURRING_PRICE_TO_TIER[recurringPriceTier];
  } else if (pricingStructure === 'one_time' && oneTimePriceTier) {
    priceTier = ONE_TIME_PRICE_TO_TIER[oneTimePriceTier];
  } else if (pricingStructure === 'usage_based' && usageVolumeTier) {
    priceTier = usageVolumeTier === 'low' ? 2 : usageVolumeTier === 'medium' ? 3 : 4;
  } else if (pricingStructure === 'performance_only' || pricingStructure === 'hybrid') {
    priceTier = 3; // neutral baseline
  }
  
  // Calculate fit based on difference between price tier and budget capacity
  const difference = priceTier - segmentBudgetTier;
  
  // Perfect match = 15, overpricing penalty, underpricing penalty
  if (difference === 0) {
    return 15; // Perfect alignment
  } else if (difference > 0) {
    // Price too high for segment - bigger penalty
    const mismatchPenalty = Math.min(difference * 4, 12);
    return Math.max(15 - mismatchPenalty, 3);
  } else {
    // Undercharging - smaller penalty
    const underchargePenalty = Math.abs(difference) * 2;
    return Math.max(15 - underchargePenalty, 8);
  }
}

// ========== DIMENSION 5: Risk Alignment (0-10) ==========
// ProofLevel boosts acceptance, high guarantees require high proof

const PROOF_LEVEL_SCORE: Record<ProofLevel, number> = {
  category_killer: 10,
  strong: 8,
  moderate: 6,
  weak: 3,
  none: 0,
};

// Risk model requirements (how much proof needed)
const RISK_MODEL_PROOF_REQUIREMENT: Record<RiskModel, number> = {
  no_guarantee: 2,       // Low proof requirement
  conditional_guarantee: 4,
  full_guarantee: 8,    // High proof requirement
  performance_only: 6,
  pay_after_results: 7,
};

function calculateRiskAlignment(
  proofLevel: ProofLevel,
  riskModel: RiskModel
): number {
  const proofScore = PROOF_LEVEL_SCORE[proofLevel];
  const proofRequired = RISK_MODEL_PROOF_REQUIREMENT[riskModel];
  
  // If proof >= required, score well
  if (proofScore >= proofRequired) {
    return Math.min(10, 6 + (proofScore - proofRequired));
  }
  
  // If proof < required, penalize
  const shortfall = proofRequired - proofScore;
  return Math.max(0, 6 - shortfall);
}

// ========== DIMENSION 6: Outbound Fit (0-20) ==========
// OutboundFit = VerticalFit (0-10) + ProofFit (0-5) + PromiseFit (0-5)

// VerticalFit based on ScoringSegment (maps to outbound viability)
const VERTICAL_FIT_SCORE: Record<ScoringSegment, number> = {
  SaaS: 10,
  Professional: 7,      // B2B Service Agency & Professional Services
  DTC: 5,
  RealEstate: 5,
  Healthcare: 5,
  OtherB2B: 5,
  Info: 4,              // Creators / Info / Coaching
  Local: 3,             // Local SMB / Trades / Home Services
};

// ProofFit based on ProofLevel
const PROOF_FIT_SCORE: Record<ProofLevel, number> = {
  category_killer: 5,
  strong: 5,
  moderate: 3,
  weak: 1,
  none: 0,
};

// PromiseFit based on Promise (outbound-specific mapping)
const PROMISE_FIT_SCORE: Record<PromiseBucket, number> = {
  top_of_funnel_volume: 5,    // Book meetings / opportunities
  top_line_revenue: 5,        // Increase revenue / ROAS / MRR
  mid_funnel_engagement: 3,   // Lower CAC / improve conversion
  efficiency_cost_savings: 2, // Efficiency / cost savings
  ops_compliance_outcomes: 1, // Ops / compliance / SOP
};

function calculateOutboundFit(
  scoringSegment: ScoringSegment,
  proofLevel: ProofLevel,
  promise: PromiseBucket
): number {
  const verticalFit = VERTICAL_FIT_SCORE[scoringSegment] || 5;
  const proofFit = PROOF_FIT_SCORE[proofLevel] || 1;
  const promiseFit = PROMISE_FIT_SCORE[promise] || 2;
  
  // Sum and cap at 20
  return Math.min(verticalFit + proofFit + promiseFit, 20);
}

// ========== SWITCHING COST (0-20) ==========
const SWITCHING_COST_BASE: Record<PricingStructure, number> = {
  recurring: 12,
  one_time: 4,
  performance_only: 6,
  usage_based: 10,
  hybrid: 10, // Hybrid is similar to usage-based
};

const FULFILLMENT_SWITCHING_MODIFIER: Record<FulfillmentComplexity, number> = {
  software_platform: 4,
  package_based: 3,
  coaching_advisory: 1,
  custom_dfy: 2,
  staffing_placement: 0,
};

function calculateSwitchingCost(
  pricingStructure: PricingStructure,
  fulfillmentComplexity: FulfillmentComplexity
): number {
  const base = SWITCHING_COST_BASE[pricingStructure];
  const modifier = FULFILLMENT_SWITCHING_MODIFIER[fulfillmentComplexity];
  return Math.min(base + modifier, 20);
}

// ========== ALIGNMENT SCORE (0-100) ==========
// Composite of 6 dimensions: Pain/Urgency (20), Buying Power (20), Execution Feasibility (15), 
// Pricing Fit (15), Risk Alignment (10), Outbound Fit (20)
function calculateAlignmentScoreFromDimensions(
  painUrgency: number,
  buyingPower: number,
  executionFeasibility: number,
  pricingFit: number,
  riskAlignment: number,
  outboundFit: number
): number {
  // Sum all dimensions and cap at 100
  const total = painUrgency + buyingPower + executionFeasibility + pricingFit + riskAlignment + outboundFit;
  return Math.min(100, total);
}

// ========== READINESS SCORE (0-10) ==========
function calculateReadinessScore(alignmentScore: number): number {
  return Math.round((alignmentScore / 10) * 10) / 10; // One decimal place
}

// ========== READINESS LABEL ==========
type ReadinessLabel = 'Weak' | 'Moderate' | 'Strong';

function getReadinessLabel(alignmentScore: number): ReadinessLabel {
  if (alignmentScore < 50) return 'Weak';
  if (alignmentScore < 75) return 'Moderate';
  return 'Strong';
}

// ========== GRADE CALCULATION ==========
function calculateGrade(score: number): Grade {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 50) return 'Average';
  return 'Weak';
}

// ========== FORM VALIDATION ==========
function isFormComplete(formData: DiagnosticFormData): boolean {
  const { 
    offerType, promise, icpIndustry, verticalSegment, scoringSegment,
    icpSize, icpMaturity, pricingStructure, riskModel, fulfillmentComplexity, proofLevel 
  } = formData;
  
  // Base required fields (including new fields)
  if (!offerType || !promise || !icpIndustry || !verticalSegment || !scoringSegment || 
      !icpSize || !icpMaturity || !pricingStructure || !riskModel || !fulfillmentComplexity || !proofLevel) {
    return false;
  }

  // Conditional field validation
  if (pricingStructure === 'recurring' && !formData.recurringPriceTier) {
    return false;
  }
  if (pricingStructure === 'one_time' && !formData.oneTimePriceTier) {
    return false;
  }
  if (pricingStructure === 'usage_based' && (!formData.usageOutputType || !formData.usageVolumeTier)) {
    return false;
  }
  // Hybrid requires retainer tier, performance basis, and comp tier
  if (pricingStructure === 'hybrid' && (!formData.hybridRetainerTier || !formData.performanceBasis || !formData.performanceCompTier)) {
    return false;
  }
  // Performance only requires performance basis and comp tier
  if (pricingStructure === 'performance_only' && (!formData.performanceBasis || !formData.performanceCompTier)) {
    return false;
  }

  return true;
}

// ========== GET PROMISE MATURITY FIT SCORE (Legacy - kept for violation engine) ==========
const PROMISE_MATURITY_FIT: Record<Promise, Record<ICPMaturity, number>> = {
  top_of_funnel_volume: {
    pre_revenue: 2,
    early_traction: 6,
    scaling: 8,
    mature: 7,
    enterprise: 5,
  },
  mid_funnel_engagement: {
    pre_revenue: 1,
    early_traction: 7,
    scaling: 9,
    mature: 8,
    enterprise: 6,
  },
  top_line_revenue: {
    pre_revenue: 0,
    early_traction: 6,
    scaling: 10,
    mature: 9,
    enterprise: 4,
  },
  efficiency_cost_savings: {
    pre_revenue: 3,
    early_traction: 4,
    scaling: 6,
    mature: 7,
    enterprise: 8,
  },
  ops_compliance_outcomes: {
    pre_revenue: 5,
    early_traction: 4,
    scaling: 5,
    mature: 7,
    enterprise: 10,
  },
};

const PROMISE_FULFILLMENT_FIT: Record<Promise, Record<FulfillmentComplexity, number>> = {
  top_of_funnel_volume: {
    custom_dfy: 8,
    package_based: 7,
    coaching_advisory: 5,
    software_platform: 6,
    staffing_placement: 9,
  },
  mid_funnel_engagement: {
    custom_dfy: 6,
    package_based: 7,
    coaching_advisory: 6,
    software_platform: 5,
    staffing_placement: 4,
  },
  top_line_revenue: {
    custom_dfy: 4,
    package_based: 6,
    coaching_advisory: 8,
    software_platform: 5,
    staffing_placement: 3,
  },
  efficiency_cost_savings: {
    custom_dfy: 5,
    package_based: 6,
    coaching_advisory: 6,
    software_platform: 9,
    staffing_placement: 4,
  },
  ops_compliance_outcomes: {
    custom_dfy: 3,
    package_based: 4,
    coaching_advisory: 7,
    software_platform: 8,
    staffing_placement: 2,
  },
};

export function getPromiseMaturityFit(promise: Promise, icpMaturity: ICPMaturity): number {
  return PROMISE_MATURITY_FIT[promise][icpMaturity];
}

export function getPromiseFulfillmentFit(promise: Promise, fulfillmentComplexity: FulfillmentComplexity): number {
  return PROMISE_FULFILLMENT_FIT[promise][fulfillmentComplexity];
}

// ========== PERFORMANCE MODIFIERS ==========
import type { PerformanceBasis, PerformanceCompTier, HybridRetainerTier } from './types';

// Performance basis modifiers for outboundFit and buyingPower
const PERFORMANCE_BASIS_MODIFIERS: Record<PerformanceBasis, { outboundFit: number; buyingPower: number }> = {
  per_appointment: { outboundFit: 3, buyingPower: 2 },
  per_opportunity: { outboundFit: 2, buyingPower: 2 },
  per_closed_deal: { outboundFit: 1, buyingPower: 1 },
  percent_revenue: { outboundFit: -3, buyingPower: -3 },
  percent_profit: { outboundFit: -2, buyingPower: -2 },
  percent_ad_spend: { outboundFit: -1, buyingPower: -2 },
};

// Performance comp tier modifiers for outboundFit and riskAlignment
const PERFORMANCE_COMP_TIER_MODIFIERS: Record<PerformanceCompTier, { outboundFit: number; riskAlignment: number }> = {
  under_15_percent: { outboundFit: 0, riskAlignment: 0 },
  '15_30_percent': { outboundFit: 0, riskAlignment: 0 },
  over_30_percent: { outboundFit: -2, riskAlignment: -2 },
  under_250_unit: { outboundFit: 0, riskAlignment: 0 },
  '250_500_unit': { outboundFit: 0, riskAlignment: 0 },
  over_500_unit: { outboundFit: -2, riskAlignment: -2 },
};

// Risk alignment modifiers based on performance basis
const PERFORMANCE_BASIS_RISK_MODIFIERS: Record<PerformanceBasis, number> = {
  per_appointment: 5,
  per_opportunity: 4,
  per_closed_deal: 2,
  percent_revenue: 3,
  percent_profit: 2,
  percent_ad_spend: 1,
};

function applyPerformanceModifiers(
  dimensionScores: DimensionScores,
  formData: DiagnosticFormData
): DimensionScores {
  const { pricingStructure, performanceBasis, performanceCompTier, fulfillmentComplexity } = formData;
  
  // Only apply modifiers for hybrid or performance_only
  if (pricingStructure !== 'hybrid' && pricingStructure !== 'performance_only') {
    return dimensionScores;
  }
  
  const modifiedScores = { ...dimensionScores };
  
  // Apply performance basis modifiers
  if (performanceBasis) {
    const basisMods = PERFORMANCE_BASIS_MODIFIERS[performanceBasis];
    modifiedScores.outboundFit = Math.max(0, Math.min(20, modifiedScores.outboundFit + basisMods.outboundFit));
    modifiedScores.buyingPower = Math.max(0, Math.min(20, modifiedScores.buyingPower + basisMods.buyingPower));
    
    // Apply risk alignment modifiers from performance basis
    const riskMod = PERFORMANCE_BASIS_RISK_MODIFIERS[performanceBasis];
    modifiedScores.riskAlignment = Math.max(0, Math.min(10, modifiedScores.riskAlignment + Math.floor(riskMod / 2)));
  }
  
  // Apply performance comp tier modifiers
  if (performanceCompTier) {
    const tierMods = PERFORMANCE_COMP_TIER_MODIFIERS[performanceCompTier];
    modifiedScores.outboundFit = Math.max(0, Math.min(20, modifiedScores.outboundFit + tierMods.outboundFit));
    modifiedScores.riskAlignment = Math.max(0, Math.min(10, modifiedScores.riskAlignment + tierMods.riskAlignment));
  }
  
  // Apply execution feasibility modifiers for specific combinations
  if (performanceBasis && fulfillmentComplexity) {
    if (performanceBasis === 'percent_revenue' && fulfillmentComplexity === 'coaching_advisory') {
      modifiedScores.executionFeasibility = Math.max(0, modifiedScores.executionFeasibility - 3);
    } else if (performanceBasis === 'percent_revenue' && fulfillmentComplexity === 'package_based') {
      modifiedScores.executionFeasibility = Math.max(0, modifiedScores.executionFeasibility - 1);
    } else if (performanceBasis === 'per_appointment' && fulfillmentComplexity === 'staffing_placement') {
      modifiedScores.executionFeasibility = Math.min(15, modifiedScores.executionFeasibility + 2);
    }
  }
  
  return modifiedScores;
}

// ========== MAIN SCORING FUNCTION ==========
export function calculateScore(formData: DiagnosticFormData): ScoringResult | null {
  if (!isFormComplete(formData)) {
    return null;
  }

  const { 
    scoringSegment, pricingStructure, recurringPriceTier, oneTimePriceTier,
    usageVolumeTier, proofLevel, riskModel, fulfillmentComplexity, promise,
    hybridRetainerTier
  } = formData;

  // For hybrid pricing, use the hybrid retainer tier as the recurring price tier for pricing fit calculation
  const effectiveRecurringTier = pricingStructure === 'hybrid' ? hybridRetainerTier : recurringPriceTier;

  let dimensionScores: DimensionScores = {
    painUrgency: calculatePainUrgency(scoringSegment!),
    buyingPower: calculateBuyingPower(scoringSegment!),
    executionFeasibility: calculateExecutionFeasibility(fulfillmentComplexity!),
    pricingFit: calculatePricingFit(
      scoringSegment!, 
      pricingStructure === 'hybrid' ? 'recurring' : pricingStructure!, // Treat hybrid as recurring for base pricing
      effectiveRecurringTier, 
      oneTimePriceTier, 
      usageVolumeTier
    ),
    riskAlignment: calculateRiskAlignment(proofLevel!, riskModel!),
    outboundFit: calculateOutboundFit(scoringSegment!, proofLevel!, promise!),
  };
  
  // Apply performance modifiers for hybrid/performance_only
  dimensionScores = applyPerformanceModifiers(dimensionScores, formData);

  const switchingCost = calculateSwitchingCost(pricingStructure!, fulfillmentComplexity!);
  
  // Calculate alignment score from all 6 dimensions
  const alignmentScore = calculateAlignmentScoreFromDimensions(
    dimensionScores.painUrgency, 
    dimensionScores.buyingPower, 
    dimensionScores.executionFeasibility,
    dimensionScores.pricingFit,
    dimensionScores.riskAlignment,
    dimensionScores.outboundFit
  );

  const extendedScores: ExtendedScores = {
    ...dimensionScores,
    alignmentScore,
    switchingCost,
  };

  // Use alignment score as the visible score
  const visibleScore100 = alignmentScore;
  const visibleScore10 = calculateReadinessScore(alignmentScore);
  const grade = calculateGrade(alignmentScore);

  return {
    hiddenScore: alignmentScore,
    visibleScore100,
    visibleScore10,
    grade,
    dimensionScores,
    extendedScores,
  };
}

// Export matrices for use in other engines
export { 
  PROMISE_MATURITY_FIT, 
  PROMISE_FULFILLMENT_FIT, 
  SEGMENT_BUDGET_TIER, 
  PROOF_LEVEL_SCORE, 
  RECURRING_PRICE_TO_TIER,
  PROOF_FIT_SCORE,
  PROMISE_FIT_SCORE,
  VERTICAL_FIT_SCORE,
  calculateOutboundFit,
};
