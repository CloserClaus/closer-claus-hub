// Scoring Engine - Implements the new spec with 6 dimensions
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
  FulfillmentComplexity,
  RiskModel,
  ProofLevel,
  PromiseBucket,
  ScoringSegment,
  RecurringPriceTier,
} from './types';

// ========== DIMENSION 1: Pain/Urgency (0-25) ==========
// Formula: intrinsicMap[offerType] + maturityBonus[icpMaturity]

const INTRINSIC_URGENCY: Record<OfferType, number> = {
  demand_creation: 10,
  demand_capture: 8,
  outbound_sales_enablement: 15,
  retention_monetization: 12,
  operational_enablement: 6,
};

const MATURITY_BONUS: Record<ICPMaturity, number> = {
  pre_revenue: 0,
  early_traction: 8,
  scaling: 10,
  mature: 5,
  enterprise: 3,
};

function calculatePainUrgency(offerType: OfferType, icpMaturity: ICPMaturity): number {
  const intrinsic = INTRINSIC_URGENCY[offerType];
  const bonus = MATURITY_BONUS[icpMaturity];
  return Math.min(intrinsic + bonus, 25);
}

// ========== DIMENSION 2: Buying Power (0-20) ==========
// Formula: sizeBudget[icpSize] + industryBudget[icpIndustry]

const SIZE_BUDGET: Record<ICPSize, number> = {
  solo_founder: 3,
  '1_5_employees': 6,
  '6_20_employees': 12,
  '21_100_employees': 15,
  '100_plus_employees': 10,
};

const INDUSTRY_BUDGET: Record<ICPIndustry, number> = {
  saas_tech: 10,
  professional_services: 8,
  dtc_ecommerce: 7,
  b2b_service_agency: 6,
  local_services: 5,
  // Legacy industries (mapped to closest)
  information_coaching: 5,
  real_estate: 6,
  healthcare: 7,
  other_b2b: 6,
};

function calculateBuyingPower(icpSize: ICPSize, icpIndustry: ICPIndustry): number {
  const size = SIZE_BUDGET[icpSize];
  const industry = INDUSTRY_BUDGET[icpIndustry] || 5;
  return Math.min(size + industry, 20);
}

// ========== DIMENSION 3: Pricing Fit (0-20) ==========
// Formula: base[priceTier] + modifierMatrix[pricingStructure][icpSize]

const PRICE_TIER_BASE: Record<string, number> = {
  under_150: 3,
  '150_500': 5,
  '500_2k': 7,
  '2k_5k': 9,
  '5k_plus': 6,
  // Legacy one-time tiers
  under_3k: 4,
  '3k_10k': 7,
  '10k_plus': 8,
};

const PRICING_MODIFIER_MATRIX: Record<string, Record<ICPSize, number>> = {
  retainer: {
    solo_founder: 1,
    '1_5_employees': 2,
    '6_20_employees': 3,
    '21_100_employees': 5,
    '100_plus_employees': 4,
  },
  hybrid: {
    solo_founder: 2,
    '1_5_employees': 3,
    '6_20_employees': 5,
    '21_100_employees': 5,
    '100_plus_employees': 3,
  },
  performance_only: {
    solo_founder: -5,
    '1_5_employees': -2,
    '6_20_employees': 1,
    '21_100_employees': 2,
    '100_plus_employees': -2,
  },
  one_time_project: {
    solo_founder: 1,
    '1_5_employees': 2,
    '6_20_employees': 3,
    '21_100_employees': 3,
    '100_plus_employees': 2,
  },
  usage_based: {
    solo_founder: -3,
    '1_5_employees': -1,
    '6_20_employees': 3,
    '21_100_employees': 4,
    '100_plus_employees': 5,
  },
  // Legacy pricing structures
  recurring: {
    solo_founder: 1,
    '1_5_employees': 2,
    '6_20_employees': 3,
    '21_100_employees': 5,
    '100_plus_employees': 4,
  },
  one_time: {
    solo_founder: 1,
    '1_5_employees': 2,
    '6_20_employees': 3,
    '21_100_employees': 3,
    '100_plus_employees': 2,
  },
};

function calculatePricingFit(
  pricingStructure: PricingStructure,
  priceTier: string | null,
  icpSize: ICPSize
): number {
  const base = priceTier ? (PRICE_TIER_BASE[priceTier] || 5) : 5;
  const modifierMatrix = PRICING_MODIFIER_MATRIX[pricingStructure] || PRICING_MODIFIER_MATRIX.retainer;
  const modifier = modifierMatrix[icpSize] || 0;
  return Math.max(0, Math.min(base + modifier, 20));
}

// ========== DIMENSION 4: Execution Feasibility (0-15) ==========
// Formula: offerFeasibility[offerType] + fulfillmentFeasibility[fulfillment]

const OFFER_FEASIBILITY: Record<OfferType, number> = {
  demand_creation: 7,
  demand_capture: 6,
  outbound_sales_enablement: 9,
  retention_monetization: 10,
  operational_enablement: 5,
};

const FULFILLMENT_FEASIBILITY: Record<FulfillmentComplexity, number> = {
  custom_dfy: 5,
  productized_service: 8,
  package_based: 8, // Legacy alias
  coaching_advisory: 7,
  software_platform: 10,
  staffing_placement: 3,
};

function calculateExecutionFeasibility(
  offerType: OfferType,
  fulfillmentComplexity: FulfillmentComplexity
): number {
  const offer = OFFER_FEASIBILITY[offerType];
  const fulfillment = FULFILLMENT_FEASIBILITY[fulfillmentComplexity] || 5;
  // Average of the two, scaled to 15
  const raw = (offer + fulfillment) / 2;
  return Math.min(Math.round(raw * 1.5), 15);
}

// ========== DIMENSION 5: Risk Alignment (0-10) ==========
// Formula: riskBase[riskModel] + maturityModifier[icpMaturity]

const RISK_BASE: Record<RiskModel, number> = {
  no_guarantee: 3,
  conditional_guarantee: 8,
  full_guarantee: -2,
  pay_on_performance: 5,
  performance_only: 5, // Legacy alias
  pay_after_results: 6,
};

const RISK_MATURITY_MODIFIER: Record<ICPMaturity, number> = {
  pre_revenue: -1,
  early_traction: 1,
  scaling: 3,
  mature: 2,
  enterprise: 2,
};

function calculateRiskAlignment(riskModel: RiskModel, icpMaturity: ICPMaturity): number {
  const base = RISK_BASE[riskModel] ?? 3;
  const modifier = RISK_MATURITY_MODIFIER[icpMaturity];
  return Math.max(0, Math.min(base + modifier, 10));
}

// ========== DIMENSION 6: Outbound Fit (0-15) ==========
// Formula based on offerVsPromisePenalty and proofModifier

const OFFER_PROMISE_PENALTY: Record<OfferType, Record<PromiseBucket, number>> = {
  demand_creation: {
    top_of_funnel_volume: 0,
    mid_funnel_engagement: -2,
    top_line_revenue: -3,
    efficiency_cost_savings: -3,
    ops_compliance_outcomes: -3,
  },
  outbound_sales_enablement: {
    top_of_funnel_volume: 3,
    mid_funnel_engagement: 2,
    top_line_revenue: 1,
    efficiency_cost_savings: -1,
    ops_compliance_outcomes: -2,
  },
  demand_capture: {
    top_of_funnel_volume: 1,
    mid_funnel_engagement: 3,
    top_line_revenue: 3,
    efficiency_cost_savings: -1,
    ops_compliance_outcomes: -2,
  },
  retention_monetization: {
    top_of_funnel_volume: -2,
    mid_funnel_engagement: 1,
    top_line_revenue: 3,
    efficiency_cost_savings: 0,
    ops_compliance_outcomes: -1,
  },
  operational_enablement: {
    top_of_funnel_volume: -3,
    mid_funnel_engagement: -2,
    top_line_revenue: -2,
    efficiency_cost_savings: 3,
    ops_compliance_outcomes: 3,
  },
};

const PROOF_MODIFIER: Record<ProofLevel, number> = {
  none: -3,
  weak: -1,
  moderate: 1,
  strong: 3,
  category_killer: 4, // Legacy
};

function calculateOutboundFit(
  offerType: OfferType,
  promise: PromiseBucket,
  proofLevel: ProofLevel
): number {
  const basePenalty = OFFER_PROMISE_PENALTY[offerType]?.[promise] ?? -3;
  const proofMod = PROOF_MODIFIER[proofLevel] ?? 0;
  // Start from 10 and apply adjustments
  const raw = 10 + basePenalty + proofMod;
  return Math.max(0, Math.min(raw, 15));
}

// ========== TOTAL SCORE CALCULATION ==========
function calculateAlignmentScore(scores: DimensionScores): number {
  return Math.min(
    100,
    scores.painUrgency + 
    scores.buyingPower + 
    scores.pricingFit + 
    scores.executionFeasibility + 
    scores.riskAlignment + 
    scores.outboundFit
  );
}

// ========== READINESS LABEL ==========
export type ReadinessLabel = 'Weak' | 'Moderate' | 'Strong';

export function getReadinessLabel(alignmentScore: number): ReadinessLabel {
  if (alignmentScore < 40) return 'Weak';
  if (alignmentScore < 70) return 'Moderate';
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
    offerType,
    promise,
    icpIndustry,
    verticalSegment,
    icpSize,
    icpMaturity,
    pricingStructure,
    riskModel,
    fulfillmentComplexity,
    proofLevel,
  } = formData;

  // Base required fields
  if (
    !offerType ||
    !promise ||
    !icpIndustry ||
    !verticalSegment ||
    !icpSize ||
    !icpMaturity ||
    !pricingStructure ||
    !riskModel ||
    !fulfillmentComplexity ||
    !proofLevel
  ) {
    return false;
  }

  // Conditional field validation based on pricing structure
  if ((pricingStructure === 'retainer' || pricingStructure === 'recurring') && !formData.recurringPriceTier) {
    return false;
  }
  if ((pricingStructure === 'one_time_project' || pricingStructure === 'one_time') && !formData.oneTimePriceTier) {
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
    offerType,
    promise,
    icpIndustry,
    icpSize,
    icpMaturity,
    pricingStructure,
    recurringPriceTier,
    oneTimePriceTier,
    riskModel,
    fulfillmentComplexity,
    proofLevel,
  } = formData;

  // Determine price tier
  const priceTier = recurringPriceTier || oneTimePriceTier || null;

  const dimensionScores: DimensionScores = {
    painUrgency: calculatePainUrgency(offerType!, icpMaturity!),
    buyingPower: calculateBuyingPower(icpSize!, icpIndustry!),
    pricingFit: calculatePricingFit(pricingStructure!, priceTier, icpSize!),
    executionFeasibility: calculateExecutionFeasibility(offerType!, fulfillmentComplexity!),
    riskAlignment: calculateRiskAlignment(riskModel!, icpMaturity!),
    outboundFit: calculateOutboundFit(offerType!, promise!, proofLevel!),
  };

  const alignmentScore = calculateAlignmentScore(dimensionScores);

  // Calculate switching cost (legacy)
  const switchingCost = 10;

  const extendedScores: ExtendedScores = {
    ...dimensionScores,
    alignmentScore,
    switchingCost,
  };

  const visibleScore100 = alignmentScore;
  const visibleScore10 = Math.round(alignmentScore / 10 * 10) / 10;
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

// ========== LEGACY EXPORTS FOR COMPATIBILITY ==========
export const PROMISE_MATURITY_FIT: Record<PromiseBucket, Record<ICPMaturity, number>> = {
  top_of_funnel_volume: { pre_revenue: 2, early_traction: 6, scaling: 8, mature: 7, enterprise: 5 },
  mid_funnel_engagement: { pre_revenue: 1, early_traction: 7, scaling: 9, mature: 8, enterprise: 6 },
  top_line_revenue: { pre_revenue: 0, early_traction: 6, scaling: 10, mature: 9, enterprise: 4 },
  efficiency_cost_savings: { pre_revenue: 3, early_traction: 4, scaling: 6, mature: 7, enterprise: 8 },
  ops_compliance_outcomes: { pre_revenue: 5, early_traction: 4, scaling: 5, mature: 7, enterprise: 10 },
};

export const PROMISE_FULFILLMENT_FIT: Record<PromiseBucket, Record<FulfillmentComplexity, number>> = {
  top_of_funnel_volume: { custom_dfy: 8, productized_service: 7, package_based: 7, coaching_advisory: 5, software_platform: 6, staffing_placement: 9 },
  mid_funnel_engagement: { custom_dfy: 6, productized_service: 7, package_based: 7, coaching_advisory: 6, software_platform: 5, staffing_placement: 4 },
  top_line_revenue: { custom_dfy: 4, productized_service: 6, package_based: 6, coaching_advisory: 8, software_platform: 5, staffing_placement: 3 },
  efficiency_cost_savings: { custom_dfy: 5, productized_service: 6, package_based: 6, coaching_advisory: 6, software_platform: 9, staffing_placement: 4 },
  ops_compliance_outcomes: { custom_dfy: 3, productized_service: 4, package_based: 4, coaching_advisory: 7, software_platform: 8, staffing_placement: 2 },
};

export function getPromiseMaturityFit(promise: PromiseBucket, icpMaturity: ICPMaturity): number {
  return PROMISE_MATURITY_FIT[promise]?.[icpMaturity] ?? 5;
}

export function getPromiseFulfillmentFit(promise: PromiseBucket, fulfillmentComplexity: FulfillmentComplexity): number {
  return PROMISE_FULFILLMENT_FIT[promise]?.[fulfillmentComplexity] ?? 5;
}

// Additional exports for other engines
export const SEGMENT_BUDGET_TIER: Record<ScoringSegment, number> = {
  SaaS: 5,
  RealEstate: 4,
  Healthcare: 4,
  Professional: 4,
  DTC: 3,
  OtherB2B: 3,
  Info: 2,
  Local: 1,
};

export const PROOF_LEVEL_SCORE: Record<ProofLevel, number> = {
  none: 0,
  weak: 3,
  moderate: 6,
  strong: 10,
  category_killer: 10,
};

export const RECURRING_PRICE_TO_TIER: Record<RecurringPriceTier, number> = {
  under_150: 1,
  '150_500': 2,
  '500_2k': 3,
  '2k_5k': 4,
  '5k_plus': 5,
};

export const PROOF_FIT_SCORE: Record<ProofLevel, number> = {
  none: 0,
  weak: 1,
  moderate: 3,
  strong: 5,
  category_killer: 5,
};

export const PROMISE_FIT_SCORE: Record<PromiseBucket, number> = {
  top_of_funnel_volume: 5,
  top_line_revenue: 5,
  mid_funnel_engagement: 3,
  efficiency_cost_savings: 2,
  ops_compliance_outcomes: 1,
};

export const VERTICAL_FIT_SCORE: Record<ScoringSegment, number> = {
  SaaS: 10,
  Professional: 7,
  DTC: 5,
  RealEstate: 5,
  Healthcare: 5,
  OtherB2B: 5,
  Info: 4,
  Local: 3,
};

export function calculateOutboundFitLegacy(
  scoringSegment: ScoringSegment,
  proofLevel: ProofLevel,
  promise: PromiseBucket
): number {
  const verticalFit = VERTICAL_FIT_SCORE[scoringSegment] || 5;
  const proofFit = PROOF_FIT_SCORE[proofLevel] || 1;
  const promiseFit = PROMISE_FIT_SCORE[promise] || 2;
  return Math.min(verticalFit + proofFit + promiseFit, 20);
}
