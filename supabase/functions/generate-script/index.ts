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

  return `You are writing a cold call script for a BEGINNER sales rep who will read this VERBATIM on live calls. This is their very first cold call.

=== WHAT THIS SCRIPT IS ===

This script helps a nervous, beginner rep survive a cold call long enough to earn 2–3 minutes of attention and book a meeting.

It is NOT a pitch, sales framework, qualification tool, or offer explanation.

Success means ONE of these:
- The prospect gives permission to continue for another 30–120 seconds
- The prospect answers at least one real question
- The prospect accepts a meeting
- The rep exits cleanly without creating hostility

=== ASSUMPTIONS ABOUT THE PROSPECT ===

- They are distracted, mildly irritated, and ready to hang up
- They do not know who is calling or why
- They will interrupt at any point

=== ASSUMPTIONS ABOUT THE REP ===

- They are nervous and speaking slightly fast
- They may forget lines under pressure
- They need lines that work even if read imperfectly

=== WHAT THE SCRIPT MUST NEVER DO ===

- Fully explain the offer
- Convince or persuade the prospect
- Diagnose problems deeply
- Teach sales frameworks or theory
- Assume pain, problems, or internal state
- Mention databases, numbers, thresholds, margins, or systems
- Sound rehearsed, consultant-like, or pitchy when read out loud
- Include any line longer than one sentence
- Include monologues or stacked questions

=== CONTEXT (for calibration only — NEVER expose in script) ===

- Industry: ${industry}${vertical ? ` (${vertical})` : ''}
- Business Maturity: ${maturity}
- Promise / Outcome: ${promiseOutcome}
- Delivery Mechanism: "${deliveryMechanism}"

=== OUTPUT FORMAT ===

Generate the script as a turn-based ADAPTIVE SKELETON — short base lines with branching follow-ups based on likely prospect responses.

Use ## headings for each beat. Under each beat, output:
- The exact line the rep says (as a bold **Rep:** prefix)
- Then 2–3 short "If → then" branches for likely prospect responses

=== BEATS (in this exact order) ===

## 1. Attention Capture
- 1 short line only (under 7 seconds spoken)
- Purpose: confirm you're speaking to the right person without triggering defensiveness
- Must NOT ask "is this the owner?" or anything authority-threatening
- Must sound natural when interrupted
- Must NOT identify the company yet
- Must end with a soft handoff, not a question that invites a hard "no"
- Include: If prospect responds neutrally → next line. If rushed → fallback line. If confused → clarification line.

## 2. Identity + Context
- 1 short line
- Purpose: give a vague, non-threatening reason for the call
- No company explanation, no selling, no claims
- Should feel like a reason, not a pitch
- Must describe the category of problem, not the solution
- Then immediately move to permission check

## 3. Permission Check
- Ask for time explicitly
- Time request must be small (10–20 seconds)
- Must include an easy out
- Must be phrased as a choice between continuing briefly or stopping
- Must NOT ask "Is this a good time?"

## 4. Relevance Anchor (Read Verbatim)
- This section sits BETWEEN the Permission Check and the first discovery question.
- Purpose: link the prospect's likely current behavior to a hidden cost or missed outcome. Make them pause and mentally check if this applies to them.
- It must be 1–2 sentences MAX.
- It must be inferred from the Offer Diagnostic context and ICP — NOT generic.
- It must reference a pattern ("what we usually see with [ICP type] at this stage") rather than a personal claim about them.
- It must NOT accuse, exaggerate, or threaten.
- It must end with a soft confirmation question that CANNOT be answered with a clean "no" without thought.
- Example pattern (do NOT copy verbatim): "What we usually see with [ICP] at this stage is [common behavior], which quietly leads to [non-obvious cost]. I'm not sure if that's true for you yet."
- This REPLACES any generic bridge or filler explanation.

## 5. Test Question 1
- Only ONE question that directly tests whether the Relevance Anchor is true for this prospect.
- Must feel safe to answer.
- Must not imply the prospect is doing something wrong.
- Must allow the prospect to talk within 10 seconds.
- Include 2–3 "If → then" branches based on likely responses.

## 6. Test Question 2 (optional)
- Only include if it adds value. Max ONE additional question.
- Must build on what was revealed by Test Question 1.
- Must not stack or repeat.
- Include 1–2 "If → then" branches.
- If this question is not needed, skip this section entirely.

## 7. Earned Next Step (Read Verbatim)
- This is NOT a generic meeting ask. It is an "Earned Decision Frame."
- Structure (all 3 parts mandatory):
  1. **Reflection** (1 sentence): Reflect back something the prospect just confirmed. Start with "Based on what you said about [confirmed issue]…"
  2. **Reason** (1 sentence): Connect that to a specific outcome or leverage point. "That's usually where teams see [specific outcome]."
  3. **Choice** (1 question): Offer two valid paths — continue or park it. Example: "Does it make more sense to look at how this would work for your setup, or should we leave it here for now?"
- The CTA must reference at least one confirmed insight from the Relevance Anchor or Test Questions.
- Must NOT ask for a "meeting" or "demo" directly.
- Must NOT use hype, urgency, or scarcity.
- Must NOT re-explain the offer.
- Branching:
  - If they choose to continue → "We can walk through this in 10 minutes — would later today or tomorrow work better?"
  - If they choose to park it → exit politely, no resistance, no reframing.
  - If they override a "leave it" → do NOT override. Accept and exit.

=== QUALITY CONTROL (MANDATORY) ===

Before finalizing, verify the script passes ALL of these:

1. Contains a concrete spoken opener line (not a placeholder)
2. Contains a clear reason-for-calling line (one sentence, plain language, no jargon)
3. Contains a Relevance Anchor that is specific to the ICP/industry, not generic
4. Contains Test Question 1 that directly tests the Relevance Anchor
5. Contains an Earned Next Step with Reflection + Reason + Choice structure
6. Tone is consistent throughout — no line sounds senior if others sound junior
7. No line sounds like marketing copy or could appear in a blog post
8. Every line survives interruption at any point
9. Every line is speakable in one breath
10. No stacked questions anywhere
11. No more than 2 discovery questions before offering the next step
12. Total script feels intentionally incomplete — it earns time, nothing more

If any check fails, rewrite the failing line before outputting.

=== ANTI-AI FILTER ===

If any line sounds like marketing copy, uses abstract language, or could appear in a blog post → rewrite it into spoken, casual language.

When unsure whether to be more specific or more flexible:
→ More specific in language
→ More flexible in flow

=== FINAL OUTPUT RULES ===

- Use ## headings for each beat (7 max, 6 if Test Question 2 is skipped)
- No explanations, no intent labels, no meta commentary, no "(pause)" instructions
- No emojis, no hype, no sales fluff, no jargon
- Output the script and nothing else.`;
}

// ========== DECISION PLAYBOOK PROMPT ==========

function buildPlaybookPrompt(ctx: OfferContext, scriptText: string, deliveryMechanism: string): string {
  const industry = ctx.icp_industry?.replace(/_/g, ' ') || 'their industry';
  const maturity = ctx.icp_maturity?.replace(/_/g, ' ') || 'unknown stage';

  return `You are writing a behavior guide for a BEGINNER sales rep. They will read this BEFORE or DURING cold calls.

=== PHILOSOPHY ===

The goal of the call is NOT to qualify, diagnose, frame, or pitch.
The only goal is to earn permission to continue the conversation — step by step, not all at once.

This playbook guides BEHAVIOR, not decisions.
It exists so the rep knows what to pay attention to and when to stop pushing.
It is NOT required to run the call — the script alone should work.

=== TONE RULES ===

- Beginner-safe, calm, permission-first
- No hype, no pressure language
- No sales jargon or abstract theory
- Simple language a first-time rep can scan in 30 seconds

=== ABSOLUTE RULES ===

1. No confidence bands or confidence labels
2. No dialogue or script lines — those belong in the Script tab only
3. No numeric thresholds (e.g. 200 leads, 500 leads)
4. No qualification criteria or economic feasibility checks
5. No outcome promises or CTA logic
6. No "Hard stop" rules based on assumptions
7. No database size assumptions
8. No pre-call goals that cannot be known on a cold call
9. Nothing the rep cannot verify in real time
10. Use short bullets. Everything must be scannable.
11. No emojis, no filler.

Context: ${industry} businesses at ${maturity} stage. Delivery: "${deliveryMechanism}".

THE SCRIPT (for reference only — do NOT repeat script lines):
${scriptText}

=== OUTPUT STRUCTURE (exactly 6 sections, use ## headings) ===

## Primary Objective

- One sentence only.
- Objective: Get verbal permission to continue past the first 30 seconds.
- Must NOT mention leads, databases, numbers, or outcomes.

## What Success Looks Like

- List exactly 3 signals.
- Signals must be conversational, not logical.
- Focus on what the rep is trying to EARN next (time, attention, permission).
- Examples: curiosity, neutral engagement, asking "what is this about?", prospect answering a question willingly.

## What Failure Looks Like

- List exactly 3 signals.
- Signals must be emotional, not analytical.
- Focus on what resistance SOUNDS like.
- Examples: irritation, repeated "who is this?", silence, abrupt tone, audible sigh.

## Rep Behavior Rules

- Use short bullets.
- Must include ALL of the following:
  - Speak slower than feels natural
  - Stop talking the moment resistance appears
  - Never explain more when confused — ask permission instead
  - Never ask a question that advances the sale without permission
  - If a line sounds wrong in your mouth, skip it and move to the next beat
  - When in doubt, hand control back to the prospect

## Next-Move Logic

- If permission is granted → proceed to discovery (outside this script)
- If permission is denied → exit politely, no second attempt
- If unclear → ask for permission again in a shorter form
- If prospect engages with the question → stay curious, don't pitch
- If prospect gives a short dismissive answer → offer to follow up another time

## Why the Earned Next Step Works

- Explain in 3–4 short bullets why the CTA in the script uses a Reflection + Reason + Choice structure.
- Write for a beginner rep in plain language.
- Key points to cover:
  - Reflecting back what they said makes them feel heard
  - Giving a reason makes the next step feel logical, not pushy
  - Offering a choice gives them control, which reduces resistance
  - If they say "leave it," accepting immediately builds trust for future contact

=== QUALITY CONTROL ===

Before finalizing, verify:
1. No script lines are repeated from the Script tab
2. No jargon or abstract theory
3. No numeric thresholds or qualification criteria
4. Every bullet is actionable by a nervous beginner
5. A rep can scan this in 30 seconds and feel more confident
6. The "Why the Earned Next Step Works" section is present and beginner-friendly

=== FINAL OUTPUT RULES ===

- Exactly 6 sections with ## headings. No more.
- No preamble, no summary, no closing remarks.`;
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
          { role: "user", content: "Generate the cold call script now. Output the 7 beats (or 6 if Test Question 2 is skipped) with ## headings. Include adaptive branches under each beat. No preamble. No extra sections." },
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
          { role: "user", content: "Generate the decision playbook now. Output only the 6 sections with headings. No preamble." },
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
