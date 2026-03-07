import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ════════════════════════════════════════════════════════════════
// ██  FALLBACK ACTOR CATALOG — used when Apify Store API is unavailable
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

const FALLBACK_ACTOR_CATALOG: ActorEntry[] = [
  // ── Hiring Intent ──
  {
    key: "linkedin_jobs",
    actorId: "curious_coder/linkedin-jobs-scraper",
    label: "LinkedIn Jobs",
    category: "hiring_intent",
    description: "Scrapes LinkedIn job postings. Returns company name, website, LinkedIn URL, employee count, industry.",
    inputSchema: {
      urls:              { type: "string[]", required: true, description: "LinkedIn job search URLs" },
      count:             { type: "number",  default: 2500, description: "Max job listings" },
      scrapeCompany:     { type: "boolean", default: true, description: "Include company details" },
      splitByLocation:   { type: "boolean", default: false, description: "Split by location (CAUTION: often returns 0 results)" },
      splitCountry:      { type: "string",  description: "Country for location splitting" },
    },
    outputFields: {
      company_name: ["companyName", "company"], title: ["title", "jobTitle", "position"],
      website: ["companyWebsite"], linkedin: ["companyLinkedinUrl", "companyUrl"],
      location: ["location", "jobLocation", "place"], city: ["city", "jobLocation"], state: ["state"], country: ["country"],
      phone: [], email: ["email", "contactEmail"], description: ["descriptionHtml", "description"],
      industry: ["companyIndustry", "industries"], employee_count: ["companyEmployeesCount", "companySize"],
      salary: ["salaryInfo", "salary"], apply_link: ["link", "applyLink"],
    },
    monthlyUsers: 5000, totalRuns: 500000, rating: 4.5,
  },
  {
    key: "indeed_jobs",
    actorId: "valig/indeed-jobs-scraper",
    label: "Indeed Jobs",
    category: "hiring_intent",
    description: "Scrapes Indeed job postings. Broader coverage than LinkedIn. IMPORTANT: Does NOT output LinkedIn URLs. Output has nested structure (employer.name, location.city).",
    inputSchema: {
      title:      { type: "string",  required: true, description: "Job title or keywords" },
      location:   { type: "string",  default: "United States", description: "Location filter" },
      country:    { type: "string",  default: "us", description: "Country code" },
      limit:      { type: "number",  default: 1000, description: "Max results" },
      datePosted: { type: "string",  default: "7", description: "Days since posted (1, 3, 7, 14)" },
    },
    outputFields: {
      company_name: ["company", "companyName", "employer.name"],
      title: ["positionName", "title", "jobTitle"],
      website: ["employer.corporateWebsite", "companyUrl"],
      linkedin: [], location: ["location", "jobLocation", "location.city"],
      city: ["city", "location.city"], state: ["state", "location.state"],
      country: ["country", "location.countryName"],
      phone: [], email: [],
      description: ["description", "jobDescription", "description.text"],
      salary: ["salary", "baseSalary"], apply_link: ["url", "applyLink"],
      industry: ["employer.industry"], employee_count: ["employer.employeesCount"],
    },
    monthlyUsers: 3000, totalRuns: 300000, rating: 4.2,
  },

  // ── Local Business ──
  {
    key: "google_maps",
    actorId: "nwua9Gu5YrADL7ZDj",
    label: "Google Maps",
    category: "local_business",
    description: "Scrapes Google Maps places. Best for local businesses with physical presence. Returns phone, website, reviews. Does NOT output LinkedIn URLs.",
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
    monthlyUsers: 10000, totalRuns: 1000000, rating: 4.7,
  },
  {
    key: "yelp",
    actorId: "sovereigntaylor/yelp-scraper",
    label: "Yelp",
    category: "local_business",
    description: "Scrapes Yelp business listings. Does NOT output LinkedIn URLs.",
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
    description: "Scrapes Yellow Pages US listings. Does NOT output LinkedIn URLs.",
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

  // ── Company Data ──
  {
    key: "linkedin_companies",
    actorId: "2SyF0bVxmgGr8IVCZ",
    label: "LinkedIn Companies",
    category: "company_data",
    description: "Scrapes LinkedIn company profiles. Returns employee count, industry, headquarters, website. REQUIRES: company_linkedin_url as input.",
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

  // ── Website Scraping ──
  {
    key: "website_crawler",
    actorId: "apify/website-content-crawler",
    label: "Website Content Crawler",
    category: "website_data",
    description: "Crawls company websites to extract text content. REQUIRES: website as input.",
    inputSchema: {
      startUrls:              { type: "string[]", required: true, description: "Website URLs to crawl" },
      maxCrawlPages:          { type: "number",   default: 3, description: "Max pages to crawl per site" },
      crawlerType:            { type: "string",   default: "cheerio", description: "Crawler engine" },
    },
    outputFields: {
      website: ["url", "loadedUrl"],
      description: ["text", "markdown", "body"],
    },
  },

  // ── People Search ──
  {
    key: "linkedin_people",
    actorId: "curious_coder/linkedin-people-scraper",
    label: "LinkedIn People Search",
    category: "people_data",
    description: "Searches LinkedIn for people by title at specific companies. REQUIRES: company_linkedin_url OR company_name as input. Input is LinkedIn search URLs.",
    inputSchema: {
      urls:  { type: "string[]", required: true, description: "LinkedIn people search URLs with company and title filters" },
      count: { type: "number",   default: 50, description: "Max results per search" },
    },
    outputFields: {
      contact_name: ["fullName", "name", "firstName"],
      title: ["headline", "title", "currentPositions.title"],
      linkedin_profile: ["profileUrl", "url", "linkedinUrl"],
      company_name: ["currentCompany", "companyName"],
      location: ["location", "geoLocation"],
      city: ["city"],
      country: ["country"],
    },
  },

  // ── Contact Enrichment ──
  {
    key: "contact_enrichment",
    actorId: "9Sk4JJhEma9vBKqrg",
    label: "Contact Enrichment",
    category: "enrichment",
    description: "Extracts emails, phone numbers, social media from websites. REQUIRES: website as input.",
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

  // ── Web Search ──
  {
    key: "google_search",
    actorId: "nFJndFXA5zjCTuudP",
    label: "Google Search",
    category: "web_search",
    description: "Scrapes Google Search results. Good for finding LinkedIn URLs, specific company types, or any web discovery. Does NOT output LinkedIn URLs directly but can be used with site:linkedin.com queries to discover them.",
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

const CATALOG_BY_KEY = new Map(FALLBACK_ACTOR_CATALOG.map((a) => [a.key, a]));
function getActor(key: string): ActorEntry | undefined { return CATALOG_BY_KEY.get(key); }

// ════════════════════════════════════════════════════════════════
// ██  DYNAMIC ACTOR DISCOVERY — Apify Store API
// ════════════════════════════════════════════════════════════════

async function discoverActors(taskDescription: string, serviceClient: any): Promise<ActorEntry[]> {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) return [];

  // Check cache first (TTL: 7 days)
  const cacheThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: cached } = await serviceClient
    .from("signal_actor_cache")
    .select("*")
    .gte("cached_at", cacheThreshold)
    .limit(50);

  const cachedActors: ActorEntry[] = (cached || []).map((c: any) => ({
    key: c.actor_key || c.actor_id.replace("/", "_"),
    actorId: c.actor_id,
    label: c.label || c.actor_key || "",
    category: c.category || "discovered",
    description: c.description || "",
    inputSchema: c.input_schema || {},
    outputFields: c.output_fields || {},
    monthlyUsers: c.monthly_users || 0,
    totalRuns: c.total_runs || 0,
    rating: c.rating || 0,
  }));

  // Extract search terms from task description
  const searchTerms = extractSearchTerms(taskDescription);
  const discoveredActors: ActorEntry[] = [...cachedActors];

  for (const term of searchTerms) {
    try {
      const resp = await fetch(
        `https://api.apify.com/v2/store?search=${encodeURIComponent(term)}&limit=5&sortBy=popularity&token=${APIFY_API_TOKEN}`,
        { method: "GET" }
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      const items = data.data?.items || [];

      for (const item of items) {
        const actorId = item.username ? `${item.username}/${item.name}` : item.id;
        // Skip if already in fallback catalog or already discovered
        if (CATALOG_BY_KEY.has(actorId) || discoveredActors.some(a => a.actorId === actorId)) continue;
        // Skip very low quality actors
        if ((item.stats?.totalUsers || 0) < 50 && (item.stats?.totalRuns || 0) < 1000) continue;

        // Try to fetch input schema
        let inputSchema: Record<string, InputField> = {};
        let outputFieldsMap: Record<string, string[]> = {};
        try {
          const actorIdEncoded = actorId.replace("/", "~");
          const schemaResp = await fetch(
            `https://api.apify.com/v2/acts/${actorIdEncoded}?token=${APIFY_API_TOKEN}`,
            { method: "GET" }
          );
          if (schemaResp.ok) {
            const actorData = await schemaResp.json();
            const rawSchema = actorData.data?.defaultRunInput?.body || {};
            // Convert to our format (simplified)
            if (rawSchema.properties) {
              for (const [key, val] of Object.entries(rawSchema.properties as Record<string, any>)) {
                const type = val.type === "array" ? "string[]" : (val.type === "integer" ? "number" : (val.type || "string"));
                inputSchema[key] = {
                  type: type as any,
                  required: (rawSchema.required || []).includes(key),
                  default: val.default,
                  description: val.description || key,
                };
              }
            }
          }
        } catch { /* proceed without schema */ }

        const actor: ActorEntry = {
          key: `discovered_${actorId.replace(/[^a-zA-Z0-9]/g, "_")}`,
          actorId,
          label: item.title || item.name || actorId,
          category: categorizeActor(item.title || "", item.description || ""),
          description: (item.description || "").slice(0, 300),
          inputSchema,
          outputFields: outputFieldsMap,
          monthlyUsers: item.stats?.totalUsers || 0,
          totalRuns: item.stats?.totalRuns || 0,
          rating: item.stats?.publicStarVotes?.average || 0,
        };

        discoveredActors.push(actor);

        // Cache it
        try {
          await serviceClient.from("signal_actor_cache").upsert({
            actor_id: actorId,
            actor_key: actor.key,
            label: actor.label,
            category: actor.category,
            description: actor.description,
            input_schema: inputSchema,
            output_fields: outputFieldsMap,
            monthly_users: actor.monthlyUsers,
            total_runs: actor.totalRuns,
            rating: actor.rating,
            cached_at: new Date().toISOString(),
          }, { onConflict: "actor_id" });
        } catch { /* non-critical */ }
      }
    } catch (err) {
      console.warn(`Actor discovery search for "${term}" failed:`, err);
    }
  }

  return discoveredActors;
}

function extractSearchTerms(query: string): string[] {
  const terms: string[] = [];
  const lower = query.toLowerCase();
  // Add task-specific search terms
  if (lower.includes("job") || lower.includes("hiring") || lower.includes("recruit")) terms.push("job scraper");
  if (lower.includes("linkedin")) terms.push("linkedin scraper");
  if (lower.includes("company") || lower.includes("business")) terms.push("company scraper");
  if (lower.includes("email") || lower.includes("contact")) terms.push("contact finder");
  if (lower.includes("google") || lower.includes("maps")) terms.push("google maps scraper");
  if (lower.includes("website")) terms.push("website scraper");
  if (lower.includes("people") || lower.includes("person") || lower.includes("founder") || lower.includes("ceo")) terms.push("people finder");
  // Always search for key categories
  if (terms.length === 0) terms.push("lead generation scraper");
  return terms.slice(0, 3); // Max 3 searches to stay fast
}

function categorizeActor(title: string, desc: string): string {
  const text = `${title} ${desc}`.toLowerCase();
  if (text.includes("job") || text.includes("hiring") || text.includes("indeed") || text.includes("linkedin job")) return "hiring_intent";
  if (text.includes("google maps") || text.includes("yelp") || text.includes("local")) return "local_business";
  if (text.includes("linkedin company") || text.includes("company")) return "company_data";
  if (text.includes("people") || text.includes("person") || text.includes("linkedin people")) return "people_data";
  if (text.includes("email") || text.includes("contact") || text.includes("enrich")) return "enrichment";
  if (text.includes("website") || text.includes("crawl")) return "website_data";
  if (text.includes("google search") || text.includes("search")) return "web_search";
  return "other";
}

// ════════════════════════════════════════════════════════════════
// ██  BUILD PIPELINE PLANNER SYSTEM PROMPT
// ════════════════════════════════════════════════════════════════

function buildPipelinePlannerPrompt(discoveredActors: ActorEntry[] = []): string {
  // Combine fallback catalog with discovered actors
  const allActors = [...FALLBACK_ACTOR_CATALOG, ...discoveredActors];

  const catalogDescription = allActors.map((actor, idx) => {
    const params = Object.entries(actor.inputSchema)
      .map(([name, s]) => {
        let desc = `${name} (${s.type}${s.required ? ", REQUIRED" : ""})`;
        if (s.default !== undefined) desc += ` [default: ${JSON.stringify(s.default)}]`;
        desc += ` — ${s.description}`;
        return `     ${desc}`;
      })
      .join("\n");
    const outputs = Object.entries(actor.outputFields)
      .map(([key, paths]) => {
        const status = paths.length === 0 ? "NOT AVAILABLE" : paths.join(" | ");
        return `     ${key} ← ${status}`;
      })
      .join("\n");
    const popularity = actor.monthlyUsers ? ` (${actor.monthlyUsers} monthly users, rating: ${actor.rating || "N/A"})` : "";
    return `${idx + 1}. key: "${actor.key}" — ${actor.label} [${actor.category}]${popularity}
   ${actor.description}
   Input params:
${params}
   Output fields:
${outputs}`;
  }).join("\n\n");

  return `You are a lead generation pipeline architect. Given a user's description of leads they want to find, you design a MULTI-STAGE PIPELINE that finds those leads efficiently.

## CONCEPT

A pipeline is an ordered sequence of stages. Each stage either:
1. **scrape** — Uses an Apify actor to discover or enrich data
2. **ai_filter** — Uses AI to evaluate each lead against criteria and remove non-matches

Stages execute sequentially. Each stage operates on the SURVIVING leads from the previous stage. Later scrape stages use fields from existing leads as input.

## AVAILABLE ACTORS

${catalogDescription}

## PIPELINE STAGE SCHEMA

Each stage in the pipeline array must follow this structure:

For "scrape" stages:
{
  "stage": <number>,
  "name": "<human-readable stage name>",
  "type": "scrape",
  "actors": ["<actor_key>"],
  "params_per_actor": { "<actor_key>": { <input params> } },
  "input_from": "<field_name>" | null,
  "search_titles": ["CEO", "Founder"],  // only for linkedin_people actor
  "dedup_after": true|false,
  "updates_fields": ["field1", "field2"],
  "search_query": "keyword OR keyword2",
  "expected_output_count": <number>
}

For "ai_filter" stages:
{
  "stage": <number>,
  "name": "<human-readable stage name>",
  "type": "ai_filter",
  "prompt": "<classification prompt for AI>",
  "input_fields": ["company_name", "website", "industry"],
  "expected_pass_rate": 0.20
}

## DATA FLOW RULES (CRITICAL — MOST IMPORTANT RULES)

Before designing each stage, you MUST check what data the PREVIOUS stages actually produce:

1. **Check output fields carefully**: Each actor lists its output fields. Fields with "NOT AVAILABLE" (empty array []) mean that actor does NOT output that data. For example, indeed_jobs has linkedin: [] — it does NOT output LinkedIn URLs.

2. **NEVER use input_from with a field that won't be populated**: If you plan a stage with input_from: "company_linkedin_url", you MUST verify that a previous scrape stage's actor actually outputs "linkedin" with non-empty paths. If it doesn't, the stage will process 0 leads.

3. **Insert discovery stages when data is missing**: If a required field won't be available from previous stages, insert an intermediate stage to discover it:
   - For missing LinkedIn URLs: Add a google_search stage with queries like "COMPANY_NAME site:linkedin.com/company" — this is done automatically by the processor using company names from leads
   - For missing websites: Add a google_search stage with company name queries
   - For missing employee counts: Add a linkedin_companies stage (but only if LinkedIn URLs are available!)

4. **Data dependency chain**: Map out which fields each stage produces and which fields each subsequent stage needs. There must be no gaps.

5. **Prefer actors whose OUTPUTS match what downstream stages NEED**. When two actors do similar things, pick the one that outputs more fields you'll need later.

6. **linkedin_people can work with company_name**: If LinkedIn URLs aren't available, linkedin_people can still work — the processor constructs LinkedIn search URLs from company names. You can use input_from: "company_name" for this.

## PIPELINE DESIGN RULES

1. **Start with the most constrained filter**: Begin with the narrowest source that immediately reduces volume. For "marketing agencies hiring sales reps", start with job boards (narrow: companies hiring for specific roles) NOT Google Maps (broad: all marketing agencies).

2. **Minimize scraping cost**: Each scrape costs money. Design the pipeline to filter aggressively BEFORE expensive enrichment. The flow should be: Discover → Filter → Enrich → Filter → People → Contacts.

3. **AI filter stages come after discovery** — Narrow by company type, industry, or size BEFORE expensive enrichment.

4. **Company enrichment comes after filtering** — Use linkedin_companies to get headcount, industry only AFTER the AI has filtered out obvious non-matches.

5. **Person-finding is near-last** — Use linkedin_people ONLY on qualified companies.

6. **Contact enrichment is ALWAYS the last scrape stage**.

7. **input_from** tells the processor which field from existing leads to use as actor input:
   - "company_linkedin_url" → uses each lead's LinkedIn company URL
   - "website" → uses each lead's website URL
   - "company_name" → uses company names (for linkedin_people search or google_search)
   - null for stage 1 (uses the search_query directly)

8. **search_query** supports OR syntax: "SDR OR BDR OR Sales Rep". Each keyword becomes a separate search.

9. **Set appropriate limits** — Stage 1 should use reasonable defaults (2500 for LinkedIn, 1000 for Indeed, 2000 for Google Maps).

10. **NEVER set splitByLocation: true for LinkedIn Jobs** — This fragments searches and often returns 0 results. Always set splitByLocation: false.

11. **website_crawler** is optional — Use it when AI needs to verify company type from website content.

12. **For hiring intent, use BOTH linkedin_jobs AND indeed_jobs in stage 1** — This gives broader coverage.

## EXAMPLE PIPELINES

### Example 1: "Marketing agencies (1-10 employees) hiring sales reps"

ANALYSIS: User wants companies that are (a) marketing agencies, (b) small (1-10 employees), (c) hiring for sales. 
STRATEGY: Start with job boards (most constrained — only companies currently hiring for sales). Then AI-filter to marketing agencies. Then check company size. Then find decision makers.
DATA FLOW: indeed_jobs does NOT output linkedin URLs. linkedin_jobs DOES. For companies from Indeed without LinkedIn URLs, use google_search to discover them OR use company_name for linkedin_people.

{
  "signal_name": "Marketing agencies hiring sales reps",
  "pipeline": [
    {
      "stage": 1, "name": "Discover companies hiring sales reps",
      "type": "scrape", "actors": ["linkedin_jobs", "indeed_jobs"],
      "params_per_actor": {
        "linkedin_jobs": { "urls": ["https://www.linkedin.com/jobs/search/?keywords=sales%20representative&location=United%20States&f_TPR=r604800"], "count": 2500, "scrapeCompany": true, "splitByLocation": false },
        "indeed_jobs": { "title": "sales representative", "location": "United States", "limit": 1000, "datePosted": "7" }
      },
      "input_from": null, "dedup_after": true,
      "search_query": "sales representative OR sales rep OR account executive",
      "expected_output_count": 3000
    },
    {
      "stage": 2, "name": "Filter to marketing/advertising agencies",
      "type": "ai_filter",
      "prompt": "Based on the company name, website domain, industry, and job description, is this company a marketing agency, advertising agency, digital agency, creative agency, or PR firm? Reject large enterprises (Google, Meta, Amazon), hospitals, retailers, staffing agencies, and companies clearly in other industries. Accept only companies whose primary business is marketing/advertising services.",
      "input_fields": ["company_name", "website", "industry", "employee_count", "description"],
      "expected_pass_rate": 0.15
    },
    {
      "stage": 3, "name": "Discover LinkedIn URLs via Google Search",
      "type": "scrape", "actors": ["google_search"],
      "params_per_actor": { "google_search": { "maxPagesPerQuery": 1, "resultsPerPage": 3 } },
      "input_from": "company_name",
      "input_transform": "linkedin_url_discovery",
      "updates_fields": ["company_linkedin_url"],
      "expected_output_count": 400
    },
    {
      "stage": 4, "name": "Get company details from LinkedIn",
      "type": "scrape", "actors": ["linkedin_companies"],
      "params_per_actor": { "linkedin_companies": { "maxResults": 500 } },
      "input_from": "company_linkedin_url",
      "updates_fields": ["employee_count", "industry", "website", "city", "state", "country"],
      "expected_output_count": 350
    },
    {
      "stage": 5, "name": "Filter to 1-10 employees",
      "type": "ai_filter",
      "prompt": "Does this company have between 1 and 10 employees based on the employee_count field? If employee_count is missing or unclear, check if other indicators suggest a small company. Reject companies with more than 10 employees.",
      "input_fields": ["company_name", "employee_count", "industry"],
      "expected_pass_rate": 0.30
    },
    {
      "stage": 6, "name": "Find decision makers (CEO/Founder/Owner)",
      "type": "scrape", "actors": ["linkedin_people"],
      "params_per_actor": { "linkedin_people": { "count": 50 } },
      "input_from": "company_name",
      "search_titles": ["CEO", "Founder", "Owner", "Managing Director", "Principal"],
      "updates_fields": ["contact_name", "title", "linkedin_profile_url"],
      "expected_output_count": 80
    },
    {
      "stage": 7, "name": "Get contact information",
      "type": "scrape", "actors": ["contact_enrichment"],
      "params_per_actor": { "contact_enrichment": { "maxRequestsPerStartUrl": 5, "maxDepth": 2, "sameDomain": true, "mergeContacts": true } },
      "input_from": "website",
      "updates_fields": ["email", "phone"],
      "expected_output_count": 80
    }
  ]
}

### Example 2: "Chiropractors in Dallas with less than 10 Google reviews"
{
  "signal_name": "Chiropractors in Dallas (few reviews)",
  "pipeline": [
    {
      "stage": 1, "name": "Find chiropractors in Dallas",
      "type": "scrape", "actors": ["google_maps"],
      "params_per_actor": { "google_maps": { "searchStringsArray": ["chiropractor"], "maxCrawledPlacesPerSearch": 2000, "locationQuery": "Dallas, TX" } },
      "input_from": null, "dedup_after": true,
      "search_query": "chiropractor",
      "expected_output_count": 500
    },
    {
      "stage": 2, "name": "Get contact information",
      "type": "scrape", "actors": ["contact_enrichment"],
      "params_per_actor": { "contact_enrichment": { "maxRequestsPerStartUrl": 5, "maxDepth": 2, "sameDomain": true, "mergeContacts": true } },
      "input_from": "website",
      "updates_fields": ["email", "phone"],
      "expected_output_count": 500
    }
  ]
}

### Example 3: "SaaS companies with 50+ employees that just raised Series A"
{
  "signal_name": "SaaS companies post-Series A hiring",
  "pipeline": [
    {
      "stage": 1, "name": "Discover SaaS companies hiring (growth signal)",
      "type": "scrape", "actors": ["linkedin_jobs", "indeed_jobs"],
      "params_per_actor": {
        "linkedin_jobs": { "urls": ["https://www.linkedin.com/jobs/search/?keywords=SaaS%20sales&location=United%20States&f_TPR=r604800"], "count": 2500, "scrapeCompany": true, "splitByLocation": false },
        "indeed_jobs": { "title": "SaaS sales", "location": "United States", "limit": 1000, "datePosted": "7" }
      },
      "input_from": null, "dedup_after": true,
      "search_query": "SaaS sales OR SaaS account executive OR SaaS BDR",
      "expected_output_count": 3000
    },
    {
      "stage": 2, "name": "Filter to SaaS/software companies",
      "type": "ai_filter",
      "prompt": "Is this company a SaaS company or software company? Look at company name, website domain, and industry. Accept software, technology, and SaaS companies. Reject staffing agencies, consulting firms, and non-tech companies.",
      "input_fields": ["company_name", "website", "industry"],
      "expected_pass_rate": 0.25
    },
    {
      "stage": 3, "name": "Discover LinkedIn URLs for companies missing them",
      "type": "scrape", "actors": ["google_search"],
      "params_per_actor": { "google_search": { "maxPagesPerQuery": 1, "resultsPerPage": 3 } },
      "input_from": "company_name",
      "input_transform": "linkedin_url_discovery",
      "updates_fields": ["company_linkedin_url"],
      "expected_output_count": 700
    },
    {
      "stage": 4, "name": "Get company details from LinkedIn",
      "type": "scrape", "actors": ["linkedin_companies"],
      "params_per_actor": { "linkedin_companies": { "maxResults": 500 } },
      "input_from": "company_linkedin_url",
      "updates_fields": ["employee_count", "industry", "website", "city", "state", "country"],
      "expected_output_count": 600
    },
    {
      "stage": 5, "name": "Filter to 50+ employees",
      "type": "ai_filter",
      "prompt": "Does this company have 50 or more employees? Accept if employee_count >= 50. If employee_count is missing, reject.",
      "input_fields": ["company_name", "employee_count"],
      "expected_pass_rate": 0.40
    },
    {
      "stage": 6, "name": "Find VP Sales / CRO / Head of Sales",
      "type": "scrape", "actors": ["linkedin_people"],
      "params_per_actor": { "linkedin_people": { "count": 50 } },
      "input_from": "company_name",
      "search_titles": ["VP Sales", "CRO", "Chief Revenue Officer", "Head of Sales", "Director of Sales"],
      "updates_fields": ["contact_name", "title", "linkedin_profile_url"],
      "expected_output_count": 150
    },
    {
      "stage": 7, "name": "Get contact information",
      "type": "scrape", "actors": ["contact_enrichment"],
      "params_per_actor": { "contact_enrichment": { "maxRequestsPerStartUrl": 5, "maxDepth": 2, "sameDomain": true, "mergeContacts": true } },
      "input_from": "website",
      "updates_fields": ["email", "phone"],
      "expected_output_count": 150
    }
  ]
}

## OUTPUT FORMAT

Return ONLY a valid JSON object with this structure:
{
  "signal_name": "<short descriptive name>",
  "pipeline": [ <array of stage objects> ]
}

No markdown, no explanation, just the JSON.

## DECISION MAKER SELECTION

When designing the person-finding stage, select decision maker titles based on target company size:
- **Small companies (1-20 employees)**: CEO, Founder, Owner, Managing Director
- **Medium companies (20-200 employees)**: VP of [relevant dept], Director of [relevant dept]
- **Large companies (200+ employees)**: C-suite or VP level in the relevant department

## CRITICAL RULES

- ALWAYS include a contact_enrichment stage as the last scrape stage
- For hiring intent, ALWAYS use BOTH linkedin_jobs AND indeed_jobs in stage 1
- For local businesses, ALWAYS use google_maps (optionally add yelp)
- NEVER set splitByLocation: true for LinkedIn Jobs
- When a stage needs company_linkedin_url but previous stages may not provide it (e.g., indeed_jobs has linkedin: []), INSERT a google_search LinkedIn URL discovery stage between them
- If you use linkedin_companies or linkedin_people, make sure the required input data (LinkedIn URLs or company names) will actually be available from preceding stages
- AI filter prompts must be SPECIFIC — tell the AI exactly what to accept and reject
- Include dedup_after: true for stage 1 (discovery stages)
- The linkedin_people stage should have search_titles appropriate to the company size and user's needs
- linkedin_people works with company_name too — the processor builds LinkedIn search URLs from company names`;
}

// ════════════════════════════════════════════════════════════════
// ██  POST-GENERATION VALIDATION — Data Flow Check
// ════════════════════════════════════════════════════════════════

function validateDataFlow(pipeline: any[]): { valid: boolean; issues: string[]; fixedPipeline: any[] } {
  const issues: string[] = [];
  let fixedPipeline = [...pipeline];

  // Track which fields are populated after each stage
  const populatedFields = new Set<string>();

  // Stage 1 discovery populates base fields
  const stage1 = pipeline[0];
  if (stage1?.type === "scrape" && stage1.actors) {
    for (const actorKey of stage1.actors) {
      const actor = getActor(actorKey);
      if (!actor) continue;
      for (const [field, paths] of Object.entries(actor.outputFields)) {
        if (paths.length > 0) populatedFields.add(field);
      }
    }
  }

  for (let i = 1; i < fixedPipeline.length; i++) {
    const stage = fixedPipeline[i];

    if (stage.type === "scrape" && stage.input_from) {
      const requiredField = stage.input_from;

      // Check if this field will be available
      if (requiredField === "company_linkedin_url" && !populatedFields.has("linkedin")) {
        // LinkedIn URLs not available — check if we need to inject a discovery stage
        const alreadyHasDiscovery = fixedPipeline.some(
          (s: any, j: number) => j < i && s.input_transform === "linkedin_url_discovery"
        );

        if (!alreadyHasDiscovery) {
          issues.push(`Stage ${stage.stage} needs company_linkedin_url but no previous stage provides it. Injecting LinkedIn URL discovery stage.`);

          // Inject a google_search LinkedIn URL discovery stage
          const discoveryStage = {
            stage: stage.stage,
            name: "Discover LinkedIn URLs via Google Search",
            type: "scrape",
            actors: ["google_search"],
            params_per_actor: { google_search: { maxPagesPerQuery: 1, resultsPerPage: 3 } },
            input_from: "company_name",
            input_transform: "linkedin_url_discovery",
            updates_fields: ["company_linkedin_url"],
            expected_output_count: stage.expected_output_count || 100,
          };

          // Insert before the current stage and renumber
          fixedPipeline.splice(i, 0, discoveryStage);
          // Renumber all stages
          fixedPipeline = fixedPipeline.map((s: any, idx: number) => ({ ...s, stage: idx + 1 }));
          populatedFields.add("linkedin");
          i++; // Skip the inserted stage
        }
      }

      // Update populated fields from this stage's actor outputs
      for (const actorKey of (stage.actors || [])) {
        const actor = getActor(actorKey);
        if (!actor) continue;
        for (const [field, paths] of Object.entries(actor.outputFields)) {
          if (paths.length > 0) populatedFields.add(field);
        }
      }
    } else if (stage.type === "ai_filter") {
      // AI filter doesn't add fields, just removes leads
    }
  }

  return { valid: issues.length === 0, issues, fixedPipeline };
}

// ════════════════════════════════════════════════════════════════
// ██  PLAN-TIME WARNINGS & VALIDATION
// ════════════════════════════════════════════════════════════════

function validatePipelinePlan(plan: any, query: string): string[] {
  const warnings: string[] = [];
  const pipeline = plan.pipeline || [];

  if (pipeline.length === 0) {
    warnings.push("⚠️ Empty pipeline — no stages defined.");
    return warnings;
  }

  const hiringKeywords = ["hiring", "hire", "recruit", "job", "position", "role", "vacancy", "opening", "sdr", "bdr", "sales rep"];
  const queryLower = query.toLowerCase();
  const mentionsHiring = hiringKeywords.some(k => queryLower.includes(k));
  const stage1Actors = pipeline[0]?.actors || [];
  const usesJobSources = stage1Actors.some((a: string) => a === "linkedin_jobs" || a === "indeed_jobs");
  if (mentionsHiring && !usesJobSources) {
    warnings.push("💡 Your query mentions hiring intent, but the pipeline doesn't use job board sources.");
  }

  // Check for splitByLocation: true (known to fail)
  for (const stage of pipeline) {
    if (stage.params_per_actor?.linkedin_jobs?.splitByLocation === true) {
      warnings.push("⚠️ LinkedIn Jobs splitByLocation is enabled — this often returns 0 results. Consider disabling it.");
    }
  }

  // Check for data flow issues
  const dataFlowCheck = validateDataFlow(pipeline);
  for (const issue of dataFlowCheck.issues) {
    warnings.push(`🔗 ${issue}`);
  }

  const unscrappablePatterns = [
    { pattern: /funding|raised|series [a-z]|venture capital|investor/i, msg: "Funding data isn't directly scrappable. The pipeline uses hiring activity as a proxy." },
    { pattern: /revenue|income|profit|financial/i, msg: "Revenue data isn't directly available. Employee count and hiring activity are used as proxies." },
  ];
  for (const { pattern, msg } of unscrappablePatterns) {
    if (pattern.test(query)) {
      warnings.push(`ℹ️ ${msg}`);
      break;
    }
  }

  return warnings;
}

// ════════════════════════════════════════════════════════════════
// ██  COST ESTIMATION FOR PIPELINE
// ════════════════════════════════════════════════════════════════

function estimatePipelineCost(pipeline: any[]): { totalCredits: number; totalEstimatedRows: number; totalEstimatedLeads: number; stageFunnel: { stage: number; name: string; estimated_count: number }[] } {
  let currentCount = 0;
  let totalCredits = 0;
  const stageFunnel: { stage: number; name: string; estimated_count: number }[] = [];

  for (const stage of pipeline) {
    if (stage.type === "scrape") {
      if (stage.stage === 1) {
        const keywords = stage.search_query ? stage.search_query.split(/\s+OR\s+/i).length : 1;
        let maxPerActor = 0;
        for (const actorKey of (stage.actors || [])) {
          const actor = getActor(actorKey);
          if (!actor) continue;
          const maxField = Object.keys(actor.inputSchema).find(f => f.toLowerCase().includes("max") || f === "count" || f === "limit");
          const maxVal = stage.params_per_actor?.[actorKey]?.[maxField!] || actor.inputSchema[maxField!]?.default || 500;
          maxPerActor += keywords * maxVal;
        }
        currentCount = stage.expected_output_count || maxPerActor;
      } else {
        currentCount = stage.expected_output_count || currentCount;
      }

      const scrapeCostUsd = (currentCount / 1000) * 1.0;
      totalCredits += Math.max(2, Math.ceil(scrapeCostUsd * 1.5 * 5));
    } else if (stage.type === "ai_filter") {
      const passRate = stage.expected_pass_rate || 0.20;
      const aiCostUsd = currentCount * 0.001;
      totalCredits += Math.max(1, Math.ceil(aiCostUsd * 1.5 * 5));
      currentCount = Math.floor(currentCount * passRate);
    }

    stageFunnel.push({ stage: stage.stage, name: stage.name, estimated_count: currentCount });
  }

  totalCredits = Math.max(5, totalCredits);

  return {
    totalCredits,
    totalEstimatedRows: stageFunnel[0]?.estimated_count || 0,
    totalEstimatedLeads: currentCount,
    stageFunnel,
  };
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "generate_plan") {
      return await handleGeneratePlan(params, user.id, serviceClient);
    } else if (action === "execute_signal") {
      const { run_id, workspace_id } = params;
      const { data: run, error: runError } = await serviceClient
        .from("signal_runs").select("*").eq("id", run_id).single();
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
        .from("lead_credits").select("credits_balance").eq("workspace_id", workspace_id).maybeSingle();
      const balance = credits?.credits_balance || 0;
      if (balance < run.estimated_cost) {
        return new Response(
          JSON.stringify({ error: `Insufficient credits. Need ${run.estimated_cost}, have ${balance}.` }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await serviceClient.from("signal_runs").update({
        status: "queued",
        schedule_type: params.schedule_type || "once",
        schedule_hour: params.schedule_hour || null,
        next_run_at: params.schedule_type === "daily"
          ? new Date(Date.now() + 86400000).toISOString()
          : params.schedule_type === "weekly"
            ? new Date(Date.now() + 7 * 86400000).toISOString()
            : null,
      }).eq("id", run_id);
      return new Response(
        JSON.stringify({ status: "queued", run_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  params: { query: string; workspace_id: string; plan_override?: any; advanced_settings?: any },
  userId: string,
  serviceClient: any
) {
  const { query, workspace_id, advanced_settings } = params;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  // Step 1: Discover relevant actors from Apify Store
  let discoveredActors: ActorEntry[] = [];
  try {
    discoveredActors = await discoverActors(query, serviceClient);
    console.log(`Discovered ${discoveredActors.length} additional actors from Apify Store`);
  } catch (err) {
    console.warn("Actor discovery failed, using fallback catalog only:", err);
  }

  let systemPrompt = buildPipelinePlannerPrompt(discoveredActors);

  // Inject advanced settings into prompt
  if (advanced_settings) {
    const maxResults = advanced_settings.max_results_per_source || 2500;
    const dateRange = advanced_settings.date_range || "past_week";
    const strictness = advanced_settings.ai_strictness || "medium";

    const dateMap: Record<string, string> = {
      past_24h: "past 24 hours only",
      past_week: "past week",
      past_2_weeks: "past 2 weeks",
      past_month: "past month",
    };

    const strictnessMap: Record<string, string> = {
      low: "Be lenient with filtering — accept borderline matches. Use expected_pass_rate of 0.30-0.50 for AI filter stages.",
      medium: "Use balanced filtering. Use expected_pass_rate of 0.15-0.30 for AI filter stages.",
      high: "Be very strict with filtering — only accept strong matches. Use expected_pass_rate of 0.05-0.15 for AI filter stages. Write very specific rejection criteria.",
    };

    systemPrompt += `\n\n## USER PREFERENCES (OVERRIDE DEFAULTS)\n`;
    systemPrompt += `- Maximum results per source in stage 1: ${maxResults} (cap all count/limit/maxItems/maxCrawledPlacesPerSearch params to this value)\n`;
    systemPrompt += `- Date range: ${dateMap[dateRange] || "past week"}\n`;
    systemPrompt += `- Filtering strictness: ${strictnessMap[strictness] || strictnessMap.medium}\n`;
  }

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

  // Ensure it has pipeline format
  if (!parsedPlan.pipeline) {
    if (Array.isArray(parsedPlan)) {
      parsedPlan = {
        signal_name: parsedPlan[0]?.signal_name || "Signal",
        pipeline: parsedPlan.map((p: any, i: number) => ({
          stage: i + 1,
          name: p.signal_name || `Stage ${i + 1}`,
          type: "scrape",
          actors: [p.source],
          params_per_actor: { [p.source]: p.search_params },
          input_from: null,
          search_query: p.search_query,
          dedup_after: true,
          expected_output_count: p.estimated_rows || 1000,
        })),
      };
    } else {
      throw new Error("AI returned unexpected format. Please try again.");
    }
  }

  // Validate actor keys in pipeline (allow discovered actors too)
  const allKnownKeys = new Set([
    ...FALLBACK_ACTOR_CATALOG.map(a => a.key),
    ...discoveredActors.map(a => a.key),
  ]);
  for (const stage of parsedPlan.pipeline) {
    if (stage.type === "scrape" && stage.actors) {
      stage.actors = stage.actors.map((key: string) => {
        if (!allKnownKeys.has(key) && !getActor(key)) {
          console.warn(`Unknown actor "${key}" in pipeline, falling back to google_search`);
          return "google_search";
        }
        return key;
      });
    }
  }

  // Force disable splitByLocation for LinkedIn Jobs
  for (const stage of parsedPlan.pipeline) {
    if (stage.params_per_actor?.linkedin_jobs?.splitByLocation === true) {
      stage.params_per_actor.linkedin_jobs.splitByLocation = false;
      delete stage.params_per_actor.linkedin_jobs.splitCountry;
    }
  }

  // Apply advanced settings caps to stage 1 actor params
  if (advanced_settings?.max_results_per_source) {
    const maxCap = advanced_settings.max_results_per_source;
    const capFields = ["count", "limit", "maxItems", "maxCrawledPlacesPerSearch", "maxResults"];
    for (const stage of parsedPlan.pipeline) {
      if (stage.stage === 1 && stage.type === "scrape" && stage.params_per_actor) {
        for (const actorKey of Object.keys(stage.params_per_actor)) {
          const actorParams = stage.params_per_actor[actorKey];
          for (const field of capFields) {
            if (actorParams[field] !== undefined && actorParams[field] > maxCap) {
              actorParams[field] = maxCap;
            }
          }
        }
        if (stage.expected_output_count && stage.expected_output_count > maxCap * 2) {
          stage.expected_output_count = maxCap * ((stage.actors || []).length || 1);
        }
      }
    }
  }

  // Apply date range to actor params
  if (advanced_settings?.date_range) {
    const dateMap: Record<string, { linkedin: string; indeed: string }> = {
      past_24h: { linkedin: "r86400", indeed: "1" },
      past_week: { linkedin: "r604800", indeed: "7" },
      past_2_weeks: { linkedin: "r1209600", indeed: "14" },
      past_month: { linkedin: "r2592000", indeed: "14" },
    };
    const dateCfg = dateMap[advanced_settings.date_range];
    if (dateCfg) {
      for (const stage of parsedPlan.pipeline) {
        if (stage.stage === 1 && stage.type === "scrape" && stage.params_per_actor) {
          if (stage.params_per_actor.linkedin_jobs?.urls) {
            stage.params_per_actor.linkedin_jobs.urls = stage.params_per_actor.linkedin_jobs.urls.map(
              (url: string) => url.replace(/f_TPR=r\d+/, `f_TPR=${dateCfg.linkedin}`)
            );
          }
          if (stage.params_per_actor.indeed_jobs) {
            stage.params_per_actor.indeed_jobs.datePosted = dateCfg.indeed;
          }
        }
      }
    }
  }

  // Step 2: Validate data flow and auto-fix
  const dataFlowResult = validateDataFlow(parsedPlan.pipeline);
  if (!dataFlowResult.valid) {
    console.log("Data flow issues detected and fixed:", dataFlowResult.issues);
    parsedPlan.pipeline = dataFlowResult.fixedPipeline;
  }

  // Validate and warn
  const warnings = validatePipelinePlan(parsedPlan, query);

  // Cost estimation
  const { totalCredits, totalEstimatedRows, totalEstimatedLeads, stageFunnel } = estimatePipelineCost(parsedPlan.pipeline);
  const costPerLead = totalEstimatedLeads > 0 ? (totalCredits / totalEstimatedLeads).toFixed(1) : "N/A";

  const signalName = parsedPlan.signal_name || "Signal";
  const pipelineStageCount = parsedPlan.pipeline.length;

  const allActors = new Set<string>();
  for (const stage of parsedPlan.pipeline) {
    if (stage.actors) stage.actors.forEach((a: string) => allActors.add(a));
  }
  const sourceLabels = [...allActors].map(k => getActor(k)?.label || k);

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
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
