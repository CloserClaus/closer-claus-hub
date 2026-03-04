import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_ACTOR_MAP: Record<string, { actorId: string; label: string }> = {
  google_maps: { actorId: "nwua9Gu5YrADL7ZDj", label: "Google Maps" },
  linkedin_jobs: { actorId: "AtsAgajsFjMVfxXJZ", label: "LinkedIn Jobs" },
  linkedin_companies: { actorId: "2SyF0bVxmgGr8IVCZ", label: "LinkedIn Companies" },
  google_search: { actorId: "nFJndFXA5zjCTuudP", label: "Google Search" },
  yelp: { actorId: "yin5oHQaJGRfmJhlN", label: "Yelp" },
};

// ── Actor-specific input builders with REAL Apify schemas ──
function buildActorInput(source: string, plan: any): Record<string, any> {
  const sp = plan.search_params || {};
  switch (source) {
    case "linkedin_jobs":
      return {
        keyword: sp.keyword || plan.search_query,
        location: sp.location || "",
        timePosted: sp.timePosted || "pastWeek",       // pastDay | pastWeek | pastMonth
        rows: Math.min(sp.rows || plan.estimated_rows || 100, 500),
        proxy: { useApifyProxy: true },
      };
    case "linkedin_companies":
      return {
        urls: sp.urls || [],
        searchQuery: sp.searchQuery || plan.search_query,
        maxResults: Math.min(sp.maxResults || plan.estimated_rows || 100, 500),
        proxy: { useApifyProxy: true },
      };
    case "google_maps":
      return {
        searchStringsArray: [plan.search_query],
        maxCrawledPlacesPerSearch: Math.min(plan.estimated_rows || 200, 3000),
        language: "en",
        ...(sp.locationQuery ? { locationQuery: sp.locationQuery } : {}),
      };
    case "google_search":
      return {
        queries: sp.queries || [plan.search_query],
        maxPagesPerQuery: sp.maxPagesPerQuery || 3,
        resultsPerPage: sp.resultsPerPage || 10,
      };
    case "yelp":
      return {
        searchTerms: [plan.search_query],
        locations: sp.locations || ["United States"],
        maxItems: Math.min(plan.estimated_rows || 200, 1000),
      };
    default:
      return {
        searchStringsArray: [plan.search_query],
        maxCrawledPlacesPerSearch: Math.min(plan.estimated_rows || 200, 3000),
        language: "en",
      };
  }
}

// ── Normalise raw results from different actors into a common shape ──
function normaliseResults(source: string, items: any[]): any[] {
  switch (source) {
    case "linkedin_jobs":
      return items.map((item) => ({
        company_name: item.companyName || item.company || null,
        title: item.title || item.position || null,
        website: item.companyUrl || item.companyLink || null,
        linkedin: item.companyLinkedinUrl || item.companyUrl || null,
        location: item.location || item.place || null,
        phone: null,
        email: item.email || item.contactEmail || null,
        description: item.description || "",
        _raw: item,
      }));
    case "linkedin_companies":
      return items.map((item) => ({
        company_name: item.name || item.title || null,
        website: item.website || item.url || null,
        linkedin: item.linkedinUrl || item.url || null,
        location: item.headquarters || item.location || null,
        phone: item.phone || null,
        email: item.email || null,
        description: item.description || item.tagline || "",
        employee_count: item.employeeCount || item.staffCount || null,
        _raw: item,
      }));
    case "google_maps":
      return items.map((item) => ({
        company_name: item.title || item.name || null,
        website: item.website || item.url || null,
        linkedin: null,
        location: item.address || item.city || null,
        phone: item.phone || item.telephone || null,
        email: item.email || item.emails?.[0] || null,
        description: item.description || item.categoryName || "",
        _raw: item,
      }));
    case "yelp":
      return items.map((item) => ({
        company_name: item.name || item.title || null,
        website: item.website || item.url || null,
        linkedin: null,
        location: item.address || item.neighborhood || null,
        phone: item.phone || null,
        email: item.email || null,
        description: item.categories?.join(", ") || "",
        _raw: item,
      }));
    default:
      return items.map((item) => ({
        company_name: item.title || item.name || item.company_name || null,
        website: item.website || item.url || null,
        linkedin: item.linkedin || item.linkedinUrl || null,
        location: item.address || item.city || item.location || null,
        phone: item.phone || item.telephone || null,
        email: item.email || null,
        description: item.description || "",
        _raw: item,
      }));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, ...params } = await req.json();

    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

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
  params: { query: string; workspace_id: string; plan_override?: any },
  userId: string,
  serviceClient: any
) {
  const { query, workspace_id, plan_override } = params;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const systemPrompt = `You are a lead generation signal planner. Given a user's description of leads they want, create a structured scraping plan.

Available data sources with their EXACT Apify input parameters:

1. "google_maps" — Google Maps Places scraper
   Input: searchStringsArray (auto-set), maxCrawledPlacesPerSearch, language, locationQuery (optional city/state filter)
   Returns: title, website, phone, address, categoryName, totalScore, reviewsCount
   Best for: Local businesses, agencies, service providers

2. "linkedin_jobs" — LinkedIn Job Postings scraper
   Input: keyword (job search term), location (city/country), timePosted ("pastDay" | "pastWeek" | "pastMonth"), rows (max results)
   Returns: title (job title), companyName, companyUrl, location, description
   Best for: Hiring intent signals — companies actively hiring for roles

3. "linkedin_companies" — LinkedIn Company Profiles scraper
   Input: urls (array of LinkedIn company URLs) OR searchQuery, maxResults
   Returns: name, website, headquarters, employeeCount, description, industry
   Best for: Enriching company data after finding them from another source

4. "google_search" — Google Search results scraper
   Input: queries (array of search strings), maxPagesPerQuery, resultsPerPage
   Returns: title, url, description
   Best for: Finding specific types of companies via Google

5. "yelp" — Yelp Business scraper
   Input: searchTerms (array), locations (array of city names), maxItems
   Returns: name, phone, address, categories, website
   Best for: Local service businesses with reviews

IMPORTANT RULES FOR search_params:
- Only use parameter names listed above for each source
- For linkedin_jobs: "keyword" is the job search term, NOT the company type
- For hiring intent signals: use linkedin_jobs with job-related keywords (e.g. "sales representative", "SDR", "account executive")
- For finding local businesses directly: use google_maps
- ai_classification is a text description of an AI filter to apply AFTER scraping. Use it to filter by company type, size, relevance, etc.

Return a JSON object with this exact structure:
{
  "signal_name": "short descriptive name",
  "source": "one of: google_maps, linkedin_jobs, linkedin_companies, google_search, yelp",
  "search_query": "the main search term",
  "search_params": { ONLY valid params for the chosen source },
  "fields_to_collect": ["field1", "field2"],
  "filters": [{"field": "field_name", "operator": "<|>|=|contains|not_contains", "value": "value"}],
  "ai_classification": "description of AI check to run on each result, or null if not needed",
  "estimated_rows": number between 50-3000,
  "estimated_leads_after_filter": number
}

Be realistic with estimates. Always return valid JSON only, no markdown.`;

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
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw new Error(`AI gateway error: ${status}`);
  }

  const aiResult = await response.json();
  let planText = aiResult.choices?.[0]?.message?.content || "";
  planText = planText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let plan;
  try {
    plan = JSON.parse(planText);
  } catch {
    throw new Error("AI returned invalid plan. Please try rephrasing your query.");
  }

  // Apply template overrides if provided
  if (plan_override) {
    if (plan_override.source) plan.source = plan_override.source;
    if (plan_override.search_params) plan.search_params = { ...plan.search_params, ...plan_override.search_params };
    if (plan_override.ai_classification) plan.ai_classification = plan_override.ai_classification;
  }

  // Validate source
  if (!APIFY_ACTOR_MAP[plan.source]) {
    plan.source = "google_maps";
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

  // Cost estimation
  const scrapeCostUsd = (plan.estimated_rows / 1000) * 0.25;
  const aiFilterRows = plan.ai_classification ? plan.estimated_rows : 0;
  const aiFilterCostUsd = aiFilterRows * 0.001;
  const actualCostUsd = (scrapeCostUsd + aiFilterCostUsd) * 1.2;
  const chargedPriceUsd = actualCostUsd * 3;
  const creditsToCharge = Math.max(5, Math.ceil(chargedPriceUsd * 5));

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

  const runLog: any[] = [];
  const log = (step: string, data: any) => runLog.push({ step, ts: new Date().toISOString(), ...data });

  const { data: run, error: runError } = await serviceClient
    .from("signal_runs")
    .select("*")
    .eq("id", run_id)
    .single();

  if (runError || !run) throw new Error("Signal run not found");
  if (run.user_id !== userId) throw new Error("Unauthorized");

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
    // ── Step 1: Check dataset cache ──
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
      log("cache_hit", { rows: rawResults.length });
    } else {
      // ── Step 2: Build actor-specific input and run Apify ──
      const actorInput = buildActorInput(plan.source, plan);
      log("apify_request", { actor: actorInfo.actorId, source: plan.source, input: actorInput });

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
        log("apify_error", { status: runResponse.status, body: errText.slice(0, 500) });
        throw new Error(`Apify error [${runResponse.status}]: ${errText.slice(0, 300)}`);
      }

      rawResults = await runResponse.json();
      log("apify_response", { rows: rawResults.length });

      // Cache the dataset
      if (rawResults.length > 0) {
        await serviceClient.from("signal_dataset_cache").upsert({
          query_hash: queryHash,
          source: plan.source,
          dataset: rawResults,
          row_count: rawResults.length,
        }, { onConflict: "query_hash,source" });
      }
    }

    // ── Step 3: Normalise results ──
    const normalised = normaliseResults(plan.source, rawResults);
    log("normalised", { count: normalised.length });

    // ── Step 4: Apply non-AI filters ──
    let filtered = normalised;
    if (plan.filters && plan.filters.length > 0) {
      filtered = normalised.filter((item: any) => {
        return plan.filters.every((f: any) => {
          const val = item[f.field] ?? item._raw?.[f.field];
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
      log("static_filter", { before: normalised.length, after: filtered.length });
    }

    // ── Step 5: AI classification ──
    let aiFilteredCount = 0;
    if (plan.ai_classification && filtered.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
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
                    name: b.company_name || b.title,
                    description: b.description || "",
                    website: b.website || "",
                    location: b.location || "",
                    employee_count: b.employee_count || null,
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
              bools = batch.map(() => true);
            }
            batch.forEach((item: any, idx: number) => {
              if (bools[idx]) classified.push(item);
            });
            aiFilteredCount += batch.length;
          } else {
            classified.push(...batch);
          }
        }
        filtered = classified;
        log("ai_classification", { processed: aiFilteredCount, passed: filtered.length });
      }
    }

    // ── Step 6: Deduplicate ──
    const { data: existingKeys } = await serviceClient
      .from("signal_dedup_keys")
      .select("dedup_key, dedup_type")
      .eq("workspace_id", workspace_id);

    const existingSet = new Set((existingKeys || []).map((k: any) => `${k.dedup_type}:${k.dedup_key}`));

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
    let dedupRemoved = 0;

    for (const item of filtered) {
      const domain = extractDomain(item.website || "");
      const phone = (item.phone || "").replace(/\D/g, "");
      const linkedin = item.linkedin || "";

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
      } else {
        dedupRemoved++;
      }
    }
    log("dedup", { before: filtered.length, after: uniqueLeads.length, removed: dedupRemoved });

    // ── Step 7: Store leads ──
    const leadsToInsert = uniqueLeads.map((item) => ({
      run_id,
      workspace_id,
      company_name: item.company_name || null,
      website: item.website || null,
      domain: extractDomain(item.website || ""),
      phone: item.phone || null,
      email: item.email || null,
      linkedin: item.linkedin || null,
      location: item.location || null,
      source: actorInfo.label,
      extra_data: item._raw || item,
    }));

    if (leadsToInsert.length > 0) {
      const { data: insertedLeads } = await serviceClient
        .from("signal_leads")
        .insert(leadsToInsert)
        .select("id");

      if (insertedLeads && newDedupKeys.length > 0) {
        const dedupWithIds = newDedupKeys.map((dk, idx) => ({
          ...dk,
          signal_lead_id: insertedLeads[Math.min(idx, insertedLeads.length - 1)]?.id || null,
        }));
        await serviceClient.from("signal_dedup_keys").insert(dedupWithIds).select();
      }
    }

    // ── Step 8: Calculate actual cost — DON'T charge if 0 results ──
    const scrapedRows = rawResults.length;
    const scrapeCostUsd = (scrapedRows / 1000) * 0.25;
    const aiFilterCostUsd = aiFilteredCount * 0.001;
    const actualCostUsd = (scrapeCostUsd + aiFilterCostUsd) * 1.2;
    const chargedPriceUsd = actualCostUsd * 3;
    let actualCredits = Math.max(5, Math.ceil(chargedPriceUsd * 5));

    // Zero-result credit protection: don't charge if no leads found
    if (uniqueLeads.length === 0) {
      actualCredits = 0;
      log("zero_result_protection", { message: "No leads discovered, credits not charged" });
    }

    // Deduct credits only if > 0
    if (actualCredits > 0) {
      const { error: creditError } = await serviceClient
        .from("lead_credits")
        .update({ credits_balance: balance - actualCredits })
        .eq("workspace_id", workspace_id);
      if (creditError) console.error("Credit deduction error:", creditError);
    }

    log("complete", { leads: uniqueLeads.length, credits: actualCredits });

    // Update run status with log
    await serviceClient
      .from("signal_runs")
      .update({
        status: "completed",
        actual_cost: actualCredits,
        leads_discovered: uniqueLeads.length,
        last_run_at: new Date().toISOString(),
        run_log: runLog,
      })
      .eq("id", run_id);

    return new Response(
      JSON.stringify({
        success: true,
        leads_discovered: uniqueLeads.length,
        credits_charged: actualCredits,
        total_scraped: rawResults.length,
        total_filtered: filtered.length,
        run_log: runLog,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    log("error", { message: error instanceof Error ? error.message : String(error) });
    await serviceClient
      .from("signal_runs")
      .update({ status: "failed", run_log: runLog })
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
