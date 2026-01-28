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
  const systemPrompt = `You evaluate buying readiness for outbound campaigns.
The user has already filtered for ICP. DO NOT judge ICP fit.
Only evaluate how ready they are to buy based on company maturity, proof, outbound leverage, founder involvement, and market signals.

Output STRICT JSON with no commentary:
{
  "readiness_score": <0-100>,
  "signals": [array of strings describing positive or negative signals found],
  "verdict": "HOT|WARM|COOL|COLD"
}

Mapping rules:
- HOT: score >= 75
- WARM: score >= 55 and < 75
- COOL: score >= 35 and < 55
- COLD: score < 35

Consider these signals when reading provided context:

POSITIVE SIGNALS:
- founder selling / founder-led sales
- hiring outbound / SDR roles
- posting case studies or portfolio
- pricing above freelancer level
- consistent website activity
- offering high-urgency services
- market proof demonstrated
- recent funding or expansion
- technical / marketing sophistication

NEGATIVE SIGNALS:
- no website or placeholder site
- no client proof or portfolio
- sells B2C only (but do not fail them, just score cooler)
- no founder presence
- low activity on web
- unclear service positioning
- tiny bootstrapped solopreneur with no leverage

The offer context should influence only if the target is mature enough to engage.`;

  const userPrompt = `Here is the lead:
{
  "company_name": "${lead.company_name || "Unknown"}",
  "job_title": "${lead.title || "Unknown"}",
  "company_domain": "${lead.company_domain || "Not available"}",
  "linkedin_company_url": "${lead.company_linkedin_url || "Not available"}",
  "linkedin_person_url": "${lead.linkedin_url || "Not available"}"
}

Offer context:
${JSON.stringify(offerContext, null, 2)}`;

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
