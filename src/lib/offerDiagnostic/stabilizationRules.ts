// ============= OUTBOUND DIAGNOSTIC STABILIZATION RULES =============
// 8 rules to prevent infinite optimization loops and ensure correct consulting advice

import type { 
  DiagnosticFormData, 
  ICPSize, 
  ICPMaturity, 
  PricingStructure, 
  ProofLevel,
  FulfillmentComplexity,
  ICPSpecificity,
} from './types';
import type { LatentScores, LatentBottleneckKey, EFIClass } from './latentScoringEngine';

// ========== RULE 1: CHANNEL CONSTRAINT (HARD RULE) ==========
// If diagnostic context is "outbound readiness", never recommend switching away from outbound

export type ChannelRecommendationType = 
  | 'inbound'
  | 'seo'
  | 'ads'
  | 'partnerships'
  | 'referrals'
  | 'content_marketing';

const BANNED_CHANNEL_SWITCHES: string[] = [
  'inbound',
  'seo',
  'ads',
  'partnerships',
  'referrals',
  'content',
  'paid media',
  'organic',
  'word of mouth',
];

export function isChannelSwitchRecommendation(headline: string, explanation: string): boolean {
  const combined = `${headline} ${explanation}`.toLowerCase();
  return BANNED_CHANNEL_SWITCHES.some(term => 
    combined.includes(`switch to ${term}`) ||
    combined.includes(`try ${term}`) ||
    combined.includes(`focus on ${term}`) ||
    combined.includes(`consider ${term} instead`) ||
    combined.includes(`abandon outbound`)
  );
}

// ========== RULE 2: PRICING STABILITY LOCK ==========
// Define viable pricing bands; only recommend pricing changes when outside bounds

interface PricingBand {
  lower: number;
  upper: number;
}

// Pricing bands by ICP size + proof level (monthly recurring equivalent)
const PRICING_BANDS: Record<ICPSize, Record<ProofLevel, PricingBand>> = {
  solo_founder: {
    none: { lower: 100, upper: 500 },
    weak: { lower: 150, upper: 750 },
    moderate: { lower: 250, upper: 1500 },
    strong: { lower: 500, upper: 3000 },
    category_killer: { lower: 1000, upper: 5000 },
  },
  '1_5_employees': {
    none: { lower: 200, upper: 1000 },
    weak: { lower: 300, upper: 1500 },
    moderate: { lower: 500, upper: 3000 },
    strong: { lower: 1000, upper: 5000 },
    category_killer: { lower: 2000, upper: 10000 },
  },
  '6_20_employees': {
    none: { lower: 500, upper: 2000 },
    weak: { lower: 750, upper: 3000 },
    moderate: { lower: 1000, upper: 5000 },
    strong: { lower: 2000, upper: 10000 },
    category_killer: { lower: 5000, upper: 25000 },
  },
  '21_100_employees': {
    none: { lower: 1000, upper: 5000 },
    weak: { lower: 1500, upper: 7500 },
    moderate: { lower: 2500, upper: 15000 },
    strong: { lower: 5000, upper: 30000 },
    category_killer: { lower: 10000, upper: 75000 },
  },
  '100_plus_employees': {
    none: { lower: 2500, upper: 10000 },
    weak: { lower: 5000, upper: 20000 },
    moderate: { lower: 7500, upper: 50000 },
    strong: { lower: 15000, upper: 100000 },
    category_killer: { lower: 25000, upper: 250000 },
  },
};

// Map price tiers to approximate monthly values
function getPriceValueFromTier(formData: DiagnosticFormData): number | null {
  const { pricingStructure, recurringPriceTier, oneTimePriceTier, hybridRetainerTier } = formData;
  
  if (pricingStructure === 'recurring' && recurringPriceTier) {
    switch (recurringPriceTier) {
      case 'under_150': return 100;
      case '150_500': return 325;
      case '500_2k': return 1250;
      case '2k_5k': return 3500;
      case '5k_plus': return 7500;
    }
  }
  
  if (pricingStructure === 'one_time' && oneTimePriceTier) {
    // Convert to monthly equivalent (assume 6-month relationship)
    switch (oneTimePriceTier) {
      case 'under_3k': return 500;
      case '3k_10k': return 1100;
      case '10k_plus': return 3000;
    }
  }
  
  if (pricingStructure === 'hybrid' && hybridRetainerTier) {
    switch (hybridRetainerTier) {
      case 'under_150': return 100;
      case '150_500': return 325;
      case '500_2k': return 1250;
      case '2k_5k': return 3500;
      case '5k_plus': return 7500;
    }
  }
  
  // Performance-only and usage-based are harder to compare, assume mid-range
  if (pricingStructure === 'performance_only' || pricingStructure === 'usage_based') {
    return null; // Cannot reliably determine
  }
  
  return null;
}

export interface PricingStabilityResult {
  isWithinViableBand: boolean;
  isUnderpriced: boolean;
  isOverpriced: boolean;
  canSelectAsBottleneck: boolean;
}

export function checkPricingStability(formData: DiagnosticFormData): PricingStabilityResult {
  const { icpSize, proofLevel } = formData;
  
  if (!icpSize || !proofLevel) {
    return { isWithinViableBand: true, isUnderpriced: false, isOverpriced: false, canSelectAsBottleneck: false };
  }
  
  const priceValue = getPriceValueFromTier(formData);
  if (priceValue === null) {
    // Cannot determine, assume within band
    return { isWithinViableBand: true, isUnderpriced: false, isOverpriced: false, canSelectAsBottleneck: false };
  }
  
  const band = PRICING_BANDS[icpSize][proofLevel];
  const isUnderpriced = priceValue < band.lower;
  const isOverpriced = priceValue > band.upper;
  const isWithinViableBand = !isUnderpriced && !isOverpriced;
  
  return {
    isWithinViableBand,
    isUnderpriced,
    isOverpriced,
    canSelectAsBottleneck: !isWithinViableBand, // Only allow pricing as bottleneck if outside band
  };
}

// ========== RULE 3: FULFILLMENT STRUCTURE LOCK ==========
// If already productized, only allow second-order optimizations

export type FulfillmentLockLevel = 'unlocked' | 'partially_locked' | 'fully_locked';

export interface FulfillmentLockResult {
  lockLevel: FulfillmentLockLevel;
  allowedOptimizations: string[];
  blockedRecommendations: string[];
}

export function checkFulfillmentLock(formData: DiagnosticFormData): FulfillmentLockResult {
  const { fulfillmentComplexity } = formData;
  
  // Package-based and software are already productized
  if (fulfillmentComplexity === 'package_based' || fulfillmentComplexity === 'software_platform') {
    return {
      lockLevel: 'fully_locked',
      allowedOptimizations: [
        'automation depth',
        'SOP refinement',
        'tooling efficiency',
        'delivery speed',
        'quality assurance',
        'client onboarding',
      ],
      blockedRecommendations: [
        'productization',
        'productize',
        'labor decoupling',
        'standardization',
        'standardize',
        'package your service',
      ],
    };
  }
  
  // Coaching is semi-productized
  if (fulfillmentComplexity === 'coaching_advisory') {
    return {
      lockLevel: 'partially_locked',
      allowedOptimizations: [
        'curriculum development',
        'group delivery',
        'self-paced components',
        'tooling efficiency',
      ],
      blockedRecommendations: [
        'fully productize',
        'remove labor',
      ],
    };
  }
  
  // Custom DFY and staffing are unlocked
  return {
    lockLevel: 'unlocked',
    allowedOptimizations: [],
    blockedRecommendations: [],
  };
}

export function isFulfillmentRecommendationBlocked(
  headline: string, 
  explanation: string, 
  lockResult: FulfillmentLockResult
): boolean {
  if (lockResult.lockLevel === 'unlocked') return false;
  
  const combined = `${headline} ${explanation}`.toLowerCase();
  return lockResult.blockedRecommendations.some(term => combined.includes(term));
}

// ========== RULE 4: LOCAL OPTIMUM LOCK ==========
// If all core latents are ≥ 70%, block structural recommendations

export interface LocalOptimumResult {
  isAtLocalOptimum: boolean;
  latentPercentages: Record<LatentBottleneckKey, number>;
  minPercentage: number;
  allowStructuralChanges: boolean;
}

const CORE_LATENTS: LatentBottleneckKey[] = [
  'proofToPromise',
  'economicHeadroom',
  'fulfillmentScalability',
  'channelFit',
];

export function checkLocalOptimum(latentScores: LatentScores): LocalOptimumResult {
  const latentPercentages: Record<LatentBottleneckKey, number> = {
    economicHeadroom: (latentScores.economicHeadroom / 20) * 100,
    proofToPromise: (latentScores.proofToPromise / 20) * 100,
    fulfillmentScalability: (latentScores.fulfillmentScalability / 20) * 100,
    riskAlignment: (latentScores.riskAlignment / 20) * 100,
    channelFit: (latentScores.channelFit / 20) * 100,
    icpSpecificityStrength: (latentScores.icpSpecificityStrength / 20) * 100,
  };
  
  // Check if all CORE latents are ≥ 70%
  const coreLatentsAbove70 = CORE_LATENTS.every(
    key => latentPercentages[key] >= 70
  );
  
  const minPercentage = Math.min(...Object.values(latentPercentages));
  
  return {
    isAtLocalOptimum: coreLatentsAbove70,
    latentPercentages,
    minPercentage,
    allowStructuralChanges: !coreLatentsAbove70,
  };
}

// ========== RULE 5: BOTTLENECK ELIGIBILITY ==========
// Only select as bottleneck if < 65% AND 10% worse than median

export interface BottleneckEligibilityResult {
  eligibleBottlenecks: LatentBottleneckKey[];
  selectedBottleneck: LatentBottleneckKey | null;
  shouldForceRecommendations: boolean;
  medianPercentage: number;
}

export function checkBottleneckEligibility(latentScores: LatentScores): BottleneckEligibilityResult {
  const latentPercentages: Record<LatentBottleneckKey, number> = {
    economicHeadroom: (latentScores.economicHeadroom / 20) * 100,
    proofToPromise: (latentScores.proofToPromise / 20) * 100,
    fulfillmentScalability: (latentScores.fulfillmentScalability / 20) * 100,
    riskAlignment: (latentScores.riskAlignment / 20) * 100,
    channelFit: (latentScores.channelFit / 20) * 100,
    icpSpecificityStrength: (latentScores.icpSpecificityStrength / 20) * 100,
  };
  
  const allKeys = Object.keys(latentPercentages) as LatentBottleneckKey[];
  const sortedPercentages = Object.values(latentPercentages).sort((a, b) => a - b);
  const medianPercentage = sortedPercentages[Math.floor(sortedPercentages.length / 2)];
  
  // Find eligible bottlenecks (< 65% AND at least 10% worse than median)
  const eligibleBottlenecks = allKeys.filter(key => {
    const pct = latentPercentages[key];
    return pct < 65 && (medianPercentage - pct) >= 10;
  });
  
  // Priority order for tie-breaking
  const PRIORITY_ORDER: LatentBottleneckKey[] = [
    'proofToPromise',
    'economicHeadroom',
    'icpSpecificityStrength',
    'fulfillmentScalability',
    'channelFit',
    'riskAlignment',
  ];
  
  // Select bottleneck by priority among eligible
  let selectedBottleneck: LatentBottleneckKey | null = null;
  if (eligibleBottlenecks.length > 0) {
    // Find lowest percentage among eligible
    const lowestPct = Math.min(...eligibleBottlenecks.map(k => latentPercentages[k]));
    const lowestKeys = eligibleBottlenecks.filter(k => 
      Math.abs(latentPercentages[k] - lowestPct) < 1
    );
    
    // Use priority order to break ties
    for (const key of PRIORITY_ORDER) {
      if (lowestKeys.includes(key)) {
        selectedBottleneck = key;
        break;
      }
    }
  }
  
  return {
    eligibleBottlenecks,
    selectedBottleneck,
    shouldForceRecommendations: eligibleBottlenecks.length > 0,
    medianPercentage,
  };
}

// ========== RULE 6: ICP SPECIFICITY OVERRIDE ==========
// If ICP specificity is "exact", never penalize as broad

export interface ICPSpecificityOverrideResult {
  shouldTreatAsBroad: boolean;
  proofConcentrated: boolean;
  allowPromiseBreadthPenalty: boolean;
}

export function checkICPSpecificityOverride(
  icpSpecificity: ICPSpecificity | null
): ICPSpecificityOverrideResult {
  if (icpSpecificity === 'exact') {
    return {
      shouldTreatAsBroad: false,
      proofConcentrated: true,
      allowPromiseBreadthPenalty: false,
    };
  }
  
  if (icpSpecificity === 'narrow') {
    return {
      shouldTreatAsBroad: false,
      proofConcentrated: true,
      allowPromiseBreadthPenalty: false,
    };
  }
  
  // Only broad ICP can have breadth penalties
  return {
    shouldTreatAsBroad: true,
    proofConcentrated: false,
    allowPromiseBreadthPenalty: true,
  };
}

// ========== RULE 7: SECOND-ORDER CONSISTENCY ==========
// Never recommend fixing something user already correctly selected unless score < 50%

export interface SecondOrderConsistencyResult {
  blockedRecommendations: string[];
  alreadyCorrectSelections: string[];
}

export function checkSecondOrderConsistency(
  formData: DiagnosticFormData,
  latentScores: LatentScores
): SecondOrderConsistencyResult {
  const blocked: string[] = [];
  const correct: string[] = [];
  
  // Check pricing consistency
  const economicHeadroomPct = (latentScores.economicHeadroom / 20) * 100;
  if (economicHeadroomPct >= 50) {
    if (['hybrid', 'performance_only'].includes(formData.pricingStructure || '')) {
      correct.push('pricing structure');
      blocked.push('switch pricing', 'change pricing model', 'lower price', 'raise price');
    }
  }
  
  // Check proof consistency
  const proofPct = (latentScores.proofToPromise / 20) * 100;
  if (proofPct >= 50) {
    if (['moderate', 'strong', 'category_killer'].includes(formData.proofLevel || '')) {
      correct.push('proof level');
      blocked.push('get more proof', 'collect testimonials', 'get case studies', 'build proof');
    }
  }
  
  // Check fulfillment consistency
  const fulfillmentPct = (latentScores.fulfillmentScalability / 20) * 100;
  if (fulfillmentPct >= 50) {
    if (['package_based', 'software_platform'].includes(formData.fulfillmentComplexity || '')) {
      correct.push('fulfillment model');
      blocked.push('productize', 'standardize', 'package your service');
    }
  }
  
  // Check risk consistency
  const riskPct = (latentScores.riskAlignment / 20) * 100;
  if (riskPct >= 50) {
    if (['conditional_guarantee', 'full_guarantee'].includes(formData.riskModel || '')) {
      correct.push('risk model');
      blocked.push('add guarantee', 'reduce risk', 'offer guarantee');
    }
  }
  
  // Check ICP specificity consistency
  const icpPct = (latentScores.icpSpecificityStrength / 20) * 100;
  if (icpPct >= 50) {
    if (['narrow', 'exact'].includes(formData.icpSpecificity || '')) {
      correct.push('ICP definition');
      blocked.push('narrow icp', 'focus icp', 'tighten icp', 'be more specific');
    }
  }
  
  return {
    blockedRecommendations: blocked,
    alreadyCorrectSelections: correct,
  };
}

export function isSecondOrderInconsistent(
  headline: string,
  explanation: string,
  consistencyResult: SecondOrderConsistencyResult
): boolean {
  const combined = `${headline} ${explanation}`.toLowerCase();
  return consistencyResult.blockedRecommendations.some(term => combined.includes(term));
}

// ========== RULE 8: RECOMMENDATION OBJECTIVE PRIORITY ==========

export type RecommendationPriority = 'least_disruptive' | 'improves_conversion' | 'preserves_model';

export interface RecommendationObjectiveResult {
  priority: RecommendationPriority;
  mustPreserve: string[];
  canModify: string[];
}

export function determineRecommendationObjective(
  formData: DiagnosticFormData,
  localOptimumResult: LocalOptimumResult
): RecommendationObjectiveResult {
  const mustPreserve: string[] = [];
  const canModify: string[] = [];
  
  // If at local optimum, preserve everything
  if (localOptimumResult.isAtLocalOptimum) {
    mustPreserve.push('pricing structure', 'fulfillment model', 'ICP targeting', 'promise scope');
    return {
      priority: 'least_disruptive',
      mustPreserve,
      canModify: [],
    };
  }
  
  // Preserve high-scoring dimensions (>= 70%)
  if (localOptimumResult.latentPercentages.economicHeadroom >= 70) {
    mustPreserve.push('pricing structure');
  } else {
    canModify.push('pricing structure');
  }
  
  if (localOptimumResult.latentPercentages.fulfillmentScalability >= 70) {
    mustPreserve.push('fulfillment model');
  } else {
    canModify.push('fulfillment model');
  }
  
  if (localOptimumResult.latentPercentages.icpSpecificityStrength >= 70) {
    mustPreserve.push('ICP targeting');
  } else {
    canModify.push('ICP targeting');
  }
  
  if (localOptimumResult.latentPercentages.proofToPromise >= 70) {
    mustPreserve.push('promise scope');
  } else {
    canModify.push('promise scope');
  }
  
  return {
    priority: 'improves_conversion',
    mustPreserve,
    canModify,
  };
}

// ========== COMBINED STABILIZATION CHECK ==========

export interface StabilizationContext {
  pricingStability: PricingStabilityResult;
  fulfillmentLock: FulfillmentLockResult;
  localOptimum: LocalOptimumResult;
  bottleneckEligibility: BottleneckEligibilityResult;
  icpOverride: ICPSpecificityOverrideResult;
  secondOrderConsistency: SecondOrderConsistencyResult;
  recommendationObjective: RecommendationObjectiveResult;
}

export function computeStabilizationContext(
  formData: DiagnosticFormData,
  latentScores: LatentScores
): StabilizationContext {
  const pricingStability = checkPricingStability(formData);
  const fulfillmentLock = checkFulfillmentLock(formData);
  const localOptimum = checkLocalOptimum(latentScores);
  const bottleneckEligibility = checkBottleneckEligibility(latentScores);
  const icpOverride = checkICPSpecificityOverride(formData.icpSpecificity);
  const secondOrderConsistency = checkSecondOrderConsistency(formData, latentScores);
  const recommendationObjective = determineRecommendationObjective(formData, localOptimum);
  
  return {
    pricingStability,
    fulfillmentLock,
    localOptimum,
    bottleneckEligibility,
    icpOverride,
    secondOrderConsistency,
    recommendationObjective,
  };
}

// ========== RECOMMENDATION FILTER ==========

export interface FilteredRecommendation {
  isBlocked: boolean;
  blockReason: string | null;
}

export function filterRecommendation(
  headline: string,
  explanation: string,
  category: string,
  stabilization: StabilizationContext
): FilteredRecommendation {
  // Rule 1: Channel constraint
  if (isChannelSwitchRecommendation(headline, explanation)) {
    return { isBlocked: true, blockReason: 'channel_switch_blocked' };
  }
  
  // Rule 2: Pricing stability lock
  if (category === 'pricing_shift' && stabilization.pricingStability.isWithinViableBand) {
    return { isBlocked: true, blockReason: 'pricing_within_viable_band' };
  }
  
  // Rule 3: Fulfillment structure lock
  if (category === 'fulfillment_shift' && 
      isFulfillmentRecommendationBlocked(headline, explanation, stabilization.fulfillmentLock)) {
    return { isBlocked: true, blockReason: 'fulfillment_already_productized' };
  }
  
  // Rule 4: Local optimum lock
  if (stabilization.localOptimum.isAtLocalOptimum && 
      !headline.toLowerCase().includes('optimize') &&
      !headline.toLowerCase().includes('refine') &&
      !headline.toLowerCase().includes('improve')) {
    // Block structural recommendations when at local optimum
    const structuralKeywords = ['switch', 'change', 'shift', 'restructure', 'pivot', 'replace'];
    const isStructural = structuralKeywords.some(kw => 
      headline.toLowerCase().includes(kw) || explanation.toLowerCase().includes(kw)
    );
    if (isStructural) {
      return { isBlocked: true, blockReason: 'local_optimum_structural_blocked' };
    }
  }
  
  // Rule 7: Second-order consistency
  if (isSecondOrderInconsistent(headline, explanation, stabilization.secondOrderConsistency)) {
    return { isBlocked: true, blockReason: 'second_order_inconsistent' };
  }
  
  return { isBlocked: false, blockReason: null };
}
