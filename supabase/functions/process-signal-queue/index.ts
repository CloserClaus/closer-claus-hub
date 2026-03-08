import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Universal Output Field Paths — works with ANY Apify actor ──

interface InputField {
  type: "string" | "number" | "boolean" | "string[]" | "object[]" | "enum";
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

// ── Verified Actor Catalog (minimal mirror of signal-planner) ──
const VERIFIED_ACTOR_CATALOG: Record<string, { actorId: string; category: string; subCategory: string; label: string; inputSchema: Record<string, InputField>; outputFields: Record<string, string[]> }> = {
  "local_business:google_maps": { actorId: "compass/crawler-google-places", category: "local_business", subCategory: "local_business:google_maps", label: "Google Maps Places Scraper", inputSchema: { searchStringsArray: { type: "string[]", required: true, description: "Search queries" }, maxCrawledPlacesPerSearch: { type: "number", required: false, default: 100, description: "Max results per search" } }, outputFields: { company_name: ["title"], website: ["website"], phone: ["phone"], email: ["email", "emails"], location: ["address", "fullAddress"], industry: ["category", "categories", "categoryName"] } },
  "local_business:yelp": { actorId: "yin/yelp-scraper", category: "local_business", subCategory: "local_business:yelp", label: "Yelp Business Scraper", inputSchema: { searchTerms: { type: "string[]", required: true, description: "Search terms" }, location: { type: "string", required: false, description: "Location" }, maxItems: { type: "number", required: false, default: 100, description: "Max results" } }, outputFields: { company_name: ["name", "businessName"], website: ["website"], phone: ["phone", "displayPhone"], location: ["address"], industry: ["categories"] } },
  "hiring_intent:indeed": { actorId: "misceres/indeed-scraper", category: "hiring_intent", subCategory: "hiring_intent:indeed", label: "Indeed Job Scraper", inputSchema: { position: { type: "string", required: false, description: "Job title" }, location: { type: "string", required: false, description: "Location" }, country: { type: "string", required: false, default: "US", description: "Country code" }, maxItems: { type: "number", required: false, default: 100, description: "Max results" } }, outputFields: { company_name: ["company", "companyName"], title: ["positionName", "title"], location: ["jobLocation", "location"], website: ["companyUrl", "url"], description: ["description"] } },
  "hiring_intent:linkedin": { actorId: "hMvNSpz3JnHgl5jkh", category: "hiring_intent", subCategory: "hiring_intent:linkedin", label: "LinkedIn Jobs Scraper", inputSchema: { urls: { type: "string[]", required: false, description: "LinkedIn job search URLs" }, startUrls: { type: "string[]", required: false, description: "Start URLs" }, maxItems: { type: "number", required: false, default: 100, description: "Max results" } }, outputFields: { company_name: ["companyName", "company"], title: ["title", "jobTitle"], location: ["location", "jobLocation"], linkedin: ["companyLinkedinUrl"], website: ["companyUrl"], industry: ["companyIndustry"], employee_count: ["companyEmployeesCount"] } },
  "hiring_intent:glassdoor": { actorId: "bebity/glassdoor-scraper", category: "hiring_intent", subCategory: "hiring_intent:glassdoor", label: "Glassdoor Job Scraper", inputSchema: { keyword: { type: "string", required: false, description: "Job keyword" }, location: { type: "string", required: false, description: "Location" }, maxItems: { type: "number", required: false, default: 100, description: "Max results" } }, outputFields: { company_name: ["employer.name", "companyName"], title: ["jobTitle", "title"], location: ["location"], industry: ["employer.industry"], website: ["employer.corporateWebsite"], employee_count: ["employer.employeesCount"] } },
  "people_data:linkedin": { actorId: "2SyF0bVxmgQr8SsLY", category: "people_data", subCategory: "people_data:linkedin", label: "LinkedIn People Search", inputSchema: { searchUrl: { type: "string", required: false, description: "LinkedIn people search URL" }, urls: { type: "string[]", required: false, description: "Search URLs" }, startUrls: { type: "string[]", required: false, description: "Start URLs" }, maxItems: { type: "number", required: false, default: 50, description: "Max results" } }, outputFields: { contact_name: ["fullName", "name", "firstName"], title: ["headline", "title"], linkedin_profile: ["profileUrl", "url", "linkedinUrl"], company_name: ["companyName", "currentCompany"], location: ["location", "geoLocation"] } },
  "company_data:linkedin": { actorId: "voyager/linkedin-company-scraper", category: "company_data", subCategory: "company_data:linkedin", label: "LinkedIn Company Scraper", inputSchema: { urls: { type: "string[]", required: false, description: "LinkedIn company page URLs" }, startUrls: { type: "string[]", required: false, description: "Start URLs" }, maxItems: { type: "number", required: false, default: 50, description: "Max results" } }, outputFields: { company_name: ["name", "companyName"], industry: ["industry", "industries"], employee_count: ["employeeCount", "staffCount", "employeesOnLinkedIn"], website: ["website", "websiteUrl"], linkedin: ["url", "linkedinUrl"], location: ["headquarters", "location"] } },
  "web_search:google": { actorId: "apify/google-search-scraper", category: "web_search", subCategory: "web_search:google", label: "Google Search Scraper", inputSchema: { queries: { type: "string", required: true, description: "Search query string" }, maxPagesPerQuery: { type: "number", required: false, default: 1, description: "Pages per query" }, resultsPerPage: { type: "number", required: false, default: 10, description: "Results per page" } }, outputFields: { company_name: ["title"], website: ["url", "link"], description: ["description", "snippet"] } },
  "enrichment:contact": { actorId: "alexey/contact-info-scraper", category: "enrichment", subCategory: "enrichment:contact", label: "Website Contact Info Scraper", inputSchema: { startUrls: { type: "string[]", required: true, description: "Website URLs to scrape contacts from" }, maxRequestsPerStartUrl: { type: "number", required: false, default: 5, description: "Max pages per site" } }, outputFields: { email: ["emails", "email"], phone: ["phones", "phone", "phoneNumbers"], linkedin: ["linkedIn", "linkedin"], website: ["url"] } },
};

function resolveVerifiedActor(stageCategory: string): ActorEntry | null {
  const v = VERIFIED_ACTOR_CATALOG[stageCategory];
  if (!v) return null;
  const key = v.actorId.replace(/[^a-zA-Z0-9]/g, "_");
  return {
    key,
    actorId: v.actorId,
    label: v.label,
    category: v.category,
    description: v.label,
    inputSchema: v.inputSchema,
    outputFields: v.outputFields,
    monthlyUsers: 10000,
    totalRuns: 100000,
    rating: 5,
    _verified: true,
    subCategory: v.subCategory,
  } as any;
}

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

// ═══════════════════════════════════════════════════════════
// ██  QUERY NORMALIZATION ENGINE — Deterministic URL/query construction
// ══════════════════════════════════════════════════════════
// The AI decides WHAT to search (roles, industry, location).
// This engine decides HOW to construct the platform-specific query.

interface SearchIntent {
  roles: string[];          // e.g. ["Sales Representative", "SDR", "BDR"]
  industry: string;         // e.g. "marketing OR advertising"
  location: string;         // e.g. "United States"
  dateRange?: string;       // e.g. "r604800" (past week)
}

function parseSearchIntent(stageDef: any): SearchIntent {
  const roleFilter: string[] | null = stageDef.role_filter || null;
  const searchQuery: string = stageDef.search_query || "";
  
  // Extract location from actor params — planner embeds geography there
  let location = "United States"; // fallback default
  const paramsPerActor = stageDef.params_per_actor || {};
  for (const [, actorParams] of Object.entries(paramsPerActor)) {
    const ap = actorParams as Record<string, any>;
    if (ap?.location) { location = ap.location; break; }
    if (ap?.searchLocation) { location = ap.searchLocation; break; }
    // Check for location embedded in URLs
    if (ap?.urls?.[0]) {
      const urlMatch = String(ap.urls[0]).match(/location=([^&]+)/);
      if (urlMatch) { location = decodeURIComponent(urlMatch[1]); break; }
    }
  }
  // Also check top-level params
  if (stageDef.params?.location) location = stageDef.params.location;
  if (stageDef.params?.searchLocation) location = stageDef.params.searchLocation;
  
  return {
    roles: roleFilter || [],
    industry: roleFilter ? searchQuery : "", // When roles exist, search_query IS the industry
    location,
    dateRange: "r604800",
  };
}

interface PlatformQuery {
  url?: string;
  params: Record<string, any>;
}

function buildPlatformSearchQuery(
  platform: "linkedin" | "indeed" | "glassdoor" | "google_maps" | "yelp" | "google_search" | "generic",
  intent: SearchIntent,
  existingParams: Record<string, any>
): PlatformQuery {
  const location = existingParams.location || existingParams.searchLocation || intent.location || "United States";
  
  // Build the combined search keyword: roles + industry context
  let combinedKeyword: string;
  if (intent.roles.length > 0 && intent.industry) {
    // "Sales Representative OR SDR marketing OR advertising"
    combinedKeyword = `${intent.roles.join(" OR ")} ${intent.industry}`;
  } else if (intent.roles.length > 0) {
    combinedKeyword = intent.roles.join(" OR ");
  } else if (intent.industry) {
    combinedKeyword = intent.industry;
  } else {
    combinedKeyword = existingParams.search_query || existingParams.keyword || "";
  }

  switch (platform) {
    case "linkedin": {
      const encodedKeyword = encodeURIComponent(combinedKeyword);
      const encodedLocation = encodeURIComponent(location);
      const url = `https://www.linkedin.com/jobs/search/?keywords=${encodedKeyword}&location=${encodedLocation}&f_TPR=${intent.dateRange || "r604800"}`;
      return {
        url,
        params: {
          ...existingParams,
          urls: [url],
          startUrls: [{ url }],
          splitByLocation: false,
        },
      };
    }
    case "indeed": {
      return {
        params: {
          ...existingParams,
          position: combinedKeyword,
          title: combinedKeyword,
          location,
          ...(existingParams.searchQuery !== undefined ? { searchQuery: combinedKeyword } : {}),
        },
      };
    }
    case "glassdoor": {
      return {
        params: {
          ...existingParams,
          keyword: combinedKeyword,
          location,
        },
      };
    }
    case "google_maps": {
      // For local business, combine industry + location into search strings
      const searchTerms = intent.industry 
        ? splitCompoundKeywords(intent.industry).map(term => `${term} ${location}`)
        : [combinedKeyword];
      return {
        params: {
          ...existingParams,
          searchStringsArray: searchTerms,
        },
      };
    }
    case "yelp": {
      return {
        params: {
          ...existingParams,
          searchTerms: splitCompoundKeywords(intent.industry || combinedKeyword),
          location,
        },
      };
    }
    case "google_search": {
      return {
        params: {
          ...existingParams,
          queries: combinedKeyword,
        },
      };
    }
    default: {
      // Generic: try all common field names
      return {
        params: {
          ...existingParams,
          search: combinedKeyword,
          searchQuery: combinedKeyword,
          keyword: combinedKeyword,
          queries: [combinedKeyword],
          title: intent.roles.length > 0 ? intent.roles.join(" OR ") : combinedKeyword,
        },
      };
    }
  }
}

function detectPlatform(actor: ActorEntry): "linkedin" | "indeed" | "glassdoor" | "google_maps" | "yelp" | "google_search" | "generic" {
  const id = actor.actorId.toLowerCase();
  const label = actor.label.toLowerCase();
  const sub = ((actor as any).subCategory || "").toLowerCase();
  
  if (id.includes("linkedin") || label.includes("linkedin") || sub.includes("linkedin")) {
    if (sub.includes("people") || label.includes("people")) return "generic"; // People search uses different logic
    if (sub.includes("company")) return "generic"; // Company scraper uses URLs
    return "linkedin";
  }
  if (id.includes("indeed") || label.includes("indeed") || sub.includes("indeed")) return "indeed";
  if (id.includes("glassdoor") || label.includes("glassdoor") || sub.includes("glassdoor")) return "glassdoor";
  if (id.includes("google-places") || id.includes("crawler-google-places") || sub.includes("google_maps")) return "google_maps";
  if (id.includes("yelp") || sub.includes("yelp")) return "yelp";
  if (id.includes("google-search") || sub.includes("google_search") || sub.includes("web_search")) return "google_search";
  return "generic";
}

// ═══════════════════════════════════════════════════════════
// ██  ZERO-RESULT DIAGNOSTIC ENGINE
// ═══════════════════════════════════════════════════════════

interface DiagnosticResult {
  diagnosis: "wrong_query" | "wrong_actor" | "empty_niche" | "actor_error" | "unknown";
  suggestion: string;
  correctedIntent?: SearchIntent;
  shouldRetry: boolean;
}

async function diagnoseZeroResults(
  run: any,
  stageDef: any,
  stageRefs: ApifyRunRef[],
  serviceClient: any
): Promise<DiagnosticResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  // Check if actors actually ran successfully but returned empty
  const allSucceeded = stageRefs.length > 0 && stageRefs.every(r => r.status === "SUCCEEDED");
  const allFailed = stageRefs.length > 0 && stageRefs.every(r => r.status === "FAILED" || r.status === "TIMED-OUT");
  
  if (allFailed) {
    return {
      diagnosis: "actor_error",
      suggestion: "All scraping actors failed to run. This may be a temporary issue with the data provider.",
      shouldRetry: true,
    };
  }
  
  if (!allSucceeded) {
    return {
      diagnosis: "unknown",
      suggestion: "Some actors are still running or in an unknown state.",
      shouldRetry: false,
    };
  }
  
  // Actors succeeded but returned 0 results — diagnose why
  const intent = parseSearchIntent(stageDef);
  const platform = detectPlatform(
    getActor(stageDef.actors?.[0] || "") || { actorId: "", label: "", category: "" } as any
  );
  
  if (!LOVABLE_API_KEY) {
    // Without AI, use heuristic diagnosis
    if (intent.roles.length > 0 && !intent.industry) {
      return {
        diagnosis: "wrong_query",
        suggestion: "Search has role titles but no industry context. Try adding industry terms.",
        correctedIntent: { ...intent, industry: run.signal_query },
        shouldRetry: true,
      };
    }
    return {
      diagnosis: "empty_niche",
      suggestion: "The search combination may be too narrow. Try broader terms.",
      shouldRetry: false,
    };
  }
  
  // Use AI to diagnose
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are debugging a lead generation search that returned 0 results.

User's original query: "${run.signal_query}"
Platform: ${platform}
Search roles: ${intent.roles.join(", ") || "none"}
Search industry: ${intent.industry || "none"}
Location: ${intent.location}

The scraper ran successfully but found no matching results. Diagnose why and suggest a correction.

Return EXACTLY one JSON object:
{
  "diagnosis": "wrong_query" | "empty_niche" | "too_narrow",
  "reason": "<one sentence explanation>",
  "corrected_roles": ["role1", "role2"],
  "corrected_industry": "broader industry term",
  "should_retry": true|false
}`
          },
          { role: "user", content: `Diagnose zero results for: roles=[${intent.roles.join(", ")}], industry="${intent.industry}", platform=${platform}` },
        ],
      }),
    });
    
    if (response.ok) {
      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
      
      return {
        diagnosis: parsed.diagnosis || "unknown",
        suggestion: parsed.reason || "Unknown issue",
        correctedIntent: parsed.should_retry ? {
          roles: parsed.corrected_roles || intent.roles,
          industry: parsed.corrected_industry || intent.industry,
          location: intent.location,
          dateRange: intent.dateRange,
        } : undefined,
        shouldRetry: parsed.should_retry || false,
      };
    }
  } catch (err) {
    console.warn("Diagnostic AI call failed:", err);
  }
  
  return { diagnosis: "unknown", suggestion: "Could not determine cause", shouldRetry: false };
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

  // Get total count first to determine sample size
  const { count: totalCountPre } = await serviceClient
    .from("signal_leads")
    .select("*", { count: "exact", head: true })
    .eq("run_id", run.id);

  // Scale sample size with dataset: min(50, max(15, ceil(total * 0.05)))
  const dynamicSampleSize = Math.min(50, Math.max(15, Math.ceil((totalCountPre || 0) * 0.05)));

  const { data: sampleLeads } = await serviceClient
    .from("signal_leads")
    .select("*")
    .eq("run_id", run.id)
    .limit(dynamicSampleSize);

  if (!sampleLeads || sampleLeads.length === 0) {
    return { quality: "USELESS", reason: "Stage produced 0 results", suggestedAction: "abort" };
  }

  // Reuse the total count from above
  const totalCount = totalCountPre;

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

  // ── Gather search configuration context for the AI ──
  const advancedSettings = run.advanced_settings || {};
  const maxResultsPerSource = advancedSettings.max_results_per_source || 100;
  const stage1Def = pipeline[0] || {};
  const stage1Params = stage1Def.params_per_actor || {};
  const stage1SearchQueries: string[] = [];
  const stage1IndustryFilters: string[] = [];
  for (const [actorKey, params] of Object.entries(stage1Params)) {
    const p = params as any;
    if (p?.search_query) stage1SearchQueries.push(p.search_query);
    if (p?.searchQuery) stage1SearchQueries.push(p.searchQuery);
    if (p?.queries) stage1SearchQueries.push(String(p.queries));
    // Detect industry filter fields
    for (const [k, v] of Object.entries(p || {})) {
      if (/industry|category|vertical|sector/i.test(k) && v) {
        stage1IndustryFilters.push(`${k}=${v}`);
      }
    }
  }
  const hasIndustryContext = stage1IndustryFilters.length > 0 ||
    stage1SearchQueries.some(q => {
      // Check if the search query contains industry-specific terms from the user's original query
      const userWords = run.signal_query.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
      return userWords.some((w: string) => q.toLowerCase().includes(w));
    });

  const searchConfigContext = `
SEARCH CONFIGURATION CONTEXT:
- Max results per source cap: ${maxResultsPerSource}
- Stage 1 search queries: ${stage1SearchQueries.join(" | ") || "unknown"}
- Stage 1 industry filters applied: ${stage1IndustryFilters.join(", ") || "none"}
- Industry context in search query: ${hasIndustryContext ? "YES" : "NO"}

IMPORTANT — SMALL DATASET HANDLING:
If the dataset is small (≤ 500 records) and the relevance is low, this may NOT mean the search was bad.
It could mean the max_results_per_source cap (currently ${maxResultsPerSource}) is too low for this niche.
In that case:
- Do NOT rate as USELESS. Rate as LOW instead.
- Set reason to explain that the dataset cap is likely too small for the specificity of the query.
- The system will suggest the user increase their max results per source.

Only rate as USELESS when:
1. The data is genuinely irrelevant (e.g., completely wrong topic, spam, garbage data), OR
2. Critical downstream fields are completely empty AND the dataset is large (> 500), OR
3. The search clearly targeted the wrong data source entirely`;

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
${searchConfigContext}

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
- LOW: 20-40% relevance — data has value but downstream flow needs adjustment. ALSO use LOW when dataset cap is too small for this niche (not USELESS).
- USELESS: <20% relevance AND dataset is large (>500) OR data is completely garbage/wrong topic`
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
    const datasetSize = totalCount || sampleLeads.length;

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

    // USELESS — but check if this is really a small-cap issue disguised as bad data
    if (datasetSize <= 500 && maxResultsPerSource <= 500) {
      // Small dataset with low cap — this is likely a cap issue, not a data quality issue
      const capReason = `${reason}. The max results per source is set to ${maxResultsPerSource}, which may be too low for this niche query. The search executed correctly but the dataset cap limited the results. Consider increasing max results per source to 1000+ for broader coverage.`;
      console.log(`Stage ${stageNum}: USELESS downgraded to LOW — small cap (${maxResultsPerSource}) likely insufficient for niche query`);
      return {
        quality: "LOW",
        reason: capReason,
        suggestedAction: "continue",
      };
    }

    // Genuinely useless — large dataset but irrelevant
    const actionableReason = `${reason}. Stage ${stageNum} returned ${datasetSize} results but very few matched your criteria "${run.signal_query}". The search terms may need to be more specific to your target industry.`;
    return { quality: "USELESS", reason: actionableReason, suggestedAction: "abort" };
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

Available STAGE CATEGORIES (use stage_category field, NOT actor names):
- "people_data:linkedin" → LinkedIn People Search. Needs: company_name (>30%) OR company_linkedin_url. Outputs: contact_name, linkedin_profile, title
- "company_data:linkedin" → LinkedIn Company Scraper. Needs: company_linkedin_url. Outputs: industry, employee_count, website
- "enrichment:contact" → Website Contact Scraper. Needs: website (>30%). Outputs: email, phone
- "web_search:google" → Google Search. Needs: search query. Outputs: website, description. Can find LinkedIn URLs.
- "hiring_intent:linkedin" → LinkedIn Jobs. Outputs: company_name, linkedin, industry
- "hiring_intent:indeed" → Indeed Jobs. Outputs: company_name, title, location

RULES:
- Output each stage with "stage_category" (e.g. "people_data:linkedin"), NOT "actors"
- You can ONLY use fields that have >30% coverage as inputs
- If company_linkedin_url coverage is <30%, you MUST add a "web_search:google" discovery stage before any stage that needs it
- If website coverage is <30%, you cannot use "enrichment:contact"
- Keep the same end goal: find qualified leads matching the user's query
- **CRITICAL: NEVER drop person-enrichment or "Identify Decision Makers" stages.** If the original pipeline included a stage to find people/decision makers, you MUST keep it using stage_category "people_data:linkedin". Person enrichment can use company_name (>30% coverage is sufficient).

Return a JSON array of replacement stages with "stage_category" field (not "actors"). Or return {"abort": true, "reason": "explanation"} if infeasible.

Example stage format:
{ "stage": 3, "name": "Find Decision Makers", "type": "scrape", "stage_category": "people_data:linkedin", "input_from": "company_name", "params": {}, "expected_output_count": 100 }`
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

    // ── Resolve stage_category → real actors for each reconfigured stage ──
    for (const stage of newStages) {
      if (stage.type === "scrape" && stage.stage_category) {
        const resolved = resolveVerifiedActor(stage.stage_category);
        if (resolved) {
          stage.actors = [resolved.key];
          stage.params_per_actor = { [resolved.key]: stage.params || {} };
          // Register in the plan's actor registry so getActor() works at execution time
          planActorRegistry.set(resolved.key, resolved);
          console.log(`Reconfiguration: resolved ${stage.stage_category} → ${resolved.actorId} (key: ${resolved.key})`);
        } else {
          // Fallback: try using stage_category as-is (legacy compat)
          console.warn(`Reconfiguration: no verified actor for category "${stage.stage_category}", stage may fail`);
        }
      }
      // Legacy compat: if AI still outputs actors[] with old names, try to resolve them
      if (stage.type === "scrape" && stage.actors && !stage.stage_category) {
        const legacyMap: Record<string, string> = {
          "linkedin_people": "people_data:linkedin",
          "linkedin_companies": "company_data:linkedin",
          "contact_enrichment": "enrichment:contact",
          "google_search": "web_search:google",
          "website_crawler": "enrichment:contact",
        };
        for (const actorName of stage.actors) {
          const mappedCategory = legacyMap[actorName];
          if (mappedCategory) {
            const resolved = resolveVerifiedActor(mappedCategory);
            if (resolved) {
              stage.actors = [resolved.key];
              stage.stage_category = mappedCategory;
              stage.params_per_actor = { [resolved.key]: stage.params || {} };
              planActorRegistry.set(resolved.key, resolved);
              console.log(`Reconfiguration: legacy actor "${actorName}" → ${resolved.actorId}`);
              break;
            }
          }
        }
      }
    }

    // Post-reconfiguration validation: ensure person-enrichment wasn't dropped
    const originalHadPersonEnrichment = remainingStages.some((s: any) => 
      s.name?.toLowerCase().includes("decision maker") || 
      s.name?.toLowerCase().includes("people") || 
      s.name?.toLowerCase().includes("person") ||
      s.stage_category === "people_data:linkedin" ||
      (s.type === "scrape" && s.actors?.some((a: string) => a.toLowerCase().includes("people") || a.toLowerCase().includes("person")))
    );
    const newHasPersonEnrichment = newStages.some((s: any) => 
      s.name?.toLowerCase().includes("decision maker") || 
      s.name?.toLowerCase().includes("people") || 
      s.name?.toLowerCase().includes("person") ||
      s.stage_category === "people_data:linkedin"
    );
    
    if (originalHadPersonEnrichment && !newHasPersonEnrichment && fieldCoverage["company_name"] >= 30) {
      console.log("Person-enrichment stage was dropped during reconfiguration — re-injecting");
      const lastStageNum = newStages.length > 0 ? Math.max(...newStages.map((s: any) => s.stage || 0)) : currentStage;
      const resolved = resolveVerifiedActor("people_data:linkedin");
      const actorKey = resolved?.key || "2SyF0bVxmgQr8SsLY";
      if (resolved) planActorRegistry.set(actorKey, resolved);
      newStages.push({
        stage: lastStageNum + 1,
        name: "Identify Decision Makers",
        type: "scrape",
        stage_category: "people_data:linkedin",
        actors: [actorKey],
        params_per_actor: { [actorKey]: {} },
        input_from: "company_name",
        search_titles: ["CEO", "Founder", "Owner", "Managing Director", "VP Sales", "Head of Sales"],
        dedup_after: false,
        updates_fields: ["contact_name", "linkedin_profile_url", "title"],
        expected_output_count: Math.min((sampleLeads?.length || 50), 200),
      });
    }

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
    // Persist any newly resolved actors into the plan's actor_registry
    const existingRegistry = run.signal_plan?.actor_registry || {};
    const mergedRegistry = { ...existingRegistry };
    for (const [key, actor] of planActorRegistry.entries()) {
      if (!mergedRegistry[key]) {
        mergedRegistry[key] = actor;
      }
    }
    const updatedPlan = { ...run.signal_plan, pipeline: newPipeline, actor_registry: mergedRegistry };

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

    // Runtime schema fetch: skip for verified actors (schema is hardcoded and accurate)
    // Only fetch for dynamically-discovered actors with missing schemas
    if (!(actor as any)._verified && (!actor.inputSchema || Object.keys(actor.inputSchema).length === 0)) {
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
    } else if ((actor as any)._verified) {
      console.log(`Skipping runtime schema fetch for verified actor ${actorKey}`);
    }

    if (stageNum === 1) {
      // Discovery stage: use Query Normalization Engine
      const actorParams = stageDef.params_per_actor?.[actorKey] || {};
      const intent = parseSearchIntent(stageDef);
      const platform = detectPlatform(actor);
      
      // Override location from actor params if available
      intent.location = actorParams.location || actorParams.searchLocation || intent.location;
      
      // Use normalization engine for deterministic URL/query construction
      const platformQuery = buildPlatformSearchQuery(platform, intent, actorParams);
      const input = { ...platformQuery.params };
      
      // Remove plan-provided URLs that may be stale/incomplete
      if (platform === "linkedin" && platformQuery.url) {
        delete input.splitCountry;
      }

      // Set max results limit — but NEVER override planner-set caps
      const KNOWN_LIMIT_FIELDS = ["maxItems", "limit", "count", "maxResults", "max_results", "rows", "numResults", "maxCrawledPlacesPerSearch", "maxCrawledPagesPerSearch"];
      const hasExistingLimit = KNOWN_LIMIT_FIELDS.some(f => input[f] !== undefined);
      const schemaKeys = Object.keys(actor.inputSchema);
      const hasSchema = schemaKeys.length > 0;

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
      
      // Log the constructed query for debugging
      const queryDescription = intent.roles.length > 0 
        ? `roles=[${intent.roles.join(", ")}] industry="${intent.industry}" location="${intent.location}"`
        : `query="${stageDef.search_query}" location="${intent.location}"`;
      console.log(`Stage ${stageNum}: ${platform} query: ${queryDescription}`);
      if (platformQuery.url) console.log(`Stage ${stageNum}: URL: ${platformQuery.url}`);

      try {
        const { runId, datasetId, usedActor } = await startApifyRunWithFallback(actor, actorInput, APIFY_API_TOKEN);
        const usedKey = usedActor.key;
        if (usedKey !== actorKey) console.log(`Stage ${stageNum}: Swapped ${actorKey} → ${usedKey} (fallback)`);
        refs.push({ actorKey: usedKey, keyword: queryDescription, runId, datasetId, status: "RUNNING", startedAt: new Date().toISOString(), pipelineStage: stageNum });
        console.log(`Stage ${stageNum}: Started ${usedKey} → run ${runId}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (isCapacityError(errMsg)) {
          refs.push({ actorKey, keyword: queryDescription, runId: "", datasetId: "", status: "DEFERRED", pipelineStage: stageNum });
        } else {
          console.error(`Failed to start ${actorKey}:`, err);
          refs.push({ actorKey, keyword: queryDescription, runId: "", datasetId: "", status: "FAILED", pipelineStage: stageNum });
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
      let peopleSearchMode: "structured" | "url" = "url"; // Track how we're passing people data
      if ((actor.category === "people_data" || actor.actorId.includes("linkedin") && actor.label.toLowerCase().includes("people")) && stageDef.search_titles) {
        const titles = stageDef.search_titles;
        const titlesStr = titles.join(" OR ");
        
        // Detect whether this actor expects structured params or URLs
        const hasSchema = Object.keys(actor.inputSchema).length > 0;
        const schemaKeys = Object.keys(actor.inputSchema);
        const hasCompanyField = hasSchema && schemaKeys.some((k: string) => /company|organization|employer/i.test(k));
        const hasTitleField = hasSchema && schemaKeys.some((k: string) => /title|position|role|headline/i.test(k));
        const hasNameField = hasSchema && schemaKeys.some((k: string) => /name|keyword|search|query/i.test(k));
        const hasUrlField = hasSchema && (!!actor.inputSchema["startUrls"] || !!actor.inputSchema["urls"] || !!actor.inputSchema["profileUrls"]);
        
        // Prefer structured params when actor supports them (company + title fields)
        const useStructured = hasCompanyField || hasTitleField || (hasNameField && !hasUrlField);
        
        if (useStructured) {
          peopleSearchMode = "structured";
          console.log(`Stage ${stageNum}: People search using STRUCTURED params for ${actorKey} (company field: ${hasCompanyField}, title field: ${hasTitleField})`);
          
          // Build structured search entries — one per lead
          // We'll store JSON-encoded objects and parse them in the batch builder
          for (const lead of existingLeads) {
            const companyName = lead.company_name || "";
            const companyLinkedinUrl = lead.company_linkedin_url || lead.linkedin || "";
            if (!companyName && !companyLinkedinUrl) continue;
            
            // Store as JSON so we can parse later and build proper structured input
            inputValues.push(JSON.stringify({
              company: companyName,
              companyLinkedinUrl,
              titles: titlesStr,
              leadId: lead.id,
            }));
          }
        } else {
          // Fallback: build LinkedIn search URLs (original behavior, improved)
          peopleSearchMode = "url";
          console.log(`Stage ${stageNum}: People search using URL mode for ${actorKey}`);
          
          for (const lead of existingLeads) {
            const companyName = lead.company_name || "";
            if (!companyName) continue;
            
            // Build cleaner search URLs — separate title and company for better precision
            const encodedTitles = encodeURIComponent(titlesStr);
            const encodedCompany = encodeURIComponent(companyName);
            inputValues.push(`https://www.linkedin.com/search/results/people/?keywords=${encodedTitles}&company=${encodedCompany}`);
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
        const schemaKeys = Object.keys(actor.inputSchema);

        // For people_data with structured mode: build proper structured params
        if (actor.category === "people_data" && peopleSearchMode === "structured") {
          const parsedEntries = batch.map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean);
          
          // Find the best schema fields for company and title
          const companyField = schemaKeys.find((k: string) => /^company$|^organization$|^employer$/i.test(k)) 
            || schemaKeys.find((k: string) => /company|organization|employer/i.test(k));
          const titleField = schemaKeys.find((k: string) => /^title$|^position$|^role$/i.test(k))
            || schemaKeys.find((k: string) => /title|position|role|headline/i.test(k));
          const searchField = schemaKeys.find((k: string) => /^search$|^query$|^keyword$|^keywords$/i.test(k))
            || schemaKeys.find((k: string) => /search|query|keyword/i.test(k));
          
          if (companyField || titleField) {
            // Actor supports structured company/title — pass as search queries
            const queries = parsedEntries.map((e: any) => `${e.titles} ${e.company}`);
            if (companyField && titleField) {
              // Best case: separate fields
              input[companyField] = parsedEntries.map((e: any) => e.company);
              input[titleField] = parsedEntries[0]?.titles || "";
            } else if (searchField) {
              input[searchField] = queries.join("\n");
            }
            // Also provide URLs as fallback
            if (actor.inputSchema["startUrls"]) {
              input.startUrls = parsedEntries.map((e: any) => ({
                url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(e.titles)}%20${encodeURIComponent(e.company)}`
              }));
            }
          } else if (searchField) {
            input[searchField] = parsedEntries.map((e: any) => `${e.titles} ${e.company}`);
          } else {
            // Fallback to URL mode even in structured mode
            input.startUrls = parsedEntries.map((e: any) => ({
              url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(e.titles)}%20${encodeURIComponent(e.company)}`
            }));
            input.urls = parsedEntries.map((e: any) => 
              `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(e.titles)}%20${encodeURIComponent(e.company)}`
            );
          }
          console.log(`Stage ${stageNum}: Built structured people input — companyField: ${companyField}, titleField: ${titleField}, searchField: ${searchField}`);
        }
        // Determine how to pass the batch to this actor (non-people or URL mode people)
        else if (hasSchema) {
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

    // ZERO-RESULT RECOVERY: If discovery stage has 0 leads, use diagnostic engine
    if (!stageDef.input_from) {
      const { count: leadCount } = await serviceClient
        .from("signal_leads").select("*", { count: "exact", head: true })
        .eq("run_id", run.id);

      if (!leadCount || leadCount === 0) {
        const stageActorRuns = (run.apify_run_ids || []).filter((r: any) => (r.pipelineStage || 1) === stageNum);
        const adjustments = run.pipeline_adjustments || [];
        const alreadyTriedDiagnostic = adjustments.some((a: any) => a.type === "diagnostic_retry" && a.stage === stageNum);
        const alreadyTriedBackup = adjustments.some((a: any) => a.type === "zero_result_backup_attempt" && a.stage === stageNum);

        // Step 1: Run diagnostic engine (only once per stage)
        if (!alreadyTriedDiagnostic && !alreadyTriedBackup) {
          console.log(`Stage ${stageNum}: ZERO RESULTS — running diagnostic engine`);
          const diagnostic = await diagnoseZeroResults(run, stageDef, stageActorRuns, serviceClient);
          console.log(`Stage ${stageNum}: Diagnosis: ${diagnostic.diagnosis} — ${diagnostic.suggestion}`);
          
          adjustments.push({
            type: "diagnostic_retry",
            stage: stageNum,
            diagnosis: diagnostic.diagnosis,
            suggestion: diagnostic.suggestion,
            timestamp: new Date().toISOString(),
          });

          if (diagnostic.shouldRetry && diagnostic.correctedIntent) {
            // Auto-retry with corrected search intent
            console.log(`Stage ${stageNum}: Auto-retrying with corrected intent`);
            const primaryActorKey = (stageDef.actors || [])[0];
            const actor = getActor(primaryActorKey);
            
            if (actor) {
              const platform = detectPlatform(actor);
              const actorParams = stageDef.params_per_actor?.[primaryActorKey] || {};
              const correctedQuery = buildPlatformSearchQuery(platform, diagnostic.correctedIntent, actorParams);
              const correctedInput = buildGenericInput(actor, correctedQuery.params);
              if (!correctedInput.proxyConfiguration) correctedInput.proxyConfiguration = { useApifyProxy: true };
              
              try {
                const { runId, datasetId, usedActor } = await startApifyRunWithFallback(actor, correctedInput, APIFY_API_TOKEN);
                const retryRef: ApifyRunRef = {
                  actorKey: usedActor.key,
                  keyword: `diagnostic_retry`,
                  runId, datasetId,
                  status: "RUNNING",
                  startedAt: new Date().toISOString(),
                  pipelineStage: stageNum,
                };
                
                await serviceClient.from("signal_runs").update({
                  apify_run_ids: [...(run.apify_run_ids || []), retryRef],
                  processing_phase: `stage_${stageNum}_scraping`,
                  collected_dataset_index: 0,
                  pipeline_adjustments: adjustments,
                  updated_at: new Date().toISOString(),
                }).eq("id", run.id);
                return; // Go back to polling
              } catch (err) {
                console.warn(`Stage ${stageNum}: Diagnostic retry failed to start:`, err);
              }
            }
          }
        }

        // Step 2: Try backup actors (existing logic, simplified)
        if (!alreadyTriedBackup) {
          const usedActorKeys = new Set(stageActorRuns.map((r: any) => r.actorKey));
          const primaryActors = (stageDef.actors || []).map((k: string) => getActor(k)).filter(Boolean);
          const allBackups: ActorEntry[] = [];
          for (const primary of primaryActors) {
            if (!primary) continue;
            allBackups.push(...findBackupActors(primary).filter(b => !usedActorKeys.has(b.key)));
          }

          if (allBackups.length > 0) {
            console.log(`Stage ${stageNum}: Trying ${allBackups.length} backup actors`);
            const backupRefs: ApifyRunRef[] = [];
            
            for (const backup of allBackups.slice(0, 2)) {
              // Use normalization engine for backup actors too
              const intent = parseSearchIntent(stageDef);
              const platform = detectPlatform(backup);
              const actorParams = stageDef.params_per_actor?.[(stageDef.actors || [])[0]] || {};
              const platformQuery = buildPlatformSearchQuery(platform, intent, actorParams);
              const backupInput = buildGenericInput(backup, platformQuery.params);
              if (!backupInput.proxyConfiguration) backupInput.proxyConfiguration = { useApifyProxy: true };
              
              try {
                const result = await startApifyRun(backup, backupInput, APIFY_API_TOKEN);
                backupRefs.push({ actorKey: backup.key, keyword: "backup_retry", runId: result.runId, datasetId: result.datasetId, status: "RUNNING", startedAt: new Date().toISOString(), pipelineStage: stageNum });
              } catch (err) {
                console.warn(`Stage ${stageNum}: Backup ${backup.key} failed:`, err);
              }
            }

            if (backupRefs.length > 0) {
              adjustments.push({ type: "zero_result_backup_attempt", stage: stageNum, backup_actors: backupRefs.map(r => r.actorKey), timestamp: new Date().toISOString() });
              await serviceClient.from("signal_runs").update({
                apify_run_ids: [...(run.apify_run_ids || []), ...backupRefs],
                processing_phase: `stage_${stageNum}_scraping`,
                collected_dataset_index: 0,
                pipeline_adjustments: adjustments,
                updated_at: new Date().toISOString(),
              }).eq("id", run.id);
              return;
            }
          }
        }

        // Step 3: All recovery attempts exhausted — fail with actionable message
        const diagnosticAdj = adjustments.find((a: any) => a.type === "diagnostic_retry");
        const diagSuggestion = diagnosticAdj?.suggestion || "";
        const advSettings = run.advanced_settings || {};
        const maxPerSource = advSettings.max_results_per_source || 100;
        
        const userMessage = diagSuggestion 
          ? `No results found. ${diagSuggestion} Try broadening your search terms or increasing max results per source (currently ${maxPerSource}).`
          : `No results found for "${run.signal_query}". Try broader search terms, a different date range, or increasing max results per source to 1000+.`;

        console.log(`Stage ${stageNum}: ZERO RESULTS — all recovery exhausted, aborting`);
        await serviceClient.from("signal_runs").update({
          status: "failed",
          error_message: userMessage,
          processing_phase: "aborted",
          pipeline_adjustments: adjustments,
        }).eq("id", run.id);

        if (run.user_id) {
          await serviceClient.from("notifications").insert({
            user_id: run.user_id, workspace_id: run.workspace_id,
            type: "signal_failed", title: "Signal — No Results Found",
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
    const stageActorParams = stageDef?.params_per_actor?.[ref.actorKey] || {};
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
      // People-finding stage: UPDATE existing leads with person data using SCORED matching
      const { data: allRunLeads } = await serviceClient
        .from("signal_leads").select("id, company_name, domain, company_linkedin_url, website").eq("run_id", run.id).limit(10000);
      const runLeads = allRunLeads || [];
      
      const MIN_MATCH_SCORE = 70;
      let matchedCount = 0;
      let totalPersonItems = 0;
      // Track which leads already have a person assigned (prevent overwriting with lower-score match)
      const assignedLeadIds = new Set<string>();

      for (const item of normalised) {
        const personCompany = (item.company_name || "").trim().toLowerCase();
        if (!personCompany) continue;
        totalPersonItems++;

        const personLinkedIn = item._raw?.currentCompanyLinkedinUrl || item._raw?.companyLinkedinUrl || "";
        const personDomain = extractDomain(item._raw?.companyUrl || item._raw?.website || "");
        
        // Score each lead candidate
        let bestMatch: { id: string; score: number } | null = null;
        
        for (const lead of runLeads) {
          if (assignedLeadIds.has(lead.id)) continue; // Already assigned
          let score = 0;
          
          // Domain match = 100 (strongest signal)
          if (personDomain && lead.domain && personDomain === lead.domain) {
            score = 100;
          }
          
          // LinkedIn company URL match = 90
          if (score < 90 && personLinkedIn && lead.company_linkedin_url) {
            const normPerson = personLinkedIn.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\/(www\.)?/, "");
            const normLead = lead.company_linkedin_url.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\/(www\.)?/, "");
            if (normPerson === normLead) score = Math.max(score, 90);
          }
          
          // Exact company name match = 80
          const leadName = (lead.company_name || "").trim().toLowerCase();
          if (leadName && leadName === personCompany) {
            score = Math.max(score, 80);
          }
          
          // Fuzzy containment = 50 (only if names are reasonably long to avoid false positives)
          if (score < 50 && leadName && leadName.length >= 4 && personCompany.length >= 4) {
            if (leadName.includes(personCompany) || personCompany.includes(leadName)) {
              // Penalize if the shorter name is very short (too generic)
              const shorter = Math.min(leadName.length, personCompany.length);
              const longer = Math.max(leadName.length, personCompany.length);
              const ratio = shorter / longer;
              if (ratio >= 0.4) { // "Acme" vs "Acme Corporation" = ok; "A" vs "Acme Corp" = reject
                score = Math.max(score, 50);
              }
            }
          }
          
          if (score > (bestMatch?.score || 0)) {
            bestMatch = { id: lead.id, score };
          }
        }

        if (bestMatch && bestMatch.score >= MIN_MATCH_SCORE) {
          assignedLeadIds.add(bestMatch.id);
          matchedCount++;
          await serviceClient.from("signal_leads").update({
            contact_name: item.contact_name || null,
            title: item.title || null,
            linkedin_profile_url: item.linkedin_profile || null,
            pipeline_stage: `stage_${stageNum}`,
          }).eq("id", bestMatch.id);
        }
      }
      
      const matchRate = totalPersonItems > 0 ? Math.round((matchedCount / totalPersonItems) * 100) : 0;
      console.log(`Stage ${stageNum}: Person matching — ${matchedCount}/${totalPersonItems} matched (${matchRate}%, min score: ${MIN_MATCH_SCORE})`);
      
      // APOLLO FALLBACK: If match rate is <30%, trigger Apollo enrichment for unmatched leads
      if (matchRate < 30 && totalPersonItems > 5) {
        console.warn(`Stage ${stageNum}: LOW MATCH RATE (${matchRate}%) — triggering Apollo enrichment fallback`);
        
        // Find leads that still lack contact_name after people matching
        const { data: unmatchedLeads } = await serviceClient
          .from("signal_leads")
          .select("id, company_name, domain, website")
          .eq("run_id", run.id)
          .is("contact_name", null)
          .limit(100);
        
        if (unmatchedLeads && unmatchedLeads.length > 0) {
          const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
          const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
          
          if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
            let apolloEnriched = 0;
            // Process in batches of 10 to avoid overwhelming Apollo
            for (let batch = 0; batch < unmatchedLeads.length && batch < 50; batch += 10) {
              const batchLeads = unmatchedLeads.slice(batch, batch + 10);
              for (const lead of batchLeads) {
                try {
                  const enrichResp = await fetch(`${SUPABASE_URL}/functions/v1/apollo-enrich`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    },
                    body: JSON.stringify({
                      workspace_id: run.workspace_id,
                      domain: lead.domain || extractDomain(lead.website || ""),
                      company_name: lead.company_name,
                    }),
                  });
                  
                  if (enrichResp.ok) {
                    const enrichData = await enrichResp.json();
                    if (enrichData?.contact_name || enrichData?.email || enrichData?.phone) {
                      const updateData: Record<string, any> = {};
                      if (enrichData.contact_name) updateData.contact_name = enrichData.contact_name;
                      if (enrichData.email) updateData.email = enrichData.email;
                      if (enrichData.phone) updateData.phone = enrichData.phone;
                      if (enrichData.title) updateData.title = enrichData.title;
                      if (enrichData.linkedin_url) updateData.linkedin_profile_url = enrichData.linkedin_url;
                      
                      await serviceClient.from("signal_leads").update(updateData).eq("id", lead.id);
                      apolloEnriched++;
                    }
                  }
                } catch (err) {
                  console.warn(`Apollo enrichment failed for lead ${lead.id}:`, err);
                }
              }
            }
            
            console.log(`Stage ${stageNum}: Apollo fallback enriched ${apolloEnriched}/${Math.min(unmatchedLeads.length, 50)} leads`);
            
            // Record the Apollo fallback in pipeline_adjustments
            const adjustments = run.pipeline_adjustments || [];
            adjustments.push({
              type: "apollo_fallback",
              stage: stageNum,
              match_rate: matchRate,
              apollo_enriched: apolloEnriched,
              unmatched_total: unmatchedLeads.length,
              timestamp: new Date().toISOString(),
            });
            await serviceClient.from("signal_runs").update({
              pipeline_adjustments: adjustments,
            }).eq("id", run.id);
          }
        }
      } else if (matchRate < 20 && totalPersonItems > 5) {
        // Record low match rate without Apollo (original behavior for very low match rates)
        const adjustments = run.pipeline_adjustments || [];
        adjustments.push({
          type: "low_people_match_rate",
          stage: stageNum,
          match_rate: matchRate,
          matched: matchedCount,
          total: totalPersonItems,
          timestamp: new Date().toISOString(),
        });
        await serviceClient.from("signal_runs").update({
          pipeline_adjustments: adjustments,
        }).eq("id", run.id);
      }
    } else {
      // Enrichment stage: UPDATE existing leads with enriched data
      // Support matching by domain OR company name (fallback when domain is missing)
      const { data: allEnrichLeads } = await serviceClient
        .from("signal_leads").select("id, company_name, domain").eq("run_id", run.id).limit(10000);
      const enrichLeads = allEnrichLeads || [];
      
      for (const item of normalised) {
        const domain = extractDomain(item.website || "");
        const itemCompanyName = (item.company_name || "").trim().toLowerCase();

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

        // Primary match: by domain
        if (domain) {
          await serviceClient.from("signal_leads").update(updateData)
            .eq("run_id", run.id).eq("domain", domain);
        } 
        // Fallback match: by company name when domain is missing
        else if (itemCompanyName) {
          // Find leads matching by exact company name (case-insensitive)
          const matchingLeads = enrichLeads.filter((l: any) => {
            const leadName = (l.company_name || "").trim().toLowerCase();
            return leadName === itemCompanyName;
          });
          for (const lead of matchingLeads) {
            await serviceClient.from("signal_leads").update(updateData).eq("id", lead.id);
          }
          // If no exact match, try fuzzy
          if (matchingLeads.length === 0) {
            const fuzzyLeads = enrichLeads.filter((l: any) => {
              const leadName = (l.company_name || "").trim().toLowerCase();
              return leadName && leadName.length >= 4 && itemCompanyName.length >= 4 && 
                (leadName.includes(itemCompanyName) || itemCompanyName.includes(leadName));
            });
            for (const lead of fuzzyLeads) {
              await serviceClient.from("signal_leads").update(updateData).eq("id", lead.id);
            }
          }
        }
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

  // ── Mandatory field coverage check ──
  const MANDATORY_FIELDS = ["contact_name", "industry", "website", "company_linkedin_url", "linkedin_profile_url", "employee_count"];
  const { data: coverageSample } = await serviceClient
    .from("signal_leads").select("contact_name, industry, website, company_linkedin_url, linkedin_profile_url, employee_count")
    .eq("run_id", run.id).limit(200);

  if (coverageSample && coverageSample.length > 0) {
    const fieldGaps: string[] = [];
    const fieldCoverage: Record<string, number> = {};
    for (const field of MANDATORY_FIELDS) {
      const count = coverageSample.filter((l: any) => l[field] && l[field] !== "").length;
      const pct = Math.round((count / coverageSample.length) * 100);
      fieldCoverage[field] = pct;
      if (pct < 30) {
        fieldGaps.push(field);
      }
    }
    if (fieldGaps.length > 0) {
      console.log(`Pipeline ${run.id}: Field gaps detected (<30% coverage): ${fieldGaps.join(", ")}. Coverage: ${JSON.stringify(fieldCoverage)}`);
      // Store field_gaps on the run for UI display
      await serviceClient.from("signal_runs").update({
        pipeline_adjustments: [...(run.pipeline_adjustments || []), {
          type: "field_gap_warning",
          field_gaps: fieldGaps,
          field_coverage: fieldCoverage,
          timestamp: new Date().toISOString(),
        }],
      }).eq("id", run.id);
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

  // ── CREDIT RECONCILIATION: Use actual collected row counts, not plan estimates ──
  let actualCredits = 0;
  if (leadsCount > 0) {
    // Count actual rows collected per stage from apify_run_ids
    const allRefs: ApifyRunRef[] = run.apify_run_ids || [];
    let totalActualScrapedRows = 0;
    let totalAiFilteredRows = 0;
    
    // Sum actual dataset sizes from succeeded runs
    for (const ref of allRefs) {
      if (ref.status === "SUCCEEDED" && ref.datasetId) {
        // Use the collected data count — we track this during collection
        // Approximate from leads in DB for this stage
        totalActualScrapedRows += 500; // conservative per-run estimate
      }
    }
    
    // Better: use actual leads count as ground truth for scrape volume
    // The real scrape volume = leads before filtering + filtered out leads
    // But we only have final count. Use pipeline structure for AI filter estimate.
    for (const stage of pipeline) {
      if (stage.type === "ai_filter") {
        // AI filter processed approximately current lead count / pass_rate rows
        const passRate = stage.expected_pass_rate || 0.20;
        totalAiFilteredRows += Math.ceil(leadsCount / passRate);
      }
    }
    
    // Use the larger of: actual ref count or estimated from plan
    const planScrapedRows = pipeline
      .filter((s: any) => s.type === "scrape")
      .reduce((sum: number, s: any) => sum + (s.expected_output_count || 0), 0);
    
    const effectiveScrapedRows = Math.max(
      totalActualScrapedRows,
      planScrapedRows > 0 ? planScrapedRows : leadsCount * 3 // fallback: ~3x final leads
    );

    const scrapeCostUsd = (effectiveScrapedRows / 1000) * 1.0;
    const aiCostUsd = totalAiFilteredRows * 0.001;
    const totalUsd = (scrapeCostUsd + aiCostUsd) * 1.5;
    actualCredits = Math.max(5, Math.ceil(totalUsd * 5));
  }

  // Reconcile against upfront deduction
  const upfrontCredits = run.estimated_cost || 0;
  if (actualCredits > 0) {
    const { data: creditsData } = await serviceClient
      .from("lead_credits").select("credits_balance").eq("workspace_id", run.workspace_id).maybeSingle();
    const balance = creditsData?.credits_balance || 0;
    
    if (upfrontCredits > 0) {
      // Credits were already deducted at plan time — reconcile the delta
      const delta = actualCredits - upfrontCredits;
      if (delta !== 0) {
        await serviceClient.from("lead_credits").update({ credits_balance: balance - delta }).eq("workspace_id", run.workspace_id);
        console.log(`Credit reconciliation: upfront=${upfrontCredits}, actual=${actualCredits}, delta=${delta}`);
      }
    } else {
      // No upfront deduction — charge full amount
      await serviceClient.from("lead_credits").update({ credits_balance: balance - actualCredits }).eq("workspace_id", run.workspace_id);
    }
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
    const fieldGapAdj = adjustments.find((a: any) => a.type === "field_gap_warning");
    const adjustmentNote = adjustments.filter((a: any) => a.type !== "field_gap_warning").length > 0 
      ? ` Pipeline was adapted ${adjustments.filter((a: any) => a.type !== "field_gap_warning").length} time(s) during execution.` 
      : "";
    const fieldGapNote = fieldGapAdj 
      ? ` Note: Some fields have low coverage: ${fieldGapAdj.field_gaps.join(", ")}.` 
      : "";
    await serviceClient.from("notifications").insert({
      user_id: run.user_id, workspace_id: run.workspace_id,
      type: "signal_complete", title: "Signal Complete!",
      message: `Your signal "${run.signal_name || run.signal_query}" completed ${pipeline.length} stages and found ${leadsCount} leads. ${actualCredits} credits charged.${adjustmentNote}${fieldGapNote}`,
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
