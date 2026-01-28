// ============= Cause Inference & Enhanced Fix Catalog =============
// Post-scoring logic for violation routing, fix selection, and prioritization

import type {
  DiagnosticFormData,
  ExtendedScores,
  ProofLevel,
  ICPMaturity,
  RiskModel,
  FulfillmentComplexity,
  ICPSize,
  OfferType,
  Promise,
  PricingStructure,
  PerformanceBasis,
  PerformanceCompTier,
} from './types';
import { generateInferredContext, type InferredContext } from './contextModifierEngine';

// ========== VIOLATION THRESHOLDS ==========
export const VIOLATION_THRESHOLDS = {
  outboundViolation: 10,      // outboundFit < 10
  executionViolation: 8,      // executionFeasibility < 8
  pricingViolation: 10,       // pricingFit < 10
  buyingPowerViolation: 10,   // buyingPower < 10
  riskViolation: 5,           // riskAlignment < 5
  urgencyViolation: 12,       // painUrgency < 12
};

// ========== INFERRED CAUSE TYPES ==========
export type InferredCause = 
  | 'proofDeficiency'
  | 'pricingMisalignment'
  | 'marketMisalignment'
  | 'promiseMismatch'
  | 'riskMisalignment'
  | 'fulfillmentBottleneck'
  | 'awarenessMismatch'
  | 'performanceMismatch'
  | 'compensationFriction'
  // New context-aware causes
  | 'proofMismatch'
  | 'pricingToBudgetMismatch'
  | 'awarenessChannelMismatch'
  | 'performanceImmaturity';

export interface DetectedCause {
  id: InferredCause;
  label: string;
  severity: number; // 1-5
  fixes: string[];
  primaryGroup?: string;
  secondaryGroups?: string[];
}

// ========== MULTIPATH FIX LIBRARY ==========
export const MULTIPATH_FIX_GROUPS = {
  earlyProofFixes: [
    'Run 2-3 micro clients to gather screenshots and testimonials',
    'Narrow the promise until you have evidence',
    'Stack proof assets before scaling outbound',
  ],
  promiseTuningFixes: [
    "Switch promise from 'revenue' to 'pipeline volume'",
    'Clarify what qualifies as success in concrete terms',
    'Reduce scope of promise until delivery is consistent',
  ],
  budgetAlignmentFixes: [
    'Move upmarket to ICPs with higher budgets',
    'Lower initial retainer and expand later',
    'Switch to hybrid pricing to reduce upfront cost',
  ],
  performanceFixes: [
    'Add minimum retainer to cover operational load',
    'Switch from % revenue to $ per appointment',
    'Only use performance with solution-aware buyers',
  ],
  compensationFixes: [
    'Reduce unit payouts for volume-driven models',
    'Lower percentage bands to improve close rates',
    'Add tiered comp to control risk',
  ],
  pilotFixes: [
    'Pilot with narrow vertical before scaling outbound',
    'Limit onboarding to 3 to validate fulfillment',
    'Refine SOPs before increasing load',
  ],
  addGuaranteeFixes: [
    'Add risk reversals to increase close rate',
    'Use conditional guarantees instead of full',
    'Tie guarantee to pipeline milestones',
  ],
  awarenessFixes: [
    'Move to solution-aware verticals',
    'Educate via inbound before outbound',
    'Switch promise to cost-saving or efficiency',
  ],
};

// ========== SUPPRESSION RULES ==========
interface SuppressionRule {
  condition: (formData: DiagnosticFormData) => boolean;
  suppressGroups: string[];
}

const SUPPRESSION_RULES: SuppressionRule[] = [
  {
    condition: (fd) => fd.proofLevel === 'moderate' || fd.proofLevel === 'strong' || fd.proofLevel === 'category_killer',
    suppressGroups: ['earlyProofFixes'],
  },
  {
    condition: (fd) => fd.riskModel === 'conditional_guarantee',
    suppressGroups: ['addGuaranteeFixes'],
  },
  {
    condition: (fd) => fd.icpMaturity === 'scaling' || fd.icpMaturity === 'mature' || fd.icpMaturity === 'enterprise',
    suppressGroups: ['pilotFixes'],
  },
  {
    condition: (fd) => fd.pricingStructure === 'recurring',
    suppressGroups: ['performanceFixes'],
  },
  {
    condition: (fd) => fd.pricingStructure !== 'performance_only' && fd.pricingStructure !== 'hybrid',
    suppressGroups: ['performanceFixes', 'compensationFixes'],
  },
];

function getSuppressedGroups(formData: DiagnosticFormData): Set<string> {
  const suppressedGroups = new Set<string>();
  
  for (const rule of SUPPRESSION_RULES) {
    if (rule.condition(formData)) {
      rule.suppressGroups.forEach(group => suppressedGroups.add(group));
    }
  }
  
  return suppressedGroups;
}

function getUnsuppressedFixes(groupName: string, formData: DiagnosticFormData): string[] {
  const suppressedGroups = getSuppressedGroups(formData);
  
  if (suppressedGroups.has(groupName)) {
    return [];
  }
  
  return MULTIPATH_FIX_GROUPS[groupName as keyof typeof MULTIPATH_FIX_GROUPS] || [];
}

// ========== CAUSE→FIX ROUTER ==========
interface CauseFixRoute {
  trigger: InferredCause;
  primaryGroup: keyof typeof MULTIPATH_FIX_GROUPS;
  secondaryGroups: (keyof typeof MULTIPATH_FIX_GROUPS)[];
}

const CAUSE_FIX_ROUTES: CauseFixRoute[] = [
  {
    trigger: 'proofMismatch',
    primaryGroup: 'earlyProofFixes',
    secondaryGroups: ['promiseTuningFixes'],
  },
  {
    trigger: 'pricingToBudgetMismatch',
    primaryGroup: 'budgetAlignmentFixes',
    secondaryGroups: ['promiseTuningFixes'],
  },
  {
    trigger: 'awarenessChannelMismatch',
    primaryGroup: 'awarenessFixes',
    secondaryGroups: ['pilotFixes'],
  },
  {
    trigger: 'performanceImmaturity',
    primaryGroup: 'performanceFixes',
    secondaryGroups: ['compensationFixes'],
  },
];

function getRoutedFixes(cause: InferredCause, formData: DiagnosticFormData): string[] {
  const route = CAUSE_FIX_ROUTES.find(r => r.trigger === cause);
  if (!route) return [];
  
  const primaryFixes = getUnsuppressedFixes(route.primaryGroup, formData);
  const secondaryFixes = route.secondaryGroups.flatMap(group => 
    getUnsuppressedFixes(group, formData)
  );
  
  return [...primaryFixes, ...secondaryFixes];
}

// ========== FIX CATALOG (LEGACY) ==========
const FIX_CATALOG: Record<InferredCause, string[]> = {
  proofDeficiency: [
    'Collect 3–5 wins before expanding promise.',
    'Lower promise until proof matches.',
    'Run micro-pilots to accumulate screenshots, metrics, and testimonials.',
  ],
  pricingMisalignment: [
    'Switch to hybrid pricing to reduce sticker shock.',
    'Lower initial retainer until proof compounds.',
    'Move upmarket to buyers with budget for current pricing.',
  ],
  marketMisalignment: [
    'Shift to ICPs with stronger budgets.',
    'Switch vertical to one with urgency + budgets.',
    'Retool offer to match ICP maturity stage.',
  ],
  promiseMismatch: [
    'Avoid purely awareness promises for outbound.',
    'Add downstream pipeline or revenue component.',
    'Change offer to revenue or appointments.',
  ],
  riskMisalignment: [
    'Use conditional instead of full guarantees.',
    'Remove performance-only for low maturity ICPs.',
    'Introduce milestone-based commitments.',
  ],
  fulfillmentBottleneck: [
    'Productize delivery to scale.',
    'Add SOPs and QA before scaling.',
    'Increase pricing for DFY complexity.',
  ],
  awarenessMismatch: [
    'Target ICPs with traction.',
    'Change promise from revenue to pipeline volume.',
    'Collect proof before scaling downmarket.',
  ],
  performanceMismatch: [
    'Switch from % revenue to $ per appointment.',
    'Add retainer until revenue is stable.',
    'Avoid % revenue with immature ICPs.',
  ],
  compensationFriction: [
    'Lower percentage bands for faster close rates.',
    'Lower unit payout for volume-based models.',
    'Add minimum retainer to cover delivery.',
  ],
  // New context-aware causes use routed fixes
  proofMismatch: [],
  pricingToBudgetMismatch: [],
  awarenessChannelMismatch: [],
  performanceImmaturity: [],
};

// ========== CAUSE LABELS ==========
const CAUSE_LABELS: Record<InferredCause, string> = {
  proofDeficiency: 'Weak proof for this promise',
  pricingMisalignment: 'Pricing doesn\'t match market',
  marketMisalignment: 'Wrong market for this offer',
  promiseMismatch: 'Promise doesn\'t fit outbound',
  riskMisalignment: 'Risk model needs adjustment',
  fulfillmentBottleneck: 'Fulfillment blocks scale',
  awarenessMismatch: 'ICP maturity vs promise gap',
  performanceMismatch: 'Performance model friction',
  compensationFriction: 'Compensation tier too high',
  // New context-aware cause labels
  proofMismatch: 'Proof level doesn\'t match ICP expectations',
  pricingToBudgetMismatch: 'Pricing exceeds ICP budget expectations',
  awarenessChannelMismatch: 'ICP awareness doesn\'t match channel',
  performanceImmaturity: 'Performance pricing with immature ICP',
};

// ========== SEVERITY WEIGHTS ==========
const SEVERITY_WEIGHTS: Record<string, number> = {
  outboundViolation: 5,
  executionViolation: 4,
  pricingViolation: 3,
  buyingPowerViolation: 3,
  riskViolation: 2,
  urgencyViolation: 1,
  // New context-aware violations get higher priority
  performanceImmaturity: 6,
  pricingToBudgetMismatch: 5,
  proofMismatch: 4,
  awarenessChannelMismatch: 3,
};

// ========== FEASIBILITY WEIGHTS BY MATURITY ==========
const FEASIBILITY_BY_MATURITY: Record<ICPMaturity, number> = {
  pre_revenue: 1,
  early_traction: 3,
  scaling: 4,
  mature: 3,
  enterprise: 2,
};

// ========== DETECT VIOLATIONS ==========
interface ViolationFlags {
  outboundViolation: boolean;
  executionViolation: boolean;
  pricingViolation: boolean;
  buyingPowerViolation: boolean;
  riskViolation: boolean;
  urgencyViolation: boolean;
}

export function detectViolationFlags(scores: ExtendedScores): ViolationFlags {
  return {
    outboundViolation: scores.outboundFit < VIOLATION_THRESHOLDS.outboundViolation,
    executionViolation: scores.executionFeasibility < VIOLATION_THRESHOLDS.executionViolation,
    pricingViolation: scores.pricingFit < VIOLATION_THRESHOLDS.pricingViolation,
    buyingPowerViolation: scores.buyingPower < VIOLATION_THRESHOLDS.buyingPowerViolation,
    riskViolation: scores.riskAlignment < VIOLATION_THRESHOLDS.riskViolation,
    urgencyViolation: scores.painUrgency < VIOLATION_THRESHOLDS.urgencyViolation,
  };
}

// ========== INFER CAUSES FROM VIOLATIONS ==========
export function inferCauses(
  formData: DiagnosticFormData,
  scores: ExtendedScores
): DetectedCause[] {
  const flags = detectViolationFlags(scores);
  const causes: DetectedCause[] = [];
  
  const proofLevel = formData.proofLevel;
  const icpMaturity = formData.icpMaturity;
  const offerType = formData.offerType;
  const fulfillment = formData.fulfillmentComplexity;
  const promise = formData.promise;
  const riskModel = formData.riskModel;
  const icpSize = formData.icpSize;
  
  const lowProofLevels: ProofLevel[] = ['none', 'weak'];
  const earlyMaturities: ICPMaturity[] = ['pre_revenue', 'early_traction'];
  const largeSizes: ICPSize[] = ['21_100_employees', '100_plus_employees'];
  const acceptableRiskModels: RiskModel[] = ['conditional_guarantee', 'pay_after_results'];
  const scaledMaturities: ICPMaturity[] = ['scaling', 'mature', 'enterprise'];
  
  // FIX: Proof misclassification - Don't treat MODERATE as early-stage
  // MODERATE or STRONG proof means growth-stage, not early-stage
  const hasGoodProof = proofLevel && ['moderate', 'strong', 'category_killer'].includes(proofLevel);
  const isActuallyEarlyStage = !hasGoodProof && icpMaturity && earlyMaturities.includes(icpMaturity);
  
  // FIX: Maturity override - disable certain causes for scaled+proof
  const isScaledWithProof = icpMaturity && scaledMaturities.includes(icpMaturity) && hasGoodProof;
  
  // Cause: Proof Deficiency
  // FIX: Only trigger if proof is actually low (not moderate/strong)
  if (proofLevel && lowProofLevels.includes(proofLevel) && flags.outboundViolation && !isScaledWithProof) {
    let fixes = [...FIX_CATALOG.proofDeficiency];
    causes.push({
      id: 'proofDeficiency',
      label: CAUSE_LABELS.proofDeficiency,
      severity: 5,
      fixes,
    });
  }
  
  // Cause: Pricing Misalignment
  if (flags.pricingViolation) {
    let fixes = [...FIX_CATALOG.pricingMisalignment];
    // Suppression: Remove "Lower initial retainer" for large ICPs
    if (icpSize && largeSizes.includes(icpSize)) {
      fixes = fixes.filter(f => !f.includes('Lower initial retainer'));
    }
    causes.push({
      id: 'pricingMisalignment',
      label: CAUSE_LABELS.pricingMisalignment,
      severity: 3,
      fixes,
    });
  }
  
  // Cause: Market Misalignment
  if (flags.buyingPowerViolation && icpMaturity && earlyMaturities.includes(icpMaturity)) {
    causes.push({
      id: 'marketMisalignment',
      label: CAUSE_LABELS.marketMisalignment,
      severity: 4,
      fixes: [...FIX_CATALOG.marketMisalignment],
    });
  }
  
  // Cause: Promise Mismatch (only for demand_creation, not outbound)
  if (flags.outboundViolation && offerType === 'demand_creation') {
    causes.push({
      id: 'promiseMismatch',
      label: CAUSE_LABELS.promiseMismatch,
      severity: 4,
      fixes: [...FIX_CATALOG.promiseMismatch],
    });
  }
  
  // Cause: Risk Misalignment
  if (flags.riskViolation) {
    let fixes = [...FIX_CATALOG.riskMisalignment];
    // Suppression: Remove if already using conditional/pay-after-results
    if (riskModel && acceptableRiskModels.includes(riskModel)) {
      fixes = [];
    }
    if (fixes.length > 0) {
      causes.push({
        id: 'riskMisalignment',
        label: CAUSE_LABELS.riskMisalignment,
        severity: 2,
        fixes,
      });
    }
  }
  
  // Cause: Fulfillment Bottleneck (only for custom_dfy)
  if (flags.executionViolation && fulfillment === 'custom_dfy') {
    causes.push({
      id: 'fulfillmentBottleneck',
      label: CAUSE_LABELS.fulfillmentBottleneck,
      severity: 4,
      fixes: [...FIX_CATALOG.fulfillmentBottleneck],
    });
  }
  
  // Cause: Awareness Mismatch
  if (icpMaturity && earlyMaturities.includes(icpMaturity) && promise === 'top_line_revenue') {
    causes.push({
      id: 'awarenessMismatch',
      label: CAUSE_LABELS.awarenessMismatch,
      severity: 4,
      fixes: [...FIX_CATALOG.awarenessMismatch],
    });
  }
  
  // ========== PERFORMANCE-RELATED CAUSES ==========
  
  const pricingStructure = formData.pricingStructure;
  const performanceBasis = formData.performanceBasis;
  const performanceCompTier = formData.performanceCompTier;
  // Note: scaledMaturities already defined above
  const percentBasedPerformance: PerformanceBasis[] = ['percent_revenue', 'percent_profit'];
  const highCompTiers: PerformanceCompTier[] = ['over_30_percent', 'over_500_unit'];
  
  // Cause: Performance Mismatch
  // Trigger: (Hybrid or Performance Only) AND (% revenue or % profit) AND (Pre-revenue or Early traction)
  if (
    pricingStructure &&
    (pricingStructure === 'hybrid' || pricingStructure === 'performance_only') &&
    performanceBasis &&
    percentBasedPerformance.includes(performanceBasis) &&
    icpMaturity &&
    earlyMaturities.includes(icpMaturity)
  ) {
    // Suppression: Don't show if targeting scaled/mature ICPs
    if (!scaledMaturities.includes(icpMaturity)) {
      causes.push({
        id: 'performanceMismatch',
        label: CAUSE_LABELS.performanceMismatch,
        severity: 4,
        fixes: [...FIX_CATALOG.performanceMismatch],
      });
    }
  }
  
  // Cause: Compensation Friction
  // Trigger: (Hybrid or Performance Only) AND (30%+ or $500+/unit)
  if (
    pricingStructure &&
    (pricingStructure === 'hybrid' || pricingStructure === 'performance_only') &&
    performanceCompTier &&
    highCompTiers.includes(performanceCompTier)
  ) {
    causes.push({
      id: 'compensationFriction',
      label: CAUSE_LABELS.compensationFriction,
      severity: 3,
      fixes: [...FIX_CATALOG.compensationFriction],
    });
  }
  
  // ========== NEW CONTEXT-AWARE CAUSES ==========
  
  const inferredContext = generateInferredContext(formData);
  const weakProofLevelsArr: ProofLevel[] = ['none', 'weak'];
  const highPriceTiers: (typeof formData.recurringPriceTier)[] = ['2k_5k', '5k_plus'];
  const veryHighPriceTiers: (typeof formData.recurringPriceTier)[] = ['5k_plus'];
  const outboundOfferTypes: OfferType[] = ['demand_capture', 'outbound_sales_enablement'];
  
  // Cause: Proof Mismatch (context-aware)
  // Trigger: (proof_level in ['None','Weak']) AND (inferProofExpectations='high')
  if (
    proofLevel &&
    weakProofLevelsArr.includes(proofLevel) &&
    inferredContext.proofExpectation === 'high'
  ) {
    const routedFixes = getRoutedFixes('proofMismatch', formData);
    if (routedFixes.length > 0) {
      causes.push({
        id: 'proofMismatch',
        label: CAUSE_LABELS.proofMismatch,
        severity: 5,
        fixes: routedFixes,
        primaryGroup: 'earlyProofFixes',
        secondaryGroups: ['promiseTuningFixes'],
      });
    }
  }
  
  // Cause: Pricing to Budget Mismatch (context-aware)
  // Trigger: (inferBudgetExpectation='low' AND high price) OR (inferBudgetExpectation='medium' AND very high price)
  if (
    pricingStructure === 'recurring' && formData.recurringPriceTier &&
    (
      (inferredContext.budgetExpectation === 'low' && highPriceTiers.includes(formData.recurringPriceTier)) ||
      (inferredContext.budgetExpectation === 'medium' && veryHighPriceTiers.includes(formData.recurringPriceTier))
    )
  ) {
    const routedFixes = getRoutedFixes('pricingToBudgetMismatch', formData);
    if (routedFixes.length > 0) {
      causes.push({
        id: 'pricingToBudgetMismatch',
        label: CAUSE_LABELS.pricingToBudgetMismatch,
        severity: 5,
        fixes: routedFixes,
        primaryGroup: 'budgetAlignmentFixes',
        secondaryGroups: ['promiseTuningFixes'],
      });
    }
  }
  
  // Cause: Awareness Channel Mismatch (context-aware)
  // Trigger: (inferMarketAwareness='problem-unaware' AND offer_type in ['Demand Capture','Outbound'])
  if (
    inferredContext.marketAwareness === 'problem-unaware' &&
    offerType &&
    outboundOfferTypes.includes(offerType)
  ) {
    const routedFixes = getRoutedFixes('awarenessChannelMismatch', formData);
    if (routedFixes.length > 0) {
      causes.push({
        id: 'awarenessChannelMismatch',
        label: CAUSE_LABELS.awarenessChannelMismatch,
        severity: 4,
        fixes: routedFixes,
        primaryGroup: 'awarenessFixes',
        secondaryGroups: ['pilotFixes'],
      });
    }
  }
  
  // Cause: Performance Immaturity (context-aware)
  // Trigger: (pricing_structure='Performance-only' AND icp_maturity in ['Pre-revenue','Early traction'])
  if (
    pricingStructure === 'performance_only' &&
    icpMaturity &&
    earlyMaturities.includes(icpMaturity)
  ) {
    const routedFixes = getRoutedFixes('performanceImmaturity', formData);
    if (routedFixes.length > 0) {
      causes.push({
        id: 'performanceImmaturity',
        label: CAUSE_LABELS.performanceImmaturity,
        severity: 6,
        fixes: routedFixes,
        primaryGroup: 'performanceFixes',
        secondaryGroups: ['compensationFixes'],
      });
    }
  }
  
  // Sort causes by severity (highest first)
  causes.sort((a, b) => (SEVERITY_WEIGHTS[b.id] || b.severity) - (SEVERITY_WEIGHTS[a.id] || a.severity));
  
  return causes;
}

// ========== PRIORITIZE AND SELECT TOP FIXES ==========
export interface PrioritizedFix {
  text: string;
  causeId: InferredCause;
  score: number;
}

export function prioritizeFixes(
  causes: DetectedCause[],
  formData: DiagnosticFormData,
  limit: number = 3
): PrioritizedFix[] {
  const icpMaturity = formData.icpMaturity || 'early_traction';
  const feasibilityWeight = FEASIBILITY_BY_MATURITY[icpMaturity];
  
  const allFixes: PrioritizedFix[] = [];
  
  for (const cause of causes) {
    const severityWeight = cause.severity;
    const combinedScore = severityWeight * feasibilityWeight;
    
    for (const fix of cause.fixes) {
      allFixes.push({
        text: fix,
        causeId: cause.id,
        score: combinedScore,
      });
    }
  }
  
  // Sort by score descending and take top N
  allFixes.sort((a, b) => b.score - a.score);
  
  // Deduplicate by removing similar fixes
  const seen = new Set<string>();
  const uniqueFixes: PrioritizedFix[] = [];
  
  for (const fix of allFixes) {
    const key = fix.text.toLowerCase().slice(0, 30);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFixes.push(fix);
    }
    if (uniqueFixes.length >= limit) break;
  }
  
  return uniqueFixes;
}

// ========== GENERATE FINAL RECOMMENDATIONS ==========
export interface EnhancedRecommendation {
  text: string;
  causeLabel: string;
}

export function generateEnhancedRecommendations(
  formData: DiagnosticFormData,
  scores: ExtendedScores,
  limit: number = 3
): EnhancedRecommendation[] {
  const causes = inferCauses(formData, scores);
  const prioritizedFixes = prioritizeFixes(causes, formData, limit);
  
  return prioritizedFixes.map(fix => ({
    text: fix.text,
    causeLabel: CAUSE_LABELS[fix.causeId],
  }));
}
