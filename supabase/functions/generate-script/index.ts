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

  const confidenceBandBlock = getConfidenceBandExplanation(confidence);

  const repFreedomBySection = confidence === 'low'
    ? `REP FREEDOM:
- Opener: Fixed intent AND fixed wording. Read as written.
- Bridge: Fixed intent. Minimal paraphrasing allowed.
- Discovery: Fixed intent AND fixed wording. Ask questions exactly as written.
- Frame: Fixed intent. Wording can be slightly adjusted for natural flow.
- CTA: Fixed intent AND fixed wording.`
    : confidence === 'medium'
    ? `REP FREEDOM:
- Opener: Fixed intent. Wording can be adjusted to sound natural.
- Bridge: Fixed intent. Wording is flexible.
- Discovery: Fixed intent. Reps can rephrase questions as long as they reveal the same insight.
- Frame: Fixed intent. Wording can be adjusted to sound natural.
- CTA: Fixed intent. Wording can be adjusted.`
    : `REP FREEDOM:
- Opener: Intent is a guideline. Rep can customize freely.
- Bridge: Flexible. Rep can use their own credibility anchors.
- Discovery: Intent must be preserved. Rep can ask in their own words or skip if already answered.
- Frame: Flexible. Rep can reframe using their own language.
- CTA: Intent must be preserved. Wording is fully flexible.`;

  return `You are an expert outbound sales script writer. You produce structured, practical scripts for real cold calls that enforce natural conversation pacing.

ANTI-ROBOTIC NOTICE (include this at the very top of the script output):
> This is not meant to be read word-for-word. If you sound unnatural, slow down, paraphrase, and prioritize the conversation.

${confidenceBandBlock}

${repFreedomBySection}

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

=== CRITICAL: TURN-TAKING FORMAT ===

Every section must be written as EXPLICIT SPEAKER TURNS, not paragraphs or monologues. Each turn follows this format:

**Rep:** [One sentence only]
*Intent: [What this line is meant to do]*
*Expected response: [Short acknowledgment / explanation / pushback]*
*(pause — wait for response)*

OR

**Prospect:** [Expected response type, e.g., "Acknowledges / Responds / Pushes back"]

Rules:
1. NO multi-sentence turns for the rep. One sentence maximum per rep turn.
2. After EVERY rep line, include "*(pause — wait for response)*"
3. Between rep lines, indicate what the prospect is expected to do.
4. No single line should be longer than one spoken breath (~15-20 words ideal, 25 max).
5. If an idea is complex, split it across multiple turns.
6. Include inline pacing cues like:
   - *(Say this, then stop.)*
   - *(Let them respond before continuing.)*
   - *(If they interrupt here, acknowledge and continue.)*
7. The script should assume reps will read EXACTLY what is written. Pacing must be explicit.
8. For long or complex lines, add: *(Break this into two sentences if needed.)*

=== SCRIPT STRUCTURE (exactly 5 sections) ===

## 1. Opener (Type: ${types.opener})

The Opener MUST be broken into exactly 3 micro-steps. No exceptions.

**Step 1 — Contact Confirmation**
Rep confirms they're speaking to the right person. One short sentence. Then full stop.
*(pause — wait for response)*

**Step 2 — Context or Relevance Setup**
Rep provides one sentence of context or relevance. Then full stop.
*(pause — wait for response)*

**Step 3 — Permission or Directional Question**
Rep asks one question to gauge interest or get permission to continue. Then full stop.
*(pause — wait for response)*

${types.opener === 'permission-based' ? 'Each step should be respectful and non-intrusive. The permission question in Step 3 is genuine — the rep must be prepared to accept "no."' : ''}
${types.opener === 'context-based' ? `Step 2 should reference a specific, relevant context point about ${industry} businesses at the ${maturity} stage.` : ''}
${types.opener === 'pattern-interrupt' ? 'Step 2 should break the usual cold call pattern — not gimmicky, just different enough to create curiosity.' : ''}

For each step, mark which parts are "fixed intent" vs "flexible wording" based on the confidence band.

## 2. Bridge (Type: ${types.bridge})

Write as 2-3 short turn-based exchanges. Each rep line is one sentence.
${types.bridge === 'problem-acknowledgment' ? `Acknowledge a specific problem that ${industry} businesses at ${maturity} stage commonly face related to ${promiseOutcome}. Do not pitch.` : ''}
${types.bridge === 'outcome-alignment' ? `Connect the delivery mechanism to a concrete outcome relevant to ${industry}. Brief and direct.` : ''}
${types.bridge === 'credibility-anchoring' ? `Reference a relevant proof point for ${industry} without bragging. Tie it to the delivery mechanism.` : ''}

## 3. Discovery (Type: ${types.discovery})

${discoveryCalibration}

Write exactly 2-4 questions in turn-based format. For each question:
- **Rep:** [The question — one sentence]
- *Intent: [What this question reveals]*
- *Expected response: [acknowledgment / detailed answer / deflection]*
- *(pause — wait for response)*
- **Prospect:** [Expected response type]

Questions must directly relate to: ${promiseOutcome} and the ${bottleneckLabels[bottleneck] || bottleneck} constraint.
Questions must reference the prospect's stage (${maturity}), their ICP (${industry}), and the offer outcome.
Do NOT use generic business questions.

If the prospect has already volunteered information that answers a question, note: *(If already answered, skip to next question.)*

## 4. Frame (Type: ${types.frame})

Write as 2-3 turn-based exchanges. The frame helps the prospect reinterpret their situation.
${types.frame === 'reframe-around-risk' ? `Help the prospect see their current approach to ${promiseOutcome} as the riskier option. Reference their stage (${maturity}) and industry (${industry}).` : ''}
${types.frame === 'reframe-around-leverage' ? `Help the prospect see an underutilized lever in their ${industry} business related to ${promiseOutcome}. Position it as insight specific to ${maturity}-stage businesses.` : ''}
${types.frame === 'reframe-around-timing' ? `Help the prospect see why now is different for ${industry} businesses at the ${maturity} stage. Create urgency through insight, not pressure.` : ''}
Do not pitch the product. Frame only.

## 5. Call to Action (Type: ${types.cta})

Write as a turn-based exchange. One sentence CTA, then wait.
${types.cta === 'soft' ? 'Low-commitment CTA. Suggest sharing a resource, a quick breakdown, or a no-obligation conversation. Do NOT ask for a meeting or demo.' : ''}
${types.cta === 'conditional' ? 'CTA that depends on what was learned in discovery. Include: "If [positive signal from discovery], then [stronger ask]. If not, [lighter ask]."' : ''}
${types.cta === 'direct' ? 'Direct CTA asking for a specific next step. Be confident but not pushy. One sentence.' : ''}

=== CRITICAL RULES ===
- Do NOT rewrite or fix the offer
- Do NOT introduce objection handling
- Do NOT reference internal scores, diagnostics, or bottlenecks
- Do NOT assume execution details not stated in the delivery mechanism
- If the delivery mechanism mentions multiple methods, reflect that breadth — do not over-specify one
- Frames must reference the prospect's stage, ICP, and offer outcome — avoid universal business platitudes
- No emojis, no hype, no sales fluff
- Language must be calm, natural, and confident
- Use ## for section headings
- No explanations before or after the script
- The script must work as-is for a real outbound call
- Every rep line must be followed by a pause cue
- No monologues — one sentence per rep turn maximum`;
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

  const confidenceBandRules = confidence === 'low'
    ? `CONFIDENCE BAND: LOW
- Progression rules are MANDATORY. Reps must follow them.
- Every outcome must have a clear next action.
- No room for interpretation — be explicit.`
    : confidence === 'medium'
    ? `CONFIDENCE BAND: MEDIUM
- Progression rules are RECOMMENDED but flexible.
- Reps can adapt based on conversation flow.
- Focus on required OUTCOMES, not exact phrasing.`
    : `CONFIDENCE BAND: HIGH
- Progression rules act as GUARDRAILS only.
- Reps have full freedom to navigate the conversation.
- Rules define boundaries, not paths.`;

  return `You are an expert sales coach writing internal enablement documentation.

Given the following outbound script, create Progression Rules — a contextual rulebook for navigating the conversation.

${readinessNote}

${confidenceBandRules}

Context: ${industry} businesses at ${maturity} stage. Delivery mechanism: "${deliveryMechanism}". Confidence band: ${confidence}. Primary bottleneck: ${bottleneckLabels[bottleneck] || bottleneck}.

THE SCRIPT:
${scriptText}

STRUCTURE (output in this exact order):

## Rep Guidance Summary

Write exactly 4 bullet points:
- **Who this script is for:** [the specific ICP: ${industry}, ${maturity} stage, ${ctx.company_size?.replace(/_/g, ' ') || 'various sizes'}]
- **What success sounds like:** [tied to ${promiseOutcome} — describe the ideal call outcome]
- **When to move forward:** [key positive signals to listen for]
- **When to stop:** [key negative signals — exit with professionalism]

## 1. Opener Rules

For each of the 3 opener micro-steps:
- What a "good" response sounds like
- What a "neutral" response sounds like
- What a "bad" response sounds like

Then clear instructions:
- If good → proceed to next step
- If neutral → soften, acknowledge, and bridge
- If bad → exit politely. Script the exit line.

## 2. Discovery Rules

For each discovery question in the script:
- **What it reveals:** [the specific insight]
- **Qualifying answer:** [what a good answer sounds like]
- **Disqualifying answer:** [what a bad answer sounds like]
- **If already answered:** Confirm and move on. Do not re-ask.
- **When to stop:** [specific signals that mean discovery should end]

General discovery guidance:
- Focus on what must be REVEALED or CONFIRMED
- If the prospect volunteers information, acknowledge and skip redundant questions
- Instead of "Ask Question X" → use "Confirm whether X is true. If already revealed, move on."

## 3. Framing Rules

- **Belief to shift:** [what the frame is trying to change]
- **Confirmation signals:** [frame landed — proceed]
- **Resistance signals:** [frame did not land]
- When to reinforce the frame (one more attempt)
- When to soften the frame (reduce intensity)
- When to abandon the frame and de-escalate (do not force it)

## 4. Close Decision Rules

Do NOT script objections or closes. Define decision thresholds:

- **Conditions to move to CTA:** [what must be true]
- **Conditions for follow-up instead:** [what makes a follow-up better]
- **Conditions to end without CTA:** [when to exit cleanly]

Include: "This is not a loss. This is a correct exit."

## Hard Stop Conditions

List explicit scenarios where the rep should NOT pitch:
- Wrong company size or stage
- No budget authority
- No relevant pain
- Hostility or complete disinterest
- Repeated deflection

For each, specify:
- The correct action (politely exit / tag as nurture / defer follow-up)
- A suggested exit line
- Frame every exit as professional, not failure

RULES:
- Do NOT invent new questions not in the script
- Do NOT rewrite the script
- Do NOT introduce objections or rebuttals
- Do NOT contradict the offer diagnostic outcome
${!isOutboundReady ? '- Do NOT push a close — the offer is not outbound-ready' : ''}
- Tone: calm, practical, coach-like, non-salesy, non-pushy
- Clear headings, bullet points, no emojis, no filler
- No references to AI or system internals
- Progression rules must protect the rep's time, not just extend conversations
- Indicate required OUTCOMES, not exact phrasing
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
