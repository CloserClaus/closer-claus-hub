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
    actorId: "sovereigntaylor/linkedin-jobs-scraper",
    label: "LinkedIn Jobs",
    category: "hiring_intent",
    description: "LinkedIn job postings",
    inputSchema: {
      keyword:          { type: "string",  required: true, description: "Job search keyword" },
      location:         { type: "string",  default: "United States", description: "Location filter" },
      maxResults:       { type: "number",  default: 500, description: "Max job listings" },
      timePosted:       { type: "enum",    values: ["any", "past24h", "pastWeek", "pastMonth"], default: "pastWeek", description: "Recency filter" },
      scrapeJobDetails: { type: "boolean", default: true, description: "Include full job descriptions" },
    },
    outputFields: {
      company_name: ["companyName", "company"], title: ["jobTitle", "title", "position"],
      website: ["companyLink", "companyUrl", "companyWebsite"], linkedin: ["companyLink", "companyLinkedinUrl", "companyUrl"],
      location: ["jobLocation", "location", "place"], city: ["city", "jobLocation"], state: ["state"], country: ["country"],
      phone: [], email: ["email", "contactEmail"], description: ["jobDescription", "description"],
      industry: ["industry", "companyIndustry"], employee_count: ["employeeCount", "companySize"],
      salary: ["salary"], apply_link: ["applyLink"],
    },
  },
  {
    key: "indeed_jobs",
    actorId: "consummate_mandala/indeed-job-listings-scraper",
    label: "Indeed Jobs",
    category: "hiring_intent",
    description: "Indeed job postings",
    inputSchema: {
      keywords:   { type: "string[]", required: true, description: "Job search keywords" },
      location:   { type: "string",  default: "United States", description: "Location filter" },
      maxResults: { type: "number",  default: 500, description: "Max results" },
    },
    outputFields: {
      company_name: ["company", "companyName"], title: ["positionName", "title", "jobTitle"],
      website: ["companyUrl", "url"], linkedin: [], location: ["location", "jobLocation"],
      city: ["city"], state: ["state"], country: ["country"], phone: [], email: [],
      description: ["description", "jobDescription"], salary: ["salary"], apply_link: ["url", "applyLink"],
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
      maxCrawledPlacesPerSearch: { type: "number",   default: 500, description: "Max places per search" },
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
    actorId: "yin5oHQaJGRfmJhlN",
    label: "Yelp",
    category: "local_business",
    description: "Yelp business listings",
    inputSchema: {
      searchTerms: { type: "string[]", required: true, description: "Search queries" },
      locations:   { type: "string[]", default: ["United States"], description: "City names" },
      maxItems:    { type: "number",   default: 500, description: "Max items" },
    },
    outputFields: {
      company_name: ["name", "title"], website: ["website", "url"], linkedin: [],
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
      maxItems: { type: "number", default: 500, description: "Max results" },
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
      maxPagesPerQuery: { type: "number",   default: 3, description: "Pages per query" },
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
        const v = item[path];
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
  status: string; // READY, RUNNING, SUCCEEDED, FAILED, TIMED-OUT, ABORTED
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
  return data.data.status; // READY, RUNNING, SUCCEEDED, FAILED, TIMED-OUT, ABORTED
}

async function collectApifyResults(datasetId: string, token: string): Promise<any[]> {
  const resp = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=500`,
    { method: "GET" }
  );
  if (!resp.ok) {
    throw new Error(`Apify collect failed (${resp.status})`);
  }
  return await resp.json();
}

// ═══════════════════════════════════════════════════════════
// ██  MAIN HANDLER — processes queued + in-progress signals
// ═══════════════════════════════════════════════════════════

const MAX_RETRIES = 3;
const HARD_CEILING_MS = 30 * 60 * 1000; // 30 minutes absolute max

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const hardCeilingThreshold = new Date(Date.now() - HARD_CEILING_MS).toISOString();

    // 1) Pick up runs that need work:
    //    - queued runs (new)
    //    - running runs in active phases (starting, scraping, collecting) — these need polling
    //    - running runs that are truly stale (pending phase + old, or past hard ceiling)
    const { data: activeRuns, error: qErr } = await serviceClient
      .from("signal_runs")
      .select("*")
      .or(
        `status.eq.queued,` +
        `and(status.eq.running,processing_phase.in.(starting,scraping,collecting)),` +
        `and(status.eq.running,processing_phase.in.(pending),started_at.lt.${hardCeilingThreshold},retry_count.lt.${MAX_RETRIES}),` +
        `and(status.eq.running,started_at.lt.${hardCeilingThreshold},retry_count.lt.${MAX_RETRIES})`
      )
      .order("created_at", { ascending: true })
      .limit(3);

    if (qErr) throw qErr;

    // 2) Pick up scheduled runs that are due
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
      const isActivePhase = ["starting", "scraping", "collecting"].includes(phase);

      // For truly stale runs (not in active phase), handle retries
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
        // Reset to queued for retry
        await serviceClient.from("signal_runs").update({
          status: "queued", retry_count: newRetryCount, started_at: null,
          processing_phase: "pending", apify_run_ids: [], current_keyword_index: 0,
          error_message: `Stale recovery attempt ${newRetryCount}`,
        }).eq("id", run.id);
        continue;
      }

      // For scheduled re-runs, reset to queued
      if (run.status === "completed" && (run.schedule_type === "daily" || run.schedule_type === "weekly")) {
        await serviceClient.from("signal_runs").update({
          status: "queued", started_at: null, processing_phase: "pending",
          apify_run_ids: [], current_keyword_index: 0, error_message: null,
        }).eq("id", run.id);
        // Will be picked up next cycle
        continue;
      }

      // Lease queued runs
      if (run.status === "queued") {
        const { data: leased, error: leaseErr } = await serviceClient
          .from("signal_runs")
          .update({
            status: "running", started_at: new Date().toISOString(),
            error_message: null, processing_phase: "starting",
            apify_run_ids: [], current_keyword_index: 0,
          })
          .eq("id", run.id)
          .eq("status", "queued")
          .select()
          .maybeSingle();

        if (leaseErr || !leased) {
          console.log(`Could not lease signal ${run.id}, skipping`);
          continue;
        }
        // Process starting phase immediately
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

      // Process active-phase runs (starting, scraping, collecting)
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
      processing_phase: "pending", apify_run_ids: [], current_keyword_index: 0,
      error_message: `Attempt ${retryCount} failed: ${errorMsg}`,
    }).eq("id", run.id);
  }
}

// ═══════════════════════════════════════════════════════════
// ██  PHASE ROUTER — dispatches to the right phase handler
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
      await phaseCollecting(run, serviceClient);
      break;
    default:
      throw new Error(`Unknown phase: ${phase}`);
  }
}

// ═══════════════════════════════════════════════════════════
// ██  PHASE 1: STARTING — kick off Apify actor runs
// ═══════════════════════════════════════════════════════════

async function phaseStarting(run: any, serviceClient: any) {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");

  const workspace_id = run.workspace_id;

  // Check credits first
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

  // Build the full list of {actor, keyword, input} jobs to start
  const jobs: { actorKey: string; keyword: string; actor: ActorEntry; input: Record<string, any> }[] = [];

  for (const plan of plans) {
    const actor = getActor(plan.source);
    if (!actor) continue;

    const keywordFields = ["keyword", "search", "searchQuery"];
    const keywordField = keywordFields.find(f => actor.inputSchema[f]);
    const searchQueryHasOR = plan.search_query && /\s+OR\s+/i.test(plan.search_query);
    const rawKeyword = searchQueryHasOR
      ? plan.search_query
      : (plan.search_params?.[keywordField!] || plan.search_query || "");
    const keywords = splitCompoundKeywords(rawKeyword);
    const isMultiKeyword = keywords.length > 1;

    for (const keyword of keywords) {
      const iterPlan = { ...plan, search_query: keyword, search_params: { ...plan.search_params } };
      if (keywordField && iterPlan.search_params[keywordField]) {
        iterPlan.search_params[keywordField] = keyword;
      }
      const arrayFields = ["searchStringsArray", "queries", "searchTerms"];
      for (const af of arrayFields) {
        if (actor.inputSchema[af]) iterPlan.search_params[af] = [keyword];
      }

      const maxField = Object.keys(actor.inputSchema).find(f => f.toLowerCase().includes("max"));
      if (maxField && isMultiKeyword && iterPlan.search_params[maxField]) {
        iterPlan.search_params[maxField] = Math.max(50, Math.ceil(iterPlan.search_params[maxField] / keywords.length));
      } else if (maxField && !iterPlan.search_params[maxField]) {
        iterPlan.search_params[maxField] = 100;
      }

      const actorInput = buildGenericInput(actor, iterPlan);
      // LinkedIn requires residential proxies to avoid blocking
      if (actor.key === "linkedin_jobs" || actor.key === "linkedin_companies") {
        actorInput.proxyConfiguration = {
          useApifyProxy: true,
          apifyProxyGroups: ["RESIDENTIAL"],
          apifyProxyCountry: "US",
        };
      } else if (!actorInput.proxyConfiguration) {
        // Default proxy for all other actors
        actorInput.proxyConfiguration = { useApifyProxy: true };
      }

      jobs.push({ actorKey: actor.key, keyword, actor, input: actorInput });
    }
  }

  // Start jobs in batches of 3 per invocation to stay within time limits
  const currentIndex = run.current_keyword_index || 0;
  const BATCH_SIZE = 3;
  const batch = jobs.slice(currentIndex, currentIndex + BATCH_SIZE);
  const existingRefs: ApifyRunRef[] = run.apify_run_ids || [];

  console.log(`Starting batch: jobs ${currentIndex}-${currentIndex + batch.length - 1} of ${jobs.length}`);

  for (const job of batch) {
    try {
      const { runId, datasetId } = await startApifyRun(job.actor, job.input, APIFY_API_TOKEN);
      existingRefs.push({
        actorKey: job.actorKey,
        keyword: job.keyword,
        runId,
        datasetId,
        status: "RUNNING",
      });
      console.log(`Started Apify run ${runId} for ${job.actorKey}:"${job.keyword}"`);
    } catch (err) {
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

  const newIndex = currentIndex + batch.length;
  const allStarted = newIndex >= jobs.length;

  await serviceClient.from("signal_runs").update({
    apify_run_ids: existingRefs,
    current_keyword_index: newIndex,
    processing_phase: allStarted ? "scraping" : "starting",
  }).eq("id", run.id);

  console.log(`Signal ${run.id}: ${allStarted ? "All jobs started, moving to scraping" : `Started ${newIndex}/${jobs.length}, will continue next cycle`}`);
}

// ═══════════════════════════════════════════════════════════
// ██  PHASE 2: SCRAPING — poll Apify for completion
// ═══════════════════════════════════════════════════════════

async function phaseScraping(run: any, serviceClient: any) {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");

  const refs: ApifyRunRef[] = run.apify_run_ids || [];
  let anyStillRunning = false;
  let updated = false;

  for (const ref of refs) {
    if (!ref.runId || ref.status === "FAILED" || ref.status === "SUCCEEDED" || ref.status === "TIMED-OUT" || ref.status === "ABORTED") {
      continue; // Skip already-resolved runs
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

  const nextPhase = anyStillRunning ? "scraping" : "collecting";

  if (updated || nextPhase !== "scraping") {
    await serviceClient.from("signal_runs").update({
      apify_run_ids: refs,
      processing_phase: nextPhase,
    }).eq("id", run.id);
  }

  console.log(`Signal ${run.id}: polling complete, phase=${nextPhase}, stillRunning=${anyStillRunning}`);
}

// ═══════════════════════════════════════════════════════════
// ██  PHASE 3: COLLECTING — fetch results, normalize, store
// ═══════════════════════════════════════════════════════════

async function phaseCollecting(run: any, serviceClient: any) {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");

  const workspace_id = run.workspace_id;
  const run_id = run.id;
  const refs: ApifyRunRef[] = run.apify_run_ids || [];
  const storedPlan = run.signal_plan;
  const plans: any[] = Array.isArray(storedPlan) ? storedPlan : [storedPlan];

  const runLog: any[] = [];
  const log = (step: string, data: any) => runLog.push({ step, ts: new Date().toISOString(), ...data });

  let allRawResults: any[] = [];
  let allNormalised: any[] = [];

  // Collect results from all succeeded runs
  for (const ref of refs) {
    if (ref.status !== "SUCCEEDED" || !ref.datasetId) {
      log("skip_run", { actorKey: ref.actorKey, keyword: ref.keyword, status: ref.status });
      continue;
    }

    const actor = getActor(ref.actorKey);
    if (!actor) continue;

    try {
      const items = await collectApifyResults(ref.datasetId, APIFY_API_TOKEN);
      log("collected", { actorKey: ref.actorKey, keyword: ref.keyword, rows: items.length });

      // Cache the results
      const queryHash = btoa(JSON.stringify({ source: ref.actorKey, query: ref.keyword })).slice(0, 64);
      if (items.length > 0 && !items[0]?.error) {
        await serviceClient.from("signal_dataset_cache").upsert({
          query_hash: queryHash, source: ref.actorKey, dataset: items, row_count: items.length,
        }, { onConflict: "query_hash,source" }).then(() => {});
      }

      allRawResults.push(...items);
      const normalised = normaliseGenericResults(actor, items);
      for (const n of normalised) n._source_label = actor.label;
      allNormalised.push(...normalised);
    } catch (err) {
      log("collect_error", { actorKey: ref.actorKey, keyword: ref.keyword, error: String(err) });
    }
  }

  log("all_collected", { totalRaw: allRawResults.length, totalNormalised: allNormalised.length });

  // ── Deduplicate raw results across keywords ──
  if (allNormalised.length > 0) {
    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const item of allNormalised) {
      const domain = extractDomain(item.website || "");
      const companyTitle = `${item.company_name || ""}::${item.title || ""}`.toLowerCase();
      const key = domain || companyTitle;
      if (key && !seen.has(key)) { seen.add(key); deduped.push(item); }
      else if (!key) { deduped.push(item); }
    }
    log("cross_keyword_dedup", { before: allNormalised.length, after: deduped.length });
    allNormalised = deduped;
  }

  // ── Apply non-AI filters ──
  const filters = plans[0]?.filters;
  let filtered = allNormalised;
  if (filters && filters.length > 0) {
    filtered = allNormalised.filter((item: any) => {
      return filters.every((f: any) => {
        const val = item[f.field] ?? item._raw?.[f.field];
        if (val === undefined || val === null) return true; // missing data = pass filter, let AI classify
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

  // ── AI classification ──
  const aiClassification = plans[0]?.ai_classification;
  let aiFilteredCount = 0;
  if (aiClassification && filtered.length > 0) {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      const batchSize = 20;
      const classified: any[] = [];
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
                { role: "user", content: JSON.stringify(batch.map((b: any) => ({ name: b.company_name || b.title, description: b.description || "", website: b.website || "", location: b.location || "", employee_count: b.employee_count || null }))) },
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
            batch.forEach((item: any, idx: number) => { if (bools[idx]) classified.push(item); });
            aiFilteredCount += batch.length;
          } else { classified.push(...batch); }
        } catch { classified.push(...batch); }
      }
      filtered = classified;
      log("ai_classification", { processed: aiFilteredCount, passed: filtered.length });
    }
  }

  // ── Workspace dedup ──
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
      if (domain) { existingSet.add(`domain:${domain}`); newDedupKeys.push({ workspace_id, dedup_key: domain, dedup_type: "domain" }); }
      if (phone) { existingSet.add(`phone:${phone}`); newDedupKeys.push({ workspace_id, dedup_key: phone, dedup_type: "phone" }); }
      if (linkedin) { existingSet.add(`linkedin:${linkedin}`); newDedupKeys.push({ workspace_id, dedup_key: linkedin, dedup_type: "linkedin" }); }
    } else { dedupRemoved++; }
  }
  log("dedup", { before: filtered.length, after: uniqueLeads.length, removed: dedupRemoved });

  // ── Store leads ──
  const leadsToInsert = uniqueLeads.map((item) => ({
    run_id, workspace_id,
    company_name: item.company_name || null, website: item.website || null,
    domain: extractDomain(item.website || ""), phone: item.phone || null,
    email: item.email || null, linkedin: item.linkedin || null,
    location: item.location || null, source: item._source_label || plans[0]?.source || "Unknown",
    extra_data: item._raw || item,
  }));

  if (leadsToInsert.length > 0) {
    const { data: insertedLeads } = await serviceClient.from("signal_leads").insert(leadsToInsert).select("id");
    if (insertedLeads && newDedupKeys.length > 0) {
      const dedupWithIds = newDedupKeys.map((dk, idx) => ({
        ...dk, signal_lead_id: insertedLeads[Math.min(idx, insertedLeads.length - 1)]?.id || null,
      }));
      await serviceClient.from("signal_dedup_keys").insert(dedupWithIds).select();
    }
  }

  // ── Calculate actual cost ──
  const { data: creditsData } = await serviceClient
    .from("lead_credits")
    .select("credits_balance")
    .eq("workspace_id", workspace_id)
    .maybeSingle();
  const balance = creditsData?.credits_balance || 0;

  const scrapedRows = allRawResults.length;
  const scrapeCostUsd = (scrapedRows / 1000) * 0.25;
  const aiFilterCostUsd = aiFilteredCount * 0.001;
  const actualCostUsd = (scrapeCostUsd + aiFilterCostUsd) * 1.2;
  const chargedPriceUsd = actualCostUsd * 3;
  let actualCredits = Math.max(5, Math.ceil(chargedPriceUsd * 5));

  if (uniqueLeads.length === 0) {
    actualCredits = 0;
    log("zero_result_protection", { message: "No leads discovered, credits not charged" });
  }

  if (actualCredits > 0) {
    await serviceClient.from("lead_credits").update({ credits_balance: balance - actualCredits }).eq("workspace_id", workspace_id);
  }

  log("complete", { leads: uniqueLeads.length, credits: actualCredits });

  // ── Update run status ──
  const isScheduled = run.schedule_type === "daily" || run.schedule_type === "weekly";
  await serviceClient.from("signal_runs").update({
    status: "completed",
    processing_phase: "done",
    actual_cost: actualCredits,
    leads_discovered: (run.leads_discovered || 0) + uniqueLeads.length,
    last_run_at: new Date().toISOString(),
    run_log: runLog,
    error_message: null,
    next_run_at: isScheduled
      ? new Date(Date.now() + (run.schedule_type === "weekly" ? 7 * 86400000 : 86400000)).toISOString()
      : null,
  }).eq("id", run_id);

  // Notify user
  if (run.user_id) {
    const succeededCount = refs.filter(r => r.status === "SUCCEEDED").length;
    const failedCount = refs.filter(r => r.status === "FAILED" || r.status === "TIMED-OUT" || r.status === "ABORTED").length;
    await serviceClient.from("notifications").insert({
      user_id: run.user_id, workspace_id,
      type: "signal_complete", title: "Signal Complete!",
      message: `Your signal "${run.signal_name || run.signal_query}" found ${uniqueLeads.length} new leads (${succeededCount} sources succeeded, ${failedCount} failed). ${actualCredits} credits charged.`,
    });
  }

  console.log(`Signal ${run_id}: COMPLETED — ${uniqueLeads.length} new leads, ${actualCredits} credits charged`);
}
