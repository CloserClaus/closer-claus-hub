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

  return `You are generating a cold call script for an agency.

================================
DIAGNOSTIC INPUTS (MANDATORY)
================================

You MUST use ALL of these inputs. You are NOT allowed to guess. You are NOT allowed to default to generic language. Everything must map to the actual inputs below.

STRUCTURED INPUTS:
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

You must output EXACTLY TWO SECTIONS. DO NOT merge them. DO NOT bleed content between them. DO NOT shorten excessively. DO NOT stop mid-script. Generate fully.

================================
SECTION 1: WHAT TO SAY
================================

Structure this in 8 numbered beats using ## headings.

Each beat must contain:
- The primary line the rep says (bold **Rep:** prefix)
- Conditional branches formatted as:
  - "If they say ___" -> Rep says ___ -> Move to Beat X
  - "If they resist" -> Rep says ___ -> Move to Beat X
  - "If they interrupt" -> Rep says ___ -> Move to Beat X

MANDATORY BRANCHES to include across the script:
- "Who is this?" branch
- "What are you selling?" branch
- Early "Not interested" branch
- "Send me an email" branch
- Silence branch
- Qualified -> Meeting branch
- Disqualified -> Clean exit branch

The meeting ask must ONLY happen AFTER:
1. A problem is acknowledged
2. A consequence is surfaced
3. The prospect confirms it matters (Micro-Commitment)

CRM placeholders to use naturally: {{first_name}}, {{company}}, {{email}}, {{title}}, {{last_name}}, {{phone}}

No long monologues. Short controlled lines. Every beat must earn the next one.

BEAT ORDER:

## 1. Attention Capture
- 1 short line only (under 7 seconds spoken)
- Confirm you're speaking to the right person without triggering defensiveness
- Must NOT fake familiarity
- GUARDRAILS for: neutral response, rushed response, confusion, annoyance

## 2. Identity + Context
- 1 short line. Vague, non-threatening reason for the call.
- Must describe the category of problem using a micro-scenario derived from ${deliveryMechanism} and ${industry}.
- No company explanation, no selling, no claims.
- GUARDRAILS for: "what's this about?", "not interested", silence

## 3. Permission Check
- Ask for 10-20 seconds explicitly
- Include an easy out as a choice
- Must NOT ask "Is this a good time?"
- GUARDRAILS for: yes, "I'm busy", hard no

## 4. Relevance Anchor
- 1-2 sentences MAX describing a common pattern for ${industry} businesses at ${maturity} stage that directly relates to ${deliveryMechanism}
- Must include light uncertainty: "I might be off" or "not sure if that's true for you"
- Must end with a soft check
- Must NOT use abstract benefit language
- The scenario must be SPECIFIC to the delivery mechanism. If mechanism is "lead reactivation" -> talk about old leads going cold. If mechanism is "AI call answering" -> talk about missed calls. Etc.
- GUARDRAILS for: confirmation, "not really", pushback

## 5. Ownership Trigger Question
- ONE open-ended question that makes the prospect describe what currently happens
- Must NOT be yes/no
- Must force them to explain their current reality related to the delivery mechanism
- Structure: "What usually happens when [specific situation from Relevance Anchor]?"
- GUARDRAILS for: real answer, dismissive answer, "I don't know", annoyance

## 6. Test Question 2 (optional)
- Only include if it adds value. Max ONE additional question.
- Must build on what was revealed by Beat 5.
- GUARDRAILS for: engagement, shortened tone

## 7. Micro-Commitment Step
- MANDATORY before any meeting suggestion
- Confirm the prospect cares enough to look at a fix
- Must NOT mention meetings, demos, calls, or scheduling
- Example: "Would it even be worth looking at how that gets fixed, or is it just one of those things you live with?"
- GUARDRAILS for: yes, "not really", unsure

## 8. Earned Next Step
- ONLY if Micro-Commitment got a positive response
- Structure:
  1. Reflection: "Based on what you said about [confirmed issue]..."
  2. Reason: "That's usually where [ICP type] see [specific improvement related to ${deliveryMechanism}]."
  3. Time-Boxed Choice: Offer TWO specific time options. NEVER open-ended.
     Correct: "Would later today or tomorrow morning be easier?"
     BANNED: "Would you be open to a quick call?"
- GUARDRAILS for: picks time, "leave it", "send me an email"

## 8b. Email Fallback Branch
- Triggered when prospect says "just send me an email"
- Structure:
  1. Confirm email: "Sure, happy to. Is {{email}} still the best one?"
  2. Ask angle: "What would be most useful to see? The way it works on the [scenario] side, or more of the numbers?"
  3. Clean exit: "Got it. I'll send that over today. If it looks interesting, we can always jump on a quick call from there. Appreciate your time, {{first_name}}."

AT THE END OF SECTION 1, include:

## Conversation Win Condition
- **Qualification signals:** (bullet list of what signals a qualified prospect)
- **Disqualification signals:** (bullet list of what signals disqualification)
- **Meeting criteria:** (what must be true before asking for a meeting)
- **Exit criteria:** (when to exit immediately)

================================
HARD RULES FOR REPS (embed in script flow)
================================

1. NEVER ask for a meeting before the Micro-Commitment Step gets a positive response.
2. NEVER argue. If they push back, agree and exit.
3. If they say "no" twice, exit immediately. No third attempt.
4. If tone gets sharp, shorten your next response to one sentence max.
5. If you don't know what to say: "That makes sense. Let me not take up more of your time. Appreciate it, {{first_name}}."
6. Every exit must include {{first_name}} and "appreciate your time" or similar.

================================
QUALITY CONTROL (verify before outputting)
================================

1. Every scenario references the ACTUAL delivery mechanism: "${deliveryMechanism}"
2. Every scenario is specific to ${industry} at ${maturity} stage
3. Economic framing matches pricing tier: ${priceTier}
4. Confidence of claims matches proof level: ${proofLevel}
5. Win Condition section appears after the beats
6. Every beat has GUARDRAILS
7. Micro-Commitment appears BEFORE meeting ask
8. Email Fallback has email confirm + angle + clean exit
9. No banned phrases anywhere
10. Every line is speakable in one breath
11. Zero em dashes
12. All CRM variables use {{variable}} format
13. Script can be pasted into a Dialer with zero edits
14. Script is COMPLETE. Do not truncate or stop early.

================================
END. Generate ONLY Section 1 now.
================================`;
}

// ========== SECTION 2: HOW TO THINK PROMPT ==========

function buildPlaybookPrompt(ctx: OfferContext, scriptText: string, deliveryMechanism: string): string {
  const industry = fmt(ctx.icp_industry) || 'their industry';
  const maturity = fmt(ctx.icp_maturity) || 'unknown stage';
  const offerType = fmt(ctx.offer_type) || 'the service';
  const proofLevel = fmt(ctx.proof_level) || 'unknown';
  const priceTier = resolvePriceTier(ctx);

  return `You are writing SECTION 2: HOW TO THINK for a cold call script.

This is SDR training. A tactical behavior manual for a beginner-to-intermediate rep.

================================
CONTEXT
================================

- Industry: ${industry}
- Business Maturity: ${maturity}
- Offer Type: ${offerType}
- Delivery Mechanism: "${deliveryMechanism}"
- Proof Level: ${proofLevel}
- Pricing Tier: ${priceTier}

THE SCRIPT (Section 1, for reference only. Do NOT repeat any script lines):
${scriptText}

================================
RULES
================================

- No dialogue or script lines (those belong in Section 1 only)
- No CRM placeholders
- No branching or execution lines
- No philosophy or abstract theory
- Every line must be a specific instruction a rep can act on immediately
- Write like you're texting a nervous friend before their first call
- No em dashes. Use periods and short sentences.

================================
OUTPUT (exactly 5 sections with ## headings)
================================

## 1. Tone and Pacing Guidance

Specific instructions on HOW to sound:
- Speak slower than feels natural. If you think you're slow enough, go slower.
- Your voice should sound like you're asking a neighbor a question, not presenting to a room.
- Lower your pitch slightly. Nervous reps go high-pitched.
- Pause after every question. Count to 3 before saying anything else.
- If you catch yourself speeding up, stop mid-sentence and restart slower.

## 2. How to Handle Interruptions

Specific instructions for the 5 most common disruptions:
1. They interrupt you mid-sentence: Stop immediately. Let them finish. Say the shortest version of what you were going to say.
2. They say "who is this?": Give your name and one sentence. Move on.
3. They say "send me an email": Confirm email, ask what angle, exit cleanly.
4. They go silent: Wait 3 full seconds. If still silent: "No pressure either way."
5. They get hostile: Do not match energy. Exit: "Sounds like I caught you at a bad time. Have a good one." Hang up.

## 3. What Green Lights Look Like

Specific signals that mean the prospect is engaged. Relate these to ${industry} and ${deliveryMechanism}:
- They ask a follow-up question
- They describe their current process
- They mention a specific frustration related to the delivery mechanism
- They say "yeah" or "actually" before answering
- They stay on the line past 30 seconds

## 4. What Red Flags Look Like

Specific signals that mean exit:
- One-word answers getting shorter
- Tone getting sharper or faster
- They say "I'm good" or "we're fine" twice
- They ask "is this a sales call?" with an edge
- Silence after your question with no re-engagement

## 5. Why This Script Works for THIS Offer and ICP

This section MUST reference the actual delivery mechanism ("${deliveryMechanism}") and ICP context (${industry} at ${maturity} stage). Explain in 4-5 short bullets:
- Why the relevance anchor works for this specific ICP
- Why the micro-commitment step matters for this pricing tier (${priceTier})
- Why the discovery questions connect to the actual mechanism
- Why the proof level (${proofLevel}) affects how directly you can frame results
- Why this structure works better than a standard pitch for this offer type

================================
QUALITY CONTROL
================================

1. No script lines repeated from Section 1
2. No jargon or abstract theory
3. Every bullet is actionable
4. Section 5 references the actual mechanism and ICP, not generic advice
5. All 5 sections present with ## headings
6. A rep can scan this in 60 seconds and feel more confident

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
