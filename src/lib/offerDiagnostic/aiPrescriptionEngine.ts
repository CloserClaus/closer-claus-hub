// ============= AI-Driven Prescription Engine =============
// Generates recommendations using AI based on latent bottlenecks
// Replaces legacy rule-based recommendation engine for final output

import type { DiagnosticFormData, StructuredRecommendation, FixCategory } from './types';
import type { 
  LatentScores, 
  LatentBottleneckKey, 
  ReadinessLabel,
  AIRecommendationCategory,
  BOTTLENECK_ALLOWED_CATEGORIES 
} from './latentScoringEngine';
import { supabase } from '@/integrations/supabase/client';

// ========== AI INPUT PAYLOAD ==========

export interface AIPrescriptionInput {
  alignmentScore: number;
  readinessLabel: ReadinessLabel;
  latentScores: LatentScores;
  latentBottleneckKey: LatentBottleneckKey;
  formData: DiagnosticFormData;
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
}

// ========== SYSTEM PROMPT ==========

const AI_SYSTEM_PROMPT = `You are a senior B2B go-to-market advisor.
Your task is to give founders brutally honest, practical advice
to improve their offer BEFORE they do outbound.

Rules you MUST follow:

1. Base all advice ONLY on the provided inputs and scores.
2. NEVER recommend something the user already has.
   - If proofLevel is Moderate or higher, do NOT suggest "get first clients" or "collect testimonials".
   - If riskModel is Conditional or better, do NOT suggest "add guarantee".
3. Focus ONLY on the primary bottleneck.
4. Do NOT give generic advice.
5. Every recommendation must change ONE structural lever:
   - pricing
   - ICP focus
   - promise scope
   - fulfillment model
   - risk structure
   - channel choice
6. Assume the founder is competent.
7. Do NOT mention scores or numbers in the output.
8. If the offer is fundamentally misaligned, say so directly.

ICP SPECIFICITY RULES (CRITICAL):
- Do NOT assume ICP is broad unless icpSpecificity = "broad"
- Do NOT recommend narrowing ICP if icpSpecificity = "narrow" or "exact"
- Only recommend ICP changes when icpSpecificity is explicitly "broad"

Tone:
Clear. Direct. Consulting-style. No fluff.

IMPORTANT: Return ONLY valid JSON matching this exact schema:
{
  "recommendations": [
    {
      "id": "string",
      "headline": "string (clear, decisive)",
      "plainExplanation": "string (why this matters)",
      "actionSteps": ["string", "string", "string"],
      "desiredState": "string (what good looks like)",
      "category": "pricing_shift" | "icp_shift" | "promise_shift" | "fulfillment_shift" | "risk_shift" | "channel_shift"
    }
  ]
}

Return 1-2 recommendations maximum. Focus on highest-leverage changes targeting the PRIMARY BOTTLENECK only.`;

// ========== BOTTLENECK TO FOCUS MAPPING ==========

const BOTTLENECK_FOCUS_MAP: Record<LatentBottleneckKey, string> = {
  economicHeadroom: 'Focus on pricing structure or ICP targeting. The current price may not match what the target market can afford (Economic Friction is too high).',
  proofToPromise: 'Focus on promise scope. The current promise may be too ambitious for the available proof.',
  fulfillmentScalability: 'Focus on delivery model. The fulfillment approach may not scale reliably.',
  riskAlignment: 'Focus on risk structure. The risk model may not match the proof level.',
  channelFit: 'Focus on channel choice. Outbound may not be the right approach for this offer.',
  icpSpecificityStrength: 'Focus on ICP targeting. The target market definition may be too broad for effective outbound.',
};

// ========== BUILD USER PROMPT ==========

function buildUserPrompt(input: AIPrescriptionInput): string {
  const { alignmentScore, readinessLabel, latentScores, latentBottleneckKey, formData } = input;
  
  const bottleneckFocus = BOTTLENECK_FOCUS_MAP[latentBottleneckKey];
  
  // Build constraints based on existing state
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
  
  const constraintsText = constraints.length > 0 
    ? `\n\nCONSTRAINTS (do not violate):\n${constraints.join('\n')}`
    : '';
  
  let qualityNote = '';
  if (alignmentScore >= 80) {
    qualityNote = '\n\nNOTE: This offer is already strong. Recommendations should be optimization-level, not corrective.';
  } else if (alignmentScore < 50) {
    qualityNote = '\n\nNOTE: This offer has significant issues. Clearly state that the offer is not outbound-ready and focus on the most critical fix.';
  }
  
  return `Evaluate this offer and provide recommendations:

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
${constraintsText}${qualityNote}

Provide 1-3 high-leverage recommendations focused on the primary bottleneck.`;
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
  const { alignmentScore } = input;
  
  const isOptimizationLevel = alignmentScore >= 80;
  const notOutboundReady = alignmentScore < 50;
  
  try {
    // Call AI edge function
    const { data, error } = await supabase.functions.invoke('offer-diagnostic-ai', {
      body: {
        systemPrompt: AI_SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(input),
        temperature: 0.2,
      },
    });
    
    if (error) {
      console.error('AI prescription error:', error);
      return {
        recommendations: generateFallbackRecommendations(input),
        isOptimizationLevel,
        notOutboundReady,
      };
    }
    
    // Parse AI response
    const parsed = typeof data.result === 'string' 
      ? JSON.parse(data.result) 
      : data.result;
    
    if (!parsed?.recommendations || !Array.isArray(parsed.recommendations)) {
      throw new Error('Invalid AI response structure');
    }
    
    // Validate and limit to 3 recommendations
    const recommendations: AIRecommendation[] = parsed.recommendations
      .slice(0, 3)
      .map((rec: any, idx: number) => ({
        id: rec.id || `ai_rec_${idx}`,
        headline: rec.headline || 'Review your offer structure',
        plainExplanation: rec.plainExplanation || 'Consider adjustments to improve alignment.',
        actionSteps: Array.isArray(rec.actionSteps) ? rec.actionSteps.slice(0, 4) : [],
        desiredState: rec.desiredState || 'Improved market fit',
        category: rec.category || 'pricing_shift',
      }));
    
    return {
      recommendations,
      isOptimizationLevel,
      notOutboundReady,
    };
    
  } catch (err) {
    console.error('AI prescription failed:', err);
    return {
      recommendations: generateFallbackRecommendations(input),
      isOptimizationLevel,
      notOutboundReady,
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
