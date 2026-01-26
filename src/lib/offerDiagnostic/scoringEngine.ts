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
} from './types';

// ========== DIMENSION 1: Pain/Urgency (0-25) ==========
// Based on ScoringSegment

const SEGMENT_PAIN_URGENCY: Record<ScoringSegment, number> = {
  SaaS: 25,
  Professional: 20,
  DTC: 18,
  RealEstate: 18,
  Healthcare: 17,
  OtherB2B: 17,
  Info: 15,
  Local: 14,
};

function calculatePainUrgency(scoringSegment: ScoringSegment): number {
  return Math.min(SEGMENT_PAIN_URGENCY[scoringSegment], 25);
}

// ========== DIMENSION 2: Buying Power (0-25) ==========
// Based on ScoringSegment

const SEGMENT_BUYING_POWER: Record<ScoringSegment, number> = {
  SaaS: 25,
  RealEstate: 23,
  Healthcare: 23,
  Professional: 20,
  DTC: 18,
  OtherB2B: 18,
  Info: 15,
  Local: 14,
};

function calculateBuyingPower(scoringSegment: ScoringSegment): number {
  return Math.min(SEGMENT_BUYING_POWER[scoringSegment], 25);
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

// ========== DIMENSION 4: Pricing Fit (0-20) ==========
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
    priceTier = usageVolumeTier === 'low' ? 2 : usageVolumeTier === 'mid' ? 3 : 4;
  } else if (pricingStructure === 'performance_only') {
    priceTier = 3; // neutral baseline
  }
  
  // Calculate fit based on difference between price tier and budget capacity
  const difference = priceTier - segmentBudgetTier;
  
  // Perfect match = 20, overpricing penalty, underpricing penalty
  if (difference === 0) {
    return 20; // Perfect alignment
  } else if (difference > 0) {
    // Price too high for segment - bigger penalty
    const mismatchPenalty = Math.min(difference * 5, 15);
    return Math.max(20 - mismatchPenalty, 5);
  } else {
    // Undercharging - smaller penalty
    const underchargePenalty = Math.abs(difference) * 2;
    return Math.max(20 - underchargePenalty, 10);
  }
}

// ========== DIMENSION 5: Risk Alignment (0-15) ==========
// ProofLevel boosts acceptance, high guarantees require high proof

const PROOF_LEVEL_SCORE: Record<ProofLevel, number> = {
  category_killer: 15,
  strong: 12,
  moderate: 9,
  weak: 5,
  none: 0,
};

// Risk model requirements (how much proof needed)
const RISK_MODEL_PROOF_REQUIREMENT: Record<RiskModel, number> = {
  no_guarantee: 3,       // Low proof requirement
  conditional_guarantee: 6,
  full_guarantee: 12,    // High proof requirement
  performance_only: 9,
  pay_after_results: 10,
};

function calculateRiskAlignment(
  proofLevel: ProofLevel,
  riskModel: RiskModel
): number {
  const proofScore = PROOF_LEVEL_SCORE[proofLevel];
  const proofRequired = RISK_MODEL_PROOF_REQUIREMENT[riskModel];
  
  // If proof >= required, score well
  if (proofScore >= proofRequired) {
    return Math.min(15, 10 + (proofScore - proofRequired));
  }
  
  // If proof < required, penalize
  const shortfall = proofRequired - proofScore;
  return Math.max(0, 10 - shortfall);
}

// ========== SWITCHING COST (0-20) ==========
const SWITCHING_COST_BASE: Record<PricingStructure, number> = {
  recurring: 12,
  one_time: 4,
  performance_only: 6,
  usage_based: 10,
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
// Composite of 5 dimensions: Pain/Urgency (25), Buying Power (25), Execution Feasibility (15), Pricing Fit (20), Risk Alignment (15)
function calculateAlignmentScoreFromDimensions(
  painUrgency: number,
  buyingPower: number,
  executionFeasibility: number,
  pricingFit: number,
  riskAlignment: number
): number {
  // Sum all dimensions and cap at 100
  const total = painUrgency + buyingPower + executionFeasibility + pricingFit + riskAlignment;
  return Math.min(100, total);
}

// ========== READINESS SCORE (0-10) ==========
function calculateReadinessScore(alignmentScore: number): number {
  return Math.round((alignmentScore / 10) * 10) / 10; // One decimal place
}

// ========== READINESS LABEL ==========
type ReadinessLabel = 'Weak' | 'Fair' | 'Strong';

function getReadinessLabel(alignmentScore: number): ReadinessLabel {
  if (alignmentScore < 50) return 'Weak';
  if (alignmentScore < 70) return 'Fair';
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

// ========== MAIN SCORING FUNCTION ==========
export function calculateScore(formData: DiagnosticFormData): ScoringResult | null {
  if (!isFormComplete(formData)) {
    return null;
  }

  const { 
    scoringSegment, pricingStructure, recurringPriceTier, oneTimePriceTier,
    usageVolumeTier, proofLevel, riskModel, fulfillmentComplexity 
  } = formData;

  const dimensionScores: DimensionScores = {
    painUrgency: calculatePainUrgency(scoringSegment!),
    buyingPower: calculateBuyingPower(scoringSegment!),
    executionFeasibility: calculateExecutionFeasibility(fulfillmentComplexity!),
    pricingFit: calculatePricingFit(scoringSegment!, pricingStructure!, recurringPriceTier, oneTimePriceTier, usageVolumeTier),
    riskAlignment: calculateRiskAlignment(proofLevel!, riskModel!),
  };

  const switchingCost = calculateSwitchingCost(pricingStructure!, fulfillmentComplexity!);
  
  // Calculate alignment score from all 5 dimensions
  const alignmentScore = calculateAlignmentScoreFromDimensions(
    dimensionScores.painUrgency, 
    dimensionScores.buyingPower, 
    dimensionScores.executionFeasibility,
    dimensionScores.pricingFit,
    dimensionScores.riskAlignment
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
export { PROMISE_MATURITY_FIT, PROMISE_FULFILLMENT_FIT, SEGMENT_BUDGET_TIER, PROOF_LEVEL_SCORE, RECURRING_PRICE_TO_TIER };
