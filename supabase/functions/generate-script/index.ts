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

Generate the script as a turn-based ADAPTIVE SKELETON with short base lines and MANDATORY branching guardrails under every beat.

Use ## headings for each beat. Under each beat, output:
- The exact line the rep says (as a bold **Rep:** prefix)
- Then MANDATORY response branches using this format:

**GUARDRAILS (required under EVERY beat):**
- "If they respond normally:" -> next line
- "If they interrupt:" -> stop talking immediately, then say: [specific short recovery line]
- "If they push back or sound annoyed:" -> [specific clean exit line]
- "If they say no twice:" -> exit immediately: "No worries at all. Appreciate your time, {{first_name}}."

Every beat must have these guardrails. No exceptions. A beginner rep must never be left wondering "what do I say now?"

=== CONVERSATION WIN CONDITION (output this FIRST, before Beat 1) ===

Output a section called ## Win Condition at the very top of the script with exactly this structure:

**You win if:**
- The prospect answers one real question about their business
- The prospect agrees to look at something (not necessarily a meeting)
- You exit without the prospect feeling annoyed or pressured

**You lose if:**
- You explain the offer before they confirm the problem
- You ask for a meeting before they say the problem matters
- You keep talking after they say no twice
- The prospect hangs up irritated

**Exit immediately if:**
- They say "not interested" or "no" twice
- Their tone gets sharp or short
- They ask to be removed from the list
- You hear silence for more than 5 seconds after a question

=== BEATS (in this exact order) ===

## 1. Attention Capture
- 1 short line only (under 7 seconds spoken)
- Purpose: confirm you're speaking to the right person without triggering defensiveness
- Must NOT ask "is this the owner?" or anything authority-threatening
- Must sound natural when interrupted
- Must NOT identify the company yet
- Must end with a soft handoff, not a question that invites a hard "no"
- GUARDRAILS: If they respond neutrally -> next line. If rushed -> "Totally get it, I'll be super quick." If confused -> "Sorry, I'm looking for the person who handles [industry-specific thing]." If annoyed -> "No worries, bad timing. Have a good one."

## 2. Identity + Context
- 1 short line
- Purpose: give a vague, non-threatening reason for the call
- No company explanation, no selling, no claims
- Should feel like a reason, not a pitch
- Must describe the category of problem using a micro-scenario, not abstract language
- Then immediately move to permission check
- GUARDRAILS: If they interrupt with "what's this about?" -> give the one-line reason again, shorter. If they say "not interested" -> "Totally fair. Have a good day, {{first_name}}." If they stay silent -> move to permission check anyway.

## 3. Permission Check
- Ask for time explicitly
- Time request must be small (10-20 seconds)
- Must include an easy out
- Must be phrased as a choice between continuing briefly or stopping
- Must NOT ask "Is this a good time?"
- GUARDRAILS: If they say yes -> proceed. If they say "I'm busy" -> "When would be less crazy? I can call back." If they say no -> "No problem. Appreciate it." and hang up. Do NOT try to convince them.

## 4. Relevance Anchor (Read Verbatim)
- This section sits BETWEEN the Permission Check and the first discovery question.
- Purpose: link the prospect's likely current behavior to a hidden cost using a SPECIFIC micro-scenario from their industry.
- It must be 1-2 sentences MAX.
- It MUST use a concrete, industry-specific scenario. NOT generic business language.
- It must reference a pattern ("what we usually see with [specific ICP type] at this stage is [specific thing that happens]") rather than a personal claim about them.
- It MUST include light uncertainty. Use phrasing like "I might be off" or "not sure if that's true for you."
- It must end with a soft check that invites them to confirm or deny without pressure.
- BANNED: "increase revenue", "get more value", "old leads", "untapped potential", any abstract benefit language.
- GUARDRAILS: If they confirm -> proceed to Ownership Trigger. If they say "not really" -> "Got it. What does your situation look like instead?" If they push back -> "Fair enough. Sounds like you've got that handled. Appreciate your time."

## 5. Ownership Trigger Question
- ONE question that makes the prospect describe what currently happens in their business.
- This question must NOT be yes/no. It must force them to explain their current reality.
- Structure: "What usually happens when [specific situation from Relevance Anchor]?"
- GUARDRAILS: If they give a real answer -> listen, then proceed to Micro-Commitment. If they give a short dismissive answer -> "Makes sense. Is that something that bugs you or is it just part of the deal?" If they say "I don't know" -> "Totally fair. Most people we talk to say [common answer]. Does that sound about right?" If they get annoyed -> exit: "I hear you. Appreciate you taking the call, {{first_name}}."

## 6. Test Question 2 (optional)
- Only include if it adds value. Max ONE additional question.
- Must build on what was revealed by the Ownership Trigger Question.
- Must not stack or repeat.
- GUARDRAILS: If they engage -> proceed. If tone shortens -> skip directly to Micro-Commitment. Never force this beat.

## 7. Micro-Commitment Step
- This beat is MANDATORY before any meeting suggestion.
- Purpose: confirm the prospect cares enough to look at a fix. This is SMALLER than asking for a meeting.
- CRITICAL RULE: NEVER suggest a meeting before this step gets a positive response.
- It must NOT mention meetings, demos, calls, or scheduling.
- Example structures:
  - "Would it even be worth looking at how that gets fixed, or is it just one of those things you live with?"
  - "If there was a way to catch those before they disappear, would that even matter to you right now?"
- GUARDRAILS: If they say yes -> proceed to Earned Next Step. If they say "not really" or "we're fine" -> "Totally get it. I'll leave you to it. Have a good one, {{first_name}}." Do NOT push. If they're unsure -> rephrase once: "No pressure either way. Just checking if it's even on your radar." If still unsure -> offer to follow up later and exit.

## 8. Earned Next Step (Read Verbatim)
- ONLY reach this beat if the Micro-Commitment Step got a positive or curious response.
- Structure (all 3 parts mandatory):
  1. **Reflection** (1 sentence): "Based on what you said about [confirmed issue]..."
  2. **Reason** (1 sentence): "That's usually where [ICP type] see [specific thing improve]."
  3. **Time-Boxed Choice** (1 question): Offer TWO specific time options. NEVER open-ended.
     - Correct: "If it makes sense, we can walk through how that works in about 10 minutes. Would later today or tomorrow morning be easier?"
     - BANNED: "Would you be open to a quick call?" / "Can we set up a meeting?"
- GUARDRAILS:
  - If they pick a time -> "Perfect. I'll send over a quick invite. Talk to you then, {{first_name}}."
  - If they say "leave it" -> "No problem at all. If anything changes, you've got my number. Have a good one."
  - If they say "just send me an email" -> go to Email Fallback.
  - NEVER argue with "leave it." Accept it instantly.

## 8b. Email Fallback Branch
- Triggered when prospect says "just send me an email."
- Do NOT treat as rejection. Treat as redirect.
- Structure:
  1. "Sure, happy to. Is {{email}} still the best one to use?"
  2. "What would be most useful to see? The way it works on the [scenario] side, or more of the numbers behind it?"
  3. "Got it. I'll send that over today. If it looks interesting, we can always jump on a quick call from there. Appreciate your time, {{first_name}}."

=== HARD RULES FOR BEGINNER REPS ===

These rules must be EMBEDDED in the script flow, not just stated:
1. NEVER ask for a meeting before confirming they have the problem (Micro-Commitment Step must come first).
2. NEVER argue with a prospect. If they push back, agree and exit.
3. If they say "no" twice on anything, exit immediately. No third attempt.
4. If their tone gets sharp, shorten your next response to one sentence max.
5. If you don't know what to say, say: "That makes sense. Let me not take up more of your time. Appreciate it, {{first_name}}."
6. Every exit must include their first name and "appreciate your time" or similar.

=== VARIABLE FORMAT ===

Use these dynamic variables throughout the script:
- {{first_name}} for the prospect's first name
- {{last_name}} for the prospect's last name
- {{company}} for the prospect's company name
- {{title}} for the prospect's job title
- {{email}} for the prospect's email
- {{phone}} for the prospect's phone number

These are Dialer-compatible. Use them naturally. Never use [Name] or [Company] bracket format.

=== QUALITY CONTROL (MANDATORY) ===

Before finalizing, verify ALL of these:

1. Win Condition section appears FIRST before any beats
2. Every single beat has GUARDRAILS with interrupt, pushback, and exit branches
3. Relevance Anchor includes light uncertainty phrasing
4. Ownership Trigger Question forces prospect to describe reality (not yes/no)
5. Micro-Commitment Step appears BEFORE any meeting suggestion
6. Earned Next Step uses two specific time options, never open-ended
7. Email Fallback Branch has email confirm + angle question + clean exit
8. No line sounds like marketing copy
9. Every line is speakable in one breath
10. No stacked questions
11. Zero em dashes
12. Zero instances of "we specialize", "increase revenue", "get more value"
13. Every scenario is specific to ${industry}
14. Dynamic variables use {{variable}} format
15. Every exit line includes {{first_name}} and a respectful close
16. The script can be pasted directly into a Dialer with zero edits

If any check fails, rewrite before outputting.

=== ANTI-AI FILTER ===

Read every line out loud. If it sounds like something a marketer wrote, rewrite it until it sounds like something a person would say while leaning against a truck or sitting in a break room.

-> More specific in language
-> More flexible in flow

=== FINAL OUTPUT RULES ===

- Start with ## Win Condition, then ## beats in order
- No explanations, no intent labels, no meta commentary
- No emojis, no hype, no sales fluff, no jargon, no em dashes
- Output the script and nothing else.`;
}

// ========== DECISION PLAYBOOK PROMPT ==========

function buildPlaybookPrompt(ctx: OfferContext, scriptText: string, deliveryMechanism: string): string {
  const industry = ctx.icp_industry?.replace(/_/g, ' ') || 'their industry';
  const maturity = ctx.icp_maturity?.replace(/_/g, ' ') || 'unknown stage';

  return `You are writing a tactical behavior manual for a BEGINNER sales rep who has never made a cold call before. They will read this BEFORE or DURING calls.

=== WHAT THIS IS ===

This is a battlefield manual. Not a philosophy document. Not a training course.

Every line must answer: "What exactly do I do when X happens?"

If a beginner rep reads this in 60 seconds, they should feel less nervous and know exactly what to do in the 5 most common situations.

=== TONE RULES ===

- Direct. Short. No fluff.
- Write like you're texting a nervous friend before their first call.
- No sales jargon, no theory, no abstract concepts.
- No "earn the right to continue." Instead: "Your only goal in the first 20 seconds is to avoid being hung up on."
- No philosophy. Only instructions.

=== ABSOLUTE RULES ===

1. No confidence bands or confidence labels
2. No dialogue or script lines (those belong in the Script tab only)
3. No numeric thresholds
4. No qualification criteria
5. No outcome promises
6. No abstract theory or frameworks
7. Nothing the rep cannot act on immediately
8. Every bullet must be a specific instruction, not a concept
9. No emojis, no filler
10. Everything must be scannable in under 60 seconds

Context: ${industry} businesses at ${maturity} stage. Delivery: "${deliveryMechanism}".

THE SCRIPT (for reference only, do NOT repeat script lines):
${scriptText}

=== OUTPUT STRUCTURE (exactly 7 sections, use ## headings) ===

## Conversation Win Condition

- State in plain language what a "win" looks like on this call. Not a closed deal. Not a qualified lead. Just a small win.
- Use this format:
  - **You win if:** [3 specific things, e.g. "They answer one real question about their business"]
  - **You lose if:** [3 specific things, e.g. "You explain the offer before they confirm the problem"]
  - **Exit immediately if:** [3 triggers, e.g. "They say no twice", "Tone gets sharp", "Silence after your question"]

## Tone and Pacing

- Specific instructions on HOW to sound. Not what to say, but how to say it.
- Must include ALL of these:
  - Speak slower than feels natural. If you think you're going slow enough, go slower.
  - Your voice should sound like you're asking a neighbor a question, not presenting to a room.
  - Lower your pitch slightly. Nervous people go high-pitched.
  - Pause after every question. Count to 3 in your head before saying anything else.
  - If you catch yourself speeding up, stop mid-sentence and restart slower.

## Listening Rules

- Specific instructions on WHEN to talk and when to shut up.
- Must include ALL of these:
  - After you ask a question, stop talking. Do not fill silence.
  - If they're talking, do not interrupt. Even if they pause.
  - If they give a one-word answer, wait 3 seconds. They'll usually say more.
  - If they ask you a question, answer in one sentence, then ask them something back.
  - Never stack two questions. Ask one. Wait. Then decide if you need another.

## Hard Rules (Never Break These)

- Specific prohibitions with consequences. Must include ALL of these:
  - Never ask for a meeting before they confirm they have the problem.
  - Never argue. If they disagree, say "That makes sense" and move on or exit.
  - If they say "no" twice to anything, exit. No third attempt. Say: "Totally get it. Appreciate your time."
  - If their tone gets sharp, shorten your next response to one sentence max. Then offer to hang up.
  - Never explain the offer unless they specifically ask "what do you do?"
  - If you don't know what to say, say: "That makes sense. Let me not take up more of your time."
  - Never say "just one more thing" or try to squeeze in extra info before hanging up.

## What To Do When Things Go Wrong

- Specific recovery instructions for the 5 most common problems:
  1. **They interrupt you mid-sentence:** Stop talking immediately. Let them finish. Then say the shortest version of what you were going to say.
  2. **They say "who is this?":** Give your name and one sentence. "I'm [name], calling about [micro-scenario]. Wanted to check if it's relevant to you."
  3. **They say "send me an email":** "Sure. Is {{email}} still best? What angle would be most useful?" Then exit cleanly.
  4. **They go silent after your question:** Wait 3 full seconds. If still silent, say: "No pressure either way. Just checking if that's on your radar."
  5. **They get hostile:** Do not match energy. Say: "Sounds like I caught you at a bad time. I'll let you go. Have a good one, {{first_name}}." Hang up. Do not wait for a response.

## Next-Move Logic

- Simple if/then instructions:
  - If they engage with a question -> stay curious, ask one more thing, then move toward Micro-Commitment
  - If they confirm the problem matters -> proceed to meeting ask
  - If they say "not really" at any point -> exit politely, no second attempt
  - If they say "call me back" -> confirm when, note it, and exit
  - If they accept a meeting -> confirm time, say you'll send an invite, and hang up cleanly
  - If they say "email me" -> confirm email, ask what angle, send, follow up in 2 days

## Why This Script Works (For Your Confidence)

- 3-4 short bullets explaining why the structure works. Written for a nervous beginner, not a sales manager.
- Key points:
  - You're not trying to sell anything on this call. You're just checking if something is relevant.
  - The micro-commitment step means you never ask for a meeting out of nowhere. They've already said the problem matters.
  - Offering two time options instead of "are you free?" makes it easier for them to say yes.
  - If they say no, accepting immediately makes them more likely to take your next call.

=== QUALITY CONTROL ===

Before finalizing, verify:
1. No script lines repeated from the Script tab
2. No jargon or abstract theory anywhere
3. No philosophy. Every line is an instruction.
4. Every bullet is something a nervous beginner can DO right now
5. A rep can scan this in 60 seconds and feel more confident
6. All 7 sections are present with ## headings
7. The "What To Do When Things Go Wrong" section covers all 5 scenarios
8. Hard Rules section includes all mandatory rules

=== FINAL OUTPUT RULES ===

- Exactly 7 sections with ## headings. No more.
- No preamble, no summary, no closing remarks.
- No em dashes. Use periods and short sentences.`;
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
