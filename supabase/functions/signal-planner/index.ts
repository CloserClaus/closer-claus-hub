import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    actorId: "curious_coder/linkedin-jobs-scraper",
    label: "LinkedIn Jobs",
    category: "hiring_intent",
    description: "Scrapes LinkedIn job postings. Best for hiring intent signals. Returns company name, website, LinkedIn URL, employee count, industry.",
    inputSchema: {
      urls:              { type: "string[]", required: true, description: "LinkedIn job search URLs" },
      count:             { type: "number",  default: 2500, description: "Max job listings" },
      scrapeCompany:     { type: "boolean", default: true, description: "Include company details" },
      splitByLocation:   { type: "boolean", default: false, description: "Split by location to bypass 1000-result cap" },
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
  },
  {
    key: "indeed_jobs",
    actorId: "valig/indeed-jobs-scraper",
    label: "Indeed Jobs",
    category: "hiring_intent",
    description: "Scrapes Indeed job postings. Broader coverage than LinkedIn. Output has nested structure (employer.name, location.city).",
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
  },

  // ── Local Business ──
  {
    key: "google_maps",
    actorId: "nwua9Gu5YrADL7ZDj",
    label: "Google Maps",
    category: "local_business",
    description: "Scrapes Google Maps places. Best for local businesses, agencies, service providers. Returns phone, website, reviews.",
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
    description: "Scrapes Yelp business listings. Good for local service businesses with review data.",
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
    description: "Scrapes Yellow Pages US listings.",
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
    description: "Scrapes LinkedIn company profiles. Returns employee count, industry, headquarters, website. Use for enrichment after discovery.",
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
    description: "Crawls company websites to extract text content (about pages, team pages). Use for AI verification of company type/industry. Returns page text content.",
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
    description: "Searches LinkedIn for people by title at specific companies. Use for finding decision makers (CEO, Founder, Owner) at qualified companies. Input is LinkedIn search URLs.",
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
    description: "Extracts emails, phone numbers, social media profiles from company websites. Use as the final stage to get contact details.",
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
    description: "Scrapes Google Search results. Good for finding specific types of companies via targeted Google queries.",
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

// ════════════════════════════════════════════════════════════════
// ██  BUILD PIPELINE PLANNER SYSTEM PROMPT
// ════════════════════════════════════════════════════════════════

function buildPipelinePlannerPrompt(): string {
  const catalogDescription = ACTOR_CATALOG.map((actor, idx) => {
    const params = Object.entries(actor.inputSchema)
      .map(([name, s]) => {
        let desc = `${name} (${s.type}${s.required ? ", REQUIRED" : ""})`;
        if (s.default !== undefined) desc += ` [default: ${JSON.stringify(s.default)}]`;
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

  return `You are a lead generation pipeline architect. Given a user's description of leads they want to find, you design a MULTI-STAGE PIPELINE that mimics how a human researcher would find those leads step by step.

## CONCEPT

A pipeline is an ordered sequence of stages. Each stage either:
1. **scrape** — Uses an Apify actor to discover or enrich data
2. **ai_filter** — Uses AI to evaluate each lead against criteria and remove non-matches

Stages execute sequentially. Each stage operates on the SURVIVING leads from the previous stage. Later scrape stages use fields from existing leads as input (e.g., using company_linkedin_url found in stage 1 as input to the linkedin_companies actor in stage 3).

## AVAILABLE ACTORS

${catalogDescription}

## PIPELINE STAGE SCHEMA

Each stage in the pipeline array must follow this structure:

For "scrape" stages:
{
  "stage": <number>,
  "name": "<human-readable stage name>",
  "type": "scrape",
  "actors": ["<actor_key>"],  // one or more actor keys from catalog
  "params_per_actor": { "<actor_key>": { <input params> } },
  "input_from": "<field_name>" | null,  // which lead field provides input for this actor (null for stage 1)
  "search_titles": ["CEO", "Founder"],  // only for linkedin_people actor — titles to search for
  "dedup_after": true|false,  // whether to dedup leads after this stage
  "updates_fields": ["field1", "field2"],  // which lead fields this stage populates/updates
  "search_query": "keyword OR keyword2",  // the search term (for stage 1 discovery actors)
  "expected_output_count": <number>  // estimated leads produced
}

For "ai_filter" stages:
{
  "stage": <number>,
  "name": "<human-readable stage name>",
  "type": "ai_filter",
  "prompt": "<classification prompt for AI>",
  "input_fields": ["company_name", "website", "industry"],  // which lead fields the AI should evaluate
  "expected_pass_rate": 0.20  // estimated fraction of leads that pass
}

## PIPELINE DESIGN RULES

1. **Stage 1 is always discovery** — Use job boards (linkedin_jobs + indeed_jobs for hiring intent), Google Maps (for local businesses), or Google Search (for web discovery). For hiring intent queries, ALWAYS use BOTH linkedin_jobs AND indeed_jobs as actors in stage 1.

2. **AI filter stages come after discovery** — Use these to narrow by company type, industry, or size BEFORE expensive enrichment. The AI prompt should be specific about what to accept/reject.

3. **Company enrichment comes after filtering** — Use linkedin_companies to get headcount, industry, HQ. Only after the AI has filtered out obvious non-matches.

4. **Headcount/size filtering uses AI** — After getting employee counts from linkedin_companies, use an ai_filter to check if the company meets size criteria.

5. **Person-finding is near-last** — Use linkedin_people ONLY on qualified companies to find decision makers by title.

6. **Contact enrichment is ALWAYS the last scrape stage** — Use contact_enrichment to get email/phone from company websites.

7. **input_from** tells the processor which field from existing leads to use as actor input:
   - "company_linkedin_url" → uses each lead's LinkedIn company URL as input for linkedin_companies
   - "website" → uses each lead's website URL as input for website_crawler or contact_enrichment
   - "company_linkedin_url" for linkedin_people → constructs LinkedIn people search URLs from company URLs
   - null for stage 1 (uses the search_query directly)

8. **search_query** supports OR syntax: "SDR OR BDR OR Sales Rep". Each keyword becomes a separate search.

9. **Set high limits** — Stage 1 should use max defaults (2500 for LinkedIn, 1000 for Indeed, 2000 for Google Maps). Downstream filtering is aggressive.

10. **For LinkedIn Jobs**, always include splitByLocation: true and splitCountry in params to bypass the 1000-result cap.

11. **website_crawler** is optional — Use it when the AI needs to verify company type from website content (e.g., "is this actually a marketing agency?"). Skip it for simple queries where company name + industry are sufficient.

## EXAMPLE PIPELINES

### Example 1: "Marketing agencies (1-10 employees) hiring sales reps"
{
  "signal_name": "Marketing agencies hiring sales reps",
  "pipeline": [
    {
      "stage": 1, "name": "Discover companies hiring sales reps",
      "type": "scrape", "actors": ["linkedin_jobs", "indeed_jobs"],
      "params_per_actor": {
        "linkedin_jobs": { "urls": ["https://www.linkedin.com/jobs/search/?keywords=sales%20representative&location=United%20States&f_TPR=r604800"], "count": 2500, "scrapeCompany": true, "splitByLocation": true, "splitCountry": "US" },
        "indeed_jobs": { "title": "sales representative", "location": "United States", "limit": 1000, "datePosted": "7" }
      },
      "input_from": null, "dedup_after": true,
      "search_query": "sales representative OR sales rep OR account executive",
      "expected_output_count": 3000
    },
    {
      "stage": 2, "name": "Filter to marketing/advertising agencies",
      "type": "ai_filter",
      "prompt": "Based on the company name, website domain, and industry, is this company a marketing agency, advertising agency, digital agency, creative agency, or PR firm? Reject large enterprises (Google, Meta, Amazon), hospitals, retailers, and companies clearly in other industries. Accept only companies whose primary business is marketing/advertising services.",
      "input_fields": ["company_name", "website", "industry", "employee_count"],
      "expected_pass_rate": 0.15
    },
    {
      "stage": 3, "name": "Get company details from LinkedIn",
      "type": "scrape", "actors": ["linkedin_companies"],
      "params_per_actor": { "linkedin_companies": { "maxResults": 500 } },
      "input_from": "company_linkedin_url",
      "updates_fields": ["employee_count", "industry", "website", "city", "state", "country"],
      "expected_output_count": 450
    },
    {
      "stage": 4, "name": "Filter to 1-10 employees",
      "type": "ai_filter",
      "prompt": "Does this company have between 1 and 10 employees based on the employee_count field? If employee_count is missing or unclear, check if other indicators suggest a small company. Reject companies with more than 10 employees.",
      "input_fields": ["company_name", "employee_count", "industry"],
      "expected_pass_rate": 0.30
    },
    {
      "stage": 5, "name": "Find decision makers (CEO/Founder/Owner)",
      "type": "scrape", "actors": ["linkedin_people"],
      "params_per_actor": { "linkedin_people": { "count": 50 } },
      "input_from": "company_linkedin_url",
      "search_titles": ["CEO", "Founder", "Owner", "Managing Director", "Principal"],
      "updates_fields": ["contact_name", "title", "linkedin_profile_url"],
      "expected_output_count": 100
    },
    {
      "stage": 6, "name": "Get contact information",
      "type": "scrape", "actors": ["contact_enrichment"],
      "params_per_actor": { "contact_enrichment": { "maxRequestsPerStartUrl": 5, "maxDepth": 2, "sameDomain": true, "mergeContacts": true } },
      "input_from": "website",
      "updates_fields": ["email", "phone"],
      "expected_output_count": 100
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
        "linkedin_jobs": { "urls": ["https://www.linkedin.com/jobs/search/?keywords=SaaS%20sales&location=United%20States&f_TPR=r604800"], "count": 2500, "scrapeCompany": true, "splitByLocation": true, "splitCountry": "US" },
        "indeed_jobs": { "title": "SaaS sales", "location": "United States", "limit": 1000, "datePosted": "7" }
      },
      "input_from": null, "dedup_after": true,
      "search_query": "SaaS sales OR SaaS account executive OR SaaS BDR",
      "expected_output_count": 3000
    },
    {
      "stage": 2, "name": "Filter to SaaS/software companies",
      "type": "ai_filter",
      "prompt": "Is this company a SaaS company or software company? Look at company name, website domain, and industry. Accept software, technology, and SaaS companies. Reject staffing agencies, consulting firms, and non-tech companies that happen to be hiring for tech roles.",
      "input_fields": ["company_name", "website", "industry"],
      "expected_pass_rate": 0.25
    },
    {
      "stage": 3, "name": "Get company details from LinkedIn",
      "type": "scrape", "actors": ["linkedin_companies"],
      "params_per_actor": { "linkedin_companies": { "maxResults": 500 } },
      "input_from": "company_linkedin_url",
      "updates_fields": ["employee_count", "industry", "website", "city", "state", "country"],
      "expected_output_count": 750
    },
    {
      "stage": 4, "name": "Filter to 50+ employees",
      "type": "ai_filter",
      "prompt": "Does this company have 50 or more employees based on the employee_count field? Accept if employee_count >= 50. If employee_count is missing, reject.",
      "input_fields": ["company_name", "employee_count"],
      "expected_pass_rate": 0.40
    },
    {
      "stage": 5, "name": "Find VP Sales / CRO / Head of Sales",
      "type": "scrape", "actors": ["linkedin_people"],
      "params_per_actor": { "linkedin_people": { "count": 50 } },
      "input_from": "company_linkedin_url",
      "search_titles": ["VP Sales", "CRO", "Chief Revenue Officer", "Head of Sales", "Director of Sales"],
      "updates_fields": ["contact_name", "title", "linkedin_profile_url"],
      "expected_output_count": 200
    },
    {
      "stage": 6, "name": "Get contact information",
      "type": "scrape", "actors": ["contact_enrichment"],
      "params_per_actor": { "contact_enrichment": { "maxRequestsPerStartUrl": 5, "maxDepth": 2, "sameDomain": true, "mergeContacts": true } },
      "input_from": "website",
      "updates_fields": ["email", "phone"],
      "expected_output_count": 200
    }
  ]
}

### Example 4: "Dental clinics in California not running Google Ads"
{
  "signal_name": "Dental clinics in California",
  "pipeline": [
    {
      "stage": 1, "name": "Find dental clinics in California",
      "type": "scrape", "actors": ["google_maps", "yelp"],
      "params_per_actor": {
        "google_maps": { "searchStringsArray": ["dentist", "dental clinic", "dental office"], "maxCrawledPlacesPerSearch": 2000, "locationQuery": "California" },
        "yelp": { "searchTerms": ["dentist", "dental clinic"], "locations": ["California"], "maxItems": 1000 }
      },
      "input_from": null, "dedup_after": true,
      "search_query": "dentist OR dental clinic OR dental office",
      "expected_output_count": 3000
    },
    {
      "stage": 2, "name": "Get contact information",
      "type": "scrape", "actors": ["contact_enrichment"],
      "params_per_actor": { "contact_enrichment": { "maxRequestsPerStartUrl": 5, "maxDepth": 2, "sameDomain": true, "mergeContacts": true } },
      "input_from": "website",
      "updates_fields": ["email", "phone"],
      "expected_output_count": 3000
    }
  ]
}

### Example 5: "E-commerce brands selling supplements" (web discovery)
{
  "signal_name": "Supplement e-commerce brands",
  "pipeline": [
    {
      "stage": 1, "name": "Search for supplement brands",
      "type": "scrape", "actors": ["google_search"],
      "params_per_actor": { "google_search": { "queries": ["supplement brand shopify", "supplement e-commerce brand", "online supplement store"], "maxPagesPerQuery": 10, "resultsPerPage": 10 } },
      "input_from": null, "dedup_after": true,
      "search_query": "supplement brand shopify OR supplement e-commerce brand OR online supplement store",
      "expected_output_count": 300
    },
    {
      "stage": 2, "name": "Verify these are supplement brands",
      "type": "ai_filter",
      "prompt": "Based on the company name and website domain, is this an e-commerce brand that sells nutritional supplements, vitamins, or health products? Reject blogs, review sites, directories, and non-supplement companies.",
      "input_fields": ["company_name", "website", "description"],
      "expected_pass_rate": 0.30
    },
    {
      "stage": 3, "name": "Find founders/owners",
      "type": "scrape", "actors": ["contact_enrichment"],
      "params_per_actor": { "contact_enrichment": { "maxRequestsPerStartUrl": 5, "maxDepth": 2, "sameDomain": true, "mergeContacts": true } },
      "input_from": "website",
      "updates_fields": ["email", "phone", "contact_name"],
      "expected_output_count": 90
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

When designing the person-finding stage, select decision maker titles based on the target company size and the user's offer:
- **Small companies (1-20 employees)**: CEO, Founder, Owner, Managing Director
- **Medium companies (20-200 employees)**: VP of [relevant dept], Director of [relevant dept], Head of [relevant dept]
- **Large companies (200+ employees)**: C-suite or VP level in the relevant department

The titles should match who would buy what the user is selling. If the user sells marketing services, target marketing decision makers. If selling to small agencies, target owners/founders.

## CRITICAL RULES

- ALWAYS include a contact_enrichment stage as the last scrape stage
- For hiring intent, ALWAYS use BOTH linkedin_jobs AND indeed_jobs in stage 1
- For local businesses, ALWAYS use google_maps (optionally add yelp)
- Use linkedin_people for person-finding ONLY when company_linkedin_url will be available from earlier stages
- AI filter prompts must be SPECIFIC — tell the AI exactly what to accept and reject
- Set high max limits for stage 1 actors (2500 LinkedIn, 1000 Indeed, 2000 Google Maps)
- Include dedup_after: true for stage 1 (discovery stages)
- The linkedin_people stage should have search_titles appropriate to the company size and user's needs`;
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

  // Check for hiring intent using wrong sources
  const hiringKeywords = ["hiring", "hire", "recruit", "job", "position", "role", "vacancy", "opening", "sdr", "bdr", "sales rep"];
  const queryLower = query.toLowerCase();
  const mentionsHiring = hiringKeywords.some(k => queryLower.includes(k));
  const stage1Actors = pipeline[0]?.actors || [];
  const usesJobSources = stage1Actors.some((a: string) => a === "linkedin_jobs" || a === "indeed_jobs");
  if (mentionsHiring && !usesJobSources) {
    warnings.push("💡 Your query mentions hiring intent, but the pipeline doesn't use job board sources (LinkedIn/Indeed). These are much better for finding companies that are actively hiring.");
  }

  // Check for unscrappable data
  const unscrappablePatterns = [
    { pattern: /funding|raised|series [a-z]|venture capital|investor/i, msg: "Funding data isn't directly scrappable. The pipeline uses hiring activity as a proxy — companies that just raised often start hiring aggressively." },
    { pattern: /revenue|income|profit|financial/i, msg: "Revenue data isn't directly available. Employee count and hiring activity are used as proxy indicators." },
  ];
  for (const { pattern, msg } of unscrappablePatterns) {
    if (pattern.test(query)) {
      warnings.push(`ℹ️ ${msg}`);
      break;
    }
  }

  // Check if pipeline has person-finding stage
  const hasPersonStage = pipeline.some((s: any) => s.type === "scrape" && s.actors?.includes("linkedin_people"));
  if (!hasPersonStage && pipeline.length >= 3) {
    // It's fine for short pipelines (local business) to skip person-finding
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
        // Discovery stage: estimate from actor defaults and keywords
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
        // Enrichment stages: count stays roughly the same (they enrich, not filter)
        currentCount = stage.expected_output_count || currentCount;
      }

      // Cost: scrape cost based on count (~$1/1000 actual Apify cost, 4x markup)
      const scrapeCostUsd = (currentCount / 1000) * 1.0;
      const chargedPriceUsd = scrapeCostUsd * 4;
      totalCredits += Math.max(2, Math.ceil(chargedPriceUsd * 5));
    } else if (stage.type === "ai_filter") {
      const passRate = stage.expected_pass_rate || 0.20;
      const aiCostUsd = currentCount * 0.001;
      totalCredits += Math.max(1, Math.ceil(aiCostUsd * 4 * 5));
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
  params: { query: string; workspace_id: string; plan_override?: any },
  userId: string,
  serviceClient: any
) {
  const { query, workspace_id } = params;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const systemPrompt = buildPipelinePlannerPrompt();

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
    // Legacy format from AI — wrap it
    if (Array.isArray(parsedPlan)) {
      // Old flat array format — convert to pipeline
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

  // Validate actor keys in pipeline
  for (const stage of parsedPlan.pipeline) {
    if (stage.type === "scrape" && stage.actors) {
      stage.actors = stage.actors.map((key: string) => {
        if (!getActor(key)) {
          console.warn(`Unknown actor "${key}" in pipeline, falling back to google_search`);
          return "google_search";
        }
        return key;
      });
    }
  }

  // Validate and warn
  const warnings = validatePipelinePlan(parsedPlan, query);

  // Cost estimation
  const { totalCredits, totalEstimatedRows, totalEstimatedLeads, stageFunnel } = estimatePipelineCost(parsedPlan.pipeline);
  const costPerLead = totalEstimatedLeads > 0 ? (totalCredits / totalEstimatedLeads).toFixed(1) : "N/A";

  const signalName = parsedPlan.signal_name || "Signal";
  const pipelineStageCount = parsedPlan.pipeline.length;

  // Build source label from unique actors
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
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
