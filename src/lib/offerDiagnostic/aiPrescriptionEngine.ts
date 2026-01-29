// ============= AI-Driven Prescription Engine =============
// Generates recommendations using AI based on latent bottlenecks
// Replaces legacy rule-based recommendation engine for final output
// INCLUDES: 8 Stabilization Rules for Outbound Diagnostic

import type { DiagnosticFormData, StructuredRecommendation, FixCategory } from './types';
import type { 
  LatentScores, 
  LatentBottleneckKey, 
  ReadinessLabel,
  AIRecommendationCategory,
  BOTTLENECK_ALLOWED_CATEGORIES 
} from './latentScoringEngine';
import { 
  computeStabilizationContext, 
  filterRecommendation,
  type StabilizationContext 
} from './stabilizationRules';
import { supabase } from '@/integrations/supabase/client';

// ========== AI INPUT PAYLOAD ==========

export interface AIPrescriptionInput {
  alignmentScore: number;
  readinessLabel: ReadinessLabel;
  latentScores: LatentScores;
  latentBottleneckKey: LatentBottleneckKey;
  formData: DiagnosticFormData;
  stabilizationContext?: StabilizationContext;
}

// ========== AI RECOMMENDATION OUTPUT ==========

export interface AIRecommendation {
  id: string;
  headline: string;
  plainExplanation: string;
  actionSteps: string[];
  desiredState: string;
  category: AIRecommendationCategory;
}

export interface AIPrescriptionResult {
  recommendations: AIRecommendation[];
  isOptimizationLevel: boolean;
  notOutboundReady: boolean;
  stabilizationApplied: boolean;
  blockedRecommendations: number;
}

// ========== SYSTEM PROMPT WITH STABILIZATION RULES ==========

const AI_SYSTEM_PROMPT = `You are a senior B2B go-to-market advisor specializing in OUTBOUND sales readiness.
Your task is to give founders brutally honest, practical advice to improve their offer for OUTBOUND success.

=== HARD RULES (NEVER VIOLATE) ===

RULE 1 - CHANNEL CONSTRAINT:
- NEVER recommend switching to inbound, SEO, ads, partnerships, or non-outbound channels
- All recommendations MUST improve outbound performance within the outbound channel
- Do NOT suggest "consider other channels" or "maybe outbound isn't right"

RULE 2 - PRICING STABILITY:
- If pricing is noted as "within viable band", do NOT recommend pricing changes
- Only suggest pricing changes if explicitly noted as underpriced or overpriced

RULE 3 - FULFILLMENT LOCK:
- If fulfillment is "package_based" or "software_platform", do NOT recommend productization
- Only suggest automation depth, SOP refinement, tooling efficiency for already-productized offers

RULE 4 - LOCAL OPTIMUM:
- If noted as "at local optimum", only provide tactical refinements, not structural changes
- Do NOT suggest pivots, restructuring, or major changes when all scores are healthy

RULE 5 - BOTTLENECK ELIGIBILITY:
- Only focus on the PRIMARY BOTTLENECK provided
- If no eligible bottleneck is noted, provide optimization tips only

RULE 6 - ICP SPECIFICITY:
- If ICP specificity is "exact" or "narrow", do NOT recommend narrowing ICP further
- Only recommend ICP changes if explicitly noted as "broad"

RULE 7 - SECOND-ORDER CONSISTENCY:
- Never recommend fixing something the user has already correctly configured
- Check the "already correct" list and avoid those areas

RULE 8 - RECOMMENDATION OBJECTIVE:
Priority order:
1. Least disruptive improvement
2. Improves outbound conversion probability
3. Preserves user's chosen business model
Do NOT optimize for hypothetical perfect businesses.

=== OUTPUT RULES ===

1. Base all advice ONLY on provided inputs and scores
2. Every recommendation must target the PRIMARY BOTTLENECK
3. Each recommendation changes ONE structural lever only
4. Do NOT mention scores or numbers in output
5. 1-2 recommendations maximum

IMPORTANT: Return ONLY valid JSON:
{
  "recommendations": [
    {
      "id": "string",
      "headline": "string (clear, decisive)",
      "plainExplanation": "string (why this matters for outbound)",
      "actionSteps": ["string", "string", "string"],
      "desiredState": "string (what good looks like for outbound)",
      "category": "pricing_shift" | "icp_shift" | "promise_shift" | "fulfillment_shift" | "risk_shift" | "channel_shift"
    }
  ]
}

Tone: Clear. Direct. Consulting-style. Outbound-focused.`;

// ========== BOTTLENECK TO FOCUS MAPPING ==========

const BOTTLENECK_FOCUS_MAP: Record<LatentBottleneckKey, string> = {
  economicHeadroom: 'Focus on pricing structure or ICP targeting. The current price may not match what the target market can afford (Economic Friction is too high).',
  proofToPromise: 'Focus on promise scope. The current promise may be too ambitious for the available proof.',
  fulfillmentScalability: 'Focus on delivery model. The fulfillment approach may not scale reliably.',
  riskAlignment: 'Focus on risk structure. The risk model may not match the proof level.',
  channelFit: 'Focus on channel choice. Outbound may not be the right approach for this offer.',
  icpSpecificityStrength: 'Focus on ICP targeting. The target market definition may be too broad for effective outbound.',
};

// ========== BUILD USER PROMPT WITH STABILIZATION CONTEXT ==========

function buildUserPrompt(input: AIPrescriptionInput): string {
  const { alignmentScore, readinessLabel, latentScores, latentBottleneckKey, formData, stabilizationContext } = input;
  
  const bottleneckFocus = BOTTLENECK_FOCUS_MAP[latentBottleneckKey];
  
  // Build stabilization constraints
  const stabilizationNotes: string[] = [];
  
  if (stabilizationContext) {
    // Rule 2: Pricing stability
    if (stabilizationContext.pricingStability.isWithinViableBand) {
      stabilizationNotes.push('- PRICING IS WITHIN VIABLE BAND: Do NOT recommend pricing changes');
    } else if (stabilizationContext.pricingStability.isUnderpriced) {
      stabilizationNotes.push('- Pricing is UNDERPRICED: May suggest raising price');
    } else if (stabilizationContext.pricingStability.isOverpriced) {
      stabilizationNotes.push('- Pricing is OVERPRICED: May suggest lowering price');
    }
    
    // Rule 3: Fulfillment lock
    if (stabilizationContext.fulfillmentLock.lockLevel === 'fully_locked') {
      stabilizationNotes.push('- FULFILLMENT IS ALREADY PRODUCTIZED: Do NOT recommend productization, only second-order optimizations');
    }
    
    // Rule 4: Local optimum
    if (stabilizationContext.localOptimum.isAtLocalOptimum) {
      stabilizationNotes.push('- AT LOCAL OPTIMUM (all core latents ≥70%): Only provide tactical refinements, NOT structural changes');
    }
    
    // Rule 5: Bottleneck eligibility
    if (!stabilizationContext.bottleneckEligibility.shouldForceRecommendations) {
      stabilizationNotes.push('- NO ELIGIBLE BOTTLENECK: Provide optimization tips only, no major changes needed');
    }
    
    // Rule 6: ICP specificity
    if (!stabilizationContext.icpOverride.shouldTreatAsBroad) {
      stabilizationNotes.push('- ICP IS NARROW/EXACT: Do NOT recommend narrowing ICP further');
    }
    
    // Rule 7: Second-order consistency
    if (stabilizationContext.secondOrderConsistency.alreadyCorrectSelections.length > 0) {
      stabilizationNotes.push(`- ALREADY CORRECT: ${stabilizationContext.secondOrderConsistency.alreadyCorrectSelections.join(', ')} - do NOT recommend changes to these`);
    }
    
    // Rule 8: Recommendation objective
    if (stabilizationContext.recommendationObjective.mustPreserve.length > 0) {
      stabilizationNotes.push(`- MUST PRESERVE: ${stabilizationContext.recommendationObjective.mustPreserve.join(', ')}`);
    }
  }
  
  // Build legacy constraints
  const constraints: string[] = [];
  
  if (['moderate', 'strong', 'category_killer'].includes(formData.proofLevel || '')) {
    constraints.push('- User already has proof. Do NOT suggest getting first clients or collecting testimonials.');
  }
  
  if (['conditional_guarantee', 'full_guarantee'].includes(formData.riskModel || '')) {
    constraints.push('- User already has a guarantee. Do NOT suggest adding a guarantee.');
  }
  
  if (formData.pricingStructure === 'hybrid') {
    constraints.push('- User already has hybrid pricing. Do NOT suggest switching to hybrid.');
  }
  
  if (formData.icpSpecificity === 'narrow' || formData.icpSpecificity === 'exact') {
    constraints.push(`- ICP Specificity is "${formData.icpSpecificity}". Do NOT recommend narrowing the ICP.`);
  }
  
  const stabilizationText = stabilizationNotes.length > 0
    ? `\n\n=== STABILIZATION RULES (CRITICAL - DO NOT VIOLATE) ===\n${stabilizationNotes.join('\n')}`
    : '';
  
  const constraintsText = constraints.length > 0 
    ? `\n\nCONSTRAINTS (do not violate):\n${constraints.join('\n')}`
    : '';
  
  let qualityNote = '';
  if (alignmentScore >= 80) {
    qualityNote = '\n\nNOTE: This offer is already strong. Recommendations should be optimization-level, not corrective.';
  } else if (alignmentScore < 50) {
    qualityNote = '\n\nNOTE: This offer has significant issues. Focus on the most critical fix for OUTBOUND success.';
  }
  
  return `Evaluate this offer for OUTBOUND SALES readiness and provide recommendations:

ALIGNMENT SCORE: ${alignmentScore}/100 (${readinessLabel})

LATENT SCORES:
- Economic Headroom (EFI): ${latentScores.economicHeadroom}/20
- Proof-to-Promise: ${latentScores.proofToPromise}/20  
- Fulfillment Scalability: ${latentScores.fulfillmentScalability}/20
- Risk Alignment: ${latentScores.riskAlignment}/20
- Channel Fit: ${latentScores.channelFit}/20
- ICP Specificity: ${latentScores.icpSpecificityStrength}/20

PRIMARY BOTTLENECK: ${latentBottleneckKey}
${bottleneckFocus}

OFFER CONFIGURATION:
- Offer Type: ${formData.offerType}
- Promise: ${formData.promise}
- ICP Industry: ${formData.icpIndustry}
- Vertical Segment: ${formData.verticalSegment}
- ICP Size: ${formData.icpSize}
- ICP Maturity: ${formData.icpMaturity}
- Pricing Structure: ${formData.pricingStructure}
- Price Tier: ${formData.recurringPriceTier || formData.oneTimePriceTier || formData.hybridRetainerTier || 'N/A'}
- Risk Model: ${formData.riskModel}
- Proof Level: ${formData.proofLevel}
- Fulfillment: ${formData.fulfillmentComplexity}
- ICP Specificity: ${formData.icpSpecificity}
${stabilizationText}${constraintsText}${qualityNote}

Provide 1-2 high-leverage recommendations focused on improving OUTBOUND conversion.
REMEMBER: All recommendations must keep the user IN outbound - never suggest switching channels.`;
}

// ========== FALLBACK RECOMMENDATIONS ==========

function generateFallbackRecommendations(input: AIPrescriptionInput): AIRecommendation[] {
  const { latentBottleneckKey, alignmentScore, formData } = input;
  
  // Category mapping for fallback
  const categoryMap: Record<LatentBottleneckKey, AIRecommendationCategory> = {
    economicHeadroom: 'pricing_shift',
    proofToPromise: 'promise_shift',
    fulfillmentScalability: 'fulfillment_shift',
    riskAlignment: 'risk_shift',
    channelFit: 'channel_shift',
    icpSpecificityStrength: 'icp_shift',
  };
  
  const category = categoryMap[latentBottleneckKey];
  
  // Generate contextual fallback based on bottleneck
  const fallbacksByBottleneck: Record<LatentBottleneckKey, AIRecommendation> = {
    economicHeadroom: {
      id: 'fallback_economic',
      headline: 'Align pricing to market capacity',
      plainExplanation: 'Your pricing may be misaligned with what your target market can afford. Consider adjusting your price point or targeting buyers with higher budgets.',
      actionSteps: [
        'Research what competitors charge in your vertical',
        'Consider hybrid pricing to reduce upfront commitment',
        'Target companies with demonstrated budget capacity',
      ],
      desiredState: 'Price feels like a no-brainer for your ideal buyer',
      category: 'pricing_shift',
    },
    proofToPromise: {
      id: 'fallback_proof',
      headline: 'Match your promise to your proof',
      plainExplanation: 'Your current promise may be too ambitious for the proof you have. Consider scaling back or building more case studies.',
      actionSteps: [
        'Lower your promise to match proven results',
        'Run pilot projects to build documented wins',
        'Collect specific metrics from recent successes',
      ],
      desiredState: 'Every promise backed by concrete evidence',
      category: 'promise_shift',
    },
    fulfillmentScalability: {
      id: 'fallback_fulfillment',
      headline: 'Streamline your delivery model',
      plainExplanation: 'Your current fulfillment approach may not scale efficiently. Consider productizing or systematizing key processes.',
      actionSteps: [
        'Document and template recurring deliverables',
        'Identify which parts can be standardized',
        'Consider adding software/automation layers',
      ],
      desiredState: 'Delivery effort stays flat as client count grows',
      category: 'fulfillment_shift',
    },
    riskAlignment: {
      id: 'fallback_risk',
      headline: 'Adjust risk to match certainty',
      plainExplanation: 'Your risk structure may not align with your proof level. Consider conditional guarantees or milestone-based commitments.',
      actionSteps: [
        'Add conditions to guarantees tied to client effort',
        'Create clear exit points with partial refunds',
        'Build in milestones that demonstrate value early',
      ],
      desiredState: 'Both you and the buyer feel the risk is fair',
      category: 'risk_shift',
    },
    channelFit: {
      id: 'fallback_channel',
      headline: 'Reconsider your go-to-market channel',
      plainExplanation: 'Outbound may not be the optimal channel for this offer. Consider whether inbound, partnerships, or other channels might be more effective.',
      actionSteps: [
        'Test content/inbound to warm up cold prospects',
        'Explore partnership or referral channels',
        'Consider whether the offer needs repositioning for outbound',
      ],
      desiredState: 'Channel matches how your buyers want to buy',
      category: 'channel_shift',
    },
    icpSpecificityStrength: {
      id: 'fallback_icp_specificity',
      headline: 'Narrow your ICP definition',
      plainExplanation: 'Your target market may be too broad for effective outbound. A narrower ICP leads to more relevant messaging and higher conversion.',
      actionSteps: [
        'Identify your most successful client type and double down',
        'Define 3-5 specific qualifying criteria for ideal prospects',
        'Create a "not a fit" list to sharpen focus',
      ],
      desiredState: 'Crystal clear ICP that sales can describe in one sentence',
      category: 'icp_shift',
    },
  };
  
  const fallback = fallbacksByBottleneck[latentBottleneckKey];
  
  // Add a general "not ready" message if score is very low
  if (alignmentScore < 50) {
    return [
      {
        id: 'not_outbound_ready',
        headline: 'This offer is not outbound-ready',
        plainExplanation: 'Multiple fundamental issues need addressing before cold outreach will be effective. Focus on the structural fix below before investing in outbound.',
        actionSteps: [
          'Address the primary bottleneck first',
          'Build proof before scaling outreach',
          'Consider warmer channels while fixing fundamentals',
        ],
        desiredState: 'Offer passes basic market-fit tests',
        category,
      },
      fallback,
    ];
  }
  
  return [fallback];
}

// ========== MAIN AI PRESCRIPTION FUNCTION ==========

export async function generateAIPrescription(input: AIPrescriptionInput): Promise<AIPrescriptionResult> {
  const { alignmentScore, formData, latentScores } = input;
  
  const isOptimizationLevel = alignmentScore >= 80;
  const notOutboundReady = alignmentScore < 50;
  
  // Compute stabilization context for filtering
  const stabilizationContext = input.stabilizationContext || computeStabilizationContext(formData, latentScores);
  
  // Enrich input with stabilization context
  const enrichedInput: AIPrescriptionInput = {
    ...input,
    stabilizationContext,
  };
  
  try {
    // Call AI edge function
    const { data, error } = await supabase.functions.invoke('offer-diagnostic-ai', {
      body: {
        systemPrompt: AI_SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(enrichedInput),
        temperature: 0.2,
      },
    });
    
    if (error) {
      console.error('AI prescription error:', error);
      return {
        recommendations: generateFallbackRecommendations(input),
        isOptimizationLevel,
        notOutboundReady,
        stabilizationApplied: true,
        blockedRecommendations: 0,
      };
    }
    
    // Parse AI response
    const parsed = typeof data.result === 'string' 
      ? JSON.parse(data.result) 
      : data.result;
    
    if (!parsed?.recommendations || !Array.isArray(parsed.recommendations)) {
      throw new Error('Invalid AI response structure');
    }
    
    // Validate, filter, and limit to 2 recommendations
    let blockedCount = 0;
    const rawRecommendations: AIRecommendation[] = parsed.recommendations
      .slice(0, 3)
      .map((rec: any, idx: number) => ({
        id: rec.id || `ai_rec_${idx}`,
        headline: rec.headline || 'Review your offer structure',
        plainExplanation: rec.plainExplanation || 'Consider adjustments to improve alignment.',
        actionSteps: Array.isArray(rec.actionSteps) ? rec.actionSteps.slice(0, 4) : [],
        desiredState: rec.desiredState || 'Improved market fit',
        category: rec.category || 'pricing_shift',
      }));
    
    // Apply stabilization filters (Rules 1-7)
    const filteredRecommendations = rawRecommendations.filter(rec => {
      const filterResult = filterRecommendation(
        rec.headline,
        rec.plainExplanation,
        rec.category,
        stabilizationContext
      );
      
      if (filterResult.isBlocked) {
        console.log(`[Stabilization] Blocked recommendation: "${rec.headline}" — reason: ${filterResult.blockReason}`);
        blockedCount++;
        return false;
      }
      return true;
    });
    
    // Limit to 2 recommendations max (Rule 8: least disruptive)
    const recommendations = filteredRecommendations.slice(0, 2);
    
    // If all recommendations were blocked, return a single safe fallback
    if (recommendations.length === 0) {
      recommendations.push({
        id: 'optimization_mode',
        headline: 'Your offer is well-configured for outbound',
        plainExplanation: 'No major structural changes are needed. Focus on execution: refine messaging, optimize sequences, and improve targeting precision within your current model.',
        actionSteps: [
          'A/B test email subject lines and opening hooks',
          'Refine your ICP list with better firmographic data',
          'Improve follow-up cadence timing',
        ],
        desiredState: 'Consistent outbound performance with incremental improvements',
        category: 'channel_shift',
      });
    }
    
    return {
      recommendations,
      isOptimizationLevel,
      notOutboundReady,
      stabilizationApplied: true,
      blockedRecommendations: blockedCount,
    };
    
  } catch (err) {
    console.error('AI prescription failed:', err);
    return {
      recommendations: generateFallbackRecommendations(input),
      isOptimizationLevel,
      notOutboundReady,
      stabilizationApplied: false,
      blockedRecommendations: 0,
    };
  }
}

// ========== CONVERT AI RECOMMENDATIONS TO STRUCTURED FORMAT ==========

export function convertToStructuredRecommendations(
  aiRecs: AIRecommendation[]
): StructuredRecommendation[] {
  const categoryMap: Record<AIRecommendationCategory, FixCategory> = {
    pricing_shift: 'pricing_shift',
    icp_shift: 'icp_shift',
    promise_shift: 'promise_shift',
    fulfillment_shift: 'fulfillment_shift',
    risk_shift: 'risk_shift',
    channel_shift: 'positioning_shift', // Map channel to positioning for compatibility
  };
  
  return aiRecs.map(rec => ({
    id: rec.id,
    category: categoryMap[rec.category] || 'icp_shift',
    headline: rec.headline,
    plainExplanation: rec.plainExplanation,
    actionSteps: rec.actionSteps,
    desiredState: rec.desiredState,
  }));
}
