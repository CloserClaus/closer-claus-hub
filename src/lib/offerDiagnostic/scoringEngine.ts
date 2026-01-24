import type {
  DiagnosticFormData,
  DimensionScores,
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
const FULFILLMENT_FEASIBILITY: Record<FulfillmentComplexity, number> = {
  automation: 10,
  hybrid_labor_systems: 8,
  hands_off_strategy: 7,
  hands_on_labor: 5,
  software: 4,
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
// Matrix C: ICPMaturity × PricingStructure
const MATRIX_C: Record<ICPMaturity, Record<PricingStructure, number>> = {
  pre_revenue: { recurring: -1, one_time: 2, performance_only: -5, usage_based: -3 },
  early_traction: { recurring: 2, one_time: 4, performance_only: -2, usage_based: 1 },
  scaling: { recurring: 3, one_time: 3, performance_only: 2, usage_based: 4 },
  mature: { recurring: 4, one_time: 2, performance_only: 1, usage_based: 3 },
  enterprise: { recurring: 5, one_time: 1, performance_only: 1, usage_based: 2 },
};

const PERFORMANCE_ADJUSTMENT: Record<ICPMaturity, number> = {
  pre_revenue: -5,
  early_traction: -2,
  scaling: 2,
  mature: 1,
  enterprise: 0,
};

function calculateRiskAlignment(
  icpMaturity: ICPMaturity,
  pricingStructure: PricingStructure
): number {
  const matrixCScore = MATRIX_C[icpMaturity][pricingStructure];
  // Normalize from -5 to +5 range to 0-15
  let normalized = Math.max(0, Math.min(15, matrixCScore + 10));

  // Add performance adjustment only if performance-only
  if (pricingStructure === 'performance_only') {
    normalized += PERFORMANCE_ADJUSTMENT[icpMaturity];
  }

  return Math.max(0, Math.min(15, normalized));
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
  const { offerType, icpIndustry, icpSize, icpMaturity, pricingStructure, fulfillmentComplexity } = formData;
  
  // Base required fields
  if (!offerType || !icpIndustry || !icpSize || !icpMaturity || !pricingStructure || !fulfillmentComplexity) {
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
    usageOutputType, usageVolumeTier, fulfillmentComplexity 
  } = formData;

  const dimensionScores: DimensionScores = {
    painUrgency: calculatePainUrgency(offerType!, icpMaturity!),
    buyingPower: calculateBuyingPower(icpSize!, icpIndustry!),
    pricingFit: calculatePricingFit(icpSize!, pricingStructure!, recurringPriceTier, oneTimePriceTier, usageVolumeTier),
    executionFeasibility: calculateExecutionFeasibility(fulfillmentComplexity!, pricingStructure!, usageOutputType, icpIndustry!),
    riskAlignment: calculateRiskAlignment(icpMaturity!, pricingStructure!),
  };

  const hiddenScore = 
    dimensionScores.painUrgency + 
    dimensionScores.buyingPower + 
    dimensionScores.pricingFit + 
    dimensionScores.executionFeasibility + 
    dimensionScores.riskAlignment;

  const visibleScore100 = Math.max(0, Math.min(100, hiddenScore));
  const visibleScore10 = Math.round((hiddenScore / 10) * 10) / 10; // One decimal place
  const grade = calculateGrade(hiddenScore);

  return {
    hiddenScore,
    visibleScore100,
    visibleScore10,
    grade,
    dimensionScores,
  };
}

// Export matrices for use in prescription engine
export { MATRIX_B, MATRIX_C, MATRIX_D };
