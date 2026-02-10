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

function getConfidenceBand(ctx: OfferContext): 'low' | 'medium' | 'high' {
  const score = ctx.latent_alignment_score || 0;
  const proof = ctx.proof_level || 'none';
  const maturity = ctx.icp_maturity || 'early';

  if (score < 40 || ['none', 'weak'].includes(proof) || maturity === 'early') return 'low';
  if (score >= 70 && ['strong', 'category_killer'].includes(proof) && ['scaling', 'mature', 'enterprise'].includes(maturity)) return 'high';
  return 'medium';
}

// ========== SCRIPT SYSTEM PROMPT ==========

function buildSystemPrompt(ctx: OfferContext, deliveryMechanism: string): string {
  const industry = ctx.icp_industry?.replace(/_/g, ' ') || 'their industry';
  const vertical = ctx.vertical_segment?.replace(/_/g, ' ') || '';
  const maturity = ctx.icp_maturity?.replace(/_/g, ' ') || 'unknown stage';
  const promiseOutcome = ctx.promise_outcome || ctx.promise || 'the promised result';

  return `You are writing a cold call opening script for a beginner sales rep. They will read this VERBATIM on live calls.

=== WHAT A SCRIPT IS ===

A script is NOT a full sales conversation.
A script is ONLY the minimum language required to earn the next 10–20 seconds of attention.
The script's ONLY objectives are:
1. Reduce defensiveness
2. Check relevance
3. Ask permission to continue

The script must feel intentionally incomplete. It must stop immediately after permission is asked. Total spoken time must be under 15 seconds.

=== WHAT A SCRIPT MUST NEVER DO ===

- Diagnose problems
- Assume pain
- Explain the offer in detail
- Qualify the prospect
- Mention databases, numbers, thresholds, margins, or systems
- Include discovery questions
- Include framing statements
- Include value explanations
- Include calls to action beyond asking permission
- Include qualification logic

=== RULES FOR EVERY LINE ===

- One short sentence only
- Speakable in one breath
- Easy to interrupt
- Must not sound like a salesperson
- No emojis, no hype, no sales fluff, no jargon
- No meta-commentary, no coaching text, no "(pause)" instructions

=== CONTEXT (for calibration only — do NOT expose in script) ===

- Industry: ${industry}${vertical ? ` (${vertical})` : ''}
- Business Maturity: ${maturity}
- Promise / Outcome: ${promiseOutcome}
- Delivery Mechanism: "${deliveryMechanism}"

=== OUTPUT STRUCTURE (exactly 3 sections, use ## headings) ===

## 1. Attention Capture

- Purpose: Sound human and non-threatening.
- Must be 1 short sentence.
- Must NOT identify the company yet.
- Must NOT ask a question that triggers defense.
- Must NOT sound like a pitch.
- Example patterns (do not copy verbatim): name confirmation, casual acknowledgment.

## 2. Relevance Check

- Purpose: Give a vague, non-threatening reason for the call.
- Must be 1 short sentence.
- Must describe the category of problem, not the solution.
- Must avoid claims, outcomes, or mechanisms.
- Must NOT assume they have a problem.
- Must be interruptible without breaking flow.

## 3. Permission to Continue

- Purpose: Hand control to the prospect without giving them an easy "no."
- Must be phrased as a choice between continuing briefly or stopping.
- Must be time-bound (e.g. "20 seconds" or "quick question").
- Must NOT ask "Is this a good time?"
- Must NOT invite evaluation of the offer.
- Must be 1 sentence.

=== FINAL CHECK ===

- Exactly 3 sections. No more.
- No section exceeds 1 sentence.
- Total script is under 15 seconds of spoken time.
- The script feels intentionally incomplete.
- No discovery, no framing, no value props, no CTAs beyond permission.
- Output the script and nothing else.`;
}

// ========== DECISION PLAYBOOK PROMPT ==========

function buildPlaybookPrompt(ctx: OfferContext, scriptText: string, deliveryMechanism: string): string {
  const industry = ctx.icp_industry?.replace(/_/g, ' ') || 'their industry';
  const maturity = ctx.icp_maturity?.replace(/_/g, ' ') || 'unknown stage';

  return `You are writing a decision playbook for a beginner sales rep. They will read this BEFORE or DURING calls to guide their behavior.

=== PHILOSOPHY ===

The goal of the call is NOT to qualify, diagnose, frame, or pitch.
The only goal is to earn permission to continue the conversation.

This playbook exists to guide behavior, not decisions.

=== ABSOLUTE RULES ===

1. No sales jargon. No abstract theory. No long explanations.
2. No confidence bands or confidence labels.
3. No dialogue or script lines — those belong in the Script tab only.
4. No numeric thresholds (e.g. 200 leads, 500 leads).
5. No qualification criteria.
6. No economic feasibility checks.
7. No outcome promises.
8. No CTA logic.
9. No "Hard stop" rules based on assumptions.
10. Use short bullets. Everything must be scannable.
11. No emojis, no filler.

Context: ${industry} businesses at ${maturity} stage. Delivery: "${deliveryMechanism}".

THE SCRIPT (for reference only — do NOT repeat script lines):
${scriptText}

=== OUTPUT STRUCTURE (exactly 5 sections, use ## headings) ===

## Primary Objective

- One sentence only.
- Objective: Get verbal permission to continue past the first 30 seconds.
- Must NOT mention leads, databases, numbers, or outcomes.

## What Success Looks Like

- List exactly 3 signals.
- Signals must be conversational, not logical.
- Examples: curiosity, neutral engagement, asking "what is this about?"

## What Failure Looks Like

- List exactly 3 signals.
- Signals must be emotional, not analytical.
- Examples: irritation, repeated "who is this?", silence, abrupt tone.

## Rep Behavior Rules

- Use short bullets.
- Must include:
  - Speak slower than feels natural.
  - Stop talking the moment resistance appears.
  - Never explain more when confused — ask permission instead.
  - Never ask a question that advances the sale without permission.

## Next-Move Logic

- If permission is granted → proceed to discovery (outside this script).
- If permission is denied → exit politely.
- If unclear → ask for permission again in a shorter form.

=== FINAL CHECK ===

- Exactly 5 sections. No more.
- No script lines repeated.
- No jargon or theory.
- No numeric thresholds or qualification criteria.
- A beginner can scan this in 30 seconds and feel prepared.`;
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

    // Step 1: Generate script (3 sections only)
    const scriptSystemPrompt = buildSystemPrompt(offerContext, deliveryMechanism);

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
          { role: "user", content: "Generate the cold call opening script now. Output only the 3 sections with headings. No preamble. No extra sections." },
        ],
        temperature: 0.3,
        max_tokens: 1000,
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

    // Step 2: Generate decision playbook
    const playbookPrompt = buildPlaybookPrompt(offerContext, scriptText, deliveryMechanism);

    const playbookResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: playbookPrompt },
          { role: "user", content: "Generate the decision playbook now. Output only the 5 sections with headings. No preamble." },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    let playbookText: string | null = null;
    if (playbookResponse.ok) {
      const playbookData = await playbookResponse.json();
      playbookText = playbookData.choices?.[0]?.message?.content || null;
    } else {
      console.error("Playbook generation error:", playbookResponse.status);
    }

    // Types kept for backward compat but simplified
    const types = {
      opener: 'attention-capture',
      bridge: 'relevance-check',
      discovery: 'permission',
      frame: 'n/a',
      cta: 'n/a',
    };

    return new Response(
      JSON.stringify({
        script: scriptText,
        progressionRules: playbookText,
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
