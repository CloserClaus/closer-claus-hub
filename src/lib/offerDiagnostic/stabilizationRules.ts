// ============= OUTBOUND DIAGNOSTIC STABILIZATION RULES =============
// Simplified rules for the new 5-latent scoring system
// These rules prevent infinite optimization loops

import type { 
  DiagnosticFormData, 
  ICPSize, 
  ProofLevel,
} from './types';
import type { LatentScores, LatentBottleneckKey } from './latentScoringEngine';

// ========== RULE 1: CHANNEL CONSTRAINT (HARD RULE) ==========
// If diagnostic context is "outbound readiness", never recommend switching away from outbound

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
  
  if (pricingStructure === 'performance_only' || pricingStructure === 'usage_based') {
    return null;
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
    canSelectAsBottleneck: !isWithinViableBand,
  };
}

// ========== RULE 3: FULFILLMENT STRUCTURE LOCK ==========

export type FulfillmentLockLevel = 'unlocked' | 'partially_locked' | 'fully_locked';

export interface FulfillmentLockResult {
  lockLevel: FulfillmentLockLevel;
  allowedOptimizations: string[];
  blockedRecommendations: string[];
}

export function checkFulfillmentLock(formData: DiagnosticFormData): FulfillmentLockResult {
  const { fulfillmentComplexity } = formData;
  
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
  
  return {
    lockLevel: 'unlocked',
    allowedOptimizations: [],
    blockedRecommendations: [],
  };
}

// ========== RULE 4: LOCAL OPTIMUM LOCK ==========

export interface LocalOptimumResult {
  isAtLocalOptimum: boolean;
  latentPercentages: Record<LatentBottleneckKey, number>;
  minPercentage: number;
  allowStructuralChanges: boolean;
}

const CORE_LATENTS: LatentBottleneckKey[] = [
  'proofPromise',
  'EFI',
  'fulfillmentScalability',
  'channelFit',
];

export function checkLocalOptimum(latentScores: LatentScores): LocalOptimumResult {
  const latentPercentages: Record<LatentBottleneckKey, number> = {
    EFI: (latentScores.EFI / 20) * 100,
    proofPromise: (latentScores.proofPromise / 20) * 100,
    fulfillmentScalability: (latentScores.fulfillmentScalability / 20) * 100,
    riskAlignment: (latentScores.riskAlignment / 20) * 100,
    channelFit: (latentScores.channelFit / 20) * 100,
    icpSpecificity: ((latentScores as any).icpSpecificity ?? 10) / 20 * 100,
  };
  
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

export interface BottleneckEligibilityResult {
  eligibleBottlenecks: LatentBottleneckKey[];
  selectedBottleneck: LatentBottleneckKey | null;
  shouldForceRecommendations: boolean;
  medianPercentage: number;
}

export function checkBottleneckEligibility(latentScores: LatentScores): BottleneckEligibilityResult {
  const latentPercentages: Record<LatentBottleneckKey, number> = {
    EFI: (latentScores.EFI / 20) * 100,
    proofPromise: (latentScores.proofPromise / 20) * 100,
    fulfillmentScalability: (latentScores.fulfillmentScalability / 20) * 100,
    riskAlignment: (latentScores.riskAlignment / 20) * 100,
    channelFit: (latentScores.channelFit / 20) * 100,
    icpSpecificity: ((latentScores as any).icpSpecificity ?? 10) / 20 * 100,
  };
  
  const allKeys = Object.keys(latentPercentages) as LatentBottleneckKey[];
  const sortedPercentages = Object.values(latentPercentages).sort((a, b) => a - b);
  const medianPercentage = sortedPercentages[Math.floor(sortedPercentages.length / 2)];
  
  const eligibleBottlenecks = allKeys.filter(key => {
    const pct = latentPercentages[key];
    return pct < 65 && (medianPercentage - pct) >= 10;
  });
  
  const PRIORITY_ORDER: LatentBottleneckKey[] = [
    'proofPromise',
    'EFI',
    'fulfillmentScalability',
    'channelFit',
    'riskAlignment',
  ];
  
  let selectedBottleneck: LatentBottleneckKey | null = null;
  if (eligibleBottlenecks.length > 0) {
    const lowestPct = Math.min(...eligibleBottlenecks.map(k => latentPercentages[k]));
    const lowestKeys = eligibleBottlenecks.filter(k => 
      Math.abs(latentPercentages[k] - lowestPct) < 1
    );
    
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

// ========== RULE 7: SECOND-ORDER CONSISTENCY ==========

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
  
  const efiPct = (latentScores.EFI / 20) * 100;
  if (efiPct >= 50) {
    if (['hybrid', 'performance_only'].includes(formData.pricingStructure || '')) {
      correct.push('pricing structure');
      blocked.push('switch pricing', 'change pricing model', 'lower price', 'raise price');
    }
  }
  
  const proofPct = (latentScores.proofPromise / 20) * 100;
  if (proofPct >= 50) {
    if (['moderate', 'strong', 'category_killer'].includes(formData.proofLevel || '')) {
      correct.push('proof level');
      blocked.push('get more proof', 'collect testimonials', 'get case studies', 'build proof');
    }
  }
  
  const fulfillmentPct = (latentScores.fulfillmentScalability / 20) * 100;
  if (fulfillmentPct >= 50) {
    if (['package_based', 'software_platform'].includes(formData.fulfillmentComplexity || '')) {
      correct.push('fulfillment model');
      blocked.push('productize', 'standardize', 'package your service');
    }
  }
  
  const riskPct = (latentScores.riskAlignment / 20) * 100;
  if (riskPct >= 50) {
    if (['conditional_guarantee', 'full_guarantee'].includes(formData.riskModel || '')) {
      correct.push('risk model');
      blocked.push('add guarantee', 'reduce risk', 'offer guarantee');
    }
  }
  
  return {
    blockedRecommendations: blocked,
    alreadyCorrectSelections: correct,
  };
}

// ========== STABILIZATION CONTEXT ==========

export interface StabilizationContext {
  pricingStability: PricingStabilityResult;
  fulfillmentLock: FulfillmentLockResult;
  localOptimum: LocalOptimumResult;
  bottleneckEligibility: BottleneckEligibilityResult;
  secondOrderConsistency: SecondOrderConsistencyResult;
}

export function computeStabilizationContext(
  formData: DiagnosticFormData,
  latentScores: LatentScores
): StabilizationContext {
  return {
    pricingStability: checkPricingStability(formData),
    fulfillmentLock: checkFulfillmentLock(formData),
    localOptimum: checkLocalOptimum(latentScores),
    bottleneckEligibility: checkBottleneckEligibility(latentScores),
    secondOrderConsistency: checkSecondOrderConsistency(formData, latentScores),
  };
}

// ========== RECOMMENDATION FILTERING ==========

export function filterRecommendation(
  headline: string,
  explanation: string,
  context: StabilizationContext
): { allowed: boolean; reason?: string } {
  // Rule 1: Channel constraint
  if (isChannelSwitchRecommendation(headline, explanation)) {
    return { allowed: false, reason: 'channel_switch' };
  }
  
  // Rule 3: Fulfillment lock
  if (context.fulfillmentLock.lockLevel !== 'unlocked') {
    const combined = `${headline} ${explanation}`.toLowerCase();
    const blocked = context.fulfillmentLock.blockedRecommendations.some(
      term => combined.includes(term)
    );
    if (blocked) {
      return { allowed: false, reason: 'fulfillment_locked' };
    }
  }
  
  // Rule 7: Second-order consistency
  const combined = `${headline} ${explanation}`.toLowerCase();
  const blocked = context.secondOrderConsistency.blockedRecommendations.some(
    term => combined.includes(term)
  );
  if (blocked) {
    return { allowed: false, reason: 'already_correct' };
  }
  
  return { allowed: true };
}
