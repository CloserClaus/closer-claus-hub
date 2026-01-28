import type {
  DiagnosticFormData,
  ICPSize,
  ICPIndustry,
  OfferType,
  ICPMaturity,
  FulfillmentComplexity,
  PricingStructure,
  ContextModifiers,
  CashFlowLevel,
  PainType,
  MaturityLevel,
  FulfillmentType,
  MechanismStrength,
  ProofLevel,
  RecurringPriceTier,
} from './types';

// ========== INFERRED CONTEXT TYPES ==========
export type VerticalCapitalIntensity = 'low' | 'medium' | 'variable';
export type SalesMotion = 'sales-led' | 'project-led' | 'conversion-led' | 'product-led';
export type MarketAwareness = 'problem-unaware' | 'problem-aware' | 'solution-aware' | 'vendor-aware';
export type ProofExpectation = 'low' | 'medium' | 'high';
export type BudgetExpectation = 'low' | 'medium' | 'high';

export interface InferredContext {
  verticalCapitalIntensity: VerticalCapitalIntensity;
  salesMotion: SalesMotion;
  marketAwareness: MarketAwareness;
  proofExpectation: ProofExpectation;
  budgetExpectation: BudgetExpectation;
}

// ========== CONTEXT INFERENCE LAYER ==========

export function inferVerticalCapitalIntensity(industry: ICPIndustry | null): VerticalCapitalIntensity {
  if (!industry) return 'medium';
  
  const mediumIndustries: ICPIndustry[] = ['local_services', 'professional_services', 'dtc_ecommerce'];
  const lowIndustries: ICPIndustry[] = ['b2b_service_agency', 'information_coaching'];
  const variableIndustries: ICPIndustry[] = ['saas_tech'];
  
  if (mediumIndustries.includes(industry)) return 'medium';
  if (lowIndustries.includes(industry)) return 'low';
  if (variableIndustries.includes(industry)) return 'variable';
  
  return 'medium';
}

export function inferSalesMotion(pricingStructure: PricingStructure | null): SalesMotion {
  if (!pricingStructure) return 'sales-led';
  
  switch (pricingStructure) {
    case 'recurring':
    case 'hybrid':
      return 'sales-led';
    case 'one_time':
      return 'project-led';
    case 'performance_only':
      return 'conversion-led';
    case 'usage_based':
      return 'product-led';
    default:
      return 'sales-led';
  }
}

export function inferMarketAwareness(icpMaturity: ICPMaturity | null): MarketAwareness {
  if (!icpMaturity) return 'problem-aware';
  
  switch (icpMaturity) {
    case 'pre_revenue':
      return 'problem-unaware';
    case 'early_traction':
      return 'problem-aware';
    case 'scaling':
      return 'solution-aware';
    case 'mature':
    case 'enterprise':
      return 'vendor-aware';
    default:
      return 'problem-aware';
  }
}

export function inferProofExpectation(icpMaturity: ICPMaturity | null): ProofExpectation {
  if (!icpMaturity) return 'medium';
  
  const lowMaturities: ICPMaturity[] = ['pre_revenue', 'early_traction'];
  const scalingMaturities: ICPMaturity[] = ['scaling'];
  const highMaturities: ICPMaturity[] = ['mature', 'enterprise'];
  
  if (lowMaturities.includes(icpMaturity)) return 'low';
  if (scalingMaturities.includes(icpMaturity)) return 'medium';
  if (highMaturities.includes(icpMaturity)) return 'high';
  
  return 'medium';
}

export function inferBudgetExpectation(icpSize: ICPSize | null): BudgetExpectation {
  if (!icpSize) return 'medium';
  
  const lowSizes: ICPSize[] = ['solo_founder', '1_5_employees'];
  const mediumSizes: ICPSize[] = ['6_20_employees'];
  const highSizes: ICPSize[] = ['21_100_employees', '100_plus_employees'];
  
  if (lowSizes.includes(icpSize)) return 'low';
  if (mediumSizes.includes(icpSize)) return 'medium';
  if (highSizes.includes(icpSize)) return 'high';
  
  return 'medium';
}

export function generateInferredContext(formData: DiagnosticFormData): InferredContext {
  return {
    verticalCapitalIntensity: inferVerticalCapitalIntensity(formData.icpIndustry),
    salesMotion: inferSalesMotion(formData.pricingStructure),
    marketAwareness: inferMarketAwareness(formData.icpMaturity),
    proofExpectation: inferProofExpectation(formData.icpMaturity),
    budgetExpectation: inferBudgetExpectation(formData.icpSize),
  };
}

// ========== MODIFIER A: CashFlow ==========
const SIZE_TO_CASHFLOW: Record<ICPSize, CashFlowLevel> = {
  solo_founder: 'Low',
  '1_5_employees': 'Low',
  '6_20_employees': 'Moderate',
  '21_100_employees': 'High',
  '100_plus_employees': 'High',
};

const CASHFLOW_LEVELS: CashFlowLevel[] = ['Low', 'Moderate', 'High'];

function calculateCashFlow(icpSize: ICPSize, icpIndustry: ICPIndustry): CashFlowLevel {
  const baseCashFlow = SIZE_TO_CASHFLOW[icpSize];
  let levelIndex = CASHFLOW_LEVELS.indexOf(baseCashFlow);

  // Industry adjustments
  if (icpIndustry === 'saas_tech') {
    levelIndex = Math.min(levelIndex + 1, 2); // bump +1, max High
  } else if (icpIndustry === 'b2b_service_agency') {
    levelIndex = Math.max(levelIndex - 1, 0); // bump -1, min Low
  }
  // DTC/Ecommerce, Local Services, Professional Services = no change

  return CASHFLOW_LEVELS[levelIndex];
}

// ========== MODIFIER B: PainType ==========
const OFFER_TO_PAIN: Record<OfferType, PainType> = {
  outbound_sales_enablement: 'Revenue',
  demand_capture: 'Revenue',
  demand_creation: 'Brand',
  retention_monetization: 'Retention',
  operational_enablement: 'Efficiency',
};

function calculatePainType(offerType: OfferType): PainType {
  return OFFER_TO_PAIN[offerType];
}

// ========== MODIFIER C: Maturity ==========
const MATURITY_MAP: Record<ICPMaturity, MaturityLevel> = {
  pre_revenue: 'Pre',
  early_traction: 'Early',
  scaling: 'Scaling',
  mature: 'Mature',
  enterprise: 'Mature', // Enterprise maps to Mature
};

function calculateMaturity(icpMaturity: ICPMaturity): MaturityLevel {
  return MATURITY_MAP[icpMaturity];
}

// ========== MODIFIER D: Fulfillment ==========
const FULFILLMENT_MAP: Record<FulfillmentComplexity, FulfillmentType> = {
  custom_dfy: 'Labor',
  package_based: 'Hybrid',
  coaching_advisory: 'Hybrid',
  software_platform: 'Automation',
  staffing_placement: 'Staffing',
};

function calculateFulfillment(fulfillmentComplexity: FulfillmentComplexity): FulfillmentType {
  return FULFILLMENT_MAP[fulfillmentComplexity];
}

// ========== MODIFIER E: MechanismStrength ==========
const OFFER_BASE_STRENGTH: Record<OfferType, MechanismStrength> = {
  outbound_sales_enablement: 'Strong',
  retention_monetization: 'Strong',
  demand_capture: 'Medium',
  demand_creation: 'Weak',
  operational_enablement: 'Medium',
};

const MECHANISM_LEVELS: MechanismStrength[] = ['Weak', 'Medium', 'Strong', 'VeryStrong'];

// Pricing model boost values
const PRICING_BOOST: Record<PricingStructure, number> = {
  recurring: 0,
  one_time: 0,
  performance_only: 2,
  usage_based: 1,
  hybrid: 1, // Hybrid is like usage-based
};

function calculateMechanismStrength(
  offerType: OfferType,
  pricingStructure: PricingStructure
): MechanismStrength {
  const baseStrength = OFFER_BASE_STRENGTH[offerType];
  let levelIndex = MECHANISM_LEVELS.indexOf(baseStrength);

  // Apply pricing model boost
  const boost = PRICING_BOOST[pricingStructure];
  levelIndex = Math.min(levelIndex + boost, 3); // cap at VeryStrong

  return MECHANISM_LEVELS[levelIndex];
}

// ========== Main Export ==========
export function generateContextModifiers(formData: DiagnosticFormData): ContextModifiers | null {
  const { offerType, icpIndustry, icpSize, icpMaturity, pricingStructure, fulfillmentComplexity } = formData;

  // Validate required fields
  if (!offerType || !icpIndustry || !icpSize || !icpMaturity || !pricingStructure || !fulfillmentComplexity) {
    return null;
  }

  return {
    cashFlow: calculateCashFlow(icpSize, icpIndustry),
    painType: calculatePainType(offerType),
    maturity: calculateMaturity(icpMaturity),
    fulfillment: calculateFulfillment(fulfillmentComplexity),
    mechanismStrength: calculateMechanismStrength(offerType, pricingStructure),
  };
}

// Export individual calculators for testing
export {
  calculateCashFlow,
  calculatePainType,
  calculateMaturity,
  calculateFulfillment,
  calculateMechanismStrength,
};
