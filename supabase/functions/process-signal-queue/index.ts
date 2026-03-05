import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Actor Catalog (must stay in sync with signal-planner) ──

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
  {
    key: "linkedin_jobs",
    actorId: "curious_coder/linkedin-jobs-scraper",
    label: "LinkedIn Jobs",
    category: "hiring_intent",
    description: "LinkedIn job postings",
    inputSchema: {
      urls:              { type: "string[]", required: true, description: "LinkedIn job search URLs (constructed from keywords)" },
      count:             { type: "number",  default: 2500, description: "Max job listings" },
      scrapeCompany:     { type: "boolean", default: true, description: "Include company details" },
      splitByLocation:   { type: "boolean", default: false, description: "Split by location to bypass 1000-result cap" },
      splitCountry:      { type: "string",  description: "Country for location splitting (only when splitByLocation=true)" },
    },
    outputFields: {
      company_name: ["companyName", "company"], title: ["title", "jobTitle", "position"],
      website: ["companyWebsite"], linkedin: ["companyLinkedinUrl", "companyUrl"],
      location: ["location", "jobLocation", "place"], city: ["city", "jobLocation"], state: ["state"], country: ["country"],
      phone: [], email: ["email", "contactEmail"], description: ["descriptionHtml", "description"],
      industry: ["companyIndustry", "industries"], employee_count: ["companyEmployeesCount", "companySize"],
      salary: ["salaryInfo", "salary"], apply_link: ["link", "applyLink"],
    },
  },
  {
    key: "indeed_jobs",
    actorId: "valig/indeed-jobs-scraper",
    label: "Indeed Jobs",
    category: "hiring_intent",
    description: "Indeed job postings",
    inputSchema: {
      title:      { type: "string",  required: true, description: "Job title or keywords" },
      location:   { type: "string",  default: "United States", description: "Location filter" },
      country:    { type: "string",  default: "us", description: "Country code (e.g. us, uk, ca)" },
      limit:      { type: "number",  default: 1000, description: "Max results" },
      datePosted: { type: "string",  default: "7", description: "Days since posted (1, 3, 7, 14)" },
    },
    outputFields: {
      company_name: ["company", "companyName", "employer.name"],
      title:        ["positionName", "title", "jobTitle"],
      website:      ["employer.corporateWebsite", "companyUrl"],
      linkedin:     [],
      location:     ["location", "jobLocation", "location.city"],
      city:         ["city", "location.city"],
      state:        ["state", "location.state"],
      country:      ["country", "location.countryName"],
      phone:        [],
      email:        [],
      description:  ["description", "jobDescription", "description.text"],
      salary:       ["salary", "baseSalary"],
      apply_link:   ["url", "applyLink"],
      industry:     ["employer.industry"],
      employee_count: ["employer.employeesCount"],
    },
  },
  {
    key: "google_maps",
    actorId: "nwua9Gu5YrADL7ZDj",
    label: "Google Maps",
    category: "local_business",
    description: "Google Maps places",
    inputSchema: {
      searchStringsArray:        { type: "string[]", required: true, description: "Search queries" },
      maxCrawledPlacesPerSearch: { type: "number",   default: 2000, description: "Max places per search" },
      language:                  { type: "string",   default: "en", description: "Language code" },
      locationQuery:             { type: "string",   description: "Optional city/state/country filter" },
    },
    outputFields: {
      company_name: ["title", "name"], website: ["website", "url"], linkedin: [],
      location: ["address", "fullAddress", "location"], city: ["city"], state: ["state"],
      country: ["countryCode", "country"], phone: ["phone", "telephone"], email: ["email", "emails"],
      description: ["description", "categoryName"], industry: ["categoryName", "category"], employee_count: [],
    },
  },
  {
    key: "yelp",
    actorId: "sovereigntaylor/yelp-scraper",
    label: "Yelp",
    category: "local_business",
    description: "Yelp business listings",
    inputSchema: {
      searchTerms: { type: "string[]", required: true, description: "Search queries" },
      locations:   { type: "string[]", default: ["United States"], description: "City names" },
      maxItems:    { type: "number",   default: 1000, description: "Max items" },
    },
    outputFields: {
      company_name: ["name", "title", "businessName"], website: ["website", "url"], linkedin: [],
      location: ["address", "neighborhood", "fullAddress"], city: ["city"], state: ["state"],
      country: ["country"], phone: ["phone", "displayPhone"], email: ["email"],
      description: ["categories"], industry: ["categories"],
    },
  },
  {
    key: "yellow_pages",
    actorId: "trudax/yellow-pages-us-scraper",
    label: "Yellow Pages",
    category: "local_business",
    description: "Yellow Pages US listings",
    inputSchema: {
      search:   { type: "string", required: true, description: "Business category" },
      location: { type: "string", required: true, description: "City, state or zip" },
      maxItems: { type: "number", default: 1000, description: "Max results" },
    },
    outputFields: {
      company_name: ["name", "businessName", "title"], website: ["website", "url"], linkedin: [],
      location: ["address", "fullAddress", "street"], city: ["city"], state: ["state"], country: [],
      phone: ["phone", "phoneNumber"], email: ["email"], description: ["categories", "description"],
      industry: ["categories"],
    },
  },
  {
    key: "linkedin_companies",
    actorId: "2SyF0bVxmgGr8IVCZ",
    label: "LinkedIn Companies",
    category: "company_data",
    description: "LinkedIn company profiles",
    inputSchema: {
      profileUrls: { type: "string[]", required: true, description: "LinkedIn company profile URLs" },
      maxResults:  { type: "number",   default: 500, description: "Max results" },
    },
    outputFields: {
      company_name: ["name", "title"], website: ["website", "url"], linkedin: ["linkedinUrl", "url"],
      location: ["headquarters", "location"], city: ["city", "headquartersCity"], state: ["state"],
      country: ["country", "headquartersCountry"], phone: ["phone"], email: ["email"],
      description: ["description", "tagline"], industry: ["industry", "industries"],
      employee_count: ["employeeCount", "staffCount", "employeesOnLinkedIn"],
    },
  },
  {
    key: "contact_enrichment",
    actorId: "9Sk4JJhEma9vBKqrg",
    label: "Contact Enrichment",
    category: "enrichment",
    description: "Extract contacts from websites",
    inputSchema: {
      startUrls:             { type: "string[]", required: true, description: "Website URLs" },
      maxRequestsPerStartUrl: { type: "number",  default: 5, description: "Pages to crawl per site" },
      maxDepth:              { type: "number",   default: 2, description: "Link depth" },
      sameDomain:            { type: "boolean",  default: true, description: "Stay within domain" },
      mergeContacts:         { type: "boolean",  default: true, description: "Merge contacts per domain" },
    },
    outputFields: {
      company_name: ["companyName", "name", "title"], website: ["domain", "url", "website"],
      linkedin: ["linkedIn", "linkedin", "linkedInUrl"], location: ["address", "location"],
      city: ["city"], state: ["state"], country: ["country"],
      phone: ["phones", "phone", "phoneNumbers"], email: ["emails", "email", "emailAddresses"],
      description: ["description"], industry: [],
    },
  },
  {
    key: "google_search",
    actorId: "nFJndFXA5zjCTuudP",
    label: "Google Search",
    category: "web_search",
    description: "Google Search results",
    inputSchema: {
      queries:          { type: "string[]", required: true, description: "Search queries" },
      maxPagesPerQuery: { type: "number",   default: 10, description: "Pages per query" },
      resultsPerPage:   { type: "number",   default: 10, description: "Results per page" },
    },
    outputFields: {
      company_name: ["title"], website: ["url", "link"], linkedin: [],
      location: [], city: [], state: [], country: [], phone: [], email: [],
      description: ["description", "snippet"],
    },
  },
];

const CATALOG_BY_KEY = new Map(ACTOR_CATALOG.map((a) => [a.key, a]));
function getActor(key: string): ActorEntry | undefined { return CATALOG_BY_KEY.get(key); }

// ── Utility functions ──

// Dot-path traversal: resolves "employer.name" → item.employer.name
function getNestedValue(obj: any, path: string): any {
  if (!path.includes('.')) return obj[path];
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function buildGenericInput(actor: ActorEntry, plan: any): Record<string, any> {
  const sp = plan.search_params || {};
  const result: Record<string, any> = {};
  for (const [field, schema] of Object.entries(actor.inputSchema)) {
    let value = sp[field];
    if (value === undefined && schema.type === "string[]" && schema.required) value = [plan.search_query];
    if (value === undefined && schema.type === "string" && schema.required) value = plan.search_query;
    if (value === undefined && schema.default !== undefined) value = schema.default;
    if (value === undefined) continue;
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

function normaliseGenericResults(actor: ActorEntry, items: any[]): any[] {
  return items.map((item) => {
    const normalised: Record<string, any> = {};
    for (const [outputKey, sourcePaths] of Object.entries(actor.outputFields)) {
      let value: any = null;
      for (const path of sourcePaths) {
        const v = getNestedValue(item, path);
        if (v !== undefined && v !== null && v !== "") {
          value = Array.isArray(v) ? v[0] : v;
          if (Array.isArray(v) && outputKey === "description") value = v.join(", ");
          break;
        }
      }
      normalised[outputKey] = value;
    }
    normalised._raw = item;
    return normalised;
  });
}

function splitCompoundKeywords(keyword: string): string[] {
  if (!keyword) return [keyword || ""];
  if (/\s+OR\s+/i.test(keyword)) {
    return keyword.split(/\s+OR\s+/i).map(k => k.replace(/^['"]|['"]$/g, "").trim()).filter(k => k.length > 0);
  }
  if (keyword.includes(",") && !keyword.startsWith("http")) {
    return keyword.split(",").map(k => k.replace(/^['"]|['"]$/g, "").trim()).filter(k => k.length > 0);
  }
  return [keyword.replace(/^['"]|['"]$/g, "").trim()];
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

// ═══════════════════════════════════════════════════════════
// ██  APIFY ASYNC HELPERS
// ═══════════════════════════════════════════════════════════

interface ApifyRunRef {
  actorKey: string;
  keyword: string;
  runId: string;
  datasetId: string;
  status: string;
  startedAt?: string;
}

async function startApifyRun(actor: ActorEntry, input: Record<string, any>, token: string): Promise<{ runId: string; datasetId: string }> {
  const actorIdEncoded = actor.actorId.replace("/", "~");
  const resp = await fetch(
    `https://api.apify.com/v2/acts/${actorIdEncoded}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Apify start failed (${resp.status}): ${errText.slice(0, 300)}`);
  }
  const data = await resp.json();
  return {
    runId: data.data.id,
    datasetId: data.data.defaultDatasetId,
  };
}

async function pollApifyRun(runId: string, token: string): Promise<string> {
  const resp = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`,
    { method: "GET" }
  );
  if (!resp.ok) {
    throw new Error(`Apify poll failed (${resp.status})`);
  }
  const data = await resp.json();
  return data.data.status;
}

async function collectApifyResults(datasetId: string, token: string): Promise<any[]> {
  const PAGE_SIZE = 500;
  let allItems: any[] = [];
  let offset = 0;
  while (true) {
    const resp = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=${PAGE_SIZE}&offset=${offset}`,
      { method: "GET" }
    );
    if (!resp.ok) {
      throw new Error(`Apify collect failed (${resp.status})`);
    }
    const items = await resp.json();
    allItems.push(...items);
    if (items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return allItems;
}

// ═══════════════════════════════════════════════════════════
// ██  MAIN HANDLER
// ═══════════════════════════════════════════════════════════

const MAX_RETRIES = 3;
const HARD_CEILING_MS = 60 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const hardCeilingThreshold = new Date(Date.now() - HARD_CEILING_MS).toISOString();

    const { data: activeRuns, error: qErr } = await serviceClient
      .from("signal_runs")
      .select("*")
      .or(
        `status.eq.queued,` +
        `and(status.eq.running,processing_phase.in.(starting,scraping,collecting,finalizing)),` +
        `and(status.eq.running,processing_phase.in.(pending),started_at.lt.${hardCeilingThreshold},retry_count.lt.${MAX_RETRIES}),` +
        `and(status.eq.running,started_at.lt.${hardCeilingThreshold},retry_count.lt.${MAX_RETRIES})`
      )
      .order("created_at", { ascending: true })
      .limit(3);

    if (qErr) throw qErr;

    const { data: scheduledRuns, error: sErr } = await serviceClient
      .from("signal_runs")
      .select("*")
      .in("schedule_type", ["daily", "weekly"])
      .in("status", ["completed"])
      .not("next_run_at", "is", null)
      .lte("next_run_at", new Date().toISOString())
      .limit(1);

    if (sErr) throw sErr;

    const allRuns = [...(activeRuns || []), ...(scheduledRuns || [])];

    if (allRuns.length === 0) {
      return new Response(
        JSON.stringify({ message: "No signals to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${allRuns.length} signals`);

    let processed = 0;
    let failed = 0;

    for (const run of allRuns) {
      const phase = run.processing_phase || "pending";
      const isActivePhase = ["starting", "scraping", "collecting", "finalizing"].includes(phase);

      if (run.status === "running" && !isActivePhase) {
        const newRetryCount = (run.retry_count || 0) + 1;
        if (newRetryCount >= MAX_RETRIES) {
          console.log(`Signal ${run.id} exceeded max retries, marking failed`);
          await serviceClient.from("signal_runs").update({
            status: "failed",
            retry_count: newRetryCount,
            error_message: `Failed after ${MAX_RETRIES} attempts`,
          }).eq("id", run.id);

          if (run.user_id) {
            await serviceClient.from("notifications").insert({
              user_id: run.user_id, workspace_id: run.workspace_id,
              type: "signal_failed", title: "Signal Failed",
              message: `Your signal "${run.signal_name || run.signal_query}" failed after ${MAX_RETRIES} attempts.`,
            });
          }
          failed++;
          continue;
        }
        await serviceClient.from("signal_runs").update({
          status: "queued", retry_count: newRetryCount, started_at: null,
          processing_phase: "pending", apify_run_ids: [], current_keyword_index: 0, collected_dataset_index: 0,
          error_message: `Stale recovery attempt ${newRetryCount}`,
        }).eq("id", run.id);
        continue;
      }

      if (run.status === "completed" && (run.schedule_type === "daily" || run.schedule_type === "weekly")) {
        await serviceClient.from("signal_runs").update({
          status: "queued", started_at: null, processing_phase: "pending",
          apify_run_ids: [], current_keyword_index: 0, collected_dataset_index: 0, error_message: null,
        }).eq("id", run.id);
        continue;
      }

      if (run.status === "queued") {
        const { data: leased, error: leaseErr } = await serviceClient
          .from("signal_runs")
          .update({
            status: "running", started_at: new Date().toISOString(),
            error_message: null, processing_phase: "starting",
            apify_run_ids: [], current_keyword_index: 0, collected_dataset_index: 0,
          })
          .eq("id", run.id)
          .eq("status", "queued")
          .select()
          .maybeSingle();

        if (leaseErr || !leased) {
          console.log(`Could not lease signal ${run.id}, skipping`);
          continue;
        }
        try {
          await processPhase(leased, serviceClient);
          processed++;
        } catch (err) {
          console.error(`Phase error for ${run.id}:`, err);
          await handlePhaseError(run, err, serviceClient);
          failed++;
        }
        continue;
      }

      if (run.status === "running" && isActivePhase) {
        try {
          await processPhase(run, serviceClient);
          processed++;
        } catch (err) {
          console.error(`Phase error for ${run.id}:`, err);
          await handlePhaseError(run, err, serviceClient);
          failed++;
        }
      }
    }

    return new Response(
      JSON.stringify({ message: `Processed ${processed} signals, ${failed} failed`, processed, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-signal-queue error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ═══════════════════════════════════════════════════════════
// ██  PHASE ERROR HANDLER
// ═══════════════════════════════════════════════════════════

async function handlePhaseError(run: any, err: unknown, serviceClient: any) {
  const errorMsg = err instanceof Error ? err.message : String(err);
  const retryCount = (run.retry_count || 0) + 1;

  if (retryCount >= MAX_RETRIES) {
    await serviceClient.from("signal_runs").update({
      status: "failed", retry_count: retryCount,
      error_message: `Failed after ${MAX_RETRIES} attempts: ${errorMsg}`,
    }).eq("id", run.id);

    if (run.user_id) {
      await serviceClient.from("notifications").insert({
        user_id: run.user_id, workspace_id: run.workspace_id,
        type: "signal_failed", title: "Signal Failed",
        message: `Your signal "${run.signal_name || run.signal_query}" failed: ${errorMsg.slice(0, 200)}`,
      });
    }
  } else {
    await serviceClient.from("signal_runs").update({
      status: "queued", retry_count: retryCount, started_at: null,
      processing_phase: "pending", apify_run_ids: [], current_keyword_index: 0, collected_dataset_index: 0,
      error_message: `Attempt ${retryCount} failed: ${errorMsg}`,
    }).eq("id", run.id);
  }
}

// ═══════════════════════════════════════════════════════════
// ██  PHASE ROUTER
// ═══════════════════════════════════════════════════════════

async function processPhase(run: any, serviceClient: any) {
  const phase = run.processing_phase || "pending";
  console.log(`Signal ${run.id} phase=${phase}`);

  switch (phase) {
    case "pending":
    case "starting":
      await phaseStarting(run, serviceClient);
      break;
    case "scraping":
      await phaseScraping(run, serviceClient);
      break;
    case "collecting":
      await phaseCollectingIncremental(run, serviceClient);
      break;
    case "finalizing":
      await phaseFinalizing(run, serviceClient);
      break;
    default:
      throw new Error(`Unknown phase: ${phase}`);
  }
}

// ═══════════════════════════════════════════════════════════
// ██  PHASE 1: STARTING
// ═══════════════════════════════════════════════════════════

async function phaseStarting(run: any, serviceClient: any) {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");

  const workspace_id = run.workspace_id;

  const { data: credits } = await serviceClient
    .from("lead_credits")
    .select("credits_balance")
    .eq("workspace_id", workspace_id)
    .maybeSingle();

  const balance = credits?.credits_balance || 0;
  if (balance < (run.estimated_cost || 0)) {
    if (run.user_id) {
      await serviceClient.from("notifications").insert({
        user_id: run.user_id, workspace_id,
        type: "signal_failed", title: "Signal Paused — Insufficient Credits",
        message: `Your signal "${run.signal_name}" needs ${run.estimated_cost} credits but you only have ${balance}.`,
      });
    }
    const isScheduled = run.schedule_type === "daily" || run.schedule_type === "weekly";
    await serviceClient.from("signal_runs").update({
      status: isScheduled ? "completed" : "failed",
      error_message: "Insufficient credits",
      ...(isScheduled ? { next_run_at: new Date(Date.now() + (run.schedule_type === "weekly" ? 7 * 86400000 : 86400000)).toISOString() } : {}),
    }).eq("id", run.id);
    return;
  }

  const storedPlan = run.signal_plan;
  const plans: any[] = Array.isArray(storedPlan) ? storedPlan : [storedPlan];

  const jobs: { actorKey: string; keyword: string; actor: ActorEntry; input: Record<string, any> }[] = [];

  for (const plan of plans) {
    const actor = getActor(plan.source);
    if (!actor) continue;

    const keywordFields = ["title", "search", "searchQuery"];
    const keywordField = keywordFields.find(f => actor.inputSchema[f]);
    const arrayKeywordFields = ["searchKeywords", "searchStringsArray", "queries", "searchTerms"];
    const arrayKeywordField = arrayKeywordFields.find(f => actor.inputSchema[f]);
    const searchQueryHasOR = plan.search_query && /\s+OR\s+/i.test(plan.search_query);
    const rawKeyword = searchQueryHasOR
      ? plan.search_query
      : (plan.search_params?.[keywordField!] || plan.search_query || "");
    const keywords = splitCompoundKeywords(rawKeyword);

    for (const keyword of keywords) {
      const iterPlan = { ...plan, search_query: keyword, search_params: { ...plan.search_params } };

      // Special handling for LinkedIn: construct search URLs from keywords
      // Actor expects urls as array of strings (plain URLs)
      if (actor.key === "linkedin_jobs" && actor.inputSchema["urls"]) {
        const location = iterPlan.search_params?.searchLocation || iterPlan.search_params?.location || "United States";
        const encodedKeyword = encodeURIComponent(keyword);
        const encodedLocation = encodeURIComponent(location);
        const linkedinUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodedKeyword}&location=${encodedLocation}&f_TPR=r604800`;
        iterPlan.search_params["urls"] = [linkedinUrl];
        // Remove non-schema fields the AI might have set
        delete iterPlan.search_params["searchKeywords"];
        delete iterPlan.search_params["searchLocation"];
        // Don't pass splitCountry unless splitByLocation is explicitly enabled
        if (!iterPlan.search_params["splitByLocation"]) {
          delete iterPlan.search_params["splitCountry"];
        }
      } else {
        if (keywordField && iterPlan.search_params[keywordField]) {
          iterPlan.search_params[keywordField] = keyword;
        }
        if (arrayKeywordField) {
          iterPlan.search_params[arrayKeywordField] = [keyword];
        }
        const otherArrayFields = ["searchStringsArray", "queries", "searchTerms"];
        for (const af of otherArrayFields) {
          if (af !== arrayKeywordField && actor.inputSchema[af]) iterPlan.search_params[af] = [keyword];
        }
      }

      // Use the actor's configured default max (already increased in catalog)
      const maxField = Object.keys(actor.inputSchema).find(f => f.toLowerCase().includes("max") || f === "count" || f === "limit");
      if (maxField && !iterPlan.search_params[maxField]) {
        iterPlan.search_params[maxField] = actor.inputSchema[maxField]?.default || 500;
      }

      const actorInput = buildGenericInput(actor, iterPlan);
      if (!actorInput.proxyConfiguration) {
        actorInput.proxyConfiguration = { useApifyProxy: true };
      }

      jobs.push({ actorKey: actor.key, keyword, actor, input: actorInput });
    }
  }

  const HEAVY_ACTORS = new Set(["linkedin_jobs", "linkedin_companies", "indeed_jobs"]);
  const MAX_START_ATTEMPTS = 5;

  const currentIndex = run.current_keyword_index || 0;
  const existingRefs: ApifyRunRef[] = run.apify_run_ids || [];

  // Retry DEFERRED refs
  for (const ref of existingRefs) {
    if (ref.status !== "DEFERRED") continue;
    const attempts = (ref as any).startAttempts || 1;
    if (attempts >= MAX_START_ATTEMPTS) {
      console.log(`Ref ${ref.actorKey}:"${ref.keyword}" exhausted ${MAX_START_ATTEMPTS} start attempts, marking FAILED`);
      ref.status = "FAILED";
      continue;
    }
    const backoffMs = 30_000 * Math.pow(2, attempts - 1);
    const deferredAt = (ref as any).deferredAt ? new Date((ref as any).deferredAt).getTime() : 0;
    if (Date.now() - deferredAt < backoffMs) continue;

    const actor = getActor(ref.actorKey);
    if (!actor) { ref.status = "FAILED"; continue; }
    const retryJob = jobs.find(j => j.actorKey === ref.actorKey && j.keyword === ref.keyword);
    if (!retryJob) { ref.status = "FAILED"; continue; }

    try {
      const { runId, datasetId } = await startApifyRun(retryJob.actor, retryJob.input, APIFY_API_TOKEN);
      ref.runId = runId;
      ref.datasetId = datasetId;
      ref.status = "RUNNING";
      ref.startedAt = new Date().toISOString();
      (ref as any).startAttempts = attempts + 1;
      console.log(`Retry #${attempts + 1} started for ${ref.actorKey}:"${ref.keyword}" → run ${runId}`);
    } catch (retryErr) {
      const errMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      if (isCapacityError(errMsg)) {
        (ref as any).startAttempts = attempts + 1;
        (ref as any).deferredAt = new Date().toISOString();
        console.log(`Retry #${attempts + 1} for ${ref.actorKey}:"${ref.keyword}" hit capacity again, staying DEFERRED`);
      } else {
        ref.status = "FAILED";
        console.error(`Retry for ${ref.actorKey}:"${ref.keyword}" failed permanently:`, retryErr);
      }
    }
  }

  const BATCH_SIZE = 3;
  const batch = jobs.slice(currentIndex, currentIndex + BATCH_SIZE);

  console.log(`Starting batch: jobs ${currentIndex}-${currentIndex + batch.length - 1} of ${jobs.length}`);

  let heavyStarted = 0;
  const MAX_HEAVY_PER_BATCH = 2;

  for (const job of batch) {
    const isHeavy = HEAVY_ACTORS.has(job.actorKey);
    if (isHeavy && heavyStarted >= MAX_HEAVY_PER_BATCH) {
      console.log(`Throttling heavy actor ${job.actorKey}:"${job.keyword}", deferring to next cycle`);
      continue;
    }

    try {
      const { runId, datasetId } = await startApifyRun(job.actor, job.input, APIFY_API_TOKEN);
      existingRefs.push({
        actorKey: job.actorKey,
        keyword: job.keyword,
        runId,
        datasetId,
        status: "RUNNING",
        startedAt: new Date().toISOString(),
      });
      if (isHeavy) heavyStarted++;
      console.log(`Started Apify run ${runId} for ${job.actorKey}:"${job.keyword}"`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (isCapacityError(errMsg)) {
        console.warn(`Capacity error starting ${job.actorKey}:"${job.keyword}", marking DEFERRED for retry`);
        existingRefs.push({
          actorKey: job.actorKey,
          keyword: job.keyword,
          runId: "",
          datasetId: "",
          status: "DEFERRED",
          startedAt: undefined,
          ...({ startAttempts: 1, deferredAt: new Date().toISOString() } as any),
        });
      } else {
        console.error(`Failed to start ${job.actorKey}:"${job.keyword}":`, err);
        existingRefs.push({
          actorKey: job.actorKey,
          keyword: job.keyword,
          runId: "",
          datasetId: "",
          status: "FAILED",
        });
      }
    }
  }

  const newIndex = currentIndex + batch.length;
  const hasDeferredRefs = existingRefs.some(r => r.status === "DEFERRED");
  const allStarted = newIndex >= jobs.length && !hasDeferredRefs;

  const nextPhaseStarting = allStarted ? "scraping" : "starting";
  await serviceClient.from("signal_runs").update({
    apify_run_ids: existingRefs,
    current_keyword_index: allStarted ? newIndex : currentIndex + batch.length,
    processing_phase: nextPhaseStarting,
    updated_at: new Date().toISOString(),
  }).eq("id", run.id);

  console.log(`Signal ${run.id}: ${allStarted ? "All jobs started, moving to scraping" : `Started ${newIndex}/${jobs.length}${hasDeferredRefs ? ` (${existingRefs.filter(r => r.status === "DEFERRED").length} deferred)` : ""}, will continue next cycle`}`);
}

// ── Capacity error detection ──

function isCapacityError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return lower.includes("actor-memory-limit-exceeded") ||
    lower.includes("memory limit") ||
    (lower.includes("402") && (lower.includes("memory") || lower.includes("capacity")));
}

// ── Abort helper ──

const PER_RUN_TIMEOUT_MS = 15 * 60 * 1000;

async function abortApifyRun(runId: string, token: string): Promise<void> {
  try {
    const resp = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/abort?token=${token}`,
      { method: "POST" }
    );
    if (!resp.ok) {
      console.warn(`Abort request for run ${runId} returned ${resp.status}`);
    } else {
      console.log(`Aborted hung Apify run ${runId}`);
    }
  } catch (err) {
    console.warn(`Failed to abort Apify run ${runId}:`, err);
  }
}

// ═══════════════════════════════════════════════════════════
// ██  PHASE 2: SCRAPING
// ═══════════════════════════════════════════════════════════

async function phaseScraping(run: any, serviceClient: any) {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");

  const refs: ApifyRunRef[] = run.apify_run_ids || [];
  let anyStillRunning = false;
  let updated = false;

  for (const ref of refs) {
    if (!ref.runId || ref.status === "FAILED" || ref.status === "SUCCEEDED" || ref.status === "TIMED-OUT" || ref.status === "ABORTED" || ref.status === "DEFERRED") {
      continue;
    }

    if ((ref.status === "RUNNING" || ref.status === "READY") && ref.startedAt) {
      const elapsedMs = Date.now() - new Date(ref.startedAt).getTime();
      if (elapsedMs > PER_RUN_TIMEOUT_MS) {
        console.log(`Apify run ${ref.runId} (${ref.actorKey}:"${ref.keyword}") exceeded 15-min timeout (${Math.round(elapsedMs / 60000)}min), aborting`);
        await abortApifyRun(ref.runId, APIFY_API_TOKEN);
        ref.status = "TIMED-OUT";
        updated = true;
        continue;
      }
    }

    try {
      const newStatus = await pollApifyRun(ref.runId, APIFY_API_TOKEN);
      if (newStatus !== ref.status) {
        ref.status = newStatus;
        updated = true;
        console.log(`Apify run ${ref.runId} (${ref.actorKey}:"${ref.keyword}"): ${newStatus}`);
      }

      if (newStatus === "RUNNING" || newStatus === "READY") {
        anyStillRunning = true;
      }
    } catch (err) {
      console.error(`Poll error for ${ref.runId}:`, err);
      ref.status = "FAILED";
      updated = true;
    }
  }

  const succeeded = refs.filter(r => r.status === "SUCCEEDED").length;
  const failedCount = refs.filter(r => r.status === "FAILED").length;
  const timedOut = refs.filter(r => r.status === "TIMED-OUT").length;
  const running = refs.filter(r => r.status === "RUNNING" || r.status === "READY").length;
  console.log(`Signal ${run.id} run breakdown: ${succeeded} succeeded, ${failedCount} failed, ${timedOut} timed-out, ${running} still running`);

  const nextPhase = anyStillRunning ? "scraping" : "collecting";

  if (updated || nextPhase !== "scraping") {
    await serviceClient.from("signal_runs").update({
      apify_run_ids: refs,
      processing_phase: nextPhase,
      updated_at: new Date().toISOString(),
    }).eq("id", run.id);
  }

  console.log(`Signal ${run.id}: polling complete, phase=${nextPhase}, stillRunning=${anyStillRunning}`);
}

// ═══════════════════════════════════════════════════════════
// ██  PHASE 3: COLLECTING (incremental)
// ═══════════════════════════════════════════════════════════

async function phaseCollectingIncremental(run: any, serviceClient: any) {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");

  const refs: ApifyRunRef[] = run.apify_run_ids || [];
  const collectedIndex = run.collected_dataset_index || 0;

  const succeededRefs = refs.filter(r => r.status === "SUCCEEDED" && r.datasetId);
  
  if (collectedIndex >= succeededRefs.length) {
    console.log(`Signal ${run.id}: all ${succeededRefs.length} datasets collected, moving to finalizing`);
    await serviceClient.from("signal_runs").update({
      processing_phase: "finalizing",
    }).eq("id", run.id);
    return;
  }

  const ref = succeededRefs[collectedIndex];
  const actor = getActor(ref.actorKey);
  if (!actor) {
    await serviceClient.from("signal_runs").update({
      collected_dataset_index: collectedIndex + 1,
    }).eq("id", run.id);
    return;
  }

  console.log(`Signal ${run.id}: collecting dataset ${collectedIndex + 1}/${succeededRefs.length} (${ref.actorKey}:"${ref.keyword}")`);

  try {
    const items = await collectApifyResults(ref.datasetId, APIFY_API_TOKEN);
    
    // Zero-result warning
    if (items.length === 0) {
      console.warn(`⚠️ Actor ${ref.actorKey}:"${ref.keyword}" returned SUCCEEDED but 0 results — possible input schema mismatch or site blocking`);
    } else if (items.length === 1 && items[0]?.jobTitle?.includes?.("Sample Job Listing")) {
      console.warn(`⚠️ Actor ${ref.actorKey}:"${ref.keyword}" returned a placeholder/fallback result — site is likely blocking the scraper`);
      await serviceClient.from("signal_runs").update({ collected_dataset_index: collectedIndex + 1 }).eq("id", run.id);
      return;
    }
    
    console.log(`Signal ${run.id}: fetched ${items.length} items from ${ref.actorKey}:"${ref.keyword}"`);

    // Cache the results
    const queryHash = btoa(JSON.stringify({ source: ref.actorKey, query: ref.keyword })).slice(0, 64);
    if (items.length > 0 && !items[0]?.error) {
      await serviceClient.from("signal_dataset_cache").upsert({
        query_hash: queryHash, source: ref.actorKey, dataset: items, row_count: items.length,
      }, { onConflict: "query_hash,source" }).then(() => {});
    }

    // Normalize and store leads
    const normalised = normaliseGenericResults(actor, items);
    const storedPlan = run.signal_plan;
    const plans: any[] = Array.isArray(storedPlan) ? storedPlan : [storedPlan];

    const leadsToInsert = normalised.map((item: any) => ({
      run_id: run.id, workspace_id: run.workspace_id,
      company_name: item.company_name || null, website: item.website || null,
      domain: extractDomain(item.website || ""), phone: item.phone || null,
      email: item.email || null, linkedin: item.linkedin || null,
      location: item.location || null, source: actor.label || plans[0]?.source || "Unknown",
      extra_data: item._raw || item,
      added_to_crm: false, enriched: false,
    }));

    if (leadsToInsert.length > 0) {
      for (let i = 0; i < leadsToInsert.length; i += 200) {
        const batch = leadsToInsert.slice(i, i + 200);
        await serviceClient.from("signal_leads").insert(batch);
      }
    }

    console.log(`Signal ${run.id}: stored ${leadsToInsert.length} raw leads from dataset ${collectedIndex + 1}`);
  } catch (err) {
    console.error(`Signal ${run.id}: error collecting dataset ${collectedIndex + 1}:`, err);
  }

  await serviceClient.from("signal_runs").update({
    collected_dataset_index: collectedIndex + 1,
  }).eq("id", run.id);
}

// ═══════════════════════════════════════════════════════════
// ██  PHASE 4: FINALIZING
// ═══════════════════════════════════════════════════════════

async function phaseFinalizing(run: any, serviceClient: any) {
  const workspace_id = run.workspace_id;
  const run_id = run.id;
  const refs: ApifyRunRef[] = run.apify_run_ids || [];
  const storedPlan = run.signal_plan;
  const plans: any[] = Array.isArray(storedPlan) ? storedPlan : [storedPlan];

  const runLog: any[] = [];
  const log = (step: string, data: any) => runLog.push({ step, ts: new Date().toISOString(), ...data });

  console.log(`Signal ${run_id}: FINALIZING — dedup + AI classify`);

  const { data: rawLeads, error: fetchErr } = await serviceClient
    .from("signal_leads")
    .select("*")
    .eq("run_id", run_id)
    .order("discovered_at", { ascending: true });

  if (fetchErr) throw fetchErr;
  const allLeads = rawLeads || [];
  log("loaded_raw_leads", { count: allLeads.length });

  if (allLeads.length === 0) {
    log("zero_result_protection", { message: "No leads discovered, credits not charged" });
    await finalizeRun(run, serviceClient, 0, 0, runLog);
    return;
  }

  // ── Cross-keyword dedup ──
  const JOB_BOARD_DOMAINS = new Set(["indeed.com", "linkedin.com", "yelp.com", "yellowpages.com", "google.com", "glassdoor.com", "ziprecruiter.com", "monster.com", "careerbuilder.com"]);
  const seen = new Set<string>();
  const dedupedIds: string[] = [];
  const removeIds: string[] = [];
  for (const lead of allLeads) {
    const domain = extractDomain(lead.website || "");
    const effectiveDomain = (domain && !JOB_BOARD_DOMAINS.has(domain)) ? domain : "";
    const companyTitle = (lead.company_name || "").trim().toLowerCase();
    const key = effectiveDomain || (companyTitle ? `${companyTitle}::${lead.source || ""}` : "");
    if (key && !seen.has(key)) { seen.add(key); dedupedIds.push(lead.id); }
    else if (!key) { dedupedIds.push(lead.id); /* unique — no dedup key available */ }
    else { removeIds.push(lead.id); }
  }
  log("cross_keyword_dedup", { before: allLeads.length, after: dedupedIds.length, removed: removeIds.length });

  if (removeIds.length > 0) {
    for (let i = 0; i < removeIds.length; i += 200) {
      const batch = removeIds.slice(i, i + 200);
      await serviceClient.from("signal_leads").delete().in("id", batch);
    }
  }

  const { data: dedupedLeads } = await serviceClient
    .from("signal_leads")
    .select("*")
    .eq("run_id", run_id);
  let filtered = dedupedLeads || [];

  // ── Apply non-AI filters ──
  const filters = plans[0]?.filters;
  if (filters && filters.length > 0) {
    const failedIds: string[] = [];
    filtered = filtered.filter((item: any) => {
      const passes = filters.every((f: any) => {
        const val = item[f.field] ?? item.extra_data?.[f.field];
        if (val === undefined || val === null) return true;
        switch (f.operator) {
          case "<": return Number(val) < Number(f.value);
          case ">": return Number(val) > Number(f.value);
          case "=": return String(val).toLowerCase() === String(f.value).toLowerCase();
          case "contains": return String(val).toLowerCase().includes(String(f.value).toLowerCase());
          case "not_contains": return !String(val).toLowerCase().includes(String(f.value).toLowerCase());
          default: return true;
        }
      });
      if (!passes) failedIds.push(item.id);
      return passes;
    });
    if (failedIds.length > 0) {
      for (let i = 0; i < failedIds.length; i += 200) {
        await serviceClient.from("signal_leads").delete().in("id", failedIds.slice(i, i + 200));
      }
    }
    log("static_filter", { before: dedupedLeads?.length || 0, after: filtered.length });
  }

  // ── AI classification ──
  const aiClassification = plans[0]?.ai_classification;
  let aiFilteredCount = 0;
  if (aiClassification && filtered.length > 0) {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      const batchSize = 20;
      const failedAiIds: string[] = [];
      for (let i = 0; i < filtered.length; i += batchSize) {
        const batch = filtered.slice(i, i + batchSize);
        try {
          const classifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: `You are a lead classifier. For each business in the list, determine if it matches this criteria: "${aiClassification}". Return a JSON array of booleans, one per business. Only return the JSON array, nothing else.` },
                { role: "user", content: JSON.stringify(batch.map((b: any) => ({ name: b.company_name, description: b.extra_data?.description || "", website: b.website || "", location: b.location || "", employee_count: b.extra_data?.employee_count || null }))) },
              ],
            }),
          });
          if (classifyResponse.ok) {
            const classResult = await classifyResponse.json();
            let bools: boolean[] = [];
            try {
              const content = classResult.choices?.[0]?.message?.content || "[]";
              bools = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
            } catch { bools = batch.map(() => true); }
            batch.forEach((item: any, idx: number) => { if (!bools[idx]) failedAiIds.push(item.id); });
            aiFilteredCount += batch.length;
          }
        } catch { /* keep all on error */ }
      }
      if (failedAiIds.length > 0) {
        for (let i = 0; i < failedAiIds.length; i += 200) {
          await serviceClient.from("signal_leads").delete().in("id", failedAiIds.slice(i, i + 200));
        }
      }
      log("ai_classification", { processed: aiFilteredCount, rejected: failedAiIds.length });
    }
  }

  // ── Workspace dedup ──
  const { data: finalLeads } = await serviceClient
    .from("signal_leads")
    .select("*")
    .eq("run_id", run_id);

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
  const duplicateIds: string[] = [];
  const newDedupKeys: any[] = [];

  for (const item of (finalLeads || [])) {
    const domain = extractDomain(item.website || "");
    const phone = (item.phone || "").replace(/\D/g, "");
    const linkedin = item.linkedin || "";

    let isDuplicate = false;
    if (domain && (existingSet.has(`domain:${domain}`) || crmSet.has(`domain:${domain}`))) isDuplicate = true;
    if (!isDuplicate && phone && (existingSet.has(`phone:${phone}`) || crmSet.has(`phone:${phone}`))) isDuplicate = true;
    if (!isDuplicate && linkedin && (existingSet.has(`linkedin:${linkedin}`) || crmSet.has(`linkedin:${linkedin}`))) isDuplicate = true;

    if (!isDuplicate) {
      uniqueLeads.push(item);
      if (domain) { existingSet.add(`domain:${domain}`); newDedupKeys.push({ workspace_id, dedup_key: domain, dedup_type: "domain", signal_lead_id: item.id }); }
      if (phone) { existingSet.add(`phone:${phone}`); newDedupKeys.push({ workspace_id, dedup_key: phone, dedup_type: "phone", signal_lead_id: item.id }); }
      if (linkedin) { existingSet.add(`linkedin:${linkedin}`); newDedupKeys.push({ workspace_id, dedup_key: linkedin, dedup_type: "linkedin", signal_lead_id: item.id }); }
    } else {
      duplicateIds.push(item.id);
    }
  }
  log("workspace_dedup", { before: finalLeads?.length || 0, after: uniqueLeads.length, removed: duplicateIds.length });

  if (duplicateIds.length > 0) {
    for (let i = 0; i < duplicateIds.length; i += 200) {
      await serviceClient.from("signal_leads").delete().in("id", duplicateIds.slice(i, i + 200));
    }
  }

  if (newDedupKeys.length > 0) {
    for (let i = 0; i < newDedupKeys.length; i += 200) {
      await serviceClient.from("signal_dedup_keys").insert(newDedupKeys.slice(i, i + 200)).select();
    }
  }

  // ── Calculate actual cost ──
  const scrapedRows = (finalLeads || []).length;
  const scrapeCostUsd = (scrapedRows / 1000) * 0.25;
  const aiFilterCostUsd = aiFilteredCount * 0.001;
  const actualCostUsd = (scrapeCostUsd + aiFilterCostUsd) * 1.2;
  const chargedPriceUsd = actualCostUsd * 3;
  let actualCredits = Math.max(5, Math.ceil(chargedPriceUsd * 5));

  if (uniqueLeads.length === 0) {
    actualCredits = 0;
    log("zero_result_protection", { message: "No leads discovered, credits not charged" });
  }

  await finalizeRun(run, serviceClient, uniqueLeads.length, actualCredits, runLog);
}

// ── Finalize run helper ──
async function finalizeRun(run: any, serviceClient: any, leadsCount: number, actualCredits: number, runLog: any[]) {
  const workspace_id = run.workspace_id;
  const refs: ApifyRunRef[] = run.apify_run_ids || [];

  if (actualCredits > 0) {
    const { data: creditsData } = await serviceClient
      .from("lead_credits")
      .select("credits_balance")
      .eq("workspace_id", workspace_id)
      .maybeSingle();
    const balance = creditsData?.credits_balance || 0;
    await serviceClient.from("lead_credits").update({ credits_balance: balance - actualCredits }).eq("workspace_id", workspace_id);
  }

  const isScheduled = run.schedule_type === "daily" || run.schedule_type === "weekly";
  await serviceClient.from("signal_runs").update({
    status: "completed",
    processing_phase: "done",
    actual_cost: actualCredits,
    leads_discovered: leadsCount,
    last_run_at: new Date().toISOString(),
    run_log: runLog,
    error_message: null,
    next_run_at: isScheduled
      ? new Date(Date.now() + (run.schedule_type === "weekly" ? 7 * 86400000 : 86400000)).toISOString()
      : null,
  }).eq("id", run.id);

  if (run.user_id) {
    const succeededCount = refs.filter((r: ApifyRunRef) => r.status === "SUCCEEDED").length;
    const failedCount = refs.filter((r: ApifyRunRef) => r.status === "FAILED" || r.status === "TIMED-OUT" || r.status === "ABORTED").length;
    await serviceClient.from("notifications").insert({
      user_id: run.user_id, workspace_id,
      type: "signal_complete", title: "Signal Complete!",
      message: `Your signal "${run.signal_name || run.signal_query}" found ${leadsCount} new leads (${succeededCount} sources succeeded, ${failedCount} failed). ${actualCredits} credits charged.`,
    });
  }

  console.log(`Signal ${run.id}: COMPLETED — ${leadsCount} new leads, ${actualCredits} credits charged`);
}
