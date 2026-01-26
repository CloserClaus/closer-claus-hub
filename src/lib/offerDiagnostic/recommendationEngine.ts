// ============= Founder-Friendly Recommendation Engine =============
// Converts violations into actionable, multi-solution recommendations

import type {
  DiagnosticFormData,
  ICPMaturity,
  ICPSize,
  ICPIndustry,
  PricingStructure,
  FulfillmentComplexity,
} from './types';

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

// ========== FIX POOLS BY CATEGORY ==========

const FIX_POOLS: Record<FixCategory, string[]> = {
  icp_shift: [
    'Move upmarket to buyers with budget + urgency',
    'Narrow vertical to buyers who strongly feel the problem',
    'Switch to buyers already doing the precursor step (ex: running ads)',
    'Target founders with 3–10 clients instead of pre-revenue',
    'Target buyers with existing lead flow',
    'Prioritize industries with budget (B2B services, SaaS)',
    'Switch to solution-aware verticals (e.g. SaaS instead of local SMB)',
    'Change vertical to higher budget segment',
  ],
  promise_shift: [
    'Switch promise to revenue if ICP has pipeline',
    'Switch promise to leads/pipeline if ICP lacks revenue control',
    'Switch promise to cost/time savings if ICP is cost-sensitive',
    'Focus on efficiency gains for mature buyers',
    'Lead with compliance outcomes for enterprise',
  ],
  fulfillment_shift: [
    'Switch from coaching to DFY if outcome requires execution',
    'Switch from DFY to packaged service if margins break',
    'Add automation/tooling layer to increase throughput',
    'Productize delivery to reduce labor dependency',
    'Add implementation layer to software',
  ],
  pricing_shift: [
    'Move from retainer to hybrid model',
    'Add performance slice to justify higher retainer',
    'Reduce retainer but add conditional guarantee',
    'Increase price but narrow ICP',
    'Switch to project-based for high-churn industries',
  ],
  risk_shift: [
    'Add conditional guarantee to reduce buyer hesitation',
    'Add performance triggers/milestones',
    'Remove full guarantee if hurting economics',
    'Add phased engagement (entry offer + rollout)',
    'Offer pilot program to build trust',
    'Run pilot deals to build case studies first',
    'Lower promise from revenue to booked meetings until you have proof',
    'Switch from full guarantee to performance hybrid',
    'Use milestone-based billing',
  ],
  positioning_shift: [
    'Clarify who it\'s for in all messaging',
    'Clarify what changes after working with you',
    'Clarify why now (create urgency)',
    'Clarify expected timeline to results',
    'Lead with the transformation, not the service',
  ],
  founder_psychology_check: [
    'Reduce promise scope for first 3–5 clients',
    'Increase price after early proof',
    'Add guarantee once unit economics are proven',
    'Test with a smaller ICP before scaling',
    'Focus on one promise before expanding',
  ],
};

// ========== VIOLATION TO CATEGORY MAPPING ==========

const VIOLATION_TO_CATEGORIES: Record<string, FixCategory[]> = {
  // Pain/Urgency issues
  'double_stress': ['icp_shift', 'promise_shift', 'fulfillment_shift'],
  'maturity_promise_mismatch': ['icp_shift', 'promise_shift'],
  'fulfillment_promise_mismatch': ['fulfillment_shift', 'promise_shift'],
  
  // Buying Power issues
  'budget_vs_price': ['icp_shift', 'pricing_shift'],
  'budget_vs_fulfillment': ['fulfillment_shift', 'icp_shift'],
  
  // Pricing Fit issues
  'software_pricing': ['pricing_shift', 'risk_shift'],
  'churn_risk': ['pricing_shift', 'fulfillment_shift'],
  
  // Execution Feasibility issues
  'maturity_vs_fulfillment': ['fulfillment_shift', 'icp_shift'],
  
  // Risk Alignment issues
  'maturity_vs_risk': ['risk_shift', 'pricing_shift'],
  'performance_misalignment': ['pricing_shift', 'risk_shift'],
  
  // Coaching/Advisory issues
  'coaching_misfit': ['icp_shift', 'fulfillment_shift'],
  
  // New Vertical/Proof violations
  'vertical_pricing_mismatch': ['pricing_shift', 'icp_shift'],
  'proof_risk_mismatch': ['risk_shift', 'pricing_shift'],
  
  // New Outbound-related violations
  'low_outbound_fit': ['icp_shift', 'promise_shift', 'positioning_shift'],
  'proof_promise_mismatch': ['risk_shift', 'promise_shift', 'founder_psychology_check'],
};

// ========== CONTEXTUAL FILTERS ==========

function shouldFilterFix(fix: string, formData: DiagnosticFormData): boolean {
  const { icpMaturity, icpIndustry, pricingStructure, icpSize } = formData;
  
  // If ICPMaturity = pre_revenue, do not suggest performance-only
  if (icpMaturity === 'pre_revenue' && fix.toLowerCase().includes('performance-only')) {
    return true;
  }
  
  // If ICPIndustry = local_services, avoid enterprise-priced fixes
  if (icpIndustry === 'local_services' && fix.toLowerCase().includes('enterprise')) {
    return true;
  }
  
  // If PricingModel = performance_only, avoid 'add performance slice' fix
  if (pricingStructure === 'performance_only' && fix.toLowerCase().includes('performance slice')) {
    return true;
  }
  
  // If Size <= 1-5 employees, avoid high-ticket automation unless justified
  const smallSizes: ICPSize[] = ['solo_founder', '1_5_employees'];
  if (icpSize && smallSizes.includes(icpSize) && fix.toLowerCase().includes('automation')) {
    return true;
  }
  
  return false;
}

// ========== RECOMMENDATION GENERATORS BY ISSUE TYPE ==========

interface IssueContext {
  formData: DiagnosticFormData;
  violationId: string;
}

function generateICPShiftRecommendation(ctx: IssueContext): StructuredRecommendation {
  const { formData, violationId } = ctx;
  const { icpMaturity, icpSize, icpIndustry } = formData;
  
  const isPreRevenue = icpMaturity === 'pre_revenue';
  const isSmall = icpSize === 'solo_founder' || icpSize === '1_5_employees';
  const isLocalServices = icpIndustry === 'local_services';
  
  const actionSteps = FIX_POOLS.icp_shift
    .filter(fix => !shouldFilterFix(fix, formData))
    .slice(0, 4);
  
  if (isPreRevenue) {
    return {
      id: `icp_shift_${violationId}`,
      category: 'icp_shift',
      headline: 'Switch to a buyer who already feels the pain',
      plainExplanation: 'Pre-revenue buyers don\'t have money or urgency. They delay decisions and rarely close.',
      actionSteps,
      desiredState: 'Buyer has money + has the problem + feels urgency now',
    };
  }
  
  if (isSmall && isLocalServices) {
    return {
      id: `icp_shift_${violationId}`,
      category: 'icp_shift',
      headline: 'Your buyers can\'t afford what you\'re selling',
      plainExplanation: 'Small local businesses have tight budgets. Either simplify what you offer or find buyers with more cash.',
      actionSteps,
      desiredState: 'Buyer can comfortably afford your price without hesitation',
    };
  }
  
  return {
    id: `icp_shift_${violationId}`,
    category: 'icp_shift',
    headline: 'Find buyers who are ready to buy now',
    plainExplanation: 'Your current target market isn\'t showing enough buying signals. Shift to a segment with active demand.',
    actionSteps,
    desiredState: 'Buyer has budget approved and timeline in place',
  };
}

function generatePromiseShiftRecommendation(ctx: IssueContext): StructuredRecommendation {
  const { formData, violationId } = ctx;
  const { icpMaturity, promise } = formData;
  
  const actionSteps = FIX_POOLS.promise_shift
    .filter(fix => !shouldFilterFix(fix, formData))
    .slice(0, 4);
  
  if (icpMaturity === 'pre_revenue' || icpMaturity === 'early_traction') {
    return {
      id: `promise_shift_${violationId}`,
      category: 'promise_shift',
      headline: 'Your promise is too big for early-stage buyers',
      plainExplanation: 'Early-stage companies need leads or pipeline first. Revenue promises feel impossible to them.',
      actionSteps,
      desiredState: 'Promise matches what buyer can realistically achieve',
    };
  }
  
  if (promise === 'top_line_revenue') {
    return {
      id: `promise_shift_${violationId}`,
      category: 'promise_shift',
      headline: 'Revenue promises need pipeline-ready buyers',
      plainExplanation: 'You\'re promising revenue but your ICP may not have the sales infrastructure to close deals.',
      actionSteps,
      desiredState: 'Buyer can turn your output into revenue themselves',
    };
  }
  
  return {
    id: `promise_shift_${violationId}`,
    category: 'promise_shift',
    headline: 'Align your promise to what this buyer actually needs',
    plainExplanation: 'Your promise doesn\'t match the buyer\'s current stage or priorities.',
    actionSteps,
    desiredState: 'Promise directly solves their most urgent problem',
  };
}

function generateFulfillmentShiftRecommendation(ctx: IssueContext): StructuredRecommendation {
  const { formData, violationId } = ctx;
  const { fulfillmentComplexity, icpMaturity } = formData;
  
  const actionSteps = FIX_POOLS.fulfillment_shift
    .filter(fix => !shouldFilterFix(fix, formData))
    .slice(0, 4);
  
  if (fulfillmentComplexity === 'coaching_advisory' && icpMaturity === 'pre_revenue') {
    return {
      id: `fulfillment_shift_${violationId}`,
      category: 'fulfillment_shift',
      headline: 'Coaching doesn\'t work for pre-revenue buyers',
      plainExplanation: 'Pre-revenue founders can\'t implement advice. They need done-for-you help.',
      actionSteps: [
        'Add done-for-you elements to your coaching',
        'Create a hybrid offer with implementation support',
        'Target buyers who already have a team to execute',
        ...actionSteps.slice(0, 1),
      ],
      desiredState: 'Buyer can actually use what you deliver',
    };
  }
  
  if (fulfillmentComplexity === 'custom_dfy' || fulfillmentComplexity === 'staffing_placement') {
    return {
      id: `fulfillment_shift_${violationId}`,
      category: 'fulfillment_shift',
      headline: 'Your delivery is too heavy for this buyer',
      plainExplanation: 'Labor-intensive fulfillment eats your margins with smaller clients. Simplify or charge more.',
      actionSteps,
      desiredState: 'Delivery effort matches the price point profitably',
    };
  }
  
  return {
    id: `fulfillment_shift_${violationId}`,
    category: 'fulfillment_shift',
    headline: 'Your delivery model doesn\'t match your promise',
    plainExplanation: 'How you deliver doesn\'t reliably produce the outcome you\'re selling.',
    actionSteps,
    desiredState: 'Fulfillment method reliably produces promised results',
  };
}

function generatePricingShiftRecommendation(ctx: IssueContext): StructuredRecommendation {
  const { formData, violationId } = ctx;
  const { pricingStructure, icpIndustry, fulfillmentComplexity } = formData;
  
  const actionSteps = FIX_POOLS.pricing_shift
    .filter(fix => !shouldFilterFix(fix, formData))
    .slice(0, 4);
  
  const churnIndustries: ICPIndustry[] = ['dtc_ecommerce', 'local_services'];
  const isChurnHeavy = icpIndustry && churnIndustries.includes(icpIndustry);
  
  if (isChurnHeavy && pricingStructure === 'recurring' && fulfillmentComplexity === 'custom_dfy') {
    return {
      id: `pricing_shift_${violationId}`,
      category: 'pricing_shift',
      headline: 'Recurring custom work burns you out in this industry',
      plainExplanation: 'High-churn industries cancel often. Custom retainers leave you constantly onboarding.',
      actionSteps: [
        'Switch to project-based pricing',
        'Create packages with defined scope and timelines',
        'Add setup fees to cover onboarding costs',
        'Productize your most common deliverables',
      ],
      desiredState: 'Pricing model protects margins even with client churn',
    };
  }
  
  if (pricingStructure === 'performance_only') {
    return {
      id: `pricing_shift_${violationId}`,
      category: 'pricing_shift',
      headline: 'Performance-only pricing needs control',
      plainExplanation: 'You can\'t do pure performance unless you control the outcome. Add a base retainer.',
      actionSteps: [
        'Add a base retainer plus performance bonus',
        'Switch to hybrid pricing (50% retainer + 50% performance)',
        'Only go full performance for outbound or software',
        'Add milestones to de-risk your cashflow',
      ],
      desiredState: 'You get paid for effort while upside comes from results',
    };
  }
  
  return {
    id: `pricing_shift_${violationId}`,
    category: 'pricing_shift',
    headline: 'Your price doesn\'t match your buyer\'s budget',
    plainExplanation: 'There\'s a gap between what you charge and what your target can pay.',
    actionSteps,
    desiredState: 'Price feels like a no-brainer for your ideal buyer',
  };
}

function generateRiskShiftRecommendation(ctx: IssueContext): StructuredRecommendation {
  const { formData, violationId } = ctx;
  const { icpMaturity, riskModel } = formData;
  
  const actionSteps = FIX_POOLS.risk_shift
    .filter(fix => !shouldFilterFix(fix, formData))
    .slice(0, 4);
  
  if (icpMaturity === 'pre_revenue') {
    return {
      id: `risk_shift_${violationId}`,
      category: 'risk_shift',
      headline: 'Pre-revenue buyers need risk removed',
      plainExplanation: 'They don\'t have cash to gamble. Reduce their perceived risk to close faster.',
      actionSteps: [
        'Add a conditional guarantee (refund if X doesn\'t happen)',
        'Offer pay-after-results for the first month',
        'Create a pilot program to build trust',
        'Add clear milestones with exit points',
      ],
      desiredState: 'Buyer feels safe saying yes because risk is on you',
    };
  }
  
  if (riskModel === 'no_guarantee') {
    return {
      id: `risk_shift_${violationId}`,
      category: 'risk_shift',
      headline: 'No guarantee means slow decisions',
      plainExplanation: 'Without risk reversal, buyers hesitate. A smart guarantee can speed up closes.',
      actionSteps,
      desiredState: 'Buyer says yes faster because they feel protected',
    };
  }
  
  return {
    id: `risk_shift_${violationId}`,
    category: 'risk_shift',
    headline: 'Adjust your risk model for this market',
    plainExplanation: 'Your risk structure isn\'t aligned with what this buyer segment expects.',
    actionSteps,
    desiredState: 'Risk feels fair to both you and the buyer',
  };
}

function generatePositioningShiftRecommendation(ctx: IssueContext): StructuredRecommendation {
  const { violationId } = ctx;
  
  return {
    id: `positioning_shift_${violationId}`,
    category: 'positioning_shift',
    headline: 'Clarify exactly who this is for',
    plainExplanation: 'When your positioning is fuzzy, buyers don\'t see themselves in your offer.',
    actionSteps: FIX_POOLS.positioning_shift.slice(0, 4),
    desiredState: 'Ideal buyer immediately says "this is for me"',
  };
}

function generateFounderPsychologyRecommendation(ctx: IssueContext): StructuredRecommendation {
  const { formData, violationId } = ctx;
  const { icpMaturity } = formData;
  
  const actionSteps = FIX_POOLS.founder_psychology_check.slice(0, 4);
  
  if (icpMaturity === 'pre_revenue') {
    return {
      id: `founder_psych_${violationId}`,
      category: 'founder_psychology_check',
      headline: 'Start smaller before going big',
      plainExplanation: 'Early stage? Test your offer with a smaller scope before committing to guarantees.',
      actionSteps,
      desiredState: 'You have proof of what works before scaling',
    };
  }
  
  return {
    id: `founder_psych_${violationId}`,
    category: 'founder_psychology_check',
    headline: 'Validate before you promise',
    plainExplanation: 'Make sure you can deliver reliably before making big claims.',
    actionSteps,
    desiredState: 'Confidence backed by real results',
  };
}

// ========== MAIN RECOMMENDATION GENERATOR ==========

function generateRecommendationForCategory(
  category: FixCategory,
  ctx: IssueContext
): StructuredRecommendation {
  switch (category) {
    case 'icp_shift':
      return generateICPShiftRecommendation(ctx);
    case 'promise_shift':
      return generatePromiseShiftRecommendation(ctx);
    case 'fulfillment_shift':
      return generateFulfillmentShiftRecommendation(ctx);
    case 'pricing_shift':
      return generatePricingShiftRecommendation(ctx);
    case 'risk_shift':
      return generateRiskShiftRecommendation(ctx);
    case 'positioning_shift':
      return generatePositioningShiftRecommendation(ctx);
    case 'founder_psychology_check':
      return generateFounderPsychologyRecommendation(ctx);
    default:
      return generateICPShiftRecommendation(ctx);
  }
}

export interface ViolationInput {
  id: string;
  severity: 'high' | 'medium' | 'low';
}

export function generateStructuredRecommendations(
  violations: ViolationInput[],
  formData: DiagnosticFormData,
  limit: number = 5
): StructuredRecommendation[] {
  const recommendations: StructuredRecommendation[] = [];
  const usedCategories = new Set<FixCategory>();
  
  // Sort violations by severity
  const sortedViolations = [...violations].sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
  
  for (const violation of sortedViolations) {
    const categories = VIOLATION_TO_CATEGORIES[violation.id] || ['icp_shift'];
    
    for (const category of categories) {
      // Avoid duplicate category recommendations
      if (usedCategories.has(category)) continue;
      
      const ctx: IssueContext = { formData, violationId: violation.id };
      const recommendation = generateRecommendationForCategory(category, ctx);
      
      recommendations.push(recommendation);
      usedCategories.add(category);
      
      // Stop if we hit the limit
      if (recommendations.length >= limit) break;
    }
    
    if (recommendations.length >= limit) break;
  }
  
  // If we have no recommendations from violations, provide founder psychology fallback
  if (recommendations.length === 0) {
    recommendations.push(generateFounderPsychologyRecommendation({
      formData,
      violationId: 'general',
    }));
  }
  
  return recommendations.slice(0, limit);
}

// ========== CATEGORY LABELS ==========

export const CATEGORY_LABELS: Record<FixCategory, string> = {
  icp_shift: 'Target Market',
  promise_shift: 'Offer Promise',
  fulfillment_shift: 'Delivery Model',
  pricing_shift: 'Pricing',
  risk_shift: 'Risk & Guarantees',
  positioning_shift: 'Positioning',
  founder_psychology_check: 'Founder Mindset',
};
