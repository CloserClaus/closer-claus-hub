import type {
  DiagnosticFormData,
  ICPSize,
  ICPIndustry,
  ICPMaturity,
  FulfillmentComplexity,
  PricingStructure,
  RecurringPriceTier,
} from './types';

// ========== VIOLATION TYPES ==========

export type ViolationSeverity = 'high' | 'medium' | 'low';

export interface Violation {
  id: string;
  rule: string;
  severity: ViolationSeverity;
  recommendation: string;
}

// ========== INTERNAL CONSTRAINTS (NOT SHOWN TO USER) ==========

export interface ConstraintValues {
  buyingPowerConstraint: 'low' | 'moderate' | 'high';
  maturityConstraint: ICPMaturity;
  urgencyConstraint: 'low' | 'moderate' | 'high';
  fulfillmentComplexityConstraint: FulfillmentComplexity;
  riskToleranceConstraint: 'low' | 'moderate' | 'high';
  priceToValueConstraint: 'low' | 'moderate' | 'high';
}

// ========== CONSTRAINT DERIVATION ==========

function deriveBuyingPowerConstraint(
  icpSize: ICPSize,
  icpIndustry: ICPIndustry
): 'low' | 'moderate' | 'high' {
  const lowSizes: ICPSize[] = ['solo_founder', '1_5_employees'];
  const lowIndustries: ICPIndustry[] = ['local_services'];
  
  if (lowSizes.includes(icpSize) || lowIndustries.includes(icpIndustry)) {
    return 'low';
  }
  
  const highSizes: ICPSize[] = ['21_100_employees', '100_plus_employees'];
  const highIndustries: ICPIndustry[] = ['saas_tech', 'professional_services'];
  
  if (highSizes.includes(icpSize) && highIndustries.includes(icpIndustry)) {
    return 'high';
  }
  
  return 'moderate';
}

function deriveMaturityConstraint(icpMaturity: ICPMaturity): ICPMaturity {
  return icpMaturity;
}

function deriveUrgencyConstraint(offerType: string): 'low' | 'moderate' | 'high' {
  const highUrgency = ['outbound_sales_enablement', 'retention_monetization'];
  const moderateUrgency = ['demand_capture', 'demand_creation'];
  
  if (highUrgency.includes(offerType)) return 'high';
  if (moderateUrgency.includes(offerType)) return 'moderate';
  return 'low';
}

function deriveFulfillmentComplexityConstraint(
  fulfillmentComplexity: FulfillmentComplexity
): FulfillmentComplexity {
  return fulfillmentComplexity;
}

function deriveRiskToleranceConstraint(
  icpMaturity: ICPMaturity,
  icpSize: ICPSize
): 'low' | 'moderate' | 'high' {
  const lowMaturity: ICPMaturity[] = ['pre_revenue', 'early_traction'];
  const smallSizes: ICPSize[] = ['solo_founder', '1_5_employees'];
  
  if (lowMaturity.includes(icpMaturity) || smallSizes.includes(icpSize)) {
    return 'low';
  }
  
  const highMaturity: ICPMaturity[] = ['mature', 'enterprise'];
  const largeSizes: ICPSize[] = ['21_100_employees', '100_plus_employees'];
  
  if (highMaturity.includes(icpMaturity) && largeSizes.includes(icpSize)) {
    return 'high';
  }
  
  return 'moderate';
}

function derivePriceToValueConstraint(
  pricingStructure: PricingStructure,
  recurringPriceTier: RecurringPriceTier | null,
  fulfillmentComplexity: FulfillmentComplexity
): 'low' | 'moderate' | 'high' {
  // High-touch fulfillment with low price = low value
  const highTouchFulfillment: FulfillmentComplexity[] = ['custom_dfy', 'staffing_placement'];
  const lowPriceTiers: RecurringPriceTier[] = ['under_150', '150_500'];
  const highPriceTiers: RecurringPriceTier[] = ['2k_5k', '5k_plus'];
  
  if (highTouchFulfillment.includes(fulfillmentComplexity)) {
    if (pricingStructure === 'recurring' && recurringPriceTier && lowPriceTiers.includes(recurringPriceTier)) {
      return 'low';
    }
    if (pricingStructure === 'recurring' && recurringPriceTier && highPriceTiers.includes(recurringPriceTier)) {
      return 'high';
    }
  }
  
  // Software/platform with very high price without services
  if (fulfillmentComplexity === 'software_platform') {
    if (pricingStructure === 'recurring' && recurringPriceTier && highPriceTiers.includes(recurringPriceTier)) {
      return 'low'; // Software alone at high price = low perceived value
    }
  }
  
  return 'moderate';
}

export function deriveConstraints(formData: DiagnosticFormData): ConstraintValues | null {
  const { 
    offerType, icpIndustry, icpSize, icpMaturity, 
    pricingStructure, recurringPriceTier, fulfillmentComplexity 
  } = formData;
  
  if (!offerType || !icpIndustry || !icpSize || !icpMaturity || !pricingStructure || !fulfillmentComplexity) {
    return null;
  }
  
  return {
    buyingPowerConstraint: deriveBuyingPowerConstraint(icpSize, icpIndustry),
    maturityConstraint: deriveMaturityConstraint(icpMaturity),
    urgencyConstraint: deriveUrgencyConstraint(offerType),
    fulfillmentComplexityConstraint: deriveFulfillmentComplexityConstraint(fulfillmentComplexity),
    riskToleranceConstraint: deriveRiskToleranceConstraint(icpMaturity, icpSize),
    priceToValueConstraint: derivePriceToValueConstraint(pricingStructure, recurringPriceTier, fulfillmentComplexity),
  };
}

// ========== VIOLATION DETECTION RULES ==========

export function detectViolations(formData: DiagnosticFormData): Violation[] {
  const violations: Violation[] = [];
  const constraints = deriveConstraints(formData);
  
  if (!constraints) return violations;
  
  const { 
    icpIndustry, icpMaturity, pricingStructure, 
    recurringPriceTier, fulfillmentComplexity, offerType 
  } = formData;
  
  const highPriceTiers: RecurringPriceTier[] = ['2k_5k', '5k_plus'];
  const isHighPrice = pricingStructure === 'recurring' && recurringPriceTier && highPriceTiers.includes(recurringPriceTier);
  
  // RULE 1 — Budget vs Price Violation
  if (
    constraints.buyingPowerConstraint === 'low' && 
    isHighPrice
  ) {
    violations.push({
      id: 'budget_vs_price',
      rule: 'Budget vs Price Violation',
      severity: 'high',
      recommendation: 'Your buyer tier cannot afford this pricing. Either move down in price tier, simplify scope, or target larger companies.',
    });
  }
  
  // RULE 2 — Budget vs Fulfillment Complexity Violation
  const complexFulfillment: FulfillmentComplexity[] = ['custom_dfy', 'staffing_placement'];
  if (
    constraints.buyingPowerConstraint === 'low' && 
    fulfillmentComplexity && 
    complexFulfillment.includes(fulfillmentComplexity)
  ) {
    violations.push({
      id: 'budget_vs_fulfillment',
      rule: 'Budget vs Fulfillment Complexity Violation',
      severity: 'high',
      recommendation: 'Low-budget buyers cannot sustain labor-intensive delivery. Package scope or move upmarket.',
    });
  }
  
  // RULE 3 — Maturity vs Fulfillment Complexity Violation
  const immatureStages: ICPMaturity[] = ['pre_revenue', 'early_traction'];
  if (
    icpMaturity && 
    immatureStages.includes(icpMaturity) && 
    fulfillmentComplexity && 
    complexFulfillment.includes(fulfillmentComplexity)
  ) {
    violations.push({
      id: 'maturity_vs_fulfillment',
      rule: 'Maturity vs Fulfillment Complexity Violation',
      severity: 'high',
      recommendation: 'Immature buyers cannot consume complex fulfillment. Offer lighter packages, advisory, or DIY versions.',
    });
  }
  
  // RULE 4 — Maturity vs Risk Model Violation
  const acceptableRiskModels = ['performance_only', 'conditional_guarantee', 'pay_after_results'];
  if (
    icpMaturity === 'pre_revenue' && 
    formData.riskModel && 
    !acceptableRiskModels.includes(formData.riskModel)
  ) {
    violations.push({
      id: 'maturity_vs_risk',
      rule: 'Maturity vs Risk Model Violation',
      severity: 'high',
      recommendation: 'Pre-revenue buyers delay decisions unless risk is reduced. Add conditional guarantees, pay-after-results, or performance components.',
    });
  }
  
  // RULE 5 — Performance Model Misalignment Violation
  if (
    pricingStructure === 'performance_only' && 
    fulfillmentComplexity !== 'software_platform' && 
    offerType !== 'outbound_sales_enablement'
  ) {
    violations.push({
      id: 'performance_misalignment',
      rule: 'Performance Model Misalignment Violation',
      severity: 'medium',
      recommendation: 'Performance-only models require outbound or software control. Switch to hybrid or retainer + performance.',
    });
  }
  
  // RULE 6 — Software Pricing Violation
  if (
    fulfillmentComplexity === 'software_platform' && 
    isHighPrice
  ) {
    violations.push({
      id: 'software_pricing',
      rule: 'Software Pricing Violation',
      severity: 'low',
      recommendation: 'Software priced above $1500/mo stalls without services. Split into SaaS + onboarding or move to enterprise ICP.',
    });
  }
  
  // RULE 7 — Coaching Misfit Violation
  if (
    fulfillmentComplexity === 'coaching_advisory' && 
    icpMaturity === 'pre_revenue'
  ) {
    violations.push({
      id: 'coaching_misfit',
      rule: 'Coaching Misfit Violation',
      severity: 'low',
      recommendation: 'Pre-revenue buyers cannot implement coaching. Add done-for-you elements or move upmarket.',
    });
  }
  
  // RULE 8 — Churn Risk Violation
  const churnIndustries: ICPIndustry[] = ['dtc_ecommerce', 'local_services'];
  if (
    icpIndustry && 
    churnIndustries.includes(icpIndustry) && 
    pricingStructure === 'recurring' && 
    fulfillmentComplexity === 'custom_dfy'
  ) {
    violations.push({
      id: 'churn_risk',
      rule: 'Churn Risk Violation',
      severity: 'medium',
      recommendation: 'Recurring custom work in churn-heavy industries burns margin. Productize scope or switch to project-based.',
    });
  }
  
  return violations;
}

// ========== VIOLATION SORTING BY SEVERITY ==========

const SEVERITY_ORDER: Record<ViolationSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function sortViolationsBySeverity(violations: Violation[]): Violation[] {
  return [...violations].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
}

// ========== GET TOP 3 VIOLATIONS ==========

export function getTopViolations(formData: DiagnosticFormData, limit: number = 3): Violation[] {
  const violations = detectViolations(formData);
  const sorted = sortViolationsBySeverity(violations);
  return sorted.slice(0, limit);
}
