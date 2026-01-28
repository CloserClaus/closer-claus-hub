import type {
  DiagnosticFormData,
  ICPSize,
  ICPIndustry,
  ICPMaturity,
  FulfillmentComplexity,
  PricingStructure,
  RecurringPriceTier,
  Promise,
  ScoringSegment,
  ProofLevel,
  RiskModel,
  OfferType,
} from './types';
import { generateInferredContext } from './contextModifierEngine';
import { 
  getPromiseMaturityFit, 
  getPromiseFulfillmentFit, 
  SEGMENT_BUDGET_TIER, 
  PROOF_LEVEL_SCORE, 
  RECURRING_PRICE_TO_TIER,
  PROOF_FIT_SCORE,
  PROMISE_FIT_SCORE,
  VERTICAL_FIT_SCORE,
  calculateOutboundFit,
} from './scoringEngine';

// ========== VIOLATION TYPES ==========

export type ViolationSeverity = 'high' | 'medium' | 'low';

export interface Violation {
  id: string;
  rule: string;
  severity: ViolationSeverity;
  recommendation: string;
  fixCategory?: 'icp_shift' | 'promise_shift' | 'fulfillment_shift' | 'pricing_shift' | 'risk_shift';
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
  const lowIndustries: ICPIndustry[] = ['local_services', 'information_coaching'];
  
  if (lowSizes.includes(icpSize) || lowIndustries.includes(icpIndustry)) {
    return 'low';
  }
  
  const highSizes: ICPSize[] = ['21_100_employees', '100_plus_employees'];
  const highIndustries: ICPIndustry[] = ['saas_tech', 'professional_services', 'healthcare', 'real_estate'];
  
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

// ========== PROMISE-BASED VIOLATION DETECTION ==========

interface PromiseViolationResult {
  promiseMaturityFit: number;
  promiseFulfillmentFit: number;
  maturityMismatch: boolean;
  fulfillmentMismatch: boolean;
  doubleStress: boolean;
}

function detectPromiseViolations(formData: DiagnosticFormData): PromiseViolationResult | null {
  const { promise, icpMaturity, fulfillmentComplexity } = formData;
  
  if (!promise || !icpMaturity || !fulfillmentComplexity) {
    return null;
  }
  
  const promiseMaturityFit = getPromiseMaturityFit(promise, icpMaturity);
  const promiseFulfillmentFit = getPromiseFulfillmentFit(promise, fulfillmentComplexity);
  
  const maturityMismatch = promiseMaturityFit <= 3;
  const fulfillmentMismatch = promiseFulfillmentFit <= 3;
  const doubleStress = maturityMismatch && fulfillmentMismatch;
  
  return {
    promiseMaturityFit,
    promiseFulfillmentFit,
    maturityMismatch,
    fulfillmentMismatch,
    doubleStress,
  };
}

// ========== VIOLATION DETECTION RULES ==========

export function detectViolations(formData: DiagnosticFormData): Violation[] {
  const violations: Violation[] = [];
  const constraints = deriveConstraints(formData);
  
  if (!constraints) return violations;
  
  const { 
    icpIndustry, icpMaturity, pricingStructure, 
    recurringPriceTier, fulfillmentComplexity, offerType, promise 
  } = formData;
  
  const highPriceTiers: RecurringPriceTier[] = ['2k_5k', '5k_plus'];
  const isHighPrice = pricingStructure === 'recurring' && recurringPriceTier && highPriceTiers.includes(recurringPriceTier);
  
  // ========== PROMISE-BASED VIOLATIONS (NEW) ==========
  const promiseViolations = detectPromiseViolations(formData);
  
  if (promiseViolations) {
    // ViolationC: DoubleStress (highest severity - both mismatches)
    if (promiseViolations.doubleStress) {
      violations.push({
        id: 'double_stress',
        rule: 'Double Stress Violation',
        severity: 'high',
        recommendation: 'Critical misalignment: Your promise doesn\'t fit your ICP maturity OR your fulfillment model. Consider shifting to a different ICP stage, changing your promise, or switching fulfillment type.',
        fixCategory: 'icp_shift',
      });
    } else {
      // ViolationA: MaturityPromiseMismatch
      if (promiseViolations.maturityMismatch) {
        const maturityLabel = icpMaturity === 'pre_revenue' ? 'Pre-Revenue' : 
                             icpMaturity === 'early_traction' ? 'Early Traction' :
                             icpMaturity === 'scaling' ? 'Scaling' :
                             icpMaturity === 'mature' ? 'Mature' : 'Enterprise';
        
        violations.push({
          id: 'maturity_promise_mismatch',
          rule: 'Maturity-Promise Mismatch',
          severity: 'medium',
          recommendation: `Shift to Early Traction or Scaling buyers — ${maturityLabel} cannot support this promise. Consider changing your target ICP maturity stage.`,
          fixCategory: 'icp_shift',
        });
      }
      
      // ViolationB: FulfillmentPromiseMismatch
      if (promiseViolations.fulfillmentMismatch) {
        const promiseLabel = promise === 'top_of_funnel_volume' ? 'Top-of-Funnel Volume' :
                            promise === 'mid_funnel_engagement' ? 'Mid-Funnel Engagement' :
                            promise === 'top_line_revenue' ? 'Top-Line Revenue' :
                            promise === 'efficiency_cost_savings' ? 'Efficiency & Cost Savings' : 
                            'Ops & Compliance Outcomes';
        
        violations.push({
          id: 'fulfillment_promise_mismatch',
          rule: 'Fulfillment-Promise Mismatch',
          severity: 'medium',
          recommendation: `Switch fulfillment model to reliably deliver ${promiseLabel}. Your current fulfillment type doesn't support this promise effectively.`,
          fixCategory: 'fulfillment_shift',
        });
      }
    }
  }
  
  // ========== EXISTING VIOLATIONS ==========
  
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
      fixCategory: 'pricing_shift',
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
      fixCategory: 'fulfillment_shift',
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
      fixCategory: 'fulfillment_shift',
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
      fixCategory: 'risk_shift',
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
      fixCategory: 'pricing_shift',
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
      fixCategory: 'pricing_shift',
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
      fixCategory: 'icp_shift',
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
      fixCategory: 'pricing_shift',
    });
  }
  
  // ========== NEW VERTICAL/PROOF VIOLATIONS ==========
  
  const { scoringSegment, proofLevel, riskModel } = formData;
  
  // RULE 9 — Vertical Pricing Mismatch
  // Trigger: PriceTier > SegmentBudgetRange
  if (scoringSegment && recurringPriceTier && pricingStructure === 'recurring') {
    const segmentBudget = SEGMENT_BUDGET_TIER[scoringSegment];
    const priceTier = RECURRING_PRICE_TO_TIER[recurringPriceTier];
    
    if (priceTier > segmentBudget + 1) {
      violations.push({
        id: 'vertical_pricing_mismatch',
        rule: 'Vertical Pricing Mismatch',
        severity: 'high',
        recommendation: 'Your vertical typically cannot support this pricing level. Reduce retainer, switch to hybrid model, or move upmarket to a richer vertical.',
        fixCategory: 'pricing_shift',
      });
    }
  }
  
  // RULE 10 — Proof Risk Mismatch
  // Trigger: RiskModel requires more proof than available
  if (proofLevel && riskModel) {
    const proofScore = PROOF_LEVEL_SCORE[proofLevel];
    const highRiskModels: RiskModel[] = ['full_guarantee', 'pay_after_results', 'performance_only'];
    const needsHighProof = highRiskModels.includes(riskModel);
    
    // If using high-risk model but proof is weak/none
    if (needsHighProof && proofScore <= 5) {
      violations.push({
        id: 'proof_risk_mismatch',
        rule: 'Proof Risk Mismatch',
        severity: 'high',
        recommendation: 'Your risk model requires more proof to convert predictably. Add conditional guarantee instead, switch to pay-after-results only after wins, or collect case studies before scaling price.',
        fixCategory: 'risk_shift',
      });
    }
  }
  
  // ========== THRESHOLD-BASED VIOLATIONS (Using dimension scores) ==========
  // Note: These are detected using the cause inference engine post-scoring
  // The violations below are the primary rule-based violations
  
  // RULE 11 — Low Outbound Fit
  // Trigger: OutboundFit < 10
  if (scoringSegment && proofLevel && promise) {
    const outboundFit = calculateOutboundFit(scoringSegment, proofLevel, promise);
    
    if (outboundFit < 10) {
      violations.push({
        id: 'low_outbound_fit',
        rule: 'Low Outbound Fit',
        severity: 'high',
        recommendation: 'Outbound unlikely to convert. This ICP needs education before cold calls. Switch to solution-aware verticals like SaaS, adjust your promise to meetings instead of revenue, or use content/partnership channels first.',
        fixCategory: 'icp_shift',
      });
    }
  }
  
  // RULE 12 — Proof Promise Mismatch
  // Trigger: ProofFit <= 1 AND PromiseFit >= 5
  if (proofLevel && promise) {
    const proofFit = PROOF_FIT_SCORE[proofLevel];
    const promiseFit = PROMISE_FIT_SCORE[promise];
    
    if (proofFit <= 1 && promiseFit >= 5) {
      violations.push({
        id: 'proof_promise_mismatch',
        rule: 'Proof Promise Mismatch',
        severity: 'high',
        recommendation: 'High-trust promise without proof. Run pilot deals to build case studies, add conditional guarantee instead of full guarantee, or lower promise from revenue to booked meetings.',
        fixCategory: 'risk_shift',
      });
    }
  }
  
  // ========== PERFORMANCE-BASED VIOLATIONS (NEW) ==========
  
  const { performanceBasis, performanceCompTier } = formData;
  const earlyMaturities: ICPMaturity[] = ['pre_revenue', 'early_traction'];
  
  // RULE 13 — Performance Friction Violation
  // Trigger: (Hybrid or Performance Only) AND (% revenue or % profit) AND (Pre-revenue or Early traction)
  if (
    (pricingStructure === 'hybrid' || pricingStructure === 'performance_only') &&
    performanceBasis &&
    (performanceBasis === 'percent_revenue' || performanceBasis === 'percent_profit') &&
    icpMaturity &&
    earlyMaturities.includes(icpMaturity)
  ) {
    violations.push({
      id: 'performance_friction',
      rule: 'Performance Friction Violation',
      severity: 'high',
      recommendation: 'Avoid % revenue with immature ICPs. Switch from % revenue to $ per appointment, add retainer until revenue is stable, or target ICPs with more predictable revenue.',
      fixCategory: 'pricing_shift',
    });
  }
  
  // RULE 14 — Compensation Stability Violation
  // Trigger: (Hybrid or Performance Only) AND (30%+ or $500+/unit)
  const highCompTiers: typeof performanceCompTier[] = ['over_30_percent', 'over_500_unit'];
  if (
    (pricingStructure === 'hybrid' || pricingStructure === 'performance_only') &&
    performanceCompTier &&
    highCompTiers.includes(performanceCompTier)
  ) {
    violations.push({
      id: 'compensation_stability',
      rule: 'Compensation Stability Violation',
      severity: 'medium',
      recommendation: 'High compensation tiers reduce close rates. Lower percentage bands for faster close rates, lower unit payout for volume-based models, or add minimum retainer to cover delivery.',
      fixCategory: 'pricing_shift',
    });
  }
  
  // ========== CONTEXT-AWARE VIOLATIONS (NEW PATCH) ==========
  
  const inferredContext = generateInferredContext(formData);
  
  // RULE 15 — Proof Mismatch Violation
  // Trigger: (proof_level in ['None','Weak']) AND (inferProofExpectations='high')
  const weakProofLevels: ProofLevel[] = ['none', 'weak'];
  if (
    proofLevel &&
    weakProofLevels.includes(proofLevel) &&
    inferredContext.proofExpectation === 'high'
  ) {
    violations.push({
      id: 'proof_mismatch',
      rule: 'Proof Mismatch Violation',
      severity: 'high',
      recommendation: 'Your ICP expects strong proof but your current proof level is weak. Run 2-3 micro clients to gather screenshots and testimonials, narrow the promise until you have evidence, or stack proof assets before scaling outbound.',
      fixCategory: 'risk_shift',
    });
  }
  
  // RULE 16 — Pricing to Budget Mismatch Violation
  // Trigger: (inferBudgetExpectation='low' AND price_tier in ['$2,000–$5,000/mo','$5,000+/mo']) OR
  //          (inferBudgetExpectation='medium' AND price_tier='$5,000+/mo')
  const highPriceTiersArr: RecurringPriceTier[] = ['2k_5k', '5k_plus'];
  const veryHighPriceTiers: RecurringPriceTier[] = ['5k_plus'];
  if (
    pricingStructure === 'recurring' && recurringPriceTier &&
    (
      (inferredContext.budgetExpectation === 'low' && highPriceTiersArr.includes(recurringPriceTier)) ||
      (inferredContext.budgetExpectation === 'medium' && veryHighPriceTiers.includes(recurringPriceTier))
    )
  ) {
    violations.push({
      id: 'pricing_to_budget_mismatch',
      rule: 'Pricing to Budget Mismatch Violation',
      severity: 'high',
      recommendation: 'Your pricing exceeds what this ICP typically budgets. Move upmarket to ICPs with higher budgets, lower initial retainer and expand later, or switch to hybrid pricing to reduce upfront cost.',
      fixCategory: 'pricing_shift',
    });
  }
  
  // RULE 17 — Awareness Channel Mismatch Violation
  // Trigger: (inferMarketAwareness='problem-unaware' AND offer_type in ['Demand Capture','Outbound & Sales Enablement'])
  const outboundOfferTypes: OfferType[] = ['demand_capture', 'outbound_sales_enablement'];
  if (
    inferredContext.marketAwareness === 'problem-unaware' &&
    offerType &&
    outboundOfferTypes.includes(offerType)
  ) {
    violations.push({
      id: 'awareness_channel_mismatch',
      rule: 'Awareness Channel Mismatch Violation',
      severity: 'medium',
      recommendation: 'Problem-unaware ICPs don\'t respond to cold outbound. Move to solution-aware verticals, educate via inbound before outbound, or switch promise to cost-saving or efficiency.',
      fixCategory: 'icp_shift',
    });
  }
  
  // RULE 18 — Performance Immaturity Violation
  // Trigger: (pricing_structure='Performance-only' AND icp_maturity in ['Pre-revenue','Early traction'])
  if (
    pricingStructure === 'performance_only' &&
    icpMaturity &&
    earlyMaturities.includes(icpMaturity)
  ) {
    violations.push({
      id: 'performance_immaturity',
      rule: 'Performance Immaturity Violation',
      severity: 'high',
      recommendation: 'Performance-only pricing with immature ICPs creates unpredictable cash flow. Add minimum retainer to cover operational load, switch from % revenue to $ per appointment, or only use performance with solution-aware buyers.',
      fixCategory: 'pricing_shift',
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

// Custom severity order for new context-aware violations
const VIOLATION_PRIORITY: Record<string, number> = {
  performance_immaturity: 10,
  pricing_to_budget_mismatch: 9,
  proof_mismatch: 8,
  awareness_channel_mismatch: 7,
  // Existing violations get lower priority
  double_stress: 6,
  budget_vs_price: 5,
  proof_risk_mismatch: 5,
  low_outbound_fit: 5,
};

export function sortViolationsBySeverity(violations: Violation[]): Violation[] {
  return [...violations].sort((a, b) => {
    // First sort by custom priority if available
    const aPriority = VIOLATION_PRIORITY[a.id] || 0;
    const bPriority = VIOLATION_PRIORITY[b.id] || 0;
    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }
    // Fall back to severity order
    return SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
  });
}

// ========== GET TOP 3 VIOLATIONS ==========

export function getTopViolations(formData: DiagnosticFormData, limit: number = 3): Violation[] {
  const violations = detectViolations(formData);
  const sorted = sortViolationsBySeverity(violations);
  return sorted.slice(0, limit);
}
