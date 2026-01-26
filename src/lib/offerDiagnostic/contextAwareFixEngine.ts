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
  ICPMaturity,
  RiskModel,
  FulfillmentComplexity,
  ICPSize,
  RecurringPriceTier,
  Violation,
  StructuredRecommendation,
} from './types';
import { generateContextModifiers } from './contextModifierEngine';
import { generateFixStack, PROBLEM_CATEGORY_LABELS } from './fixStackEngine';
import { getTopViolations } from './violationEngine';
import { generateStructuredRecommendations } from './recommendationEngine';

// ========== Risk Fix Layer Types ==========
interface RiskFix {
  whatToChange: string;
  howToChangeIt: string;
  targetCondition: string;
  effort: 'Low' | 'Medium' | 'High';
  impact: 'Low' | 'Medium' | 'High' | 'Very High';
  strategicImpact: number;
  feasibility: number;
}

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

// ========== Risk Fix Layer ==========
// Triggered when RiskAlignment < 8 OR PowerScore modifier < 0

interface RiskRecommendation {
  id: string;
  whatToChange: string;
  howToChangeIt: string;
  targetCondition: string;
  instruction: string;
  effort: 'Low' | 'Medium' | 'High';
  impact: 'Low' | 'Medium' | 'High' | 'Very High';
  strategicImpact: number;
  feasibility: number;
}

const RISK_FIX_BY_MATURITY: Record<ICPMaturity, RiskRecommendation[]> = {
  pre_revenue: [
    {
      id: 'risk_pre_1',
      whatToChange: 'Switch to Conditional or Pay-After-Results Model',
      howToChangeIt: 'Move from full guarantee or performance-only to conditional guarantee or pay-after-results',
      targetCondition: 'Reduced risk exposure while maintaining buyer trust',
      instruction: 'Switch to Conditional guarantee or Pay after results because pre-revenue companies respond better to low-risk, results-based pricing. To implement: remove upfront guarantees → add milestone-based payments → introduce conditional refund terms. End goal: de-risk your offer while maintaining conversion.',
      effort: 'Low',
      impact: 'High',
      strategicImpact: 9,
      feasibility: 8,
    },
    {
      id: 'risk_pre_2',
      whatToChange: 'Avoid Full Guarantee and Performance-Only Models',
      howToChangeIt: 'Remove performance-only or full guarantee structures until traction improves',
      targetCondition: 'Sustainable risk profile for early-stage ICP',
      instruction: 'Avoid Full guarantee and Performance only until traction improves because pre-revenue buyers lack the stability to honor long-term commitments. To implement: restructure contracts → add exit clauses → tier pricing by milestone. End goal: protect margins while serving pre-revenue buyers.',
      effort: 'Low',
      impact: 'Medium',
      strategicImpact: 7,
      feasibility: 9,
    },
  ],
  early_traction: [
    {
      id: 'risk_early_1',
      whatToChange: 'Use Conditional Guarantee or Pay-After-Results',
      howToChangeIt: 'Implement conditional guarantee tied to specific milestones',
      targetCondition: 'Reduced friction with accountability on both sides',
      instruction: 'Use Conditional guarantee or Pay after results to reduce friction because early traction companies need trust signals without excessive upfront commitment. To implement: define clear milestones → add conditional refund terms → document success criteria. End goal: faster closes with aligned incentives.',
      effort: 'Low',
      impact: 'High',
      strategicImpact: 8,
      feasibility: 8,
    },
    {
      id: 'risk_early_2',
      whatToChange: 'Avoid Full Guarantee Unless Capacity is Proven',
      howToChangeIt: 'Only offer full guarantees if you have proven fulfillment capacity',
      targetCondition: 'Protected margins with appropriate risk levels',
      instruction: 'Avoid Full guarantee unless fulfillment capacity is proven because early-stage buyers may trigger refunds you cannot absorb. To implement: audit current capacity → set guardrails on guarantee scope → add performance conditions. End goal: sustainable guarantees that close deals.',
      effort: 'Medium',
      impact: 'Medium',
      strategicImpact: 6,
      feasibility: 7,
    },
  ],
  scaling: [
    {
      id: 'risk_scaling_1',
      whatToChange: 'Consider Performance-Only Pricing',
      howToChangeIt: 'Move to performance-only to accelerate deal velocity',
      targetCondition: 'Faster closes with aligned incentives for scaling buyers',
      instruction: 'Consider Performance only for acceleration because scaling companies respond well to results-based pricing when they see clear ROI. To implement: calculate break-even metrics → set performance thresholds → document success fees. End goal: higher deal velocity with scaling ICPs.',
      effort: 'Low',
      impact: 'Very High',
      strategicImpact: 10,
      feasibility: 7,
    },
    {
      id: 'risk_scaling_2',
      whatToChange: 'Add Hybrid Guarantees for Outbound',
      howToChangeIt: 'Combine conditional guarantees with retainer pricing for outbound',
      targetCondition: 'Improved close rates in competitive outbound situations',
      instruction: 'Hybrid guarantees improve close rates in outbound because scaling companies expect risk-sharing on new vendor relationships. To implement: bundle retainer + conditional guarantee → document success metrics → add performance bonus tiers. End goal: competitive advantage in outbound sales.',
      effort: 'Medium',
      impact: 'High',
      strategicImpact: 8,
      feasibility: 6,
    },
  ],
  mature: [
    {
      id: 'risk_mature_1',
      whatToChange: 'Consider Full Guarantee or Hybrid Models',
      howToChangeIt: 'Add full or hybrid guarantees to improve enterprise procurement success',
      targetCondition: 'Procurement-friendly risk structure',
      instruction: 'Full guarantee or Hybrid models improve enterprise procurement because mature companies expect vendor accountability in formal procurement processes. To implement: build guarantee into MSA → add SLA terms → document escalation paths. End goal: win more enterprise deals.',
      effort: 'Medium',
      impact: 'Very High',
      strategicImpact: 9,
      feasibility: 6,
    },
    {
      id: 'risk_mature_2',
      whatToChange: 'Avoid Performance-Only Unless Margins Support It',
      howToChangeIt: 'Only use performance-only if fulfillment margins are high',
      targetCondition: 'Sustainable pricing with appropriate risk levels',
      instruction: 'Avoid Performance only unless fulfillment margins are high because mature buyers may expect performance models at scale that erode profitability. To implement: calculate true fulfillment costs → set minimum thresholds → add volume caps. End goal: profitable performance deals.',
      effort: 'Low',
      impact: 'Medium',
      strategicImpact: 6,
      feasibility: 8,
    },
  ],
  enterprise: [
    {
      id: 'risk_enterprise_1',
      whatToChange: 'Implement Full Guarantee or Hybrid Structure',
      howToChangeIt: 'Add comprehensive guarantees to satisfy enterprise procurement requirements',
      targetCondition: 'Enterprise-grade risk structure for procurement approval',
      instruction: 'Full guarantee or Hybrid models improve enterprise procurement because enterprise buyers require formal risk mitigation in vendor agreements. To implement: develop enterprise MSA → add comprehensive SLAs → include audit rights. End goal: enterprise procurement approval.',
      effort: 'Medium',
      impact: 'Very High',
      strategicImpact: 9,
      feasibility: 5,
    },
    {
      id: 'risk_enterprise_2',
      whatToChange: 'Avoid Performance-Only for Enterprise',
      howToChangeIt: 'Replace performance-only with hybrid or guarantee structures',
      targetCondition: 'Procurement-compliant pricing model',
      instruction: 'Avoid Performance only unless fulfillment margins are high because enterprise procurement rarely approves pure performance models without guarantees. To implement: bundle retainer + guarantee → add enterprise terms → document ROI methodology. End goal: enterprise-ready offer structure.',
      effort: 'Medium',
      impact: 'Medium',
      strategicImpact: 7,
      feasibility: 7,
    },
  ],
};

function shouldTriggerRiskFixLayer(
  riskAlignment: number
): boolean {
  return riskAlignment < 8;
}

function getRiskFixes(icpMaturity: ICPMaturity): RiskRecommendation[] {
  return RISK_FIX_BY_MATURITY[icpMaturity] || [];
}

// ========== Fulfillment-Based Recommendations ==========
interface FulfillmentRecommendation {
  id: string;
  whatToChange: string;
  howToChangeIt: string;
  targetCondition: string;
  instruction: string;
  effort: 'Low' | 'Medium' | 'High';
  impact: 'Low' | 'Medium' | 'High' | 'Very High';
  strategicImpact: number;
  feasibility: number;
}

function getFulfillmentRecommendations(formData: DiagnosticFormData): FulfillmentRecommendation[] {
  const recommendations: FulfillmentRecommendation[] = [];
  const { fulfillmentComplexity, pricingStructure, icpSize, icpMaturity, recurringPriceTier } = formData;

  // Determine if price is low (under $150–$500)
  const isLowPrice = recurringPriceTier === 'under_150' || recurringPriceTier === '150_500';
  const isHighPrice = recurringPriceTier === '2k_5k' || recurringPriceTier === '5k_plus';
  
  // Rule 1: Custom Done-For-You + Low Price
  if (fulfillmentComplexity === 'custom_dfy' && isLowPrice) {
    recommendations.push({
      id: 'fulfill_custom_low_price',
      whatToChange: 'Package Deliverables or Raise Price',
      howToChangeIt: 'Custom delivery is labor intensive; convert to packages or increase to $1500+/mo',
      targetCondition: 'Sustainable margins with appropriate pricing',
      instruction: 'Custom delivery is labor intensive; consider packaging deliverables or raising price because custom DFY work at low price points creates unsustainable unit economics. To implement: document repeatable processes → create tiered packages → anchor pricing at $1500+/mo. End goal: profitable fulfillment with happy clients.',
      effort: 'Medium',
      impact: 'High',
      strategicImpact: 8,
      feasibility: 7,
    });
  }

  // Rule 2: Package-Based + Small ICP
  if (fulfillmentComplexity === 'package_based' && (icpSize === 'solo_founder' || icpSize === '1_5_employees')) {
    recommendations.push({
      id: 'fulfill_package_small_icp',
      whatToChange: 'Tighten Scope or Raise Price',
      howToChangeIt: 'Packages work, but micro agencies often price anchor low; tighten scope or raise price',
      targetCondition: 'Clear boundaries with appropriate value exchange',
      instruction: 'Packages work, but micro agencies often price anchor low; tighten scope or raise price because small ICPs expect discounts that erode profitability. To implement: reduce package scope → clearly define boundaries → anchor at higher price with value justification. End goal: profitable packages that set proper expectations.',
      effort: 'Low',
      impact: 'Medium',
      strategicImpact: 6,
      feasibility: 8,
    });
  }

  // Rule 3: Software/Platform + High Price
  if (fulfillmentComplexity === 'software_platform' && isHighPrice) {
    recommendations.push({
      id: 'fulfill_software_high_price',
      whatToChange: 'Lower Price or Add Implementation Layer',
      howToChangeIt: 'Software rarely converts at high-ticket without implementation layer; consider lowering price or adding onboarding',
      targetCondition: 'Justified pricing with appropriate value delivery',
      instruction: 'Software rarely converts at high-ticket without implementation layer; consider lowering price or adding onboarding because buyers expect white-glove service at $1500+/mo price points. To implement: add implementation services → include dedicated onboarding → bundle training sessions. End goal: justified high-ticket software offering.',
      effort: 'Medium',
      impact: 'High',
      strategicImpact: 8,
      feasibility: 6,
    });
  }

  // Rule 4: Coaching/Advisory + Performance-Only
  if (fulfillmentComplexity === 'coaching_advisory' && pricingStructure === 'performance_only') {
    recommendations.push({
      id: 'fulfill_coaching_performance',
      whatToChange: 'Switch to Retainer or Hybrid Pricing',
      howToChangeIt: 'Coaching cannot support performance-only; switch to retainer or hybrid',
      targetCondition: 'Pricing model aligned with advisory fulfillment',
      instruction: 'Coaching cannot support performance-only because advisory work requires time regardless of client outcomes. To implement: convert to monthly retainer → add milestone-based pricing → document engagement scope. End goal: sustainable coaching practice with aligned incentives.',
      effort: 'Low',
      impact: 'Very High',
      strategicImpact: 9,
      feasibility: 8,
    });
  }

  // Rule 5: Staffing/Placement + Pre-revenue ICP
  if (fulfillmentComplexity === 'staffing_placement' && icpMaturity === 'pre_revenue') {
    recommendations.push({
      id: 'fulfill_staffing_prerev',
      whatToChange: 'Shift ICP or Offer Advisory First',
      howToChangeIt: 'Pre-revenue clients cannot utilize staffing; shift ICP or offer advisory first',
      targetCondition: 'ICP has capacity to utilize placed talent',
      instruction: 'Pre-revenue clients cannot utilize staffing because they lack infrastructure to manage placed talent. To implement: shift ICP to early-traction or scaling → offer advisory to build processes first → qualify for placement capacity. End goal: successful placements with ready clients.',
      effort: 'Medium',
      impact: 'High',
      strategicImpact: 8,
      feasibility: 6,
    });
  }

  return recommendations;
}

// ========== Readiness Score Helpers ==========

function calculateReadinessScore(alignmentScore: number): number {
  return Math.round((alignmentScore / 10) * 10) / 10; // One decimal place
}

type ReadinessLabel = 'Weak' | 'Moderate' | 'Strong';

function getReadinessLabel(alignmentScore: number): ReadinessLabel {
  if (alignmentScore < 50) return 'Weak';
  if (alignmentScore < 75) return 'Moderate';
  return 'Strong';
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
  const allCandidateFixes = new Map<ContextFixId | string, { 
    certainty: number; 
    problemCategory: ProblemCategory | 'risk';
    fix: Omit<ContextAwareFix, 'id'> & { id: ContextFixId | string };
  }>();

  // Check if Risk Fix Layer should trigger
  const triggerRiskLayer = shouldTriggerRiskFixLayer(scores.riskAlignment);
  
  if (triggerRiskLayer && formData.icpMaturity) {
    // Add risk fixes with HIGH priority (certainty = 12, higher than regular fixes)
    const riskFixes = getRiskFixes(formData.icpMaturity);
    riskFixes.forEach((riskFix, index) => {
      const certainty = 12 - index; // High certainty for risk fixes
      allCandidateFixes.set(riskFix.id, {
        certainty,
        problemCategory: 'risk',
        fix: {
          id: riskFix.id as ContextFixId,
          whatToChange: riskFix.whatToChange,
          howToChangeIt: riskFix.howToChangeIt,
          targetCondition: riskFix.targetCondition,
          effort: riskFix.effort,
          impact: riskFix.impact,
          strategicImpact: riskFix.strategicImpact,
          feasibility: riskFix.feasibility,
          instruction: riskFix.instruction,
        },
      });
    });
  }

  // Add fulfillment-based recommendations (with high priority, certainty = 11)
  const fulfillmentFixes = getFulfillmentRecommendations(formData);
  fulfillmentFixes.forEach((fulfillFix, index) => {
    const certainty = 11 - index; // High certainty, just below risk fixes
    allCandidateFixes.set(fulfillFix.id, {
      certainty,
      problemCategory: 'fulfillment_misalignment',
      fix: {
        id: fulfillFix.id as ContextFixId,
        whatToChange: fulfillFix.whatToChange,
        howToChangeIt: fulfillFix.howToChangeIt,
        targetCondition: fulfillFix.targetCondition,
        effort: fulfillFix.effort,
        impact: fulfillFix.impact,
        strategicImpact: fulfillFix.strategicImpact,
        feasibility: fulfillFix.feasibility,
        instruction: fulfillFix.instruction,
      },
    });
  });

  // Add fixes from detected problems
  baseFixStack.problems.forEach((problem, index) => {
    const routedFixes = getRoutedFixes(problem.category, modifiers);
    const validatedFixes = validateFixes(routedFixes, formData, modifiers);
    
    // Add fixes with certainty based on problem priority (lower than risk fixes)
    const certainty = 10 - index * 2;
    validatedFixes.forEach((fixId) => {
      if (!allCandidateFixes.has(fixId) || allCandidateFixes.get(fixId)!.certainty < certainty) {
        const def = FIX_DEFINITIONS[fixId];
        allCandidateFixes.set(fixId, { 
          certainty, 
          problemCategory: problem.category,
          fix: {
            id: fixId,
            whatToChange: def.whatToChange,
            howToChangeIt: def.howToChangeIt,
            targetCondition: def.targetCondition,
            effort: def.effort,
            impact: def.impact,
            strategicImpact: def.strategicImpact,
            feasibility: def.feasibility,
            instruction: generateInstruction(fixId, modifiers, formData),
          },
        });
      }
    });
  });

  // Convert to ContextAwareFix objects and sort
  const contextAwareFixes: ContextAwareFix[] = Array.from(allCandidateFixes.values()).map(({ fix }) => fix as ContextAwareFix);

  // Sort by strategicImpact, then feasibility, then certainty
  contextAwareFixes.sort((a, b) => {
    const aData = allCandidateFixes.get(a.id);
    const bData = allCandidateFixes.get(b.id);
    
    // First sort by certainty (higher certainty = risk fixes come first)
    if (aData && bData && aData.certainty !== bData.certainty) {
      return bData.certainty - aData.certainty;
    }
    
    // Then by strategicImpact
    if (b.strategicImpact !== a.strategicImpact) {
      return b.strategicImpact - a.strategicImpact;
    }
    return b.feasibility - a.feasibility;
  });

  // Take top 3
  const topFixes = contextAwareFixes.slice(0, 3);
  
  // Calculate readiness score and label
  // NOTE: readinessScore is 0-10, but readinessLabel uses alignmentScore (0-100)
  const readinessScore = calculateReadinessScore(scores.alignmentScore);
  const readinessLabel = getReadinessLabel(scores.alignmentScore);
  
  // Get constraint-based violations
  const violations = getTopViolations(formData, 5);
  
  // Generate structured recommendations from violations (NEW: founder-friendly format)
  const structuredRecommendations = generateStructuredRecommendations(
    violations.map(v => ({ id: v.id, severity: v.severity })),
    formData,
    5 // limit to 5 recommendations
  );

  return {
    finalScore,
    alignmentScore: scores.alignmentScore,
    readinessScore,
    readinessLabel,
    contextModifiers: modifiers,
    problems: baseFixStack.problems,
    topFixes,
    violations,
    structuredRecommendations, // NEW: Founder-friendly recommendations
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
