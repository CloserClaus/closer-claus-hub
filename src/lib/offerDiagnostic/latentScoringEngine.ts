// ============= Latent Variable Scoring Engine =============
// Replaces legacy dimension scoring with 5 latent variables
// Each latent variable scores 0-20, total alignment = sum of all 5 (0-100)

import type {
  DiagnosticFormData,
  ICPIndustry,
  ICPSize,
  ICPMaturity,
  PricingStructure,
  RecurringPriceTier,
  OneTimePriceTier,
  HybridRetainerTier,
  PerformanceCompTier,
  FulfillmentComplexity,
  RiskModel,
  ProofLevel,
  PromiseBucket,
  OfferType,
  VerticalSegment,
} from './types';

// ========== TYPES ==========

export interface LatentScores {
  economicHeadroom: number;       // 0-20
  proofToPromise: number;         // 0-20
  fulfillmentScalability: number; // 0-20
  riskAlignment: number;          // 0-20
  channelFit: number;             // 0-20
}

export type LatentBottleneckKey = keyof LatentScores;

export type ReadinessLabel = 'Strong' | 'Moderate' | 'Weak';

export interface LatentScoringResult {
  alignmentScore: number;          // 0-100
  readinessLabel: ReadinessLabel;
  latentScores: LatentScores;
  latentBottleneckKey: LatentBottleneckKey;
}

// ========== EXPECTATION BANDS ==========

type ExpectationBand = 'Low' | 'Medium' | 'High' | 'Premium';

// Map vertical segments to expectation bands
const VERTICAL_EXPECTATION_BANDS: Record<VerticalSegment, ExpectationBand> = {
  // Local Services - Low expectation
  home_services: 'Low',
  health_wellness: 'Low',
  trades: 'Low',
  hospitality: 'Low',
  real_estate_services: 'Medium',
  events: 'Low',
  // Professional Services - Medium to High
  accounting: 'Medium',
  legal: 'High',
  consulting: 'High',
  insurance: 'Medium',
  engineering_architecture: 'High',
  financial_advisors: 'High',
  // Ecommerce / DTC - Medium
  fashion: 'Medium',
  health_supplements: 'Medium',
  consumer_electronics: 'Medium',
  home_kitchen: 'Medium',
  beauty: 'Medium',
  other_dtc: 'Medium',
  // SaaS / Tech - High to Premium
  workflow_tools: 'High',
  devtools: 'Premium',
  ecommerce_enablement: 'High',
  sales_marketing_tools: 'High',
  healthcare_tech: 'Premium',
  vertical_saas: 'High',
  // B2B Service Agency - High
  marketing_agency: 'High',
  sales_agency: 'High',
  branding_agency: 'Medium',
  creative_agency: 'Medium',
  dev_agency: 'High',
  it_services: 'High',
  // Information / Coaching - Low to Medium
  business_coaching: 'Medium',
  fitness_coaching: 'Low',
  career_coaching: 'Low',
  info_products: 'Low',
  education: 'Medium',
  certification: 'Medium',
  // Real Estate - Medium to High
  brokerages: 'High',
  investors: 'High',
  property_management: 'Medium',
  wholesaling: 'Medium',
  development: 'Premium',
  rentals: 'Medium',
  // Healthcare - High
  clinics: 'High',
  dental: 'High',
  chiro_pt: 'Medium',
  medspa: 'High',
  home_care: 'Medium',
  specialty_practices: 'High',
  // Other B2B - Medium
  industrial_b2b: 'Medium',
  manufacturing: 'Medium',
  supply_chain: 'Medium',
  staffing: 'Medium',
  logistics: 'Medium',
  other: 'Medium',
};

// Expected price ranges per band (monthly equivalent)
const BAND_PRICE_RANGES: Record<ExpectationBand, { min: number; max: number }> = {
  Low: { min: 0, max: 500 },
  Medium: { min: 300, max: 2000 },
  High: { min: 1500, max: 5000 },
  Premium: { min: 4000, max: 15000 },
};

// Price tier midpoints
const RECURRING_MIDPOINTS: Record<RecurringPriceTier, number> = {
  'under_150': 100,
  '150_500': 325,
  '500_2k': 1250,
  '2k_5k': 3500,
  '5k_plus': 7500,
};

const HYBRID_MIDPOINTS: Record<HybridRetainerTier, number> = {
  'under_150': 100,
  '150_500': 325,
  '500_2k': 1250,
  '2k_5k': 3500,
  '5k_plus': 7500,
};

const ONE_TIME_MIDPOINTS: Record<OneTimePriceTier, number> = {
  'under_3k': 1000,
  '3k_10k': 6500,
  '10k_plus': 15000,
};

// ========== LATENT VARIABLE 1: ECONOMIC HEADROOM (0-20) ==========
// Measures whether the ICP can comfortably afford the offer

function calculateEconomicHeadroom(formData: DiagnosticFormData): number {
  let score = 10; // Baseline
  
  const { 
    verticalSegment, icpMaturity, pricingStructure, 
    recurringPriceTier, oneTimePriceTier, hybridRetainerTier,
    performanceCompTier
  } = formData;
  
  // Get expectation band
  const band = verticalSegment ? VERTICAL_EXPECTATION_BANDS[verticalSegment] : 'Medium';
  const priceRange = BAND_PRICE_RANGES[band];
  
  // Get normalized monthly price
  let monthlyPrice: number | null = null;
  if (pricingStructure === 'recurring' && recurringPriceTier) {
    monthlyPrice = RECURRING_MIDPOINTS[recurringPriceTier];
  } else if (pricingStructure === 'hybrid' && hybridRetainerTier) {
    monthlyPrice = HYBRID_MIDPOINTS[hybridRetainerTier];
  } else if (pricingStructure === 'one_time' && oneTimePriceTier) {
    monthlyPrice = ONE_TIME_MIDPOINTS[oneTimePriceTier] / 3;
  }
  
  // Apply price position deltas
  if (monthlyPrice !== null) {
    if (monthlyPrice < priceRange.min) {
      score += 4; // Below expectation
    } else if (monthlyPrice <= priceRange.max) {
      score += 2; // Matches expectation
    } else if (monthlyPrice <= priceRange.max * 1.5) {
      score -= 2; // Slightly above
    } else {
      score -= 6; // Far above
    }
  }
  
  // ICP maturity modifiers
  if (icpMaturity === 'scaling' || icpMaturity === 'mature' || icpMaturity === 'enterprise') {
    score += 2;
  } else if (icpMaturity === 'pre_revenue' || icpMaturity === 'early_traction') {
    score -= 3;
  }
  
  // Hybrid with reasonable retainer bonus
  if (pricingStructure === 'hybrid' && hybridRetainerTier) {
    score += 1;
  }
  
  // Performance-only with % revenue penalty
  if (pricingStructure === 'performance_only' && performanceCompTier) {
    const percentBased = ['under_15_percent', '15_30_percent', 'over_30_percent'].includes(performanceCompTier);
    if (percentBased) {
      score -= 4;
    }
  }
  
  return Math.max(0, Math.min(20, score));
}

// ========== LATENT VARIABLE 2: PROOF-TO-PROMISE CREDIBILITY (0-20) ==========
// Measures whether proof level justifies the promise being made

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
  
  const { proofLevel, promise } = formData;
  
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
  
  return Math.max(0, Math.min(20, score));
}

// ========== LATENT VARIABLE 3: FULFILLMENT SCALABILITY (0-20) ==========
// Measures how reliably the offer can be delivered repeatedly

function calculateFulfillmentScalability(formData: DiagnosticFormData): number {
  let score = 10; // Baseline
  
  const { fulfillmentComplexity, pricingStructure, icpSize } = formData;
  
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

// ========== BOTTLENECK DETECTION ==========

function findLatentBottleneck(scores: LatentScores): LatentBottleneckKey {
  const entries = Object.entries(scores) as [LatentBottleneckKey, number][];
  
  // Priority order for tie-breaking (higher downstream business impact)
  const priorityOrder: LatentBottleneckKey[] = [
    'economicHeadroom',
    'proofToPromise',
    'fulfillmentScalability',
    'riskAlignment',
    'channelFit',
  ];
  
  // Find lowest score
  let lowestKey: LatentBottleneckKey = 'economicHeadroom';
  let lowestScore = 20;
  
  for (const key of priorityOrder) {
    const score = scores[key];
    if (score < lowestScore) {
      lowestScore = score;
      lowestKey = key;
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
    fulfillmentComplexity, proofLevel 
  } = formData;
  
  if (!offerType || !promise || !icpIndustry || !verticalSegment || 
      !icpSize || !icpMaturity || !pricingStructure || !riskModel || 
      !fulfillmentComplexity || !proofLevel) {
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

export function calculateLatentScores(formData: DiagnosticFormData): LatentScoringResult | null {
  if (!isFormCompleteForLatent(formData)) {
    return null;
  }
  
  const latentScores: LatentScores = {
    economicHeadroom: calculateEconomicHeadroom(formData),
    proofToPromise: calculateProofToPromise(formData),
    fulfillmentScalability: calculateFulfillmentScalability(formData),
    riskAlignment: calculateRiskAlignmentLatent(formData),
    channelFit: calculateChannelFit(formData),
  };
  
  // Sum all 5 latent variables (each 0-20) = 0-100
  const alignmentScore = Math.min(100, 
    latentScores.economicHeadroom +
    latentScores.proofToPromise +
    latentScores.fulfillmentScalability +
    latentScores.riskAlignment +
    latentScores.channelFit
  );
  
  const readinessLabel = getReadinessLabel(alignmentScore);
  const latentBottleneckKey = findLatentBottleneck(latentScores);
  
  return {
    alignmentScore,
    readinessLabel,
    latentScores,
    latentBottleneckKey,
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
};

// ========== LATENT SCORE LABELS ==========

export const LATENT_SCORE_LABELS: Record<LatentBottleneckKey, string> = {
  economicHeadroom: 'Economic Headroom',
  proofToPromise: 'Proof-to-Promise Credibility',
  fulfillmentScalability: 'Fulfillment Scalability',
  riskAlignment: 'Risk Alignment',
  channelFit: 'Channel Fit',
};
