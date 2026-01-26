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
} from './types';

// ========== DIMENSION 1: Pain/Urgency (0-25) ==========
// = OfferTypeUrgency (0-15) + PromiseMaturityFit (0-10)

const INTRINSIC_URGENCY: Record<OfferType, number> = {
  outbound_sales_enablement: 15,
  retention_monetization: 12,
  demand_creation: 10,
  demand_capture: 8,
  operational_enablement: 6,
};

// Matrix D: Promise × ICP Maturity (0-10)
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

function calculatePainUrgency(offerType: OfferType, promise: Promise, icpMaturity: ICPMaturity): number {
  const intrinsic = INTRINSIC_URGENCY[offerType];
  const promiseMaturityFit = PROMISE_MATURITY_FIT[promise][icpMaturity];
  return Math.min(intrinsic + promiseMaturityFit, 25);
}

// ========== DIMENSION 2: Buying Power (0-25) ==========
const ICP_SIZE_BUDGET: Record<ICPSize, number> = {
  '21_100_employees': 15,
  '6_20_employees': 12,
  '100_plus_employees': 10,
  '1_5_employees': 6,
  'solo_founder': 4,
};

const ICP_INDUSTRY_BUDGET: Record<ICPIndustry, number> = {
  saas_tech: 10,
  professional_services: 9,
  dtc_ecommerce: 7,
  b2b_service_agency: 6,
  local_services: 5,
};

function calculateBuyingPower(icpSize: ICPSize, icpIndustry: ICPIndustry): number {
  const sizeBudget = ICP_SIZE_BUDGET[icpSize];
  const industryBudget = ICP_INDUSTRY_BUDGET[icpIndustry];
  return Math.min(sizeBudget + industryBudget, 25);
}

// ========== DIMENSION 3: Execution Feasibility (0-20) ==========
// = OfferExecutionFeasibility (0-10) + PromiseFulfillmentFit (0-10)

// Offer Execution Feasibility base scores (0-10)
const OFFER_EXECUTION_FEASIBILITY: Record<FulfillmentComplexity, number> = {
  software_platform: 10,
  package_based: 8,
  coaching_advisory: 7,
  custom_dfy: 5,
  staffing_placement: 3,
};

// Matrix E: Promise × Fulfillment Type (0-10)
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

function calculateExecutionFeasibility(
  fulfillmentComplexity: FulfillmentComplexity,
  promise: Promise
): number {
  const offerFeas = OFFER_EXECUTION_FEASIBILITY[fulfillmentComplexity];
  const promiseFulfillmentFit = PROMISE_FULFILLMENT_FIT[promise][fulfillmentComplexity];
  return Math.min(offerFeas + promiseFulfillmentFit, 20);
}

// ========== DIMENSION 4: Pricing Fit (0-20) ==========
// Matrix B: ICPSize × PricingStructure
const MATRIX_B: Record<ICPSize, Record<PricingStructure, number>> = {
  solo_founder: { recurring: 1, one_time: 2, performance_only: -3, usage_based: -1 },
  '1_5_employees': { recurring: 2, one_time: 3, performance_only: -1, usage_based: 0 },
  '6_20_employees': { recurring: 4, one_time: 3, performance_only: 1, usage_based: 4 },
  '21_100_employees': { recurring: 5, one_time: 3, performance_only: 3, usage_based: 5 },
  '100_plus_employees': { recurring: 4, one_time: 2, performance_only: 2, usage_based: 3 },
};

const RECURRING_TIER_SCORE: Record<RecurringPriceTier, number> = {
  'under_150': 2,
  '150_500': 4,
  '500_2k': 8,
  '2k_5k': 9,
  '5k_plus': 7,
};

const ONE_TIME_TIER_SCORE: Record<OneTimePriceTier, number> = {
  'under_3k': 4,
  '3k_10k': 8,
  '10k_plus': 10,
};

const USAGE_VOLUME_SCORE: Record<UsageVolumeTier, number> = {
  'low': 4,
  'mid': 7,
  'high': 10,
};

function calculatePricingFit(
  icpSize: ICPSize,
  pricingStructure: PricingStructure,
  recurringPriceTier: RecurringPriceTier | null,
  oneTimePriceTier: OneTimePriceTier | null,
  usageVolumeTier: UsageVolumeTier | null
): number {
  const matrixBScore = MATRIX_B[icpSize][pricingStructure];
  // Normalize matrix B score from -3 to +5 range to 0-10
  const normalizedMatrixB = Math.max(0, Math.min(10, matrixBScore + 5));

  let tierOrVolumeScore = 5; // default neutral

  if (pricingStructure === 'recurring' && recurringPriceTier) {
    tierOrVolumeScore = RECURRING_TIER_SCORE[recurringPriceTier];
  } else if (pricingStructure === 'one_time' && oneTimePriceTier) {
    tierOrVolumeScore = ONE_TIME_TIER_SCORE[oneTimePriceTier];
  } else if (pricingStructure === 'usage_based' && usageVolumeTier) {
    tierOrVolumeScore = USAGE_VOLUME_SCORE[usageVolumeTier];
  } else if (pricingStructure === 'performance_only') {
    tierOrVolumeScore = 5; // neutral baseline
  }

  return Math.min(normalizedMatrixB + tierOrVolumeScore, 20);
}

// ========== DIMENSION 5: Risk Alignment (0-10) ==========
// Matrix: ICPMaturity × RiskModel with values 0-10
const RISK_ALIGNMENT_MATRIX: Record<ICPMaturity, Record<RiskModel, number>> = {
  pre_revenue: {
    no_guarantee: 2,
    conditional_guarantee: 5,
    full_guarantee: 0,
    performance_only: 3,
    pay_after_results: 4,
  },
  early_traction: {
    no_guarantee: 3,
    conditional_guarantee: 6,
    full_guarantee: 2,
    performance_only: 5,
    pay_after_results: 6,
  },
  scaling: {
    no_guarantee: 4,
    conditional_guarantee: 7,
    full_guarantee: 6,
    performance_only: 8,
    pay_after_results: 7,
  },
  mature: {
    no_guarantee: 6,
    conditional_guarantee: 7,
    full_guarantee: 5,
    performance_only: 3,
    pay_after_results: 6,
  },
  enterprise: {
    no_guarantee: 5,
    conditional_guarantee: 6,
    full_guarantee: 4,
    performance_only: 2,
    pay_after_results: 5,
  },
};

function calculateRiskAlignment(
  icpMaturity: ICPMaturity,
  riskModel: RiskModel
): number {
  const riskScore = RISK_ALIGNMENT_MATRIX[icpMaturity][riskModel];
  return Math.max(0, Math.min(10, riskScore));
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
// Composite of 5 dimensions: Pain/Urgency (25), Buying Power (25), Execution Feasibility (20), Pricing Fit (20), Risk Alignment (10)
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
  const { offerType, promise, icpIndustry, icpSize, icpMaturity, pricingStructure, riskModel, fulfillmentComplexity } = formData;
  
  // Base required fields (including promise)
  if (!offerType || !promise || !icpIndustry || !icpSize || !icpMaturity || !pricingStructure || !riskModel || !fulfillmentComplexity) {
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

// ========== GET PROMISE MATURITY FIT SCORE ==========
export function getPromiseMaturityFit(promise: Promise, icpMaturity: ICPMaturity): number {
  return PROMISE_MATURITY_FIT[promise][icpMaturity];
}

// ========== GET PROMISE FULFILLMENT FIT SCORE ==========
export function getPromiseFulfillmentFit(promise: Promise, fulfillmentComplexity: FulfillmentComplexity): number {
  return PROMISE_FULFILLMENT_FIT[promise][fulfillmentComplexity];
}

// ========== MAIN SCORING FUNCTION ==========
export function calculateScore(formData: DiagnosticFormData): ScoringResult | null {
  if (!isFormComplete(formData)) {
    return null;
  }

  const { 
    offerType, promise, icpIndustry, icpSize, icpMaturity, 
    pricingStructure, recurringPriceTier, oneTimePriceTier,
    usageVolumeTier, riskModel, fulfillmentComplexity 
  } = formData;

  const dimensionScores: DimensionScores = {
    painUrgency: calculatePainUrgency(offerType!, promise!, icpMaturity!),
    buyingPower: calculateBuyingPower(icpSize!, icpIndustry!),
    executionFeasibility: calculateExecutionFeasibility(fulfillmentComplexity!, promise!),
    pricingFit: calculatePricingFit(icpSize!, pricingStructure!, recurringPriceTier, oneTimePriceTier, usageVolumeTier),
    riskAlignment: calculateRiskAlignment(icpMaturity!, riskModel!),
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
export { MATRIX_B, PROMISE_MATURITY_FIT, PROMISE_FULFILLMENT_FIT, RISK_ALIGNMENT_MATRIX };
