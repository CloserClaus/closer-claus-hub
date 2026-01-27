import type {
  DiagnosticFormData,
  DimensionScores,
  DimensionName,
  Prescription,
} from './types';

// Priority order for tie-breaking weakest dimension
const DIMENSION_PRIORITY: DimensionName[] = [
  'pricingFit',
  'buyingPower',
  'painUrgency',
  'riskAlignment',
  'executionFeasibility',
  'outboundFit',
];

const BUSINESS_IMPACT: Record<DimensionName, string> = {
  painUrgency: 'Outbound underperforms when the offer does not solve an urgent pain.',
  buyingPower: 'Low budget ICPs stall sales cycles and produce low close rates.',
  executionFeasibility: 'Complex fulfillment kills margins and increases churn.',
  pricingFit: 'Misaligned pricing causes sticker shock and slows sales velocity.',
  riskAlignment: 'Risk structure mismatches reduce trust and make deals harder to close.',
  outboundFit: 'Cold outbound struggles when the ICP isn\'t ready for outreach.',
};

const DIMENSION_LABELS: Record<DimensionName, string> = {
  painUrgency: 'Pain Urgency',
  buyingPower: 'Buying Power',
  executionFeasibility: 'Execution Feasibility',
  pricingFit: 'Pricing Fit',
  riskAlignment: 'Risk Alignment',
  outboundFit: 'Outbound Fit',
};

// Max scores for each dimension for percentage calculation
const DIMENSION_MAX_SCORES: Record<DimensionName, number> = {
  painUrgency: 20,
  buyingPower: 20,
  pricingFit: 15,
  executionFeasibility: 15,
  riskAlignment: 10,
  outboundFit: 20,
};

export function getDimensionLabel(dimension: DimensionName): string {
  return DIMENSION_LABELS[dimension];
}

export function getDimensionMaxScore(dimension: DimensionName): number {
  return DIMENSION_MAX_SCORES[dimension];
}

function findWeakestDimension(scores: DimensionScores): DimensionName {
  let weakest: DimensionName = 'pricingFit';
  let lowestPercentage = Infinity;

  for (const dimension of DIMENSION_PRIORITY) {
    const score = scores[dimension];
    const maxScore = DIMENSION_MAX_SCORES[dimension];
    const percentage = score / maxScore;
    
    if (percentage < lowestPercentage) {
      lowestPercentage = percentage;
      weakest = dimension;
    }
  }

  return weakest;
}

function getPainUrgencyRecommendations(formData: DiagnosticFormData): string[] {
  const recs: string[] = [];
  
  if (formData.icpMaturity === 'pre_revenue') {
    recs.push('Pre-Revenue ICPs rarely have urgent pain. Target Early Traction or Scaling instead.');
  }
  
  switch (formData.offerType) {
    case 'demand_creation':
      recs.push('Reposition around pipeline pain to increase urgency.');
      break;
    case 'demand_capture':
      recs.push('Shift to revenue recovery framing for higher perceived urgency.');
      break;
    case 'outbound_sales_enablement':
      recs.push('Highlight founder dependency pain to increase urgency.');
      break;
    case 'retention_monetization':
      recs.push('Tie offer to churn/LTV metrics for stronger pain positioning.');
      break;
    case 'operational_enablement':
      recs.push('Frame ops friction as revenue loss to increase perceived urgency.');
      break;
  }
  
  if (formData.icpMaturity !== 'scaling' && formData.icpMaturity !== 'early_traction') {
    recs.push('Scaling and Early Traction ICPs have highest pain urgency.');
  }
  
  return recs.slice(0, 3);
}

function getBuyingPowerRecommendations(formData: DiagnosticFormData): string[] {
  const recs: string[] = [];
  
  if (formData.icpSize === 'solo_founder' || formData.icpSize === '1_5_employees') {
    recs.push('Shift to 6–20 employees for better budget alignment.');
    recs.push('Use hybrid or usage-based pricing to reduce upfront burden.');
  }

  if (formData.icpIndustry === 'local_services') {
    recs.push('Local Services have lowest budgets. Consider Professional Services or SaaS/Tech.');
  }

  if (formData.icpIndustry === 'b2b_service_agency') {
    recs.push('B2B Service Agencies have moderate budgets. Add proof for pricing justification.');
  }
  
  if (recs.length === 0) {
    recs.push('Consider targeting larger ICP sizes for higher budgets.');
    recs.push('SaaS/Tech and Professional Services have highest buying power.');
  }

  return recs.slice(0, 3);
}

function getExecutionFeasibilityRecommendations(formData: DiagnosticFormData): string[] {
  const recs: string[] = [];
  
  switch (formData.fulfillmentComplexity) {
    case 'custom_dfy':
      recs.push('Add automation/templates to reduce fulfillment load.');
      recs.push('Raise price or reduce scope to protect margins.');
      break;
    case 'software_platform':
      recs.push('Software alone rarely justifies high pricing. Add strategy layer.');
      break;
    case 'package_based':
      recs.push('Systemize onboarding to improve scalability.');
      recs.push('Automate repetitive workflows.');
      break;
    default:
      recs.push('Consider automation to improve execution efficiency.');
  }
  
  if (formData.pricingStructure === 'usage_based') {
    if (formData.usageOutputType === 'credits' && formData.icpIndustry === 'local_services') {
      recs.push('Credits-based pricing poorly aligns with Local Services. Consider API calls or seats.');
    }
    if (formData.usageOutputType === 'api_calls' && formData.icpIndustry === 'dtc_ecommerce') {
      recs.push('API calls-based pricing poorly aligns with DTC. Consider seats or bandwidth.');
    }
    if (formData.usageOutputType === 'seats') {
      recs.push('Seats-based usage aligns well with B2B Agency and SaaS.');
    }
  }

  return recs.slice(0, 3);
}

function getPricingFitRecommendations(formData: DiagnosticFormData): string[] {
  const recs: string[] = [];
  
  if (formData.pricingStructure === 'performance_only') {
    if (formData.icpMaturity === 'pre_revenue') {
      recs.push('Performance-only rarely works for Pre-Revenue ICPs. Switch to one-time or recurring.');
    } else if (formData.icpMaturity === 'early_traction') {
      recs.push('Performance-only is risky for Early Traction. Consider conditional guarantee instead.');
    }
    if (formData.icpSize === 'solo_founder' || formData.icpSize === '1_5_employees') {
      recs.push('Small ICPs cannot absorb performance risk. Use hybrid or one-time pricing.');
    }
  }
  
  if (formData.pricingStructure === 'recurring') {
    if (formData.icpSize === 'solo_founder' || formData.icpSize === '1_5_employees') {
      recs.push('Small ICPs prefer lower upfront commitment. Consider hybrid or one-time.');
    }
    if (formData.recurringPriceTier === 'under_150') {
      recs.push('Pricing below $150/mo rarely supports quality fulfillment. Increase tier.');
    }
  }
  
  if (formData.pricingStructure === 'one_time' && formData.icpMaturity === 'scaling') {
    recs.push('Scaling ICPs prefer recurring pricing; one-time projects add friction.');
  }
  
  if (formData.fulfillmentComplexity === 'software_platform' && formData.recurringPriceTier === '2k_5k') {
    recs.push('Software priced above $2k/mo is rarely purchased by SMB. Consider repositioning as automation.');
  }

  if (recs.length === 0) {
    recs.push('Review pricing model alignment with ICP size.');
    recs.push('Consider adjusting price tier to match market expectations.');
  }

  return recs.slice(0, 3);
}

function getRiskAlignmentRecommendations(formData: DiagnosticFormData): string[] {
  const recs: string[] = [];
  
  if (formData.pricingStructure === 'performance_only') {
    if (formData.icpMaturity === 'pre_revenue') {
      recs.push('Pre-Revenue ICPs cannot support performance pricing. Switch to conditional or one-time.');
    }
    if (formData.icpMaturity === 'enterprise') {
      recs.push('Enterprise procurement rarely accepts performance-only. Use retainer or usage-based.');
    }
    recs.push('Performance pricing requires mature ICPs with predictable revenue.');
  }
  
  if (formData.pricingStructure === 'usage_based' && formData.icpMaturity === 'pre_revenue') {
    recs.push('Usage-based pricing misaligns with Pre-Revenue. Try one-time project.');
  }
  
  if (formData.pricingStructure === 'recurring' && formData.icpMaturity === 'pre_revenue') {
    recs.push('Pre-Revenue ICPs struggle with recurring commitments. Consider one-time with upsell path.');
  }

  if (recs.length === 0) {
    recs.push('Review pricing structure alignment with ICP maturity.');
    recs.push('Consider trust-building mechanisms for your target market.');
  }

  return recs.slice(0, 3);
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
    case 'pricingFit':
      recommendations = getPricingFitRecommendations(formData);
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
