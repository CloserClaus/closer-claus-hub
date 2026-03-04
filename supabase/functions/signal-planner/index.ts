import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_ACTOR_MAP: Record<string, { actorId: string; label: string }> = {
  google_maps: { actorId: "nwua9Gu5YrADL7ZDj", label: "Google Maps" },
  linkedin_jobs: { actorId: "hMvNSpz3JnHgl5jkh", label: "LinkedIn Jobs" },
  linkedin_companies: { actorId: "2SyF0bVxmgGr8IVCZ", label: "LinkedIn Companies" },
  google_search: { actorId: "nFJndFXA5zjCTuudP", label: "Google Search" },
  yelp: { actorId: "yin5oHQaJGRfmJhlN", label: "Yelp" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, ...params } = await req.json();

    // Auth check
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // Create user client to get user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "generate_plan") {
      return await handleGeneratePlan(params, user.id, serviceClient);
    } else if (action === "execute_signal") {
      return await handleExecuteSignal(params, user.id, serviceClient);
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("signal-planner error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleGeneratePlan(
  params: { query: string; workspace_id: string },
  userId: string,
  serviceClient: any
) {
  const { query, workspace_id } = params;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const systemPrompt = `You are a lead generation signal planner. Given a user's description of leads they want, create a structured scraping plan.

Available data sources and their Apify actor keys:
- google_maps: Google Maps business listings
- linkedin_jobs: LinkedIn job postings
- linkedin_companies: LinkedIn company profiles
- google_search: Google search results
- yelp: Yelp business listings

Return a JSON object with this exact structure:
{
  "signal_name": "short descriptive name",
  "source": "one of the actor keys above",
  "search_query": "the search query to use",
  "search_params": { any additional parameters for the actor },
  "fields_to_collect": ["field1", "field2"],
  "filters": [{"field": "field_name", "operator": "<|>|=|contains|not_contains", "value": "value"}],
  "ai_classification": "description of AI check to run on each result, or null if not needed",
  "estimated_rows": number between 50-3000,
  "estimated_leads_after_filter": number
}

Be realistic with estimates. Consider the specificity of the query.
If the query is very broad, estimate higher rows. If specific, estimate lower.
Always return valid JSON only, no markdown.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw new Error(`AI gateway error: ${status}`);
  }

  const aiResult = await response.json();
  let planText = aiResult.choices?.[0]?.message?.content || "";
  
  // Strip markdown code fences if present
  planText = planText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let plan;
  try {
    plan = JSON.parse(planText);
  } catch {
    throw new Error("AI returned invalid plan. Please try rephrasing your query.");
  }

  // Validate source
  if (!APIFY_ACTOR_MAP[plan.source]) {
    plan.source = "google_maps"; // fallback
  }

  // Safety limits
  if (plan.estimated_rows > 3000) {
    return new Response(
      JSON.stringify({
        error: "This query may scan over 3,000 records. Please narrow the search by location or niche.",
        plan,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Cost estimation with 95% margin rule
  // Apify cost estimate: ~$0.25 per 1000 rows scraped
  const scrapeCostUsd = (plan.estimated_rows / 1000) * 0.25;
  // AI filtering cost: ~$0.01 per row if ai_classification is needed
  const aiFilterRows = plan.ai_classification ? plan.estimated_rows : 0;
  const aiFilterCostUsd = aiFilterRows * 0.01;
  // 20% infrastructure buffer
  const actualCostUsd = (scrapeCostUsd + aiFilterCostUsd) * 1.2;
  // 95% gross margin: charged_price >= actual_cost / 0.05
  const chargedPriceUsd = actualCostUsd / 0.05;
  // $1 = 5 credits
  const creditsToCharge = Math.ceil(chargedPriceUsd * 5);

  // Cap at 200 credits
  if (creditsToCharge > 200) {
    return new Response(
      JSON.stringify({
        error: `Estimated cost is ${creditsToCharge} credits (max 200). Please narrow your search.`,
        plan,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const estimatedLeads = plan.estimated_leads_after_filter || Math.floor(plan.estimated_rows * 0.15);
  const costPerLead = estimatedLeads > 0 ? (creditsToCharge / estimatedLeads).toFixed(1) : "N/A";

  // Create the signal run record
  const { data: run, error: insertError } = await serviceClient
    .from("signal_runs")
    .insert({
      user_id: userId,
      workspace_id,
      signal_name: plan.signal_name,
      signal_query: query,
      signal_plan: plan,
      estimated_cost: creditsToCharge,
      estimated_leads: estimatedLeads,
      status: "planned",
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return new Response(
    JSON.stringify({
      run_id: run.id,
      plan,
      estimation: {
        estimated_rows: plan.estimated_rows,
        estimated_leads: estimatedLeads,
        credits_to_charge: creditsToCharge,
        cost_per_lead: costPerLead,
        source_label: APIFY_ACTOR_MAP[plan.source]?.label || plan.source,
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleExecuteSignal(
  params: { run_id: string; workspace_id: string; schedule_type?: string; schedule_hour?: number },
  userId: string,
  serviceClient: any
) {
  const { run_id, workspace_id, schedule_type, schedule_hour } = params;
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");

  // Get the run
  const { data: run, error: runError } = await serviceClient
    .from("signal_runs")
    .select("*")
    .eq("id", run_id)
    .single();

  if (runError || !run) throw new Error("Signal run not found");
  if (run.user_id !== userId) throw new Error("Unauthorized");

  // Check credits
  const { data: credits } = await serviceClient
    .from("lead_credits")
    .select("credits_balance")
    .eq("workspace_id", workspace_id)
    .maybeSingle();

  const balance = credits?.credits_balance || 0;
  if (balance < run.estimated_cost) {
    return new Response(
      JSON.stringify({ error: `Insufficient credits. Need ${run.estimated_cost}, have ${balance}.` }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update status
  await serviceClient
    .from("signal_runs")
    .update({
      status: "running",
      schedule_type: schedule_type || "once",
      schedule_hour: schedule_hour || null,
      next_run_at: schedule_type === "daily" ? new Date(Date.now() + 86400000).toISOString() : null,
    })
    .eq("id", run_id);

  const plan = run.signal_plan;
  const actorInfo = APIFY_ACTOR_MAP[plan.source];
  if (!actorInfo) throw new Error(`Unknown source: ${plan.source}`);

  try {
    // Check dataset cache first
    const queryHash = btoa(JSON.stringify({ source: plan.source, query: plan.search_query, params: plan.search_params })).slice(0, 64);
    const { data: cached } = await serviceClient
      .from("signal_dataset_cache")
      .select("*")
      .eq("query_hash", queryHash)
      .eq("source", plan.source)
      .gte("created_at", new Date(Date.now() - 86400000).toISOString())
      .maybeSingle();

    let rawResults: any[] = [];

    if (cached?.dataset) {
      rawResults = cached.dataset;
    } else {
      // Run Apify actor
      const actorInput: Record<string, any> = {
        searchStringsArray: [plan.search_query],
        maxCrawledPlacesPerSearch: Math.min(plan.estimated_rows, 3000),
        language: "en",
        ...plan.search_params,
      };

      const runResponse = await fetch(
        `https://api.apify.com/v2/acts/${actorInfo.actorId}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(actorInput),
        }
      );

      if (!runResponse.ok) {
        const errText = await runResponse.text();
        throw new Error(`Apify error [${runResponse.status}]: ${errText}`);
      }

      rawResults = await runResponse.json();

      // Cache the dataset
      await serviceClient.from("signal_dataset_cache").upsert({
        query_hash: queryHash,
        source: plan.source,
        dataset: rawResults,
        row_count: rawResults.length,
      }, { onConflict: "query_hash,source" });
    }

    // Step 3: Apply non-AI filters
    let filtered = rawResults;
    if (plan.filters && plan.filters.length > 0) {
      filtered = rawResults.filter((item: any) => {
        return plan.filters.every((f: any) => {
          const val = item[f.field];
          if (val === undefined || val === null) return false;
          switch (f.operator) {
            case "<": return Number(val) < Number(f.value);
            case ">": return Number(val) > Number(f.value);
            case "=": return String(val).toLowerCase() === String(f.value).toLowerCase();
            case "contains": return String(val).toLowerCase().includes(String(f.value).toLowerCase());
            case "not_contains": return !String(val).toLowerCase().includes(String(f.value).toLowerCase());
            default: return true;
          }
        });
      });
    }

    // Step 4: AI classification if needed
    let aiFilteredCount = 0;
    if (plan.ai_classification && filtered.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        // Process in batches of 20
        const batchSize = 20;
        const classified: any[] = [];
        for (let i = 0; i < filtered.length; i += batchSize) {
          const batch = filtered.slice(i, i + batchSize);
          const classifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `You are a lead classifier. For each business in the list, determine if it matches this criteria: "${plan.ai_classification}". Return a JSON array of booleans, one per business. Only return the JSON array, nothing else.`,
                },
                {
                  role: "user",
                  content: JSON.stringify(batch.map((b: any) => ({
                    name: b.title || b.name || b.company_name,
                    description: b.description || b.categoryName || "",
                    website: b.website || b.url || "",
                  }))),
                },
              ],
            }),
          });

          if (classifyResponse.ok) {
            const classResult = await classifyResponse.json();
            let bools: boolean[] = [];
            try {
              const content = classResult.choices?.[0]?.message?.content || "[]";
              bools = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
            } catch {
              bools = batch.map(() => true); // fallback: include all
            }
            batch.forEach((item: any, idx: number) => {
              if (bools[idx]) classified.push(item);
            });
            aiFilteredCount += batch.length;
          } else {
            classified.push(...batch); // on error, include all
          }
        }
        filtered = classified;
      }
    }

    // Step 5: Deduplicate
    const { data: existingKeys } = await serviceClient
      .from("signal_dedup_keys")
      .select("dedup_key, dedup_type")
      .eq("workspace_id", workspace_id);

    const existingSet = new Set((existingKeys || []).map((k: any) => `${k.dedup_type}:${k.dedup_key}`));

    // Also check CRM leads for dedup
    const { data: crmLeads } = await serviceClient
      .from("leads")
      .select("email, phone, linkedin_url")
      .eq("workspace_id", workspace_id);

    const crmSet = new Set<string>();
    (crmLeads || []).forEach((l: any) => {
      if (l.email) crmSet.add(`domain:${l.email.split("@")[1]}`);
      if (l.phone) crmSet.add(`phone:${l.phone.replace(/\D/g, "")}`);
      if (l.linkedin_url) crmSet.add(`linkedin:${l.linkedin_url}`);
    });

    const uniqueLeads: any[] = [];
    const newDedupKeys: any[] = [];

    for (const item of filtered) {
      const domain = extractDomain(item.website || item.url || "");
      const phone = (item.phone || item.telephone || "").replace(/\D/g, "");
      const linkedin = item.linkedin || item.linkedinUrl || "";

      let isDuplicate = false;
      if (domain && (existingSet.has(`domain:${domain}`) || crmSet.has(`domain:${domain}`))) isDuplicate = true;
      if (!isDuplicate && phone && (existingSet.has(`phone:${phone}`) || crmSet.has(`phone:${phone}`))) isDuplicate = true;
      if (!isDuplicate && linkedin && (existingSet.has(`linkedin:${linkedin}`) || crmSet.has(`linkedin:${linkedin}`))) isDuplicate = true;

      if (!isDuplicate) {
        uniqueLeads.push(item);
        if (domain) {
          existingSet.add(`domain:${domain}`);
          newDedupKeys.push({ workspace_id, dedup_key: domain, dedup_type: "domain" });
        }
        if (phone) {
          existingSet.add(`phone:${phone}`);
          newDedupKeys.push({ workspace_id, dedup_key: phone, dedup_type: "phone" });
        }
        if (linkedin) {
          existingSet.add(`linkedin:${linkedin}`);
          newDedupKeys.push({ workspace_id, dedup_key: linkedin, dedup_type: "linkedin" });
        }
      }
    }

    // Step 6: Store leads
    const leadsToInsert = uniqueLeads.map((item) => ({
      run_id,
      workspace_id,
      company_name: item.title || item.name || item.company_name || null,
      website: item.website || item.url || null,
      domain: extractDomain(item.website || item.url || ""),
      phone: item.phone || item.telephone || null,
      linkedin: item.linkedin || item.linkedinUrl || null,
      location: item.address || item.city || item.location || null,
      source: actorInfo.label,
      extra_data: item,
    }));

    if (leadsToInsert.length > 0) {
      const { data: insertedLeads } = await serviceClient
        .from("signal_leads")
        .insert(leadsToInsert)
        .select("id");

      // Store dedup keys with lead IDs
      if (insertedLeads && newDedupKeys.length > 0) {
        // Associate dedup keys with leads (best effort)
        const dedupWithIds = newDedupKeys.map((dk, idx) => ({
          ...dk,
          signal_lead_id: insertedLeads[Math.min(idx, insertedLeads.length - 1)]?.id || null,
        }));
        await serviceClient.from("signal_dedup_keys").insert(dedupWithIds).select();
      }
    }

    // Step 7: Calculate actual cost and deduct credits
    const scrapedRows = rawResults.length;
    const scrapeCostUsd = (scrapedRows / 1000) * 0.25;
    const aiFilterCostUsd = aiFilteredCount * 0.01;
    const actualCostUsd = (scrapeCostUsd + aiFilterCostUsd) * 1.2;
    const chargedPriceUsd = actualCostUsd / 0.05;
    const actualCredits = Math.ceil(chargedPriceUsd * 5);

    // Deduct credits
    await serviceClient.rpc("", {}).catch(() => {}); // no rpc needed, direct update
    const { error: creditError } = await serviceClient
      .from("lead_credits")
      .update({ credits_balance: balance - actualCredits })
      .eq("workspace_id", workspace_id);

    if (creditError) console.error("Credit deduction error:", creditError);

    // Update run status
    await serviceClient
      .from("signal_runs")
      .update({
        status: "completed",
        actual_cost: actualCredits,
        leads_discovered: uniqueLeads.length,
        last_run_at: new Date().toISOString(),
      })
      .eq("id", run_id);

    return new Response(
      JSON.stringify({
        success: true,
        leads_discovered: uniqueLeads.length,
        credits_charged: actualCredits,
        total_scraped: rawResults.length,
        total_filtered: filtered.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Mark as failed
    await serviceClient
      .from("signal_runs")
      .update({ status: "failed" })
      .eq("id", run_id);

    throw error;
  }
}

function extractDomain(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0] || "";
  }
}
