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

function getConfidenceBandExplanation(band: 'low' | 'medium' | 'high'): string {
  switch (band) {
    case 'low':
      return `**CONFIDENCE BAND: LOW — Follow the script closely**

Script adherence is strict. Follow the wording closely with minimal improvisation. Progression rules are mandatory. This offer needs more proof or refinement before reps can safely go off-script.`;
    case 'medium':
      return `**CONFIDENCE BAND: MEDIUM — Use the script as a strong guide**

The script is a strong guide, not a word-for-word mandate. Reps can paraphrase as long as the intent of each line is preserved. Progression rules are recommended but flexible.`;
    case 'high':
      return `**CONFIDENCE BAND: HIGH — Use the script as a reference framework**

This offer has strong proof and clear positioning. Reps can customize language freely while keeping the structure. Progression rules act as guardrails, not requirements.`;
  }
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
  const bottleneckLabels: Record<string, string> = {
    EFI: 'Economic Feasibility',
    proofPromise: 'Proof-to-Promise Credibility',
    fulfillmentScalability: 'Fulfillment Scalability',
    riskAlignment: 'Risk Alignment',
    channelFit: 'Channel Fit',
    icpSpecificity: 'ICP Specificity',
  };

  const industry = ctx.icp_industry?.replace(/_/g, ' ') || 'their industry';
  const vertical = ctx.vertical_segment?.replace(/_/g, ' ') || '';
  const maturity = ctx.icp_maturity?.replace(/_/g, ' ') || 'unknown stage';
  const promiseOutcome = ctx.promise_outcome || ctx.promise || 'the promised result';

  const modeStatement = !isOutboundReady
    ? 'This offer is NOT outbound-ready. The script is for exploration and learning. The CTA must be low-commitment. Do NOT push a close.'
    : 'This offer is outbound-ready. The script should be confident and purposeful.';

  return `You are writing a cold call talk track for a beginner sales rep. They will read this VERBATIM on live calls.

=== ABSOLUTE RULES ===

1. Output ONLY what the rep should say out loud. Nothing else.
2. NO intent labels, NO "(pause)" instructions, NO "wait for response" cues, NO coaching text, NO expected responses, NO confidence bands.
3. Each line must be ONE sentence max. Short. Conversational. Interruptible.
4. Leave a BLANK LINE between each rep line — this is where the prospect naturally responds. Do not write prospect lines.
5. The script must feel human and slightly incomplete — NOT polished, NOT memorized-sounding.
6. Write like a good SDR talks, not like a sales trainer explains.
7. No flow control, no branching logic, no objection handling in the script.
8. No emojis, no hype, no sales fluff, no jargon.
9. Each section should have 2-4 short lines max. No paragraphs.
10. If delivery mechanism is vague, keep language outcome-focused. Do not invent specifics.

${modeStatement}

DELIVERY MECHANISM: "${deliveryMechanism}"
Mirror this language. Do NOT assume details beyond what is stated.

OFFER CONTEXT:
- Offer Type: ${ctx.offer_type?.replace(/_/g, ' ') || 'Not specified'}
- Promise / Outcome: ${promiseOutcome}
- Industry: ${industry}${vertical ? ` (${vertical})` : ''}
- Company Size: ${ctx.company_size?.replace(/_/g, ' ') || 'Not specified'}
- Business Maturity: ${maturity}
- Pricing: ${ctx.pricing_structure?.replace(/_/g, ' ') || 'Not specified'}
- Risk Model: ${ctx.risk_model?.replace(/_/g, ' ') || 'Not specified'}
- Proof Level: ${ctx.proof_level?.replace(/_/g, ' ') || 'Not specified'}
- Primary Constraint: ${bottleneckLabels[bottleneck] || bottleneck}

=== SCRIPT STRUCTURE (exactly 5 sections, use ## headings) ===

## 1. Opener (Type: ${types.opener})

2-3 short lines max. First line confirms the person. Second line gives one sentence of context. Third line asks one question.
${types.opener === 'permission-based' ? 'Respectful, non-intrusive. The question is genuine.' : ''}
${types.opener === 'context-based' ? `Reference something relevant about ${industry} at ${maturity} stage.` : ''}
${types.opener === 'pattern-interrupt' ? 'Break the usual cold call pattern — curious, not gimmicky.' : ''}

## 2. Bridge (Type: ${types.bridge})

1-2 lines that connect to a problem or outcome. No pitching.
${types.bridge === 'problem-acknowledgment' ? `Acknowledge a problem ${industry} businesses at ${maturity} stage face related to ${promiseOutcome}.` : ''}
${types.bridge === 'outcome-alignment' ? `Connect delivery mechanism to an outcome relevant to ${industry}.` : ''}
${types.bridge === 'credibility-anchoring' ? `Reference a proof point for ${industry}. Brief, no bragging.` : ''}

## 3. Discovery (Type: ${types.discovery})

2-3 questions the rep asks. Each question is one line. Leave blank lines between them for prospect responses.
Questions must relate to ${promiseOutcome} and ${bottleneckLabels[bottleneck] || bottleneck}.
Questions must reference the prospect's stage (${maturity}) and industry (${industry}).
No generic business questions. Be specific to this offer.

## 4. Frame (Type: ${types.frame})

1-2 lines that help the prospect see their situation differently. No pitching.
${types.frame === 'reframe-around-risk' ? `Help them see their current approach to ${promiseOutcome} as the riskier option.` : ''}
${types.frame === 'reframe-around-leverage' ? `Point out an underutilized lever in ${industry} related to ${promiseOutcome}.` : ''}
${types.frame === 'reframe-around-timing' ? `Create urgency through insight, not pressure, for ${industry} at ${maturity} stage.` : ''}

## 5. Call to Action (Type: ${types.cta})

One line. Clear next step.
${types.cta === 'soft' ? 'Low-commitment: offer a resource, breakdown, or quick no-obligation chat. Do NOT ask for a meeting.' : ''}
${types.cta === 'conditional' ? 'Suggest a next step based on what was discussed. Keep it natural.' : ''}
${types.cta === 'direct' ? 'Ask for a specific next step. Confident, not pushy.' : ''}

=== FINAL CHECK ===
- Every line must be speakable in one breath
- No meta-commentary whatsoever
- No teaching, explaining, or stage-setting
- Output the script and nothing else`;
}

function buildProgressionPrompt(ctx: OfferContext, scriptText: string, types: {
  opener: string; bridge: string; discovery: string; frame: string; cta: string;
}, deliveryMechanism: string): string {
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

  const industry = ctx.icp_industry?.replace(/_/g, ' ') || 'their industry';
  const maturity = ctx.icp_maturity?.replace(/_/g, ' ') || 'unknown stage';
  const promiseOutcome = ctx.promise_outcome || ctx.promise || 'the promised result';
  const riskModel = ctx.risk_model?.replace(/_/g, ' ') || 'no guarantee';
  const proofLevel = ctx.proof_level?.replace(/_/g, ' ') || 'none';

  const readinessNote = !isOutboundReady
    ? '⚠️ This offer is NOT outbound-ready. Rules must emphasize early exits and learning. Do NOT push a close.'
    : '';

  // Context-aware practical guidance
  const contextGuidance: string[] = [];
  if (['none', 'weak'].includes(ctx.proof_level || 'none')) {
    contextGuidance.push('Prospect may ask for proof or references. Be honest — focus on the process and logic, not results you can\'t back up yet.');
  }
  if (['full_guarantee', 'conditional_guarantee'].includes(ctx.risk_model || '')) {
    contextGuidance.push('You have a guarantee to lean on. Use it if the prospect seems hesitant about risk.');
  }
  if (ctx.risk_model === 'no_guarantee') {
    contextGuidance.push('Prospect may be skeptical of guarantees. Emphasize control and optionality instead.');
  }
  if (ctx.icp_maturity === 'early') {
    contextGuidance.push('This prospect is likely early-stage. They may not have a defined process for this yet. Be exploratory, not prescriptive.');
  }
  if (['mature', 'enterprise'].includes(ctx.icp_maturity || '')) {
    contextGuidance.push('This prospect likely has existing vendors or processes. Acknowledge that — position as complement or upgrade, not replacement.');
  }

  return `You are writing a decision playbook for a beginner sales rep. They will read this BEFORE or DURING calls to know how to navigate conversations.

${readinessNote}

=== ABSOLUTE RULES ===

1. No sales jargon. No abstract theory. No long explanations.
2. No confidence bands or confidence labels.
3. No dialogue or script lines — those belong in the Script tab only.
4. Use short bullets and simple conditional phrasing: "If they say X → do Y"
5. No dense paragraphs. Everything must be scannable.
6. No emojis, no filler.

Context: ${industry} businesses at ${maturity} stage. Delivery: "${deliveryMechanism}". Primary constraint: ${bottleneckLabels[bottleneck] || bottleneck}. Proof level: ${proofLevel}. Risk model: ${riskModel}.

${contextGuidance.length > 0 ? `PRACTICAL CONTEXT:\n${contextGuidance.map(g => `- ${g}`).join('\n')}` : ''}

THE SCRIPT (for reference only — do NOT repeat script lines):
${scriptText}

=== OUTPUT STRUCTURE (use ## headings) ===

## Before You Call

3-4 bullets max:
- Who this script is for (specific ICP: ${industry}, ${maturity} stage)
- What a good call sounds like (tied to ${promiseOutcome})
- When to keep going vs. when to stop

## Opener Rules

For each opener line in the script, define signal ranges:
- **Strong signal:** They engage, ask a question back, or acknowledge → Keep going
- **Weak signal:** Short answers, distracted, noncommittal → Try one more line, then gauge
- **Disqualifying signal:** Hostile, immediate "not interested," wrong person → Exit politely

What must be true before moving to Bridge:
- State it as: "Move forward only if ___"

## Discovery Rules

For each discovery question, define:
- **Why you're asking this** (one sentence)
- **Strong signal:** What a good answer sounds like → What to do next
- **Weak signal:** Vague or unclear answer → Try once more or rephrase
- **Disqualifying signal:** Clear mismatch → Exit politely
- **If already answered:** Skip and confirm what you heard

What must be true before moving to Frame:
- "Move forward only if ___"

## Framing Rules

For the frame section:
- **What you're trying to shift** (one sentence)
- **If this lands cleanly** → Continue to CTA
- **If this creates resistance** → Soften once, then let it go
- **If they push back hard** → Do not force it. Exit gracefully.

## Close Decision

Do NOT script objections. Define thresholds:
- **Go to CTA if:** [conditions]
- **Suggest follow-up instead if:** [conditions]
- **End the call if:** [conditions]

Frame every exit as professional, not failure: "This is a correct exit."

## Hard Stops

List 4-5 scenarios where the rep should NOT continue:
For each:
- What it looks like
- What to do (exit / tag as nurture / defer)
- A simple exit phrase

=== FINAL CHECK ===
- No script lines repeated
- No confidence labels
- No jargon or theory
- Every rule reads like: "If X → do Y"
- A beginner can scan this in 60 seconds and feel prepared`;
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

    const confidence = getConfidenceBand(offerContext);
    console.log("Generating script with confidence band:", confidence);
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
          { role: "user", content: "Generate the outbound sales script now. Output only the script with section headings. Follow the turn-taking format exactly. No preamble." },
        ],
        temperature: 0.3,
        max_tokens: 4000,
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
        max_tokens: 4000,
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
        confidenceBand: confidence,
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
