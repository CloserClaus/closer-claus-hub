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

// ========== SYSTEM PROMPT (CALIBRATED - V4) ==========

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
- If outboundReady = true → outbound is PERMITTED. You may ONLY suggest optimizations.
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

=== EFI SEVERITY NORMALIZATION (CALIBRATION RULE) ===

EFI must NOT automatically be treated as a fatal flaw.

IF:
- proofPromise >= 18
- icpSpecificity >= 18
- fulfillmentScalability >= 15

THEN:
- Classify EFI as an OPTIMIZATION bottleneck, not a BLOCKING bottleneck
- Do NOT use existential language such as:
  - "Outbound will fail"
  - "Must be fixed before proceeding"
  - "This offer is not viable"
- Frame EFI fixes as:
  - Margin protection
  - Scale readiness
  - Risk buffering

EFI may only be labeled BLOCKING if:
- EFI <= 5
OR
- EFI <= 8 AND (proofPromise < 12 OR icpSpecificity < 12 OR fulfillmentScalability < 12)

=== PROOF FEELING RULE (TONE CONTROL) ===

Proof strength controls recommendation tone:

IF proofPromise >= 18:
- Use language oriented toward: Scaling, Leverage, Optimization
- FORBIDDEN phrases: "To make this viable", "To avoid failure", "This will not work unless"

IF proofPromise < 12:
- Defensive language is allowed
- Risk-reduction framing is allowed

=== ASSUMPTION-SAFE RECOMMENDATIONS (MANDATORY) ===

You must NOT assume the absence of inputs that are not explicitly collected.
This includes but is not limited to:
- Setup / implementation fees
- Onboarding fees
- Internal price floors
- Tiered pricing
- Existing guarantees

MANDATORY RULE:
Any recommendation involving these must use conditional framing.

Required phrasing:
- "If you are not already doing X..."
- "Many offers at this stage benefit from X. If this is already in place..."

FORBIDDEN phrasing:
- "You should add..."
- "You must increase..."
- "Eliminate your current pricing..."

=== PRICE INCREASE GUARDRAIL ===

You may recommend raising prices ONLY IF at least TWO of the following are true:
- EFI < 10
- channelFit >= 15
- proofPromise >= 15
- icpSpecificity >= 15

If EFI is low but proofPromise or icpSpecificity is weak:
- Prioritize: ICP filtering, Offer narrowing, Risk restructuring, Fulfillment efficiency
- DO NOT recommend price increases

=== DIMENSION-LOCKED RECOMMENDATIONS (ENFORCED) ===

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

=== OFFER-TYPE CONTEXT AWARENESS ===

Before generating recommendations, adapt logic to context:
- Early SaaS founders = cash-sensitive but ROI-driven
- Clinics tolerate setup fees earlier than SaaS
- Brokerages have fragmented buying power
- Local services need immediate ROI visibility
- Info/coaching buyers expect transformation, not deliverables

Do NOT reuse generic outbound heuristics across all offers.

=== RECOMMENDATION STRUCTURE (MANDATORY) ===

Every recommendation MUST follow this structure:
1. Context qualifier - Why this matters for THIS specific offer
2. Conditional acknowledgment - Explicitly acknowledge uncertainty or missing inputs
3. Actionable adjustment - A concrete step to test or refine
4. Goal framing - What this unlocks (margin, predictability, scale, confidence)

Generic advice is FORBIDDEN.

=== RECOMMENDATION MODES ===

MODE A — OUTBOUND BLOCKED (outboundReady = false):
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
  "whyThisIsTheConstraint": "string (context-specific explanation)",
  "whatToChangeNow": ["string (action 1 with conditional framing)", "string (action 2)"],
  "whatNotToChangeYet": ["string (things to leave alone)"],
  "successCriteria": "string (measurable outcome)",
  "recommendations": [
    {
      "id": "string",
      "headline": "string (clear, decisive)",
      "plainExplanation": "string (context qualifier + why this matters for THIS offer)",
      "actionSteps": ["string (with conditional acknowledgment where needed)", "string", "string"],
      "desiredState": "string (goal framing: what good looks like for outbound)",
      "category": "pricing_shift" | "icp_shift" | "promise_shift" | "fulfillment_shift" | "risk_shift" | "channel_shift"
    }
  ]
}

- Maximum 2 recommendations
- No fluff, no generic advice, no contradictions
- Every recommendation must reference the bottleneck explicitly
- Use conditional framing for assumptions

Tone: Clear. Direct. Senior consulting-style. Outbound-focused.`;

// ========== BOTTLENECK TO FOCUS MAPPING (CALIBRATED) ==========

const BOTTLENECK_FOCUS_MAP: Record<LatentBottleneckKey, string> = {
  EFI: 'Focus on pricing structure or ICP targeting. Talk about economic math, affordability, unit economics. Use conditional framing: "If you are not already using setup fees..." Frame as margin protection or scale readiness when other latents are strong.',
  proofPromise: 'Focus on promise scope and proof credibility. Talk about narrowing claims, building evidence. Use conditional framing for case study recommendations. Do NOT mention pricing or channel changes.',
  fulfillmentScalability: 'Focus on delivery model scalability. Talk about productization, systemization. Use conditional framing: "If fulfillment is not already templated..." Do NOT mention pricing, promise, or ICP changes.',
  riskAlignment: 'Focus on risk structure and guarantees. Talk about risk framing, milestone commitments. Use conditional framing for guarantee recommendations. Do NOT mention pricing flips or channel pivots.',
  channelFit: 'Focus on outbound approach refinement. Talk about sales motion and buying behavior. Do NOT suggest abandoning outbound. Use conditional framing for warm-up content recommendations.',
  icpSpecificity: 'Focus on ICP narrowing and clarification. Talk about vertical focus, buyer personas. Do NOT mention pricing or fulfillment pivots. Use conditional framing: "If you are not already focused on a specific vertical..."',
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
  
  // ========== EFI SEVERITY NORMALIZATION ==========
  // Determine if EFI should be treated as optimization vs blocking
  const hasStrongFoundation = 
    latentScores.proofPromise >= 18 && 
    latentScores.icpSpecificity >= 18 && 
    latentScores.fulfillmentScalability >= 15;
  
  const efiIsBlocking = 
    latentScores.EFI <= 5 || 
    (latentScores.EFI <= 8 && (
      latentScores.proofPromise < 12 || 
      latentScores.icpSpecificity < 12 || 
      latentScores.fulfillmentScalability < 12
    ));
  
  const efiSeverityContext = primaryBottleneck.dimension === 'EFI'
    ? hasStrongFoundation && !efiIsBlocking
      ? 'EFI is an OPTIMIZATION concern (strong foundation). Frame as margin protection, scale readiness, or risk buffering. Do NOT use existential language.'
      : efiIsBlocking
        ? 'EFI is a BLOCKING concern. Address directly but acknowledge what IS working.'
        : 'EFI needs attention but is not fatal. Balance urgency with practical framing.'
    : '';
  
  // ========== PRICE INCREASE GUARDRAIL ==========
  // Count conditions for price increase recommendations
  const priceIncreaseConditions = [
    latentScores.EFI < 10,
    latentScores.channelFit >= 15,
    latentScores.proofPromise >= 15,
    latentScores.icpSpecificity >= 15,
  ].filter(Boolean).length;
  
  const canRecommendPriceIncrease = priceIncreaseConditions >= 2;
  
  // ========== PROOF FEELING RULE (TONE CONTROL) ==========
  const proofToneContext = latentScores.proofPromise >= 18
    ? 'TONE: Strong proof exists. Use scaling/optimization language. FORBIDDEN: "To make this viable", "To avoid failure", "This will not work unless"'
    : latentScores.proofPromise < 12
      ? 'TONE: Proof is weak. Defensive/risk-reduction language is appropriate.'
      : 'TONE: Moderate proof. Balanced language between optimization and risk mitigation.';
  
  // ========== OFFER-TYPE CONTEXT ==========
  const offerTypeContext = getOfferTypeContext(formData.offerType, formData.icpIndustry);
  
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
  
  // EFI-specific constraints
  if (latentScores.EFI < 8 && primaryBottleneck.dimension !== 'EFI') {
    constraints.push('- EFI is low but not primary bottleneck. Do NOT recommend pricing increases.');
  }
  if (latentScores.EFI >= 14) {
    constraints.push('- EFI is healthy. Do NOT recommend pricing decreases.');
  }
  
  // Price increase guardrail
  if (!canRecommendPriceIncrease && primaryBottleneck.dimension === 'EFI') {
    constraints.push('- PRICE INCREASE BLOCKED: Not enough supporting conditions. Focus on ICP filtering, offer narrowing, risk restructuring, or fulfillment efficiency instead.');
  }
  
  // Assumption-safe constraints
  constraints.push('- Use CONDITIONAL FRAMING for any assumptions about setup fees, onboarding fees, tiered pricing, etc.');
  constraints.push('- Required phrasing: "If you are not already doing X..." or "Many offers at this stage benefit from X..."');
  constraints.push('- FORBIDDEN phrasing: "You should add...", "You must increase...", "Eliminate your current pricing..."');
  
  const constraintsText = constraints.length > 0 
    ? `\n\nCONSTRAINTS — LOOP PREVENTION & CALIBRATION (NEVER violate these):\n${constraints.join('\n')}`
    : '';
  
  // Critical outbound status with blocking message
  const outboundStatus = outboundReady
    ? '=== OUTBOUND STATUS: PERMITTED ===\nYou may provide optimization recommendations only. Do NOT contradict this status.'
    : `=== CRITICAL: OUTBOUND IS BLOCKED ===
Severity: ${primaryBottleneck.severity}
Failed Hard Gates: ${triggeredHardGates.join(', ') || 'None'}

You MUST begin your response with:
"Outbound is currently blocked due to ${primaryBottleneck.dimension}. Fixing anything else will not unlock results."

Focus ONLY on fixing the primary bottleneck. Do NOT suggest scaling outbound or optimizing other areas.`;
  
  return `Evaluate this offer for OUTBOUND SALES readiness and provide recommendations:

${outboundStatus}

${proofToneContext}

${efiSeverityContext ? `EFI SEVERITY CONTEXT: ${efiSeverityContext}` : ''}

${offerTypeContext ? `OFFER-TYPE CONTEXT: ${offerTypeContext}` : ''}

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
- If outboundReady = true → focus on optimization only
- Never suggest switching channels away from outbound
- Never recommend changes outside the bottleneck dimension
- Use conditional framing for assumptions about setup fees, onboarding fees, tiered pricing, etc.`;
}

// ========== OFFER-TYPE CONTEXT HELPER ==========

function getOfferTypeContext(offerType: string | null, icpIndustry: string | null): string {
  const contexts: Record<string, string> = {
    'demand_creation': 'Demand creation offers: Buyers expect brand building and awareness. ROI is longer-term. Outbound works best with warm-up content.',
    'demand_capture': 'Demand capture offers: Buyers are searching for solutions. Speed and immediate ROI matter. Outbound should emphasize quick wins.',
    'outbound_sales_enablement': 'Sales enablement offers: Buyers understand outbound. They want proof of volume and efficiency gains. Direct ROI claims work well.',
    'retention_monetization': 'Retention/monetization offers: Buyers have existing customers. LTV and churn reduction are key metrics. Outbound should reference customer base size.',
    'operational_enablement': 'Operational offers: Buyers want efficiency and compliance. Cost savings and time saved are key metrics. Outbound should lead with operational pain.',
  };
  
  const industryContexts: Record<string, string> = {
    'local_services': 'Local services: Cash-sensitive, need immediate ROI visibility. Setup fees can be challenging.',
    'professional_services': 'Professional services: Value expertise, can tolerate premium pricing. Proof of similar clients matters.',
    'saas_tech': 'SaaS/Tech: Cash-sensitive early-stage, ROI-driven. Founders expect fast payback periods.',
    'healthcare': 'Healthcare: Compliance matters, can tolerate setup fees. Decision cycles are longer.',
    'real_estate': 'Real estate: Fragmented buying power, deal-based thinking. Performance pricing resonates.',
    'information_coaching': 'Info/Coaching: Buyers expect transformation, not deliverables. Proof of outcomes is critical.',
    'dtc_ecommerce': 'DTC/Ecommerce: ROAS-focused, need quick wins. Data and metrics drive decisions.',
    'b2b_service_agency': 'B2B Agencies: Understand services, price-shop. Differentiation through proof is key.',
  };
  
  const offerContext = offerType ? contexts[offerType] || '' : '';
  const industryContext = icpIndustry ? industryContexts[icpIndustry] || '' : '';
  
  return [offerContext, industryContext].filter(Boolean).join(' | ');
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
  
  // Generate contextual fallback based on bottleneck (CALIBRATED with conditional framing)
  const fallbacksByBottleneck: Record<LatentBottleneckKey, AIRecommendation> = {
    EFI: {
      id: 'fallback_efi',
      headline: 'Protect margins by aligning pricing to ICP capacity',
      plainExplanation: 'For this specific offer configuration, pricing may be creating friction with your target market. This is about margin protection and scale readiness, not fundamental viability.',
      actionSteps: [
        'If you are not already using setup or implementation fees, consider adding a one-time onboarding component',
        'If targeting smaller companies, consider whether your price point matches their typical investment capacity',
        'Many offers at this stage benefit from hybrid pricing structures that reduce upfront commitment',
      ],
      desiredState: 'Price feels proportionate to the value delivered for your specific ICP',
      category: 'pricing_shift',
    },
    proofPromise: {
      id: 'fallback_proof',
      headline: 'Strengthen the bridge between promise and evidence',
      plainExplanation: 'For your offer type and ICP, the gap between what you promise and what you can prove may be creating hesitation. This is about credibility alignment.',
      actionSteps: [
        'If you do not already have vertical-specific case studies, consider running a pilot with documented metrics',
        'Consider narrowing your promise to match your strongest proven outcomes',
        'If you have existing wins, ensure they are formatted as proof points prospects can verify',
      ],
      desiredState: 'Every claim you make in outreach has a corresponding piece of evidence',
      category: 'promise_shift',
    },
    fulfillmentScalability: {
      id: 'fallback_fulfillment',
      headline: 'Increase delivery leverage for sustainable scale',
      plainExplanation: 'Your current fulfillment approach may limit how many clients you can serve profitably. This is about creating leverage, not cutting corners.',
      actionSteps: [
        'If you are not already using templated deliverables, identify which 20% of your process creates 80% of value',
        'If delivery is heavily customized, consider whether a productized tier could work for a segment of your ICP',
        'Many offers at this stage benefit from clear scope boundaries that protect your capacity',
      ],
      desiredState: 'Adding a new client does not proportionally increase your workload',
      category: 'fulfillment_shift',
    },
    riskAlignment: {
      id: 'fallback_risk',
      headline: 'Align risk structure with your proof level',
      plainExplanation: 'Your risk model may not match buyer expectations for offers at your proof level. This is about finding the right balance between confidence and protection.',
      actionSteps: [
        'If you do not already have a conditional guarantee, consider one tied to client compliance',
        'If you have a full guarantee, ensure the conditions are clearly documented',
        'Many offers at this stage benefit from milestone-based commitments that build trust incrementally',
      ],
      desiredState: 'Both you and the buyer feel the risk distribution is fair',
      category: 'risk_shift',
    },
    channelFit: {
      id: 'fallback_channel',
      headline: 'Optimize your outbound motion for buyer behavior',
      plainExplanation: 'For your ICP and offer type, the outbound approach may need refinement to match how your buyers prefer to engage. Outbound is still the right channel.',
      actionSteps: [
        'If you are not already using warm-up content, consider adding value before the ask',
        'Review whether your messaging matches how your ICP makes purchasing decisions',
        'If your offer requires education, consider whether the outbound sequence allows for it',
      ],
      desiredState: 'Outbound messaging aligns with how your specific ICP wants to buy',
      category: 'channel_shift',
    },
    icpSpecificity: {
      id: 'fallback_icp',
      headline: 'Sharpen your target market focus',
      plainExplanation: 'A broader ICP makes it harder to build compelling proof and resonant messaging. This is about concentration of force, not limiting opportunity.',
      actionSteps: [
        'If you are not already focused on a specific vertical, identify which segment has responded best',
        'Consider whether your proof and messaging speak to a specific buyer persona',
        'Many offers at this stage benefit from temporary narrowing to build a beachhead',
      ],
      desiredState: 'You can name 10 specific companies that fit your exact ideal profile',
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
