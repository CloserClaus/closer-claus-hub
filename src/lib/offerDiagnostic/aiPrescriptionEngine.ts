// ============= AI-Driven Prescription Engine =============
// Generates recommendations using AI based on latent bottlenecks
// STRICTLY respects outboundReady and primaryBottleneck

import type { 
  DiagnosticFormData, 
  StructuredRecommendation, 
  FixCategory,
} from './types';
import type { 
  LatentScores, 
  LatentBottleneckKey, 
  ReadinessLabel,
  AIRecommendationCategory,
} from './latentScoringEngine';
import { supabase } from '@/integrations/supabase/client';

// ========== AI INPUT PAYLOAD ==========

export interface AIPrescriptionInput {
  alignmentScore: number;
  readinessLabel: ReadinessLabel;
  latentScores: LatentScores;
  latentBottleneckKey: LatentBottleneckKey;
  formData: DiagnosticFormData;
  outboundReady: boolean;
  primaryBottleneck: string;
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

// ========== SYSTEM PROMPT (STRICT RULES) ==========

const AI_SYSTEM_PROMPT = `You are a senior B2B go-to-market advisor specializing in OUTBOUND sales readiness.
Your task is to give founders brutally honest, practical advice to improve their offer for OUTBOUND success.

=== CRITICAL: YOU DO NOT COMPUTE SCORES ===
- You DO NOT compute scores
- You DO NOT infer bottlenecks
- You DO NOT judge outbound readiness
- You ONLY explain and prescribe based on provided outputs

=== HARD RULES (ABSOLUTE - NEVER VIOLATE) ===

RULE 1 - OUTBOUND READY FLAG:
- You MUST treat "outboundReady" as IMMUTABLE TRUTH
- If outboundReady = false → outbound is BLOCKED, state this clearly
- If outboundReady = true → outbound is PERMITTED
- NEVER contradict the outboundReady flag

RULE 2 - PRIMARY BOTTLENECK:
- You MUST treat "primaryBottleneck" as FACT
- Never challenge it
- Never introduce a different bottleneck
- ALL recommendations must target the PRIMARY BOTTLENECK only

RULE 3 - CHANNEL CONSTRAINT:
- NEVER recommend switching away from outbound if outboundReady = true
- Do NOT suggest inbound, SEO, ads, partnerships, or non-outbound channels
- All recommendations MUST improve outbound performance

RULE 4 - BOTTLENECK-SPECIFIC RECOMMENDATIONS:
If primaryBottleneck = "Economic Feasibility (EFI)":
- Talk ONLY about pricing math, ICP affordability, unit economics
- Never mention messaging, proof, or fulfillment

If primaryBottleneck = "Proof-to-Promise Credibility":
- Talk ONLY about narrowing promise, reframing proof, specificity
- Never recommend changing pricing

If primaryBottleneck = "Fulfillment Scalability":
- Talk ONLY about delivery constraints, leverage, systems
- Never recommend ICP or pricing changes

If primaryBottleneck = "Risk Alignment":
- Talk ONLY about guarantees, downside framing, incentives

If primaryBottleneck = "Channel Fit":
- Talk ONLY about outbound suitability, sales motion, buying behavior
- NEVER suggest abandoning outbound unless outboundReady = false

RULE 5 - FORBIDDEN RECOMMENDATIONS:
- Do NOT recommend increasing price if EFI < 8
- Do NOT recommend decreasing price if EFI >= 14
- Do NOT recommend productizing if fulfillment is already productized
- Do NOT recommend adding guarantees if a guarantee already exists
- Do NOT recommend "pivoting promise" unless Proof-to-Promise is the bottleneck

=== RECOMMENDATION MODES ===

MODE A — OUTBOUND BLOCKED (outboundReady = false):
- State clearly why outbound is blocked
- Explain the economic or structural reason
- Give EXACTLY 1-2 corrective actions
- Actions must ONLY target the primaryBottleneck
- Do NOT mention any other improvements
- Tone: Direct, consulting-grade, non-generic

MODE B — OUTBOUND PERMITTED (outboundReady = true):
- Confirm outbound readiness explicitly
- State the single weakest latent (primaryBottleneck)
- Give EXACTLY 1-2 optimization recommendations
- These are optimizations, NOT prerequisites
- Never suggest pivoting channels

=== OUTPUT FORMAT (STRICT JSON) ===

Return ONLY valid JSON:
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

- Maximum 2 recommendations
- No fluff
- No generic advice
- No contradictions with provided data

Tone: Clear. Direct. Consulting-style. Outbound-focused.`;

// ========== BOTTLENECK TO FOCUS MAPPING ==========

const BOTTLENECK_FOCUS_MAP: Record<LatentBottleneckKey, string> = {
  EFI: 'Focus on pricing structure or ICP targeting. The current price may not match what the target market can afford.',
  proofPromise: 'Focus on promise scope. The current promise may be too ambitious for the available proof.',
  fulfillmentScalability: 'Focus on delivery model. The fulfillment approach may not scale reliably.',
  riskAlignment: 'Focus on risk structure. The risk model may not match the proof level.',
  channelFit: 'Focus on outbound approach. The channel may not be optimal for this offer type.',
};

// ========== BUILD USER PROMPT ==========

function buildUserPrompt(input: AIPrescriptionInput): string {
  const { 
    alignmentScore, 
    readinessLabel, 
    latentScores, 
    latentBottleneckKey, 
    formData, 
    outboundReady,
    primaryBottleneck 
  } = input;
  
  const bottleneckFocus = BOTTLENECK_FOCUS_MAP[latentBottleneckKey];
  
  // Build constraints based on current config
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
  
  if (['package_based', 'software_platform'].includes(formData.fulfillmentComplexity || '')) {
    constraints.push('- Fulfillment is already productized. Do NOT recommend productization.');
  }
  
  const constraintsText = constraints.length > 0 
    ? `\n\nCONSTRAINTS (do not violate):\n${constraints.join('\n')}`
    : '';
  
  // Critical outbound status
  const outboundStatus = outboundReady
    ? '=== OUTBOUND STATUS: READY ===\nYou may provide optimization recommendations.'
    : `=== CRITICAL: OUTBOUND IS BLOCKED ===\nFailed due to: ${primaryBottleneck}\nYou MUST start by acknowledging: "Outbound is blocked due to ${primaryBottleneck}."\nFocus ONLY on fixing this issue. Do NOT suggest scaling outbound.`;
  
  return `Evaluate this offer for OUTBOUND SALES readiness and provide recommendations:

${outboundStatus}

ALIGNMENT SCORE: ${alignmentScore}/100 (${readinessLabel})

LATENT SCORES (each 0-20):
- EFI (Economic Feasibility): ${latentScores.EFI}/20
- Proof-to-Promise: ${latentScores.proofPromise}/20  
- Fulfillment Scalability: ${latentScores.fulfillmentScalability}/20
- Risk Alignment: ${latentScores.riskAlignment}/20
- Channel Fit: ${latentScores.channelFit}/20

PRIMARY BOTTLENECK: ${primaryBottleneck}
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
${constraintsText}

Provide 1-2 high-leverage recommendations focused on the PRIMARY BOTTLENECK.
REMEMBER: 
- If outboundReady = false, focus ONLY on unblocking
- If outboundReady = true, focus on optimization
- Never suggest switching channels away from outbound`;
}

// ========== FALLBACK RECOMMENDATIONS ==========

function generateFallbackRecommendations(input: AIPrescriptionInput): AIRecommendation[] {
  const { latentBottleneckKey, outboundReady, primaryBottleneck } = input;
  
  // Category mapping for fallback
  const categoryMap: Record<LatentBottleneckKey, AIRecommendationCategory> = {
    EFI: 'pricing_shift',
    proofPromise: 'promise_shift',
    fulfillmentScalability: 'fulfillment_shift',
    riskAlignment: 'risk_shift',
    channelFit: 'channel_shift',
  };
  
  const category = categoryMap[latentBottleneckKey];
  
  // Generate contextual fallback based on bottleneck
  const fallbacksByBottleneck: Record<LatentBottleneckKey, AIRecommendation> = {
    EFI: {
      id: 'fallback_efi',
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
    proofPromise: {
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
      headline: 'Optimize your outbound approach',
      plainExplanation: 'Your offer may need repositioning to be more effective via outbound. Consider the buying behavior of your target market.',
      actionSteps: [
        'Test content to warm up cold prospects before outreach',
        'Refine messaging to match how your ICP makes decisions',
        'Consider whether the offer needs repositioning for cold outreach',
      ],
      desiredState: 'Outbound messaging resonates with how your buyers want to buy',
      category: 'channel_shift',
    },
  };
  
  const fallback = fallbacksByBottleneck[latentBottleneckKey];
  
  // Add a "blocked" message if not outbound ready
  if (!outboundReady) {
    return [
      {
        id: 'outbound_blocked',
        headline: `Outbound is blocked: ${primaryBottleneck}`,
        plainExplanation: `This offer cannot succeed with cold outreach until the ${primaryBottleneck} issue is resolved. Focus on the fix below before investing in outbound.`,
        actionSteps: [
          'Address the primary bottleneck first',
          'Do not scale outbound until this is fixed',
          'Consider warmer channels while fixing fundamentals',
        ],
        desiredState: 'Offer passes basic viability gates for outbound',
        category,
      },
      fallback,
    ];
  }
  
  return [fallback];
}

// ========== MAIN AI PRESCRIPTION FUNCTION ==========

export async function generateAIPrescription(input: AIPrescriptionInput): Promise<AIPrescriptionResult> {
  const { alignmentScore, outboundReady } = input;
  
  const isOptimizationLevel = alignmentScore >= 75 && outboundReady;
  const notOutboundReady = !outboundReady;
  
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
    const aiResponse = data?.result;
    
    if (!aiResponse) {
      console.warn('Empty AI response, using fallback');
      return {
        recommendations: generateFallbackRecommendations(input),
        isOptimizationLevel,
        notOutboundReady,
      };
    }
    
    // Handle both object and string responses
    let parsedResponse: { recommendations?: AIRecommendation[] };
    
    if (typeof aiResponse === 'string') {
      try {
        parsedResponse = JSON.parse(aiResponse);
      } catch {
        console.warn('Could not parse AI response as JSON, using fallback');
        return {
          recommendations: generateFallbackRecommendations(input),
          isOptimizationLevel,
          notOutboundReady,
        };
      }
    } else {
      parsedResponse = aiResponse;
    }
    
    const recommendations = parsedResponse.recommendations || [];
    
    // Validate recommendations
    const validatedRecommendations = recommendations
      .filter((rec): rec is AIRecommendation => 
        typeof rec.id === 'string' &&
        typeof rec.headline === 'string' &&
        typeof rec.plainExplanation === 'string' &&
        Array.isArray(rec.actionSteps) &&
        typeof rec.desiredState === 'string' &&
        typeof rec.category === 'string'
      )
      .slice(0, 2); // Maximum 2 recommendations
    
    if (validatedRecommendations.length === 0) {
      console.warn('No valid recommendations in AI response, using fallback');
      return {
        recommendations: generateFallbackRecommendations(input),
        isOptimizationLevel,
        notOutboundReady,
      };
    }
    
    return {
      recommendations: validatedRecommendations,
      isOptimizationLevel,
      notOutboundReady,
    };
    
  } catch (error) {
    console.error('AI prescription failed:', error);
    return {
      recommendations: generateFallbackRecommendations(input),
      isOptimizationLevel,
      notOutboundReady,
    };
  }
}

// ========== CONVERT TO STRUCTURED RECOMMENDATIONS ==========

export function convertToStructuredRecommendations(
  aiRecs: AIRecommendation[]
): StructuredRecommendation[] {
  const categoryToFixCategory: Record<AIRecommendationCategory, FixCategory> = {
    pricing_shift: 'pricing_shift',
    icp_shift: 'icp_shift',
    promise_shift: 'promise_shift',
    fulfillment_shift: 'fulfillment_shift',
    risk_shift: 'risk_shift',
    channel_shift: 'positioning_shift',
  };
  
  return aiRecs.map(rec => ({
    id: rec.id,
    category: categoryToFixCategory[rec.category] || 'positioning_shift',
    headline: rec.headline,
    plainExplanation: rec.plainExplanation,
    actionSteps: rec.actionSteps,
    desiredState: rec.desiredState,
  }));
}
