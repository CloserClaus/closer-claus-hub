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
    key: "linkedin_jobs", actorId: "curious_coder/linkedin-jobs-scraper", label: "LinkedIn Jobs", category: "hiring_intent", description: "LinkedIn job postings",
    inputSchema: {
      urls: { type: "string[]", required: true, description: "LinkedIn job search URLs" },
      count: { type: "number", default: 2500, description: "Max job listings" },
      scrapeCompany: { type: "boolean", default: true, description: "Include company details" },
      splitByLocation: { type: "boolean", default: false, description: "Split by location" },
      splitCountry: { type: "string", description: "Country for splitting" },
    },
    outputFields: {
      company_name: ["companyName", "company"], title: ["title", "jobTitle", "position"],
      website: ["companyWebsite"], linkedin: ["companyLinkedinUrl", "companyUrl"],
      location: ["location", "jobLocation", "place"], city: ["city", "jobLocation"], state: ["state"], country: ["country"],
      phone: [], email: ["email", "contactEmail"], description: ["descriptionHtml", "description"],
      industry: ["companyIndustry", "industries"], employee_count: ["companyEmployeesCount", "companySize"],
    },
  },
  {
    key: "indeed_jobs", actorId: "valig/indeed-jobs-scraper", label: "Indeed Jobs", category: "hiring_intent", description: "Indeed job postings",
    inputSchema: {
      title: { type: "string", required: true, description: "Job title" },
      location: { type: "string", default: "United States", description: "Location" },
      country: { type: "string", default: "us", description: "Country code" },
      limit: { type: "number", default: 1000, description: "Max results" },
      datePosted: { type: "string", default: "7", description: "Days since posted" },
    },
    outputFields: {
      company_name: ["company", "companyName", "employer.name"], title: ["positionName", "title", "jobTitle"],
      website: ["employer.corporateWebsite", "companyUrl"], linkedin: [], location: ["location", "jobLocation", "location.city"],
      city: ["city", "location.city"], state: ["state", "location.state"], country: ["country", "location.countryName"],
      phone: [], email: [], description: ["description", "jobDescription", "description.text"],
      industry: ["employer.industry"], employee_count: ["employer.employeesCount"],
    },
  },
  {
    key: "google_maps", actorId: "nwua9Gu5YrADL7ZDj", label: "Google Maps", category: "local_business", description: "Google Maps places",
    inputSchema: {
      searchStringsArray: { type: "string[]", required: true, description: "Search queries" },
      maxCrawledPlacesPerSearch: { type: "number", default: 2000, description: "Max places" },
      language: { type: "string", default: "en", description: "Language" },
      locationQuery: { type: "string", description: "Location filter" },
    },
    outputFields: {
      company_name: ["title", "name"], website: ["website", "url"], linkedin: [],
      location: ["address", "fullAddress", "location"], city: ["city"], state: ["state"],
      country: ["countryCode", "country"], phone: ["phone", "telephone"], email: ["email", "emails"],
      description: ["description", "categoryName"], industry: ["categoryName", "category"], employee_count: [],
    },
  },
  {
    key: "yelp", actorId: "sovereigntaylor/yelp-scraper", label: "Yelp", category: "local_business", description: "Yelp listings",
    inputSchema: {
      searchTerms: { type: "string[]", required: true, description: "Search queries" },
      locations: { type: "string[]", default: ["United States"], description: "Locations" },
      maxItems: { type: "number", default: 1000, description: "Max items" },
    },
    outputFields: {
      company_name: ["name", "title", "businessName"], website: ["website", "url"], linkedin: [],
      location: ["address", "neighborhood", "fullAddress"], city: ["city"], state: ["state"],
      country: ["country"], phone: ["phone", "displayPhone"], email: ["email"],
      description: ["categories"], industry: ["categories"],
    },
  },
  {
    key: "yellow_pages", actorId: "trudax/yellow-pages-us-scraper", label: "Yellow Pages", category: "local_business", description: "Yellow Pages",
    inputSchema: {
      search: { type: "string", required: true, description: "Category" },
      location: { type: "string", required: true, description: "Location" },
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
    key: "linkedin_companies", actorId: "2SyF0bVxmgGr8IVCZ", label: "LinkedIn Companies", category: "company_data", description: "LinkedIn company profiles",
    inputSchema: {
      profileUrls: { type: "string[]", required: true, description: "LinkedIn company URLs" },
      maxResults: { type: "number", default: 500, description: "Max results" },
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
    key: "website_crawler", actorId: "apify/website-content-crawler", label: "Website Content Crawler", category: "website_data", description: "Crawls websites for text",
    inputSchema: {
      startUrls: { type: "string[]", required: true, description: "URLs to crawl" },
      maxCrawlPages: { type: "number", default: 3, description: "Max pages per site" },
      crawlerType: { type: "string", default: "cheerio", description: "Crawler engine" },
    },
    outputFields: {
      website: ["url", "loadedUrl"], description: ["text", "markdown", "body"],
    },
  },
  {
    key: "linkedin_people", actorId: "curious_coder/linkedin-people-scraper", label: "LinkedIn People Search", category: "people_data", description: "LinkedIn people search",
    inputSchema: {
      urls: { type: "string[]", required: true, description: "LinkedIn people search URLs" },
      count: { type: "number", default: 50, description: "Max results" },
    },
    outputFields: {
      contact_name: ["fullName", "name", "firstName"],
      title: ["headline", "title", "currentPositions.title"],
      linkedin_profile: ["profileUrl", "url", "linkedinUrl"],
      company_name: ["currentCompany", "companyName"],
      location: ["location", "geoLocation"], city: ["city"], country: ["country"],
    },
  },
  {
    key: "contact_enrichment", actorId: "9Sk4JJhEma9vBKqrg", label: "Contact Enrichment", category: "enrichment", description: "Extract contacts from websites",
    inputSchema: {
      startUrls: { type: "string[]", required: true, description: "Website URLs" },
      maxRequestsPerStartUrl: { type: "number", default: 5, description: "Pages per site" },
      maxDepth: { type: "number", default: 2, description: "Link depth" },
      sameDomain: { type: "boolean", default: true, description: "Stay within domain" },
      mergeContacts: { type: "boolean", default: true, description: "Merge contacts" },
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
    key: "google_search", actorId: "nFJndFXA5zjCTuudP", label: "Google Search", category: "web_search", description: "Google Search results",
    inputSchema: {
      queries: { type: "string[]", required: true, description: "Search queries" },
      maxPagesPerQuery: { type: "number", default: 10, description: "Pages per query" },
      resultsPerPage: { type: "number", default: 10, description: "Results per page" },
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

function getNestedValue(obj: any, path: string): any {
  if (!path.includes('.')) return obj[path];
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function normaliseGenericResults(actor: ActorEntry, items: any[]): any[] {
  return items.map((item) => {
    const normalised: Record<string, any> = {};
    for (const [outputKey, sourcePaths] of Object.entries(actor.outputFields)) {
      let value: any = null;
      for (const path of sourcePaths) {
        const v = getNestedValue(item, path);
        if (v !== undefined && v !== null && v !== "") {
          value = Array.isArray(v) ? (outputKey === "description" ? v.join(", ") : v[0]) : v;
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

function buildGenericInput(actor: ActorEntry, params: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [field, schema] of Object.entries(actor.inputSchema)) {
    let value = params[field];
    if (value === undefined && schema.default !== undefined) value = schema.default;
    if (value === undefined) continue;
    result[field] = value;
  }
  return result;
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
  pipelineStage?: number;
}

async function startApifyRun(actor: ActorEntry, input: Record<string, any>, token: string): Promise<{ runId: string; datasetId: string }> {
  const actorIdEncoded = actor.actorId.replace("/", "~");
  const resp = await fetch(
    `https://api.apify.com/v2/acts/${actorIdEncoded}/runs?token=${token}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Apify start failed (${resp.status}): ${errText.slice(0, 300)}`);
  }
  const data = await resp.json();
  return { runId: data.data.id, datasetId: data.data.defaultDatasetId };
}

async function pollApifyRun(runId: string, token: string): Promise<string> {
  const resp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`, { method: "GET" });
  if (!resp.ok) throw new Error(`Apify poll failed (${resp.status})`);
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
    if (!resp.ok) throw new Error(`Apify collect failed (${resp.status})`);
    const items = await resp.json();
    allItems.push(...items);
    if (items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return allItems;
}

async function abortApifyRun(runId: string, token: string): Promise<void> {
  try {
    await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${token}`, { method: "POST" });
  } catch { /* ignore */ }
}

function isCapacityError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return lower.includes("actor-memory-limit-exceeded") || lower.includes("memory limit") ||
    (lower.includes("402") && (lower.includes("memory") || lower.includes("capacity")));
}

// ═══════════════════════════════════════════════════════════
// ██  MAIN HANDLER
// ═══════════════════════════════════════════════════════════

const MAX_RETRIES = 3;
const HARD_CEILING_MS = 60 * 60 * 1000;
const PER_RUN_TIMEOUT_MS = 15 * 60 * 1000;

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
        `and(status.eq.running,processing_phase.neq.done),` +
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

    let processed = 0;
    let failed = 0;

    for (const run of allRuns) {
      try {
        // Detect format: pipeline vs legacy
        const plan = run.signal_plan;
        const isPipeline = plan && typeof plan === "object" && !Array.isArray(plan) && plan.pipeline;

        if (run.status === "completed" && (run.schedule_type === "daily" || run.schedule_type === "weekly")) {
          await serviceClient.from("signal_runs").update({
            status: "queued", started_at: null, processing_phase: "pending",
            apify_run_ids: [], current_keyword_index: 0, collected_dataset_index: 0,
            current_pipeline_stage: 0, error_message: null,
          }).eq("id", run.id);
          continue;
        }

        if (run.status === "queued") {
          const { data: leased, error: leaseErr } = await serviceClient
            .from("signal_runs")
            .update({
              status: "running", started_at: new Date().toISOString(),
              error_message: null, processing_phase: isPipeline ? "stage_1_starting" : "starting",
              apify_run_ids: [], current_keyword_index: 0, collected_dataset_index: 0,
              current_pipeline_stage: 0,
            })
            .eq("id", run.id).eq("status", "queued").select().maybeSingle();

          if (leaseErr || !leased) continue;

          if (isPipeline) {
            await processPipelinePhase(leased, serviceClient);
          } else {
            await processLegacyPhase(leased, serviceClient);
          }
          processed++;
          continue;
        }

        if (run.status === "running") {
          const phase = run.processing_phase || "pending";

          // Check for stale runs
          if (phase === "pending" || phase === "done") {
            const newRetryCount = (run.retry_count || 0) + 1;
            if (newRetryCount >= MAX_RETRIES) {
              await serviceClient.from("signal_runs").update({
                status: "failed", retry_count: newRetryCount,
                error_message: `Failed after ${MAX_RETRIES} attempts`,
              }).eq("id", run.id);
              failed++;
            } else {
              await serviceClient.from("signal_runs").update({
                status: "queued", retry_count: newRetryCount, started_at: null,
                processing_phase: "pending", apify_run_ids: [], current_keyword_index: 0,
                collected_dataset_index: 0, current_pipeline_stage: 0,
              }).eq("id", run.id);
            }
            continue;
          }

          if (isPipeline) {
            await processPipelinePhase(run, serviceClient);
          } else {
            await processLegacyPhase(run, serviceClient);
          }
          processed++;
        }
      } catch (err) {
        console.error(`Phase error for ${run.id}:`, err);
        await handlePhaseError(run, err, serviceClient);
        failed++;
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
// ██  ERROR HANDLER
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
      collected_dataset_index: 0, current_pipeline_stage: 0,
      error_message: `Attempt ${retryCount} failed: ${errorMsg}`,
    }).eq("id", run.id);
  }
}

// ═══════════════════════════════════════════════════════════
// ██  PIPELINE EXECUTOR (NEW)
// ═══════════════════════════════════════════════════════════

async function processPipelinePhase(run: any, serviceClient: any) {
  const phase = run.processing_phase || "stage_1_starting";
  console.log(`Pipeline signal ${run.id} phase=${phase}`);

  // Parse phase: "stage_N_subphase"
  const match = phase.match(/^stage_(\d+)_(.+)$/);
  if (!match) {
    // Unknown phase — restart from current stage
    const stageIdx = run.current_pipeline_stage || 0;
    await serviceClient.from("signal_runs").update({
      processing_phase: `stage_${stageIdx + 1}_starting`,
      updated_at: new Date().toISOString(),
    }).eq("id", run.id);
    return;
  }

  const stageNum = parseInt(match[1]);
  const subPhase = match[2];
  const pipeline = run.signal_plan?.pipeline || [];
  const stageIdx = stageNum - 1;
  const stageDef = pipeline[stageIdx];

  if (!stageDef) {
    // Past last stage — finalize
    await pipelineFinalize(run, serviceClient);
    return;
  }

  if (stageDef.type === "scrape") {
    switch (subPhase) {
      case "starting":
        await pipelineScrapeStarting(run, stageDef, stageNum, pipeline, serviceClient);
        break;
      case "scraping":
        await pipelineScrapeScraping(run, stageDef, stageNum, serviceClient);
        break;
      case "collecting":
        await pipelineScrapeCollecting(run, stageDef, stageNum, pipeline, serviceClient);
        break;
      default:
        await serviceClient.from("signal_runs").update({
          processing_phase: `stage_${stageNum}_starting`,
          updated_at: new Date().toISOString(),
        }).eq("id", run.id);
    }
  } else if (stageDef.type === "ai_filter") {
    await pipelineAiFilter(run, stageDef, stageNum, pipeline, serviceClient);
  }
}

// ── Pipeline: Scrape Starting ──

async function pipelineScrapeStarting(run: any, stageDef: any, stageNum: number, pipeline: any[], serviceClient: any) {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");

  // Check credits (only for stage 1)
  if (stageNum === 1) {
    const { data: credits } = await serviceClient
      .from("lead_credits").select("credits_balance").eq("workspace_id", run.workspace_id).maybeSingle();
    const balance = credits?.credits_balance || 0;
    if (balance < (run.estimated_cost || 0)) {
      if (run.user_id) {
        await serviceClient.from("notifications").insert({
          user_id: run.user_id, workspace_id: run.workspace_id,
          type: "signal_failed", title: "Signal Paused — Insufficient Credits",
          message: `Your signal "${run.signal_name}" needs ${run.estimated_cost} credits but you only have ${balance}.`,
        });
      }
      await serviceClient.from("signal_runs").update({
        status: run.schedule_type === "daily" || run.schedule_type === "weekly" ? "completed" : "failed",
        error_message: "Insufficient credits",
      }).eq("id", run.id);
      return;
    }
  }

  const actors = stageDef.actors || [];
  const refs: ApifyRunRef[] = [];

  for (const actorKey of actors) {
    const actor = getActor(actorKey);
    if (!actor) continue;

    if (stageNum === 1) {
      // Discovery stage: use search_query and params_per_actor
      const actorParams = stageDef.params_per_actor?.[actorKey] || {};
      const searchQuery = stageDef.search_query || "";
      const keywords = splitCompoundKeywords(searchQuery);

      for (const keyword of keywords) {
        const input = { ...actorParams };

        // LinkedIn Jobs special handling
        if (actorKey === "linkedin_jobs") {
          const location = input.location || input.searchLocation || "United States";
          const encodedKeyword = encodeURIComponent(keyword);
          const encodedLocation = encodeURIComponent(location);
          input.urls = [`https://www.linkedin.com/jobs/search/?keywords=${encodedKeyword}&location=${encodedLocation}&f_TPR=r604800`];
          delete input.searchKeywords;
          delete input.searchLocation;
          if (!input.splitByLocation) delete input.splitCountry;
        } else if (actorKey === "indeed_jobs") {
          input.title = keyword;
        } else {
          // Set keyword into appropriate fields
          const keywordFields = ["title", "search", "searchQuery"];
          const kf = keywordFields.find(f => actor.inputSchema[f]);
          if (kf) input[kf] = keyword;
          const arrayFields = ["searchStringsArray", "queries", "searchTerms"];
          for (const af of arrayFields) {
            if (actor.inputSchema[af]) input[af] = [keyword];
          }
        }

        // Set max limits
        const maxField = Object.keys(actor.inputSchema).find(f => f.toLowerCase().includes("max") || f === "count" || f === "limit");
        if (maxField && !input[maxField]) input[maxField] = actor.inputSchema[maxField]?.default || 500;

        const actorInput = buildGenericInput(actor, input);
        if (!actorInput.proxyConfiguration) actorInput.proxyConfiguration = { useApifyProxy: true };

        try {
          const { runId, datasetId } = await startApifyRun(actor, actorInput, APIFY_API_TOKEN);
          refs.push({ actorKey, keyword, runId, datasetId, status: "RUNNING", startedAt: new Date().toISOString(), pipelineStage: stageNum });
          console.log(`Stage ${stageNum}: Started ${actorKey}:"${keyword}" → run ${runId}`);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (isCapacityError(errMsg)) {
            refs.push({ actorKey, keyword, runId: "", datasetId: "", status: "DEFERRED", pipelineStage: stageNum });
          } else {
            console.error(`Failed to start ${actorKey}:"${keyword}":`, err);
            refs.push({ actorKey, keyword, runId: "", datasetId: "", status: "FAILED", pipelineStage: stageNum });
          }
        }
      }
    } else {
      // Enrichment stages: build input from existing leads
      const inputField = stageDef.input_from;
      if (!inputField) continue;

      const { data: existingLeads } = await serviceClient
        .from("signal_leads").select("*").eq("run_id", run.id).limit(10000);

      if (!existingLeads || existingLeads.length === 0) {
        console.log(`Stage ${stageNum}: No leads to enrich, skipping`);
        break;
      }

      // Build input URLs from leads
      let inputValues: string[] = [];
      if (actorKey === "linkedin_people" && stageDef.search_titles) {
        // Build LinkedIn people search URLs from company LinkedIn URLs
        const titles = stageDef.search_titles.join(" OR ");
        for (const lead of existingLeads) {
          const companyLinkedinUrl = lead.company_linkedin_url || lead.linkedin;
          if (!companyLinkedinUrl) continue;
          // Extract company name for search
          const companyName = lead.company_name || "";
          if (companyName) {
            const encodedCompany = encodeURIComponent(companyName);
            const encodedTitles = encodeURIComponent(titles);
            inputValues.push(`https://www.linkedin.com/search/results/people/?keywords=${encodedTitles}%20${encodedCompany}`);
          }
        }
      } else if (inputField === "company_linkedin_url") {
        inputValues = existingLeads
          .map((l: any) => l.company_linkedin_url || l.linkedin)
          .filter((v: string) => v && v.includes("linkedin.com"));
      } else if (inputField === "website") {
        inputValues = existingLeads
          .map((l: any) => l.website)
          .filter((v: string) => v && v.length > 0)
          .map((v: string) => v.startsWith("http") ? v : `https://${v}`);
      } else {
        inputValues = existingLeads.map((l: any) => l[inputField]).filter(Boolean);
      }

      // Dedup input values
      inputValues = [...new Set(inputValues)];

      if (inputValues.length === 0) {
        console.log(`Stage ${stageNum}: No valid ${inputField} values found in leads`);
        break;
      }

      // Batch the inputs
      const BATCH_SIZE = actorKey === "linkedin_people" ? 50 : actorKey === "linkedin_companies" ? 100 : 50;
      for (let i = 0; i < inputValues.length; i += BATCH_SIZE) {
        const batch = inputValues.slice(i, i + BATCH_SIZE);
        const actorParams = stageDef.params_per_actor?.[actorKey] || {};
        const input: Record<string, any> = { ...actorParams };

        // Set the input URLs into the right field
        if (actor.inputSchema["startUrls"]) {
          input.startUrls = batch.map(url => ({ url }));
        } else if (actor.inputSchema["profileUrls"]) {
          input.profileUrls = batch;
        } else if (actor.inputSchema["urls"]) {
          input.urls = batch;
        }

        const actorInput = buildGenericInput(actor, input);
        if (!actorInput.proxyConfiguration) actorInput.proxyConfiguration = { useApifyProxy: true };

        try {
          const { runId, datasetId } = await startApifyRun(actor, actorInput, APIFY_API_TOKEN);
          refs.push({ actorKey, keyword: `batch_${i}`, runId, datasetId, status: "RUNNING", startedAt: new Date().toISOString(), pipelineStage: stageNum });
          console.log(`Stage ${stageNum}: Started ${actorKey} batch ${i / BATCH_SIZE + 1} (${batch.length} URLs) → run ${runId}`);
        } catch (err) {
          console.error(`Stage ${stageNum}: Failed to start ${actorKey} batch:`, err);
          refs.push({ actorKey, keyword: `batch_${i}`, runId: "", datasetId: "", status: "FAILED", pipelineStage: stageNum });
        }
      }
    }
  }

  await serviceClient.from("signal_runs").update({
    apify_run_ids: refs,
    processing_phase: `stage_${stageNum}_scraping`,
    current_pipeline_stage: stageNum - 1,
    updated_at: new Date().toISOString(),
  }).eq("id", run.id);
}

// ── Pipeline: Scrape Scraping (polling) ──

async function pipelineScrapeScraping(run: any, stageDef: any, stageNum: number, serviceClient: any) {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;
  const refs: ApifyRunRef[] = (run.apify_run_ids || []).filter((r: any) => (r.pipelineStage || 1) === stageNum);
  const otherRefs: ApifyRunRef[] = (run.apify_run_ids || []).filter((r: any) => (r.pipelineStage || 1) !== stageNum);
  let anyStillRunning = false;

  for (const ref of refs) {
    if (!ref.runId || ["FAILED", "SUCCEEDED", "TIMED-OUT", "ABORTED"].includes(ref.status)) continue;

    if (ref.startedAt && (Date.now() - new Date(ref.startedAt).getTime()) > PER_RUN_TIMEOUT_MS) {
      await abortApifyRun(ref.runId, APIFY_API_TOKEN);
      ref.status = "TIMED-OUT";
      continue;
    }

    try {
      const newStatus = await pollApifyRun(ref.runId, APIFY_API_TOKEN);
      ref.status = newStatus;
      if (newStatus === "RUNNING" || newStatus === "READY") anyStillRunning = true;
    } catch {
      ref.status = "FAILED";
    }
  }

  const nextPhase = anyStillRunning ? `stage_${stageNum}_scraping` : `stage_${stageNum}_collecting`;
  await serviceClient.from("signal_runs").update({
    apify_run_ids: [...otherRefs, ...refs],
    processing_phase: nextPhase,
    collected_dataset_index: anyStillRunning ? (run.collected_dataset_index || 0) : 0,
    updated_at: new Date().toISOString(),
  }).eq("id", run.id);
}

// ── Pipeline: Scrape Collecting ──

async function pipelineScrapeCollecting(run: any, stageDef: any, stageNum: number, pipeline: any[], serviceClient: any) {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;
  const allRefs: ApifyRunRef[] = run.apify_run_ids || [];
  const stageRefs = allRefs.filter((r: any) => (r.pipelineStage || 1) === stageNum && r.status === "SUCCEEDED" && r.datasetId);
  const collectedIndex = run.collected_dataset_index || 0;

  if (collectedIndex >= stageRefs.length) {
    // All datasets collected for this stage — dedup if needed, then advance
    if (stageDef.dedup_after) {
      await dedupLeads(run, serviceClient);
    }

    // Advance to next stage
    const nextStageNum = stageNum + 1;
    const nextStageDef = pipeline[nextStageNum - 1];
    if (!nextStageDef) {
      // Pipeline complete — finalize
      await pipelineFinalize(run, serviceClient);
    } else {
      const nextPhase = nextStageDef.type === "ai_filter"
        ? `stage_${nextStageNum}_ai_filter`
        : `stage_${nextStageNum}_starting`;
      await serviceClient.from("signal_runs").update({
        processing_phase: nextPhase,
        current_pipeline_stage: nextStageNum - 1,
        collected_dataset_index: 0,
        updated_at: new Date().toISOString(),
      }).eq("id", run.id);
    }
    return;
  }

  // Collect next dataset
  const ref = stageRefs[collectedIndex];
  try {
    const items = await collectApifyResults(ref.datasetId, APIFY_API_TOKEN);
    const actor = getActor(ref.actorKey);
    if (!actor || items.length === 0) {
      await serviceClient.from("signal_runs").update({ collected_dataset_index: collectedIndex + 1 }).eq("id", run.id);
      return;
    }

    const normalised = normaliseGenericResults(actor, items);

    if (stageNum === 1) {
      // Discovery stage: INSERT new leads
      const leadsToInsert = normalised.map((item: any) => {
        const raw = item._raw || item;
        return {
          run_id: run.id, workspace_id: run.workspace_id,
          company_name: item.company_name || null,
          website: item.website || null,
          domain: extractDomain(item.website || ""),
          phone: item.phone || null, email: item.email || null,
          linkedin: item.linkedin || null, location: item.location || null,
          source: actor.label, added_to_crm: false, enriched: false,
          extra_data: raw, pipeline_stage: `stage_${stageNum}`,
          title: item.title || null,
          industry: item.industry || null,
          employee_count: item.employee_count || null,
          city: item.city || null, state: item.state || null, country: item.country || null,
          company_linkedin_url: item.linkedin || null,
        };
      });

      for (let i = 0; i < leadsToInsert.length; i += 200) {
        await serviceClient.from("signal_leads").insert(leadsToInsert.slice(i, i + 200));
      }
      console.log(`Stage ${stageNum}: Inserted ${leadsToInsert.length} leads from dataset ${collectedIndex + 1}`);
    } else if (actor.category === "people_data") {
      // People-finding stage: UPDATE existing leads with person data
      for (const item of normalised) {
        const companyName = item.company_name || "";
        if (!companyName) continue;

        // Find matching lead by company name
        const { data: matchingLeads } = await serviceClient
          .from("signal_leads")
          .select("id")
          .eq("run_id", run.id)
          .ilike("company_name", `%${companyName.slice(0, 30)}%`)
          .limit(1);

        if (matchingLeads && matchingLeads.length > 0) {
          await serviceClient.from("signal_leads").update({
            contact_name: item.contact_name || null,
            title: item.title || null,
            linkedin_profile_url: item.linkedin_profile || null,
            pipeline_stage: `stage_${stageNum}`,
          }).eq("id", matchingLeads[0].id);
        }
      }
      console.log(`Stage ${stageNum}: Updated leads with person data from dataset ${collectedIndex + 1}`);
    } else {
      // Enrichment stage: UPDATE existing leads with enriched data
      for (const item of normalised) {
        const domain = extractDomain(item.website || "");
        if (!domain) continue;

        const updateData: Record<string, any> = { pipeline_stage: `stage_${stageNum}` };
        const updatesFields = stageDef.updates_fields || [];

        if (updatesFields.includes("employee_count") && item.employee_count) updateData.employee_count = String(item.employee_count);
        if (updatesFields.includes("industry") && item.industry) updateData.industry = item.industry;
        if (updatesFields.includes("website") && item.website) { updateData.website = item.website; updateData.domain = extractDomain(item.website); }
        if (updatesFields.includes("email") && item.email) updateData.email = item.email;
        if (updatesFields.includes("phone") && item.phone) updateData.phone = item.phone;
        if (updatesFields.includes("city") && item.city) updateData.city = item.city;
        if (updatesFields.includes("state") && item.state) updateData.state = item.state;
        if (updatesFields.includes("country") && item.country) updateData.country = item.country;
        if (updatesFields.includes("contact_name") && item.contact_name) updateData.contact_name = item.contact_name;
        if (updatesFields.includes("linkedin_profile_url") && item.linkedin_profile) updateData.linkedin_profile_url = item.linkedin_profile;
        if (item.description) updateData.website_content = String(item.description).slice(0, 5000);
        if (item.linkedin) updateData.company_linkedin_url = item.linkedin;

        // Match by domain
        await serviceClient.from("signal_leads").update(updateData)
          .eq("run_id", run.id).eq("domain", domain);
      }
      console.log(`Stage ${stageNum}: Enriched leads from dataset ${collectedIndex + 1}`);
    }
  } catch (err) {
    console.error(`Stage ${stageNum}: Error collecting dataset ${collectedIndex + 1}:`, err);
  }

  await serviceClient.from("signal_runs").update({
    collected_dataset_index: collectedIndex + 1,
    updated_at: new Date().toISOString(),
  }).eq("id", run.id);
}

// ── Pipeline: AI Filter ──

async function pipelineAiFilter(run: any, stageDef: any, stageNum: number, pipeline: any[], serviceClient: any) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not set, skipping AI filter");
    advancePipelineStage(run, stageNum, pipeline, serviceClient);
    return;
  }

  const { data: leads } = await serviceClient
    .from("signal_leads").select("*").eq("run_id", run.id).limit(10000);

  if (!leads || leads.length === 0) {
    await advancePipelineStage(run, stageNum, pipeline, serviceClient);
    return;
  }

  console.log(`Stage ${stageNum} AI filter: Processing ${leads.length} leads with prompt: "${stageDef.prompt?.slice(0, 80)}..."`);

  const inputFields = stageDef.input_fields || ["company_name", "website", "industry"];
  const batchSize = 25;
  const failedIds: string[] = [];

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    try {
      const classifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `You are a strict lead classifier. For each company in the list, determine if it matches this criteria: "${stageDef.prompt}"

IMPORTANT RULES:
- Focus on the data fields provided. Do NOT infer information not present.
- The "description" or "title" field may be a JOB POSTING, not a company description. Do not use job posting content to classify the company.
- Large enterprises (Meta, Amazon, Google, Oracle, etc.) are NOT small businesses — reject them unless criteria specifically targets large companies.
- When in doubt, reject rather than accept.

Return a JSON array of booleans, one per company. Only return the JSON array, nothing else.`
            },
            {
              role: "user",
              content: JSON.stringify(batch.map((b: any) => {
                const obj: Record<string, any> = {};
                for (const field of inputFields) {
                  obj[field] = b[field] || b.extra_data?.[field] || "";
                }
                // Always include key identifiers
                if (!obj.company_name) obj.company_name = b.company_name || "";
                if (!obj.website) obj.website = b.website || "";
                return obj;
              }))
            },
          ],
        }),
      });

      if (classifyResponse.ok) {
        const result = await classifyResponse.json();
        let bools: boolean[] = [];
        try {
          const content = result.choices?.[0]?.message?.content || "[]";
          bools = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
        } catch { bools = batch.map(() => true); }
        batch.forEach((item: any, idx: number) => { if (!bools[idx]) failedIds.push(item.id); });
      }
    } catch (err) {
      console.error(`AI filter batch error:`, err);
      // Keep all on error
    }
  }

  // Delete failed leads
  if (failedIds.length > 0) {
    for (let i = 0; i < failedIds.length; i += 200) {
      await serviceClient.from("signal_leads").delete().in("id", failedIds.slice(i, i + 200));
    }
  }

  console.log(`Stage ${stageNum} AI filter: ${leads.length - failedIds.length} passed, ${failedIds.length} rejected`);

  await advancePipelineStage(run, stageNum, pipeline, serviceClient);
}

// ── Advance to next pipeline stage ──

async function advancePipelineStage(run: any, currentStageNum: number, pipeline: any[], serviceClient: any) {
  const nextStageNum = currentStageNum + 1;
  const nextStageDef = pipeline[nextStageNum - 1];

  if (!nextStageDef) {
    await pipelineFinalize(run, serviceClient);
    return;
  }

  const nextPhase = nextStageDef.type === "ai_filter"
    ? `stage_${nextStageNum}_ai_filter`
    : `stage_${nextStageNum}_starting`;

  await serviceClient.from("signal_runs").update({
    processing_phase: nextPhase,
    current_pipeline_stage: nextStageNum - 1,
    collected_dataset_index: 0,
    apify_run_ids: run.apify_run_ids || [],
    updated_at: new Date().toISOString(),
  }).eq("id", run.id);
}

// ── Dedup leads ──

async function dedupLeads(run: any, serviceClient: any) {
  const { data: allLeads } = await serviceClient
    .from("signal_leads").select("*").eq("run_id", run.id).limit(10000);
  if (!allLeads || allLeads.length === 0) return;

  const JOB_BOARD_DOMAINS = new Set(["indeed.com", "linkedin.com", "yelp.com", "yellowpages.com", "google.com", "glassdoor.com"]);
  const seen = new Set<string>();
  const removeIds: string[] = [];

  for (const lead of allLeads) {
    const domain = extractDomain(lead.website || "");
    const effectiveDomain = (domain && !JOB_BOARD_DOMAINS.has(domain)) ? domain : "";
    const companyTitle = (lead.company_name || "").trim().toLowerCase();
    const key = effectiveDomain || (companyTitle ? `${companyTitle}::${lead.source || ""}` : "");
    if (key && !seen.has(key)) { seen.add(key); }
    else if (key) { removeIds.push(lead.id); }
  }

  if (removeIds.length > 0) {
    for (let i = 0; i < removeIds.length; i += 200) {
      await serviceClient.from("signal_leads").delete().in("id", removeIds.slice(i, i + 200));
    }
  }
  console.log(`Dedup: ${allLeads.length} → ${allLeads.length - removeIds.length} leads`);
}

// ── Pipeline Finalize ──

async function pipelineFinalize(run: any, serviceClient: any) {
  console.log(`Pipeline ${run.id}: FINALIZING`);

  // Workspace dedup
  const { data: finalLeads } = await serviceClient
    .from("signal_leads").select("*").eq("run_id", run.id).limit(10000);

  const JOB_BOARD_DOMAINS = new Set(["indeed.com", "linkedin.com", "yelp.com", "yellowpages.com", "google.com"]);

  const { data: existingKeys } = await serviceClient
    .from("signal_dedup_keys").select("dedup_key, dedup_type").eq("workspace_id", run.workspace_id);
  const existingSet = new Set((existingKeys || []).map((k: any) => `${k.dedup_type}:${k.dedup_key}`));

  const { data: crmLeads } = await serviceClient
    .from("leads").select("email, phone, linkedin_url").eq("workspace_id", run.workspace_id);
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
    const effectiveDomain = (domain && !JOB_BOARD_DOMAINS.has(domain)) ? domain : "";
    const phone = (item.phone || "").replace(/\D/g, "");
    const linkedin = item.linkedin || "";

    let isDuplicate = false;
    if (effectiveDomain && (existingSet.has(`domain:${effectiveDomain}`) || crmSet.has(`domain:${effectiveDomain}`))) isDuplicate = true;
    if (!isDuplicate && phone && (existingSet.has(`phone:${phone}`) || crmSet.has(`phone:${phone}`))) isDuplicate = true;
    if (!isDuplicate && linkedin && (existingSet.has(`linkedin:${linkedin}`) || crmSet.has(`linkedin:${linkedin}`))) isDuplicate = true;

    if (!isDuplicate) {
      uniqueLeads.push(item);
      if (effectiveDomain) { existingSet.add(`domain:${effectiveDomain}`); newDedupKeys.push({ workspace_id: run.workspace_id, dedup_key: effectiveDomain, dedup_type: "domain", signal_lead_id: item.id }); }
      if (phone) { existingSet.add(`phone:${phone}`); newDedupKeys.push({ workspace_id: run.workspace_id, dedup_key: phone, dedup_type: "phone", signal_lead_id: item.id }); }
      if (linkedin) { existingSet.add(`linkedin:${linkedin}`); newDedupKeys.push({ workspace_id: run.workspace_id, dedup_key: linkedin, dedup_type: "linkedin", signal_lead_id: item.id }); }
    } else {
      duplicateIds.push(item.id);
    }
  }

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

  // Calculate cost
  const { count: finalCount } = await serviceClient
    .from("signal_leads").select("*", { count: "exact", head: true }).eq("run_id", run.id);
  const leadsCount = finalCount ?? uniqueLeads.length;

  let actualCredits = 0;
  if (leadsCount > 0) {
    // ~$1/1000 actual Apify cost, 4x markup, 5 credits = $1
    const scrapeCostUsd = (leadsCount / 1000) * 1.0;
    const chargedPriceUsd = scrapeCostUsd * 4;
    actualCredits = Math.max(5, Math.ceil(chargedPriceUsd * 5));
  }

  // Charge credits
  if (actualCredits > 0) {
    const { data: creditsData } = await serviceClient
      .from("lead_credits").select("credits_balance").eq("workspace_id", run.workspace_id).maybeSingle();
    const balance = creditsData?.credits_balance || 0;
    await serviceClient.from("lead_credits").update({ credits_balance: balance - actualCredits }).eq("workspace_id", run.workspace_id);
  }

  const isScheduled = run.schedule_type === "daily" || run.schedule_type === "weekly";
  await serviceClient.from("signal_runs").update({
    status: "completed", processing_phase: "done",
    actual_cost: actualCredits, leads_discovered: leadsCount,
    last_run_at: new Date().toISOString(), error_message: null,
    next_run_at: isScheduled
      ? new Date(Date.now() + (run.schedule_type === "weekly" ? 7 * 86400000 : 86400000)).toISOString()
      : null,
  }).eq("id", run.id);

  if (run.user_id) {
    const pipeline = run.signal_plan?.pipeline || [];
    await serviceClient.from("notifications").insert({
      user_id: run.user_id, workspace_id: run.workspace_id,
      type: "signal_complete", title: "Signal Complete!",
      message: `Your signal "${run.signal_name || run.signal_query}" completed ${pipeline.length} stages and found ${leadsCount} leads. ${actualCredits} credits charged.`,
    });
  }

  console.log(`Pipeline ${run.id}: COMPLETED — ${leadsCount} leads, ${actualCredits} credits`);
}

// ═══════════════════════════════════════════════════════════
// ██  LEGACY PHASE ROUTER (for old flat-format runs)
// ═══════════════════════════════════════════════════════════

async function processLegacyPhase(run: any, serviceClient: any) {
  const phase = run.processing_phase || "pending";
  console.log(`Legacy signal ${run.id} phase=${phase}`);

  switch (phase) {
    case "pending":
    case "starting":
      await legacyPhaseStarting(run, serviceClient);
      break;
    case "scraping":
      await legacyPhaseScraping(run, serviceClient);
      break;
    case "collecting":
      await legacyPhaseCollecting(run, serviceClient);
      break;
    case "finalizing":
      await legacyPhaseFinalizing(run, serviceClient);
      break;
    default:
      throw new Error(`Unknown legacy phase: ${phase}`);
  }
}

// ── Legacy Phase 1: Starting ──

async function legacyPhaseStarting(run: any, serviceClient: any) {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;
  const storedPlan = run.signal_plan;
  const plans: any[] = Array.isArray(storedPlan) ? storedPlan : [storedPlan];

  const { data: credits } = await serviceClient
    .from("lead_credits").select("credits_balance").eq("workspace_id", run.workspace_id).maybeSingle();
  if ((credits?.credits_balance || 0) < (run.estimated_cost || 0)) {
    await serviceClient.from("signal_runs").update({
      status: "failed", error_message: "Insufficient credits",
    }).eq("id", run.id);
    return;
  }

  const refs: ApifyRunRef[] = run.apify_run_ids || [];

  for (const plan of plans) {
    const actor = getActor(plan.source);
    if (!actor) continue;

    const keywords = splitCompoundKeywords(plan.search_query || "");
    for (const keyword of keywords) {
      const iterPlan = { ...plan, search_query: keyword, search_params: { ...plan.search_params } };

      if (actor.key === "linkedin_jobs" && actor.inputSchema["urls"]) {
        const location = iterPlan.search_params?.searchLocation || iterPlan.search_params?.location || "United States";
        iterPlan.search_params["urls"] = [`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}&f_TPR=r604800`];
        delete iterPlan.search_params["searchKeywords"];
        delete iterPlan.search_params["searchLocation"];
        if (!iterPlan.search_params["splitByLocation"]) delete iterPlan.search_params["splitCountry"];
      } else {
        const kf = ["title", "search", "searchQuery"].find(f => actor.inputSchema[f]);
        if (kf) iterPlan.search_params[kf] = keyword;
        for (const af of ["searchStringsArray", "queries", "searchTerms"]) {
          if (actor.inputSchema[af]) iterPlan.search_params[af] = [keyword];
        }
      }

      const maxField = Object.keys(actor.inputSchema).find(f => f.toLowerCase().includes("max") || f === "count" || f === "limit");
      if (maxField && !iterPlan.search_params[maxField]) iterPlan.search_params[maxField] = actor.inputSchema[maxField]?.default || 500;

      const actorInput = buildGenericInput(actor, iterPlan.search_params);
      if (!actorInput.proxyConfiguration) actorInput.proxyConfiguration = { useApifyProxy: true };

      try {
        const { runId, datasetId } = await startApifyRun(actor, actorInput, APIFY_API_TOKEN);
        refs.push({ actorKey: actor.key, keyword, runId, datasetId, status: "RUNNING", startedAt: new Date().toISOString() });
      } catch (err) {
        refs.push({ actorKey: actor.key, keyword, runId: "", datasetId: "", status: "FAILED" });
      }
    }
  }

  await serviceClient.from("signal_runs").update({
    apify_run_ids: refs, processing_phase: "scraping", updated_at: new Date().toISOString(),
  }).eq("id", run.id);
}

// ── Legacy Phase 2: Scraping ──

async function legacyPhaseScraping(run: any, serviceClient: any) {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;
  const refs: ApifyRunRef[] = run.apify_run_ids || [];
  let anyStillRunning = false;

  for (const ref of refs) {
    if (!ref.runId || ["FAILED", "SUCCEEDED", "TIMED-OUT", "ABORTED"].includes(ref.status)) continue;
    if (ref.startedAt && (Date.now() - new Date(ref.startedAt).getTime()) > PER_RUN_TIMEOUT_MS) {
      await abortApifyRun(ref.runId, APIFY_API_TOKEN);
      ref.status = "TIMED-OUT"; continue;
    }
    try {
      ref.status = await pollApifyRun(ref.runId, APIFY_API_TOKEN);
      if (ref.status === "RUNNING" || ref.status === "READY") anyStillRunning = true;
    } catch { ref.status = "FAILED"; }
  }

  await serviceClient.from("signal_runs").update({
    apify_run_ids: refs,
    processing_phase: anyStillRunning ? "scraping" : "collecting",
    collected_dataset_index: anyStillRunning ? (run.collected_dataset_index || 0) : 0,
    updated_at: new Date().toISOString(),
  }).eq("id", run.id);
}

// ── Legacy Phase 3: Collecting ──

async function legacyPhaseCollecting(run: any, serviceClient: any) {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;
  const refs: ApifyRunRef[] = (run.apify_run_ids || []).filter((r: any) => r.status === "SUCCEEDED" && r.datasetId);
  const collectedIndex = run.collected_dataset_index || 0;

  if (collectedIndex >= refs.length) {
    await serviceClient.from("signal_runs").update({ processing_phase: "finalizing", updated_at: new Date().toISOString() }).eq("id", run.id);
    return;
  }

  const ref = refs[collectedIndex];
  try {
    const actor = getActor(ref.actorKey);
    if (!actor) { await serviceClient.from("signal_runs").update({ collected_dataset_index: collectedIndex + 1 }).eq("id", run.id); return; }
    const items = await collectApifyResults(ref.datasetId, APIFY_API_TOKEN);
    const normalised = normaliseGenericResults(actor, items);

    const leadsToInsert = normalised.map((item: any) => ({
      run_id: run.id, workspace_id: run.workspace_id,
      company_name: item.company_name || null, website: item.website || null,
      domain: extractDomain(item.website || ""), phone: item.phone || null,
      email: item.email || null, linkedin: item.linkedin || null,
      location: item.location || null, source: actor.label,
      extra_data: item._raw || item, added_to_crm: false, enriched: false,
      title: item.title || null, industry: item.industry || null,
      employee_count: item.employee_count || null,
      city: item.city || null, state: item.state || null, country: item.country || null,
      contact_name: (item._raw || {}).contactName || null,
    }));

    for (let i = 0; i < leadsToInsert.length; i += 200) {
      await serviceClient.from("signal_leads").insert(leadsToInsert.slice(i, i + 200));
    }
  } catch (err) {
    console.error(`Legacy collecting error:`, err);
  }

  await serviceClient.from("signal_runs").update({ collected_dataset_index: collectedIndex + 1, updated_at: new Date().toISOString() }).eq("id", run.id);
}

// ── Legacy Phase 4: Finalizing ──

async function legacyPhaseFinalizing(run: any, serviceClient: any) {
  const storedPlan = run.signal_plan;
  const plans: any[] = Array.isArray(storedPlan) ? storedPlan : [storedPlan];

  const { data: rawLeads } = await serviceClient
    .from("signal_leads").select("*").eq("run_id", run.id).limit(10000);
  const allLeads = rawLeads || [];

  if (allLeads.length === 0) {
    await legacyFinalizeRun(run, serviceClient, 0, 0);
    return;
  }

  // Dedup
  const JOB_BOARD_DOMAINS = new Set(["indeed.com", "linkedin.com", "yelp.com", "yellowpages.com", "google.com"]);
  const seen = new Set<string>();
  const removeIds: string[] = [];
  for (const lead of allLeads) {
    const domain = extractDomain(lead.website || "");
    const effectiveDomain = (domain && !JOB_BOARD_DOMAINS.has(domain)) ? domain : "";
    const key = effectiveDomain || ((lead.company_name || "").trim().toLowerCase() ? `${(lead.company_name || "").trim().toLowerCase()}::${lead.source || ""}` : "");
    if (key && !seen.has(key)) seen.add(key);
    else if (key) removeIds.push(lead.id);
  }
  if (removeIds.length > 0) {
    for (let i = 0; i < removeIds.length; i += 200) {
      await serviceClient.from("signal_leads").delete().in("id", removeIds.slice(i, i + 200));
    }
  }

  // AI classification
  const aiClassification = plans[0]?.ai_classification;
  let aiFilteredCount = 0;
  if (aiClassification) {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      const { data: dedupedLeads } = await serviceClient
        .from("signal_leads").select("*").eq("run_id", run.id).limit(10000);
      const filtered = dedupedLeads || [];
      const failedAiIds: string[] = [];

      for (let i = 0; i < filtered.length; i += 20) {
        const batch = filtered.slice(i, i + 20);
        try {
          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: `You are a strict lead classifier. For each business, determine if the COMPANY matches: "${aiClassification}". Focus on company_name, industry, employee_count, website. Return a JSON array of booleans.` },
                { role: "user", content: JSON.stringify(batch.map((b: any) => ({
                  company_name: b.company_name || "", industry: b.industry || "",
                  employee_count: b.employee_count || "", website: b.website || "",
                }))) },
              ],
            }),
          });
          if (resp.ok) {
            const result = await resp.json();
            const content = result.choices?.[0]?.message?.content || "[]";
            const bools = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
            batch.forEach((item: any, idx: number) => { if (!bools[idx]) failedAiIds.push(item.id); });
            aiFilteredCount += batch.length;
          }
        } catch { /* keep all */ }
      }
      if (failedAiIds.length > 0) {
        for (let i = 0; i < failedAiIds.length; i += 200) {
          await serviceClient.from("signal_leads").delete().in("id", failedAiIds.slice(i, i + 200));
        }
      }
    }
  }

  // Workspace dedup
  const { data: finalLeads } = await serviceClient
    .from("signal_leads").select("*").eq("run_id", run.id).limit(10000);

  const { data: existingKeys } = await serviceClient
    .from("signal_dedup_keys").select("dedup_key, dedup_type").eq("workspace_id", run.workspace_id);
  const existingSet = new Set((existingKeys || []).map((k: any) => `${k.dedup_type}:${k.dedup_key}`));

  const uniqueLeads: any[] = [];
  const duplicateIds: string[] = [];
  const newDedupKeys: any[] = [];

  for (const item of (finalLeads || [])) {
    const domain = extractDomain(item.website || "");
    const effectiveDomain = (domain && !JOB_BOARD_DOMAINS.has(domain)) ? domain : "";
    let isDuplicate = false;
    if (effectiveDomain && existingSet.has(`domain:${effectiveDomain}`)) isDuplicate = true;
    if (!isDuplicate) {
      uniqueLeads.push(item);
      if (effectiveDomain) { existingSet.add(`domain:${effectiveDomain}`); newDedupKeys.push({ workspace_id: run.workspace_id, dedup_key: effectiveDomain, dedup_type: "domain", signal_lead_id: item.id }); }
    } else {
      duplicateIds.push(item.id);
    }
  }

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

  const { count: finalCount } = await serviceClient
    .from("signal_leads").select("*", { count: "exact", head: true }).eq("run_id", run.id);
  const leadsCount = finalCount ?? uniqueLeads.length;

  let actualCredits = 0;
  if (leadsCount > 0) {
    const scrapeCostUsd = (leadsCount / 1000) * 0.25;
    actualCredits = Math.max(5, Math.ceil(scrapeCostUsd * 1.2 * 3 * 5));
  }

  await legacyFinalizeRun(run, serviceClient, leadsCount, actualCredits);
}

async function legacyFinalizeRun(run: any, serviceClient: any, leadsCount: number, actualCredits: number) {
  if (actualCredits > 0) {
    const { data: creditsData } = await serviceClient
      .from("lead_credits").select("credits_balance").eq("workspace_id", run.workspace_id).maybeSingle();
    await serviceClient.from("lead_credits").update({
      credits_balance: (creditsData?.credits_balance || 0) - actualCredits,
    }).eq("workspace_id", run.workspace_id);
  }

  const isScheduled = run.schedule_type === "daily" || run.schedule_type === "weekly";
  await serviceClient.from("signal_runs").update({
    status: "completed", processing_phase: "done",
    actual_cost: actualCredits, leads_discovered: leadsCount,
    last_run_at: new Date().toISOString(), error_message: null,
    next_run_at: isScheduled
      ? new Date(Date.now() + (run.schedule_type === "weekly" ? 7 * 86400000 : 86400000)).toISOString()
      : null,
  }).eq("id", run.id);

  if (run.user_id) {
    await serviceClient.from("notifications").insert({
      user_id: run.user_id, workspace_id: run.workspace_id,
      type: "signal_complete", title: "Signal Complete!",
      message: `Your signal "${run.signal_name || run.signal_query}" found ${leadsCount} leads. ${actualCredits} credits charged.`,
    });
  }
}
