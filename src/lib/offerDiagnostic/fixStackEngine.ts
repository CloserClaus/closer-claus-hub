import type {
  DiagnosticFormData,
  ExtendedScores,
  ProblemCategory,
  DetectedProblem,
  FixArchetype,
  FixStackResult,
  OfferType,
  ICPIndustry,
} from './types';

// ========== Category Thresholds ==========
const CATEGORY_THRESHOLDS: Record<string, number> = {
  low_buying_power: 12,
  pricing_misfit: 10,
  risk_misalignment: 5,
  low_pain_urgency: 12,
  fulfillment_misalignment: 10,
  low_mechanism_power: 50,
  low_switching_cost: 10,
};

// ========== Valid ICP Matches by Offer Type ==========
const VALID_ICP_MATCHES: Record<OfferType, ICPIndustry[]> = {
  demand_creation: ['dtc_ecommerce', 'saas_tech', 'professional_services'],
  demand_capture: ['local_services', 'dtc_ecommerce', 'professional_services'],
  outbound_sales_enablement: ['professional_services', 'b2b_service_agency', 'saas_tech'],
  retention_monetization: ['dtc_ecommerce', 'saas_tech'],
  operational_enablement: ['professional_services', 'b2b_service_agency', 'saas_tech'],
};

// ========== Required Maturity by Offer Type ==========
const REQUIRED_MATURITY: Record<OfferType, number> = {
  demand_creation: 1, // early_traction+
  demand_capture: 0, // pre_revenue+
  outbound_sales_enablement: 2, // scaling+
  retention_monetization: 2, // scaling+
  operational_enablement: 2, // scaling+
};

const MATURITY_ORDER = ['pre_revenue', 'early_traction', 'scaling', 'mature', 'enterprise'];

// ========== Impact Weights for Sorting ==========
const IMPACT_WEIGHTS: Record<ProblemCategory, number> = {
  icp_mismatch: 5,
  offer_type_misfit: 5,
  pricing_misfit: 4,
  low_buying_power: 4,
  low_pain_urgency: 3,
  fulfillment_misalignment: 2,
  low_switching_cost: 1,
  low_mechanism_power: 1,
  risk_misalignment: 1,
};

// ========== Problem Summaries ==========
const PROBLEM_SUMMARIES: Record<ProblemCategory, { problem: string; whyItMatters: string }> = {
  icp_mismatch: {
    problem: 'Your ICP does not align with your offer type.',
    whyItMatters: 'Selling to the wrong audience wastes resources and stalls growth.',
  },
  low_buying_power: {
    problem: 'Your target ICP lacks sufficient budget.',
    whyItMatters: 'Low-budget buyers stall sales cycles and reduce close rates.',
  },
  pricing_misfit: {
    problem: 'Your pricing structure misaligns with ICP expectations.',
    whyItMatters: 'Pricing friction slows velocity and causes sticker shock.',
  },
  risk_misalignment: {
    problem: 'Your risk structure does not match ICP maturity.',
    whyItMatters: 'Mismatched risk reduces trust and makes deals harder to close.',
  },
  low_pain_urgency: {
    problem: 'Your offer does not solve an urgent pain.',
    whyItMatters: 'Low urgency means buyers delay decisions indefinitely.',
  },
  offer_type_misfit: {
    problem: 'Your offer type does not match ICP maturity.',
    whyItMatters: 'Immature ICPs cannot utilize complex offers effectively.',
  },
  fulfillment_misalignment: {
    problem: 'Your fulfillment model creates execution challenges.',
    whyItMatters: 'Complex fulfillment kills margins and increases churn.',
  },
  low_switching_cost: {
    problem: 'Clients can easily replace your service.',
    whyItMatters: 'Low switching cost leads to high churn and commoditization.',
  },
  low_mechanism_power: {
    problem: 'Your offer lacks differentiation and leverage.',
    whyItMatters: 'Generic offers compete on price and struggle to close.',
  },
};

// ========== Fix Archetypes by Category ==========
const FIX_ARCHETYPES: Record<ProblemCategory, FixArchetype[]> = {
  icp_mismatch: [
    {
      whatToChange: 'Change ICP',
      howToChangeIt: 'Switch from low-need/budget ICP to ICP with demonstrated pain and budget',
      whenToChooseThis: 'If current ICP fails PainUrgency or BuyingPower',
      targetCondition: 'ICP has active need and budget',
      effort: 'Medium',
      impact: 'Very High',
    },
    {
      whatToChange: 'Change Offer Type',
      howToChangeIt: 'Reposition to solve ICP\'s primary pain (e.g. DemandCreation → Outbound)',
      whenToChooseThis: 'If ICP pain is acquisition not branding',
      targetCondition: 'Offer solves ICP top-2 pain',
      effort: 'Medium',
      impact: 'High',
    },
    {
      whatToChange: 'Change Pricing Structure',
      howToChangeIt: 'Hybrid → Performance-led or small retainer',
      whenToChooseThis: 'If ICP has cash flow volatility',
      targetCondition: 'Low upfront friction',
      effort: 'Low',
      impact: 'Medium',
    },
  ],
  low_buying_power: [
    {
      whatToChange: 'Move Upmarket',
      howToChangeIt: 'Solo → 6–20 employees or Early → Scaling',
      whenToChooseThis: 'If ICP cannot afford existing pricing',
      targetCondition: 'ICP budget aligned to PriceRange',
      effort: 'Medium',
      impact: 'Very High',
    },
    {
      whatToChange: 'Change Pricing Model',
      howToChangeIt: 'Retainer → Performance/Hybrid',
      whenToChooseThis: 'If low-cash-flow ICP resists retainers',
      targetCondition: 'Lower upfront ask',
      effort: 'Low',
      impact: 'High',
    },
    {
      whatToChange: 'Reduce Fulfillment Cost',
      howToChangeIt: 'Labor → Hybrid or Automation',
      whenToChooseThis: 'If margin constraints block scaling',
      targetCondition: 'Higher margin to support lower prices',
      effort: 'Medium',
      impact: 'Medium',
    },
  ],
  pricing_misfit: [
    {
      whatToChange: 'Adjust ICP',
      howToChangeIt: 'Target teams that can pay current monthly price',
      whenToChooseThis: 'If pricing is correct but buyer is too small',
      targetCondition: 'Pricing matches ICP cash flow',
      effort: 'Medium',
      impact: 'High',
    },
    {
      whatToChange: 'Adjust Price',
      howToChangeIt: 'Move into a band ICP expects',
      whenToChooseThis: 'If ICP fits but price doesn\'t',
      targetCondition: 'Price matches perceived value',
      effort: 'Low',
      impact: 'Medium',
    },
    {
      whatToChange: 'Adjust Pricing Model',
      howToChangeIt: 'Retainer → Hybrid → Performance',
      whenToChooseThis: 'If ICP resists upfront spend',
      targetCondition: 'Lower initial commitment',
      effort: 'Low',
      impact: 'High',
    },
    {
      whatToChange: 'Increase Value Perception',
      howToChangeIt: 'Add reporting/manpower/data/training',
      whenToChooseThis: 'If you want to keep ICP + pricing same',
      targetCondition: 'Offer feels cheap vs value delivered',
      effort: 'Medium',
      impact: 'Medium',
    },
  ],
  risk_misalignment: [
    {
      whatToChange: 'Modify Risk Structure',
      howToChangeIt: 'No Guarantee → Conditional Guarantee',
      whenToChooseThis: 'If ICPMaturity < required trust level',
      targetCondition: 'Risk aligned with stage',
      effort: 'Low',
      impact: 'High',
    },
    {
      whatToChange: 'Modify ICP',
      howToChangeIt: 'Target buyers who accept current risk model',
      whenToChooseThis: 'If risk policy is non-negotiable',
      targetCondition: 'Trust–risk equilibrium achieved',
      effort: 'Medium',
      impact: 'Medium',
    },
  ],
  low_pain_urgency: [
    {
      whatToChange: 'Change Offer Type',
      howToChangeIt: 'Move to acquisition or revenue-linked outcome',
      whenToChooseThis: 'If current offer solves non-urgent pain',
      targetCondition: 'Offer addresses top-2 urgent pain',
      effort: 'Medium',
      impact: 'Very High',
    },
    {
      whatToChange: 'Change ICP',
      howToChangeIt: 'Target markets already feeling acute pain',
      whenToChooseThis: 'If offer is correct but buyer isn\'t',
      targetCondition: 'Buyer has immediate stakes',
      effort: 'Medium',
      impact: 'High',
    },
    {
      whatToChange: 'Reposition Outcome',
      howToChangeIt: 'Shift messaging from upside → risk/threat',
      whenToChooseThis: 'If ICP is pain-aware but not urgency-aware',
      targetCondition: 'Cost of inaction visible',
      effort: 'Low',
      impact: 'Medium',
    },
  ],
  offer_type_misfit: [
    {
      whatToChange: 'Change ICP Maturity',
      howToChangeIt: 'Pre-revenue → Early Traction → Scaling',
      whenToChooseThis: 'If offer requires existing ops',
      targetCondition: 'ICP can utilize offer',
      effort: 'Medium',
      impact: 'High',
    },
    {
      whatToChange: 'Change Offer Type',
      howToChangeIt: 'Branding → Lead Gen or Monetization',
      whenToChooseThis: 'If buyer needs revenue not branding',
      targetCondition: 'Offer matches maturity',
      effort: 'Medium',
      impact: 'Very High',
    },
  ],
  fulfillment_misalignment: [
    {
      whatToChange: 'Change Fulfillment Model',
      howToChangeIt: 'Labor → Hybrid or Automation',
      whenToChooseThis: 'If manual labor reduces scalability',
      targetCondition: 'Fulfillment supports scale',
      effort: 'Medium',
      impact: 'High',
    },
    {
      whatToChange: 'Change Pricing',
      howToChangeIt: 'Increase price to match operational cost',
      whenToChooseThis: 'If labor cannot scale',
      targetCondition: 'Price maps to fulfillment complexity',
      effort: 'Low',
      impact: 'Medium',
    },
    {
      whatToChange: 'Change ICP',
      howToChangeIt: 'Target buyers who value labor-heavy fulfillment',
      whenToChooseThis: 'If fulfillment can\'t change',
      targetCondition: 'ICP values manual work',
      effort: 'Medium',
      impact: 'Medium',
    },
  ],
  low_switching_cost: [
    {
      whatToChange: 'Add Switching Moats',
      howToChangeIt: 'Add data/reporting/integrations/manpower',
      whenToChooseThis: 'If churn or replacements are easy',
      targetCondition: 'Client loses value if disconnecting',
      effort: 'Medium',
      impact: 'High',
    },
    {
      whatToChange: 'Move to Recurring',
      howToChangeIt: 'One-time → Monthly recurring',
      whenToChooseThis: 'If switching is costless',
      targetCondition: 'Client dependency created',
      effort: 'Low',
      impact: 'Medium',
    },
  ],
  low_mechanism_power: [
    {
      whatToChange: 'Add Manpower or Software Layer',
      howToChangeIt: 'Add execution support or automation',
      whenToChooseThis: 'If offer only suggests work not does it',
      targetCondition: 'Client sees leverage not advice',
      effort: 'Medium',
      impact: 'High',
    },
    {
      whatToChange: 'Compress Time-to-Outcome',
      howToChangeIt: 'Remove long dependencies',
      whenToChooseThis: 'If outcomes take >90 days',
      targetCondition: 'Faster wins',
      effort: 'Medium',
      impact: 'High',
    },
    {
      whatToChange: 'Add Proprietary Mechanism',
      howToChangeIt: 'Frameworks, scripts, data, dashboards',
      whenToChooseThis: 'If offer is easily copyable',
      targetCondition: 'Higher differentiation',
      effort: 'Low',
      impact: 'Medium',
    },
  ],
};

// ========== Problem Detection Functions ==========

function detectICPMismatch(formData: DiagnosticFormData): boolean {
  if (!formData.offerType || !formData.icpIndustry) return false;
  const validMatches = VALID_ICP_MATCHES[formData.offerType];
  return !validMatches.includes(formData.icpIndustry);
}

function detectOfferTypeMisfit(formData: DiagnosticFormData): boolean {
  if (!formData.offerType || !formData.icpMaturity) return false;
  const requiredMaturity = REQUIRED_MATURITY[formData.offerType];
  const currentMaturity = MATURITY_ORDER.indexOf(formData.icpMaturity);
  return currentMaturity < requiredMaturity;
}

function detectLowBuyingPower(scores: ExtendedScores): boolean {
  return scores.buyingPower < CATEGORY_THRESHOLDS.low_buying_power;
}

function detectPricingMisfit(scores: ExtendedScores): boolean {
  return scores.pricingFit < CATEGORY_THRESHOLDS.pricing_misfit;
}

function detectRiskMisalignment(scores: ExtendedScores): boolean {
  return scores.riskAlignment < CATEGORY_THRESHOLDS.risk_misalignment;
}

function detectLowPainUrgency(scores: ExtendedScores): boolean {
  return scores.painUrgency < CATEGORY_THRESHOLDS.low_pain_urgency;
}

function detectFulfillmentMisalignment(scores: ExtendedScores): boolean {
  return scores.executionFeasibility < CATEGORY_THRESHOLDS.fulfillment_misalignment;
}

function detectLowSwitchingCost(scores: ExtendedScores): boolean {
  return scores.switchingCost < CATEGORY_THRESHOLDS.low_switching_cost;
}

function detectLowMechanismPower(scores: ExtendedScores): boolean {
  return scores.powerScore < CATEGORY_THRESHOLDS.low_mechanism_power;
}

// ========== Calculate Severity ==========

function calculateSeverity(category: ProblemCategory, scores: ExtendedScores, formData: DiagnosticFormData): number {
  const thresholds: Record<string, { value: number; max: number }> = {
    low_buying_power: { value: scores.buyingPower, max: 20 },
    pricing_misfit: { value: scores.pricingFit, max: 20 },
    risk_misalignment: { value: scores.riskAlignment, max: 15 },
    low_pain_urgency: { value: scores.painUrgency, max: 25 },
    fulfillment_misalignment: { value: scores.executionFeasibility, max: 20 },
    low_switching_cost: { value: scores.switchingCost, max: 20 },
    low_mechanism_power: { value: scores.powerScore, max: 100 },
  };

  const threshold = thresholds[category];
  if (threshold) {
    // Calculate how far below threshold (as a severity multiplier)
    const deviation = (CATEGORY_THRESHOLDS[category] || threshold.max * 0.5) - threshold.value;
    return Math.max(1, deviation);
  }

  // For ICP mismatch and offer type misfit, use fixed severity
  if (category === 'icp_mismatch' || category === 'offer_type_misfit') {
    return 5; // High severity for mismatches
  }

  return 1;
}

// ========== Main Generate Function ==========

export function generateFixStack(
  formData: DiagnosticFormData,
  scores: ExtendedScores,
  finalScore: number
): FixStackResult {
  const detectedProblems: DetectedProblem[] = [];

  // Check each problem category
  const checks: { category: ProblemCategory; detect: () => boolean }[] = [
    { category: 'icp_mismatch', detect: () => detectICPMismatch(formData) },
    { category: 'offer_type_misfit', detect: () => detectOfferTypeMisfit(formData) },
    { category: 'low_buying_power', detect: () => detectLowBuyingPower(scores) },
    { category: 'pricing_misfit', detect: () => detectPricingMisfit(scores) },
    { category: 'risk_misalignment', detect: () => detectRiskMisalignment(scores) },
    { category: 'low_pain_urgency', detect: () => detectLowPainUrgency(scores) },
    { category: 'fulfillment_misalignment', detect: () => detectFulfillmentMisalignment(scores) },
    { category: 'low_switching_cost', detect: () => detectLowSwitchingCost(scores) },
    { category: 'low_mechanism_power', detect: () => detectLowMechanismPower(scores) },
  ];

  for (const { category, detect } of checks) {
    if (detect()) {
      const summary = PROBLEM_SUMMARIES[category];
      const severity = calculateSeverity(category, scores, formData);
      const fixes = FIX_ARCHETYPES[category];

      detectedProblems.push({
        category,
        problem: summary.problem,
        whyItMatters: summary.whyItMatters,
        severity,
        fixes,
      });
    }
  }

  // Sort by impact weight × severity, take top 3
  detectedProblems.sort((a, b) => {
    const scoreA = IMPACT_WEIGHTS[a.category] * a.severity;
    const scoreB = IMPACT_WEIGHTS[b.category] * b.severity;
    return scoreB - scoreA;
  });

  const topProblems = detectedProblems.slice(0, 3);

  return {
    finalScore,
    alignmentScore: scores.alignmentScore,
    powerScore: scores.powerScore,
    problems: topProblems,
  };
}

// ========== Helper Exports ==========

export const PROBLEM_CATEGORY_LABELS: Record<ProblemCategory, string> = {
  icp_mismatch: 'ICP Mismatch',
  low_buying_power: 'Low Buying Power',
  pricing_misfit: 'Pricing Misfit',
  risk_misalignment: 'Risk Misalignment',
  low_pain_urgency: 'Low Pain Urgency',
  offer_type_misfit: 'Offer Type Misfit',
  fulfillment_misalignment: 'Fulfillment Misalignment',
  low_switching_cost: 'Low Switching Cost',
  low_mechanism_power: 'Low Mechanism Power',
};
