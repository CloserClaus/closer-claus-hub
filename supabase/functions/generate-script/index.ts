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
  const offerType = ctx.offer_type?.replace(/_/g, ' ') || 'the service';
  const promiseOutcome = ctx.promise_outcome || ctx.promise || 'the promised result';
  const proofLevel = ctx.proof_level?.replace(/_/g, ' ') || 'unknown';
  const riskModel = ctx.risk_model?.replace(/_/g, ' ') || 'unknown';
  const fulfillment = ctx.fulfillment?.replace(/_/g, ' ') || 'unknown';
  const pricingStructure = ctx.pricing_structure?.replace(/_/g, ' ') || 'unknown';
  const bottleneck = ctx.latent_bottleneck_key?.replace(/_/g, ' ') || '';

  return `You are writing a cold call script for a BEGINNER sales rep who will read this VERBATIM on live calls. This is their very first cold call.

=== WHAT THIS SCRIPT IS ===

This script helps a nervous, beginner rep survive a cold call long enough to earn 2-3 minutes of attention and book a meeting.

It is NOT a pitch, sales framework, qualification tool, or offer explanation.

Success means ONE of these:
- The prospect gives permission to continue for another 30-120 seconds
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

=== LANGUAGE RULES (CRITICAL) ===

Every single line MUST sound like something a real person would say on a phone call. Read each line out loud before including it.

BANNED phrases and patterns (never use any of these):
- "increase revenue" / "boost revenue" / "drive revenue"
- "get more value" / "maximize value" / "unlock value"
- "we specialize in" / "we help companies" / "our solution"
- "leverage" / "optimize" / "streamline" / "scale"
- "pain points" / "challenges" / "opportunities"
- Any sentence with an em dash
- Any sentence that could appear in a LinkedIn post or marketing email
- Any phrase that sounds like a consultant wrote it

REQUIRED language style:
- Short sentences. One idea per sentence.
- Use "you know when..." or "you know those..." to introduce scenarios.
- Use micro-scenarios: describe a specific moment the prospect has lived through.
- Reference real situations from ${industry} businesses, not abstract benefits.
- Sound like a human talking to another human over coffee, not a sales rep reading a pitch.

Example of BANNED language: "We help ${industry} companies get more value from their existing leads."
Example of CORRECT language: "You know those quotes that went out last month and nobody ever replied back?"

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
- Use corporate phrasing or jargon of any kind

=== CONTEXT (use to calibrate scenarios and language - NEVER expose directly) ===

- Industry: ${industry}${vertical ? ` (${vertical})` : ''}
- Business Maturity: ${maturity}
- Offer Type: ${offerType}
- Promise / Outcome: ${promiseOutcome}
- Delivery Mechanism: "${deliveryMechanism}"
- Proof Level: ${proofLevel}
- Risk Model: ${riskModel}
- Fulfillment: ${fulfillment}
- Pricing: ${pricingStructure}
${bottleneck ? `- Primary Bottleneck: ${bottleneck}` : ''}

Use these inputs to generate SPECIFIC micro-scenarios. For example:
- If industry is "roofing" and maturity is "scaling": reference homeowners who got an estimate but ghosted, or jobs where the crew showed up but the customer cancelled last minute.
- If industry is "SaaS" and offer type is "lead gen": reference demo requests that sat in the CRM for two weeks, or trial users who signed up and never logged back in.
- If industry is "dental" and maturity is "early": reference patients who called for pricing but never booked, or hygiene patients who haven't been back in 18 months.

Always ground language in the specific industry reality. Never use generic business language.

=== OUTPUT FORMAT ===

Generate the script as a turn-based ADAPTIVE SKELETON with short base lines and branching follow-ups based on likely prospect responses.

Use ## headings for each beat. Under each beat, output:
- The exact line the rep says (as a bold **Rep:** prefix)
- Then 2-3 short "If -> then" branches for likely prospect responses

=== BEATS (in this exact order) ===

## 1. Attention Capture
- 1 short line only (under 7 seconds spoken)
- Purpose: confirm you're speaking to the right person without triggering defensiveness
- Must NOT ask "is this the owner?" or anything authority-threatening
- Must sound natural when interrupted
- Must NOT identify the company yet
- Must end with a soft handoff, not a question that invites a hard "no"
- Include: If prospect responds neutrally -> next line. If rushed -> fallback line. If confused -> clarification line.

## 2. Identity + Context
- 1 short line
- Purpose: give a vague, non-threatening reason for the call
- No company explanation, no selling, no claims
- Should feel like a reason, not a pitch
- Must describe the category of problem using a micro-scenario, not abstract language
- Then immediately move to permission check

## 3. Permission Check
- Ask for time explicitly
- Time request must be small (10-20 seconds)
- Must include an easy out
- Must be phrased as a choice between continuing briefly or stopping
- Must NOT ask "Is this a good time?"

## 4. Relevance Anchor (Read Verbatim)
- This section sits BETWEEN the Permission Check and the first discovery question.
- Purpose: link the prospect's likely current behavior to a hidden cost or missed outcome using a SPECIFIC micro-scenario from their industry.
- It must be 1-2 sentences MAX.
- It MUST use a concrete, industry-specific scenario. NOT generic business language.
- It must reference a pattern ("what we usually see with [specific ICP type] at this stage is [specific thing that happens]") rather than a personal claim about them.
- The scenario must describe a moment the prospect has actually lived through. Something they can picture.
- It MUST include light uncertainty. The rep should NOT sound like they already know the prospect's situation. Use phrasing like "I might be off" or "not sure if that's true for you" or "could be different in your case."
- It must NOT accuse, exaggerate, or threaten.
- It must end with a soft check that invites them to confirm or deny without pressure.
- BANNED in this section: "increase revenue", "get more value", "old leads", "untapped potential", any abstract benefit language.
- Good example for roofing: "What we usually see with guys running 3-4 crews is there's a pile of estimates from last month that nobody followed up on. Not because they forgot, just ran out of day. I might be totally off, but does that sound like your world at all?"
- Good example for SaaS: "What we usually hear from teams your size is there are demo requests sitting in the CRM from two weeks ago that nobody called back. Could be different for you, but is that something you've run into?"

## 5. Ownership Trigger Question
- ONE question that makes the prospect describe what currently happens in their business.
- This question must NOT be yes/no. It must force them to explain their current reality.
- It should make them verbalize what they currently do (or don't do) about the situation from the Relevance Anchor.
- It should feel safe and curious, not interrogative.
- Structure: "What usually happens when [specific situation from Relevance Anchor]?"
- Example for roofing: "What usually happens to someone who asked for a quote but never called back?"
- Example for dental: "What usually happens to a patient who cancels their cleaning and doesn't reschedule?"
- Example for SaaS: "What usually happens to a trial user who signed up but stopped logging in after day two?"
- Include 2-3 "If -> then" branches based on likely responses.

## 6. Test Question 2 (optional)
- Only include if it adds value. Max ONE additional question.
- Must build on what was revealed by the Ownership Trigger Question.
- Must not stack or repeat.
- Include 1-2 "If -> then" branches.
- If this question is not needed, skip this section entirely.

## 7. Micro-Commitment Step
- This beat sits BETWEEN the discovery questions and the meeting ask. It is MANDATORY.
- Purpose: get the prospect to confirm TWO things before you ever suggest a meeting:
  1. They have the problem (already confirmed by now).
  2. They care enough about fixing it to look at something.
- This is a SMALLER ask than a meeting. It tests intent without commitment.
- The question should feel like a natural "is this even worth your time" check.
- It must NOT mention meetings, demos, calls, or scheduling.
- Example structures:
  - "Would it even be worth looking at how that gets fixed, or is it just one of those things you live with?"
  - "Is that something you'd want to clean up if there was a simple way, or is it not really a priority right now?"
  - "If there was a way to catch those before they disappear, would that even matter to you right now?"
- Include branches:
  - If they say yes or show interest -> proceed to Earned Next Step
  - If they say "not really" or "we're fine" -> exit politely. Do NOT push.
  - If they're unsure -> rephrase once, then offer to follow up later.

## 8. Earned Next Step (Read Verbatim)
- This is NOT a generic meeting ask. It is an "Earned Decision Frame."
- ONLY reach this beat if the Micro-Commitment Step got a positive or curious response.
- Structure (all 3 parts mandatory):
  1. **Reflection** (1 sentence): Reflect back something the prospect just confirmed. Start with "Based on what you said about [confirmed issue]..."
  2. **Reason** (1 sentence): Connect that to a specific outcome. "That's usually where [ICP type] see [specific thing improve]."
  3. **Time-Boxed Choice** (1 question): Offer TWO specific time options, not open-ended. NEVER say "would you be open to a chat" or "can we schedule something."
     - Correct: "If it makes sense, we can walk through how that works in about 10 minutes. Would later today or tomorrow morning be easier?"
     - Correct: "We can show you exactly how that part works. Would Thursday or Friday afternoon be better?"
     - BANNED: "Would you be open to a quick call?" / "Can we set up a meeting?" / "Do you have time this week?"
- The CTA must reference at least one confirmed insight from the conversation.
- Must NOT use hype, urgency, or scarcity.
- Must NOT re-explain the offer.
- Branching:
  - If they pick a time -> confirm and exit. "Perfect. I'll send over a quick invite. Talk to you then."
  - If they choose to park it -> exit politely, no resistance, no reframing.
  - If they say "just send me an email" -> go to Email Fallback branch below.

## 8b. Email Fallback Branch
- This is a sub-branch of the Earned Next Step, triggered when the prospect says "just send me an email" or "email me something."
- Do NOT treat this as a rejection. Treat it as a soft redirect.
- Structure (3 steps):
  1. **Confirm email**: "Sure, happy to. Is {{email}} still the best one to use?"
  2. **Ask for angle**: "What would be most useful to see? The way it works on the [specific scenario from Relevance Anchor] side, or more of the numbers behind it?"
  3. **Clean exit**: "Got it. I'll send that over today. If it looks interesting, we can always jump on a quick call from there. Appreciate your time, {{first_name}}."
- This branch must feel like a natural, respectful close. Not a last-ditch pitch attempt.
- The angle question serves two purposes: it makes the email more relevant AND it gives the rep intel for the follow-up.

=== VARIABLE FORMAT ===

Use these dynamic variables throughout the script where appropriate:
- {{first_name}} for the prospect's first name
- {{last_name}} for the prospect's last name
- {{company}} for the prospect's company name
- {{title}} for the prospect's job title
- {{email}} for the prospect's email
- {{phone}} for the prospect's phone number

These variables are compatible with the Dialer system. Use them naturally in the script. Do not wrap them in brackets like [Name].

=== QUALITY CONTROL (MANDATORY) ===

Before finalizing, verify the script passes ALL of these:

1. Contains a concrete spoken opener line (not a placeholder)
2. Contains a clear reason-for-calling line (one sentence, plain language, no jargon)
3. Contains a Relevance Anchor with a SPECIFIC micro-scenario from ${industry}, not generic benefit language
4. The Relevance Anchor includes light uncertainty ("I might be off", "not sure if that's true for you")
5. Contains an Ownership Trigger Question that forces the prospect to describe their current reality (not yes/no)
6. Contains a Micro-Commitment Step that tests intent BEFORE suggesting a meeting
7. Contains an Earned Next Step with Reflection + Reason + Time-Boxed Choice (two specific time options)
8. Contains an Email Fallback Branch with email confirm + angle question + clean exit
9. Tone is consistent throughout. No line sounds senior if others sound junior
10. No line sounds like marketing copy or could appear in a blog post or LinkedIn post
11. Every line survives interruption at any point
12. Every line is speakable in one breath
13. No stacked questions anywhere
14. No more than 2 discovery questions before the Micro-Commitment Step
15. Total script feels intentionally incomplete. It earns time, nothing more
16. Zero em dashes anywhere in the output
17. Zero instances of "we specialize", "increase revenue", "get more value", "unlock", "leverage", "optimize"
18. Every scenario references something specific to ${industry} businesses
19. The meeting ask uses two specific time options, never open-ended
20. Dynamic variables use {{variable}} format, never [Variable] format

If any check fails, rewrite the failing line before outputting.

=== ANTI-AI FILTER ===

Read every line out loud. If it sounds like something a marketer wrote, rewrite it until it sounds like something a person would say while leaning against a truck or sitting in a break room.

When unsure whether to be more specific or more flexible:
-> More specific in language
-> More flexible in flow

=== FINAL OUTPUT RULES ===

- Use ## headings for each beat (8 max including Email Fallback, fewer if Test Question 2 is skipped)
- No explanations, no intent labels, no meta commentary, no "(pause)" instructions
- No emojis, no hype, no sales fluff, no jargon
- No em dashes
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
