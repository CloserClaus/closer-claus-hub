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

// ========== MATRIX 1: ICP ↔ PRICE FIT ==========
// Determines price band based on ICP characteristics and applies fit modifier

type IcpPriceBand = 'LOW' | 'MID' | 'HIGH';
type PricePosition = 'TOO_LOW' | 'MATCHED' | 'PREMIUM';

const ICP_PRICE_FIT_MATRIX: Record<IcpPriceBand, Record<PricePosition, number>> = {
  LOW: { TOO_LOW: 1, MATCHED: 3, PREMIUM: -3 },
  MID: { TOO_LOW: -1, MATCHED: 4, PREMIUM: -1 },
  HIGH: { TOO_LOW: -3, MATCHED: 3, PREMIUM: 1 },
};

// Price tier midpoints for normalization (monthly equivalent)
const RECURRING_TIER_MIDPOINTS: Record<RecurringPriceTier, number> = {
  'under_150': 100,
  '150_500': 325,
  '500_2k': 1250,
  '2k_5k': 3500,
  '5k_plus': 7500,
};

const HYBRID_TIER_MIDPOINTS: Record<HybridRetainerTier, number> = {
  'under_150': 100,
  '150_500': 325,
  '500_2k': 1250,
  '2k_5k': 3500,
  '5k_plus': 7500,
};

const ONE_TIME_TIER_MIDPOINTS: Record<OneTimePriceTier, number> = {
  'under_3k': 1000,
  '3k_10k': 6500,
  '10k_plus': 15000,
};

// Price band expected ranges
const PRICE_BAND_RANGES: Record<IcpPriceBand, { min: number; max: number }> = {
  LOW: { min: 0, max: 500 },
  MID: { min: 300, max: 3000 },
  HIGH: { min: 2000, max: 10000 },
};

function deriveIcpPriceBand(
  icpIndustry: ICPIndustry | null,
  icpSize: ICPSize | null,
  icpMaturity: ICPMaturity | null
): IcpPriceBand {
  const lowSizes: ICPSize[] = ['solo_founder', '1_5_employees'];
  const highSizes: ICPSize[] = ['21_100_employees', '100_plus_employees'];
  
  // Local services with small companies = LOW
  if (icpIndustry === 'local_services' && icpSize && lowSizes.includes(icpSize)) {
    return 'LOW';
  }
  
  // Local services but scaling = MID
  if (icpIndustry === 'local_services' && icpMaturity === 'scaling') {
    return 'MID';
  }
  
  // Professional services with medium companies = MID
  if (icpIndustry === 'professional_services' && icpSize && ['6_20_employees', '21_100_employees'].includes(icpSize)) {
    return 'MID';
  }
  
  // SaaS, B2B services, or large companies = HIGH
  if (
    icpIndustry === 'saas_tech' || 
    icpIndustry === 'b2b_service_agency' ||
    (icpSize && highSizes.includes(icpSize))
  ) {
    return 'HIGH';
  }
  
  return 'MID'; // default
}

function getNormalizedMonthlyPrice(
  pricingStructure: PricingStructure | null,
  recurringPriceTier: RecurringPriceTier | null,
  hybridRetainerTier: HybridRetainerTier | null,
  oneTimePriceTier: OneTimePriceTier | null
): number | null {
  if (pricingStructure === 'recurring' && recurringPriceTier) {
    return RECURRING_TIER_MIDPOINTS[recurringPriceTier];
  }
  if (pricingStructure === 'hybrid' && hybridRetainerTier) {
    return HYBRID_TIER_MIDPOINTS[hybridRetainerTier];
  }
  if (pricingStructure === 'one_time' && oneTimePriceTier) {
    return ONE_TIME_TIER_MIDPOINTS[oneTimePriceTier] / 3; // Amortize over 3 months
  }
  if (pricingStructure === 'usage_based') {
    return null; // Neutral - no adjustment
  }
  return null;
}

function derivePricePosition(price: number | null, band: IcpPriceBand): PricePosition {
  if (price === null) return 'MATCHED'; // Neutral for usage-based
  
  const range = PRICE_BAND_RANGES[band];
  if (price < range.min) return 'TOO_LOW';
  if (price > range.max) return 'PREMIUM';
  return 'MATCHED';
}

function applyIcpPriceFitMatrix(
  dimensionScores: DimensionScores,
  formData: DiagnosticFormData
): DimensionScores {
  const { icpIndustry, icpSize, icpMaturity, pricingStructure, recurringPriceTier, hybridRetainerTier, oneTimePriceTier } = formData;
  
  const priceBand = deriveIcpPriceBand(icpIndustry, icpSize, icpMaturity);
  const normalizedPrice = getNormalizedMonthlyPrice(pricingStructure, recurringPriceTier, hybridRetainerTier, oneTimePriceTier);
  const pricePosition = derivePricePosition(normalizedPrice, priceBand);
  
  const modifier = ICP_PRICE_FIT_MATRIX[priceBand][pricePosition];
  const clampedModifier = Math.max(-4, Math.min(4, modifier));
  
  return {
    ...dimensionScores,
    pricingFit: Math.max(0, Math.min(15, dimensionScores.pricingFit + clampedModifier)),
  };
}

// ========== MATRIX 2: PROOF ↔ PROMISE SEVERITY ==========
// Adjusts risk alignment and outbound fit based on proof-promise match

type PromiseSeverity = 'LOW' | 'MID' | 'HIGH';
type ProofBucket = 'NONE' | 'WEAK' | 'MODERATE' | 'STRONG';

const PROOF_PROMISE_MATRIX: Record<ProofBucket, Record<PromiseSeverity, number>> = {
  NONE: { LOW: 0, MID: -3, HIGH: -6 },
  WEAK: { LOW: 1, MID: -2, HIGH: -4 },
  MODERATE: { LOW: 2, MID: 1, HIGH: -1 },
  STRONG: { LOW: 3, MID: 2, HIGH: 1 },
};

function derivePromiseSeverity(promise: PromiseBucket | null): PromiseSeverity {
  if (!promise) return 'MID';
  
  const lowSeverity: PromiseBucket[] = ['ops_compliance_outcomes', 'efficiency_cost_savings'];
  const highSeverity: PromiseBucket[] = ['top_line_revenue'];
  
  if (lowSeverity.includes(promise)) return 'LOW';
  if (highSeverity.includes(promise)) return 'HIGH';
  return 'MID';
}

function deriveProofBucket(proofLevel: ProofLevel | null): ProofBucket {
  if (!proofLevel || proofLevel === 'none') return 'NONE';
  if (proofLevel === 'weak') return 'WEAK';
  if (proofLevel === 'moderate') return 'MODERATE';
  return 'STRONG'; // strong or category_killer
}

function applyProofPromiseSeverityMatrix(
  dimensionScores: DimensionScores,
  formData: DiagnosticFormData
): DimensionScores {
  const { proofLevel, promise } = formData;
  
  const proofBucket = deriveProofBucket(proofLevel);
  const promiseSeverity = derivePromiseSeverity(promise);
  
  const rawModifier = PROOF_PROMISE_MATRIX[proofBucket][promiseSeverity];
  
  // Distribute 70% to riskAlignment, 30% to outboundFit
  const riskMod = Math.round(rawModifier * 0.7);
  const outboundMod = Math.round(rawModifier * 0.3);
  
  // Clamp per dimension (-5 to +5)
  const clampedRiskMod = Math.max(-5, Math.min(5, riskMod));
  const clampedOutboundMod = Math.max(-5, Math.min(5, outboundMod));
  
  return {
    ...dimensionScores,
    riskAlignment: Math.max(0, Math.min(10, dimensionScores.riskAlignment + clampedRiskMod)),
    outboundFit: Math.max(0, Math.min(20, dimensionScores.outboundFit + clampedOutboundMod)),
  };
}

// ========== MATRIX 3: ICP MATURITY ↔ PROMISE TIMELINE ==========
// Adjusts pain/urgency based on timeline match

type PromiseTimeline = 'SHORT' | 'MID' | 'LONG';
type MaturityBucket = 'PRE_REVENUE' | 'EARLY_TRACTION' | 'SCALING' | 'MATURE';

const MATURITY_PROMISE_TIMELINE_MATRIX: Record<MaturityBucket, Record<PromiseTimeline, number>> = {
  PRE_REVENUE: { SHORT: 1, MID: -1, LONG: -3 },
  EARLY_TRACTION: { SHORT: 2, MID: 1, LONG: -2 },
  SCALING: { SHORT: 1, MID: 3, LONG: 2 },
  MATURE: { SHORT: 0, MID: 2, LONG: 3 },
};

function derivePromiseTimeline(promise: PromiseBucket | null): PromiseTimeline {
  if (!promise) return 'MID';
  
  const shortTimeline: PromiseBucket[] = ['top_of_funnel_volume'];
  const longTimeline: PromiseBucket[] = ['top_line_revenue'];
  
  if (shortTimeline.includes(promise)) return 'SHORT';
  if (longTimeline.includes(promise)) return 'LONG';
  return 'MID';
}

function deriveMaturityBucket(icpMaturity: ICPMaturity | null): MaturityBucket {
  if (!icpMaturity || icpMaturity === 'pre_revenue') return 'PRE_REVENUE';
  if (icpMaturity === 'early_traction') return 'EARLY_TRACTION';
  if (icpMaturity === 'scaling') return 'SCALING';
  return 'MATURE'; // mature or enterprise
}

function applyMaturityPromiseTimelineMatrix(
  dimensionScores: DimensionScores,
  formData: DiagnosticFormData
): DimensionScores {
  const { icpMaturity, promise } = formData;
  
  const maturityBucket = deriveMaturityBucket(icpMaturity);
  const promiseTimeline = derivePromiseTimeline(promise);
  
  const modifier = MATURITY_PROMISE_TIMELINE_MATRIX[maturityBucket][promiseTimeline];
  const clampedModifier = Math.max(-4, Math.min(4, modifier));
  
  return {
    ...dimensionScores,
    painUrgency: Math.max(0, Math.min(20, dimensionScores.painUrgency + clampedModifier)),
  };
}

// ========== APPLY ALL RELATIONAL MATRICES ==========
function applyRelationalMatrices(
  dimensionScores: DimensionScores,
  formData: DiagnosticFormData
): DimensionScores {
  // Apply matrices in order: ICP-Price, Proof-Promise, Maturity-Timeline
  let scores = applyIcpPriceFitMatrix(dimensionScores, formData);
  scores = applyProofPromiseSeverityMatrix(scores, formData);
  scores = applyMaturityPromiseTimelineMatrix(scores, formData);
  return scores;
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
  
  // Apply relational matrices (post-base-score adjustments)
  dimensionScores = applyRelationalMatrices(dimensionScores, formData);

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
