import type {
  DiagnosticFormData,
  ExtendedScores,
  ContextModifiers,
  ContextFixId,
  ContextAwareFix,
  ContextAwareFixStackResult,
  DetectedProblem,
  ProblemCategory,
  CashFlowLevel,
  PainType,
  MaturityLevel,
  FulfillmentType,
  MechanismStrength,
  PricingStructure,
} from './types';
import { generateContextModifiers } from './contextModifierEngine';
import { generateFixStack, PROBLEM_CATEGORY_LABELS } from './fixStackEngine';

// ========== Fix Definitions ==========
interface FixDefinition {
  whatToChange: string;
  howToChangeIt: string;
  targetCondition: string;
  effort: 'Low' | 'Medium' | 'High';
  impact: 'Low' | 'Medium' | 'High' | 'Very High';
  strategicImpact: number;
  feasibility: number;
}

const FIX_DEFINITIONS: Record<ContextFixId, FixDefinition> = {
  SwitchToPerformance: {
    whatToChange: 'Switch to Performance-Based Pricing',
    howToChangeIt: 'Remove upfront retainer, charge only on delivered results',
    targetCondition: 'Zero upfront friction, risk on your side',
    effort: 'Low',
    impact: 'High',
    strategicImpact: 8,
    feasibility: 7,
  },
  SwitchToHybrid: {
    whatToChange: 'Switch to Hybrid Pricing',
    howToChangeIt: 'Small retainer ($500-$1500) + performance component',
    targetCondition: 'Reduced upfront ask with skin in the game',
    effort: 'Low',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 8,
  },
  ReduceRisk: {
    whatToChange: 'Add Risk Reduction',
    howToChangeIt: 'Introduce money-back guarantee or conditional refund',
    targetCondition: 'Buyer feels protected on first purchase',
    effort: 'Low',
    impact: 'Medium',
    strategicImpact: 6,
    feasibility: 9,
  },
  Retainer: {
    whatToChange: 'Move to Pure Retainer',
    howToChangeIt: 'Set monthly retainer based on expected value delivered',
    targetCondition: 'Predictable revenue with committed clients',
    effort: 'Low',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 6,
  },
  ConditionalGuarantee: {
    whatToChange: 'Add Conditional Guarantee',
    howToChangeIt: 'Guarantee tied to specific milestones or KPIs',
    targetCondition: 'Trust built through measurable commitment',
    effort: 'Low',
    impact: 'High',
    strategicImpact: 8,
    feasibility: 7,
  },
  IncreaseRetainer: {
    whatToChange: 'Increase Retainer Price',
    howToChangeIt: 'Move into $2k-$5k+ range with expanded deliverables',
    targetCondition: 'Higher ACV with better unit economics',
    effort: 'Medium',
    impact: 'Very High',
    strategicImpact: 9,
    feasibility: 5,
  },
  ShiftUpmarket: {
    whatToChange: 'Shift Upmarket',
    howToChangeIt: 'Target 21-100 employee companies instead of SMB',
    targetCondition: 'ICP has budget aligned to your pricing',
    effort: 'Medium',
    impact: 'Very High',
    strategicImpact: 10,
    feasibility: 5,
  },
  ShiftVertical: {
    whatToChange: 'Shift to Higher-Budget Vertical',
    howToChangeIt: 'Target SaaS/Tech or Professional Services instead',
    targetCondition: 'Industry with demonstrated spend on your offer type',
    effort: 'Medium',
    impact: 'High',
    strategicImpact: 8,
    feasibility: 5,
  },
  ImproveMechanism: {
    whatToChange: 'Strengthen Your Mechanism',
    howToChangeIt: 'Add proprietary frameworks, data, or automation',
    targetCondition: 'Differentiated offer that justifies premium',
    effort: 'Medium',
    impact: 'High',
    strategicImpact: 8,
    feasibility: 6,
  },
  Downmarket: {
    whatToChange: 'Move Downmarket',
    howToChangeIt: 'Simplify offer to serve earlier-stage companies',
    targetCondition: 'Accessible entry point for growing companies',
    effort: 'Medium',
    impact: 'Medium',
    strategicImpact: 5,
    feasibility: 7,
  },
  DurationBrand: {
    whatToChange: 'Extend Brand Engagement',
    howToChangeIt: 'Move to 6-12 month brand partnerships vs campaigns',
    targetCondition: 'Long-term brand relationship with recurring revenue',
    effort: 'Medium',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 5,
  },
  OperationalSimplify: {
    whatToChange: 'Simplify Operations',
    howToChangeIt: 'Reduce scope to core high-impact deliverables',
    targetCondition: 'Easier fulfillment with clear boundaries',
    effort: 'Low',
    impact: 'Medium',
    strategicImpact: 6,
    feasibility: 8,
  },
  IncreaseAOV: {
    whatToChange: 'Increase Average Order Value',
    howToChangeIt: 'Bundle upsells, add premium tier, expand scope',
    targetCondition: 'Higher revenue per customer relationship',
    effort: 'Medium',
    impact: 'High',
    strategicImpact: 8,
    feasibility: 6,
  },
  SimplifyOffer: {
    whatToChange: 'Simplify Your Offer',
    howToChangeIt: 'Remove complex deliverables pre-revenue ICPs cannot use',
    targetCondition: 'Offer matches what early-stage can implement',
    effort: 'Low',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 8,
  },
  PerformancePricing: {
    whatToChange: 'Switch to Performance Pricing',
    howToChangeIt: 'Charge per result instead of upfront',
    targetCondition: 'No cash flow barrier for pre-revenue buyers',
    effort: 'Low',
    impact: 'High',
    strategicImpact: 8,
    feasibility: 6,
  },
  RemoveGuarantee: {
    whatToChange: 'Remove Guarantee Requirements',
    howToChangeIt: 'Shift to milestone-based pricing instead',
    targetCondition: 'Lower risk for you with immature ICPs',
    effort: 'Low',
    impact: 'Medium',
    strategicImpact: 5,
    feasibility: 9,
  },
  SimplifyFulfillment: {
    whatToChange: 'Simplify Fulfillment',
    howToChangeIt: 'Reduce labor intensity with templates and systems',
    targetCondition: 'Scalable delivery model',
    effort: 'Medium',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 6,
  },
  HybridPricing: {
    whatToChange: 'Move to Hybrid Pricing',
    howToChangeIt: 'Combine small retainer with success fees',
    targetCondition: 'Balanced risk with upfront commitment',
    effort: 'Low',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 7,
  },
  AddConditionalGuarantee: {
    whatToChange: 'Add Conditional Guarantee',
    howToChangeIt: 'Guarantee tied to client implementing requirements',
    targetCondition: 'Protected guarantee with accountability',
    effort: 'Low',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 8,
  },
  IncreasePricing: {
    whatToChange: 'Increase Your Pricing',
    howToChangeIt: 'Move to next tier with expanded deliverables',
    targetCondition: 'Price matches scaling ICP expectations',
    effort: 'Low',
    impact: 'High',
    strategicImpact: 8,
    feasibility: 6,
  },
  AddGuarantee: {
    whatToChange: 'Add Strong Guarantee',
    howToChangeIt: 'Full or conditional money-back guarantee',
    targetCondition: 'Eliminates perceived risk for buyer',
    effort: 'Low',
    impact: 'Very High',
    strategicImpact: 9,
    feasibility: 6,
  },
  RequireRetainers: {
    whatToChange: 'Require Retainer Commitment',
    howToChangeIt: 'Minimum 3-6 month retainer agreement',
    targetCondition: 'Committed clients with predictable revenue',
    effort: 'Low',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 7,
  },
  EnterprisePackaging: {
    whatToChange: 'Create Enterprise Packaging',
    howToChangeIt: 'Build custom packages for $10k+/mo engagements',
    targetCondition: 'Premium offer for mature buyers',
    effort: 'Medium',
    impact: 'Very High',
    strategicImpact: 9,
    feasibility: 4,
  },
  LandAndExpand: {
    whatToChange: 'Implement Land & Expand',
    howToChangeIt: 'Start small, prove value, expand scope',
    targetCondition: 'Low-friction entry with expansion path',
    effort: 'Low',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 8,
  },
  Productize: {
    whatToChange: 'Productize Your Service',
    howToChangeIt: 'Create standardized deliverables with fixed scope',
    targetCondition: 'Repeatable delivery without custom work',
    effort: 'Medium',
    impact: 'High',
    strategicImpact: 8,
    feasibility: 5,
  },
  Systemize: {
    whatToChange: 'Systemize Fulfillment',
    howToChangeIt: 'Build SOPs, templates, and automation',
    targetCondition: 'Reduced labor with consistent output',
    effort: 'Medium',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 6,
  },
  Hybridize: {
    whatToChange: 'Hybridize Fulfillment',
    howToChangeIt: 'Combine labor with systems/automation',
    targetCondition: 'Better margins with maintained quality',
    effort: 'Medium',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 6,
  },
  IncreasePrice: {
    whatToChange: 'Increase Price to Match Cost',
    howToChangeIt: 'Price to 3-4x fulfillment cost for healthy margins',
    targetCondition: 'Sustainable unit economics',
    effort: 'Low',
    impact: 'Medium',
    strategicImpact: 6,
    feasibility: 7,
  },
  Upmarket: {
    whatToChange: 'Target Upmarket Buyers',
    howToChangeIt: 'Focus on buyers who value high-touch fulfillment',
    targetCondition: 'ICP appreciates and pays for labor intensity',
    effort: 'Medium',
    impact: 'High',
    strategicImpact: 8,
    feasibility: 5,
  },
  Guarantee: {
    whatToChange: 'Add Performance Guarantee',
    howToChangeIt: 'Guarantee specific outcomes or refund',
    targetCondition: 'Risk reversal that closes deals faster',
    effort: 'Low',
    impact: 'High',
    strategicImpact: 8,
    feasibility: 6,
  },
  AddServices: {
    whatToChange: 'Add Service Layer',
    howToChangeIt: 'Bundle implementation, training, or support',
    targetCondition: 'Higher value with stickier relationships',
    effort: 'Medium',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 5,
  },
  UsageBasedPricing: {
    whatToChange: 'Implement Usage-Based Pricing',
    howToChangeIt: 'Charge per output, lead, or transaction',
    targetCondition: 'Aligned incentives with scalable revenue',
    effort: 'Medium',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 6,
  },
  AddRetainerComponent: {
    whatToChange: 'Add Retainer Component',
    howToChangeIt: 'Add monthly fee for ongoing management',
    targetCondition: 'Recurring revenue beyond placement',
    effort: 'Low',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 7,
  },
  IncreaseProof: {
    whatToChange: 'Increase Social Proof',
    howToChangeIt: 'Add case studies, testimonials, metrics',
    targetCondition: 'Credibility that supports premium pricing',
    effort: 'Medium',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 6,
  },
  ImproveProof: {
    whatToChange: 'Improve Your Proof Stack',
    howToChangeIt: 'Add ROI calculators, case studies, video testimonials',
    targetCondition: 'Reduced friction from proof abundance',
    effort: 'Medium',
    impact: 'Medium',
    strategicImpact: 6,
    feasibility: 7,
  },
  CaseStudies: {
    whatToChange: 'Build Detailed Case Studies',
    howToChangeIt: 'Document 3-5 client wins with metrics',
    targetCondition: 'Proof that overcomes skepticism',
    effort: 'Medium',
    impact: 'Medium',
    strategicImpact: 6,
    feasibility: 7,
  },
  Upsell: {
    whatToChange: 'Build Upsell Path',
    howToChangeIt: 'Create premium tier or expansion services',
    targetCondition: 'Increased LTV from existing clients',
    effort: 'Medium',
    impact: 'High',
    strategicImpact: 7,
    feasibility: 6,
  },
  RaisePricing: {
    whatToChange: 'Raise Your Pricing',
    howToChangeIt: 'Increase prices 20-50% with added positioning',
    targetCondition: 'Premium positioning with strong mechanism',
    effort: 'Low',
    impact: 'Very High',
    strategicImpact: 9,
    feasibility: 5,
  },
};

// ========== Routing Tables ==========

const PRICING_MISFIT_ROUTES: Record<CashFlowLevel, ContextFixId[]> = {
  Low: ['SwitchToPerformance', 'SwitchToHybrid', 'ReduceRisk'],
  Moderate: ['SwitchToHybrid', 'Retainer', 'ConditionalGuarantee'],
  High: ['IncreaseRetainer', 'SwitchToHybrid', 'ConditionalGuarantee'],
};

const ICP_MISMATCH_ROUTES: Record<PainType, ContextFixId[]> = {
  Revenue: ['ShiftUpmarket', 'ShiftVertical', 'ImproveMechanism'],
  Brand: ['ShiftVertical', 'Downmarket', 'DurationBrand'],
  Efficiency: ['ShiftVertical', 'OperationalSimplify'],
  Retention: ['ShiftVertical', 'IncreaseAOV'],
};

const MATURITY_MISFIT_ROUTES: Record<MaturityLevel, ContextFixId[]> = {
  Pre: ['SimplifyOffer', 'PerformancePricing', 'RemoveGuarantee'],
  Early: ['SimplifyFulfillment', 'HybridPricing', 'AddConditionalGuarantee'],
  Scaling: ['IncreasePricing', 'AddGuarantee', 'ShiftUpmarket'],
  Mature: ['RequireRetainers', 'EnterprisePackaging', 'LandAndExpand'],
};

const FULFILLMENT_MISFIT_ROUTES: Record<FulfillmentType, ContextFixId[]> = {
  Labor: ['Productize', 'Systemize', 'Hybridize'],
  Hybrid: ['IncreasePrice', 'Upmarket', 'Guarantee'],
  Automation: ['AddServices', 'UsageBasedPricing'],
  Staffing: ['AddRetainerComponent', 'ConditionalGuarantee'],
};

const MECHANISM_WEAK_ROUTES: Record<MechanismStrength, ContextFixId[]> = {
  Weak: ['AddGuarantee', 'PerformancePricing', 'IncreaseProof'],
  Medium: ['ConditionalGuarantee', 'ImproveProof', 'CaseStudies'],
  Strong: ['Upsell', 'RaisePricing'],
  VeryStrong: ['ShiftUpmarket'],
};

// ========== Problem to Route Mapping ==========

function getRoutedFixes(
  problem: ProblemCategory,
  modifiers: ContextModifiers
): ContextFixId[] {
  switch (problem) {
    case 'pricing_misfit':
      return PRICING_MISFIT_ROUTES[modifiers.cashFlow];
    case 'icp_mismatch':
      return ICP_MISMATCH_ROUTES[modifiers.painType];
    case 'offer_type_misfit':
      return MATURITY_MISFIT_ROUTES[modifiers.maturity];
    case 'fulfillment_misalignment':
      return FULFILLMENT_MISFIT_ROUTES[modifiers.fulfillment];
    case 'low_mechanism_power':
      return MECHANISM_WEAK_ROUTES[modifiers.mechanismStrength];
    case 'low_buying_power':
      return ['ShiftUpmarket', 'ShiftVertical', 'SwitchToHybrid'];
    case 'low_pain_urgency':
      return ICP_MISMATCH_ROUTES[modifiers.painType];
    case 'risk_misalignment':
      return MATURITY_MISFIT_ROUTES[modifiers.maturity];
    case 'low_switching_cost':
      return ['Productize', 'Retainer', 'AddServices'];
    default:
      return [];
  }
}

// ========== Validation Layer ==========

function validateFixes(
  fixes: ContextFixId[],
  formData: DiagnosticFormData,
  modifiers: ContextModifiers
): ContextFixId[] {
  const pricingModel = formData.pricingStructure as PricingStructure;
  
  return fixes.filter((fix) => {
    // Rule A: Remove fixes already satisfied
    if (pricingModel === 'performance_only' && fix === 'SwitchToPerformance') return false;
    if (pricingModel === 'performance_only' && fix === 'PerformancePricing') return false;
    if ((pricingModel === 'recurring' || pricingModel === 'usage_based') && fix === 'SwitchToHybrid') return false;
    if (pricingModel === 'recurring' && fix === 'RequireRetainers') return false;
    if (pricingModel === 'recurring' && fix === 'Retainer') return false;

    // Rule B: Remove fixes incompatible with CashFlow
    if (modifiers.cashFlow === 'Low') {
      if (fix === 'IncreaseRetainer') return false;
      if (fix === 'EnterprisePackaging') return false;
      if (fix === 'RaisePricing') return false;
    }

    // Rule C: Remove fulfillment contradictions
    if (modifiers.fulfillment === 'Automation') {
      if (fix === 'SimplifyFulfillment') return false;
      if (fix === 'Systemize') return false;
      if (fix === 'Productize') return false;
    }

    // Rule D: Remove mechanism contradictions
    if (modifiers.mechanismStrength === 'VeryStrong') {
      if (fix === 'AddGuarantee') return false;
      if (fix === 'PerformancePricing') return false;
      if (fix === 'IncreaseProof') return false;
    }

    return true;
  });
}

// ========== Instruction Generation ==========

function generateInstruction(
  fix: ContextFixId,
  modifiers: ContextModifiers,
  formData: DiagnosticFormData
): string {
  const def = FIX_DEFINITIONS[fix];
  
  // Build context-aware instruction
  const cashFlowContext = modifiers.cashFlow === 'Low' 
    ? 'low cash flow buyers' 
    : modifiers.cashFlow === 'Moderate' 
    ? 'moderate budget buyers' 
    : 'high-budget buyers';
  
  const maturityContext = modifiers.maturity === 'Pre' 
    ? 'pre-revenue companies' 
    : modifiers.maturity === 'Early' 
    ? 'early traction companies' 
    : modifiers.maturity === 'Scaling' 
    ? 'scaling companies' 
    : 'mature companies';
  
  const painContext = modifiers.painType === 'Revenue' 
    ? 'revenue acquisition' 
    : modifiers.painType === 'Brand' 
    ? 'brand awareness' 
    : modifiers.painType === 'Retention' 
    ? 'customer retention' 
    : 'operational efficiency';

  // Generate contextual instruction
  return `${def.whatToChange} because ${maturityContext} with ${cashFlowContext} focused on ${painContext} respond better to this approach. To implement: ${def.howToChangeIt}. End goal: ${def.targetCondition}.`;
}

// ========== Main Export ==========

export function generateContextAwareFixStack(
  formData: DiagnosticFormData,
  scores: ExtendedScores,
  finalScore: number
): ContextAwareFixStackResult | null {
  // Generate context modifiers
  const modifiers = generateContextModifiers(formData);
  if (!modifiers) return null;

  // Get base fix stack (detected problems)
  const baseFixStack = generateFixStack(formData, scores, finalScore);

  // Collect all candidate fixes from detected problems
  const allCandidateFixes = new Map<ContextFixId, { certainty: number; problemCategory: ProblemCategory }>();

  baseFixStack.problems.forEach((problem, index) => {
    const routedFixes = getRoutedFixes(problem.category, modifiers);
    const validatedFixes = validateFixes(routedFixes, formData, modifiers);
    
    // Add fixes with certainty based on problem priority
    const certainty = 10 - index * 2; // Higher certainty for higher-priority problems
    validatedFixes.forEach((fixId) => {
      if (!allCandidateFixes.has(fixId) || allCandidateFixes.get(fixId)!.certainty < certainty) {
        allCandidateFixes.set(fixId, { certainty, problemCategory: problem.category });
      }
    });
  });

  // Convert to ContextAwareFix objects and sort
  const contextAwareFixes: ContextAwareFix[] = Array.from(allCandidateFixes.entries()).map(([fixId, { certainty }]) => {
    const def = FIX_DEFINITIONS[fixId];
    return {
      id: fixId,
      whatToChange: def.whatToChange,
      howToChangeIt: def.howToChangeIt,
      targetCondition: def.targetCondition,
      effort: def.effort,
      impact: def.impact,
      strategicImpact: def.strategicImpact,
      feasibility: def.feasibility,
      instruction: generateInstruction(fixId, modifiers, formData),
    };
  });

  // Sort by strategicImpact, then feasibility
  contextAwareFixes.sort((a, b) => {
    if (b.strategicImpact !== a.strategicImpact) {
      return b.strategicImpact - a.strategicImpact;
    }
    return b.feasibility - a.feasibility;
  });

  // Take top 3
  const topFixes = contextAwareFixes.slice(0, 3);

  return {
    finalScore,
    alignmentScore: scores.alignmentScore,
    powerScore: scores.powerScore,
    contextModifiers: modifiers,
    problems: baseFixStack.problems,
    topFixes,
  };
}

// Export for UI display
export const MODIFIER_LABELS = {
  cashFlow: 'Cash Flow',
  painType: 'Pain Type',
  maturity: 'Maturity',
  fulfillment: 'Fulfillment',
  mechanismStrength: 'Mechanism Strength',
};
