import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OfferContext {
  offer_type: string | null;
  promise: string | null;
  promise_outcome: string | null;
  icp_industry: string | null;
  vertical_segment: string | null;
  company_size: string | null;
  icp_maturity: string | null;
  icp_specificity: string | null;
  pricing_structure: string | null;
  price_tier: string | null;
  recurring_price_tier: string | null;
  one_time_price_tier: string | null;
  hybrid_retainer_tier: string | null;
  performance_basis: string | null;
  performance_comp_tier: string | null;
  proof_level: string | null;
  risk_model: string | null;
  fulfillment: string | null;
  latent_alignment_score: number | null;
  latent_readiness_label: string | null;
  latent_bottleneck_key: string | null;
  latent_economic_headroom: number | null;
  latent_proof_to_promise: number | null;
  latent_fulfillment_scalability: number | null;
  latent_risk_alignment: number | null;
  latent_channel_fit: number | null;
  latent_icp_specificity: number | null;
}

// ========== TYPE SELECTION LOGIC ==========

function selectOpenerType(ctx: OfferContext): string {
  const proof = ctx.proof_level || 'none';
  const specificity = ctx.icp_specificity || 'broad';
  const maturity = ctx.icp_maturity || 'scaling';
  const risk = ctx.risk_model || 'no_guarantee';

  // Pattern-interrupt for broad ICP with weak proof - need to break through noise
  if (specificity === 'broad' && ['none', 'weak'].includes(proof)) {
    return 'pattern-interrupt';
  }
  // Context-based for strong proof or narrow/exact ICP - leverage credibility
  if (['strong', 'category_killer'].includes(proof) || specificity === 'exact') {
    return 'context-based';
  }
  // Permission-based for mature/enterprise ICPs with risk sensitivity
  if (['mature', 'enterprise'].includes(maturity) || ['conditional_guarantee', 'full_guarantee'].includes(risk)) {
    return 'permission-based';
  }
  return 'permission-based';
}

function selectBridgeType(ctx: OfferContext): string {
  const proof = ctx.proof_level || 'none';
  const risk = ctx.risk_model || 'no_guarantee';
  const promise = ctx.promise || '';

  // Credibility anchoring when proof is strong
  if (['strong', 'category_killer'].includes(proof)) {
    return 'credibility-anchoring';
  }
  // Outcome alignment when promise is clear and risk model reduces friction
  if (['conditional_guarantee', 'full_guarantee', 'performance_only', 'pay_after_results'].includes(risk)) {
    return 'outcome-alignment';
  }
  // Problem acknowledgment as default
  return 'problem-acknowledgment';
}

function selectDiscoveryType(ctx: OfferContext): string {
  const bottleneck = ctx.latent_bottleneck_key || 'EFI';
  const promise = ctx.promise || '';

  // Cost-of-inaction when EFI is the bottleneck - need to justify spend
  if (bottleneck === 'EFI') {
    return 'cost-of-inaction';
  }
  // Gap-based when proof or fulfillment is the bottleneck
  if (['proofPromise', 'fulfillmentScalability'].includes(bottleneck)) {
    return 'gap-based';
  }
  // Problem-first as default
  return 'problem-first';
}

function selectFrameType(ctx: OfferContext): string {
  const bottleneck = ctx.latent_bottleneck_key || 'EFI';
  const risk = ctx.risk_model || 'no_guarantee';

  // Reframe around risk when risk alignment is the issue
  if (bottleneck === 'riskAlignment' || ['performance_only', 'pay_after_results'].includes(risk)) {
    return 'reframe-around-risk';
  }
  // Reframe around timing for channel fit or ICP specificity issues
  if (['channelFit', 'icpSpecificity'].includes(bottleneck)) {
    return 'reframe-around-timing';
  }
  // Reframe around leverage as default
  return 'reframe-around-leverage';
}

function selectCTAType(ctx: OfferContext): string {
  const isOutboundReady = ctx.latent_readiness_label !== 'Weak';
  const score = ctx.latent_alignment_score || 0;

  if (!isOutboundReady || score < 40) {
    return 'soft';
  }
  if (score >= 70) {
    return 'direct';
  }
  return 'conditional';
}

// ========== ALIGNMENT CHECK ==========

function runAlignmentCheck(ctx: OfferContext, types: {
  opener: string; bridge: string; discovery: string; frame: string; cta: string;
}): { opener: string; bridge: string; discovery: string; frame: string; cta: string } {
  const adjusted = { ...types };
  const isOutboundReady = ctx.latent_readiness_label !== 'Weak';
  const bottleneck = ctx.latent_bottleneck_key || 'EFI';
  const specificity = ctx.icp_specificity || 'broad';

  // Rule 1: Outbound readiness gate
  if (!isOutboundReady) {
    adjusted.cta = 'soft';
  }

  // Rule 4: Opener must align with ICP specificity
  if (specificity === 'broad' && adjusted.opener === 'context-based') {
    adjusted.opener = 'pattern-interrupt';
  }

  // Rule 4: Discovery must align with bottleneck
  if (bottleneck === 'EFI' && adjusted.discovery !== 'cost-of-inaction') {
    adjusted.discovery = 'cost-of-inaction';
  }

  // Rule 4: CTA must align with readiness
  if (!isOutboundReady && adjusted.cta === 'direct') {
    adjusted.cta = 'soft';
  }

  return adjusted;
}

// ========== SYSTEM PROMPT BUILDER ==========

function buildSystemPrompt(ctx: OfferContext, types: {
  opener: string; bridge: string; discovery: string; frame: string; cta: string;
}): string {
  const isOutboundReady = ctx.latent_readiness_label !== 'Weak';
  const bottleneck = ctx.latent_bottleneck_key || 'EFI';
  const bottleneckLabels: Record<string, string> = {
    EFI: 'Economic Feasibility',
    proofPromise: 'Proof-to-Promise Credibility',
    fulfillmentScalability: 'Fulfillment Scalability',
    riskAlignment: 'Risk Alignment',
    channelFit: 'Channel Fit',
    icpSpecificity: 'ICP Specificity',
  };

  const validationMode = !isOutboundReady;
  const modeStatement = validationMode
    ? 'This script is for validation, not scaling. The offer is NOT yet outbound-ready. The CTA must be low-commitment. Emphasize learning over closing.'
    : 'This offer is outbound-ready. The script should be confident and purposeful.';

  const bottleneckInstruction = `The primary constraint is ${bottleneckLabels[bottleneck] || bottleneck}. This must dominate discovery depth, framing, and CTA aggressiveness. Do NOT let secondary issues override this.`;

  return `You are an expert outbound sales script writer. You produce structured, practical scripts for real cold calls.

${modeStatement}

${bottleneckInstruction}

OFFER CONTEXT:
- Offer Type: ${ctx.offer_type || 'Not specified'}
- Promise: ${ctx.promise_outcome || ctx.promise || 'Not specified'}
- Industry: ${ctx.icp_industry || 'Not specified'}
- Vertical: ${ctx.vertical_segment || 'Not specified'}
- Company Size: ${ctx.company_size || 'Not specified'}
- Business Maturity: ${ctx.icp_maturity || 'Not specified'}
- ICP Specificity: ${ctx.icp_specificity || 'Not specified'}
- Pricing: ${ctx.pricing_structure || 'Not specified'}
- Risk Model: ${ctx.risk_model || 'Not specified'}
- Proof Level: ${ctx.proof_level || 'Not specified'}
- Fulfillment: ${ctx.fulfillment || 'Not specified'}
- Alignment Score: ${ctx.latent_alignment_score ?? 'Not evaluated'}
- Readiness: ${ctx.latent_readiness_label || 'Not evaluated'}

SCRIPT STRUCTURE (exactly 5 sections in this order):

1. OPENER (Type: ${types.opener})
${types.opener === 'permission-based' ? 'Start by asking for permission to share a quick observation. Respectful, non-intrusive.' : ''}
${types.opener === 'context-based' ? 'Open with a specific, relevant context point about their industry or situation. Show you have done homework.' : ''}
${types.opener === 'pattern-interrupt' ? 'Open with something unexpected that breaks the usual cold call pattern. Not gimmicky — just different enough to create curiosity.' : ''}

2. BRIDGE (Type: ${types.bridge})
${types.bridge === 'problem-acknowledgment' ? 'Acknowledge a specific problem their type of business commonly faces. Do not pitch.' : ''}
${types.bridge === 'outcome-alignment' ? 'Connect what you do to a concrete outcome they care about. Brief and direct.' : ''}
${types.bridge === 'credibility-anchoring' ? 'Reference a relevant proof point (result, client type, or outcome) without bragging.' : ''}

3. DISCOVERY (Type: ${types.discovery})
${types.discovery === 'problem-first' ? 'Ask 2-3 questions that uncover the core problem your offer solves.' : ''}
${types.discovery === 'gap-based' ? 'Ask 2-3 questions that reveal the gap between where they are and where they want to be.' : ''}
${types.discovery === 'cost-of-inaction' ? 'Ask 2-3 questions that make the cost of doing nothing tangible and real.' : ''}
Questions must directly relate to: ${ctx.promise_outcome || ctx.promise || 'the core offer promise'} and the ${bottleneckLabels[bottleneck] || bottleneck} constraint.
Include exactly 2-4 questions. No more.

4. FRAME (Type: ${types.frame})
${types.frame === 'reframe-around-risk' ? 'Help the prospect see their current approach as the riskier option. Do not pitch your product.' : ''}
${types.frame === 'reframe-around-leverage' ? 'Help the prospect see an underutilized lever in their business. Position it as insight, not sales.' : ''}
${types.frame === 'reframe-around-timing' ? 'Help the prospect see why now is different or better than later. Create urgency through insight, not pressure.' : ''}

5. CALL TO ACTION (Type: ${types.cta})
${types.cta === 'soft' ? 'Low-commitment CTA. Suggest sharing a resource, a quick breakdown, or a no-obligation conversation. Do NOT ask for a meeting or demo.' : ''}
${types.cta === 'conditional' ? 'CTA that depends on what was learned in discovery. If discovery revealed strong fit, suggest a focused conversation. If weak fit, suggest a resource.' : ''}
${types.cta === 'direct' ? 'Direct CTA asking for a specific next step — a call, meeting, or demo.' : ''}

RULES:
- Do NOT rewrite or fix the offer
- Do NOT introduce objection handling
- Do NOT reference internal scores, diagnostics, or bottlenecks
- Do NOT assume things the user did not input
- No emojis, no hype, no sales fluff
- Language must be calm, natural, and confident
- Output one clean script with section headings
- No explanations before or after the script
- The script must work as-is for a real outbound call`;
}

function buildProgressionPrompt(ctx: OfferContext, scriptText: string, types: {
  opener: string; bridge: string; discovery: string; frame: string; cta: string;
}): string {
  const isOutboundReady = ctx.latent_readiness_label !== 'Weak';
  const bottleneck = ctx.latent_bottleneck_key || 'EFI';
  const bottleneckLabels: Record<string, string> = {
    EFI: 'Economic Feasibility',
    proofPromise: 'Proof-to-Promise Credibility',
    fulfillmentScalability: 'Fulfillment Scalability',
    riskAlignment: 'Risk Alignment',
    channelFit: 'Channel Fit',
    icpSpecificity: 'ICP Specificity',
  };

  const readinessNote = !isOutboundReady
    ? 'IMPORTANT: This offer is NOT outbound-ready. Progression rules must emphasize early exits and learning. Do NOT push a close.'
    : '';

  return `You are an expert sales coach writing internal enablement documentation.

Given the following outbound script, create Progression Rules — a contextual rulebook that tells the caller how to move forward based on how the conversation unfolds.

${readinessNote}

Primary bottleneck: ${bottleneckLabels[bottleneck] || bottleneck}

THE SCRIPT:
${scriptText}

STRUCTURE (exactly 4 sections):

1. OPENER RULES
- What a "good" response sounds like
- What a "neutral" response sounds like
- What a "bad" response sounds like
- If good → proceed
- If neutral → soften and bridge
- If bad → exit politely

2. DISCOVERY RULES
For each discovery question in the script:
- What insight the question reveals
- What a qualifying answer sounds like
- What a disqualifying answer sounds like
- When to ask the next question
- When to stop discovery early
- When the call should not progress further

3. FRAMING RULES
- What belief the frame is trying to shift
- What confirmation signals indicate the frame landed
- What resistance signals indicate it did not
- When to reinforce the frame
- When to soften the frame
- When to abandon and de-escalate

4. CLOSE DECISION RULES
- Conditions required to move to the CTA
- Conditions where a follow-up is more appropriate
- Conditions where the call should end without a CTA
- Include: "This is not a loss. This is a correct exit."

RULES:
- Do NOT invent new questions
- Do NOT rewrite the script
- Do NOT introduce objections or rebuttals
- Do NOT contradict the offer diagnostic outcome
${!isOutboundReady ? '- Do NOT push a close — the offer is not outbound-ready' : ''}
- Tone: calm, practical, coach-like, non-salesy, non-pushy
- Clear headings, bullet points, no emojis, no filler
- No references to AI or system internals
- This should feel like internal enablement documentation`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offerContext } = await req.json() as { offerContext: OfferContext };

    if (!offerContext) {
      return new Response(
        JSON.stringify({ error: "Missing offer context" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Step 1: Select types
    const rawTypes = {
      opener: selectOpenerType(offerContext),
      bridge: selectBridgeType(offerContext),
      discovery: selectDiscoveryType(offerContext),
      frame: selectFrameType(offerContext),
      cta: selectCTAType(offerContext),
    };

    // Step 2: Run alignment check
    const types = runAlignmentCheck(offerContext, rawTypes);

    // Step 3: Generate script
    const scriptSystemPrompt = buildSystemPrompt(offerContext, types);

    const scriptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: scriptSystemPrompt },
          { role: "user", content: "Generate the outbound sales script now. Output only the script with section headings. No preamble." },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!scriptResponse.ok) {
      const errorText = await scriptResponse.text();
      console.error("Script generation error:", scriptResponse.status, errorText);
      if (scriptResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (scriptResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`Script generation failed: ${scriptResponse.status}`);
    }

    const scriptData = await scriptResponse.json();
    const scriptText = scriptData.choices?.[0]?.message?.content || '';

    if (!scriptText) {
      throw new Error("No script content returned");
    }

    // Step 4: Generate progression rules
    const progressionPrompt = buildProgressionPrompt(offerContext, scriptText, types);

    const progressionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: progressionPrompt },
          { role: "user", content: "Generate the progression rules now. Output only the rules with section headings. No preamble." },
        ],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });

    if (!progressionResponse.ok) {
      const errorText = await progressionResponse.text();
      console.error("Progression rules error:", progressionResponse.status, errorText);
      // Return script without progression rules if second call fails
      return new Response(
        JSON.stringify({
          script: scriptText,
          progressionRules: null,
          types,
          isValidationMode: offerContext.latent_readiness_label === 'Weak',
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const progressionData = await progressionResponse.json();
    const progressionText = progressionData.choices?.[0]?.message?.content || '';

    return new Response(
      JSON.stringify({
        script: scriptText,
        progressionRules: progressionText,
        types,
        isValidationMode: offerContext.latent_readiness_label === 'Weak',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in generate-script:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
