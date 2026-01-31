// ============= AI-Driven Prescription Engine =============
// Generates recommendations using AI based on latent bottlenecks
// STRICTLY respects outboundReady and primaryBottleneck with DIMENSION-LOCKED rules

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
  PrimaryBottleneck,
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
  primaryBottleneck: PrimaryBottleneck;
  triggeredHardGates: string[];
  triggeredSoftGates: string[];
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

// ========== SYSTEM PROMPT (STRICT GUARDRAILS - PROMPT 3) ==========

const AI_SYSTEM_PROMPT = `You are a senior B2B go-to-market advisor specializing in OUTBOUND sales readiness.
Your task is to give founders brutally honest, practical advice to improve their offer for OUTBOUND success.

=== CRITICAL: YOU DO NOT COMPUTE ANYTHING ===
- You DO NOT compute scores
- You DO NOT infer bottlenecks
- You DO NOT judge outbound readiness
- You ONLY explain and prescribe based on the EXACT outputs provided

=== ABSOLUTE NON-NEGOTIABLE RULES ===

RULE 1 - OUTBOUND READY FLAG IS IMMUTABLE:
- You MUST treat "outboundReady" as ABSOLUTE TRUTH
- If outboundReady = false → outbound is BLOCKED. State this clearly.
- If outboundReady = true → outbound is PERMITTED
- NEVER contradict the outboundReady flag under any circumstances

RULE 2 - PRIMARY BOTTLENECK IS FACT:
- You MUST treat "primaryBottleneck.dimension" as FACT
- Never challenge it, never suggest a different bottleneck
- ALL recommendations must target the PRIMARY BOTTLENECK only
- Never recommend fixing secondary issues when a primary bottleneck exists

RULE 3 - CHANNEL CONSTRAINT:
- NEVER recommend switching away from outbound if outboundReady = true
- Do NOT suggest inbound, SEO, ads, partnerships, or non-outbound channels
- All recommendations MUST improve outbound performance

RULE 4 - DIMENSION-LOCKED RECOMMENDATIONS (ENFORCED):

If primaryBottleneck.dimension = "EFI":
  ALLOWED: pricing structure, price tier, ICP affordability, unit economics, value framing
  FORBIDDEN: messaging, proof, fulfillment, channel, promise pivots

If primaryBottleneck.dimension = "proofPromise":
  ALLOWED: promise narrowing, proof strengthening, specificity, case studies
  FORBIDDEN: pricing changes, channel pivots, fulfillment pivots

If primaryBottleneck.dimension = "fulfillmentScalability":
  ALLOWED: productization, scope limits, delivery redesign, systemization
  FORBIDDEN: pricing pivots, promise pivots, channel pivots

If primaryBottleneck.dimension = "riskAlignment":
  ALLOWED: guarantee structure, risk framing, milestone-based commitments
  FORBIDDEN: pricing flips, channel pivots, promise changes

If primaryBottleneck.dimension = "channelFit":
  ALLOWED: outbound approach refinement, sales motion, buying behavior analysis
  FORBIDDEN: pricing pivots, risk changes, fulfillment pivots
  NEVER suggest abandoning outbound unless outboundReady = false

If primaryBottleneck.dimension = "icpSpecificity":
  ALLOWED: ICP narrowing, vertical focus, buyer persona clarification
  FORBIDDEN: pricing pivots, fulfillment pivots, promise expansion

RULE 5 - FORBIDDEN RECOMMENDATIONS:
- Do NOT recommend increasing price if EFI < 8
- Do NOT recommend decreasing price if EFI >= 14
- Do NOT recommend productizing if fulfillment is already productized
- Do NOT recommend adding guarantees if a guarantee already exists
- Do NOT recommend "pivoting promise" unless proofPromise is the bottleneck
- Do NOT recommend changes that contradict user's selected inputs
- Do NOT recommend changes already satisfied by the configuration
- Do NOT recommend multiple strategic directions at once
- Do NOT recommend cyclical changes (A → B → A)

=== RECOMMENDATION MODES ===

MODE A — OUTBOUND BLOCKED (outboundReady = false, severity = "blocking"):
- You MUST begin with: "Outbound is currently blocked due to [bottleneck dimension]. Fixing anything else will not unlock results."
- State clearly why outbound is blocked
- Explain the economic or structural reason
- Give EXACTLY 1-2 corrective actions targeting ONLY the primary bottleneck
- Do NOT mention any other improvements or optimizations
- Tone: Direct, urgent, consulting-grade

MODE B — OUTBOUND PERMITTED (outboundReady = true):
- Confirm outbound readiness explicitly
- State the primary constraint (primaryBottleneck.dimension)
- Give EXACTLY 1-2 optimization recommendations
- These are optimizations, NOT prerequisites
- Never suggest pivoting channels

=== OUTPUT FORMAT (STRICT JSON) ===

{
  "headline": "string (clear, decisive summary)",
  "bottleneck": "string (the primaryBottleneck.dimension)",
  "whyThisIsTheConstraint": "string (explain why this specific dimension limits success)",
  "whatToChangeNow": ["string (action 1)", "string (action 2)"],
  "whatNotToChangeYet": ["string (things to leave alone)"],
  "successCriteria": "string (measurable outcome)",
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
- No fluff, no generic advice, no contradictions
- Every recommendation must reference the bottleneck explicitly

Tone: Clear. Direct. Senior consulting-style. Outbound-focused.`;

// ========== BOTTLENECK TO FOCUS MAPPING ==========

const BOTTLENECK_FOCUS_MAP: Record<LatentBottleneckKey, string> = {
  EFI: 'Focus ONLY on pricing structure or ICP targeting. Talk about economic math, affordability, unit economics. Do NOT mention messaging, proof, or fulfillment.',
  proofPromise: 'Focus ONLY on promise scope and proof credibility. Talk about narrowing claims, building evidence. Do NOT mention pricing or channel changes.',
  fulfillmentScalability: 'Focus ONLY on delivery model scalability. Talk about productization, systemization. Do NOT mention pricing, promise, or ICP changes.',
  riskAlignment: 'Focus ONLY on risk structure and guarantees. Talk about risk framing, milestone commitments. Do NOT mention pricing flips or channel pivots.',
  channelFit: 'Focus ONLY on outbound approach refinement. Talk about sales motion and buying behavior. Do NOT suggest abandoning outbound.',
  icpSpecificity: 'Focus ONLY on ICP narrowing and clarification. Talk about vertical focus, buyer personas. Do NOT mention pricing or fulfillment pivots.',
};

// ========== BUILD USER PROMPT ==========

function buildUserPrompt(input: AIPrescriptionInput): string {
  const { 
    alignmentScore, 
    readinessLabel, 
    latentScores, 
    primaryBottleneck, 
    formData, 
    outboundReady,
    triggeredHardGates,
    triggeredSoftGates,
  } = input;
  
  const bottleneckFocus = BOTTLENECK_FOCUS_MAP[primaryBottleneck.dimension];
  
  // Build constraints based on current config (LOOP PREVENTION)
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
  
  if (formData.icpSpecificity === 'exact') {
    constraints.push('- ICP is already highly specific. Do NOT recommend narrowing further.');
  }
  
  // Add EFI-specific constraints
  if (latentScores.EFI < 8 && primaryBottleneck.dimension !== 'EFI') {
    constraints.push('- EFI is low but not primary bottleneck. Do NOT recommend pricing increases.');
  }
  if (latentScores.EFI >= 14) {
    constraints.push('- EFI is healthy. Do NOT recommend pricing decreases.');
  }
  
  const constraintsText = constraints.length > 0 
    ? `\n\nCONSTRAINTS — LOOP PREVENTION (NEVER violate these):\n${constraints.join('\n')}`
    : '';
  
  // Critical outbound status with blocking message
  const outboundStatus = outboundReady
    ? '=== OUTBOUND STATUS: PERMITTED ===\nYou may provide optimization recommendations.'
    : `=== CRITICAL: OUTBOUND IS BLOCKED ===
Severity: ${primaryBottleneck.severity}
Failed Hard Gates: ${triggeredHardGates.join(', ') || 'None'}

You MUST begin your response with:
"Outbound is currently blocked due to ${primaryBottleneck.dimension}. Fixing anything else will not unlock results."

Focus ONLY on fixing the primary bottleneck. Do NOT suggest scaling outbound or optimizing other areas.`;
  
  return `Evaluate this offer for OUTBOUND SALES readiness and provide recommendations:

${outboundStatus}

ALIGNMENT SCORE: ${alignmentScore}/100 (${readinessLabel})

LATENT SCORES (each 0-20):
- EFI (Economic Feasibility): ${latentScores.EFI}/20
- Proof-to-Promise: ${latentScores.proofPromise}/20  
- Fulfillment Scalability: ${latentScores.fulfillmentScalability}/20
- Risk Alignment: ${latentScores.riskAlignment}/20
- Channel Fit: ${latentScores.channelFit}/20
- ICP Specificity: ${latentScores.icpSpecificity}/20

PRIMARY BOTTLENECK: ${primaryBottleneck.dimension}
Severity: ${primaryBottleneck.severity}
Explanation: ${primaryBottleneck.explanation}

DIMENSION LOCK: ${bottleneckFocus}

${triggeredSoftGates.length > 0 ? `SOFT GATES TRIGGERED (warnings): ${triggeredSoftGates.join(', ')}` : ''}

OFFER CONFIGURATION:
- Offer Type: ${formData.offerType}
- Promise: ${formData.promise}
- ICP Industry: ${formData.icpIndustry}
- Vertical Segment: ${formData.verticalSegment}
- ICP Size: ${formData.icpSize}
- ICP Maturity: ${formData.icpMaturity}
- ICP Specificity: ${formData.icpSpecificity}
- Pricing Structure: ${formData.pricingStructure}
- Price Tier: ${formData.recurringPriceTier || formData.oneTimePriceTier || formData.hybridRetainerTier || 'N/A'}
- Risk Model: ${formData.riskModel}
- Proof Level: ${formData.proofLevel}
- Fulfillment: ${formData.fulfillmentComplexity}
${constraintsText}

Provide 1-2 high-leverage recommendations focused ONLY on the PRIMARY BOTTLENECK (${primaryBottleneck.dimension}).

REMEMBER: 
- If outboundReady = false → focus ONLY on unblocking. Start with the required blocking statement.
- If outboundReady = true → focus on optimization
- Never suggest switching channels away from outbound
- Never recommend changes outside the bottleneck dimension`;
}

// ========== FALLBACK RECOMMENDATIONS ==========

function generateFallbackRecommendations(input: AIPrescriptionInput): AIRecommendation[] {
  const { primaryBottleneck, outboundReady } = input;
  
  // Category mapping for fallback
  const categoryMap: Record<LatentBottleneckKey, AIRecommendationCategory> = {
    EFI: 'pricing_shift',
    proofPromise: 'promise_shift',
    fulfillmentScalability: 'fulfillment_shift',
    riskAlignment: 'risk_shift',
    channelFit: 'channel_shift',
    icpSpecificity: 'icp_shift',
  };
  
  const category = categoryMap[primaryBottleneck.dimension];
  
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
    icpSpecificity: {
      id: 'fallback_icp',
      headline: 'Narrow your target market focus',
      plainExplanation: 'A broader ICP makes it harder to build compelling proof and messaging. Consider focusing on a specific vertical or buyer type.',
      actionSteps: [
        'Identify which segment has responded best so far',
        'Build vertical-specific case studies',
        'Tailor messaging to one buyer persona at a time',
      ],
      desiredState: 'You can name 10 specific companies that fit your exact ICP',
      category: 'icp_shift',
    },
  };
  
  const fallback = fallbacksByBottleneck[primaryBottleneck.dimension];
  
  // Add a "blocked" message if not outbound ready
  if (!outboundReady) {
    return [
      {
        id: 'outbound_blocked',
        headline: `Outbound is blocked: ${primaryBottleneck.dimension}`,
        plainExplanation: `Outbound is currently blocked due to ${primaryBottleneck.dimension}. Fixing anything else will not unlock results. This must be resolved before investing in outbound.`,
        actionSteps: [
          'Address the primary bottleneck first',
          'Do not scale outbound until this is fixed',
          'Consider warmer channels while fixing fundamentals',
        ],
        desiredState: 'Offer passes viability gates for outbound',
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
