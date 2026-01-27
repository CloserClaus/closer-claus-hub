// Violation Engine - Detects violations and infers causes based on the new spec
import type {
  DiagnosticFormData,
  ICPSize,
  ICPIndustry,
  ICPMaturity,
  FulfillmentComplexity,
  PricingStructure,
  PromiseBucket,
  ProofLevel,
  RiskModel,
  OfferType,
} from './types';
import { calculateScore } from './scoringEngine';

// ========== VIOLATION TYPES ==========
export type ViolationSeverity = 'high' | 'medium' | 'low';

export interface Violation {
  id: string;
  rule: string;
  severity: ViolationSeverity;
  recommendation: string;
  fixCategory?: 'icp_shift' | 'promise_shift' | 'fulfillment_shift' | 'pricing_shift' | 'risk_shift';
}

// ========== VIOLATION FLAGS (from spec) ==========
export interface ViolationFlags {
  outboundViolation: boolean;
  executionViolation: boolean;
  pricingViolation: boolean;
  buyingPowerViolation: boolean;
  riskViolation: boolean;
  urgencyViolation: boolean;
}

// ========== CAUSE FLAGS (from spec) ==========
export interface CauseFlags {
  causeProofDeficiency: boolean;
  causePricingMisalignment: boolean;
  causeMarketMisalignment: boolean;
  causePromiseChannelMismatch: boolean;
  causeRiskMisalignment: boolean;
  causeFulfillmentBottleneck: boolean;
  causeAwarenessMismatch: boolean;
}

// ========== DETECT VIOLATION FLAGS ==========
export function detectViolationFlags(formData: DiagnosticFormData): ViolationFlags | null {
  const scoringResult = calculateScore(formData);
  if (!scoringResult) return null;

  const { dimensionScores } = scoringResult;

  return {
    outboundViolation: dimensionScores.outboundFit < 10,
    executionViolation: dimensionScores.executionFeasibility < 8,
    pricingViolation: dimensionScores.pricingFit < 10,
    buyingPowerViolation: dimensionScores.buyingPower < 10,
    riskViolation: dimensionScores.riskAlignment < 5,
    urgencyViolation: dimensionScores.painUrgency < 12,
  };
}

// ========== INFER CAUSES ==========
export function inferCauses(formData: DiagnosticFormData, violationFlags: ViolationFlags): CauseFlags {
  const {
    proofLevel,
    promise,
    icpMaturity,
    offerType,
    fulfillmentComplexity,
    icpSize,
  } = formData;

  const earlyMaturity: ICPMaturity[] = ['pre_revenue', 'early_traction'];
  const largeSizes: ICPSize[] = ['21_100_employees', '100_plus_employees'];
  const topFunnelPromises: PromiseBucket[] = ['top_of_funnel_volume', 'mid_funnel_engagement'];

  return {
    // ProofDeficiency: (proof_level in ['None','Weak']) AND (promise not in ['Top-of-funnel volume'])
    causeProofDeficiency: 
      (proofLevel === 'none' || proofLevel === 'weak') && 
      promise !== 'top_of_funnel_volume',

    // PricingMisalignment: pricingViolation
    causePricingMisalignment: violationFlags.pricingViolation,

    // MarketMisalignment: buyingPowerViolation AND icpMaturity in early stages
    causeMarketMisalignment: 
      violationFlags.buyingPowerViolation && 
      icpMaturity !== null && 
      earlyMaturity.includes(icpMaturity),

    // PromiseChannelMismatch: offer_type='Demand Creation' OR promise in top funnel
    causePromiseChannelMismatch:
      offerType === 'demand_creation' ||
      (promise !== null && topFunnelPromises.includes(promise)),

    // RiskMisalignment: riskViolation
    causeRiskMisalignment: violationFlags.riskViolation,

    // FulfillmentBottleneck: fulfillment='Custom DFY' AND icp_size is large
    causeFulfillmentBottleneck:
      fulfillmentComplexity === 'custom_dfy' &&
      icpSize !== null &&
      largeSizes.includes(icpSize),

    // AwarenessMismatch: early maturity AND revenue promise
    causeAwarenessMismatch:
      icpMaturity !== null &&
      earlyMaturity.includes(icpMaturity) &&
      promise === 'top_line_revenue',
  };
}

// ========== CONVERT TO VIOLATIONS ARRAY ==========
export function detectViolations(formData: DiagnosticFormData): Violation[] {
  const violations: Violation[] = [];
  
  const flags = detectViolationFlags(formData);
  if (!flags) return violations;

  const causes = inferCauses(formData, flags);
  const { proofLevel, fulfillmentComplexity, riskModel, offerType, icpSize, icpMaturity } = formData;

  // Check each cause and create violations

  if (causes.causeProofDeficiency) {
    violations.push({
      id: 'proof_deficiency',
      rule: 'Proof Deficiency',
      severity: 'high',
      recommendation: 'Narrow the claim until you have strong proof. Collect 3–5 wins before scaling promise.',
      fixCategory: 'risk_shift',
    });
  }

  if (causes.causePricingMisalignment) {
    violations.push({
      id: 'pricing_misalignment',
      rule: 'Pricing Misalignment',
      severity: 'high',
      recommendation: 'Switch to hybrid pricing to reduce sticker shock, or lower initial retainer until proof compounds.',
      fixCategory: 'pricing_shift',
    });
  }

  if (causes.causeMarketMisalignment) {
    violations.push({
      id: 'market_misalignment',
      rule: 'Market Misalignment',
      severity: 'high',
      recommendation: 'Shift upmarket to ICPs with higher buying power, or switch vertical to one with urgent problems & budgets.',
      fixCategory: 'icp_shift',
    });
  }

  if (causes.causePromiseChannelMismatch) {
    violations.push({
      id: 'promise_channel_mismatch',
      rule: 'Promise-Channel Mismatch',
      severity: 'medium',
      recommendation: 'Cold outbound will struggle here. Switch promise to revenue or pipeline outcomes, or add downstream proof.',
      fixCategory: 'promise_shift',
    });
  }

  if (causes.causeRiskMisalignment) {
    violations.push({
      id: 'risk_misalignment',
      rule: 'Risk Misalignment',
      severity: 'medium',
      recommendation: 'Use conditional guarantees instead of full guarantees. Add milestone-based commitments.',
      fixCategory: 'risk_shift',
    });
  }

  if (causes.causeFulfillmentBottleneck) {
    violations.push({
      id: 'fulfillment_bottleneck',
      rule: 'Fulfillment Bottleneck',
      severity: 'medium',
      recommendation: 'Productize delivery to reduce labor variance. Add SOPs & QA before scaling headcount.',
      fixCategory: 'fulfillment_shift',
    });
  }

  if (causes.causeAwarenessMismatch) {
    violations.push({
      id: 'awareness_mismatch',
      rule: 'Awareness Mismatch',
      severity: 'medium',
      recommendation: 'Target ICPs that already have traction. Switch promise from revenue to pipeline volume.',
      fixCategory: 'icp_shift',
    });
  }

  // Direct violation flags as violations
  if (flags.outboundViolation && !causes.causePromiseChannelMismatch) {
    violations.push({
      id: 'low_outbound_fit',
      rule: 'Low Outbound Fit',
      severity: 'high',
      recommendation: 'Cold outbound will struggle here. Consider switching to solution-aware verticals like SaaS.',
      fixCategory: 'icp_shift',
    });
  }

  if (flags.executionViolation && !causes.causeFulfillmentBottleneck) {
    violations.push({
      id: 'execution_risk',
      rule: 'Execution Risk',
      severity: 'medium',
      recommendation: 'Your offer type and fulfillment model create execution challenges. Simplify delivery.',
      fixCategory: 'fulfillment_shift',
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

// ========== GET TOP VIOLATIONS ==========
export function getTopViolations(formData: DiagnosticFormData, limit: number = 3): Violation[] {
  const violations = detectViolations(formData);
  const sorted = sortViolationsBySeverity(violations);
  return sorted.slice(0, limit);
}

// ========== LEGACY EXPORTS ==========
export interface ConstraintValues {
  buyingPowerConstraint: 'low' | 'moderate' | 'high';
  maturityConstraint: ICPMaturity;
  urgencyConstraint: 'low' | 'moderate' | 'high';
  fulfillmentComplexityConstraint: FulfillmentComplexity;
  riskToleranceConstraint: 'low' | 'moderate' | 'high';
  priceToValueConstraint: 'low' | 'moderate' | 'high';
}

export function deriveConstraints(formData: DiagnosticFormData): ConstraintValues | null {
  const { icpIndustry, icpSize, icpMaturity, pricingStructure, fulfillmentComplexity, offerType } = formData;
  
  if (!icpIndustry || !icpSize || !icpMaturity || !pricingStructure || !fulfillmentComplexity || !offerType) {
    return null;
  }

  const lowSizes: ICPSize[] = ['solo_founder', '1_5_employees'];
  const highSizes: ICPSize[] = ['21_100_employees', '100_plus_employees'];
  const lowMaturity: ICPMaturity[] = ['pre_revenue', 'early_traction'];

  return {
    buyingPowerConstraint: lowSizes.includes(icpSize) ? 'low' : highSizes.includes(icpSize) ? 'high' : 'moderate',
    maturityConstraint: icpMaturity,
    urgencyConstraint: offerType === 'outbound_sales_enablement' ? 'high' : offerType === 'demand_creation' ? 'low' : 'moderate',
    fulfillmentComplexityConstraint: fulfillmentComplexity,
    riskToleranceConstraint: lowMaturity.includes(icpMaturity) ? 'low' : 'moderate',
    priceToValueConstraint: 'moderate',
  };
}
