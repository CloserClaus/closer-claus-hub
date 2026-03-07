import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Universal Output Field Paths — works with ANY Apify actor ──

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
  monthlyUsers?: number;
  totalRuns?: number;
  rating?: number;
}

const UNIVERSAL_OUTPUT_PATHS: Record<string, string[]> = {
  company_name: ["company", "companyName", "company_name", "name", "title", "employer.name", "businessName", "organization", "companyInfo.name"],
  website: ["website", "url", "companyUrl", "companyWebsite", "domain", "employer.corporateWebsite", "link", "homepageUrl", "href"],
  linkedin: ["linkedinUrl", "companyLinkedinUrl", "linkedin", "linkedIn", "linkedin_url", "companyUrl", "linkedInUrl"],
  location: ["location", "address", "fullAddress", "jobLocation", "place", "neighborhood"],
  city: ["city", "location.city", "headquartersCity", "jobLocation"],
  state: ["state", "location.state"],
  country: ["country", "countryCode", "location.countryName", "headquartersCountry"],
  phone: ["phone", "telephone", "phoneNumber", "phones", "displayPhone", "phoneNumbers"],
  email: ["email", "emails", "emailAddresses", "contactEmail"],
  description: ["description", "descriptionHtml", "jobDescription", "snippet", "text", "description.text", "markdown", "body", "categoryName", "tagline"],
  industry: ["industry", "industries", "companyIndustry", "category", "categoryName", "categories", "employer.industry"],
  employee_count: ["employeeCount", "companyEmployeesCount", "companySize", "staffCount", "employeesOnLinkedIn", "employer.employeesCount", "numberOfEmployees"],
  title: ["title", "jobTitle", "position", "positionName", "headline"],
  contact_name: ["fullName", "name", "firstName", "personName"],
  linkedin_profile: ["profileUrl", "linkedinUrl", "url", "linkedInProfile"],
  salary: ["salary", "salaryInfo", "baseSalary"],
};

// ── Dynamic Actor Registry — loaded from each run's plan ──

let planActorRegistry: Map<string, ActorEntry> = new Map();

function loadActorRegistry(plan: any) {
  planActorRegistry = new Map();
  const registry = plan?.actor_registry || {};
  for (const [key, config] of Object.entries(registry)) {
    const actor = config as ActorEntry;
    if (!actor.key) actor.key = key;
    planActorRegistry.set(key, actor);
  }
}

function getActor(key: string): ActorEntry | undefined {
  return planActorRegistry.get(key);
}

// ── Utility functions ──

function getNestedValue(obj: any, path: string): any {
  if (!path.includes('.')) return obj[path];
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function normaliseGenericResults(actor: ActorEntry | null, items: any[]): any[] {
  // Use actor's outputFields if available and non-empty, otherwise fall back to universal paths
  const fieldPaths = (actor?.outputFields && Object.keys(actor.outputFields).length > 0)
    ? actor.outputFields
    : UNIVERSAL_OUTPUT_PATHS;

  return items.map((item) => {
    const normalised: Record<string, any> = {};
    for (const [outputKey, sourcePaths] of Object.entries(fieldPaths)) {
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
  // If inputSchema is empty/missing, pass through ALL provided params directly
  // This is critical for dynamically discovered actors whose schema couldn't be fetched
  if (!actor.inputSchema || Object.keys(actor.inputSchema).length === 0) {
    console.log(`buildGenericInput: No inputSchema for ${actor.key}, passing through all ${Object.keys(params).length} params`);
    return { ...params };
  }

  const result: Record<string, any> = {};
  for (const [field, schema] of Object.entries(actor.inputSchema)) {
    let value = params[field];
    if (value === undefined && schema.default !== undefined) value = schema.default;
    if (value === undefined) continue;
    result[field] = value;
  }

  // Also pass through any params that aren't in the schema but were explicitly provided
  // (the planner knows what params the actor needs even if schema fetch failed partially)
  for (const [key, value] of Object.entries(params)) {
    if (result[key] === undefined && value !== undefined) {
      result[key] = value;
    }
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

function isNotRentedError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return lower.includes("actor-is-not-rented") || lower.includes("not rented") ||
    (lower.includes("403") && (lower.includes("rent") || lower.includes("paid")));
}

function findBackupActors(primaryActor: ActorEntry): ActorEntry[] {
  const subCategory = (primaryActor as any).subCategory;
  return [...planActorRegistry.values()]
    .filter(a => {
      if (!(a as any)._isBackup) return false;
      // Strict: match subCategory if available (prevents cross-type fallback like Google Maps → LinkedIn Jobs)
      if (subCategory && (a as any).subCategory) {
        return (a as any).subCategory === subCategory;
      }
      // Fallback: match broad category only if subCategory is unavailable
      return a.category === primaryActor.category;
    })
    .sort((a, b) => (b.monthlyUsers || 0) - (a.monthlyUsers || 0));
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

async function startApifyRunWithFallback(
  actor: ActorEntry,
  input: Record<string, any>,
  token: string
): Promise<{ runId: string; datasetId: string; usedActor: ActorEntry }> {
  try {
    const result = await startApifyRun(actor, input, token);
    return { ...result, usedActor: actor };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (!isNotRentedError(errMsg)) throw err;

    console.warn(`Actor ${actor.key} is not rented (403), trying backups for subCategory "${(actor as any).subCategory || actor.category}"`);
    const backups = findBackupActors(actor);

    if (backups.length === 0) {
      throw new Error(`Actor ${actor.key} not rented and no same-type backup actors available (subCategory: ${(actor as any).subCategory || actor.category}). Original error: ${errMsg}`);
    }

    for (const backup of backups) {
      try {
        console.log(`Trying backup actor: ${backup.key} (${backup.label})`);
        // Runtime schema fetch if backup has no inputSchema
        if (!backup.inputSchema || Object.keys(backup.inputSchema).length === 0) {
          try {
            const actorIdEncoded = backup.actorId.replace("/", "~");
            const schemaResp = await fetch(`https://api.apify.com/v2/acts/${actorIdEncoded}/input-schema?token=${token}`, { method: "GET" });
            if (schemaResp.ok) {
              const schemaData = await schemaResp.json();
              const props = schemaData.properties || schemaData.data?.properties || {};
              if (Object.keys(props).length > 0) {
                const fetchedSchema: Record<string, InputField> = {};
                for (const [key, val] of Object.entries(props as Record<string, any>)) {
                  const type = val.type === "array" ? "string[]" : (val.type === "integer" ? "number" : (val.type || "string"));
                  fetchedSchema[key] = { type: type as any, required: false, default: val.default, description: (val.description || key).slice(0, 200) };
                }
                backup.inputSchema = fetchedSchema;
                console.log(`Runtime schema fetch for ${backup.key}: ${Object.keys(fetchedSchema).length} fields discovered`);
              }
            }
          } catch (e) { console.warn(`Runtime schema fetch failed for ${backup.key}:`, e); }
        }
        const backupInput = buildGenericInput(backup, input);
        if (!backupInput.proxyConfiguration) backupInput.proxyConfiguration = { useApifyProxy: true };
        const result = await startApifyRun(backup, backupInput, token);
        console.log(`Backup actor ${backup.key} started successfully → run ${result.runId}`);
        return { ...result, usedActor: backup };
      } catch (backupErr) {
        const backupErrMsg = backupErr instanceof Error ? backupErr.message : String(backupErr);
        console.warn(`Backup actor ${backup.key} also failed: ${backupErrMsg}`);
        continue;
      }
    }

    // All backups exhausted — throw, do NOT fall through
    throw new Error(`Actor ${actor.key} not rented and all ${backups.length} same-type backup actors failed. Original error: ${errMsg}`);
  }
}

async function pollApifyRun(runId: string, token: string): Promise<string> {
  const resp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`, { method: "GET" });
  if (!resp.ok) throw new Error(`Apify poll failed (${resp.status})`);
  const data = await resp.json();
  return data.data.status;
}

async function collectApifyResults(datasetId: string, token: string, maxItems?: number): Promise<any[]> {
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
    if (maxItems && allItems.length >= maxItems) {
      allItems = allItems.slice(0, maxItems);
      break;
    }
    offset += PAGE_SIZE;
  }
  return maxItems ? allItems.slice(0, maxItems) : allItems;
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
// ██  INTER-STAGE QUALITY VALIDATION
// ═══════════════════════════════════════════════════════════

interface QualityCheckResult {
  quality: "HIGH" | "MEDIUM" | "LOW" | "USELESS";
  reason: string;
  suggestedAction?: "continue" | "reconfigure" | "abort";
  reconfiguredPipeline?: any[];
}

async function pipelineQualityCheck(
  run: any,
  stageNum: number,
  stageDef: any,
  pipeline: any[],
  serviceClient: any
): Promise<QualityCheckResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { quality: "HIGH", reason: "No API key, skipping quality check", suggestedAction: "continue" };

  // Sample 15 leads from this stage
  const { data: sampleLeads } = await serviceClient
    .from("signal_leads")
    .select("*")
    .eq("run_id", run.id)
    .limit(15);

  if (!sampleLeads || sampleLeads.length === 0) {
    return { quality: "USELESS", reason: "Stage produced 0 results", suggestedAction: "abort" };
  }

  // Get total count
  const { count: totalCount } = await serviceClient
    .from("signal_leads")
    .select("*", { count: "exact", head: true })
    .eq("run_id", run.id);

  // Build context about what the next stages need
  const remainingStages = pipeline.slice(stageNum);
  const nextStageNeeds = remainingStages
    .filter((s: any) => s.type === "scrape" && s.input_from)
    .map((s: any) => s.input_from);

  const sampleData = sampleLeads.map((l: any) => ({
    company_name: l.company_name,
    website: l.website,
    domain: l.domain,
    industry: l.industry,
    employee_count: l.employee_count,
    company_linkedin_url: l.company_linkedin_url,
    title: l.title,
    description: (l.extra_data?.description || l.extra_data?.descriptionHtml || "").slice(0, 200),
  }));

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a data quality auditor for a lead generation pipeline. Evaluate whether scraped data is relevant and useful.

The user's original query was: "${run.signal_query}"
This is stage ${stageNum} ("${stageDef.name}") of the pipeline.
Total leads collected so far: ${totalCount || sampleLeads.length}
Next stages need these data fields: ${nextStageNeeds.join(", ") || "none specific"}

Evaluate the sample data and respond with EXACTLY one JSON object:
{
  "quality": "HIGH" | "MEDIUM" | "LOW" | "USELESS",
  "reason": "<one-sentence explanation>",
  "field_coverage": {
    "company_name": <0-100 percent of samples that have this field>,
    "website": <0-100>,
    "company_linkedin_url": <0-100>,
    "industry": <0-100>,
    "employee_count": <0-100>
  },
  "relevance_score": <0-100 how many samples seem relevant to the user's query>
}

Rating guide:
- HIGH: >70% relevance AND required downstream fields are mostly populated
- MEDIUM: 40-70% relevance OR some downstream fields missing but recoverable  
- LOW: 20-40% relevance — data has value but downstream flow needs adjustment
- USELESS: <20% relevance OR critical fields completely empty making downstream processing impossible`
          },
          { role: "user", content: JSON.stringify(sampleData) },
        ],
      }),
    });

    if (!response.ok) {
      console.warn(`Quality check API error: ${response.status}`);
      return { quality: "MEDIUM", reason: "Quality check API unavailable, proceeding cautiously", suggestedAction: "continue" };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());

    const quality = parsed.quality || "MEDIUM";
    const reason = parsed.reason || "Unknown";

    if (quality === "HIGH" || quality === "MEDIUM") {
      return { quality, reason, suggestedAction: "continue" };
    }

    if (quality === "LOW") {
      // Try to reconfigure downstream pipeline
      const reconfigured = await reconfigurePipeline(run, stageNum, pipeline, parsed, serviceClient);
      return {
        quality,
        reason,
        suggestedAction: reconfigured ? "reconfigure" : "continue",
        reconfiguredPipeline: reconfigured || undefined,
      };
    }

    // USELESS
    return { quality: "USELESS", reason, suggestedAction: "abort" };
  } catch (err) {
    console.warn("Quality check error:", err);
    return { quality: "MEDIUM", reason: "Quality check failed, proceeding", suggestedAction: "continue" };
  }
}

async function reconfigurePipeline(
  run: any,
  currentStage: number,
  pipeline: any[],
  qualityData: any,
  serviceClient: any
): Promise<any[] | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  // Only allow 1 reconfiguration per run
  const existingAdjustments = run.pipeline_adjustments || [];
  if (existingAdjustments.length >= 1) {
    console.log("Max reconfiguration limit reached, skipping");
    return null;
  }

  const completedStages = pipeline.slice(0, currentStage);
  const remainingStages = pipeline.slice(currentStage);

  // Get current lead field coverage
  const { data: sampleLeads } = await serviceClient
    .from("signal_leads").select("*").eq("run_id", run.id).limit(20);

  const fieldCoverage: Record<string, number> = {};
  const fields = ["company_name", "website", "domain", "company_linkedin_url", "industry", "employee_count", "contact_name"];
  for (const field of fields) {
    const count = (sampleLeads || []).filter((l: any) => l[field] && l[field] !== "").length;
    fieldCoverage[field] = Math.round((count / (sampleLeads?.length || 1)) * 100);
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a pipeline repair agent. The lead generation pipeline has collected data but the quality is LOW for the remaining stages. You need to redesign the remaining stages to work with the data that's actually available.

User's goal: "${run.signal_query}"
Completed stages: ${JSON.stringify(completedStages.map((s: any) => s.name))}
Current field coverage in leads: ${JSON.stringify(fieldCoverage)}
Quality assessment: ${JSON.stringify(qualityData)}

Available actors: linkedin_companies (needs company_linkedin_url), linkedin_people (needs company_name OR company_linkedin_url), contact_enrichment (needs website), google_search (can find LinkedIn URLs), website_crawler (needs website).

RULES:
- You can ONLY use fields that have >30% coverage as inputs
- If company_linkedin_url coverage is <30%, you MUST add a google_search LinkedIn URL discovery stage before any stage that needs it
- If website coverage is <30%, you cannot use contact_enrichment or website_crawler
- Keep the same end goal: find qualified leads matching the user's query

Return a JSON array of replacement stages (with correct stage numbers continuing from ${currentStage + 1}). Or return {"abort": true, "reason": "explanation"} if the goal is infeasible.`
          },
          { role: "user", content: `Redesign remaining pipeline. Original remaining stages: ${JSON.stringify(remainingStages)}` },
        ],
      }),
    });

    if (!response.ok) return null;

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());

    if (parsed.abort) {
      console.log(`Pipeline reconfiguration: abort recommended — ${parsed.reason}`);
      return null;
    }

    const newStages = Array.isArray(parsed) ? parsed : parsed.pipeline || [];
    if (newStages.length === 0) return null;

    return newStages;
  } catch (err) {
    console.warn("Pipeline reconfiguration failed:", err);
    return null;
  }
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
// ██  PIPELINE EXECUTOR
// ═══════════════════════════════════════════════════════════

async function processPipelinePhase(run: any, serviceClient: any) {
  // Load actor registry from this run's plan (no hardcoded catalog)
  loadActorRegistry(run.signal_plan);

  const phase = run.processing_phase || "stage_1_starting";
  console.log(`Pipeline signal ${run.id} phase=${phase}`);

  const match = phase.match(/^stage_(\d+)_(.+)$/);
  if (!match) {
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
      case "validating":
        await pipelineStageValidating(run, stageDef, stageNum, pipeline, serviceClient);
        break;
      default:
        await serviceClient.from("signal_runs").update({
          processing_phase: `stage_${stageNum}_starting`,
          updated_at: new Date().toISOString(),
        }).eq("id", run.id);
    }
  } else if (stageDef.type === "ai_filter") {
    switch (subPhase) {
      case "ai_filter":
        await pipelineAiFilter(run, stageDef, stageNum, pipeline, serviceClient);
        break;
      case "validating":
        await pipelineStageValidating(run, stageDef, stageNum, pipeline, serviceClient);
        break;
      default:
        await pipelineAiFilter(run, stageDef, stageNum, pipeline, serviceClient);
    }
  }
}

// ── Pipeline: Stage Validation (NEW — runs after collecting/filtering) ──

async function pipelineStageValidating(run: any, stageDef: any, stageNum: number, pipeline: any[], serviceClient: any) {
  console.log(`Stage ${stageNum}: Running quality validation`);

  const qualityResult = await pipelineQualityCheck(run, stageNum, stageDef, pipeline, serviceClient);
  console.log(`Stage ${stageNum} quality: ${qualityResult.quality} — ${qualityResult.reason}`);

  // Record the quality check
  const adjustments = run.pipeline_adjustments || [];
  adjustments.push({
    stage: stageNum,
    quality: qualityResult.quality,
    reason: qualityResult.reason,
    timestamp: new Date().toISOString(),
  });

  if (qualityResult.suggestedAction === "abort") {
    // Stage 1 abort = whole run fails
    const userMessage = `Signal stopped after stage ${stageNum}: ${qualityResult.reason}`;
    await serviceClient.from("signal_runs").update({
      status: "failed",
      error_message: userMessage,
      pipeline_adjustments: adjustments,
    }).eq("id", run.id);

    if (run.user_id) {
      await serviceClient.from("notifications").insert({
        user_id: run.user_id, workspace_id: run.workspace_id,
        type: "signal_failed", title: "Signal Stopped — Data Quality Issue",
        message: userMessage,
      });
    }
    return;
  }

  if (qualityResult.suggestedAction === "reconfigure" && qualityResult.reconfiguredPipeline) {
    // Replace remaining pipeline stages
    const completedStages = pipeline.slice(0, stageNum);
    const newPipeline = [...completedStages, ...qualityResult.reconfiguredPipeline];
    const updatedPlan = { ...run.signal_plan, pipeline: newPipeline };

    adjustments.push({
      stage: stageNum,
      action: "reconfigure",
      old_remaining_stages: pipeline.slice(stageNum).length,
      new_remaining_stages: qualityResult.reconfiguredPipeline.length,
      timestamp: new Date().toISOString(),
    });

    await serviceClient.from("signal_runs").update({
      signal_plan: updatedPlan,
      pipeline_stage_count: newPipeline.length,
      pipeline_adjustments: adjustments,
      updated_at: new Date().toISOString(),
    }).eq("id", run.id);

    console.log(`Stage ${stageNum}: Pipeline reconfigured. ${qualityResult.reconfiguredPipeline.length} new stages.`);
  } else {
    await serviceClient.from("signal_runs").update({
      pipeline_adjustments: adjustments,
    }).eq("id", run.id);
  }

  // Advance to next stage
  const updatedPipeline = (qualityResult.reconfiguredPipeline) 
    ? [...pipeline.slice(0, stageNum), ...qualityResult.reconfiguredPipeline]
    : pipeline;
  await advancePipelineStage(run, stageNum, updatedPipeline, serviceClient);
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

    // Runtime schema fetch: if actor has no inputSchema, fetch it from Apify before building params
    if (!actor.inputSchema || Object.keys(actor.inputSchema).length === 0) {
      try {
        const actorIdEncoded = actor.actorId.replace("/", "~");
        const schemaResp = await fetch(`https://api.apify.com/v2/acts/${actorIdEncoded}/input-schema?token=${APIFY_API_TOKEN}`, { method: "GET" });
        if (schemaResp.ok) {
          const schemaData = await schemaResp.json();
          const props = schemaData.properties || schemaData.data?.properties || {};
          if (Object.keys(props).length > 0) {
            const fetchedSchema: Record<string, InputField> = {};
            for (const [key, val] of Object.entries(props as Record<string, any>)) {
              const type = val.type === "array" ? "string[]" : (val.type === "integer" ? "number" : (val.type || "string"));
              fetchedSchema[key] = { type: type as any, required: false, default: val.default, description: (val.description || key).slice(0, 200) };
            }
            actor.inputSchema = fetchedSchema;
            console.log(`Runtime schema fetch for ${actorKey}: ${Object.keys(fetchedSchema).length} fields discovered`);
          }
        }
      } catch (e) { console.warn(`Runtime schema fetch failed for ${actorKey}:`, e); }
    }

    if (stageNum === 1) {
      // Discovery stage: use search_query and params_per_actor
      const actorParams = stageDef.params_per_actor?.[actorKey] || {};
      const searchQuery = stageDef.search_query || "";
      const keywords = splitCompoundKeywords(searchQuery);

      for (const keyword of keywords) {
        const input = { ...actorParams };
        const schemaKeys = Object.keys(actor.inputSchema);
        const hasSchema = schemaKeys.length > 0;

        // Category-based input construction — works with any dynamic actor
        if (actor.category === "hiring_intent") {
          // Job board actors: detect input format from schema or common patterns
          const hasUrls = hasSchema ? !!actor.inputSchema["urls"] || !!actor.inputSchema["startUrls"] : false;
          const hasTitleField = hasSchema ? !!actor.inputSchema["title"] || !!actor.inputSchema["position"] : false;
          const hasSearchQuery = hasSchema ? !!actor.inputSchema["searchQuery"] || !!actor.inputSchema["search"] || !!actor.inputSchema["queries"] || !!actor.inputSchema["keyword"] || !!actor.inputSchema["keywords"] : false;

          if (actor.actorId.includes("linkedin") || actor.label.toLowerCase().includes("linkedin")) {
            // LinkedIn Jobs: build search URL
            const location = input.location || input.searchLocation || "United States";
            const encodedKeyword = encodeURIComponent(keyword);
            const encodedLocation = encodeURIComponent(location);
            const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodedKeyword}&location=${encodedLocation}&f_TPR=r604800`;
            if (hasUrls || !hasSchema) {
              input.urls = input.urls || [searchUrl];
              input.startUrls = input.startUrls || [{ url: searchUrl }];
            }
            input.splitByLocation = false;
            delete input.splitCountry;
          } else if (actor.actorId.includes("indeed") || actor.label.toLowerCase().includes("indeed")) {
            // Indeed: use title/position/query field
            if (hasTitleField) {
              if (actor.inputSchema["title"]) input.title = keyword;
              else if (actor.inputSchema["position"]) input.position = keyword;
            } else {
              // Fallback: try common field names
              input.title = input.title || keyword;
              input.position = input.position || keyword;
            }
          } else if (hasSearchQuery) {
            // Generic job board with search field
            const qField = schemaKeys.find(f => ["searchQuery", "search", "keyword", "keywords", "query"].includes(f));
            if (qField) input[qField] = keyword;
            const arrField = schemaKeys.find(f => ["queries", "searchTerms", "searchStringsArray"].includes(f));
            if (arrField) input[arrField] = [keyword];
          } else {
            // No schema — provide all common field names so one sticks
            input.title = input.title || keyword;
            input.search = input.search || keyword;
            input.searchQuery = input.searchQuery || keyword;
            input.keyword = input.keyword || keyword;
            input.queries = input.queries || [keyword];
          }
        } else {
          // Non-hiring actors in stage 1 (e.g., Google Maps, business directories)
          if (hasSchema) {
            const keywordFields = ["title", "search", "searchQuery", "query", "keyword", "keywords", "searchTerm"];
            const kf = keywordFields.find(f => actor.inputSchema[f]);
            if (kf) input[kf] = keyword;
            const arrayFields = ["searchStringsArray", "queries", "searchTerms"];
            for (const af of arrayFields) {
              if (actor.inputSchema[af]) input[af] = [keyword];
            }
          } else {
            // No schema — supply common field names
            input.search = input.search || keyword;
            input.searchQuery = input.searchQuery || keyword;
            input.queries = input.queries || [keyword];
          }
        }

        // Set max results limit — but NEVER override planner-set caps
        const KNOWN_LIMIT_FIELDS = ["maxItems", "limit", "count", "maxResults", "max_results", "rows", "numResults", "maxCrawledPlacesPerSearch", "maxCrawledPagesPerSearch"];
        const hasExistingLimit = KNOWN_LIMIT_FIELDS.some(f => input[f] !== undefined);

        if (!hasExistingLimit) {
          if (hasSchema) {
            const maxField = schemaKeys.find(f => f.toLowerCase().includes("max") || f === "count" || f === "limit");
            if (maxField) input[maxField] = actor.inputSchema[maxField]?.default || 500;
          } else {
            input.maxResults = 500;
          }
        }

        const actorInput = buildGenericInput(actor, input);
        if (!actorInput.proxyConfiguration) actorInput.proxyConfiguration = { useApifyProxy: true };

        try {
          const { runId, datasetId, usedActor } = await startApifyRunWithFallback(actor, actorInput, APIFY_API_TOKEN);
          const usedKey = usedActor.key;
          if (usedKey !== actorKey) console.log(`Stage ${stageNum}: Swapped ${actorKey} → ${usedKey} (fallback)`);
          refs.push({ actorKey: usedKey, keyword, runId, datasetId, status: "RUNNING", startedAt: new Date().toISOString(), pipelineStage: stageNum });
          console.log(`Stage ${stageNum}: Started ${usedKey}:"${keyword}" → run ${runId}`);
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
    } else if (stageDef.input_transform === "linkedin_url_discovery") {
      // Special: LinkedIn URL discovery via Google Search
      const { data: existingLeads } = await serviceClient
        .from("signal_leads").select("id, company_name, company_linkedin_url").eq("run_id", run.id).limit(10000);

      if (!existingLeads || existingLeads.length === 0) {
        console.log(`Stage ${stageNum}: No leads for LinkedIn URL discovery`);
        break;
      }

      // Only process leads that DON'T already have LinkedIn URLs
      const leadsNeedingLinkedIn = existingLeads.filter((l: any) => !l.company_linkedin_url && l.company_name);

      if (leadsNeedingLinkedIn.length === 0) {
        console.log(`Stage ${stageNum}: All leads already have LinkedIn URLs, skipping discovery`);
        break;
      }

      // Batch company names into Google Search queries
      const BATCH_SIZE = 20;
      for (let i = 0; i < leadsNeedingLinkedIn.length; i += BATCH_SIZE) {
        const batch = leadsNeedingLinkedIn.slice(i, i + BATCH_SIZE);
        const queries = batch.map((l: any) => `"${l.company_name}" site:linkedin.com/company`);
        const actorParams = stageDef.params_per_actor?.[actorKey] || {};
        const input: Record<string, any> = { ...actorParams, queries };

        const actorInput = buildGenericInput(actor, input);
        if (!actorInput.proxyConfiguration) actorInput.proxyConfiguration = { useApifyProxy: true };

        try {
          const { runId, datasetId, usedActor } = await startApifyRunWithFallback(actor, actorInput, APIFY_API_TOKEN);
          refs.push({ actorKey: usedActor.key, keyword: `linkedin_discovery_batch_${i}`, runId, datasetId, status: "RUNNING", startedAt: new Date().toISOString(), pipelineStage: stageNum });
          console.log(`Stage ${stageNum}: Started LinkedIn URL discovery batch ${i / BATCH_SIZE + 1} (${batch.length} companies)`);
        } catch (err) {
          console.error(`Stage ${stageNum}: LinkedIn URL discovery batch failed:`, err);
          refs.push({ actorKey, keyword: `linkedin_discovery_batch_${i}`, runId: "", datasetId: "", status: "FAILED", pipelineStage: stageNum });
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

      let inputValues: string[] = [];
      if ((actor.category === "people_data" || actor.actorId.includes("linkedin") && actor.label.toLowerCase().includes("people")) && stageDef.search_titles) {
        const titles = stageDef.search_titles.join(" OR ");
        for (const lead of existingLeads) {
          // Use company_linkedin_url if available, otherwise use company_name
          const companyLinkedinUrl = lead.company_linkedin_url || lead.linkedin;
          const companyName = lead.company_name || "";
          
          if (companyLinkedinUrl && companyLinkedinUrl.includes("linkedin.com")) {
            // Extract company identifier from LinkedIn URL for more targeted search
            const encodedTitles = encodeURIComponent(titles);
            const encodedCompany = encodeURIComponent(companyName);
            inputValues.push(`https://www.linkedin.com/search/results/people/?keywords=${encodedTitles}%20${encodedCompany}`);
          } else if (companyName) {
            // Fallback: search by company name
            const encodedTitles = encodeURIComponent(titles);
            const encodedCompany = encodeURIComponent(companyName);
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
      } else if (inputField === "company_name") {
        // For google_search or other actors that take company names
        inputValues = existingLeads
          .map((l: any) => l.company_name)
          .filter((v: string) => v && v.trim().length > 0);
      } else {
        inputValues = existingLeads.map((l: any) => l[inputField]).filter(Boolean);
      }

      inputValues = [...new Set(inputValues)];

      if (inputValues.length === 0) {
        console.log(`Stage ${stageNum}: No valid ${inputField} values found in leads, skipping`);
        break;
      }

      const BATCH_SIZE = actor.category === "people_data" ? 50 : actor.category === "company_data" ? 100 : 50;
      for (let i = 0; i < inputValues.length; i += BATCH_SIZE) {
        const batch = inputValues.slice(i, i + BATCH_SIZE);
        const actorParams = stageDef.params_per_actor?.[actorKey] || {};
        const input: Record<string, any> = { ...actorParams };

        const hasSchema = Object.keys(actor.inputSchema).length > 0;

        // Determine how to pass the batch to this actor
        if (hasSchema) {
          if (actor.inputSchema["startUrls"]) {
            input.startUrls = batch.map(url => ({ url }));
          } else if (actor.inputSchema["profileUrls"]) {
            input.profileUrls = batch;
          } else if (actor.inputSchema["urls"]) {
            input.urls = batch;
          } else if (actor.inputSchema["queries"]) {
            input.queries = batch;
          } else {
            // Schema exists but none of the common fields match — try all
            input.startUrls = batch.map(url => ({ url }));
            input.urls = batch;
          }
        } else {
          // No schema — provide all common input formats so one sticks
          const looksLikeUrls = batch[0]?.startsWith("http");
          if (looksLikeUrls) {
            input.startUrls = batch.map(url => ({ url }));
            input.urls = batch;
            input.profileUrls = batch;
          } else {
            input.queries = batch;
            input.searchStringsArray = batch;
          }
        }

        const actorInput = buildGenericInput(actor, input);
        if (!actorInput.proxyConfiguration) actorInput.proxyConfiguration = { useApifyProxy: true };

        try {
          const { runId, datasetId, usedActor } = await startApifyRunWithFallback(actor, actorInput, APIFY_API_TOKEN);
          refs.push({ actorKey: usedActor.key, keyword: `batch_${i}`, runId, datasetId, status: "RUNNING", startedAt: new Date().toISOString(), pipelineStage: stageNum });
          console.log(`Stage ${stageNum}: Started ${usedActor.key} batch ${i / BATCH_SIZE + 1} (${batch.length} items) → run ${runId}`);
        } catch (err) {
          console.error(`Stage ${stageNum}: Failed to start ${actorKey} batch:`, err);
          refs.push({ actorKey, keyword: `batch_${i}`, runId: "", datasetId: "", status: "FAILED", pipelineStage: stageNum });
        }
      }
    }
  }

  // Check if ALL refs failed or empty (zero-result detection)
  const hasSuccessfulStart = refs.some(r => r.status === "RUNNING");
  if (!hasSuccessfulStart && refs.length > 0) {
    console.log(`Stage ${stageNum}: All actor runs failed to start`);
    // Skip to validation which will handle the zero-result case
  }

  await serviceClient.from("signal_runs").update({
    apify_run_ids: [...(run.apify_run_ids || []).filter((r: any) => (r.pipelineStage || 1) !== stageNum), ...refs],
    processing_phase: refs.length > 0 && hasSuccessfulStart ? `stage_${stageNum}_scraping` : `stage_${stageNum}_validating`,
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
    // All datasets collected for this stage — dedup if needed, then validate
    if (stageDef.dedup_after) {
      await dedupLeads(run, serviceClient);
    }

    // HARD ABORT: If this is a discovery stage (stage 1 or no input_from) and we have 0 leads, fail immediately
    if (!stageDef.input_from) {
      const { count: leadCount } = await serviceClient
        .from("signal_leads").select("*", { count: "exact", head: true })
        .eq("run_id", run.id);

      if (!leadCount || leadCount === 0) {
        const userMessage = `No results found from ${(stageDef.actors || []).join(" + ")} in stage ${stageNum}. This can happen when job boards or search sources return empty results for your query. Try broadening your search terms, expanding the date range, or adjusting your criteria.`;
        console.log(`Stage ${stageNum}: ZERO RESULTS — aborting pipeline`);
        
        const { error: abortError } = await serviceClient.from("signal_runs").update({
          status: "failed",
          error_message: userMessage,
          processing_phase: "aborted",
          pipeline_adjustments: [...(run.pipeline_adjustments || []), {
            stage: stageNum,
            quality: "USELESS",
            reason: "Stage produced 0 results — hard abort",
            timestamp: new Date().toISOString(),
          }],
        }).eq("id", run.id);

        if (abortError) {
          console.error(`Stage ${stageNum}: Failed to update status to failed:`, abortError);
          // Retry once
          const { error: retryError } = await serviceClient.from("signal_runs").update({
            status: "failed",
            error_message: userMessage,
            processing_phase: "aborted",
          }).eq("id", run.id);
          if (retryError) console.error(`Stage ${stageNum}: Retry also failed:`, retryError);
        }

        if (run.user_id) {
          await serviceClient.from("notifications").insert({
            user_id: run.user_id, workspace_id: run.workspace_id,
            type: "signal_failed", title: "Signal Failed — No Results Found",
            message: userMessage,
          });
        }
        return;
      }
    }

    // Also check for enrichment/later stages with 0 remaining leads
    const { count: currentLeadCount } = await serviceClient
      .from("signal_leads").select("*", { count: "exact", head: true })
      .eq("run_id", run.id);

    if (!currentLeadCount || currentLeadCount === 0) {
      const userMessage = `All leads were filtered out by stage ${stageNum}. No results remain to process. Try adjusting your filtering criteria or broadening your search.`;
      console.log(`Stage ${stageNum}: All leads eliminated — aborting pipeline`);
      
      const { error: elimError } = await serviceClient.from("signal_runs").update({
        status: "failed",
        error_message: userMessage,
        processing_phase: "aborted",
        pipeline_adjustments: [...(run.pipeline_adjustments || []), {
          stage: stageNum,
          quality: "USELESS",
          reason: "All leads eliminated by this stage",
          timestamp: new Date().toISOString(),
        }],
      }).eq("id", run.id);
      if (elimError) {
        console.error(`Stage ${stageNum}: Failed to update abort status:`, elimError);
        await serviceClient.from("signal_runs").update({ status: "failed", processing_phase: "aborted" }).eq("id", run.id);
      }

      if (run.user_id) {
        await serviceClient.from("notifications").insert({
          user_id: run.user_id, workspace_id: run.workspace_id,
          type: "signal_failed", title: "Signal Failed — No Leads Remaining",
          message: userMessage,
        });
      }
      return;
    }

    // Go to validation before advancing to next stage
    await serviceClient.from("signal_runs").update({
      processing_phase: `stage_${stageNum}_validating`,
      updated_at: new Date().toISOString(),
    }).eq("id", run.id);
    return;
  }

  // Collect next dataset
  const ref = stageRefs[collectedIndex];
  try {
    // Infer the max items cap from the stage's actor params to avoid over-fetching
    const stageActorParams = currentStageDef?.params_per_actor?.[ref.actorKey] || {};
    const KNOWN_LIMIT_FIELDS = ["maxItems", "limit", "count", "maxResults", "max_results", "rows", "numResults", "maxCrawledPlacesPerSearch"];
    const stageMaxItems = KNOWN_LIMIT_FIELDS.reduce((cap: number | undefined, f) => {
      if (cap !== undefined) return cap;
      const v = stageActorParams[f];
      return (typeof v === "number" && v > 0) ? v : undefined;
    }, undefined);
    const items = await collectApifyResults(ref.datasetId, APIFY_API_TOKEN, stageMaxItems);
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
    } else if (stageDef.input_transform === "linkedin_url_discovery") {
      // LinkedIn URL discovery: extract LinkedIn company URLs from Google Search results
      const { data: allRunLeads } = await serviceClient
        .from("signal_leads").select("id, company_name, company_linkedin_url").eq("run_id", run.id).limit(10000);
      const runLeads = allRunLeads || [];

      for (const item of normalised) {
        const url = item.website || item._raw?.url || item._raw?.link || "";
        if (!url.includes("linkedin.com/company")) continue;

        // Extract company name from the Google search result title or description
        const resultTitle = (item.company_name || item._raw?.title || "").toLowerCase();
        
        // Try to match with existing leads
        for (const lead of runLeads) {
          if (lead.company_linkedin_url) continue; // Already has one
          const leadName = (lead.company_name || "").toLowerCase();
          if (!leadName) continue;

          // Fuzzy match: result title contains company name or vice versa
          if (resultTitle.includes(leadName) || leadName.includes(resultTitle.split(" - ")[0].split(" |")[0].trim())) {
            await serviceClient.from("signal_leads").update({
              company_linkedin_url: url,
              pipeline_stage: `stage_${stageNum}`,
            }).eq("id", lead.id);
            lead.company_linkedin_url = url; // Prevent double-assignment
            break;
          }
        }
      }
      console.log(`Stage ${stageNum}: LinkedIn URL discovery completed from dataset ${collectedIndex + 1}`);
    } else if (actor.category === "people_data") {
      // People-finding stage: UPDATE existing leads with person data
      const { data: allRunLeads } = await serviceClient
        .from("signal_leads").select("id, company_name, domain, company_linkedin_url").eq("run_id", run.id).limit(10000);
      const runLeads = allRunLeads || [];

      for (const item of normalised) {
        const personCompany = (item.company_name || "").trim().toLowerCase();
        if (!personCompany) continue;

        let matchedLeadId: string | null = null;

        const personLinkedIn = item._raw?.currentCompanyLinkedinUrl || item._raw?.companyLinkedinUrl || "";
        const personDomain = extractDomain(item._raw?.companyUrl || item._raw?.website || "");
        if (personDomain) {
          const domainMatch = runLeads.find((l: any) => l.domain && l.domain === personDomain);
          if (domainMatch) matchedLeadId = domainMatch.id;
        }

        if (!matchedLeadId) {
          const nameMatch = runLeads.find((l: any) => (l.company_name || "").trim().toLowerCase() === personCompany);
          if (nameMatch) matchedLeadId = nameMatch.id;
        }

        if (!matchedLeadId) {
          const fuzzyMatch = runLeads.find((l: any) => {
            const leadName = (l.company_name || "").trim().toLowerCase();
            return leadName && (leadName.includes(personCompany) || personCompany.includes(leadName));
          });
          if (fuzzyMatch) matchedLeadId = fuzzyMatch.id;
        }

        if (!matchedLeadId && personLinkedIn) {
          const normalizedPersonLI = personLinkedIn.toLowerCase().replace(/\/$/, "");
          const liMatch = runLeads.find((l: any) => l.company_linkedin_url && l.company_linkedin_url.toLowerCase().replace(/\/$/, "") === normalizedPersonLI);
          if (liMatch) matchedLeadId = liMatch.id;
        }

        if (matchedLeadId) {
          await serviceClient.from("signal_leads").update({
            contact_name: item.contact_name || null,
            title: item.title || null,
            linkedin_profile_url: item.linkedin_profile || null,
            pipeline_stage: `stage_${stageNum}`,
          }).eq("id", matchedLeadId);
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
        if (updatesFields.includes("company_linkedin_url") && item.linkedin) updateData.company_linkedin_url = item.linkedin;
        if (item.description) updateData.website_content = String(item.description).slice(0, 5000);
        if (item.linkedin) updateData.company_linkedin_url = item.linkedin;

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
    // Go to validation instead of directly advancing
    await serviceClient.from("signal_runs").update({
      processing_phase: `stage_${stageNum}_validating`,
      updated_at: new Date().toISOString(),
    }).eq("id", run.id);
    return;
  }

  const { data: leads } = await serviceClient
    .from("signal_leads").select("*").eq("run_id", run.id).limit(10000);

  if (!leads || leads.length === 0) {
    await serviceClient.from("signal_runs").update({
      processing_phase: `stage_${stageNum}_validating`,
      updated_at: new Date().toISOString(),
    }).eq("id", run.id);
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
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a strict lead classifier. For each company in the list, determine if it matches this criteria: "${stageDef.prompt}"

IMPORTANT RULES:
- Analyze ALL fields: company_name, domain, industry, employee_count, and description.
- The "domain" field is the company's website domain. Use it as a strong signal.
- The "description" field may be a JOB POSTING or website content, not a company description. Extract what you can about the COMPANY from it.
- If employee_count is provided, use it strictly.
- Large enterprises (Meta, Amazon, Google, Oracle, etc.) are NOT small businesses — reject them unless criteria specifically targets large companies.
- Staffing agencies, recruitment firms, and job boards are NOT the same as the industry they recruit for.
- When in doubt, REJECT rather than accept. Be strict.

Return a JSON array of booleans, one per company. Only return the JSON array, nothing else.`
            },
            {
              role: "user",
              content: JSON.stringify(batch.map((b: any) => {
                const obj: Record<string, any> = {};
                for (const field of inputFields) {
                  obj[field] = b[field] || b.extra_data?.[field] || "";
                }
                if (!obj.company_name) obj.company_name = b.company_name || "";
                if (!obj.domain) obj.domain = b.domain || extractDomain(b.website || "");
                if (!obj.industry) obj.industry = b.industry || "";
                if (!obj.employee_count) obj.employee_count = b.employee_count || "";
                if (!obj.description) {
                  const desc = b.website_content || b.extra_data?.description || b.extra_data?.descriptionHtml || "";
                  obj.description = typeof desc === "string" ? desc.slice(0, 500) : "";
                }
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
    }
  }

  if (failedIds.length > 0) {
    for (let i = 0; i < failedIds.length; i += 200) {
      await serviceClient.from("signal_leads").delete().in("id", failedIds.slice(i, i + 200));
    }
  }

  console.log(`Stage ${stageNum} AI filter: ${leads.length - failedIds.length} passed, ${failedIds.length} rejected`);

  // Go to validation
  await serviceClient.from("signal_runs").update({
    processing_phase: `stage_${stageNum}_validating`,
    updated_at: new Date().toISOString(),
  }).eq("id", run.id);
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

  // Clean up orphaned leads that never advanced past stage_1 (if pipeline has multiple stages)
  const pipeline = run.signal_plan?.pipeline || [];
  if (pipeline.length > 2) {
    // Count leads stuck at stage_1 vs leads that advanced
    const { count: stage1Count } = await serviceClient
      .from("signal_leads").select("*", { count: "exact", head: true })
      .eq("run_id", run.id).eq("pipeline_stage", "stage_1");
    
    const { count: advancedCount } = await serviceClient
      .from("signal_leads").select("*", { count: "exact", head: true })
      .eq("run_id", run.id).neq("pipeline_stage", "stage_1");

    // If there are leads that advanced AND many stuck at stage_1, clean up orphans
    if ((advancedCount || 0) > 0 && (stage1Count || 0) > (advancedCount || 0) * 2) {
      console.log(`Cleaning up ${stage1Count} orphaned stage_1 leads (${advancedCount} leads advanced)`);
      // Delete in batches
      const { data: orphans } = await serviceClient
        .from("signal_leads").select("id").eq("run_id", run.id).eq("pipeline_stage", "stage_1").limit(10000);
      if (orphans && orphans.length > 0) {
        const orphanIds = orphans.map((o: any) => o.id);
        for (let i = 0; i < orphanIds.length; i += 200) {
          await serviceClient.from("signal_leads").delete().in("id", orphanIds.slice(i, i + 200));
        }
      }
    }
  }

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

  // Calculate cost based on actual pipeline work
  const { count: finalCount } = await serviceClient
    .from("signal_leads").select("*", { count: "exact", head: true }).eq("run_id", run.id);
  const leadsCount = finalCount ?? uniqueLeads.length;

  let actualCredits = 0;
  if (leadsCount > 0) {
    let totalScrapedRows = 0;
    let totalAiFilteredRows = 0;
    let runningCount = 0;

    for (const stage of pipeline) {
      if (stage.type === "scrape") {
        const stageCount = stage.expected_output_count || runningCount || 0;
        totalScrapedRows += stageCount;
        runningCount = stageCount;
      } else if (stage.type === "ai_filter") {
        totalAiFilteredRows += runningCount;
        const passRate = stage.expected_pass_rate || 0.20;
        runningCount = Math.floor(runningCount * passRate);
      }
    }

    if (totalScrapedRows === 0) totalScrapedRows = leadsCount;

    const scrapeCostUsd = (totalScrapedRows / 1000) * 1.0;
    const aiCostUsd = totalAiFilteredRows * 0.001;
    const totalUsd = (scrapeCostUsd + aiCostUsd) * 1.5;
    actualCredits = Math.max(5, Math.ceil(totalUsd * 5));
  }

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
    const adjustments = run.pipeline_adjustments || [];
    const adjustmentNote = adjustments.length > 0 ? ` Pipeline was adapted ${adjustments.length} time(s) during execution.` : "";
    await serviceClient.from("notifications").insert({
      user_id: run.user_id, workspace_id: run.workspace_id,
      type: "signal_complete", title: "Signal Complete!",
      message: `Your signal "${run.signal_name || run.signal_query}" completed ${pipeline.length} stages and found ${leadsCount} leads. ${actualCredits} credits charged.${adjustmentNote}`,
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
        // Force disable splitByLocation
        iterPlan.search_params["splitByLocation"] = false;
        delete iterPlan.search_params["splitCountry"];
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
    const scrapeCostUsd = (leadsCount / 1000) * 1.0;
    const totalUsd = scrapeCostUsd * 1.5;
    actualCredits = Math.max(5, Math.ceil(totalUsd * 5));
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
