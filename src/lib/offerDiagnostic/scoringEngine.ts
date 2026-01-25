import type {
  DiagnosticFormData,
  DimensionScores,
  ExtendedScores,
  ScoringResult,
  Grade,
  OfferType,
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

// ========== DIMENSION 1: Pain Urgency (0-25) ==========
const INTRINSIC_URGENCY: Record<OfferType, number> = {
  outbound_sales_enablement: 15,
  retention_monetization: 12,
  demand_creation: 10,
  demand_capture: 8,
  operational_enablement: 6,
};

const MATURITY_MODIFIER: Record<ICPMaturity, number> = {
  scaling: 10,
  early_traction: 8,
  mature: 5,
  enterprise: 3,
  pre_revenue: 0,
};

function calculatePainUrgency(offerType: OfferType, icpMaturity: ICPMaturity): number {
  const intrinsic = INTRINSIC_URGENCY[offerType];
  const modifier = MATURITY_MODIFIER[icpMaturity];
  return Math.min(intrinsic + modifier, 25);
}

// ========== DIMENSION 2: Buying Power (0-20) ==========
const ICP_SIZE_BUDGET: Record<ICPSize, number> = {
  '21_100_employees': 12,
  '6_20_employees': 10,
  '100_plus_employees': 8,
  '1_5_employees': 5,
  'solo_founder': 3,
};

const ICP_INDUSTRY_BUDGET: Record<ICPIndustry, number> = {
  saas_tech: 8,
  professional_services: 7,
  dtc_ecommerce: 6,
  b2b_service_agency: 5,
  local_services: 4,
};

function calculateBuyingPower(icpSize: ICPSize, icpIndustry: ICPIndustry): number {
  const sizeBudget = ICP_SIZE_BUDGET[icpSize];
  const industryBudget = ICP_INDUSTRY_BUDGET[icpIndustry];
  return Math.min(sizeBudget + industryBudget, 20);
}

// ========== DIMENSION 3: Pricing Fit (0-20) ==========
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

// ========== DIMENSION 4: Execution Feasibility (0-20) ==========
// FulfillmentFeasibility scores based on new fulfillment options
const FULFILLMENT_FEASIBILITY: Record<FulfillmentComplexity, number> = {
  software_platform: 10,
  package_based: 8,
  coaching_advisory: 7,
  custom_dfy: 5,
  staffing_placement: 3,
};

// Matrix D: UsageOutputType × ICPIndustry (only if usage-based)
const MATRIX_D: Record<UsageOutputType, Record<ICPIndustry, number>> = {
  lead_based: { local_services: 1, professional_services: 3, b2b_service_agency: 5, dtc_ecommerce: -1, saas_tech: 4 },
  conversion_based: { local_services: -1, professional_services: 4, b2b_service_agency: 5, dtc_ecommerce: 5, saas_tech: 5 },
  task_based: { local_services: -3, professional_services: 1, b2b_service_agency: 3, dtc_ecommerce: 2, saas_tech: 4 },
};

function calculateExecutionFeasibility(
  fulfillmentComplexity: FulfillmentComplexity,
  pricingStructure: PricingStructure,
  usageOutputType: UsageOutputType | null,
  icpIndustry: ICPIndustry
): number {
  const fulfillmentFeas = FULFILLMENT_FEASIBILITY[fulfillmentComplexity];

  let matrixDScore = 5; // neutral if not usage-based

  if (pricingStructure === 'usage_based' && usageOutputType) {
    const rawScore = MATRIX_D[usageOutputType][icpIndustry];
    // Normalize from -3 to +5 to 0-10
    matrixDScore = Math.max(0, Math.min(10, rawScore + 5));
  }

  return Math.min(fulfillmentFeas + matrixDScore, 20);
}

// ========== DIMENSION 5: Risk Alignment (0-15) ==========
// Matrix: ICPMaturity × RiskModel with values 0-15
const RISK_ALIGNMENT_MATRIX: Record<ICPMaturity, Record<RiskModel, number>> = {
  pre_revenue: {
    no_guarantee: 3,
    conditional_guarantee: 6,
    full_guarantee: 0,
    performance_only: 4,
    pay_after_results: 5,
  },
  early_traction: {
    no_guarantee: 4,
    conditional_guarantee: 7,
    full_guarantee: 2,
    performance_only: 6,
    pay_after_results: 7,
  },
  scaling: {
    no_guarantee: 5,
    conditional_guarantee: 9,
    full_guarantee: 7,
    performance_only: 10,
    pay_after_results: 9,
  },
  mature: {
    no_guarantee: 7,
    conditional_guarantee: 8,
    full_guarantee: 6,
    performance_only: 4,
    pay_after_results: 7,
  },
  enterprise: {
    no_guarantee: 6,
    conditional_guarantee: 7,
    full_guarantee: 5,
    performance_only: 3,
    pay_after_results: 6,
  },
};

function calculateRiskAlignment(
  icpMaturity: ICPMaturity,
  riskModel: RiskModel
): number {
  const riskScore = RISK_ALIGNMENT_MATRIX[icpMaturity][riskModel];
  return Math.max(0, Math.min(15, riskScore));
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
// Composite of 5 dimensions: Pain Urgency, Buying Power, Pricing Fit, Execution Feasibility, Risk Alignment
function calculateAlignmentScoreFromDimensions(
  painUrgency: number,
  buyingPower: number,
  pricingFit: number,
  executionFeasibility: number,
  riskAlignment: number
): number {
  // Sum all dimensions and cap at 100
  const total = painUrgency + buyingPower + pricingFit + executionFeasibility + riskAlignment;
  return Math.min(100, total);
}

// ========== READINESS SCORE (0-10) ==========
function calculateReadinessScore(alignmentScore: number): number {
  return Math.round((alignmentScore / 10) * 10) / 10; // One decimal place
}

// ========== READINESS LABEL ==========
type ReadinessLabel = 'Weak' | 'Moderate' | 'Strong' | 'High Potential';

function getReadinessLabel(readinessScore: number): ReadinessLabel {
  if (readinessScore < 4.0) return 'Weak';
  if (readinessScore < 6.0) return 'Moderate';
  if (readinessScore < 8.0) return 'Strong';
  return 'High Potential';
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
  const { offerType, icpIndustry, icpSize, icpMaturity, pricingStructure, riskModel, fulfillmentComplexity } = formData;
  
  // Base required fields (including riskModel)
  if (!offerType || !icpIndustry || !icpSize || !icpMaturity || !pricingStructure || !riskModel || !fulfillmentComplexity) {
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

// ========== MAIN SCORING FUNCTION ==========
export function calculateScore(formData: DiagnosticFormData): ScoringResult | null {
  if (!isFormComplete(formData)) {
    return null;
  }

  const { 
    offerType, icpIndustry, icpSize, icpMaturity, 
    pricingStructure, recurringPriceTier, oneTimePriceTier,
    usageOutputType, usageVolumeTier, riskModel, fulfillmentComplexity 
  } = formData;

  const dimensionScores: DimensionScores = {
    painUrgency: calculatePainUrgency(offerType!, icpMaturity!),
    buyingPower: calculateBuyingPower(icpSize!, icpIndustry!),
    pricingFit: calculatePricingFit(icpSize!, pricingStructure!, recurringPriceTier, oneTimePriceTier, usageVolumeTier),
    executionFeasibility: calculateExecutionFeasibility(fulfillmentComplexity!, pricingStructure!, usageOutputType, icpIndustry!),
    riskAlignment: calculateRiskAlignment(icpMaturity!, riskModel!),
  };

  const switchingCost = calculateSwitchingCost(pricingStructure!, fulfillmentComplexity!);
  
  // Calculate alignment score from all 5 dimensions
  const alignmentScore = calculateAlignmentScoreFromDimensions(
    dimensionScores.painUrgency, 
    dimensionScores.buyingPower, 
    dimensionScores.pricingFit,
    dimensionScores.executionFeasibility,
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
export { MATRIX_B, MATRIX_D, RISK_ALIGNMENT_MATRIX };
