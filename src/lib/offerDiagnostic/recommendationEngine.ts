// Recommendation Engine - Generates actionable fixes based on causes
// Implements fix catalog, suppression rules, and prioritization from spec

import type {
  DiagnosticFormData,
  ICPMaturity,
  ICPSize,
  FulfillmentComplexity,
  RiskModel,
  ProofLevel,
  OfferType,
} from './types';
import { detectViolationFlags, inferCauses, type ViolationFlags, type CauseFlags } from './violationEngine';

// ========== TYPES ==========
export type FixCategory =
  | 'icp_shift'
  | 'promise_shift'
  | 'fulfillment_shift'
  | 'pricing_shift'
  | 'risk_shift'
  | 'positioning_shift'
  | 'founder_psychology_check';

export interface StructuredRecommendation {
  id: string;
  category: FixCategory;
  headline: string;
  plainExplanation: string;
  actionSteps: string[];
  desiredState: string;
}

// ========== FIX CATALOG (from spec) ==========
const FIX_CATALOG: Record<string, string[]> = {
  ProofDeficiency: [
    'Narrow the claim until you have strong proof',
    'Collect 3–5 wins before scaling promise',
    'Run micro-pilots to gather screenshots & case studies',
  ],
  PricingMisalignment: [
    'Switch to hybrid pricing to reduce sticker shock',
    'Lower initial retainer until proof compounds',
    'Move upmarket where budgets support current pricing',
  ],
  MarketMisalignment: [
    'Shift upmarket to ICPs with higher buying power',
    'Switch vertical to one with urgent problems & budgets',
    'Retool offer for current ICP maturity stage',
  ],
  PromiseChannelMismatch: [
    'Do not use cold outbound for awareness-only outcomes',
    'Switch promise to revenue or pipeline outcomes',
    'Add downstream proof to justify revenue claims',
  ],
  RiskMisalignment: [
    'Use conditional guarantees instead of full guarantees',
    'Add milestone-based commitments instead of performance',
    'Remove guarantees until you have stable fulfillment',
  ],
  FulfillmentBottleneck: [
    'Productize delivery to reduce labor variance',
    'Add SOPs & QA before scaling headcount',
    'Increase pricing to match delivery complexity',
  ],
  AwarenessMismatch: [
    'Target ICPs that already have traction',
    'Switch promise from revenue to pipeline volume',
    'Collect proof before scaling to low-awareness markets',
  ],
};

// ========== SUPPRESSION RULES ==========
function shouldSuppressFix(fix: string, formData: DiagnosticFormData): boolean {
  const { proofLevel, riskModel, icpSize, fulfillmentComplexity, offerType } = formData;

  // proof_level='Strong' → remove ProofDeficiency fixes
  if (proofLevel === 'strong' && FIX_CATALOG.ProofDeficiency.includes(fix)) {
    return true;
  }

  // risk_model in ['Conditional guarantee','Pay after results'] → remove RiskMisalignment
  if (
    (riskModel === 'conditional_guarantee' || riskModel === 'pay_after_results') &&
    FIX_CATALOG.RiskMisalignment.includes(fix)
  ) {
    return true;
  }

  // icp_size large → remove 'Lower initial retainer until proof compounds'
  const largeSizes: ICPSize[] = ['21_100_employees', '100_plus_employees'];
  if (icpSize && largeSizes.includes(icpSize) && fix === 'Lower initial retainer until proof compounds') {
    return true;
  }

  // fulfillment='Software/platform access' → remove FulfillmentBottleneck
  if (fulfillmentComplexity === 'software_platform' && FIX_CATALOG.FulfillmentBottleneck.includes(fix)) {
    return true;
  }

  // offer_type='Outbound & Sales Enablement' → remove 'Do not use cold outbound...'
  if (offerType === 'outbound_sales_enablement' && fix === 'Do not use cold outbound for awareness-only outcomes') {
    return true;
  }

  return false;
}

// ========== SEVERITY WEIGHTS (from spec) ==========
const SEVERITY_WEIGHTS: Record<keyof ViolationFlags, number> = {
  outboundViolation: 5,
  executionViolation: 4,
  pricingViolation: 3,
  buyingPowerViolation: 3,
  riskViolation: 2,
  urgencyViolation: 1,
};

// ========== FEASIBILITY WEIGHTS ==========
const FEASIBILITY_WEIGHTS: Record<ICPMaturity, number> = {
  pre_revenue: 1,
  early_traction: 3,
  scaling: 4,
  mature: 3,
  enterprise: 2,
};

// ========== MAP CAUSES TO FIX CATEGORIES ==========
const CAUSE_TO_CATEGORY: Record<keyof CauseFlags, FixCategory> = {
  causeProofDeficiency: 'risk_shift',
  causePricingMisalignment: 'pricing_shift',
  causeMarketMisalignment: 'icp_shift',
  causePromiseChannelMismatch: 'promise_shift',
  causeRiskMisalignment: 'risk_shift',
  causeFulfillmentBottleneck: 'fulfillment_shift',
  causeAwarenessMismatch: 'icp_shift',
};

const CAUSE_TO_CATALOG_KEY: Record<keyof CauseFlags, string> = {
  causeProofDeficiency: 'ProofDeficiency',
  causePricingMisalignment: 'PricingMisalignment',
  causeMarketMisalignment: 'MarketMisalignment',
  causePromiseChannelMismatch: 'PromiseChannelMismatch',
  causeRiskMisalignment: 'RiskMisalignment',
  causeFulfillmentBottleneck: 'FulfillmentBottleneck',
  causeAwarenessMismatch: 'AwarenessMismatch',
};

// ========== CATEGORY LABELS ==========
export const CATEGORY_LABELS: Record<FixCategory, string> = {
  icp_shift: 'Shift ICP',
  promise_shift: 'Shift Promise',
  fulfillment_shift: 'Adjust Fulfillment',
  pricing_shift: 'Adjust Pricing',
  risk_shift: 'Adjust Risk',
  positioning_shift: 'Improve Positioning',
  founder_psychology_check: 'Founder Check',
};

// ========== GENERATE HEADLINE FOR CAUSE ==========
function getHeadlineForCause(cause: keyof CauseFlags): string {
  const headlines: Record<keyof CauseFlags, string> = {
    causeProofDeficiency: 'Build proof before scaling your promise',
    causePricingMisalignment: 'Your pricing doesn\'t match your market',
    causeMarketMisalignment: 'Your ICP can\'t afford or doesn\'t need this',
    causePromiseChannelMismatch: 'Cold outbound won\'t work for this promise',
    causeRiskMisalignment: 'Your risk model doesn\'t fit your buyer',
    causeFulfillmentBottleneck: 'Your delivery model won\'t scale',
    causeAwarenessMismatch: 'Early-stage buyers can\'t use revenue promises',
  };
  return headlines[cause];
}

function getExplanationForCause(cause: keyof CauseFlags): string {
  const explanations: Record<keyof CauseFlags, string> = {
    causeProofDeficiency: 'You\'re promising outcomes you can\'t prove yet. Start smaller or collect case studies first.',
    causePricingMisalignment: 'There\'s a gap between what you charge and what your target market can comfortably pay.',
    causeMarketMisalignment: 'Your current ICP either doesn\'t have the budget or doesn\'t feel the pain urgently enough.',
    causePromiseChannelMismatch: 'Awareness-level promises don\'t convert well through cold outbound. Lead with pipeline or revenue.',
    causeRiskMisalignment: 'Your guarantee structure doesn\'t match what this buyer segment expects or can handle.',
    causeFulfillmentBottleneck: 'Custom done-for-you work at scale creates quality and margin problems.',
    causeAwarenessMismatch: 'Pre-revenue and early-traction buyers need leads, not revenue promises.',
  };
  return explanations[cause];
}

function getDesiredStateForCause(cause: keyof CauseFlags): string {
  const states: Record<keyof CauseFlags, string> = {
    causeProofDeficiency: 'Strong proof that backs up your promise',
    causePricingMisalignment: 'Pricing that feels like a no-brainer for your buyer',
    causeMarketMisalignment: 'ICP with budget, urgency, and clear need',
    causePromiseChannelMismatch: 'Promise that matches what outbound can deliver',
    causeRiskMisalignment: 'Risk structure that accelerates buyer decisions',
    causeFulfillmentBottleneck: 'Scalable delivery with consistent quality',
    causeAwarenessMismatch: 'Promise aligned with buyer\'s current stage',
  };
  return states[cause];
}

// ========== MAIN RECOMMENDATION GENERATOR ==========
export function generateStructuredRecommendations(
  violations: { id: string; severity: 'high' | 'medium' | 'low' }[],
  formData: DiagnosticFormData,
  limit: number = 3
): StructuredRecommendation[] {
  const recommendations: StructuredRecommendation[] = [];
  const usedCategories = new Set<FixCategory>();

  // Get violation flags and causes
  const flags = detectViolationFlags(formData);
  if (!flags) return recommendations;

  const causes = inferCauses(formData, flags);

  // Score each cause by severity
  interface ScoredCause {
    cause: keyof CauseFlags;
    score: number;
    active: boolean;
  }

  const scoredCauses: ScoredCause[] = Object.entries(causes).map(([cause, active]) => {
    let score = 0;
    const causeKey = cause as keyof CauseFlags;

    if (active) {
      // Weight by related violation severity
      if (causeKey === 'causeProofDeficiency' || causeKey === 'causeRiskMisalignment') {
        score += flags.riskViolation ? SEVERITY_WEIGHTS.riskViolation : 0;
      }
      if (causeKey === 'causePricingMisalignment') {
        score += flags.pricingViolation ? SEVERITY_WEIGHTS.pricingViolation : 0;
      }
      if (causeKey === 'causeMarketMisalignment' || causeKey === 'causeAwarenessMismatch') {
        score += flags.buyingPowerViolation ? SEVERITY_WEIGHTS.buyingPowerViolation : 0;
      }
      if (causeKey === 'causePromiseChannelMismatch') {
        score += flags.outboundViolation ? SEVERITY_WEIGHTS.outboundViolation : 0;
      }
      if (causeKey === 'causeFulfillmentBottleneck') {
        score += flags.executionViolation ? SEVERITY_WEIGHTS.executionViolation : 0;
      }

      // Apply feasibility weight
      const feasibility = formData.icpMaturity ? FEASIBILITY_WEIGHTS[formData.icpMaturity] : 2;
      score *= feasibility;
    }

    return { cause: causeKey, score, active };
  });

  // Sort by score descending
  scoredCauses.sort((a, b) => b.score - a.score);

  // Generate recommendations for top causes
  for (const { cause, active } of scoredCauses) {
    if (!active) continue;
    if (recommendations.length >= limit) break;

    const category = CAUSE_TO_CATEGORY[cause];
    if (usedCategories.has(category)) continue;

    const catalogKey = CAUSE_TO_CATALOG_KEY[cause];
    const fixes = FIX_CATALOG[catalogKey] || [];

    // Filter out suppressed fixes
    const actionSteps = fixes.filter((fix) => !shouldSuppressFix(fix, formData)).slice(0, 3);

    if (actionSteps.length === 0) continue;

    recommendations.push({
      id: `${category}_${cause}`,
      category,
      headline: getHeadlineForCause(cause),
      plainExplanation: getExplanationForCause(cause),
      actionSteps,
      desiredState: getDesiredStateForCause(cause),
    });

    usedCategories.add(category);
  }

  return recommendations;
}

// ========== LEGACY EXPORTS ==========
export interface ViolationInput {
  id: string;
  severity: 'high' | 'medium' | 'low';
}
