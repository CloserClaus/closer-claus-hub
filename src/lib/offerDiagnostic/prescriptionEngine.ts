import type {
  DiagnosticFormData,
  DimensionScores,
  DimensionName,
  Prescription,
} from './types';

// Priority order for tie-breaking weakest dimension
const DIMENSION_PRIORITY: DimensionName[] = [
  'pricingSanity',
  'buyingPower',
  'painUrgency',
  'riskAlignment',
  'executionFeasibility',
];

const BUSINESS_IMPACT: Record<DimensionName, string> = {
  painUrgency: 'Outbound underperforms when the offer does not solve an urgent pain.',
  buyingPower: 'Low budget ICPs stall sales cycles and produce low close rates.',
  executionFeasibility: 'Complex fulfillment kills margins and increases churn.',
  pricingSanity: 'Misaligned pricing causes sticker shock and slows sales velocity.',
  riskAlignment: 'Risk structure mismatches reduce trust and make deals harder to close.',
};

const DIMENSION_LABELS: Record<DimensionName, string> = {
  painUrgency: 'Pain Urgency',
  buyingPower: 'Buying Power',
  executionFeasibility: 'Execution Feasibility',
  pricingSanity: 'Pricing Sanity',
  riskAlignment: 'Risk Alignment',
};

export function getDimensionLabel(dimension: DimensionName): string {
  return DIMENSION_LABELS[dimension];
}

function findWeakestDimension(scores: DimensionScores): DimensionName {
  let weakest: DimensionName = 'pricingSanity';
  let lowestScore = Infinity;

  for (const dimension of DIMENSION_PRIORITY) {
    const score = scores[dimension];
    if (score < lowestScore) {
      lowestScore = score;
      weakest = dimension;
    }
  }

  return weakest;
}

function getPainUrgencyRecommendations(formData: DiagnosticFormData): string[] {
  switch (formData.offerType) {
    case 'demand_creation':
      return ['Reposition around pipeline pain.', 'Target SaaS/Agencies/DTC.'];
    case 'demand_capture':
      return ['Shift to revenue recovery framing.', 'Target Local or DTC high-intent.'];
    case 'outbound_sales_enablement':
      return ['Highlight founder dependency pain.', 'Target scaling ICPs.'];
    case 'retention_monetization':
      return ['Tie offer to churn/LTV metrics.', 'Target DTC or SaaS.'];
    case 'operational_enablement':
      return ['Frame ops friction as revenue loss.', 'Target scaling ICPs.'];
    default:
      return ['Reassess your offer positioning.'];
  }
}

function getBuyingPowerRecommendations(formData: DiagnosticFormData): string[] {
  const { icpSize, icpIndustry } = formData;

  if (icpSize === 'solo_founder' || icpSize === '1_5_employees') {
    return ['Shift to 6–20 employees.', 'Use hybrid pricing to reduce upfront burden.'];
  }

  if (icpIndustry === 'local_services') {
    return ['Shift to Pro Services or SaaS.', 'Reduce fulfillment cost or scope.'];
  }

  if (icpIndustry === 'other_b2b') {
    return ['Narrow vertical to increase willingness-to-pay.', 'Add proof for pricing justification.'];
  }

  return ['Consider targeting higher-budget segments.', 'Adjust scope to match ICP budget.'];
}

function getExecutionFeasibilityRecommendations(formData: DiagnosticFormData): string[] {
  switch (formData.fulfillmentComplexity) {
    case 'hands_on_labor':
      return ['Add automation/templates.', 'Raise price or reduce scope.'];
    case 'staffing_placement':
      return ['Use hybrid pricing to protect margins.', 'Narrow ICP to reduce fulfillment load.'];
    case 'hybrid_labor_systems':
      return ['Systemize onboarding.', 'Automate repetitive workflows.'];
    default:
      return ['Review fulfillment complexity.', 'Consider automation opportunities.'];
  }
}

function getPricingSanityRecommendations(formData: DiagnosticFormData): string[] {
  const { pricingModel, priceTier, icpSize, icpMaturity, offerType } = formData;

  if (pricingModel === 'retainer' && (icpSize === 'solo_founder' || icpSize === '1_5_employees')) {
    return ['Use hybrid pricing.', 'Reduce upfront commitment.'];
  }

  if (pricingModel === 'performance_only' && icpMaturity === 'pre_revenue') {
    return ['Use conditional guarantee.', 'Avoid pure performance.'];
  }

  if (priceTier === 'under_1k' && (offerType === 'outbound_sales_enablement' || offerType === 'retention_monetization')) {
    return ['Increase to $1k–$3k to support fulfillment.'];
  }

  if (priceTier === '10k_plus' && formData.icpIndustry === 'local_services') {
    return ['Reduce scope or change ICP.'];
  }

  return ['Review pricing model alignment.', 'Consider adjusting price tier.'];
}

function getRiskAlignmentRecommendations(formData: DiagnosticFormData): string[] {
  const { icpMaturity, riskStructure, icpSize } = formData;

  if (riskStructure === 'full_guarantee' && (icpMaturity === 'pre_revenue' || icpMaturity === 'early_traction')) {
    return ['Switch to conditional guarantee.', 'Filter tire-kickers with qualifiers.'];
  }

  if (riskStructure === 'pay_on_performance' && icpMaturity === 'enterprise') {
    return ['Use retainer or usage-based.', 'Separate procurement from performance.'];
  }

  if (riskStructure === 'no_guarantee' && (icpSize === 'solo_founder' || icpSize === '1_5_employees')) {
    return ['Add conditional guarantee to boost trust.'];
  }

  return ['Review risk structure alignment.', 'Consider trust-building mechanisms.'];
}

export function generatePrescription(
  visibleScore: number,
  dimensionScores: DimensionScores,
  formData: DiagnosticFormData
): Prescription {
  const weakestDimension = findWeakestDimension(dimensionScores);
  const businessImpact = BUSINESS_IMPACT[weakestDimension];

  let recommendations: string[];

  switch (weakestDimension) {
    case 'painUrgency':
      recommendations = getPainUrgencyRecommendations(formData);
      break;
    case 'buyingPower':
      recommendations = getBuyingPowerRecommendations(formData);
      break;
    case 'executionFeasibility':
      recommendations = getExecutionFeasibilityRecommendations(formData);
      break;
    case 'pricingSanity':
      recommendations = getPricingSanityRecommendations(formData);
      break;
    case 'riskAlignment':
      recommendations = getRiskAlignmentRecommendations(formData);
      break;
    default:
      recommendations = ['Review your offer configuration.'];
  }

  return {
    score: visibleScore,
    weakestDimension,
    businessImpact,
    recommendations,
    callToAction: 'Adjust these elements before scaling outbound.',
  };
}
