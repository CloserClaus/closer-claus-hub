import type {
  DiagnosticFormData,
  DimensionScores,
  ScoringResult,
  OfferType,
  ICPMaturity,
  ICPSize,
  ICPIndustry,
  PricingModel,
  PriceTier,
  RiskStructure,
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

// ========== DIMENSION 2: Buying Power (0-25) ==========
const ICP_SIZE_BUDGET: Record<ICPSize, number> = {
  '21_100_employees': 15,
  '6_20_employees': 12,
  '100_plus_employees': 10,
  '1_5_employees': 6,
  'solo_founder': 3,
};

const ICP_INDUSTRY_BUDGET: Record<ICPIndustry, number> = {
  saas_tech: 10,
  professional_services: 8,
  dtc_ecommerce: 7,
  other_b2b: 6,
  local_services: 5,
};

function calculateBuyingPower(icpSize: ICPSize, icpIndustry: ICPIndustry): number {
  const sizeBudget = ICP_SIZE_BUDGET[icpSize];
  const industryBudget = ICP_INDUSTRY_BUDGET[icpIndustry];
  return Math.min(sizeBudget + industryBudget, 25);
}

// ========== DIMENSION 3: Execution Feasibility (0-20) ==========
const OFFER_FEASIBILITY: Record<OfferType, number> = {
  retention_monetization: 10,
  outbound_sales_enablement: 9,
  demand_creation: 7,
  demand_capture: 6,
  operational_enablement: 5,
};

const FULFILLMENT_FEASIBILITY: Record<FulfillmentComplexity, number> = {
  software_automation: 10,
  hybrid_labor_systems: 8,
  hands_off_strategy: 7,
  hands_on_labor: 5,
  staffing_placement: 3,
};

function calculateExecutionFeasibility(offerType: OfferType, fulfillmentComplexity: FulfillmentComplexity): number {
  const offerFeas = OFFER_FEASIBILITY[offerType];
  const fulfillmentFeas = FULFILLMENT_FEASIBILITY[fulfillmentComplexity];
  return Math.min(offerFeas + fulfillmentFeas, 20);
}

// ========== DIMENSION 4: Pricing Sanity (0-20) ==========
// Matrix B: ICPSize × PricingModel
const MATRIX_B: Record<ICPSize, Record<PricingModel, number>> = {
  solo_founder: { retainer: 1, hybrid: 2, performance_only: -5, one_time_project: 1, usage_based: -3 },
  '1_5_employees': { retainer: 2, hybrid: 3, performance_only: -2, one_time_project: 2, usage_based: -1 },
  '6_20_employees': { retainer: 3, hybrid: 5, performance_only: 1, one_time_project: 3, usage_based: 3 },
  '21_100_employees': { retainer: 5, hybrid: 5, performance_only: 2, one_time_project: 3, usage_based: 4 },
  '100_plus_employees': { retainer: 4, hybrid: 3, performance_only: -2, one_time_project: 2, usage_based: 5 },
};

const PRICE_TIER_SCORE: Record<PriceTier, number> = {
  '3k_10k': 10,
  '1k_3k': 8,
  'under_1k': 5,
  '10k_plus': 6,
  'performance_only': 0,
};

function calculatePricingSanity(icpSize: ICPSize, pricingModel: PricingModel, priceTier: PriceTier): number {
  const matrixBScore = MATRIX_B[icpSize][pricingModel];
  // Normalize matrix B score from -5 to +5 range to 0-10
  const normalizedMatrixB = Math.max(0, Math.min(10, matrixBScore + 5));
  const tierScore = PRICE_TIER_SCORE[priceTier];
  return Math.min(normalizedMatrixB + tierScore, 20);
}

// ========== DIMENSION 5: Risk Alignment (0-10) ==========
// Matrix C: ICPMaturity × RiskStructure
const MATRIX_C: Record<ICPMaturity, Record<RiskStructure, number>> = {
  pre_revenue: { no_guarantee: 1, conditional_guarantee: 2, full_guarantee: -5, pay_on_performance: -2, pay_after_results: 1 },
  early_traction: { no_guarantee: 2, conditional_guarantee: 4, full_guarantee: -2, pay_on_performance: 1, pay_after_results: 3 },
  scaling: { no_guarantee: 3, conditional_guarantee: 5, full_guarantee: 1, pay_on_performance: 3, pay_after_results: 4 },
  mature: { no_guarantee: 4, conditional_guarantee: 3, full_guarantee: 2, pay_on_performance: -1, pay_after_results: 2 },
  enterprise: { no_guarantee: 3, conditional_guarantee: 2, full_guarantee: 1, pay_on_performance: -2, pay_after_results: 1 },
};

function calculateRiskAlignment(icpMaturity: ICPMaturity, riskStructure: RiskStructure): number {
  const matrixCScore = MATRIX_C[icpMaturity][riskStructure];
  // Normalize from -5 to +5 range to 0-10
  return Math.max(0, Math.min(10, matrixCScore + 5));
}

// ========== MAIN SCORING FUNCTION ==========
export function calculateScore(formData: DiagnosticFormData): ScoringResult | null {
  // Validate all fields are filled
  const { offerType, icpIndustry, icpSize, icpMaturity, pricingModel, priceTier, riskStructure, fulfillmentComplexity } = formData;
  
  if (!offerType || !icpIndustry || !icpSize || !icpMaturity || !pricingModel || !priceTier || !riskStructure || !fulfillmentComplexity) {
    return null;
  }

  const dimensionScores: DimensionScores = {
    painUrgency: calculatePainUrgency(offerType, icpMaturity),
    buyingPower: calculateBuyingPower(icpSize, icpIndustry),
    executionFeasibility: calculateExecutionFeasibility(offerType, fulfillmentComplexity),
    pricingSanity: calculatePricingSanity(icpSize, pricingModel, priceTier),
    riskAlignment: calculateRiskAlignment(icpMaturity, riskStructure),
  };

  const hiddenScore = 
    dimensionScores.painUrgency + 
    dimensionScores.buyingPower + 
    dimensionScores.executionFeasibility + 
    dimensionScores.pricingSanity + 
    dimensionScores.riskAlignment;

  const visibleScore = Math.max(1, Math.min(10, Math.round(hiddenScore / 10)));

  return {
    hiddenScore,
    visibleScore,
    dimensionScores,
  };
}

// Export matrices for use in prescription engine
export { MATRIX_B, MATRIX_C };
