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
  _schemaSource?: "runtime" | "catalog_fallback"; // tracks trust level
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

// ── Runtime Schema Authority — always fetch live schema, cache in-memory ──
const _runtimeSchemaCache = new Map<string, { fields: Record<string, InputField>; source: "runtime" | "catalog_fallback" }>();

async function fetchAndMergeRuntimeSchema(actor: ActorEntry, token: string): Promise<void> {
  const cacheKey = actor.actorId;

  // Return cached result if available
  if (_runtimeSchemaCache.has(cacheKey)) {
    const cached = _runtimeSchemaCache.get(cacheKey)!;
    const merged: Record<string, InputField> = { ...(actor.inputSchema || {}) };
    for (const [key, val] of Object.entries(cached.fields)) {
      merged[key] = { ...(merged[key] || {}), ...val, type: val.type, _schemaSource: cached.source };
    }
    for (const key of Object.keys(merged)) {
      if (!merged[key]._schemaSource) merged[key]._schemaSource = cached.source;
    }
    actor.inputSchema = merged;
    (actor as any)._schemaSource = cached.source;
    return;
  }

  // Multi-strategy schema resolution
  const actorIdEncoded = actor.actorId.replace("/", "~");
  const endpoints = [
    `https://api.apify.com/v2/acts/${actorIdEncoded}/input-schema?token=${token}`,
    `https://api.apify.com/v2/acts/${actorIdEncoded}?token=${token}`,
    `https://api.apify.com/v2/store/${actorIdEncoded}?token=${token}`,
  ];

  for (let i = 0; i < endpoints.length; i++) {
    try {
      const resp = await fetch(endpoints[i], { method: "GET" });
      if (!resp.ok) {
        console.warn(`Schema endpoint ${i} returned ${resp.status} for ${actor.actorId}`);
        continue;
      }
      const data = await resp.json();
      let props: Record<string, any> = {};
      if (data.properties && Object.keys(data.properties).length > 0) {
        props = data.properties;
      } else if (data.data?.defaultRunInput?.schema?.properties) {
        props = data.data.defaultRunInput.schema.properties;
      } else if (data.data?.input?.properties) {
        props = data.data.input.properties;
      } else if (data.data?.properties) {
        props = data.data.properties;
      }

      if (Object.keys(props).length === 0) continue;

      const fetchedSchema: Record<string, InputField> = {};
      for (const [key, val] of Object.entries(props as Record<string, any>)) {
        const type = val.type === "array"
          ? (val.items?.type === "object" || val.items?.properties ? "object[]" : "string[]")
          : (val.type === "integer" ? "number" : (val.type || "string"));
        fetchedSchema[key] = {
          type: type as any,
          required: false,
          default: val.default,
          description: (val.description || key).slice(0, 200),
          _schemaSource: "runtime",
        };
      }

      _runtimeSchemaCache.set(cacheKey, { fields: fetchedSchema, source: "runtime" });
      console.log(`Runtime schema fetched for ${actor.actorId} via endpoint ${i}: ${Object.keys(fetchedSchema).length} fields`);

      const merged: Record<string, InputField> = { ...(actor.inputSchema || {}) };
      for (const [key, val] of Object.entries(fetchedSchema)) {
        merged[key] = { ...(merged[key] || {}), ...val, type: val.type, _schemaSource: "runtime" };
      }
      for (const key of Object.keys(merged)) {
        if (!merged[key]._schemaSource) merged[key]._schemaSource = "runtime";
      }
      actor.inputSchema = merged;
      (actor as any)._schemaSource = "runtime";
      return;
    } catch (e) {
      console.warn(`Schema endpoint ${i} failed for ${actor.actorId}:`, e);
    }
  }

  // All endpoints failed — mark as catalog fallback
  console.warn(`All schema endpoints failed for ${actor.actorId}, using existing schema as fallback`);
  _runtimeSchemaCache.set(cacheKey, { fields: actor.inputSchema || {}, source: "catalog_fallback" });
  (actor as any)._schemaSource = "catalog_fallback";
  if (actor.inputSchema) {
    for (const key of Object.keys(actor.inputSchema)) {
      actor.inputSchema[key]._schemaSource = "catalog_fallback";
    }
  }
}

// ── Resolve actor for a category from plan's actor registry ──
function resolveActorForCategory(stageCategory: string): ActorEntry | null {
  // Search plan's actor registry for matching actor
  for (const [, actor] of planActorRegistry.entries()) {
    const sub = (actor as any).subCategory || "";
    if (sub === stageCategory) return actor;
    if (actor.category === stageCategory.split(":")[0]) return actor;
  }
  return null;
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

interface SearchIntent {
  roles: string[];
  industry: string;
  location: string;
  dateRange?: string;
}

function parseSearchIntent(stageDef: any): SearchIntent {
  const roleFilter: string[] | null = stageDef.role_filter || null;
  const searchQuery: string = stageDef.search_query || "";
  
  let location = "United States";
  const paramsPerActor = stageDef.params_per_actor || {};
  for (const [, actorParams] of Object.entries(paramsPerActor)) {
    const ap = actorParams as Record<string, any>;
    if (ap?.location) { location = ap.location; break; }
    if (ap?.searchLocation) { location = ap.searchLocation; break; }
    if (ap?.urls?.[0]) {
      const urlMatch = String(ap.urls[0]).match(/location=([^&]+)/);
      if (urlMatch) { location = decodeURIComponent(urlMatch[1]); break; }
    }
  }
  if (stageDef.params?.location) location = stageDef.params.location;
  if (stageDef.params?.searchLocation) location = stageDef.params.searchLocation;
  
  return {
    roles: roleFilter || [],
    industry: roleFilter ? searchQuery : "",
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
  
  // Build the combined search keyword
  let combinedKeyword: string;
  if (intent.roles.length > 0 && intent.industry) {
    // FIX: For LinkedIn, use ONLY roles as keywords — industry is too broad for LinkedIn keyword field
    // Industry context is handled by the AI filter stage
    if (platform === "linkedin") {
      combinedKeyword = intent.roles.join(" OR ");
    } else {
      combinedKeyword = `${intent.roles.join(" OR ")} ${intent.industry}`;
    }
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
    if (sub.includes("people") || label.includes("people")) return "generic";
    if (sub.includes("company")) return "generic";
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
  
  const intent = parseSearchIntent(stageDef);
  const platform = detectPlatform(
    getActor(stageDef.actors?.[0] || "") || { actorId: "", label: "", category: "" } as any
  );
  
  if (!LOVABLE_API_KEY) {
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

  for (const [key, value] of Object.entries(params)) {
    if (result[key] === undefined && value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════
// ██  SCHEMA-AWARE INPUT NORMALIZER
// ═══════════════════════════════════════════════════════════

function normalizeInputToSchema(actor: ActorEntry, input: Record<string, any>): Record<string, any> {
  if (!actor.inputSchema || Object.keys(actor.inputSchema).length === 0) {
    return input;
  }

  const schemaSource = (actor as any)._schemaSource || "catalog_fallback";
  const result = { ...input };
  let coercions = 0;

  for (const [field, schema] of Object.entries(actor.inputSchema)) {
    if (result[field] === undefined) continue;
    const value = result[field];
    const declaredType = schema.type;
    const fieldSource = schema._schemaSource || schemaSource;
    const isUrlField = /url/i.test(field);

    if (declaredType === "string[]" && Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
      if (isUrlField && fieldSource !== "runtime") {
        console.log(`Schema normalization SKIPPED: "${field}" object[]→string[] coercion blocked (source: ${fieldSource}, not trusted) for actor ${actor.actorId}`);
        continue;
      }
      const firstObj = value[0];
      const stringProp = Object.keys(firstObj).find(k => typeof firstObj[k] === "string");
      if (stringProp) {
        result[field] = value.map((item: any) => typeof item === "object" && item !== null ? item[stringProp] : String(item));
        coercions++;
        console.log(`Schema coercion: "${field}" object[] → string[] (extracted .${stringProp}, source: ${fieldSource}) for actor ${actor.actorId}`);
      }
    }
    else if (declaredType === "string[]" && typeof value === "string") {
      result[field] = [value];
      coercions++;
      console.log(`Schema coercion: "${field}" string → string[] for actor ${actor.actorId}`);
    }
    else if (declaredType === "object[]" && Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
      result[field] = value.map((item: string) => ({ url: item }));
      coercions++;
      console.log(`Schema coercion: "${field}" string[] → object[] (wrapped as {url}, source: ${fieldSource}) for actor ${actor.actorId}`);
    }
    else if (declaredType === "number" && typeof value === "string") {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        result[field] = parsed;
        coercions++;
        console.log(`Schema coercion: "${field}" string → number for actor ${actor.actorId}`);
      }
    }
    else if (declaredType === "string" && Array.isArray(value) && value.length > 0) {
      result[field] = String(value[0]);
      coercions++;
      console.log(`Schema coercion: "${field}" array → string (first element) for actor ${actor.actorId}`);
    }
    else if (declaredType === "boolean" && typeof value === "string") {
      result[field] = value === "true" || value === "1";
      coercions++;
      console.log(`Schema coercion: "${field}" string → boolean for actor ${actor.actorId}`);
    }
  }

  for (const field of Object.keys(result)) {
    if (actor.inputSchema[field]) continue;
    if (!Array.isArray(result[field]) || result[field].length === 0) continue;
    if (typeof result[field][0] !== "object") continue;
  }

  if (coercions > 0) {
    console.log(`normalizeInputToSchema: Applied ${coercions} coercion(s) for actor ${actor.actorId} (schema source: ${schemaSource})`);
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
      if (subCategory && (a as any).subCategory) {
        return (a as any).subCategory === subCategory;
      }
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

// ── Self-healing URL shape flip for startUrls invalid-input errors ──
function flipStartUrlsShape(input: Record<string, any>): Record<string, any> | null {
  const urlFields = ["startUrls", "urls"];
  const flipped = { ...input };
  let didFlip = false;

  for (const field of urlFields) {
    if (!Array.isArray(flipped[field]) || flipped[field].length === 0) continue;
    const first = flipped[field][0];
    if (typeof first === "string") {
      flipped[field] = flipped[field].map((item: string) => ({ url: item }));
      didFlip = true;
      console.log(`URL flip: "${field}" string[] → object[] ({url})`);
    } else if (typeof first === "object" && first !== null && first.url) {
      flipped[field] = flipped[field].map((item: any) => item.url || String(item));
      didFlip = true;
      console.log(`URL flip: "${field}" object[] → string[]`);
    }
  }

  return didFlip ? flipped : null;
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
    console.warn(`Primary actor ${actor.key} failed: ${errMsg.slice(0, 200)}`);

    // ── Self-healing: flip startUrls shape and retry ──
    if (errMsg.includes("INPUT") || errMsg.includes("invalid") || errMsg.includes("schema")) {
      const flipped = flipStartUrlsShape(input);
      if (flipped) {
        try {
          console.log(`Retrying ${actor.key} with flipped URL shape`);
          const result = await startApifyRun(actor, flipped, token);
          return { ...result, usedActor: actor };
        } catch (retryErr) {
          console.warn(`Flipped retry also failed for ${actor.key}: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
        }
      }
    }

    // ── Fallback: try backup actors ──
    if (isNotRentedError(errMsg) || errMsg.includes("403") || errMsg.includes("401")) {
      const backups = findBackupActors(actor);
      for (const backup of backups) {
        try {
          await fetchAndMergeRuntimeSchema(backup, token);
          const backupInput = normalizeInputToSchema(backup, buildGenericInput(backup, input));
          if (!backupInput.proxyConfiguration) backupInput.proxyConfiguration = { useApifyProxy: true };
          console.log(`Trying backup actor ${backup.key} (${backup.actorId})`);
          const result = await startApifyRun(backup, backupInput, token);
          return { ...result, usedActor: backup };
        } catch (backupErr) {
          console.warn(`Backup ${backup.key} also failed: ${backupErr instanceof Error ? backupErr.message : String(backupErr)}`);
        }
      }
    }

    throw err;
  }
}

function isCapacityError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return lower.includes("memory-limit") || lower.includes("402") || lower.includes("capacity");
}

async function pollApifyRun(runId: string, token: string): Promise<string> {
  const resp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`, { method: "GET" });
  if (!resp.ok) return "FAILED";
  const data = await resp.json();
  return data.data?.status || "FAILED";
}

async function abortApifyRun(runId: string, token: string) {
  try {
    await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${token}`, { method: "POST" });
  } catch { /* ignore */ }
}

async function collectApifyResults(datasetId: string, token: string, maxItems?: number): Promise<any[]> {
  const allItems: any[] = [];
  const pageSize = 500;
  let offset = 0;
  const effectiveMax = maxItems || 10000;

  while (offset < effectiveMax) {
    const limit = Math.min(pageSize, effectiveMax - offset);
    const resp = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=${limit}&offset=${offset}`,
      { method: "GET" }
    );
    if (!resp.ok) break;
    const items = await resp.json();
    if (!items || items.length === 0) break;
    allItems.push(...items);
    if (items.length < limit) break;
    offset += items.length;
  }

  return allItems;
}

// ═══════════════════════════════════════════════════════════
// ██  QUALITY CHECK & RECONFIGURATION
// ═══════════════════════════════════════════════════════════

async function qualityCheckStage(
  run: any,
  stageNum: number,
  stageDef: any,
  pipeline: any[],
  serviceClient: any
): Promise<{ quality: string; reason: string; suggestedAction: string; reconfiguredPipeline?: any[] }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { quality: "MEDIUM", reason: "No API key for quality check", suggestedAction: "continue" };

  const { data: sampleLeads, count: totalCount } = await serviceClient
    .from("signal_leads")
    .select("*", { count: "exact" })
    .eq("run_id", run.id)
    .neq("pipeline_stage", "filtered_out")
    .limit(50);

  if (!sampleLeads || sampleLeads.length === 0) {
    return { quality: "USELESS", reason: "No leads found", suggestedAction: "abort" };
  }

  const sampleSize = Math.min(50, Math.max(15, Math.ceil((totalCount || sampleLeads.length) * 0.05)));
  const sampleData = sampleLeads.slice(0, sampleSize).map((l: any) => ({
    company_name: l.company_name, website: l.website, domain: l.domain,
    industry: l.industry, employee_count: l.employee_count,
    title: l.title, location: l.location,
    company_linkedin_url: l.company_linkedin_url,
    description: (l.extra_data?.description || l.extra_data?.descriptionHtml || "").slice(0, 300),
  }));

  const nextStageNeeds: string[] = [];
  for (let i = stageNum; i < pipeline.length; i++) {
    const ns = pipeline[i];
    if (ns.input_from) nextStageNeeds.push(ns.input_from);
    if (ns.updates_fields) nextStageNeeds.push(...ns.updates_fields);
  }

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
    for (const [k, v] of Object.entries(p || {})) {
      if (/industry|category|vertical|sector/i.test(k) && v) {
        stage1IndustryFilters.push(`${k}=${v}`);
      }
    }
  }
  const hasIndustryContext = stage1IndustryFilters.length > 0 ||
    stage1SearchQueries.some(q => {
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
      const reconfigured = await reconfigurePipeline(run, stageNum, pipeline, parsed, serviceClient);
      return {
        quality,
        reason,
        suggestedAction: reconfigured ? "reconfigure" : "continue",
        reconfiguredPipeline: reconfigured || undefined,
      };
    }

    if (datasetSize <= 500 && maxResultsPerSource <= 500) {
      const capReason = `${reason}. The max results per source is set to ${maxResultsPerSource}, which may be too low for this niche query. The search executed correctly but the dataset cap limited the results. Consider increasing max results per source to 1000+ for broader coverage.`;
      console.log(`Stage ${stageNum}: USELESS downgraded to LOW — small cap (${maxResultsPerSource}) likely insufficient for niche query`);
      return {
        quality: "LOW",
        reason: capReason,
        suggestedAction: "continue",
      };
    }

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

  const existingAdjustments = run.pipeline_adjustments || [];
  if (existingAdjustments.length >= 1) {
    console.log("Max reconfiguration limit reached, skipping");
    return null;
  }

  const completedStages = pipeline.slice(0, currentStage);
  const remainingStages = pipeline.slice(currentStage);

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
        const resolved = resolveActorForCategory(stage.stage_category);
        if (resolved) {
          stage.actors = [resolved.key];
          stage.params_per_actor = { [resolved.key]: stage.params || {} };
          planActorRegistry.set(resolved.key, resolved);
          console.log(`Reconfiguration: resolved ${stage.stage_category} → ${resolved.actorId} (key: ${resolved.key})`);
        } else {
          console.warn(`Reconfiguration: no actor in registry for category "${stage.stage_category}", stage may fail`);
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
            const resolved = resolveActorForCategory(mappedCategory);
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
      const resolved = resolveActorForCategory("people_data:linkedin");
      const actorKey = resolved?.key || "people_data_linkedin";
      if (resolved) planActorRegistry.set(actorKey, resolved);
      newStages.push({
        stage: lastStageNum + 1,
        name: "Identify Decision Makers",
        type: "scrape",
        stage_category: "people_data:linkedin",
        actors: resolved ? [actorKey] : [],
        params_per_actor: resolved ? { [actorKey]: {} } : {},
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
          // Increment retry_count in the same update to be container-kill-proof
          await serviceClient.from("signal_runs").update({
            status: "running",
            started_at: new Date().toISOString(),
            processing_phase: isPipeline ? "stage_1_starting" : "starting",
            retry_count: (run.retry_count || 0) + 1,
            updated_at: new Date().toISOString(),
          }).eq("id", run.id);

          if (isPipeline) {
            loadActorRegistry(plan);
          }
          processed++;
          continue;
        }

        // Running — route to correct phase
        if (isPipeline) {
          loadActorRegistry(plan);
          await processPipelinePhase(run, serviceClient);
        } else {
          loadActorRegistry(plan);
          await processLegacyPhase(run, serviceClient);
        }
        processed++;
      } catch (err) {
        failed++;
        console.error(`Error processing signal ${run.id}:`, err);
        const errMsg = err instanceof Error ? err.message : String(err);

        if ((run.retry_count || 0) >= MAX_RETRIES) {
          await serviceClient.from("signal_runs").update({
            status: "failed",
            error_message: `Failed after ${MAX_RETRIES} retries: ${errMsg.slice(0, 500)}`,
          }).eq("id", run.id);

          if (run.user_id) {
            await serviceClient.from("notifications").insert({
              user_id: run.user_id,
              workspace_id: run.workspace_id,
              type: "signal_failed",
              title: "Signal Failed",
              message: `Your signal "${run.signal_name || run.signal_query}" failed: ${errMsg.slice(0, 200)}`,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ message: `Processed ${processed} signals (${failed} failed)`, processed, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Signal queue error:", err);
    const errMsg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ═══════════════════════════════════════════════════════════
// ██  PIPELINE PHASE ROUTER
// ═══════════════════════════════════════════════════════════

async function processPipelinePhase(run: any, serviceClient: any) {
  const phase = run.processing_phase || "stage_1_starting";
  const plan = run.signal_plan;
  const pipeline = plan.pipeline || [];

  const phaseMatch = phase.match(/stage_(\d+)_(\w+)/);
  if (!phaseMatch) {
    console.error(`Unknown pipeline phase: ${phase}`);
    return;
  }

  const stageNum = parseInt(phaseMatch[1], 10);
  const subPhase = phaseMatch[2];

  const stageDef = pipeline.find((s: any) => s.stage === stageNum);
  if (!stageDef) {
    console.error(`Stage ${stageNum} not found in pipeline`);
    await serviceClient.from("signal_runs").update({
      status: "failed", error_message: `Stage ${stageNum} not found in pipeline definition`,
    }).eq("id", run.id);
    return;
  }

  console.log(`Pipeline ${run.id}: stage=${stageNum} phase=${subPhase} type=${stageDef.type}`);

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
        await pipelineValidating(run, stageDef, stageNum, pipeline, serviceClient);
        break;
    }
  } else if (stageDef.type === "ai_filter") {
    switch (subPhase) {
      case "starting":
      case "filtering":
        await pipelineAiFilter(run, stageDef, stageNum, pipeline, serviceClient);
        break;
      case "validating":
        await pipelineValidating(run, stageDef, stageNum, pipeline, serviceClient);
        break;
    }
  }
}

// ── Pipeline: Advance to next stage ──

async function advancePipelineStage(run: any, currentStage: number, pipeline: any[], serviceClient: any) {
  const nextStageDef = pipeline.find((s: any) => s.stage === currentStage + 1);
  if (!nextStageDef) {
    await pipelineFinalize(run, pipeline, serviceClient);
    return;
  }

  const nextPhase = nextStageDef.type === "ai_filter"
    ? `stage_${currentStage + 1}_starting`
    : `stage_${currentStage + 1}_starting`;

  await serviceClient.from("signal_runs").update({
    processing_phase: nextPhase,
    current_pipeline_stage: currentStage,
    collected_dataset_index: 0,
    updated_at: new Date().toISOString(),
  }).eq("id", run.id);

  console.log(`Pipeline ${run.id}: Advanced to stage ${currentStage + 1} (${nextStageDef.type})`);
}

// ── Pipeline: Validation ──

async function pipelineValidating(run: any, stageDef: any, stageNum: number, pipeline: any[], serviceClient: any) {
  let qualityResult: { quality: string; reason: string; suggestedAction: string; reconfiguredPipeline?: any[] };
  try {
    qualityResult = await qualityCheckStage(run, stageNum, stageDef, pipeline, serviceClient);
  } catch (err) {
    console.warn(`Stage ${stageNum} quality check threw error, defaulting to MEDIUM:`, err);
    qualityResult = { quality: "MEDIUM", reason: "Quality check threw an error, proceeding cautiously", suggestedAction: "continue" };
  }
  console.log(`Stage ${stageNum} quality: ${qualityResult.quality} — ${qualityResult.reason}`);

  const adjustments = [...(run.pipeline_adjustments || []), {
    type: "quality_check",
    stage: stageNum,
    quality: qualityResult.quality,
    reason: qualityResult.reason,
    timestamp: new Date().toISOString(),
  }];

  if (qualityResult.quality === "USELESS" && qualityResult.suggestedAction === "abort") {
    const userMessage = qualityResult.reason || `Stage ${stageNum} produced data that doesn't match your search criteria.`;
    await serviceClient.from("signal_runs").update({
      status: "failed",
      error_message: userMessage,
      processing_phase: "aborted",
      pipeline_adjustments: adjustments,
    }).eq("id", run.id);

    if (run.user_id) {
      await serviceClient.from("notifications").insert({
        user_id: run.user_id, workspace_id: run.workspace_id,
        type: "signal_failed", title: "Signal — Quality Too Low",
        message: userMessage,
      });
    }
    return;
  }

  // Check for field gaps that need warning
  if (stageNum === 1) {
    const { data: leadsForGap } = await serviceClient
      .from("signal_leads").select("company_name, website, company_linkedin_url, industry, employee_count")
      .eq("run_id", run.id).limit(50);
    
    if (leadsForGap && leadsForGap.length >= 5) {
      const gapFields = ["company_name", "website", "company_linkedin_url", "industry", "employee_count"];
      const fieldGaps: string[] = [];
      for (const field of gapFields) {
        const populated = leadsForGap.filter((l: any) => l[field] && l[field] !== "").length;
        const coverage = Math.round((populated / leadsForGap.length) * 100);
        if (coverage < 30) fieldGaps.push(`${field} (${coverage}%)`);
      }
      if (fieldGaps.length > 0) {
        adjustments.push({ type: "field_gap_warning", stage: stageNum, field_gaps: fieldGaps, timestamp: new Date().toISOString() });
      }
    }
  }

  if (qualityResult.reconfiguredPipeline) {
    const newPipeline = [
      ...pipeline.slice(0, stageNum),
      ...qualityResult.reconfiguredPipeline,
    ];
    const updatedPlan = { ...run.signal_plan, pipeline: newPipeline };

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

    await fetchAndMergeRuntimeSchema(actor, APIFY_API_TOKEN);

    if (stageNum === 1) {
      const actorParams = stageDef.params_per_actor?.[actorKey] || {};
      const intent = parseSearchIntent(stageDef);
      const platform = detectPlatform(actor);
      
      intent.location = actorParams.location || actorParams.searchLocation || intent.location;
      
      const platformQuery = buildPlatformSearchQuery(platform, intent, actorParams);
      const input = { ...platformQuery.params };
      
      if (platform === "linkedin" && platformQuery.url) {
        delete input.splitCountry;
      }

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

      const actorInput = normalizeInputToSchema(actor, buildGenericInput(actor, input));
      if (!actorInput.proxyConfiguration) actorInput.proxyConfiguration = { useApifyProxy: true };
      
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
      const { data: existingLeads } = await serviceClient
        .from("signal_leads").select("id, company_name, company_linkedin_url").eq("run_id", run.id).limit(10000);

      if (!existingLeads || existingLeads.length === 0) {
        console.log(`Stage ${stageNum}: No leads for LinkedIn URL discovery`);
        break;
      }

      const leadsNeedingLinkedIn = existingLeads.filter((l: any) => !l.company_linkedin_url && l.company_name);

      if (leadsNeedingLinkedIn.length === 0) {
        console.log(`Stage ${stageNum}: All leads already have LinkedIn URLs, skipping discovery`);
        break;
      }

      const BATCH_SIZE = 20;
      for (let i = 0; i < leadsNeedingLinkedIn.length; i += BATCH_SIZE) {
        const batch = leadsNeedingLinkedIn.slice(i, i + BATCH_SIZE);
        const queries = batch.map((l: any) => `"${l.company_name}" site:linkedin.com/company`);
        const actorParams = stageDef.params_per_actor?.[actorKey] || {};
        const input: Record<string, any> = { ...actorParams, queries };

        const actorInput = normalizeInputToSchema(actor, buildGenericInput(actor, input));
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
      const inputField = stageDef.input_from;
      if (!inputField) continue;

      const { data: existingLeads } = await serviceClient
        .from("signal_leads").select("*").eq("run_id", run.id).limit(10000);

      if (!existingLeads || existingLeads.length === 0) {
        console.log(`Stage ${stageNum}: No leads to enrich, skipping`);
        break;
      }

      let inputValues: string[] = [];
      let peopleSearchMode: "structured" | "url" = "url";
      if ((actor.category === "people_data" || actor.actorId.includes("linkedin") && actor.label.toLowerCase().includes("people")) && stageDef.search_titles) {
        const titles = stageDef.search_titles;
        const titlesStr = titles.join(" OR ");
        
        const hasSchema = Object.keys(actor.inputSchema).length > 0;
        const schemaKeys = Object.keys(actor.inputSchema);
        const hasCompanyField = hasSchema && schemaKeys.some((k: string) => /company|organization|employer/i.test(k));
        const hasTitleField = hasSchema && schemaKeys.some((k: string) => /title|position|role|headline/i.test(k));
        const hasNameField = hasSchema && schemaKeys.some((k: string) => /name|keyword|search|query/i.test(k));
        const hasUrlField = hasSchema && (!!actor.inputSchema["startUrls"] || !!actor.inputSchema["urls"] || !!actor.inputSchema["profileUrls"]);
        
        const useStructured = hasCompanyField || hasTitleField || (hasNameField && !hasUrlField);
        
        if (useStructured) {
          peopleSearchMode = "structured";
          console.log(`Stage ${stageNum}: People search using STRUCTURED params for ${actorKey}`);
          
          for (const lead of existingLeads) {
            const companyName = lead.company_name || "";
            const companyLinkedinUrl = lead.company_linkedin_url || lead.linkedin || "";
            if (!companyName && !companyLinkedinUrl) continue;
            
            inputValues.push(JSON.stringify({
              company: companyName,
              companyLinkedinUrl,
              titles: titlesStr,
              leadId: lead.id,
            }));
          }
        } else {
          peopleSearchMode = "url";
          console.log(`Stage ${stageNum}: People search using URL mode for ${actorKey}`);
          
          for (const lead of existingLeads) {
            const companyName = lead.company_name || "";
            if (!companyName) continue;
            
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

        if (actor.category === "people_data" && peopleSearchMode === "structured") {
          const parsedEntries = batch.map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean);
          
          const companyField = schemaKeys.find((k: string) => /^company$|^organization$|^employer$/i.test(k)) 
            || schemaKeys.find((k: string) => /company|organization|employer/i.test(k));
          const titleField = schemaKeys.find((k: string) => /^title$|^position$|^role$/i.test(k))
            || schemaKeys.find((k: string) => /title|position|role|headline/i.test(k));
          const searchField = schemaKeys.find((k: string) => /^search$|^query$|^keyword$|^keywords$/i.test(k))
            || schemaKeys.find((k: string) => /search|query|keyword/i.test(k));
          
          if (companyField || titleField) {
            const queries = parsedEntries.map((e: any) => `${e.titles} ${e.company}`);
            if (companyField && titleField) {
              input[companyField] = parsedEntries.map((e: any) => e.company);
              input[titleField] = parsedEntries[0]?.titles || "";
            } else if (searchField) {
              input[searchField] = queries.join("\n");
            }
            if (actor.inputSchema["startUrls"]) {
              input.startUrls = parsedEntries.map((e: any) => ({
                url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(e.titles)}%20${encodeURIComponent(e.company)}`
              }));
            }
          } else if (searchField) {
            input[searchField] = parsedEntries.map((e: any) => `${e.titles} ${e.company}`);
          } else {
            input.startUrls = parsedEntries.map((e: any) => ({
              url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(e.titles)}%20${encodeURIComponent(e.company)}`
            }));
            input.urls = parsedEntries.map((e: any) => 
              `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(e.titles)}%20${encodeURIComponent(e.company)}`
            );
          }
          console.log(`Stage ${stageNum}: Built structured people input — companyField: ${companyField}, titleField: ${titleField}, searchField: ${searchField}`);
        }
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
            input.startUrls = batch.map(url => ({ url }));
            input.urls = batch;
          }
        } else {
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

        const actorInput = normalizeInputToSchema(actor, buildGenericInput(actor, input));
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

  const hasSuccessfulStart = refs.some(r => r.status === "RUNNING");
  if (!hasSuccessfulStart && refs.length > 0) {
    console.log(`Stage ${stageNum}: All actor runs failed to start`);
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
    if (stageDef.dedup_after) {
      await dedupLeads(run, serviceClient);
    }

    // LOW-YIELD / ZERO-RESULT RECOVERY for Stage 1
    if (!stageDef.input_from) {
      const { count: leadCount } = await serviceClient
        .from("signal_leads").select("*", { count: "exact", head: true })
        .eq("run_id", run.id);

      // FIX: Extend threshold from 0 to <10 for Stage 1 to trigger earlier recovery
      if (!leadCount || leadCount < 10) {
        const stageActorRuns = (run.apify_run_ids || []).filter((r: any) => (r.pipelineStage || 1) === stageNum);
        const adjustments = run.pipeline_adjustments || [];
        const alreadyTriedDiagnostic = adjustments.some((a: any) => a.type === "diagnostic_retry" && a.stage === stageNum);
        const alreadyTriedBackup = adjustments.some((a: any) => a.type === "zero_result_backup_attempt" && a.stage === stageNum);

        if (leadCount === 0) {
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
              console.log(`Stage ${stageNum}: Auto-retrying with corrected intent`);
              const primaryActorKey = (stageDef.actors || [])[0];
              const actor = getActor(primaryActorKey);
              
              if (actor) {
                const platform = detectPlatform(actor);
                const actorParams = stageDef.params_per_actor?.[primaryActorKey] || {};
                const correctedQuery = buildPlatformSearchQuery(platform, diagnostic.correctedIntent, actorParams);
                const correctedInput = normalizeInputToSchema(actor, buildGenericInput(actor, correctedQuery.params));
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
                  return;
                } catch (err) {
                  console.warn(`Stage ${stageNum}: Diagnostic retry failed to start:`, err);
                }
              }
            }
          }
        }

        // Step 2: Try backup actors (for both 0 and <10 results)
        if (!alreadyTriedBackup) {
          const usedActorKeys = new Set(stageActorRuns.map((r: any) => r.actorKey));
          const primaryActors = (stageDef.actors || []).map((k: string) => getActor(k)).filter(Boolean);
          const allBackups: ActorEntry[] = [];
          for (const primary of primaryActors) {
            if (!primary) continue;
            allBackups.push(...findBackupActors(primary).filter(b => !usedActorKeys.has(b.key)));
          }

          if (allBackups.length > 0) {
            console.log(`Stage ${stageNum}: Low yield (${leadCount || 0} leads) — trying ${allBackups.length} backup actors`);
            const backupRefs: ApifyRunRef[] = [];
            
            for (const backup of allBackups.slice(0, 2)) {
              const intent = parseSearchIntent(stageDef);
              const platform = detectPlatform(backup);
              const actorParams = stageDef.params_per_actor?.[(stageDef.actors || [])[0]] || {};
              const platformQuery = buildPlatformSearchQuery(platform, intent, actorParams);
              const backupInput = normalizeInputToSchema(backup, buildGenericInput(backup, platformQuery.params));
              if (!backupInput.proxyConfiguration) backupInput.proxyConfiguration = { useApifyProxy: true };
              
              try {
                const result = await startApifyRun(backup, backupInput, APIFY_API_TOKEN);
                backupRefs.push({ actorKey: backup.key, keyword: "backup_retry", runId: result.runId, datasetId: result.datasetId, status: "RUNNING", startedAt: new Date().toISOString(), pipelineStage: stageNum });
              } catch (err) {
                console.warn(`Stage ${stageNum}: Backup ${backup.key} failed:`, err);
              }
            }

            if (backupRefs.length > 0) {
              adjustments.push({ type: "zero_result_backup_attempt", stage: stageNum, backup_actors: backupRefs.map(r => r.actorKey), lead_count: leadCount || 0, timestamp: new Date().toISOString() });
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

        // Step 3: If truly 0 results after all recovery — fail
        if (!leadCount || leadCount === 0) {
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
        // If <10 but >0, log and continue (recovery attempts have been made)
        console.log(`Stage ${stageNum}: Low yield (${leadCount} leads) — proceeding after recovery attempts`);
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
      const { data: allRunLeads } = await serviceClient
        .from("signal_leads").select("id, company_name, company_linkedin_url").eq("run_id", run.id).limit(10000);
      const runLeads = allRunLeads || [];

      for (const item of normalised) {
        const url = item.website || item._raw?.url || item._raw?.link || "";
        if (!url.includes("linkedin.com/company")) continue;

        const resultTitle = (item.company_name || item._raw?.title || "").toLowerCase();
        
        for (const lead of runLeads) {
          if (lead.company_linkedin_url) continue;
          const leadName = (lead.company_name || "").toLowerCase();
          if (!leadName) continue;

          if (resultTitle.includes(leadName) || leadName.includes(resultTitle.split(" - ")[0].split(" |")[0].trim())) {
            await serviceClient.from("signal_leads").update({
              company_linkedin_url: url,
              pipeline_stage: `stage_${stageNum}`,
            }).eq("id", lead.id);
            lead.company_linkedin_url = url;
            break;
          }
        }
      }
      console.log(`Stage ${stageNum}: LinkedIn URL discovery completed from dataset ${collectedIndex + 1}`);
    } else if (actor.category === "people_data") {
      const { data: allRunLeads } = await serviceClient
        .from("signal_leads").select("id, company_name, domain, company_linkedin_url, website").eq("run_id", run.id).limit(10000);
      const runLeads = allRunLeads || [];
      
      const MIN_MATCH_SCORE = 70;
      let matchedCount = 0;
      let totalPersonItems = 0;
      const assignedLeadIds = new Set<string>();

      for (const item of normalised) {
        const personCompany = (item.company_name || "").trim().toLowerCase();
        if (!personCompany) continue;
        totalPersonItems++;

        const personLinkedIn = item._raw?.currentCompanyLinkedinUrl || item._raw?.companyLinkedinUrl || "";
        const personDomain = extractDomain(item._raw?.companyUrl || item._raw?.website || "");
        
        let bestMatch: { id: string; score: number } | null = null;
        
        for (const lead of runLeads) {
          if (assignedLeadIds.has(lead.id)) continue;
          let score = 0;
          
          if (personDomain && lead.domain && personDomain === lead.domain) {
            score = 100;
          }
          
          if (score < 90 && personLinkedIn && lead.company_linkedin_url) {
            const normPerson = personLinkedIn.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\/(www\.)?/, "");
            const normLead = lead.company_linkedin_url.toLowerCase().replace(/\/$/, "").replace(/^https?:\/\/(www\.)?/, "");
            if (normPerson === normLead) score = Math.max(score, 90);
          }
          
          const leadName = (lead.company_name || "").trim().toLowerCase();
          if (leadName && leadName === personCompany) {
            score = Math.max(score, 80);
          }
          
          if (score < 50 && leadName && leadName.length >= 4 && personCompany.length >= 4) {
            if (leadName.includes(personCompany) || personCompany.includes(leadName)) {
              const shorter = Math.min(leadName.length, personCompany.length);
              const longer = Math.max(leadName.length, personCompany.length);
              const ratio = shorter / longer;
              if (ratio >= 0.4) {
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
      
      if (matchRate < 30 && totalPersonItems > 5) {
        console.warn(`Stage ${stageNum}: LOW MATCH RATE (${matchRate}%) — triggering Apollo enrichment fallback`);
        
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

        if (domain) {
          await serviceClient.from("signal_leads").update(updateData)
            .eq("run_id", run.id).eq("domain", domain);
        } 
        else if (itemCompanyName) {
          const matchingLeads = enrichLeads.filter((l: any) => {
            const leadName = (l.company_name || "").trim().toLowerCase();
            return leadName === itemCompanyName;
          });
          for (const lead of matchingLeads) {
            await serviceClient.from("signal_leads").update(updateData).eq("id", lead.id);
          }
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

  // FIX: Min-dataset guard — skip AI classification on tiny datasets
  if (leads.length < 5) {
    console.log(`Stage ${stageNum} AI filter: SKIPPED — only ${leads.length} leads (min 5 required for reliable classification)`);
    await serviceClient.from("signal_runs").update({
      processing_phase: `stage_${stageNum}_validating`,
      updated_at: new Date().toISOString(),
      pipeline_adjustments: [...(run.pipeline_adjustments || []), {
        type: "ai_filter_skipped",
        stage: stageNum,
        reason: `Only ${leads.length} leads — too few for reliable AI classification`,
        timestamp: new Date().toISOString(),
      }],
    }).eq("id", run.id);
    return;
  }

  // Debug logging: show sample lead objects being sent to classifier
  const sampleForLog = leads.slice(0, 3).map((b: any) => ({
    company_name: b.company_name || "", domain: b.domain || "",
    industry: b.industry || "", title: b.title || "",
    employee_count: b.employee_count || "",
  }));
  console.log(`Stage ${stageNum} AI filter: Processing ${leads.length} leads with prompt: "${stageDef.prompt?.slice(0, 80)}..."`);
  console.log(`Stage ${stageNum} AI filter: Sample leads being classified:`, JSON.stringify(sampleForLog));

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
                obj.domain = b.domain || "";
                obj.employee_count = b.employee_count || "";
                const desc = b.extra_data?.description || b.extra_data?.descriptionHtml || "";
                obj.description = typeof desc === "string" ? desc.slice(0, 300) : "";
                return obj;
              })),
            },
          ],
        }),
      });

      if (classifyResponse.ok) {
        const result = await classifyResponse.json();
        const content = result.choices?.[0]?.message?.content || "[]";
        const booleans = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
        batch.forEach((item: any, idx: number) => {
          if (Array.isArray(booleans) && booleans[idx] === false) {
            failedIds.push(item.id);
          }
        });
      }
    } catch (err) {
      console.warn(`Stage ${stageNum}: AI filter batch error:`, err);
    }
  }

  if (failedIds.length > 0) {
    const rejectionRate = failedIds.length / leads.length;
    console.log(`Stage ${stageNum} AI filter: ${failedIds.length}/${leads.length} leads rejected (${Math.round(rejectionRate * 100)}%)`);

    // Circuit breaker: if >85% rejected, it's likely a prompt mismatch — soft-delete instead of hard-delete
    if (rejectionRate > 0.85) {
      console.warn(`Stage ${stageNum} AI filter: CIRCUIT BREAKER TRIGGERED — ${Math.round(rejectionRate * 100)}% rejection rate exceeds 85% threshold. Soft-deleting instead of hard-deleting to preserve data.`);
      
      // Soft-delete: mark as filtered_out instead of deleting
      for (let i = 0; i < failedIds.length; i += 200) {
        await serviceClient.from("signal_leads").update({ pipeline_stage: "filtered_out" }).in("id", failedIds.slice(i, i + 200));
      }

      // Record the circuit breaker event
      const adjustments = [...(run.pipeline_adjustments || []), {
        type: "ai_filter_circuit_breaker",
        stage: stageNum,
        rejection_rate: Math.round(rejectionRate * 100),
        rejected_count: failedIds.length,
        total_count: leads.length,
        reason: `AI filter rejected ${Math.round(rejectionRate * 100)}% of leads — likely prompt/data mismatch. Leads soft-deleted (pipeline_stage='filtered_out') instead of permanently removed.`,
        timestamp: new Date().toISOString(),
      }];
      await serviceClient.from("signal_runs").update({ pipeline_adjustments: adjustments }).eq("id", run.id);
    } else {
      // Normal case: hard-delete rejected leads
      for (let i = 0; i < failedIds.length; i += 200) {
        await serviceClient.from("signal_leads").delete().in("id", failedIds.slice(i, i + 200));
      }
    }
  }

  await serviceClient.from("signal_runs").update({
    processing_phase: `stage_${stageNum}_validating`,
    updated_at: new Date().toISOString(),
  }).eq("id", run.id);
}

// ── Dedup Leads ──

async function dedupLeads(run: any, serviceClient: any) {
  const JOB_BOARD_DOMAINS = new Set(["indeed.com", "linkedin.com", "yelp.com", "yellowpages.com", "google.com"]);
  const { data: allLeads } = await serviceClient
    .from("signal_leads").select("*").eq("run_id", run.id).limit(10000);
  if (!allLeads || allLeads.length === 0) return;

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
    console.log(`Dedup: Removed ${removeIds.length} duplicates`);
  }
}

// ── Pipeline: Finalize ──

async function pipelineFinalize(run: any, pipeline: any[], serviceClient: any) {
  const { data: allLeads } = await serviceClient
    .from("signal_leads").select("*").eq("run_id", run.id).limit(10000);
  const leads = allLeads || [];

  // Cross-run dedup
  const JOB_BOARD_DOMAINS = new Set(["indeed.com", "linkedin.com", "yelp.com", "yellowpages.com", "google.com"]);
  const { data: existingKeys } = await serviceClient
    .from("signal_dedup_keys").select("dedup_key, dedup_type").eq("workspace_id", run.workspace_id);
  const existingSet = new Set((existingKeys || []).map((k: any) => `${k.dedup_type}:${k.dedup_key}`));

  const uniqueLeads: any[] = [];
  const duplicateIds: string[] = [];
  const newDedupKeys: any[] = [];

  for (const item of leads) {
    const domain = extractDomain(item.website || "");
    const effectiveDomain = (domain && !JOB_BOARD_DOMAINS.has(domain)) ? domain : "";
    let isDuplicate = false;
    if (effectiveDomain && existingSet.has(`domain:${effectiveDomain}`)) isDuplicate = true;
    if (!isDuplicate) {
      uniqueLeads.push(item);
      if (effectiveDomain) {
        existingSet.add(`domain:${effectiveDomain}`);
        newDedupKeys.push({ workspace_id: run.workspace_id, dedup_key: effectiveDomain, dedup_type: "domain", signal_lead_id: item.id });
      }
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

  // Cost calculation
  let actualCredits = 0;
  if (leadsCount > 0) {
    let totalActualScrapedRows = 0;
    let totalAiFilteredRows = 0;
    const allRefs: ApifyRunRef[] = run.apify_run_ids || [];
    for (const ref of allRefs) {
      if (ref.status === "SUCCEEDED" && ref.datasetId) {
        totalActualScrapedRows += 500;
      }
    }
    for (const stage of pipeline) {
      if (stage.type === "ai_filter") {
        totalAiFilteredRows += leadsCount * 2;
      }
    }
    
    const planScrapedRows = pipeline
      .filter((s: any) => s.type === "scrape")
      .reduce((sum: number, s: any) => sum + (s.expected_output_count || 0), 0);
    
    const effectiveScrapedRows = Math.max(
      totalActualScrapedRows,
      planScrapedRows > 0 ? planScrapedRows : leadsCount * 3
    );

    const scrapeCostUsd = (effectiveScrapedRows / 1000) * 1.0;
    const aiCostUsd = totalAiFilteredRows * 0.001;
    const totalUsd = (scrapeCostUsd + aiCostUsd) * 1.5;
    actualCredits = Math.max(5, Math.ceil(totalUsd * 5));
  }

  const upfrontCredits = run.estimated_cost || 0;
  if (actualCredits > 0) {
    const { data: creditsData } = await serviceClient
      .from("lead_credits").select("credits_balance").eq("workspace_id", run.workspace_id).maybeSingle();
    const balance = creditsData?.credits_balance || 0;
    
    if (upfrontCredits > 0) {
      const delta = actualCredits - upfrontCredits;
      if (delta !== 0) {
        await serviceClient.from("lead_credits").update({ credits_balance: balance - delta }).eq("workspace_id", run.workspace_id);
        console.log(`Credit reconciliation: upfront=${upfrontCredits}, actual=${actualCredits}, delta=${delta}`);
      }
    } else {
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

      const actorInput = normalizeInputToSchema(actor, buildGenericInput(actor, iterPlan.search_params));
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
