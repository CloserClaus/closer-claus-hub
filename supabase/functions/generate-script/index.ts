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

function fmt(val: string | null | undefined): string {
  return val?.replace(/_/g, ' ') || '';
}

function resolvePriceTier(ctx: OfferContext): string {
  const ps = ctx.pricing_structure || '';
  if (ps.includes('recurring')) return fmt(ctx.recurring_price_tier) || fmt(ctx.price_tier) || 'unknown';
  if (ps.includes('one_time') || ps.includes('project')) return fmt(ctx.one_time_price_tier) || fmt(ctx.price_tier) || 'unknown';
  if (ps.includes('hybrid') || ps.includes('retainer')) return fmt(ctx.hybrid_retainer_tier) || fmt(ctx.price_tier) || 'unknown';
  if (ps.includes('performance') || ps.includes('rev_share')) return fmt(ctx.performance_comp_tier) || fmt(ctx.price_tier) || 'unknown';
  if (ps.includes('usage')) return fmt(ctx.price_tier) || 'unknown';
  return fmt(ctx.price_tier) || 'unknown';
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
  const industry = fmt(ctx.icp_industry) || 'their industry';
  const vertical = fmt(ctx.vertical_segment);
  const maturity = fmt(ctx.icp_maturity) || 'unknown stage';
  const companySize = fmt(ctx.company_size) || 'unknown size';
  const offerType = fmt(ctx.offer_type) || 'the service';
  const promiseOutcome = ctx.promise_outcome || ctx.promise || 'the promised result';
  const proofLevel = fmt(ctx.proof_level) || 'unknown';
  const riskModel = fmt(ctx.risk_model) || 'unknown';
  const fulfillment = fmt(ctx.fulfillment) || 'unknown';
  const pricingStructure = fmt(ctx.pricing_structure) || 'unknown';
  const priceTier = resolvePriceTier(ctx);
  const icpSpecificity = fmt(ctx.icp_specificity) || 'unknown';
  const bottleneck = fmt(ctx.latent_bottleneck_key);
  const alignmentScore = ctx.latent_alignment_score ?? 0;
  const readinessLabel = fmt(ctx.latent_readiness_label) || 'unknown';
  const performanceBasis = fmt(ctx.performance_basis);

  return `You are generating a cold call script for a beginner-to-intermediate SDR (1-5 years experience).

CRITICAL: Follow the EXACT structure below. Do not change beat order. Do not merge sections. Do not remove beats. Do not move "Conversation Win Condition" into WHAT TO SAY. Do not explain the reason for calling before the Permission Check.

================================
DIAGNOSTIC INPUTS (MANDATORY)
================================

You MUST use ALL of these inputs. You are NOT allowed to guess. You are NOT allowed to default to generic language. Everything must map to the actual inputs below.

- Offer Type: ${offerType}
- Promise / Outcome: ${promiseOutcome}
- Industry: ${industry}${vertical ? ` (Vertical: ${vertical})` : ''}
- Company Size: ${companySize}
- Business Maturity: ${maturity}
- ICP Specificity: ${icpSpecificity}
- Pricing Structure: ${pricingStructure}
- Pricing Tier: ${priceTier}
- Market Proof Level: ${proofLevel}
- Risk Model: ${riskModel}
- Fulfillment Complexity: ${fulfillment}
- Overall Alignment Score: ${alignmentScore}/100
- Readiness Label: ${readinessLabel}
${bottleneck ? `- Primary Bottleneck: ${bottleneck}` : ''}
${performanceBasis ? `- Performance Basis: ${performanceBasis}` : ''}

DELIVERY MECHANISM (from Script Builder input):
"${deliveryMechanism}"

================================
INPUT ANCHORING RULES
================================

The delivery mechanism is the CORE of every scenario, question, and anchor in this script. If the mechanism says:
- "lead reactivation campaigns" -> the script must reflect reactivation. Every scenario, question, and pain point must be about dead leads, old quotes, people who ghosted.
- "AI call answering" -> the script must reflect call automation. Every scenario must be about missed calls, voicemails that never get returned, after-hours inquiries lost.
- "paid acquisition" -> the script must reflect paid media. Every scenario must be about ad spend, cost per lead, campaigns that stopped converting.
- "SEO" -> the script must reflect organic traffic. Every scenario must be about rankings, content that isn't working, competitors showing up first.
- "appointment setting" -> the script must reflect pipeline generation. Every scenario must be about reps sitting idle, not enough meetings, inconsistent pipeline.
- Any other mechanism -> derive specific scenarios from what the mechanism actually does. Never generalize.

The industry determines WHO you're talking about and WHAT their day looks like.
The maturity determines HOW sophisticated they are and what stage problems they face.
The pricing tier determines the ECONOMIC CONTEXT. High-ticket = strategic pain. Low-ticket = volume pain.
The proof level determines HOW CONFIDENTLY you can reference results. Weak proof = softer framing with more uncertainty. Strong proof = more direct framing.
The company size determines the SCALE of problems. Solo operator vs. team of 50 have different realities.

================================
SCRIPT QUALITY STANDARD
================================

This script must:
- Survive 500 dials
- Convert 10%+ of live connects to meetings with competent execution
- Work for beginner-to-intermediate SDRs
- Sound calm and controlled
- Avoid sounding robotic or corporate

It must NOT:
- Assume cooperation
- Assume pain prematurely
- Sound needy or hype-driven
- Sound like a pitch before diagnosis
- Use any of these banned phrases: "increase revenue", "boost revenue", "drive revenue", "get more value", "maximize value", "unlock value", "we specialize in", "we help companies", "our solution", "leverage", "optimize", "streamline", "scale", "pain points", "challenges", "opportunities"
- Use em dashes anywhere
- Include any line that sounds like a LinkedIn post or marketing email

================================
LANGUAGE RULES
================================

Every single line must sound like something a real person would say on a phone call.
- Short sentences. One idea per sentence.
- Use "you know when..." or "you know those..." to introduce scenarios.
- Use micro-scenarios: describe a specific moment the prospect has lived through in their ${industry} business.
- Sound like a human talking to another human, not a sales rep reading a pitch.
- All scenarios must be derived from the DELIVERY MECHANISM and INDUSTRY combination.

================================
OUTPUT FORMAT (STRICT)
================================

You must output ONLY SECTION 1: WHAT TO SAY. DO NOT include Section 2. DO NOT shorten excessively. DO NOT stop mid-script. Generate fully.

The script must contain exactly these 8 beats PLUS an Email Fallback Branch in this EXACT order. Do not reorder. Do not skip. Do not add extra beats.

## 1. Attention Capture
Short. Calm. Neutral. Under 7 seconds spoken.
Confirm you're speaking to the right person without triggering defensiveness.
Must NOT fake familiarity.
Example pattern: "Hi {{first_name}}, it's [Rep Name]. Quick question for you."
Include branches for:
- "Who is this?"
- "I'm busy"
- "Not interested" immediately
- Silence

## 2. Permission Check
This MUST happen BEFORE explaining the problem or reason for calling.
Ask for 10-20 seconds explicitly.
Include an easy out as a choice.
Must NOT ask "Is this a good time?"
Example pattern: "Do you have 20 seconds for me to explain why I called, and you can decide if it is even relevant?"
Include branches:
- Yes / Go ahead -> Move to Beat 3
- "I'm busy" -> Offer callback or exit
- Hard no -> Exit cleanly

## 3. Identity + Context
One sentence only. Name + agency + neutral context.
No hard claims. No company explanation. No selling.
Describe the category of problem using a micro-scenario derived from ${deliveryMechanism} and ${industry}.
Include branches for:
- "What's this about?" -> brief clarification, move to Beat 4
- "Not interested" -> acknowledge, exit cleanly
- Silence -> pause 3 seconds, then soft redirect

## 4. Relevance Hypothesis (Niche-Specific)
This is where diagnostic inputs are used.
1-2 sentences MAX describing a common pattern for ${industry} businesses at ${maturity} stage that directly relates to ${deliveryMechanism}.
Must include light uncertainty: "I might be off here" or "not sure if that's true for you"
Must end with a soft check: "Is that something you are seeing right now?"
Must NOT use abstract benefit language.
The scenario must be SPECIFIC to the delivery mechanism.
Structure: "I might be off here, but usually when companies like {{company}} [insert niche pattern], there is [insert specific leak/symptom]."
Include 3 branches:
- Yes / confirmation -> Move to Beat 5
- "We already handle that" -> acknowledge, ask one clarifying question, then exit or continue
- "Not really" -> "Fair enough. Appreciate your time, {{first_name}}." Exit cleanly.

## 5. Ownership Trigger Question
ONE open-ended question that makes the prospect describe what currently happens.
Must NOT be yes/no.
Must force them to explain their current reality related to the delivery mechanism.
Structure: "What usually happens when [specific situation from Relevance Anchor]?"
Include branches:
- Real answer with detail -> Move to Beat 6
- Dismissive answer -> "Got it. No worries. Appreciate your time, {{first_name}}."
- "I don't know" -> reframe simpler, or exit cleanly
- Annoyance / sharp tone -> shorten and exit

## 6. Micro-Commitment Step
MANDATORY before any meeting suggestion.
Confirm the prospect cares enough to look at a fix.
Must NOT mention meetings, demos, calls, or scheduling.
Example: "Would it even be worth looking at how that gets fixed, or is it just one of those things you live with?"
Include branches:
- Yes -> Move to Beat 7
- "Not really" -> "Totally fair. Appreciate you being straight with me, {{first_name}}. Have a good one."
- "How does it work?" -> Give a 1-sentence answer referencing the delivery mechanism, then redirect to Beat 7
- Unsure -> "No pressure. If it comes up again, happy to chat. Appreciate your time."

## 7. Earned Next Step
ONLY if Micro-Commitment got a positive response.
Structure:
1. Reflection: "Based on what you said about [confirmed issue]..."
2. Reason: "That's usually where [ICP type] see [specific improvement related to ${deliveryMechanism}]."
3. Time-Boxed Choice: Offer TWO specific time options. NEVER open-ended.
   Correct: "Would later today or tomorrow morning be easier?"
   BANNED: "Would you be open to a quick call?"
4. Calendar confirmation with {{email}}: "I'll send a quick invite to {{email}}. That still the best one?"
Include branches:
- Picks a time -> Confirm, send invite, exit warmly
- "Leave it" / hesitation -> "No problem at all. If timing changes, happy to revisit. Appreciate it, {{first_name}}."
- "Send me an email" -> Move to Beat 8

## 8. Email Fallback Branch
Triggered when prospect says "just send me an email" at ANY point.
Structure:
1. Confirm email: "Sure, happy to. Is {{email}} still the best one?"
2. Ask angle: "What would be most useful to see? The way it works on the [mechanism-specific scenario] side, or more of the numbers?"
3. Clean exit: "Got it. I'll send that over today. If it looks interesting, we can always jump on a quick call from there. Appreciate your time, {{first_name}}."

================================
HARD RULES FOR REPS (embed in script flow)
================================

1. Permission Check MUST happen BEFORE explaining the problem. Do NOT explain the reason for calling before Beat 2 is complete.
2. NEVER ask for a meeting before the Micro-Commitment Step (Beat 6) gets a positive response.
3. NEVER argue. If they push back, agree and exit.
4. If they say "no" twice, exit immediately. No third attempt.
5. If tone gets sharp, shorten your next response to one sentence max.
6. If you don't know what to say: "That makes sense. Let me not take up more of your time. Appreciate it, {{first_name}}."
7. Every exit must include {{first_name}} and "appreciate your time" or similar.

================================
QUALITY CONTROL (verify before outputting)
================================

1. Beat order is EXACTLY: Attention Capture, Permission Check, Identity + Context, Relevance Hypothesis, Ownership Trigger, Micro-Commitment, Earned Next Step, Email Fallback
2. Permission Check (Beat 2) comes BEFORE Identity + Context (Beat 3). The reason for calling is NOT explained before Permission Check.
3. Every scenario references the ACTUAL delivery mechanism: "${deliveryMechanism}"
4. Every scenario is specific to ${industry} at ${maturity} stage
5. Economic framing matches pricing tier: ${priceTier}
6. Confidence of claims matches proof level: ${proofLevel}
7. Every beat has conditional branches / GUARDRAILS
8. Micro-Commitment (Beat 6) appears BEFORE meeting ask (Beat 7)
9. Email Fallback has email confirm + angle + clean exit
10. No banned phrases anywhere
11. Every line is speakable in one breath
12. Zero em dashes
13. All CRM variables use {{variable}} format
14. Script can be pasted into a Dialer with zero edits
15. Script is COMPLETE. All 8 beats fully generated. Do not truncate or stop early.
16. Do NOT include Conversation Win Condition in this section. It belongs in Section 2.

================================
END. Generate ONLY Section 1 now. No preamble. No closing remarks.
================================`;
}

// ========== SECTION 2: HOW TO THINK PROMPT ==========

function buildPlaybookPrompt(ctx: OfferContext, scriptText: string, deliveryMechanism: string): string {
  const industry = fmt(ctx.icp_industry) || 'their industry';
  const maturity = fmt(ctx.icp_maturity) || 'unknown stage';
  const offerType = fmt(ctx.offer_type) || 'the service';
  const proofLevel = fmt(ctx.proof_level) || 'unknown';
  const priceTier = resolvePriceTier(ctx);
  const promiseOutcome = ctx.promise_outcome || ctx.promise || 'the promised result';

  return `You are writing SECTION 2: HOW TO THINK for a cold call script.

This is SDR training. A tactical behavior manual. NOT a script. No dialogue. No CRM placeholders. No branching. No execution lines.

================================
CONTEXT
================================

- Industry: ${industry}
- Business Maturity: ${maturity}
- Offer Type: ${offerType}
- Promise / Outcome: ${promiseOutcome}
- Delivery Mechanism: "${deliveryMechanism}"
- Proof Level: ${proofLevel}
- Pricing Tier: ${priceTier}

THE SCRIPT (Section 1, for reference only. Do NOT repeat any script lines):
${scriptText}

================================
RULES
================================

- No dialogue or script lines (those belong in Section 1 only)
- No CRM placeholders like {{first_name}} or {{company}}
- No branching or execution lines
- No philosophy or abstract theory
- Every line must be a specific instruction a rep can act on immediately
- Write like you're texting a nervous friend before their first call
- No em dashes. Use periods and short sentences.

================================
OUTPUT (exactly 6 sections with ## headings)
================================

## 1. Conversation Win Condition

Define clearly:
- **Success looks like:** (3-4 bullet points of what a winning call produces. Be specific to ${industry} and ${deliveryMechanism}.)
- **Failure looks like:** (3-4 bullet points. Not "they hung up" but specific behavioral signals.)
- **Qualification signals:** (bullet list of signals that mean this prospect is worth pursuing)
- **Disqualification signals:** (bullet list of signals that mean stop and exit)
- **Meeting criteria:** (what must be true before asking for a meeting. Reference the Micro-Commitment step.)
- **Exit criteria:** (when to exit immediately, no negotiation)

## 2. Tone and Pacing Rules

Specific instructions on HOW to sound:
- Speak slower than feels natural. If you think you're slow enough, go slower.
- Your voice should sound like you're asking a neighbor a question, not presenting to a room.
- Lower your pitch slightly. Nervous reps go high-pitched.
- Pause after every question. Count to 3 before saying anything else.
- If you catch yourself speeding up, stop mid-sentence and restart slower.
- Never talk over the prospect. If they start talking, you stop.
- Silence is not awkward. Silence means they're thinking. Let them think.

## 3. Green Lights

Specific signals that mean the prospect is engaged. Relate these to ${industry} and ${deliveryMechanism}:
- They ask a follow-up question
- They describe their current process in detail
- They mention a specific frustration related to the delivery mechanism
- They say "yeah" or "actually" before answering
- They stay on the line past 30 seconds without trying to end the call
- They mention a number, a timeline, or a person by name
- Add 2-3 more specific to this ICP and mechanism

## 4. Red Flags

Specific signals that mean exit:
- One-word answers getting shorter
- Tone getting sharper or faster
- They say "I'm good" or "we're fine" twice
- They ask "is this a sales call?" with an edge
- Silence after your question with no re-engagement after 5 seconds
- They interrupt you to ask you to get to the point more than once
- Add 2-3 more specific to this ICP

## 5. Hard Exit Rules

Non-negotiable rules for when to stop:
- If they say "no" twice in any form, exit. No third attempt ever.
- If tone turns hostile or sarcastic, exit immediately. Do not try to recover.
- If they ask you to stop calling, exit and note it. No callback.
- Never argue with a prospect. If they disagree, agree with them and exit.
- If you feel the urge to convince them, that is the signal to stop.
- If they say "send me an email" and you've already asked your questions, just send the email. Don't try to re-pitch.
- Your only goal in the first 20 seconds is to avoid being hung up on. Not to sell.

## 6. Why This Script Works for THIS Offer and ICP

This section MUST reference the actual delivery mechanism ("${deliveryMechanism}") and ICP context (${industry} at ${maturity} stage). Explain in 5-6 short bullets:
- Why the relevance hypothesis works for this specific ICP at this maturity stage
- Why the permission-first flow reduces hang-ups for ${industry} prospects
- Why the micro-commitment step matters for this pricing tier (${priceTier})
- Why the discovery questions connect to the actual mechanism ("${deliveryMechanism}")
- Why the proof level (${proofLevel}) affects how directly you can frame results
- Why this structure works better than a standard pitch for this offer type (${offerType})

================================
QUALITY CONTROL
================================

1. No script lines repeated from Section 1
2. No dialogue, no CRM placeholders, no branching
3. Every bullet is actionable
4. Section 6 references the actual mechanism and ICP, not generic advice
5. All 6 sections present with ## headings
6. Conversation Win Condition is in THIS section, not in Section 1
7. A rep can scan this in 90 seconds and feel more confident

================================
END. Generate Section 2 now. No preamble. No closing remarks.
================================`;
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
    console.log("Offer context keys:", Object.keys(offerContext).filter(k => (offerContext as any)[k] != null).join(', '));

    // Step 1: Generate Section 1 (What to Say)
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
          { role: "user", content: "Generate Section 1: WHAT TO SAY now. All 8 beats plus Win Condition. Complete output. Do not stop early. Do not truncate." },
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

    // Step 2: Generate Section 2 (How to Think)
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
          { role: "user", content: "Generate Section 2: HOW TO THINK now. All 5 sections. Complete output. Do not truncate." },
        ],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });

    let playbookText: string | null = null;
    if (playbookResponse.ok) {
      const playbookData = await playbookResponse.json();
      playbookText = playbookData.choices?.[0]?.message?.content || null;
    } else {
      console.error("Playbook generation error:", playbookResponse.status);
    }

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
