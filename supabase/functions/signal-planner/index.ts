import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil(promise: Promise<any>): void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ════════════════════════════════════════════════════════════════
// ██  ACTOR CATALOG — the single source of truth for all actors
// ════════════════════════════════════════════════════════════════

interface InputField {
  type: "string" | "number" | "boolean" | "string[]" | "enum";
  required?: boolean;
  default?: any;
  values?: string[];
  description: string;
}

interface ActorEntry {
  key: string;
  actorId: string;
  label: string;
  category: string;
  description: string;
  inputSchema: Record<string, InputField>;
  outputFields: Record<string, string[]>;
}

const ACTOR_CATALOG: ActorEntry[] = [
  // ── Hiring Intent ──
  {
    key: "linkedin_jobs",
    actorId: "sovereigntaylor/linkedin-jobs-scraper",
    label: "LinkedIn Jobs",
    category: "hiring_intent",
    description: "Scrapes LinkedIn job postings. Best for hiring intent — find companies actively hiring for specific roles like SDRs, sales reps, marketers, etc.",
    inputSchema: {
      keyword:          { type: "string",  required: true, description: "Job search keyword (e.g. 'sales representative')" },
      location:         { type: "string",  default: "United States", description: "Location filter" },
      maxResults:       { type: "number",  default: 100, description: "Max job listings to scrape" },
      timePosted:       { type: "enum",    values: ["any", "past24h", "pastWeek", "pastMonth"], default: "pastWeek", description: "Recency filter. Use 'past24h' for last 24 hours, 'pastWeek' for last 7 days, 'pastMonth' for last 30 days." },
      scrapeJobDetails: { type: "boolean", default: true, description: "Include full job descriptions" },
    },
    outputFields: {
      company_name:   ["companyName", "company"],
      title:          ["jobTitle", "title", "position"],
      website:        ["companyLink", "companyUrl", "companyWebsite"],
      linkedin:       ["companyLink", "companyLinkedinUrl", "companyUrl"],
      location:       ["jobLocation", "location", "place"],
      city:           ["city", "jobLocation"],
      state:          ["state"],
      country:        ["country"],
      phone:          [],
      email:          ["email", "contactEmail"],
      description:    ["jobDescription", "description"],
      industry:       ["industry", "companyIndustry"],
      employee_count: ["employeeCount", "companySize"],
      salary:         ["salary"],
      apply_link:     ["applyLink"],
    },
  },
  {
    key: "indeed_jobs",
    actorId: "consummate_mandala/indeed-job-listings-scraper",
    label: "Indeed Jobs",
    category: "hiring_intent",
    description: "Scrapes Indeed job postings. Broader job board coverage than LinkedIn. Good for finding SMBs hiring in specific locations.",
    inputSchema: {
      keywords:   { type: "string[]", required: true, description: "Job search keywords (auto-set from search_query)" },
      location:   { type: "string",  default: "United States", description: "Location filter" },
      maxResults: { type: "number",  default: 100, description: "Max results" },
    },
    outputFields: {
      company_name: ["company", "companyName"],
      title:        ["positionName", "title", "jobTitle"],
      website:      ["companyUrl", "url"],
      linkedin:     [],
      location:     ["location", "jobLocation"],
      city:         ["city"],
      state:        ["state"],
      country:      ["country"],
      phone:        [],
      email:        [],
      description:  ["description", "jobDescription"],
      salary:       ["salary"],
      apply_link:   ["url", "applyLink"],
    },
  },

  // ── Local Business ──
  {
    key: "google_maps",
    actorId: "nwua9Gu5YrADL7ZDj",
    label: "Google Maps",
    category: "local_business",
    description: "Scrapes Google Maps places. Best for local businesses, agencies, service providers. Returns phone, website, reviews, ratings.",
    inputSchema: {
      searchStringsArray:        { type: "string[]", required: true, description: "Search queries (auto-set from search_query)" },
      maxCrawledPlacesPerSearch: { type: "number",   default: 200, description: "Max places per search" },
      language:                  { type: "string",   default: "en", description: "Language code" },
      locationQuery:             { type: "string",   description: "Optional city/state/country filter" },
    },
    outputFields: {
      company_name:   ["title", "name"],
      website:        ["website", "url"],
      linkedin:       [],
      location:       ["address", "fullAddress", "location"],
      city:           ["city"],
      state:          ["state"],
      country:        ["countryCode", "country"],
      phone:          ["phone", "telephone"],
      email:          ["email", "emails"],
      description:    ["description", "categoryName"],
      industry:       ["categoryName", "category"],
      employee_count: [],
    },
  },
  {
    key: "yelp",
    actorId: "yin5oHQaJGRfmJhlN",
    label: "Yelp",
    category: "local_business",
    description: "Scrapes Yelp business listings. Good for local service businesses with review data.",
    inputSchema: {
      searchTerms: { type: "string[]", required: true, description: "Search queries (auto-set)" },
      locations:   { type: "string[]", default: ["United States"], description: "City names to search" },
      maxItems:    { type: "number",   default: 200, description: "Max items" },
    },
    outputFields: {
      company_name: ["name", "title"],
      website:      ["website", "url"],
      linkedin:     [],
      location:     ["address", "neighborhood", "fullAddress"],
      city:         ["city"],
      state:        ["state"],
      country:      ["country"],
      phone:        ["phone", "displayPhone"],
      email:        ["email"],
      description:  ["categories"],
      industry:     ["categories"],
    },
  },
  {
    key: "yellow_pages",
    actorId: "trudax/yellow-pages-us-scraper",
    label: "Yellow Pages",
    category: "local_business",
    description: "Scrapes Yellow Pages US listings. Traditional business directory with addresses and phone numbers.",
    inputSchema: {
      search:   { type: "string", required: true, description: "Business category to search" },
      location: { type: "string", required: true, description: "City, state or zip code" },
      maxItems: { type: "number", default: 200, description: "Max results" },
    },
    outputFields: {
      company_name: ["name", "businessName", "title"],
      website:      ["website", "url"],
      linkedin:     [],
      location:     ["address", "fullAddress", "street"],
      city:         ["city"],
      state:        ["state"],
      country:      [],
      phone:        ["phone", "phoneNumber"],
      email:        ["email"],
      description:  ["categories", "description"],
      industry:     ["categories"],
    },
  },

  // ── Company Data ──
  {
    key: "linkedin_companies",
    actorId: "2SyF0bVxmgGr8IVCZ",
    label: "LinkedIn Companies",
    category: "company_data",
    description: "Scrapes LinkedIn company profiles. Best for enriching companies found from other sources. Returns employee count, industry, headquarters.",
    inputSchema: {
      urls:        { type: "string[]", description: "Array of LinkedIn company URLs" },
      searchQuery: { type: "string",   description: "OR a text search query" },
      maxResults:  { type: "number",   default: 100, description: "Max results" },
    },
    outputFields: {
      company_name:   ["name", "title"],
      website:        ["website", "url"],
      linkedin:       ["linkedinUrl", "url"],
      location:       ["headquarters", "location"],
      city:           ["city", "headquartersCity"],
      state:          ["state"],
      country:        ["country", "headquartersCountry"],
      phone:          ["phone"],
      email:          ["email"],
      description:    ["description", "tagline"],
      industry:       ["industry", "industries"],
      employee_count: ["employeeCount", "staffCount", "employeesOnLinkedIn"],
    },
  },

  // ── Contact Enrichment ──
  {
    key: "contact_enrichment",
    actorId: "9Sk4JJhEma9vBKqrg",
    label: "Contact Enrichment",
    category: "enrichment",
    description: "Extracts emails, phone numbers, social media profiles, and contact details from company websites. Give it a list of URLs and it crawls contact/about pages to find emails and phones. Best used AFTER discovering companies from another source.",
    inputSchema: {
      startUrls:             { type: "string[]", required: true, description: "List of website URLs to extract contacts from" },
      maxRequestsPerStartUrl: { type: "number",  default: 5, description: "Pages to crawl per website" },
      maxDepth:              { type: "number",   default: 2, description: "Link depth to follow" },
      sameDomain:            { type: "boolean",  default: true, description: "Stay within same domain" },
      mergeContacts:         { type: "boolean",  default: true, description: "Merge all contacts per domain into one row" },
    },
    outputFields: {
      company_name: ["companyName", "name", "title"],
      website:      ["domain", "url", "website"],
      linkedin:     ["linkedIn", "linkedin", "linkedInUrl"],
      location:     ["address", "location"],
      city:         ["city"],
      state:        ["state"],
      country:      ["country"],
      phone:        ["phones", "phone", "phoneNumbers"],
      email:        ["emails", "email", "emailAddresses"],
      description:  ["description"],
      industry:     [],
    },
  },

  // ── Web Search ──
  {
    key: "google_search",
    actorId: "nFJndFXA5zjCTuudP",
    label: "Google Search",
    category: "web_search",
    description: "Scrapes Google Search results. Good for finding specific types of companies via targeted Google queries. Returns titles, URLs, descriptions.",
    inputSchema: {
      queries:          { type: "string[]", required: true, description: "Search queries (auto-set)" },
      maxPagesPerQuery: { type: "number",   default: 3, description: "Pages per query" },
      resultsPerPage:   { type: "number",   default: 10, description: "Results per page" },
    },
    outputFields: {
      company_name: ["title"],
      website:      ["url", "link"],
      linkedin:     [],
      location:     [],
      city:         [],
      state:        [],
      country:      [],
      phone:        [],
      email:        [],
      description:  ["description", "snippet"],
    },
  },
];

// ── Lookup helpers ──
const CATALOG_BY_KEY = new Map(ACTOR_CATALOG.map((a) => [a.key, a]));

function getActor(key: string): ActorEntry | undefined {
  return CATALOG_BY_KEY.get(key);
}

// ════════════════════════════════════════════════════════════════
// ██  GENERIC INPUT BUILDER — driven by catalog inputSchema
// ════════════════════════════════════════════════════════════════

function buildGenericInput(actor: ActorEntry, plan: any): Record<string, any> {
  const sp = plan.search_params || {};
  const result: Record<string, any> = {};

  for (const [field, schema] of Object.entries(actor.inputSchema)) {
    let value = sp[field];

    // Auto-fill array fields from search_query
    if (value === undefined && schema.type === "string[]" && schema.required) {
      value = [plan.search_query];
    }
    // Auto-fill required string from search_query
    if (value === undefined && schema.type === "string" && schema.required) {
      value = plan.search_query;
    }
    // Apply default
    if (value === undefined && schema.default !== undefined) {
      value = schema.default;
    }

    if (value === undefined) continue;

    // Enforce enum — also fix common AI mistakes
    if (schema.type === "enum" && schema.values) {
      const ENUM_ALIASES: Record<string, string> = {
        "pastDay": "past24h", "past_day": "past24h", "past24hours": "past24h", "last24h": "past24h",
        "past_week": "pastWeek", "last_week": "pastWeek", "7days": "pastWeek",
        "past_month": "pastMonth", "last_month": "pastMonth", "30days": "pastMonth",
      };
      if (typeof value === "string" && !schema.values.includes(value)) {
        value = ENUM_ALIASES[value] ?? schema.default;
      }
    }

    result[field] = value;
  }

  return result;
}

// ════════════════════════════════════════════════════════════════
// ██  GENERIC RESULT NORMALIZER — driven by catalog outputFields
// ════════════════════════════════════════════════════════════════

function normaliseGenericResults(actor: ActorEntry, items: any[]): any[] {
  return items.map((item) => {
    const normalised: Record<string, any> = {};

    for (const [outputKey, sourcePaths] of Object.entries(actor.outputFields)) {
      let value: any = null;
      for (const path of sourcePaths) {
        const v = item[path];
        if (v !== undefined && v !== null && v !== "") {
          value = Array.isArray(v) ? v[0] : v;
          if (Array.isArray(v) && outputKey === "description") {
            value = v.join(", ");
          }
          break;
        }
      }
      normalised[outputKey] = value;
    }

    normalised._raw = item;
    return normalised;
  });
}

// ════════════════════════════════════════════════════════════════
// ██  MULTI-SOURCE CATEGORY MAPPING
// ════════════════════════════════════════════════════════════════

const MULTI_SOURCE_GROUPS: Record<string, string[]> = {
  hiring_intent: ["linkedin_jobs", "indeed_jobs"],
  local_business: ["google_maps", "yelp"],
};

// ════════════════════════════════════════════════════════════════
// ██  BUILD AI SYSTEM PROMPT — includes full catalog for selection
// ════════════════════════════════════════════════════════════════

function buildPlannerSystemPrompt(): string {
  const catalogDescription = ACTOR_CATALOG.map((actor, idx) => {
    const params = Object.entries(actor.inputSchema)
      .map(([name, s]) => {
        let desc = `${name} (${s.type}${s.required ? ", REQUIRED" : ""})`;
        if (s.default !== undefined) desc += ` [default: ${JSON.stringify(s.default)}]`;
        if (s.values) desc += ` [values: ${s.values.join(", ")}]`;
        desc += ` — ${s.description}`;
        return `     ${desc}`;
      })
      .join("\n");

    const outputs = Object.entries(actor.outputFields)
      .filter(([, paths]) => paths.length > 0)
      .map(([key, paths]) => `     ${key} ← ${paths.join(" | ")}`)
      .join("\n");

    return `${idx + 1}. key: "${actor.key}" — ${actor.label} [${actor.category}]
   ${actor.description}
   Input params:
${params}
   Output fields:
${outputs}`;
  }).join("\n\n");

  return `You are a lead generation signal planner. Given a user's description of leads they want, create structured scraping plans.

AVAILABLE ACTORS (use ONLY these actor keys and ONLY the listed input params):

${catalogDescription}

RULES:
- You MUST pick actor keys from the list above.
- search_params MUST only contain fields listed in that actor's Input params.
- MULTI-SOURCE: When the query involves hiring intent, return plans for BOTH "linkedin_jobs" AND "indeed_jobs". When it involves local/service businesses, return plans for BOTH "google_maps" AND "yelp". Return a JSON ARRAY of plan objects, one per source. If only one source is appropriate, return a single-element array.
- Each plan in the array has its own source, search_query, search_params, filters, and ai_classification tailored to that specific actor's input schema.
- For company enrichment, use "linkedin_companies".
- For general web discovery, use "google_search".
- ai_classification is a text description of an AI filter applied AFTER scraping. Use it to narrow results by company type, size, or relevance. Use the SAME ai_classification across all plans in a multi-source array.
- IMPORTANT: Put ALL keyword variations in "search_query" separated by " OR " (e.g. "SDR OR BDR OR Appointment Setter OR Sales Representative"). The engine will automatically split on OR and run each keyword as a separate search, then merge results. In "search_params", put only the FIRST/primary keyword in the keyword field as a fallback.
- For hiring intent queries, ALWAYS prefer timePosted "pastWeek" / datePosted "7days" unless the user explicitly says "today only" or "last 24 hours". The "past24h"/"today" window is extremely restrictive and frequently returns zero results for niche roles.

Return a JSON ARRAY of plan objects. Each object has this structure:
{
  "signal_name": "short descriptive name",
  "source": "<actor_key from list above>",
  "search_query": "the main search term (use OR to list variations)",
  "search_params": { ONLY valid params for the chosen actor },
  "fields_to_collect": ["field1", "field2"],
  "filters": [{"field": "field_name", "operator": "<|>|=|contains|not_contains", "value": "value"}],
  "ai_classification": "description of AI check to run on each result, or null if not needed",
  "estimated_rows": number,
  "estimated_leads_after_filter": number
}

Example for a hiring query: return an array of 2 plans (one for linkedin_jobs, one for indeed_jobs).
Example for a local business query: return an array of 2 plans (one for google_maps, one for yelp).
Example for a company enrichment query: return a single-element array.

Be realistic with estimates. Always return valid JSON only, no markdown.`;
}

// ════════════════════════════════════════════════════════════════
// ██  MAIN HANDLER
// ════════════════════════════════════════════════════════════════

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
      // Credit check before background execution
      const { run_id, workspace_id } = params;
      const { data: run, error: runError } = await serviceClient
        .from("signal_runs")
        .select("*")
        .eq("id", run_id)
        .single();
      if (runError || !run) {
        return new Response(JSON.stringify({ error: "Signal run not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (run.user_id !== user.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
      // Update status to running
      await serviceClient
        .from("signal_runs")
        .update({
          status: "running",
          schedule_type: params.schedule_type || "once",
          schedule_hour: params.schedule_hour || null,
          next_run_at: params.schedule_type === "daily" ? new Date(Date.now() + 86400000).toISOString() : null,
        })
        .eq("id", run_id);
      // Execute in background
      EdgeRuntime.waitUntil(
        handleExecuteSignal(run, workspace_id, balance, serviceClient)
      );
      return new Response(
        JSON.stringify({ status: "running", run_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

// ════════════════════════════════════════════════════════════════
// ██  GENERATE PLAN
// ════════════════════════════════════════════════════════════════

async function handleGeneratePlan(
  params: { query: string; workspace_id: string; plan_override?: any },
  userId: string,
  serviceClient: any
) {
  const { query, workspace_id, plan_override } = params;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const systemPrompt = buildPlannerSystemPrompt();

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

  let parsedPlan: any;
  try {
    parsedPlan = JSON.parse(planText);
  } catch {
    throw new Error("AI returned invalid plan. Please try rephrasing your query.");
  }

  // Normalize to array (backward compat: AI might return single object)
  let plans: any[] = Array.isArray(parsedPlan) ? parsedPlan : [parsedPlan];

  // Apply template overrides if provided (apply to all plans)
  if (plan_override) {
    plans = plans.map(p => {
      const updated = { ...p };
      if (plan_override.source) updated.source = plan_override.source;
      if (plan_override.search_params) updated.search_params = { ...updated.search_params, ...plan_override.search_params };
      if (plan_override.ai_classification) updated.ai_classification = plan_override.ai_classification;
      return updated;
    });
  }

  // Validate all actor keys exist in catalog
  plans = plans.map(p => {
    const actor = getActor(p.source);
    if (!actor) {
      console.warn(`AI selected unknown actor "${p.source}", falling back to google_maps`);
      p.source = "google_maps";
    }
    return p;
  });

  // Aggregate cost estimation across all plans — override AI guesses with formula
  let totalEstimatedRows = 0;
  let totalCreditsToCharge = 0;
  let totalEstimatedLeads = 0;
  const sourceLabels: string[] = [];

  for (const plan of plans) {
    const resolvedActor = getActor(plan.source)!;
    sourceLabels.push(resolvedActor.label);

    // Formula-based estimation: count OR-separated keywords × actor's max results default
    const keywords = plan.search_query ? plan.search_query.split(/\s+OR\s+/i) : [""];
    const keywordCount = Math.max(1, keywords.length);
    const maxField = Object.keys(resolvedActor.inputSchema).find(f => f.toLowerCase().includes("max"));
    const maxPerKeyword = maxField
      ? (plan.search_params?.[maxField] || resolvedActor.inputSchema[maxField]?.default || 100)
      : 100;
    // Each keyword gets maxPerKeyword/keywordCount results (since we split), so total ≈ maxPerKeyword
    const formulaEstimatedRows = keywordCount * Math.max(50, Math.ceil(maxPerKeyword / keywordCount));
    // Override AI's guess with formula-based estimate
    plan.estimated_rows = formulaEstimatedRows;

    const scrapeCostUsd = (plan.estimated_rows / 1000) * 0.25;
    const aiFilterRows = plan.ai_classification ? plan.estimated_rows : 0;
    const aiFilterCostUsd = aiFilterRows * 0.001;
    const actualCostUsd = (scrapeCostUsd + aiFilterCostUsd) * 1.2;
    const chargedPriceUsd = actualCostUsd * 3;
    const credits = Math.max(5, Math.ceil(chargedPriceUsd * 5));

    totalEstimatedRows += plan.estimated_rows;
    totalCreditsToCharge += credits;
    // Estimated leads: with AI filter ~30%, without ~60%
    const filterRate = plan.ai_classification ? 0.3 : 0.6;
    totalEstimatedLeads += plan.estimated_leads_after_filter || Math.floor(plan.estimated_rows * filterRate);
  }

  const costPerLead = totalEstimatedLeads > 0 ? (totalCreditsToCharge / totalEstimatedLeads).toFixed(1) : "N/A";

  // Use the first plan's signal_name as the overall name
  const signalName = plans[0]?.signal_name || "Signal";

  const { data: run, error: insertError } = await serviceClient
    .from("signal_runs")
    .insert({
      user_id: userId,
      workspace_id,
      signal_name: signalName,
      signal_query: query,
      signal_plan: plans, // Store as array in JSONB
      estimated_cost: totalCreditsToCharge,
      estimated_leads: totalEstimatedLeads,
      status: "planned",
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return new Response(
    JSON.stringify({
      run_id: run.id,
      plan: plans, // Return array
      estimation: {
        estimated_rows: totalEstimatedRows,
        estimated_leads: totalEstimatedLeads,
        credits_to_charge: totalCreditsToCharge,
        cost_per_lead: costPerLead,
        source_label: sourceLabels.join(" + "),
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ════════════════════════════════════════════════════════════════
// ██  EXECUTE SIGNAL
// ════════════════════════════════════════════════════════════════

async function handleExecuteSignal(
  run: any,
  workspace_id: string,
  balance: number,
  serviceClient: any
) {
  const run_id = run.id;
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");

  const runLog: any[] = [];
  const log = (step: string, data: any) => runLog.push({ step, ts: new Date().toISOString(), ...data });

  // Status already set to "running" by the main handler

  // Backward compat: signal_plan can be a single object (old) or array (new)
  const storedPlan = run.signal_plan;
  const plans: any[] = Array.isArray(storedPlan) ? storedPlan : [storedPlan];

  try {
    let allRawResults: any[] = [];
    let allNormalised: any[] = [];

    // ── Execute each source plan ──
    for (const plan of plans) {
      const actor = getActor(plan.source);
      if (!actor) {
        log("skip_unknown_actor", { source: plan.source });
        continue;
      }

      log("source_start", { source: actor.label, key: actor.key });

      // Split compound keywords
      const keywordFields = ["keyword", "search", "searchQuery"];
      const keywordField = keywordFields.find(f => actor.inputSchema[f]);
      const searchQueryHasOR = plan.search_query && /\s+OR\s+/i.test(plan.search_query);
      const rawKeyword = searchQueryHasOR
        ? plan.search_query
        : (plan.search_params?.[keywordField!] || plan.search_query || "");
      const keywords = splitCompoundKeywords(rawKeyword);
      const isMultiKeyword = keywords.length > 1;

      log("keyword_split", { source: actor.key, original: rawKeyword, split: keywords, count: keywords.length });

      let sourceRawResults: any[] = [];

      for (const keyword of keywords) {
        const iterPlan = { ...plan, search_query: keyword, search_params: { ...plan.search_params } };
        if (keywordField && iterPlan.search_params[keywordField]) {
          iterPlan.search_params[keywordField] = keyword;
        }
        const arrayFields = ["searchStringsArray", "queries", "searchTerms"];
        for (const af of arrayFields) {
          if (actor.inputSchema[af]) {
            iterPlan.search_params[af] = [keyword];
          }
        }

        // Divide maxResults across keywords, ensure minimum of 50 per keyword
        const maxField = Object.keys(actor.inputSchema).find(f => f.toLowerCase().includes("max"));
        if (maxField && isMultiKeyword && iterPlan.search_params[maxField]) {
          iterPlan.search_params[maxField] = Math.max(50, Math.ceil(iterPlan.search_params[maxField] / keywords.length));
        } else if (maxField && !iterPlan.search_params[maxField]) {
          iterPlan.search_params[maxField] = 100;
        }

        const queryHash = btoa(JSON.stringify({ source: plan.source, query: keyword, params: iterPlan.search_params })).slice(0, 64);
        const { data: cached } = await serviceClient
          .from("signal_dataset_cache")
          .select("*")
          .eq("query_hash", queryHash)
          .eq("source", plan.source)
          .gte("created_at", new Date(Date.now() - 86400000).toISOString())
          .maybeSingle();

        if (cached?.dataset && Array.isArray(cached.dataset) && cached.dataset.length > 0 && !cached.dataset[0]?.error) {
          sourceRawResults.push(...cached.dataset);
          log("cache_hit", { source: actor.key, keyword, rows: cached.dataset.length });
        } else {
          const actorInput = buildGenericInput(actor, iterPlan);
          // Add proxy config for LinkedIn actors
          if (actor.key === "linkedin_jobs" || actor.key === "linkedin_companies") {
            actorInput.proxyConfiguration = { useApifyProxy: true };
          }
          log("apify_request", { source: actor.key, keyword, actorId: actor.actorId, input: actorInput });

          const runResponse = await fetch(
            `https://api.apify.com/v2/acts/${actor.actorId}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(actorInput),
            }
          );

          if (!runResponse.ok) {
            const errText = await runResponse.text();
            log("apify_error", { source: actor.key, keyword, status: runResponse.status, body: errText.slice(0, 500) });
            // Continue on individual failures for multi-keyword or multi-source
            console.error(`Apify error for ${actor.key}/"${keyword}": ${errText.slice(0, 200)}`);
            continue;
          }

          const keywordResults = await runResponse.json();
          log("apify_response", { source: actor.key, keyword, rows: keywordResults.length });
          sourceRawResults.push(...keywordResults);

          const isValidData = keywordResults.length > 0 && !keywordResults[0]?.error;
          if (isValidData) {
            await serviceClient.from("signal_dataset_cache").upsert({
              query_hash: queryHash,
              source: plan.source,
              dataset: keywordResults,
              row_count: keywordResults.length,
            }, { onConflict: "query_hash,source" });
          }
        }
      }

      // Deduplicate raw results from multi-keyword runs per source
      if (isMultiKeyword && sourceRawResults.length > 0) {
        const seen = new Set<string>();
        const deduped: any[] = [];
        for (const item of sourceRawResults) {
          const url = item.url || item.link || item.companyUrl || item.applyLink || "";
          const companyTitle = `${item.companyName || item.company || item.name || item.title || ""}::${item.jobTitle || item.title || item.positionName || ""}`.toLowerCase();
          const key = url || companyTitle;
          if (key && !seen.has(key)) {
            seen.add(key);
            deduped.push(item);
          } else if (!key) {
            deduped.push(item);
          }
        }
        log("multi_keyword_dedup", { source: actor.key, before: sourceRawResults.length, after: deduped.length });
        sourceRawResults = deduped;
      }

      allRawResults.push(...sourceRawResults);

      // Normalise this source's results using its own output field mapping
      const normalised = normaliseGenericResults(actor, sourceRawResults);
      // Tag each normalised result with its source for lead storage
      for (const n of normalised) {
        n._source_label = actor.label;
      }
      allNormalised.push(...normalised);

      log("source_complete", { source: actor.key, rawRows: sourceRawResults.length, normalised: normalised.length });
    }

    log("all_sources_complete", { totalRaw: allRawResults.length, totalNormalised: allNormalised.length });

    // ── Apply non-AI filters (use first plan's filters — they should be the same across plans) ──
    const filters = plans[0]?.filters;
    let filtered = allNormalised;
    if (filters && filters.length > 0) {
      filtered = allNormalised.filter((item: any) => {
        return filters.every((f: any) => {
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
      log("static_filter", { before: allNormalised.length, after: filtered.length });
    }

    // ── AI classification (use first plan's ai_classification) ──
    const aiClassification = plans[0]?.ai_classification;
    let aiFilteredCount = 0;
    if (aiClassification && filtered.length > 0) {
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
                  content: `You are a lead classifier. For each business in the list, determine if it matches this criteria: "${aiClassification}". Return a JSON array of booleans, one per business. Only return the JSON array, nothing else.`,
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

    // ── Deduplicate ──
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

    // ── Store leads (use per-item source label) ──
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
      source: item._source_label || plans[0]?.source || "Unknown",
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

    // ── Calculate actual cost ──
    const scrapedRows = allRawResults.length;
    const scrapeCostUsd = (scrapedRows / 1000) * 0.25;
    const aiFilterCostUsd = aiFilteredCount * 0.001;
    const actualCostUsd = (scrapeCostUsd + aiFilterCostUsd) * 1.2;
    const chargedPriceUsd = actualCostUsd * 3;
    let actualCredits = Math.max(5, Math.ceil(chargedPriceUsd * 5));

    // Zero-result credit protection
    if (uniqueLeads.length === 0) {
      actualCredits = 0;
      log("zero_result_protection", { message: "No leads discovered, credits not charged" });
    }

    if (actualCredits > 0) {
      const { error: creditError } = await serviceClient
        .from("lead_credits")
        .update({ credits_balance: balance - actualCredits })
        .eq("workspace_id", workspace_id);
      if (creditError) console.error("Credit deduction error:", creditError);
    }

    log("complete", { leads: uniqueLeads.length, credits: actualCredits });

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

    // Background execution complete — no Response to return
    console.log(`Signal ${run_id} completed: ${uniqueLeads.length} leads, ${actualCredits} credits`);
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

/**
 * Splits compound keyword strings into individual search terms.
 * Handles: "SDR OR BDR OR 'Sales Rep'" → ["SDR", "BDR", "Sales Rep"]
 * Also handles comma-separated: "SDR, BDR, Sales Rep" → ["SDR", "BDR", "Sales Rep"]
 * Single keywords pass through as-is: "SDR" → ["SDR"]
 */
function splitCompoundKeywords(keyword: string): string[] {
  if (!keyword) return [keyword || ""];
  
  // Check for OR separator (case insensitive, with spaces)
  if (/\s+OR\s+/i.test(keyword)) {
    return keyword
      .split(/\s+OR\s+/i)
      .map(k => k.replace(/^['"]|['"]$/g, "").trim())
      .filter(k => k.length > 0);
  }
  
  // Check for comma separator (but not inside quotes)
  if (keyword.includes(",") && !keyword.startsWith("http")) {
    return keyword
      .split(",")
      .map(k => k.replace(/^['"]|['"]$/g, "").trim())
      .filter(k => k.length > 0);
  }
  
  // Single keyword — strip quotes
  return [keyword.replace(/^['"]|['"]$/g, "").trim()];
}
