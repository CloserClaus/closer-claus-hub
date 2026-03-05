import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Execution is now handled by process-signal-queue worker

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
      maxResults:       { type: "number",  default: 500, description: "Max job listings to scrape. Set high (500+) because downstream filtering is aggressive." },
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
      maxResults: { type: "number",  default: 500, description: "Max results. Set high (500+) because downstream filtering is aggressive." },
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
      maxCrawledPlacesPerSearch: { type: "number",   default: 500, description: "Max places per search. Set high (500+) because downstream filtering is aggressive." },
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
      maxItems:    { type: "number",   default: 500, description: "Max items. Set high (500+) because downstream filtering is aggressive." },
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
      maxItems: { type: "number", default: 500, description: "Max results. Set high (500+) because downstream filtering is aggressive." },
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
      profileUrls: { type: "string[]", required: true, description: "Array of LinkedIn company profile URLs to scrape" },
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
      // Enqueue for the worker to pick up
      await serviceClient
        .from("signal_runs")
        .update({
          status: "queued",
          schedule_type: params.schedule_type || "once",
          schedule_hour: params.schedule_hour || null,
          next_run_at: params.schedule_type === "daily"
            ? new Date(Date.now() + 86400000).toISOString()
            : params.schedule_type === "weekly"
              ? new Date(Date.now() + 7 * 86400000).toISOString()
              : null,
        })
        .eq("id", run_id);
      return new Response(
        JSON.stringify({ status: "queued", run_id }),
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

// Execution logic has been moved to process-signal-queue/index.ts

function extractDomain(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0] || "";
  }
}
