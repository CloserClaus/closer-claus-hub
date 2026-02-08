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

// ========== CALIBRATION HELPERS ==========

function getConfidenceBand(ctx: OfferContext): 'low' | 'medium' | 'high' {
  const score = ctx.latent_alignment_score || 0;
  const proof = ctx.proof_level || 'none';
  const maturity = ctx.icp_maturity || 'early';

  if (score < 40 || ['none', 'weak'].includes(proof) || maturity === 'early') return 'low';
  if (score >= 70 && ['strong', 'category_killer'].includes(proof) && ['scaling', 'mature', 'enterprise'].includes(maturity)) return 'high';
  return 'medium';
}

function getToneCalibration(confidence: 'low' | 'medium' | 'high'): string {
  switch (confidence) {
    case 'low':
      return 'Tone: exploratory, curious, diagnostic. Ask before asserting. Use phrases like "I\'m curious whether..." and "Some teams we talk to find that...". Never assume pain — uncover it.';
    case 'medium':
      return 'Tone: informed, conversational, purposeful. You can reference patterns you\'ve seen but still validate with the prospect. Use phrases like "What we often see is..." and "Does that resonate?"';
    case 'high':
      return 'Tone: direct, confident, specific. Reference concrete outcomes. Use phrases like "We\'ve helped [type] achieve [result]" and "The biggest lever we see is...". Be assertive but not aggressive.';
  }
}

function getDiscoveryCalibration(confidence: 'low' | 'medium' | 'high', bottleneck: string): string {
  if (confidence === 'low') {
    return `Discovery must be exploratory and diagnostic, not aggressive. The caller is learning whether this prospect fits, not assuming they do. Questions should gently probe the prospect's current situation around ${bottleneck} without presupposing pain.`;
  }
  if (confidence === 'high') {
    return `Discovery should emphasize cost of inaction and missed leverage. The caller has earned the right to be direct because the offer has strong proof. Questions should make the gap between current state and potential tangible, especially around ${bottleneck}.`;
  }
  return `Discovery should balance curiosity with insight. Ask questions that demonstrate understanding of their likely situation around ${bottleneck}, but validate rather than assume.`;
}

// ========== TYPE SELECTION LOGIC ==========

function selectOpenerType(ctx: OfferContext): string {
  const proof = ctx.proof_level || 'none';
  const specificity = ctx.icp_specificity || 'broad';
  const maturity = ctx.icp_maturity || 'scaling';
  const risk = ctx.risk_model || 'no_guarantee';

  if (specificity === 'broad' && ['none', 'weak'].includes(proof)) return 'pattern-interrupt';
  if (['strong', 'category_killer'].includes(proof) || specificity === 'exact') return 'context-based';
  if (['mature', 'enterprise'].includes(maturity) || ['conditional_guarantee', 'full_guarantee'].includes(risk)) return 'permission-based';
  return 'permission-based';
}

function selectBridgeType(ctx: OfferContext): string {
  const proof = ctx.proof_level || 'none';
  const risk = ctx.risk_model || 'no_guarantee';

  if (['strong', 'category_killer'].includes(proof)) return 'credibility-anchoring';
  if (['conditional_guarantee', 'full_guarantee', 'performance_only', 'pay_after_results'].includes(risk)) return 'outcome-alignment';
  return 'problem-acknowledgment';
}

function selectDiscoveryType(ctx: OfferContext): string {
  const bottleneck = ctx.latent_bottleneck_key || 'EFI';
  const confidence = getConfidenceBand(ctx);

  // Low confidence always gets problem-first (exploratory)
  if (confidence === 'low') return 'problem-first';
  if (bottleneck === 'EFI') return 'cost-of-inaction';
  if (['proofPromise', 'fulfillmentScalability'].includes(bottleneck)) return 'gap-based';
  return 'problem-first';
}

function selectFrameType(ctx: OfferContext): string {
  const bottleneck = ctx.latent_bottleneck_key || 'EFI';
  const risk = ctx.risk_model || 'no_guarantee';

  if (bottleneck === 'riskAlignment' || ['performance_only', 'pay_after_results'].includes(risk)) return 'reframe-around-risk';
  if (['channelFit', 'icpSpecificity'].includes(bottleneck)) return 'reframe-around-timing';
  return 'reframe-around-leverage';
}

function selectCTAType(ctx: OfferContext): string {
  const confidence = getConfidenceBand(ctx);
  const isOutboundReady = ctx.latent_readiness_label !== 'Weak';

  if (!isOutboundReady) return 'soft';
  if (confidence === 'low') return 'soft';
  if (confidence === 'high') return 'direct';
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

  if (!isOutboundReady) adjusted.cta = 'soft';
  if (specificity === 'broad' && adjusted.opener === 'context-based') adjusted.opener = 'pattern-interrupt';
  if (bottleneck === 'EFI' && adjusted.discovery !== 'cost-of-inaction' && getConfidenceBand(ctx) !== 'low') {
    adjusted.discovery = 'cost-of-inaction';
  }
  if (!isOutboundReady && adjusted.cta === 'direct') adjusted.cta = 'soft';

  return adjusted;
}

// ========== SYSTEM PROMPT BUILDER ==========

function buildSystemPrompt(ctx: OfferContext, types: {
  opener: string; bridge: string; discovery: string; frame: string; cta: string;
}, deliveryMechanism: string): string {
  const isOutboundReady = ctx.latent_readiness_label !== 'Weak';
  const bottleneck = ctx.latent_bottleneck_key || 'EFI';
  const confidence = getConfidenceBand(ctx);
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

  const toneInstruction = getToneCalibration(confidence);
  const discoveryCalibration = getDiscoveryCalibration(confidence, bottleneckLabels[bottleneck] || bottleneck);

  const industry = ctx.icp_industry?.replace(/_/g, ' ') || 'their industry';
  const vertical = ctx.vertical_segment?.replace(/_/g, ' ') || '';
  const maturity = ctx.icp_maturity?.replace(/_/g, ' ') || 'unknown stage';
  const promiseOutcome = ctx.promise_outcome || ctx.promise || 'the promised result';

  return `You are an expert outbound sales script writer. You produce structured, practical scripts for real cold calls.

${modeStatement}

${bottleneckInstruction}

${toneInstruction}

DELIVERY MECHANISM (how the user actually delivers results):
"${deliveryMechanism}"
This is the actual method the user uses. Mirror this language in the script. Do NOT assume or invent execution details beyond what is stated here. If the mechanism is general, keep the script general. If it mentions specific methods (e.g., SEO, ads, AI), reference those specifically.

OFFER CONTEXT:
- Offer Type: ${ctx.offer_type?.replace(/_/g, ' ') || 'Not specified'}
- Promise / Outcome: ${promiseOutcome}
- Industry: ${industry}${vertical ? ` (${vertical})` : ''}
- Company Size: ${ctx.company_size?.replace(/_/g, ' ') || 'Not specified'}
- Business Maturity: ${maturity}
- ICP Specificity: ${ctx.icp_specificity?.replace(/_/g, ' ') || 'Not specified'}
- Pricing: ${ctx.pricing_structure?.replace(/_/g, ' ') || 'Not specified'}
- Risk Model: ${ctx.risk_model?.replace(/_/g, ' ') || 'Not specified'}
- Proof Level: ${ctx.proof_level?.replace(/_/g, ' ') || 'Not specified'}
- Fulfillment: ${ctx.fulfillment?.replace(/_/g, ' ') || 'Not specified'}
- Alignment Score: ${ctx.latent_alignment_score ?? 'Not evaluated'}/100
- Readiness: ${ctx.latent_readiness_label || 'Not evaluated'}
- Confidence Band: ${confidence}

SCRIPT STRUCTURE (exactly 5 sections in this order):

1. OPENER (Type: ${types.opener})
${types.opener === 'permission-based' ? 'Start by asking for permission to share a quick observation. Respectful, non-intrusive.' : ''}
${types.opener === 'context-based' ? `Open with a specific, relevant context point about ${industry} businesses at the ${maturity} stage. Show you understand their world.` : ''}
${types.opener === 'pattern-interrupt' ? 'Open with something unexpected that breaks the usual cold call pattern. Not gimmicky — just different enough to create curiosity.' : ''}

2. BRIDGE (Type: ${types.bridge})
${types.bridge === 'problem-acknowledgment' ? `Acknowledge a specific problem that ${industry} businesses at ${maturity} stage commonly face related to ${promiseOutcome}. Do not pitch.` : ''}
${types.bridge === 'outcome-alignment' ? `Connect the delivery mechanism to a concrete outcome relevant to ${industry}. Brief and direct.` : ''}
${types.bridge === 'credibility-anchoring' ? `Reference a relevant proof point for ${industry} without bragging. Tie it to the delivery mechanism.` : ''}

3. DISCOVERY (Type: ${types.discovery})
${discoveryCalibration}
Questions must directly relate to: ${promiseOutcome} and the ${bottleneckLabels[bottleneck] || bottleneck} constraint.
Questions must reference the prospect's stage (${maturity}), their ICP (${industry}), and the offer outcome.
Do NOT use generic business questions. Every question must be specific to this context.
Include exactly 2-4 questions. No more.

4. FRAME (Type: ${types.frame})
${types.frame === 'reframe-around-risk' ? `Help the prospect see their current approach to ${promiseOutcome} as the riskier option. Reference their stage (${maturity}) and industry (${industry}). Do not pitch.` : ''}
${types.frame === 'reframe-around-leverage' ? `Help the prospect see an underutilized lever in their ${industry} business related to ${promiseOutcome}. Position it as insight specific to ${maturity}-stage businesses, not generic advice.` : ''}
${types.frame === 'reframe-around-timing' ? `Help the prospect see why now is different for ${industry} businesses at the ${maturity} stage. Create urgency through insight specific to their situation, not pressure.` : ''}

5. CALL TO ACTION (Type: ${types.cta})
${types.cta === 'soft' ? 'Low-commitment CTA. Suggest sharing a resource, a quick breakdown, or a no-obligation conversation. Do NOT ask for a meeting or demo.' : ''}
${types.cta === 'conditional' ? 'CTA that depends on what was learned in discovery. If discovery revealed strong fit, suggest a focused conversation. If weak fit, suggest a resource or follow-up.' : ''}
${types.cta === 'direct' ? 'Direct CTA asking for a specific next step — a call, meeting, or demo. Be confident but not pushy.' : ''}

CRITICAL RULES:
- Do NOT rewrite or fix the offer
- Do NOT introduce objection handling
- Do NOT reference internal scores, diagnostics, or bottlenecks
- Do NOT assume execution details not stated in the delivery mechanism
- If the delivery mechanism mentions multiple methods, reflect that breadth — do not over-specify one
- Frames must reference the prospect's stage, ICP, and offer outcome — avoid universal business platitudes
- No emojis, no hype, no sales fluff
- Language must be calm, natural, and confident
- Output one clean script with section headings (use ## for sections)
- No explanations before or after the script
- The script must work as-is for a real outbound call`;
}

function buildProgressionPrompt(ctx: OfferContext, scriptText: string, types: {
  opener: string; bridge: string; discovery: string; frame: string; cta: string;
}, deliveryMechanism: string): string {
  const isOutboundReady = ctx.latent_readiness_label !== 'Weak';
  const bottleneck = ctx.latent_bottleneck_key || 'EFI';
  const confidence = getConfidenceBand(ctx);
  const bottleneckLabels: Record<string, string> = {
    EFI: 'Economic Feasibility',
    proofPromise: 'Proof-to-Promise Credibility',
    fulfillmentScalability: 'Fulfillment Scalability',
    riskAlignment: 'Risk Alignment',
    channelFit: 'Channel Fit',
    icpSpecificity: 'ICP Specificity',
  };

  const industry = ctx.icp_industry?.replace(/_/g, ' ') || 'their industry';
  const maturity = ctx.icp_maturity?.replace(/_/g, ' ') || 'unknown stage';
  const promiseOutcome = ctx.promise_outcome || ctx.promise || 'the promised result';

  const readinessNote = !isOutboundReady
    ? 'CRITICAL: This offer is NOT outbound-ready. Progression rules must emphasize early exits and learning. Do NOT push a close. Every rule should protect the rep\'s time.'
    : '';

  return `You are an expert sales coach writing internal enablement documentation.

Given the following outbound script, create Progression Rules — a contextual rulebook for navigating the conversation.

${readinessNote}

Context: ${industry} businesses at ${maturity} stage. Delivery mechanism: "${deliveryMechanism}". Confidence band: ${confidence}. Primary bottleneck: ${bottleneckLabels[bottleneck] || bottleneck}.

THE SCRIPT:
${scriptText}

STRUCTURE (output in this exact order):

## Rep Guidance Summary
A short 4-line summary that states:
- Who this script is for (the specific ICP: ${industry}, ${maturity} stage, ${ctx.company_size?.replace(/_/g, ' ') || 'various sizes'})
- What success sounds like on this call (tied to ${promiseOutcome})
- When to move forward (key positive signals)
- When to stop (key negative signals)

## 1. Opener Rules
- What a "good" opener response sounds like
- What a "neutral" response sounds like
- What a "bad" response sounds like
- If good → proceed
- If neutral → soften and bridge
- If bad → exit politely

## 2. Discovery Rules
For each discovery question in the script:
- What insight the question is designed to reveal
- What a qualifying answer sounds like
- What a disqualifying answer sounds like
- When to ask the next question
- When to stop discovery early
- When the call should not progress further

## 3. Framing Rules
- What belief the frame is trying to shift
- What confirmation signals indicate the frame landed
- What resistance signals indicate it did not
- When to reinforce the frame
- When to soften the frame
- When to abandon and de-escalate

## 4. Close Decision Rules
- Conditions required to move to the CTA
- Conditions where a follow-up is more appropriate
- Conditions where the call should end without a CTA
- Include: "This is not a loss. This is a correct exit."

## Hard Stop Conditions
List exactly the responses or scenarios where the rep should NOT pitch. Include:
- Explicit disqualifiers (wrong size, wrong stage, no budget authority, no relevant pain)
- Behavioral signals (hostility, complete disinterest, repeated deflection)
- For each, specify the correct action: politely exit, tag as nurture, or defer follow-up
- Frame every exit as professional, not a failure

RULES:
- Do NOT invent new questions
- Do NOT rewrite the script
- Do NOT introduce objections or rebuttals
- Do NOT contradict the offer diagnostic outcome
${!isOutboundReady ? '- Do NOT push a close — the offer is not outbound-ready' : ''}
- Tone: calm, practical, coach-like, non-salesy, non-pushy
- Clear headings, bullet points, no emojis, no filler
- No references to AI or system internals
- Progression rules must protect the rep's time, not just extend conversations
- This should feel like internal enablement documentation`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { offerContext, deliveryMechanism } = await req.json() as { 
      offerContext: OfferContext; 
      deliveryMechanism: string;
    };

    if (!offerContext) {
      return new Response(
        JSON.stringify({ error: "Missing offer context" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!deliveryMechanism || deliveryMechanism.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Delivery mechanism is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating script with confidence band:", getConfidenceBand(offerContext));
    console.log("Delivery mechanism:", deliveryMechanism);

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
    console.log("Selected types after alignment:", JSON.stringify(types));

    // Step 3: Generate script
    const scriptSystemPrompt = buildSystemPrompt(offerContext, types, deliveryMechanism);

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
        max_tokens: 2500,
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
    const progressionPrompt = buildProgressionPrompt(offerContext, scriptText, types, deliveryMechanism);

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
        max_tokens: 3500,
      }),
    });

    let progressionText: string | null = null;
    if (progressionResponse.ok) {
      const progressionData = await progressionResponse.json();
      progressionText = progressionData.choices?.[0]?.message?.content || null;
    } else {
      console.error("Progression rules error:", progressionResponse.status);
    }

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
