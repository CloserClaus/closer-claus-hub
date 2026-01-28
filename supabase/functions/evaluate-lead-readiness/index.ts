import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CREDIT_COST_PER_LEAD = 0.5;

interface LeadData {
  id: string;
  company_name: string | null;
  company_domain: string | null;
  company_linkedin_url: string | null;
  linkedin_url: string | null;
  title: string | null;
}

interface OfferContext {
  offer_type: string | null;
  promise: string | null;
  vertical_segment: string | null;
  company_size: string | null;
  pricing_structure: string | null;
  price_tier: string | null;
  proof_level: string | null;
  risk_model: string | null;
  fulfillment: string | null;
}

interface EvaluationResult {
  readiness_score: number;
  signals: string[];
  verdict: "HOT" | "WARM" | "COOL" | "COLD";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client for operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create user client to verify auth
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lead_ids, workspace_id } = await req.json();

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return new Response(JSON.stringify({ error: "No lead IDs provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "Workspace ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check credits
    const requiredCredits = lead_ids.length * CREDIT_COST_PER_LEAD;
    const { data: creditsData, error: creditsError } = await supabaseAdmin
      .from("lead_credits")
      .select("credits_balance")
      .eq("workspace_id", workspace_id)
      .maybeSingle();

    if (creditsError) {
      throw new Error(`Failed to check credits: ${creditsError.message}`);
    }

    const currentCredits = creditsData?.credits_balance || 0;
    if (currentCredits < requiredCredits) {
      return new Response(
        JSON.stringify({
          error: "Not enough credits",
          required: requiredCredits,
          available: currentCredits,
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get offer diagnostic state for context
    const { data: offerState } = await supabaseAdmin
      .from("offer_diagnostic_state")
      .select("*")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const offerContext: OfferContext = {
      offer_type: offerState?.offer_type || null,
      promise: offerState?.promise || null,
      vertical_segment: offerState?.vertical_segment || null,
      company_size: offerState?.company_size || null,
      pricing_structure: offerState?.pricing_structure || null,
      price_tier: offerState?.price_tier || null,
      proof_level: offerState?.proof_level || null,
      risk_model: offerState?.risk_model || null,
      fulfillment: offerState?.fulfillment || null,
    };

    // Get leads data
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from("apollo_leads")
      .select("id, company_name, company_domain, company_linkedin_url, linkedin_url, title")
      .in("id", lead_ids)
      .eq("workspace_id", workspace_id);

    if (leadsError) {
      throw new Error(`Failed to fetch leads: ${leadsError.message}`);
    }

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ error: "No leads found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Evaluate each lead
    const results: { id: string; result: EvaluationResult }[] = [];
    const errors: { id: string; error: string }[] = [];

    for (const lead of leads) {
      try {
        const result = await evaluateLead(lead, offerContext, lovableApiKey);
        results.push({ id: lead.id, result });

        // Update the lead in database
        await supabaseAdmin
          .from("apollo_leads")
          .update({
            readiness_score: result.readiness_score,
            readiness_verdict: result.verdict,
            readiness_signals: result.signals,
            readiness_evaluated_at: new Date().toISOString(),
          })
          .eq("id", lead.id);
      } catch (err) {
        console.error(`Error evaluating lead ${lead.id}:`, err);
        errors.push({ id: lead.id, error: String(err) });
      }
    }

    // Deduct credits only for successfully evaluated leads
    const successfulEvaluations = results.length;
    const creditsToDeduct = successfulEvaluations * CREDIT_COST_PER_LEAD;

    if (creditsToDeduct > 0) {
      await supabaseAdmin
        .from("lead_credits")
        .update({ credits_balance: currentCredits - creditsToDeduct })
        .eq("workspace_id", workspace_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        evaluated: results.length,
        errors: errors.length,
        credits_used: creditsToDeduct,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("evaluate-lead-readiness error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function evaluateLead(
  lead: LeadData,
  offerContext: OfferContext,
  apiKey: string
): Promise<EvaluationResult> {
  const systemPrompt = `You are an expert revenue operations analyst specializing in evaluating B2B companies' buying readiness for outbound agency services.

Your output MUST be valid JSON with no explanation and no trailing text.

Your job is to return a readiness score 0–100 and a readiness segment (HOT, WARM, COOL, COLD) based on the agency's Offer Diagnostic context and the company's observable market signals.

You NEVER modify the user's ICP or tell them to change strategy. You only evaluate readiness based on the chosen ICP.

—— CONTEXT LOGIC ——

1. Use the Offer Diagnostic context to understand the user's ICP and promise:
    - offer_type
    - promise
    - ICP industry + vertical segment
    - company size
    - business maturity
    - pricing structure + tier
    - proof level
    - risk model
    - fulfillment complexity

2. Readiness scoring is based on observable signals from the prospect company:

    **Stage Signals (0–40 pts)**
    - Headcount trajectory (hiring page, LinkedIn headcount trend, founders hiring SDRs etc)
    - Recency of founding
    - Market category momentum
    - Presence of sales roles or SDR roles

    **Proof Signals (0–30 pts)**
    - Case studies
    - Testimonials
    - Portfolio
    - Named clients
    - Published metrics

    **Pricing & Positioning Signals (0–20 pts)**
    - Premium, mid, or bargain positioning
    - Website quality & clarity
    - ICP fit strength relative to user's ICP

    **Urgency Signals (0–10 pts)**
    - Active hiring for sales roles
    - Founder publicly posting about growth, lead gen, or scaling problems
    - Recent product launches or pivots

3. Segment Rules:
    - HOT: ≥ 75
    - WARM: 55–74
    - COOL: 35–54
    - COLD: < 35

4. Output STRICT JSON:
{
  "readiness_score": number 0–100,
  "signals": ["array of observable signal strings found"],
  "verdict": "HOT" | "WARM" | "COOL" | "COLD"
}`;

  const userPrompt = `Lead company data from Apollo:
company_name: ${lead.company_name || "Unknown"}
company_domain: ${lead.company_domain || "Not available"}
linkedin_company_url: ${lead.company_linkedin_url || "Not available"}
linkedin_person_url: ${lead.linkedin_url || "Not available"}
job_title: ${lead.title || "Unknown"}

Offer Diagnostic State (JSON):
${JSON.stringify(offerContext, null, 2)}

If no usable company data exists (missing domain AND LinkedIn AND company name), respond:
{
  "readiness_score": 0,
  "signals": ["insufficient-data"],
  "verdict": "COLD"
}

Otherwise evaluate readiness now.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded, please try again later");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted, please add funds");
    }
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response content from AI");
  }

  // Parse JSON from response (handle potential markdown code blocks)
  let jsonStr = content;
  if (content.includes("```json")) {
    jsonStr = content.split("```json")[1].split("```")[0].trim();
  } else if (content.includes("```")) {
    jsonStr = content.split("```")[1].split("```")[0].trim();
  }

  try {
    const result = JSON.parse(jsonStr);
    
    // Validate and normalize the result
    const score = Math.min(100, Math.max(0, Number(result.readiness_score) || 50));
    const signals = Array.isArray(result.signals) ? result.signals : [];
    
    // Determine verdict based on score
    let verdict: "HOT" | "WARM" | "COOL" | "COLD";
    if (score >= 75) verdict = "HOT";
    else if (score >= 55) verdict = "WARM";
    else if (score >= 35) verdict = "COOL";
    else verdict = "COLD";

    return {
      readiness_score: score,
      signals: signals.slice(0, 5), // Limit to 5 signals
      verdict,
    };
  } catch (parseError) {
    console.error("Failed to parse AI response:", content);
    throw new Error("Failed to parse AI response as JSON");
  }
}
