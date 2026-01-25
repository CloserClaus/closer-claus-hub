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
} from './types';

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
  hands_on_labor: 'Labor',
  hands_off_strategy: 'Hybrid',
  hybrid_labor_systems: 'Hybrid',
  software: 'Automation',
  automation: 'Automation',
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
  usage_based: 1, // Treat as hybrid-like
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
