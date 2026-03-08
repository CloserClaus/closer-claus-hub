import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ════════════════════════════════════════════════════════════════
// ██  INTERFACES & DYNAMIC ACTOR REGISTRY
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
  monthlyUsers?: number;
  totalRuns?: number;
  rating?: number;
}

// ════════════════════════════════════════════════════════════════
// ██  VERIFIED ACTOR CATALOG — Hardcoded schemas for reliability
// ════════════════════════════════════════════════════════════════

interface VerifiedActor {
  actorId: string;
  category: string;
  subCategory: string;
  label: string;
  inputSchema: Record<string, InputField>;
  outputFields: Record<string, string[]>;
}

const VERIFIED_ACTORS: Record<string, VerifiedActor> = {
  "local_business:google_maps": {
    actorId: "compass/crawler-google-places",
    category: "local_business",
    subCategory: "local_business:google_maps",
    label: "Google Maps Places Scraper",
    inputSchema: {
      searchStringsArray: { type: "string[]", required: true, description: "Search queries (e.g. 'plumbers Austin TX')" },
      maxCrawledPlacesPerSearch: { type: "number", required: false, default: 100, description: "Max results per search query" },
      language: { type: "string", required: false, default: "en", description: "Language code" },
      countryCode: { type: "string", required: false, description: "Country code (e.g. 'us')" },
    },
    outputFields: {
      company_name: ["title"],
      website: ["website"],
      phone: ["phone"],
      email: ["email", "emails"],
      location: ["address", "fullAddress"],
      city: ["city"],
      state: ["state"],
      country: ["country", "countryCode"],
      industry: ["category", "categories", "categoryName"],
      description: ["description"],
      linkedin: [],
    },
  },
  "local_business:yelp": {
    actorId: "yin/yelp-scraper",
    category: "local_business",
    subCategory: "local_business:yelp",
    label: "Yelp Business Scraper",
    inputSchema: {
      searchTerms: { type: "string[]", required: true, description: "Search terms" },
      location: { type: "string", required: false, description: "Location (e.g. 'Austin, TX')" },
      maxItems: { type: "number", required: false, default: 100, description: "Max results" },
    },
    outputFields: {
      company_name: ["name", "businessName"],
      website: ["website"],
      phone: ["phone", "displayPhone"],
      location: ["address"],
      city: ["city"],
      state: ["state"],
      country: ["country"],
      industry: ["categories"],
      description: ["snippet"],
      email: [],
      linkedin: [],
    },
  },
  "hiring_intent:indeed": {
    actorId: "misceres/indeed-scraper",
    category: "hiring_intent",
    subCategory: "hiring_intent:indeed",
    label: "Indeed Job Scraper",
    inputSchema: {
      position: { type: "string", required: false, description: "Job title/position to search" },
      location: { type: "string", required: false, description: "Location (e.g. 'Austin, TX')" },
      country: { type: "string", required: false, default: "US", description: "Country code" },
      maxItems: { type: "number", required: false, default: 100, description: "Max results" },
    },
    outputFields: {
      company_name: ["company", "companyName"],
      title: ["positionName", "title"],
      location: ["jobLocation", "location"],
      industry: [],
      salary: ["salary"],
      website: ["companyUrl", "url"],
      description: ["description"],
      linkedin: [],
      employee_count: [],
    },
  },
  "hiring_intent:linkedin": {
    actorId: "hMvNSpz3JnHgl5jkh",
    category: "hiring_intent",
    subCategory: "hiring_intent:linkedin",
    label: "LinkedIn Jobs Scraper",
    inputSchema: {
      urls: { type: "string[]", required: false, description: "LinkedIn job search URLs" },
      startUrls: { type: "string[]", required: false, description: "Start URLs for crawling" },
      maxItems: { type: "number", required: false, default: 100, description: "Max results" },
    },
    outputFields: {
      company_name: ["companyName", "company"],
      title: ["title", "jobTitle"],
      location: ["location", "jobLocation"],
      linkedin: ["companyLinkedinUrl"],
      website: ["companyUrl"],
      description: ["description"],
      industry: ["companyIndustry"],
      employee_count: ["companyEmployeesCount"],
    },
  },
  "hiring_intent:glassdoor": {
    actorId: "bebity/glassdoor-scraper",
    category: "hiring_intent",
    subCategory: "hiring_intent:glassdoor",
    label: "Glassdoor Job Scraper",
    inputSchema: {
      keyword: { type: "string", required: false, description: "Job keyword" },
      location: { type: "string", required: false, description: "Location" },
      maxItems: { type: "number", required: false, default: 100, description: "Max results" },
    },
    outputFields: {
      company_name: ["employer.name", "companyName"],
      title: ["jobTitle", "title"],
      location: ["location"],
      industry: ["employer.industry"],
      salary: ["salary", "salaryInfo"],
      website: ["employer.corporateWebsite"],
      description: ["description"],
      linkedin: [],
      employee_count: ["employer.employeesCount"],
    },
  },
  "people_data:linkedin": {
    actorId: "2SyF0bVxmgQr8SsLY",
    category: "people_data",
    subCategory: "people_data:linkedin",
    label: "LinkedIn People Search",
    inputSchema: {
      searchUrl: { type: "string", required: false, description: "LinkedIn people search URL" },
      urls: { type: "string[]", required: false, description: "Search URLs" },
      startUrls: { type: "string[]", required: false, description: "Start URLs" },
      maxItems: { type: "number", required: false, default: 50, description: "Max results" },
    },
    outputFields: {
      contact_name: ["fullName", "name", "firstName"],
      title: ["headline", "title"],
      linkedin_profile: ["profileUrl", "url", "linkedinUrl"],
      company_name: ["companyName", "currentCompany"],
      location: ["location", "geoLocation"],
      city: ["city"],
      country: ["country"],
    },
  },
  "company_data:linkedin": {
    actorId: "voyager/linkedin-company-scraper",
    category: "company_data",
    subCategory: "company_data:linkedin",
    label: "LinkedIn Company Scraper",
    inputSchema: {
      urls: { type: "string[]", required: false, description: "LinkedIn company page URLs" },
      startUrls: { type: "string[]", required: false, description: "Start URLs" },
      maxItems: { type: "number", required: false, default: 50, description: "Max results" },
    },
    outputFields: {
      company_name: ["name", "companyName"],
      industry: ["industry", "industries"],
      employee_count: ["employeeCount", "staffCount", "employeesOnLinkedIn"],
      website: ["website", "websiteUrl"],
      linkedin: ["url", "linkedinUrl"],
      location: ["headquarters", "location"],
      city: ["headquartersCity", "city"],
      country: ["headquartersCountry", "country"],
      description: ["description", "tagline"],
    },
  },
  "web_search:google": {
    actorId: "apify/google-search-scraper",
    category: "web_search",
    subCategory: "web_search:google",
    label: "Google Search Scraper",
    inputSchema: {
      queries: { type: "string", required: true, description: "Search query string" },
      maxPagesPerQuery: { type: "number", required: false, default: 1, description: "Pages of results per query" },
      resultsPerPage: { type: "number", required: false, default: 10, description: "Results per page" },
      countryCode: { type: "string", required: false, description: "Country code" },
      languageCode: { type: "string", required: false, description: "Language code" },
    },
    outputFields: {
      company_name: ["title"],
      website: ["url", "link"],
      description: ["description", "snippet"],
      linkedin: [],
    },
  },
  "enrichment:contact": {
    actorId: "alexey/contact-info-scraper",
    category: "enrichment",
    subCategory: "enrichment:contact",
    label: "Website Contact Info Scraper",
    inputSchema: {
      startUrls: { type: "string[]", required: true, description: "Website URLs to scrape contacts from" },
      maxRequestsPerStartUrl: { type: "number", required: false, default: 5, description: "Max pages per site" },
    },
    outputFields: {
      email: ["emails", "email"],
      phone: ["phones", "phone", "phoneNumbers"],
      linkedin: ["linkedIn", "linkedin"],
      website: ["url"],
      company_name: ["name"],
    },
  },
};

// Helper to get a verified actor entry as an ActorEntry
function verifiedToActorEntry(catKey: string, v: VerifiedActor): ActorEntry {
  return {
    key: v.actorId.replace(/[^a-zA-Z0-9]/g, "_"),
    actorId: v.actorId,
    label: v.label,
    category: v.category,
    description: v.label,
    inputSchema: v.inputSchema,
    outputFields: v.outputFields,
    monthlyUsers: 10000, // High default to prefer verified actors
    totalRuns: 100000,
    rating: 5,
    _verified: true,
    subCategory: v.subCategory,
  } as any;
}

// Runtime map — populated fresh from Apify Store on every plan generation
let discoveredActorMap: Map<string, ActorEntry> = new Map();
function getActor(key: string): ActorEntry | undefined { return discoveredActorMap.get(key); }

// ════════════════════════════════════════════════════════════════
// ██  BUILD PIPELINE PLANNER PROMPT — Category-based (Logic → Flow → Category)
// ════════════════════════════════════════════════════════════════

function buildPipelinePlannerPrompt(): string {
  // Build category descriptions from VERIFIED_ACTORS
  const categoryDescriptions = Object.entries(VERIFIED_ACTORS).map(([catKey, actor]) => {
    const params = Object.entries(actor.inputSchema)
      .map(([name, s]) => {
        let desc = `     ${name} (${s.type}${s.required ? ", REQUIRED" : ""})`;
        if (s.default !== undefined) desc += ` [default: ${JSON.stringify(s.default)}]`;
        desc += ` — ${s.description}`;
        return desc;
      })
      .join("\n");
    const outputs = Object.entries(actor.outputFields)
      .map(([key, paths]) => paths.length === 0 ? `${key}: ✗` : `${key}: ✓`)
      .join(", ");
    return `- ${catKey} (${actor.label})\n   Input params:\n${params}\n   Outputs: ${outputs}`;
  }).join("\n\n");

  return `You are a lead generation pipeline architect. You design COST-EFFECTIVE multi-stage scraping and filtering pipelines.

## YOUR REASONING PROCESS (Follow this order strictly)

### Step 1: LOGIC — What's the cheapest path to the goal?
Before designing stages, think about the most efficient approach:
- What is the NARROWEST starting point? (e.g., for "agencies hiring sales reps" → start with job boards, NOT a broad list of all agencies)
- What data do you need at the end? (company name, contact info, decision maker)
- What's the MINIMUM number of stages?
- How can you filter BEFORE expensive enrichment?
- Include your reasoning in "logic_reasoning" in your output.

### Step 2: FLOW — Design the stage sequence
Based on your logic:
1. Discovery (scrape the narrowest source first)
2. Filter (AI removes non-matches before enrichment)
3. Enrich (add missing data: LinkedIn URLs, employee count)
4. Filter again (apply size/criteria filters)
5. People (find decision makers)
6. Contact (get email/phone)

### Step 3: STAGE CATEGORY SELECTION — Choose data source types
For each scrape stage, select a STAGE CATEGORY. The system will automatically map categories to the best available actor.

CRITICAL RULES:
- PREFER categories from the KNOWN CATEGORIES list (they have verified, reliable actors)
- You MAY use CUSTOM categories if no known category fits (e.g., "custom:crunchbase", "custom:facebook_pages")
- Custom categories will be resolved dynamically — slightly higher failure risk
- For custom categories, use generic params: { "query": "...", "location": "...", "maxResults": N }
- NEVER use actor keys or actor IDs — only stage categories

## KNOWN STAGE CATEGORIES (verified — high reliability)

${categoryDescriptions}

## CUSTOM CATEGORIES (dynamic resolution — use when no known category fits)
If you need a data source not covered above, use:
- "custom:crunchbase" — for funding/startup data
- "custom:yellowpages" — for Yellow Pages listings
- "custom:facebook_pages" — for Facebook business pages
- "custom:<descriptive_name>" — for any other data source
For custom categories, use generic params: { "query": "search term", "location": "...", "maxResults": 100 }

## PIPELINE STAGE SCHEMA

For "scrape" stages:
{
  "stage": <number>,
  "name": "<human-readable stage name>",
  "type": "scrape",
  "stage_category": "<category_key>",
  "params": { <input params matching the category's input schema> },
  "input_from": "<field_name>" | null,
  "search_titles": ["CEO", "Founder"],  // only for people_data categories
  "dedup_after": true|false,
  "updates_fields": ["field1", "field2"],
  "search_query": "keyword OR keyword2",
  "role_filter": ["SDR", "Sales Representative"],  // ONLY for hiring_intent — exact job titles
  "expected_output_count": <number>,
  "input_transform": "linkedin_url_discovery" // special: for web_search:google to find LinkedIn URLs
}

For "ai_filter" stages:
{
  "stage": <number>,
  "name": "<human-readable stage name>",
  "type": "ai_filter",
  "prompt": "<classification prompt>",
  "input_fields": ["company_name", "website", "industry"],
  "expected_pass_rate": 0.20
}

## ROLE FILTER vs SEARCH QUERY (CRITICAL for hiring_intent pipelines)

When the user searches for specific job roles at companies in a particular industry:
- \`search_query\` = the INDUSTRY CONTEXT (e.g., "marketing agency", "SaaS companies")
- \`role_filter\` = the EXACT JOB TITLES the user wants (e.g., ["SDR", "Sales Representative"])

The processor uses \`role_filter\` as the job title field, and \`search_query\` for industry context.

Example:
- User: "Find marketing agencies hiring SDRs"
- search_query: "marketing agency OR advertising agency"
- role_filter: ["SDR", "Sales Development Representative", "Sales Representative"]

NEVER combine industry terms with role titles into a single string like "marketing agency SDR".
If the user does NOT specify particular roles, omit role_filter (null).

## MANDATORY OUTPUT FIELDS (CRITICAL — EVERY pipeline MUST produce these)

Every pipeline MUST produce ALL of these fields by the final stage:
1. contact_name — The person's full name
2. industry — Company industry/vertical
3. website — Company website URL
4. company_linkedin_url — LinkedIn company page URL
5. linkedin_profile_url — Person's LinkedIn profile URL
6. employee_count — Company size / employee range

If a stage category's outputs don't include a required field, you MUST add an enrichment stage:
- Missing contact_name + linkedin_profile_url → add a people_data:linkedin stage
- Missing industry + employee_count + company_linkedin_url → add a company_data:linkedin stage
- Missing website → add a web_search:google stage

## DATA FLOW RULES (CRITICAL)

1. Check each category's output fields. Fields marked ✗ mean that category does NOT output that data.
2. NEVER use input_from with a field that won't be populated by a preceding stage.
3. If a required field isn't available, INSERT an intermediate stage:
   - Missing LinkedIn URLs: Add web_search:google with input_transform: "linkedin_url_discovery"
   - Missing websites: Add web_search:google with company name queries
4. People search categories can work with company_name — the processor builds search URLs. Use input_from: "company_name".

## COST EFFECTIVENESS RULES

- Each actor run costs ~$0.001 per result scraped
- AI filtering costs ~$0.001 per lead evaluated
- ALWAYS start with the most CONSTRAINED source
- ALWAYS filter aggressively BEFORE expensive enrichment
- Total pipeline cost should be MINIMIZED

## PIPELINE DESIGN RULES

1. Start with the NARROWEST source
2. AI filter stages come after discovery — narrow BEFORE enrichment
3. Company enrichment comes AFTER filtering
4. Person-finding is near-last — only on qualified companies
5. Contact enrichment is ALWAYS the last scrape stage
6. input_from tells the processor which field from existing leads to use:
   - "company_linkedin_url" → LinkedIn company URLs
   - "website" → website URLs
   - "company_name" → company names
   - null for stage 1 (uses search_query directly)
7. search_query supports OR syntax: "SDR OR BDR OR Sales Rep"
8. Set reasonable limits in stage 1 params
9. NEVER set splitByLocation: true for any LinkedIn category
10. For hiring intent, use multiple job board categories for broader coverage
11. Include dedup_after: true for stage 1

## STAGE 1 QUERY PRECISION (CRITICAL)

When the user's goal targets a specific industry, you MUST include industry qualifiers in ALL Stage 1 search parameters.
- Job boards: "marketing agency sales representative" NOT just "sales representative"
- Google Maps: "marketing agencies" NOT just "agencies"
- BUT for hiring_intent with role_filter: search_query = industry, role_filter = titles

## DECISION MAKER SELECTION

When finding people, select titles based on target company size:
- Small (1-20): CEO, Founder, Owner
- Medium (20-200): VP/Director of relevant department
- Large (200+): C-suite or VP

## AI FILTER: JOB-TITLE RELEVANCE (CRITICAL)
When the user specifies job roles, your ai_filter prompt MUST reject leads where the job title doesn't match.

## OUTPUT FORMAT

Return ONLY a valid JSON object:
{
  "signal_name": "<short descriptive name>",
  "logic_reasoning": "<1-2 sentences>",
  "pipeline": [ <array of stage objects> ],
  "infeasible_reason": null | "<explanation>"
}

No markdown, no explanation, just the JSON.`;
}

// ════════════════════════════════════════════════════════════════
// ██  POST-GENERATION VALIDATION — Data Flow Check
// ════════════════════════════════════════════════════════════════

function validateDataFlow(pipeline: any[]): { valid: boolean; issues: string[]; fixedPipeline: any[] } {
  const issues: string[] = [];
  const fixedPipeline = [...pipeline];

  // Check that input_from fields are produced by previous stages
  for (let i = 1; i < fixedPipeline.length; i++) {
    const stage = fixedPipeline[i];
    if (stage.type !== "scrape") continue;
    if (!stage.input_from) continue;
    const inputField = stage.input_from;
    let found = false;
    for (let j = 0; j < i; j++) {
      const prevStage = fixedPipeline[j];
      if (prevStage.type !== "scrape") continue;
      const outputs = prevStage.expected_output_fields || [];
      if (outputs.includes(inputField)) {
        found = true;
        break;
      }
    }
    if (!found) {
      issues.push(`Stage ${stage.stage} input_from field "${inputField}" not produced by any previous stage.`);
      // Auto-fix: remove input_from to null
      fixedPipeline[i].input_from = null;
    }
  }

  return { valid: issues.length === 0, issues, fixedPipeline };
}

// ════════════════════════════════════════════════════════════════
// ██  ACTOR RESOLUTION & PRE-FLIGHT VALIDATION
// ════════════════════════════════════════════════════════════════

async function resolveActorsForPipeline(
  pipeline: any[],
  serviceClient: any
): Promise<{ resolvedPipeline: any[]; actorRegistry: Record<string, ActorEntry>; warnings: string[] }> {
  const actorRegistry: Record<string, ActorEntry> = {};
  const warnings: string[] = [];
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;

  for (const stage of pipeline) {
    if (stage.type !== "scrape") continue;

    const category = stage.stage_category;
    if (!category) {
      // Legacy format — stage already has actors[] set (e.g. from ai_filter reconfiguration)
      if (stage.actors && stage.actors.length > 0) continue;
      warnings.push(`Stage ${stage.stage} has no stage_category — cannot resolve actor`);
      continue;
    }

    const verified = VERIFIED_ACTORS[category];
    if (verified) {
      // ── Verified actor: use directly, no discovery needed ──
      const actorEntry = verifiedToActorEntry(category, verified);
      actorRegistry[actorEntry.key] = actorEntry;
      stage.actors = [actorEntry.key];
      // Convert params → params_per_actor
      if (stage.params && !stage.params_per_actor) {
        stage.params_per_actor = { [actorEntry.key]: stage.params };
      }
      console.log(`Stage ${stage.stage}: Resolved ${category} → verified actor ${verified.actorId}`);
    } else {
      // ── Dynamic discovery for unknown categories ──
      console.log(`Stage ${stage.stage}: ${category} not in verified catalog — discovering dynamically`);
      const searchTerm = category.replace("custom:", "").replace(/_/g, " ").replace(":", " ");

      let discoveredForCategory: ActorEntry[] = [];
      try {
        discoveredForCategory = await discoverActors(searchTerm, serviceClient);
      } catch (err) {
        warnings.push(`Stage ${stage.stage}: Actor discovery failed for "${category}": ${err}`);
        continue;
      }

      // ── Per-actor pre-flight validation ──
      const nextStage = pipeline.find((s: any) => s.stage === stage.stage + 1);
      const nextRequiredFields = nextStage?.input_from ? [nextStage.input_from] : [];
      // Also include expected output field requirements
      if (nextStage?.type === "scrape" && nextStage?.stage_category) {
        const nextVerified = VERIFIED_ACTORS[nextStage.stage_category];
        if (nextVerified) {
          // Next stage needs whatever its input_from field maps to
        }
      }

      let preflightPassed = false;
      for (const candidate of discoveredForCategory.slice(0, 3)) {
        const result = await preflightValidateActor(candidate, stage, nextRequiredFields, APIFY_API_TOKEN);
        if (result.passed) {
          actorRegistry[candidate.key] = { ...candidate, _verified: false } as any;
          stage.actors = [candidate.key];
          if (stage.params && !stage.params_per_actor) {
            stage.params_per_actor = { [candidate.key]: stage.params };
          }
          console.log(`Stage ${stage.stage}: Pre-flight PASSED for ${candidate.actorId} (dynamic)`);
          preflightPassed = true;

          // Add remaining candidates as backups
          for (const backup of discoveredForCategory.filter(a => a.key !== candidate.key).slice(0, 2)) {
            actorRegistry[backup.key] = { ...backup, _isBackup: true, _backupForSubCategory: (candidate as any).subCategory || candidate.category } as any;
          }
          break;
        } else {
          console.log(`Stage ${stage.stage}: Pre-flight FAILED for ${candidate.actorId}: ${result.reason}`);
        }
      }

      if (!preflightPassed) {
        warnings.push(`Stage ${stage.stage}: No actor passed pre-flight for "${category}". Using best candidate without validation.`);
        if (discoveredForCategory.length > 0) {
          const fallback = discoveredForCategory[0];
          actorRegistry[fallback.key] = fallback;
          stage.actors = [fallback.key];
          if (stage.params && !stage.params_per_actor) {
            stage.params_per_actor = { [fallback.key]: stage.params };
          }
        }
      }
    }
  }

  // ── Add backup verified actors for each used verified category ──
  for (const stage of pipeline) {
    if (stage.type !== "scrape" || !stage.actors) continue;
    const primaryKey = stage.actors[0];
    const primary = actorRegistry[primaryKey];
    if (!primary || !(primary as any)._verified) continue;

    // Find other verified actors in the same broad category as backups
    const backups = Object.entries(VERIFIED_ACTORS)
      .filter(([, v]) => v.category === primary.category && v.actorId !== primary.actorId)
      .slice(0, 2);
    for (const [catKey, backup] of backups) {
      const bEntry = verifiedToActorEntry(catKey, backup);
      if (!actorRegistry[bEntry.key]) {
        actorRegistry[bEntry.key] = { ...bEntry, _isBackup: true, _backupForSubCategory: (primary as any).subCategory || primary.category } as any;
      }
    }
  }

  return { resolvedPipeline: pipeline, actorRegistry, warnings };
}

async function preflightValidateActor(
  actor: ActorEntry,
  stageDef: any,
  nextStageRequiredFields: string[],
  token: string
): Promise<{ passed: boolean; reason: string; outputFields?: string[] }> {
  try {
    // Build minimal input with maxItems: 1
    const params = stageDef.params || {};
    const input = buildGenericInput(actor, { ...params, maxItems: 1 });
    if (!input.proxyConfiguration) input.proxyConfiguration = { useApifyProxy: true };

    // Start a test run
    const actorIdEncoded = actor.actorId.replace("/", "~");
    const resp = await fetch(
      `https://api.apify.com/v2/acts/${actorIdEncoded}/runs?token=${token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      return { passed: false, reason: `Start failed (${resp.status}): ${errText.slice(0, 200)}` };
    }

    const runData = await resp.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;

    // Poll for completion (45s timeout)
    const deadline = Date.now() + 45000;
    let status = "RUNNING";
    while (Date.now() < deadline && (status === "RUNNING" || status === "READY")) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const pollResp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`, { method: "GET" });
        if (pollResp.ok) {
          const pollData = await pollResp.json();
          status = pollData.data.status;
        }
      } catch { /* continue polling */ }
    }

    if (status !== "SUCCEEDED") {
      if (status === "RUNNING" || status === "READY") {
        try { await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${token}`, { method: "POST" }); } catch { /* ignore */ }
      }
      return { passed: false, reason: `Run status: ${status} (did not complete in 45s)` };
    }

    // Collect results
    const itemsResp = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=5`,
      { method: "GET" }
    );
    if (!itemsResp.ok) return { passed: false, reason: `Dataset fetch failed (${itemsResp.status})` };
    const items = await itemsResp.json();

    if (!items || items.length === 0) {
      return { passed: false, reason: "Actor returned 0 results" };
    }

    // Normalize and check output fields
    const normalised = normaliseGenericResults(actor, items);
    const populatedFields = new Set<string>();
    for (const item of normalised) {
      for (const [key, value] of Object.entries(item)) {
        if (key !== "_raw" && value !== null && value !== undefined && value !== "") {
          populatedFields.add(key);
        }
      }
    }

    // Check if next stage's required fields are covered
    const fieldAliases: Record<string, string[]> = {
      company_linkedin_url: ["linkedin", "company_linkedin_url"],
      linkedin_profile_url: ["linkedin_profile", "linkedin_profile_url"],
    };
    const missingForNext: string[] = [];
    for (const required of nextStageRequiredFields) {
      const aliases = fieldAliases[required] || [required];
      if (!aliases.some(a => populatedFields.has(a))) {
        missingForNext.push(required);
      }
    }

    if (missingForNext.length > 0) {
      return {
        passed: false,
        reason: `Output missing fields needed by next stage: ${missingForNext.join(", ")}`,
        outputFields: [...populatedFields],
      };
    }

    return { passed: true, reason: "OK", outputFields: [...populatedFields] };
  } catch (err) {
    return { passed: false, reason: `Pre-flight error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// Helper: normalise results using actor outputFields or universal paths
function normaliseGenericResults(actor: ActorEntry | null, items: any[]): any[] {
  const UNIVERSAL_OUTPUT_PATHS: Record<string, string[]> = {
    company_name: ["company", "companyName", "company_name", "name", "title", "employer.name", "businessName", "organization"],
    website: ["website", "url", "companyUrl", "companyWebsite", "domain", "link", "homepageUrl", "href"],
    linkedin: ["linkedinUrl", "companyLinkedinUrl", "linkedin", "linkedIn", "linkedin_url"],
    location: ["location", "address", "fullAddress", "jobLocation", "place"],
    city: ["city", "location.city"],
    state: ["state", "location.state"],
    country: ["country", "countryCode", "location.countryName"],
    phone: ["phone", "telephone", "phoneNumber", "phones", "displayPhone"],
    email: ["email", "emails", "emailAddresses", "contactEmail"],
    description: ["description", "descriptionHtml", "snippet", "text", "body"],
    industry: ["industry", "industries", "category", "categoryName", "categories"],
    employee_count: ["employeeCount", "companyEmployeesCount", "companySize", "staffCount"],
    title: ["title", "jobTitle", "position", "positionName", "headline"],
    contact_name: ["fullName", "name", "firstName", "personName"],
    linkedin_profile: ["profileUrl", "linkedinUrl", "url", "linkedInProfile"],
    salary: ["salary", "salaryInfo", "baseSalary"],
  };
  const fieldPaths = (actor?.outputFields && Object.keys(actor.outputFields).length > 0)
    ? actor.outputFields : UNIVERSAL_OUTPUT_PATHS;
  return items.map((item) => {
    const normalised: Record<string, any> = {};
    for (const [outputKey, sourcePaths] of Object.entries(fieldPaths)) {
      let value: any = null;
      for (const path of sourcePaths) {
        const v = path.includes('.') ? path.split('.').reduce((acc: any, p: string) => acc && acc[p], item) : item[path];
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

// Helper: build generic input from actor schema + provided params
function buildGenericInput(actor: ActorEntry, params: Record<string, any>): Record<string, any> {
  if (!actor.inputSchema || Object.keys(actor.inputSchema).length === 0) {
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
    if (result[key] === undefined && value !== undefined) result[key] = value;
  }
  return result;
}

// ════════════════════════════════════════════════════════════════
// ██  MAIN HANDLER
// ════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    if (url.pathname === "/generate-plan") {
      const body = await req.json();
      const userId = req.headers.get("x-user-id") || "anonymous";
      return await handleGeneratePlan(body, userId, supabaseClient);
    }

    return new Response("Not found", { status: 404 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ════════════════════════════════════════════════════════════════
// ██  GENERATE PLAN
// ════════════════════════════════════════════════════════════════

async function handleGeneratePlan(
  params: { query: string; workspace_id: string; plan_override?: any; advanced_settings?: any },
  userId: string,
  serviceClient: any
) {
  const { query, workspace_id, plan_override, advanced_settings } = params;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  // Step 1: Build category-based prompt (no actor discovery needed upfront)
  let systemPrompt = buildPipelinePlannerPrompt();

  // Inject advanced settings
  if (advanced_settings) {
    const maxResults = advanced_settings.max_results_per_source || 500;
    const dateRange = advanced_settings.date_range || "past_week";
    const strictness = advanced_settings.ai_strictness || "medium";

    const dateMap: Record<string, string> = {
      past_24h: "past 24 hours only", past_week: "past week",
      past_2_weeks: "past 2 weeks", past_month: "past month",
    };
    const strictnessMap: Record<string, string> = {
      low: "Be lenient — accept borderline matches. expected_pass_rate: 0.30-0.50.",
      medium: "Balanced filtering. expected_pass_rate: 0.15-0.30.",
      high: "Very strict — only strong matches. expected_pass_rate: 0.05-0.15.",
    };

    systemPrompt += `\n\n## USER PREFERENCES (OVERRIDE DEFAULTS)\n`;
    systemPrompt += `- Max results per source in stage 1: ${maxResults}\n`;
    systemPrompt += `- Date range: ${dateMap[dateRange] || "past week"}\n`;
    systemPrompt += `- Filtering strictness: ${strictnessMap[strictness] || strictnessMap.medium}\n`;
  }

  // Inject plan_override hints from templates
  if (plan_override) {
    systemPrompt += `\n\n## TEMPLATE HINTS (from plan_override — follow these instructions)\n`;
    if (plan_override.ai_filter_instruction) {
      systemPrompt += `- AI FILTER REQUIREMENT: ${plan_override.ai_filter_instruction}\n`;
    }
    if (plan_override.pipeline_hints) {
      systemPrompt += `- PIPELINE HINTS: ${plan_override.pipeline_hints}\n`;
    }
    if (plan_override.person_enrichment) {
      systemPrompt += `- PERSON ENRICHMENT: ${plan_override.person_enrichment}\n`;
    }
    if (typeof plan_override === "string") {
      systemPrompt += `- ${plan_override}\n`;
    }
  }

  // Enrich user query with parsed context
  const parsedIndustryTerms = inferQueryIndustry(query);
  const geographyTerms = extractGeography(query);
  const signalType = classifySignalType(query);

  let enrichedUserMessage = query;
  const contextParts: string[] = [];
  if (parsedIndustryTerms.length > 0) contextParts.push(`Industry/vertical: ${parsedIndustryTerms.join(", ")}`);
  if (geographyTerms.length > 0) contextParts.push(`Geography: ${geographyTerms.join(", ")}`);
  if (signalType) contextParts.push(`Signal type: ${signalType}`);
  if (contextParts.length > 0) {
    enrichedUserMessage = `${query}\n\n[PARSED CONTEXT — use this to ensure Stage 1 precision]\n${contextParts.join("\n")}`;
  }

  // Step 2: AI generates logical pipeline with stage_categories
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: enrichedUserMessage },
      ],
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    throw new Error(`AI gateway error: ${status}`);
  }

  const aiResult = await response.json();
  let planText = aiResult.choices?.[0]?.message?.content || "";
  planText = planText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const jsonMatch = planText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) planText = jsonMatch[1];

  let parsedPlan: any;
  try {
    parsedPlan = JSON.parse(planText);
  } catch (parseErr) {
    console.error("Failed to parse AI plan response:", planText.slice(0, 1000));
    throw new Error("AI returned invalid plan. Please try rephrasing your query.");
  }

  if (parsedPlan.infeasible_reason) {
    return new Response(
      JSON.stringify({ error: `This search isn't possible: ${parsedPlan.infeasible_reason}` }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Ensure pipeline format
  if (!parsedPlan.pipeline) {
    if (Array.isArray(parsedPlan)) {
      parsedPlan = {
        signal_name: "Signal",
        pipeline: parsedPlan.map((p: any, i: number) => ({
          stage: i + 1, name: p.name || `Stage ${i + 1}`, type: "scrape",
          stage_category: p.stage_category || "custom:unknown",
          params: p.params || {},
          input_from: null, search_query: p.search_query, dedup_after: true,
          expected_output_count: p.expected_output_count || 1000,
        })),
      };
    } else {
      throw new Error("AI returned unexpected format. Please try again.");
    }
  }

  // Force disable splitByLocation
  for (const stage of parsedPlan.pipeline) {
    const params = stage.params_per_actor || stage.params || {};
    if (typeof params === "object") {
      for (const val of Object.values(params)) {
        if (val && typeof val === "object" && (val as any).splitByLocation === true) {
          (val as any).splitByLocation = false;
          delete (val as any).splitCountry;
        }
      }
    }
  }

  // Step 3: Resolve actors for each stage (verified first, dynamic fallback + pre-flight)
  console.log(`Resolving actors for ${parsedPlan.pipeline.filter((s: any) => s.type === "scrape").length} scrape stages...`);
  const { resolvedPipeline, actorRegistry, warnings: resolveWarnings } =
    await resolveActorsForPipeline(parsedPlan.pipeline, serviceClient);
  parsedPlan.pipeline = resolvedPipeline;

  // Populate discoveredActorMap so validateDataFlow and validatePipelinePlan work
  discoveredActorMap = new Map(Object.entries(actorRegistry).map(([k, v]) => [k, v]));

  // Step 4: Apply advanced settings caps to Stage 1
  const maxCap = advanced_settings?.max_results_per_source || null;
  for (const stage of parsedPlan.pipeline) {
    if (stage.stage === 1 && stage.type === "scrape") {
      let totalInferred = 0;
      const actorCount = Object.keys(stage.params_per_actor || {}).length || 1;
      if (stage.params_per_actor) {
        for (const actorKey of Object.keys(stage.params_per_actor)) {
          const actorParams = stage.params_per_actor[actorKey];
          let actorCapped = false;
          for (const field of ROW_CAP_KEYS) {
            if (actorParams[field] !== undefined) {
              const numVal = typeof actorParams[field] === "number" ? actorParams[field] : parseInt(String(actorParams[field]), 10);
              if (!isNaN(numVal) && numVal > 0) {
                if (maxCap && numVal > maxCap) actorParams[field] = maxCap;
                actorCapped = true;
              }
            }
          }
          if (!actorCapped) actorParams.maxItems = maxCap || 500;
          const inferred = inferRowCapFromParams(actorParams);
          totalInferred += inferred || (maxCap || 500);
        }
      } else {
        totalInferred = maxCap || 500;
      }
      const computedCount = maxCap ? Math.min(totalInferred, maxCap * actorCount) : totalInferred;
      stage.expected_output_count = computedCount;
    }
  }

  // Step 5: Validate data flow and auto-fix
  const dataFlowResult = validateDataFlow(parsedPlan.pipeline);
  if (!dataFlowResult.valid) {
    console.log("Data flow issues detected and fixed:", dataFlowResult.issues);
    parsedPlan.pipeline = dataFlowResult.fixedPipeline;
  }

  // Step 6: Embed actor_registry in the plan
  parsedPlan.actor_registry = actorRegistry;

  // Step 7: Validate and warn
  const warnings = [...resolveWarnings, ...validatePipelinePlan(parsedPlan, query)];

  // Step 8: Cost estimation
  const { totalCredits, totalEstimatedRows, totalEstimatedLeads, stageFunnel } = estimatePipelineCost(parsedPlan.pipeline);
  const costPerLead = totalEstimatedLeads > 0 ? (totalCredits / totalEstimatedLeads).toFixed(1) : "N/A";

  const signalName = parsedPlan.signal_name || "Signal";
  const pipelineStageCount = parsedPlan.pipeline.length;

  const usedActorKeys = new Set<string>();
  for (const stage of parsedPlan.pipeline) {
    if (stage.actors) stage.actors.forEach((a: string) => usedActorKeys.add(a));
  }
  const sourceLabels = [...usedActorKeys].map(k => actorRegistry[k]?.label || discoveredActorMap.get(k)?.label || k);

  // Step 9: Save plan
  const { data: run, error: insertError } = await serviceClient
    .from("signal_runs")
    .insert({
      user_id: userId,
      workspace_id,
      signal_name: signalName,
      signal_query: query,
      signal_plan: parsedPlan,
      estimated_cost: totalCredits,
      estimated_leads: totalEstimatedLeads,
      status: "planned",
      pipeline_stage_count: pipelineStageCount,
      current_pipeline_stage: 0,
      advanced_settings: advanced_settings || null,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return new Response(
    JSON.stringify({
      run_id: run.id,
      plan: parsedPlan,
      estimation: {
        estimated_rows: totalEstimatedRows,
        estimated_leads: totalEstimatedLeads,
        credits_to_charge: totalCredits,
        cost_per_lead: costPerLead,
        source_label: sourceLabels.join(" + "),
        stage_funnel: stageFunnel,
      },
      warnings,
      data_flow_fixes: dataFlowResult.issues.length > 0 ? dataFlowResult.issues : undefined,
      logic_reasoning: parsedPlan.logic_reasoning || null,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Placeholder implementations for helper functions used above (to be replaced with actual implementations)
function inferQueryIndustry(query: string): string[] {
  // Dummy implementation
  return [];
}
function extractGeography(query: string): string[] {
  // Dummy implementation
  return [];
}
function classifySignalType(query: string): string | null {
  // Dummy implementation
  return null;
}
async function discoverActors(searchTerm: string, serviceClient: any): Promise<ActorEntry[]> {
  // Dummy implementation: should query Apify Store or other registry
  return [];
}
function validatePipelinePlan(plan: any, query: string): string[] {
  // Dummy implementation
  return [];
}
function estimatePipelineCost(pipeline: any[]): { totalCredits: number; totalEstimatedRows: number; totalEstimatedLeads: number; stageFunnel: any } {
  // Dummy implementation
  return { totalCredits: 0, totalEstimatedRows: 0, totalEstimatedLeads: 0, stageFunnel: null };
}
const ROW_CAP_KEYS = ["maxItems", "maxResults", "maxCrawledPlacesPerSearch"];
function inferRowCapFromParams(params: any): number | null {
  for (const key of ROW_CAP_KEYS) {
    if (params[key] !== undefined) {
      const val = typeof params[key] === "number" ? params[key] : parseInt(String(params[key]), 10);
      if (!isNaN(val)) return val;
    }
  }
  return null;
}
