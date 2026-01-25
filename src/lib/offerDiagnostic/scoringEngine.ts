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

// PowerScore modifier based on ICPMaturity × RiskModel (-10 to +10)
const POWER_SCORE_RISK_MODIFIER: Record<ICPMaturity, Record<RiskModel, number>> = {
  pre_revenue: {
    performance_only: -10,
    pay_after_results: -5,
    full_guarantee: -15,
    conditional_guarantee: 0,
    no_guarantee: 0,
  },
  early_traction: {
    performance_only: 0,
    pay_after_results: 2,
    full_guarantee: -8,
    conditional_guarantee: 3,
    no_guarantee: 0,
  },
  scaling: {
    performance_only: 10,
    pay_after_results: 8,
    full_guarantee: 3,
    conditional_guarantee: 0,
    no_guarantee: -2,
  },
  mature: {
    performance_only: -4,
    pay_after_results: 0,
    full_guarantee: 3,
    conditional_guarantee: 0,
    no_guarantee: 0,
  },
  enterprise: {
    performance_only: -6,
    pay_after_results: -2,
    full_guarantee: 3,
    conditional_guarantee: 0,
    no_guarantee: 0,
  },
};

function calculateRiskAlignment(
  icpMaturity: ICPMaturity,
  riskModel: RiskModel
): number {
  const riskScore = RISK_ALIGNMENT_MATRIX[icpMaturity][riskModel];
  return Math.max(0, Math.min(15, riskScore));
}

function getPowerScoreRiskModifier(
  icpMaturity: ICPMaturity,
  riskModel: RiskModel
): number {
  return POWER_SCORE_RISK_MODIFIER[icpMaturity][riskModel];
}

// ========== SWITCHING COST (0-20) ==========
const SWITCHING_COST_BASE: Record<PricingStructure, number> = {
  recurring: 12,
  one_time: 4,
  performance_only: 6,
  usage_based: 10,
};

const FULFILLMENT_SWITCHING_MODIFIER: Record<FulfillmentComplexity, number> = {
  automation: 4,
  hybrid_labor_systems: 3,
  hands_off_strategy: 1,
  hands_on_labor: 2,
  software: 0,
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
// Composite of ICP alignment with offer and pricing
function calculateAlignmentScore(
  painUrgency: number,
  buyingPower: number,
  pricingFit: number
): number {
  // Weighted average normalized to 100
  const weighted = (painUrgency / 25) * 40 + (buyingPower / 20) * 30 + (pricingFit / 20) * 30;
  return Math.round(weighted);
}

// Alignment score with RiskAlignment included
function calculateAlignmentScoreWithRisk(
  painUrgency: number,
  buyingPower: number,
  pricingFit: number,
  riskAlignment: number
): number {
  // Original weighted components plus RiskAlignment contribution
  // Reweight to accommodate RiskAlignment: Pain 35%, BuyingPower 25%, PricingFit 25%, RiskAlignment 15%
  const weighted = 
    (painUrgency / 25) * 35 + 
    (buyingPower / 20) * 25 + 
    (pricingFit / 20) * 25 + 
    (riskAlignment / 15) * 15;
  return Math.min(100, Math.round(weighted));
}

// ========== POWER SCORE (0-100) ==========
// Composite of execution and differentiation
function calculatePowerScore(
  executionFeasibility: number,
  switchingCost: number,
  riskAlignment: number
): number {
  // Weighted average normalized to 100
  const weighted = (executionFeasibility / 20) * 40 + (switchingCost / 20) * 35 + (riskAlignment / 15) * 25;
  return Math.round(weighted);
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
  
  // Calculate base alignment score (with RiskAlignment added)
  const alignmentScore = calculateAlignmentScoreWithRisk(
    dimensionScores.painUrgency, 
    dimensionScores.buyingPower, 
    dimensionScores.pricingFit,
    dimensionScores.riskAlignment
  );
  
  // Calculate power score with risk modifier
  const basePowerScore = calculatePowerScore(dimensionScores.executionFeasibility, switchingCost, dimensionScores.riskAlignment);
  const riskModifier = getPowerScoreRiskModifier(icpMaturity!, riskModel!);
  const powerScore = Math.max(0, Math.min(100, basePowerScore + riskModifier));

  const extendedScores: ExtendedScores = {
    ...dimensionScores,
    alignmentScore,
    powerScore,
    switchingCost,
    riskModifier,
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
    extendedScores,
  };
}

// Export matrices for use in other engines
export { MATRIX_B, MATRIX_D, RISK_ALIGNMENT_MATRIX, POWER_SCORE_RISK_MODIFIER };
