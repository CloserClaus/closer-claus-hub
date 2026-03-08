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

// ════════════════════════════════════════════════════════════════
// ██  STAGE CATEGORIES — Abstract registry (no hardcoded actor IDs)
// ════════════════════════════════════════════════════════════════

interface StageCategory {
  category: string;
  subCategory: string;
  label: string;
  searchTerms: string[];
  expectedInputs: Record<string, string>;
  expectedOutputs: string[];
}

const STAGE_CATEGORIES: Record<string, StageCategory> = {
  "local_business:google_maps": {
    category: "local_business",
    subCategory: "local_business:google_maps",
    label: "Google Maps Places Scraper",
    searchTerms: ["google maps scraper", "google places scraper"],
    expectedInputs: {
      searchStringsArray: "Search queries (e.g. 'plumbers Austin TX')",
      maxCrawledPlacesPerSearch: "Max results per search query",
      language: "Language code",
      countryCode: "Country code (e.g. 'us')",
    },
    expectedOutputs: ["company_name", "website", "phone", "email", "location", "city", "state", "country", "industry", "description"],
  },
  "local_business:yelp": {
    category: "local_business",
    subCategory: "local_business:yelp",
    label: "Yelp Business Scraper",
    searchTerms: ["yelp scraper", "yelp business scraper"],
    expectedInputs: {
      searchTerms: "Search terms",
      location: "Location (e.g. 'Austin, TX')",
      maxItems: "Max results",
    },
    expectedOutputs: ["company_name", "website", "phone", "location", "city", "state", "country", "industry", "description"],
  },
  "hiring_intent:indeed": {
    category: "hiring_intent",
    subCategory: "hiring_intent:indeed",
    label: "Indeed Job Scraper",
    searchTerms: ["indeed scraper", "indeed job scraper"],
    expectedInputs: {
      position: "Job title/position to search",
      location: "Location (e.g. 'Austin, TX')",
      country: "Country code",
      maxItems: "Max results",
    },
    expectedOutputs: ["company_name", "title", "location", "website", "description", "salary"],
  },
  "hiring_intent:linkedin": {
    category: "hiring_intent",
    subCategory: "hiring_intent:linkedin",
    label: "LinkedIn Jobs Scraper",
    searchTerms: ["linkedin jobs scraper", "linkedin job search scraper"],
    expectedInputs: {
      urls: "LinkedIn job search URLs",
      startUrls: "Start URLs for crawling",
      maxItems: "Max results",
    },
    expectedOutputs: ["company_name", "title", "location", "linkedin", "website", "description", "industry", "employee_count"],
  },
  "hiring_intent:glassdoor": {
    category: "hiring_intent",
    subCategory: "hiring_intent:glassdoor",
    label: "Glassdoor Job Scraper",
    searchTerms: ["glassdoor scraper", "glassdoor job scraper"],
    expectedInputs: {
      keyword: "Job keyword",
      location: "Location",
      maxItems: "Max results",
    },
    expectedOutputs: ["company_name", "title", "location", "industry", "salary", "website", "description", "employee_count"],
  },
  "people_data:linkedin": {
    category: "people_data",
    subCategory: "people_data:linkedin",
    label: "LinkedIn People Search",
    searchTerms: ["linkedin people scraper", "linkedin profile scraper", "linkedin people search"],
    expectedInputs: {
      searchUrl: "LinkedIn people search URL",
      urls: "Search URLs",
      startUrls: "Start URLs",
      maxItems: "Max results",
    },
    expectedOutputs: ["contact_name", "title", "linkedin_profile", "company_name", "location", "city", "country"],
  },
  "company_data:linkedin": {
    category: "company_data",
    subCategory: "company_data:linkedin",
    label: "LinkedIn Company Scraper",
    searchTerms: ["linkedin company scraper", "linkedin company profile"],
    expectedInputs: {
      urls: "LinkedIn company page URLs",
      startUrls: "Start URLs",
      maxItems: "Max results",
    },
    expectedOutputs: ["company_name", "industry", "employee_count", "website", "linkedin", "location", "city", "country", "description"],
  },
  "web_search:google": {
    category: "web_search",
    subCategory: "web_search:google",
    label: "Google Search Scraper",
    searchTerms: ["google search scraper", "google serp scraper"],
    expectedInputs: {
      queries: "Search query string",
      maxPagesPerQuery: "Pages of results per query",
      resultsPerPage: "Results per page",
      countryCode: "Country code",
      languageCode: "Language code",
    },
    expectedOutputs: ["company_name", "website", "description"],
  },
  "enrichment:contact": {
    category: "enrichment",
    subCategory: "enrichment:contact",
    label: "Website Contact Info Scraper",
    searchTerms: ["contact info scraper", "website email scraper", "contact scraper"],
    expectedInputs: {
      startUrls: "Website URLs to scrape contacts from",
      maxRequestsPerStartUrl: "Max pages per site",
    },
    expectedOutputs: ["email", "phone", "linkedin", "website", "company_name"],
  },
};

// Runtime map — populated fresh from Apify Store on every plan generation
let discoveredActorMap: Map<string, ActorEntry> = new Map();
function getActor(key: string): ActorEntry | undefined { return discoveredActorMap.get(key); }

// ════════════════════════════════════════════════════════════════
// ██  BUILD PIPELINE PLANNER PROMPT — Category-based (Logic → Flow → Category)
// ════════════════════════════════════════════════════════════════

function buildPipelinePlannerPrompt(): string {
  // Build category descriptions from STAGE_CATEGORIES
  const categoryDescriptions = Object.entries(STAGE_CATEGORIES).map(([catKey, cat]) => {
    const params = Object.entries(cat.expectedInputs)
      .map(([name, desc]) => `     ${name} — ${desc}`)
      .join("\n");
    const outputs = cat.expectedOutputs.map(f => `${f}: ✓`).join(", ");
    return `- ${catKey} (${cat.label})\n   Input params:\n${params}\n   Outputs: ${outputs}`;
  }).join("\n\n");

  return `You are a lead generation pipeline architect. You design COST-EFFECTIVE multi-stage scraping and filtering pipelines.

## YOUR REASONING PROCESS (Follow this order strictly)

### Step 1: LOGIC — What's the cheapest path to the goal?
Before designing stages, think about the most efficient approach:
- What is the NARROWEST starting point? (e.g., for "agencies hiring sales reps" → start with job boards, NOT a broad list of all agencies)
- What data do you need at the end? (company name, contact info, decision maker)
- What's the MINIMUM number of stages?
- Include your reasoning in "logic_reasoning" in your output.

### Step 2: FLOW — Design the stage sequence (DATA-AWARE)
Based on your logic, follow this pattern:
1. Discovery (scrape the narrowest source first)
2. Lightweight filter (ONLY on fields the discovery stage actually outputs)
3. Enrich (scrape websites / LinkedIn company pages to get industry, headcount, etc.)
4. Deep filter (NOW you can filter by industry, company type, headcount — because the data exists)
5. People (find decision makers)
6. Contact (get email/phone)

## AI FILTER DATA-AVAILABILITY RULES (CRITICAL — READ CAREFULLY)

An AI filter can ONLY filter on fields that prior SCRAPE stages have ACTUALLY PRODUCED. Each data source outputs specific fields:

### What each source category outputs:
- **hiring_intent (LinkedIn Jobs, Indeed, Glassdoor)** → company_name, title (job title), location, description. That's it.
  - You CAN filter: job title relevance, location, basic keyword in company name/description
  - You CANNOT filter: industry type, company size, headcount, whether it's an agency vs corporation
- **local_business (Google Maps, Yelp)** → company_name, website, phone, location, industry, description
  - You CAN filter: industry, location, business type (from description)
  - You CANNOT filter: headcount, employee_count (not provided)
- **web_search:google** → company_name, website, description (snippet)
  - You CAN filter: basic relevance from description snippet
  - You CANNOT filter: industry classification, headcount, company details
- **company_data:linkedin** → company_name, industry, employee_count, website, linkedin, location, description
  - You CAN filter: industry, employee_count, company size, company type
- **enrichment:contact** → email, phone, linkedin, website
  - Produces contact info only — no filterable company data

### Data-Aware Flow Rules:
- To filter by "is this a marketing agency?" → you MUST first scrape the company website OR company_data:linkedin, THEN filter
- To filter by employee_count/headcount → you MUST first scrape company_data:linkedin, THEN filter
- To filter by job title relevance → you CAN filter right after a hiring_intent stage
- NEVER place an AI filter that references fields not yet scraped

### CORRECT vs INCORRECT flow examples:

WRONG: LinkedIn Jobs → AI Filter "is this a marketing agency with <50 employees?" → Enrich
(LinkedIn Jobs doesn't output industry classification or employee_count — the filter has no data to work with)

RIGHT: LinkedIn Jobs → AI Filter "is the job title a sales role?" → Scrape company websites → AI Filter "is this a marketing agency?" → Scrape company LinkedIn → AI Filter "does it have <50 employees?" → People → Contact

WRONG: Indeed Jobs → AI Filter "reject if not in SaaS industry" → People
(Indeed doesn't output industry — filter would reject everything)

RIGHT: Indeed Jobs → AI Filter "is the job title relevant?" → company_data:linkedin → AI Filter "is this a SaaS company?" → People → Contact

### Step 3: STAGE CATEGORY SELECTION — Choose data source types
For each scrape stage, select a STAGE CATEGORY. The system will automatically discover and validate the best available actor for each category.

CRITICAL RULES:
- PREFER categories from the KNOWN CATEGORIES list (they have reliable, dynamically-discovered actors)
- You MAY use CUSTOM categories if no known category fits (e.g., "custom:crunchbase", "custom:facebook_pages")
- Custom categories will be resolved dynamically — slightly higher failure risk
- For custom categories, use generic params: { "query": "...", "location": "...", "maxResults": N }
- NEVER use actor keys or actor IDs — only stage categories

## KNOWN STAGE CATEGORIES (dynamically resolved — actors selected by popularity & reliability)

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
  "prompt": "<classification prompt — ONLY reference fields listed in requires_fields>",
  "input_fields": ["company_name", "website", "industry"],
  "requires_fields": ["company_name", "industry"],
  "expected_pass_rate": 0.20
}

CRITICAL: "requires_fields" declares which data fields the filter prompt depends on. Every field in requires_fields MUST have been produced by a prior scrape stage. If not, the validator will reject or auto-fix the pipeline.

## ROLE FILTER vs SEARCH QUERY (CRITICAL for hiring_intent pipelines)

When the user searches for specific job roles at companies in a particular industry:
- \`search_query\` = the INDUSTRY CONTEXT (broad or narrow, matching user intent)
- \`role_filter\` = the EXACT JOB TITLES the user wants (e.g., ["SDR", "Sales Representative"])

The processor combines role_filter titles with search_query industry context into the job search URL.

Example 1 (specific business type):
- User: "Find marketing agencies hiring SDRs"
- search_query: "marketing agency OR advertising agency"
- role_filter: ["SDR", "Sales Development Representative", "Sales Representative"]

Example 2 (broad industry):
- User: "Find companies in the marketing industry hiring sales reps"
- search_query: "marketing OR advertising OR digital marketing"
- role_filter: ["Sales Representative", "Account Executive", "Sales Manager"]

IMPORTANT: Match the user's intent breadth.
- "Companies in the marketing industry" → use broad industry terms like "marketing OR advertising"
- "Marketing agencies" → use specific business types like "marketing agency OR advertising agency"
When the user says "industry" or "companies in X", use BROAD industry terms, NOT specific business types.

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
- Filter on available data ASAP — but ONLY on fields that prior stages have actually produced. A filter on unscraped data wastes the entire pipeline.
- Total pipeline cost should be MINIMIZED

## PIPELINE DESIGN RULES

1. Start with the NARROWEST source
2. AI filter stages come after discovery — but ONLY filter on fields that the preceding scrape stages output (see DATA-AVAILABILITY RULES above)
3. Company enrichment comes AFTER lightweight filtering (e.g., job title relevance)
4. Deep filtering (industry type, headcount) comes AFTER enrichment stages that produce those fields
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
  "estimated_yield_rate": <float 0.01-0.60>,
  "pipeline": [ <array of stage objects> ],
  "infeasible_reason": null | "<explanation>"
}

## YIELD RATE ESTIMATION (CRITICAL)

You MUST estimate \`estimated_yield_rate\` — the percentage of Stage 1 records that will survive ALL filter stages to become final leads.
Base this on query specificity:
- Niche queries (e.g., "biotech companies in Vermont hiring SDRs"): 0.02-0.05
- Moderate queries (e.g., "marketing agencies hiring sales reps in the US"): 0.10-0.25
- Broad queries (e.g., "tech companies in California hiring sales reps"): 0.30-0.50

This should be the COMPOUND pass rate across all ai_filter stages. It helps users understand how many leads to expect from their scrape volume.

No markdown, no explanation, just the JSON.`;
}

// ════════════════════════════════════════════════════════════════
// ██  POST-GENERATION VALIDATION — Data Flow Check
// ════════════════════════════════════════════════════════════════

// Field alias map for normalizing field names across stages
const FIELD_ALIASES: Record<string, string[]> = {
  company_linkedin_url: ["linkedin", "company_linkedin_url", "linkedinUrl", "companyLinkedinUrl"],
  linkedin_profile_url: ["linkedin_profile", "linkedin_profile_url", "profileUrl", "linkedInProfile"],
  company_name: ["company_name", "company", "companyName", "name", "title"],
  website: ["website", "url", "companyUrl", "domain"],
  email: ["email", "emails", "contactEmail"],
  phone: ["phone", "phones", "telephone"],
  industry: ["industry", "industries", "category"],
  employee_count: ["employee_count", "employeeCount", "companySize", "staffCount"],
  contact_name: ["contact_name", "fullName", "personName"],
  location: ["location", "address", "city"],
};

// Infer what fields a stage produces based on its category and updates_fields
function inferProducedFields(stage: any): Set<string> {
  const produced = new Set<string>();

  // From explicit updates_fields
  if (stage.updates_fields) {
    for (const f of stage.updates_fields) produced.add(f);
  }

  // From stage category expected outputs
  if (stage.type === "scrape" && stage.stage_category) {
    const cat = STAGE_CATEGORIES[stage.stage_category];
    if (cat) {
      for (const field of cat.expectedOutputs) {
        produced.add(field);
      }
    }
  }

  // Expand aliases: if a stage produces "linkedin", it also produces "company_linkedin_url"
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some(a => produced.has(a))) {
      produced.add(canonical);
      for (const a of aliases) produced.add(a);
    }
  }

  return produced;
}

// Deterministic fallback: given a stage category, what field should it consume?
const FALLBACK_INPUT_FROM: Record<string, string[]> = {
  "people_data:linkedin": ["company_name", "company_linkedin_url"],
  "company_data:linkedin": ["company_linkedin_url", "company_name"],
  "enrichment:contact": ["website", "company_name"],
  "web_search:google": ["company_name"],
};

function validateDataFlow(pipeline: any[]): { valid: boolean; issues: string[]; fixedPipeline: any[] } {
  const issues: string[] = [];
  let fixedPipeline = [...pipeline];

  // ── Helper: collect all fields produced by stages [0..endIdx) ──
  function getProducedFieldsUpTo(endIdx: number): Set<string> {
    const allProduced = new Set<string>();
    for (let j = 0; j < endIdx; j++) {
      const prevStage = fixedPipeline[j];
      if (prevStage.type === "ai_filter") continue; // filters don't produce new fields
      for (const f of inferProducedFields(prevStage)) {
        allProduced.add(f);
      }
    }
    return allProduced;
  }

  // ── Pass 1: Validate AI filter stages — check requires_fields against produced data ──
  for (let i = 0; i < fixedPipeline.length; i++) {
    const stage = fixedPipeline[i];
    if (stage.type !== "ai_filter") continue;

    const requiresFields: string[] = stage.requires_fields || [];
    if (requiresFields.length === 0) continue; // no declared dependencies — skip

    const allProduced = getProducedFieldsUpTo(i);

    for (const reqField of requiresFields) {
      const reqAliases = FIELD_ALIASES[reqField] || [reqField];
      const found = reqAliases.some(a => allProduced.has(a));

      if (!found) {
        // Determine which enrichment stage could produce this field
        const enrichmentNeeded = getEnrichmentForField(reqField);
        if (enrichmentNeeded) {
          issues.push(`Stage ${stage.stage}: ai_filter requires "${reqField}" but no prior stage produces it — auto-injecting ${enrichmentNeeded.stage_category} stage before this filter`);
          
          // Inject an enrichment stage before this filter
          const newStageNum = stage.stage;
          const enrichmentStage = {
            stage: newStageNum,
            name: `Auto-enrich for ${reqField}`,
            type: "scrape",
            stage_category: enrichmentNeeded.stage_category,
            params: {},
            input_from: enrichmentNeeded.input_from,
            dedup_after: false,
            updates_fields: enrichmentNeeded.produces,
            expected_output_count: 0,
          };

          // Insert before current position and renumber all subsequent stages
          fixedPipeline.splice(i, 0, enrichmentStage);
          // Renumber stages from insertion point onward
          for (let k = i; k < fixedPipeline.length; k++) {
            fixedPipeline[k] = { ...fixedPipeline[k], stage: k + 1 };
          }
          i++; // skip past the filter we just validated (it moved forward by 1)
        } else {
          issues.push(`Stage ${stage.stage}: ai_filter requires "${reqField}" but no prior stage produces it and no enrichment source known — filter may reject everything`);
        }
      }
    }
  }

  // ── Pass 2: Validate scrape stages — check input_from ──
  for (let i = 1; i < fixedPipeline.length; i++) {
    const stage = fixedPipeline[i];
    if (stage.type !== "scrape") continue;
    if (!stage.input_from) continue;

    const inputField = stage.input_from;
    const allProduced = getProducedFieldsUpTo(i);

    // Check if input_from (or any of its aliases) is produced
    const inputAliases = FIELD_ALIASES[inputField] || [inputField];
    const found = inputAliases.some(a => allProduced.has(a));

    if (!found) {
      // Try deterministic fallback repair instead of destructive nulling
      const category = stage.stage_category || "";
      const fallbackFields = FALLBACK_INPUT_FROM[category] || 
        Object.entries(FALLBACK_INPUT_FROM).find(([k]) => category.startsWith(k.split(":")[0]))?.[1] || [];
      
      let repaired = false;
      for (const fallback of fallbackFields) {
        const fallbackAliases = FIELD_ALIASES[fallback] || [fallback];
        if (fallbackAliases.some(a => allProduced.has(a))) {
          issues.push(`Stage ${stage.stage}: input_from "${inputField}" not produced — auto-repaired to "${fallback}"`);
          fixedPipeline[i] = { ...fixedPipeline[i], input_from: fallback };
          repaired = true;
          break;
        }
      }

      if (!repaired) {
        // Last resort: check if ANY common field is available
        const commonFields = ["company_name", "website", "company_linkedin_url"];
        for (const cf of commonFields) {
          const cfAliases = FIELD_ALIASES[cf] || [cf];
          if (cfAliases.some(a => allProduced.has(a))) {
            issues.push(`Stage ${stage.stage}: input_from "${inputField}" not produced — fallback to "${cf}"`);
            fixedPipeline[i] = { ...fixedPipeline[i], input_from: cf };
            repaired = true;
            break;
          }
        }
        
        if (!repaired) {
          issues.push(`Stage ${stage.stage}: input_from "${inputField}" truly unresolvable — set to null`);
          fixedPipeline[i] = { ...fixedPipeline[i], input_from: null };
        }
      }
    }
  }

  return { valid: issues.length === 0, issues, fixedPipeline };
}

// Maps a required field to the enrichment stage category that produces it
function getEnrichmentForField(field: string): { stage_category: string; input_from: string; produces: string[] } | null {
  const fieldEnrichmentMap: Record<string, { stage_category: string; input_from: string; produces: string[] }> = {
    employee_count: { stage_category: "company_data:linkedin", input_from: "company_name", produces: ["industry", "employee_count", "website", "linkedin", "description"] },
    industry: { stage_category: "company_data:linkedin", input_from: "company_name", produces: ["industry", "employee_count", "website", "linkedin", "description"] },
    company_linkedin_url: { stage_category: "web_search:google", input_from: "company_name", produces: ["company_name", "website", "description"] },
    website: { stage_category: "web_search:google", input_from: "company_name", produces: ["company_name", "website", "description"] },
    description: { stage_category: "enrichment:contact", input_from: "website", produces: ["email", "phone", "linkedin", "website"] },
  };
  return fieldEnrichmentMap[field] || null;
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
      // Legacy format — stage already has actors[] set
      if (stage.actors && stage.actors.length > 0) continue;
      warnings.push(`Stage ${stage.stage} has no stage_category — cannot resolve actor`);
      continue;
    }

    // ── ALL categories go through dynamic discovery ──
    const stageCat = STAGE_CATEGORIES[category];
    const searchTerms = stageCat?.searchTerms || [category.replace("custom:", "").replace(/_/g, " ").replace(":", " ")];
    
    console.log(`Stage ${stage.stage}: Discovering actors for ${category} using terms: ${searchTerms.join(", ")}`);

    let discoveredForCategory: ActorEntry[] = [];
    try {
      // Try multiple search terms and merge results
      const allDiscovered: ActorEntry[] = [];
      const seenActorIds = new Set<string>();
      for (const term of searchTerms) {
        const results = await discoverActors(term, serviceClient);
        for (const actor of results) {
          if (!seenActorIds.has(actor.actorId)) {
            seenActorIds.add(actor.actorId);
            // Tag with subCategory for backup matching
            (actor as any).subCategory = stageCat?.subCategory || category;
            allDiscovered.push(actor);
          }
        }
      }
      discoveredForCategory = allDiscovered;
    } catch (err) {
      warnings.push(`Stage ${stage.stage}: Actor discovery failed for "${category}": ${err}`);
      continue;
    }

    if (discoveredForCategory.length === 0) {
      warnings.push(`Stage ${stage.stage}: No actors found for "${category}"`);
      continue;
    }

    // ── Per-actor pre-flight validation ──
    const nextStage = pipeline.find((s: any) => s.stage === stage.stage + 1);
    const nextRequiredFields = nextStage?.input_from ? [nextStage.input_from] : [];

    let preflightPassed = false;
    for (const candidate of discoveredForCategory.slice(0, 3)) {
      const result = await preflightValidateActor(candidate, stage, nextRequiredFields, APIFY_API_TOKEN);
      if (result.passed) {
        actorRegistry[candidate.key] = candidate;
        stage.actors = [candidate.key];
        if (stage.params && !stage.params_per_actor) {
          stage.params_per_actor = { [candidate.key]: stage.params };
        }
        console.log(`Stage ${stage.stage}: Pre-flight PASSED for ${candidate.actorId} (users: ${candidate.monthlyUsers}, runs: ${candidate.totalRuns}, rating: ${candidate.rating})`);
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
        // Add remaining as backups
        for (const backup of discoveredForCategory.filter(a => a.key !== fallback.key).slice(0, 2)) {
          actorRegistry[backup.key] = { ...backup, _isBackup: true, _backupForSubCategory: (fallback as any).subCategory || fallback.category } as any;
        }
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

    // Check minimum field coverage against category's expected outputs
    const stageCat = STAGE_CATEGORIES[stageDef.stage_category];
    if (stageCat) {
      const expectedFields = stageCat.expectedOutputs;
      const coveredCount = expectedFields.filter(f => {
        const aliases = FIELD_ALIASES[f] || [f];
        return aliases.some(a => populatedFields.has(a));
      }).length;
      const coverageRatio = coveredCount / expectedFields.length;
      if (coverageRatio < 0.3) {
        return {
          passed: false,
          reason: `Output covers only ${Math.round(coverageRatio * 100)}% of expected fields (${coveredCount}/${expectedFields.length})`,
          outputFields: [...populatedFields],
        };
      }
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

    const body = await req.json();
    const action = body.action || "generate_plan";

    // Extract user ID from auth header or body
    let userId = body.user_id || "anonymous";
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const { data: { user } } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
      if (user?.id) userId = user.id;
    }

    if (action === "generate_plan") {
      return await handleGeneratePlan(body, userId, supabaseClient);
    }

    if (action === "check_plan_status") {
      return await handleCheckPlanStatus(body, supabaseClient);
    }

    if (action === "advance_plan") {
      return await handleCheckPlanStatus(body, supabaseClient);
    }

    if (action === "execute_signal") {
      return await handleExecuteSignal(body, supabaseClient);
    }

    if (action === "dry_run") {
      return await handleDryRun(body, supabaseClient);
    }

    return new Response(JSON.stringify({ error: "Unknown action: " + action }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : (typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err));
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ════════════════════════════════════════════════════════════════
// ██  EXECUTE SIGNAL (queue a planned run)
// ════════════════════════════════════════════════════════════════

async function handleExecuteSignal(
  body: { run_id: string; workspace_id: string; schedule_type?: string; schedule_hour?: number },
  serviceClient: any
) {
  const { run_id, workspace_id, schedule_type, schedule_hour } = body;
  if (!run_id || !workspace_id) {
    return new Response(JSON.stringify({ error: "run_id and workspace_id are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: run, error: fetchErr } = await serviceClient
    .from("signal_runs")
    .select("*")
    .eq("id", run_id)
    .eq("workspace_id", workspace_id)
    .single();

  if (fetchErr || !run) {
    return new Response(JSON.stringify({ error: "Signal run not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (run.status !== "planned") {
    return new Response(JSON.stringify({ error: `Cannot execute run in status: ${run.status}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const estimatedCredits = run.signal_plan?.estimated_credits || 10;
  const { data: credits, error: credErr } = await serviceClient
    .from("lead_credits")
    .select("credits_balance")
    .eq("workspace_id", workspace_id)
    .single();

  if (credErr || !credits) {
    return new Response(JSON.stringify({ error: "Could not fetch credit balance" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (credits.credits_balance < estimatedCredits) {
    return new Response(JSON.stringify({ error: "Insufficient lead credits", required: estimatedCredits, available: credits.credits_balance }), {
      status: 402,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: deductErr } = await serviceClient
    .from("lead_credits")
    .update({ credits_balance: credits.credits_balance - estimatedCredits })
    .eq("workspace_id", workspace_id);

  if (deductErr) {
    return new Response(JSON.stringify({ error: "Failed to deduct credits" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const updatePayload: any = { status: "queued", updated_at: new Date().toISOString() };
  if (schedule_type) updatePayload.schedule_type = schedule_type;
  if (schedule_hour !== undefined) updatePayload.schedule_hour = schedule_hour;

  const { error: updateErr } = await serviceClient
    .from("signal_runs")
    .update(updatePayload)
    .eq("id", run_id);

  if (updateErr) {
    return new Response(JSON.stringify({ error: "Failed to queue run" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`Signal run ${run_id} queued. Deducted ${estimatedCredits} credits.`);

  return new Response(JSON.stringify({ status: "queued", run_id, credits_deducted: estimatedCredits }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}


// ════════════════════════════════════════════════════════════════
// ██  CHECK PLAN STATUS — State machine for validate-as-you-build
// ════════════════════════════════════════════════════════════════

async function handleCheckPlanStatus(
  body: { run_id: string; workspace_id?: string },
  serviceClient: any
) {
  const { run_id } = body;
  if (!run_id) {
    return new Response(JSON.stringify({ error: "run_id is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: run, error: fetchErr } = await serviceClient
    .from("signal_runs").select("*").eq("id", run_id).single();

  if (fetchErr || !run) {
    return new Response(JSON.stringify({ error: "Signal run not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // If already validated or not in planning, return current state
  if (run.status !== "planning") {
    return new Response(JSON.stringify({
      run_id, status: run.status, phase: run.plan_phase || "done",
      plan: run.signal_plan, estimation: null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const plan = run.signal_plan;
  if (!plan || !plan.pipeline) {
    return new Response(JSON.stringify({ error: "No pipeline plan found" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const phase = run.plan_phase || "plan_generating";
  const pipeline = plan.pipeline;

  // ── Phase Router ──
  const phaseMatch = phase.match(/plan_validating_stage_(\d+)/);
  const testMatch = phase.match(/plan_testing_stage_(\d+)/);

  if (phaseMatch) {
    const stageNum = parseInt(phaseMatch[1], 10);
    return await handlePlanValidatingStage(run, plan, pipeline, stageNum, serviceClient);
  }

  if (testMatch) {
    const stageNum = parseInt(testMatch[1], 10);
    return await handlePlanTestingStage(run, plan, pipeline, stageNum, serviceClient);
  }

  if (phase === "plan_validated") {
    return await handlePlanValidated(run, plan, pipeline, serviceClient);
  }

  // Unknown phase — return current state
  return new Response(JSON.stringify({
    run_id, status: "planning", phase,
    stages: pipeline.map((s: any) => ({ stage: s.stage, name: s.name, type: s.type, status: "pending" })),
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ── Plan Validating Stage N: Discover actors, start micro test ──

async function handlePlanValidatingStage(
  run: any, plan: any, pipeline: any[], stageNum: number, serviceClient: any
) {
  const stageDef = pipeline.find((s: any) => s.stage === stageNum);
  if (!stageDef) {
    // No more stages — mark as validated
    await serviceClient.from("signal_runs").update({
      plan_phase: "plan_validated", updated_at: new Date().toISOString(),
    }).eq("id", run.id);
    return respondPlanStatus(run.id, "planning", "plan_validated", pipeline, run.plan_test_runs);
  }

  // AI filter stages don't need actor validation — auto-advance
  if (stageDef.type === "ai_filter") {
    const nextStage = pipeline.find((s: any) => s.stage === stageNum + 1);
    const nextPhase = nextStage ? `plan_validating_stage_${nextStage.stage}` : "plan_validated";
    
    const testRuns = [...(run.plan_test_runs || []), {
      stage: stageNum, name: stageDef.name, type: "ai_filter",
      status: "auto_validated", reason: "AI filter — no actor needed",
    }];
    
    await serviceClient.from("signal_runs").update({
      plan_phase: nextPhase, plan_test_runs: testRuns, updated_at: new Date().toISOString(),
    }).eq("id", run.id);
    return respondPlanStatus(run.id, "planning", nextPhase, pipeline, testRuns);
  }

  // Scrape stage — discover actors and start micro test
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) {
    return new Response(JSON.stringify({ error: "APIFY_API_TOKEN not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const category = stageDef.stage_category;
  if (!category) {
    // No category — skip validation, auto-advance
    const nextStage = pipeline.find((s: any) => s.stage === stageNum + 1);
    const nextPhase = nextStage ? `plan_validating_stage_${nextStage.stage}` : "plan_validated";
    const testRuns = [...(run.plan_test_runs || []), {
      stage: stageNum, name: stageDef.name, status: "skipped", reason: "No stage_category",
    }];
    await serviceClient.from("signal_runs").update({
      plan_phase: nextPhase, plan_test_runs: testRuns, updated_at: new Date().toISOString(),
    }).eq("id", run.id);
    return respondPlanStatus(run.id, "planning", nextPhase, pipeline, testRuns);
  }

  // Discover actors for this category
  const stageCat = STAGE_CATEGORIES[category];
  const searchTerms = stageCat?.searchTerms || [category.replace("custom:", "").replace(/_/g, " ").replace(":", " ")];
  
  let discoveredActors: ActorEntry[] = [];
  const seenActorIds = new Set<string>();
  for (const term of searchTerms) {
    const results = await discoverActors(term, serviceClient);
    for (const actor of results) {
      if (!seenActorIds.has(actor.actorId)) {
        seenActorIds.add(actor.actorId);
        (actor as any).subCategory = stageCat?.subCategory || category;
        discoveredActors.push(actor);
      }
    }
  }

  if (discoveredActors.length === 0) {
    // No actors found — skip with warning
    const nextStage = pipeline.find((s: any) => s.stage === stageNum + 1);
    const nextPhase = nextStage ? `plan_validating_stage_${nextStage.stage}` : "plan_validated";
    const testRuns = [...(run.plan_test_runs || []), {
      stage: stageNum, name: stageDef.name, status: "failed",
      reason: `No actors found for category "${category}"`,
    }];
    await serviceClient.from("signal_runs").update({
      plan_phase: nextPhase, plan_test_runs: testRuns, updated_at: new Date().toISOString(),
    }).eq("id", run.id);
    return respondPlanStatus(run.id, "planning", nextPhase, pipeline, testRuns);
  }

  // Pick top candidate and start micro test run
  const candidate = discoveredActors[0];
  await fetchAndMergeRuntimeSchema(candidate, APIFY_API_TOKEN);

  // Build test input
  const testInput = await buildMicroTestInput(candidate, stageDef, stageNum, run, plan, APIFY_API_TOKEN);
  if (!testInput.proxyConfiguration) testInput.proxyConfiguration = { useApifyProxy: true };

  // Start micro test (maxItems: 5)
  const actorIdEncoded = candidate.actorId.replace("/", "~");
  try {
    const resp = await fetch(
      `https://api.apify.com/v2/acts/${actorIdEncoded}/runs?token=${APIFY_API_TOKEN}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(testInput) }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.warn(`Micro test start failed for ${candidate.actorId}: ${errText.slice(0, 200)}`);
      
      // Try next candidate
      if (discoveredActors.length > 1) {
        const backup = discoveredActors[1];
        await fetchAndMergeRuntimeSchema(backup, APIFY_API_TOKEN);
        const backupInput = await buildMicroTestInput(backup, stageDef, stageNum, run, plan, APIFY_API_TOKEN);
        if (!backupInput.proxyConfiguration) backupInput.proxyConfiguration = { useApifyProxy: true };
        
        const backupResp = await fetch(
          `https://api.apify.com/v2/acts/${backup.actorId.replace("/", "~")}/runs?token=${APIFY_API_TOKEN}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(backupInput) }
        );
        
        if (backupResp.ok) {
          const backupRunData = await backupResp.json();
          return await saveMicroTestAndAdvance(run, stageNum, stageDef, backup, backupRunData.data, discoveredActors, serviceClient, pipeline);
        }
      }
      
      // All candidates failed — skip
      const nextStage = pipeline.find((s: any) => s.stage === stageNum + 1);
      const nextPhase = nextStage ? `plan_validating_stage_${nextStage.stage}` : "plan_validated";
      const testRuns = [...(run.plan_test_runs || []), {
        stage: stageNum, name: stageDef.name, status: "failed",
        reason: `Could not start test run for "${category}"`,
      }];
      await serviceClient.from("signal_runs").update({
        plan_phase: nextPhase, plan_test_runs: testRuns, updated_at: new Date().toISOString(),
      }).eq("id", run.id);
      return respondPlanStatus(run.id, "planning", nextPhase, pipeline, testRuns);
    }

    const runData = await resp.json();
    return await saveMicroTestAndAdvance(run, stageNum, stageDef, candidate, runData.data, discoveredActors, serviceClient, pipeline);
  } catch (err) {
    console.error(`Micro test error for stage ${stageNum}:`, err);
    const nextStage = pipeline.find((s: any) => s.stage === stageNum + 1);
    const nextPhase = nextStage ? `plan_validating_stage_${nextStage.stage}` : "plan_validated";
    const testRuns = [...(run.plan_test_runs || []), {
      stage: stageNum, name: stageDef.name, status: "failed",
      reason: `Test error: ${err instanceof Error ? err.message : String(err)}`,
    }];
    await serviceClient.from("signal_runs").update({
      plan_phase: nextPhase, plan_test_runs: testRuns, updated_at: new Date().toISOString(),
    }).eq("id", run.id);
    return respondPlanStatus(run.id, "planning", nextPhase, pipeline, testRuns);
  }
}

async function saveMicroTestAndAdvance(
  run: any, stageNum: number, stageDef: any, actor: ActorEntry, 
  apifyRun: any, allDiscovered: ActorEntry[], serviceClient: any, pipeline: any[]
) {
  const testRuns = [...(run.plan_test_runs || []), {
    stage: stageNum, name: stageDef.name, status: "testing",
    actor_id: actor.actorId, actor_key: actor.key, actor_label: actor.label,
    run_id: apifyRun.id, dataset_id: apifyRun.defaultDatasetId,
    monthly_users: actor.monthlyUsers, total_runs: actor.totalRuns, rating: actor.rating,
    backup_actors: allDiscovered.slice(1, 3).map(a => ({
      key: a.key, actorId: a.actorId, label: a.label,
      monthlyUsers: a.monthlyUsers, totalRuns: a.totalRuns, rating: a.rating,
    })),
  }];

  await serviceClient.from("signal_runs").update({
    plan_phase: `plan_testing_stage_${stageNum}`,
    plan_test_runs: testRuns,
    updated_at: new Date().toISOString(),
  }).eq("id", run.id);

  return respondPlanStatus(run.id, "planning", `plan_testing_stage_${stageNum}`, pipeline, testRuns);
}

// ── Plan Testing Stage N: Poll micro test, validate output ──

async function handlePlanTestingStage(
  run: any, plan: any, pipeline: any[], stageNum: number, serviceClient: any
) {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;
  const testRuns: any[] = [...(run.plan_test_runs || [])];
  const stageTest = testRuns.find((t: any) => t.stage === stageNum && t.status === "testing");
  
  if (!stageTest || !stageTest.run_id) {
    // No test running — advance
    const nextStage = pipeline.find((s: any) => s.stage === stageNum + 1);
    const nextPhase = nextStage ? `plan_validating_stage_${nextStage.stage}` : "plan_validated";
    await serviceClient.from("signal_runs").update({
      plan_phase: nextPhase, updated_at: new Date().toISOString(),
    }).eq("id", run.id);
    return respondPlanStatus(run.id, "planning", nextPhase, pipeline, testRuns);
  }

  // Poll the test run
  try {
    const pollResp = await fetch(
      `https://api.apify.com/v2/actor-runs/${stageTest.run_id}?token=${APIFY_API_TOKEN}`,
      { method: "GET" }
    );
    if (!pollResp.ok) {
      stageTest.status = "failed";
      stageTest.reason = "Poll failed";
    } else {
      const pollData = await pollResp.json();
      const status = pollData.data?.status;

      if (status === "RUNNING" || status === "READY") {
        // Still running — check timeout (60s for micro tests)
        const startedAt = pollData.data?.startedAt ? new Date(pollData.data.startedAt).getTime() : Date.now();
        if (Date.now() - startedAt > 60000) {
          try { await fetch(`https://api.apify.com/v2/actor-runs/${stageTest.run_id}/abort?token=${APIFY_API_TOKEN}`, { method: "POST" }); } catch {}
          stageTest.status = "failed";
          stageTest.reason = "Micro test timed out (60s)";
        } else {
          // Still running — return, next poll will check again
          await serviceClient.from("signal_runs").update({
            plan_test_runs: testRuns, updated_at: new Date().toISOString(),
          }).eq("id", run.id);
          return respondPlanStatus(run.id, "planning", `plan_testing_stage_${stageNum}`, pipeline, testRuns);
        }
      } else if (status === "SUCCEEDED") {
        // Collect results and validate
        const itemsResp = await fetch(
          `https://api.apify.com/v2/datasets/${stageTest.dataset_id}/items?token=${APIFY_API_TOKEN}&clean=true&limit=10`,
          { method: "GET" }
        );

        if (itemsResp.ok) {
          const items = await itemsResp.json();
          if (items && items.length > 0) {
            // Normalize and analyze output
            const normalised = normaliseGenericResults(null, items);
            const populatedFields = new Set<string>();
            for (const item of normalised) {
              for (const [key, value] of Object.entries(item)) {
                if (key !== "_raw" && value !== null && value !== undefined && value !== "") {
                  populatedFields.add(key);
                }
              }
            }

            stageTest.status = "validated";
            stageTest.output_fields = [...populatedFields];
            stageTest.sample_count = items.length;
            stageTest.reason = `OK — ${items.length} items, ${populatedFields.size} fields populated`;

            // Store sample output for next stage's test input
            const stageOutputs = { ...(run.plan_stage_outputs || {}), [stageNum]: normalised.slice(0, 5) };

            // Check if next stage's input_from field is covered
            const nextStageDef = pipeline.find((s: any) => s.stage === stageNum + 1);
            if (nextStageDef?.input_from) {
              const inputField = nextStageDef.input_from;
              const inputAliases = FIELD_ALIASES[inputField] || [inputField];
              const covered = inputAliases.some(a => populatedFields.has(a));
              if (!covered) {
                stageTest.chain_warning = `Next stage needs "${inputField}" but this output doesn't produce it. Fields: ${[...populatedFields].join(", ")}`;
              }
            }

            // Build actor registry entry and assign to pipeline stage
            const actorRegistry = plan.actor_registry || {};
            actorRegistry[stageTest.actor_key] = {
              key: stageTest.actor_key,
              actorId: stageTest.actor_id,
              label: stageTest.actor_label,
              category: pipeline.find((s: any) => s.stage === stageNum)?.stage_category || "",
              description: "",
              inputSchema: {},
              outputFields: {},
              monthlyUsers: stageTest.monthly_users || 0,
              totalRuns: stageTest.total_runs || 0,
              rating: stageTest.rating || 0,
            };
            // Add backup actors to registry
            for (const backup of (stageTest.backup_actors || [])) {
              actorRegistry[backup.key] = {
                ...backup, category: pipeline.find((s: any) => s.stage === stageNum)?.stage_category || "",
                description: "", inputSchema: {}, outputFields: {},
                _isBackup: true, _backupForSubCategory: pipeline.find((s: any) => s.stage === stageNum)?.stage_category,
              };
            }

            // Update the pipeline stage with resolved actor
            const stageDef = pipeline.find((s: any) => s.stage === stageNum);
            if (stageDef) {
              stageDef.actors = [stageTest.actor_key];
              if (stageDef.params && !stageDef.params_per_actor) {
                stageDef.params_per_actor = { [stageTest.actor_key]: stageDef.params };
              }
            }

            const updatedPlan = { ...plan, pipeline, actor_registry: actorRegistry };
            const nextStage = pipeline.find((s: any) => s.stage === stageNum + 1);
            const nextPhase = nextStage ? `plan_validating_stage_${nextStage.stage}` : "plan_validated";

            await serviceClient.from("signal_runs").update({
              signal_plan: updatedPlan,
              plan_phase: nextPhase,
              plan_test_runs: testRuns,
              plan_stage_outputs: stageOutputs,
              updated_at: new Date().toISOString(),
            }).eq("id", run.id);
            return respondPlanStatus(run.id, "planning", nextPhase, pipeline, testRuns);
          } else {
            stageTest.status = "failed";
            stageTest.reason = "Micro test returned 0 results";
          }
        } else {
          stageTest.status = "failed";
          stageTest.reason = "Failed to fetch test results";
        }
      } else {
        stageTest.status = "failed";
        stageTest.reason = `Test run status: ${status}`;
      }
    }
  } catch (err) {
    stageTest.status = "failed";
    stageTest.reason = `Poll error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // If we got here, the test failed — advance to next stage anyway
  const nextStage = pipeline.find((s: any) => s.stage === stageNum + 1);
  const nextPhase = nextStage ? `plan_validating_stage_${nextStage.stage}` : "plan_validated";
  await serviceClient.from("signal_runs").update({
    plan_phase: nextPhase, plan_test_runs: testRuns, updated_at: new Date().toISOString(),
  }).eq("id", run.id);
  return respondPlanStatus(run.id, "planning", nextPhase, pipeline, testRuns);
}

// ── Plan Validated: Compute cost estimate and return final plan ──

async function handlePlanValidated(run: any, plan: any, pipeline: any[], serviceClient: any) {
  // Compute cost estimation
  const estimation = estimatePipelineCost(pipeline, plan.estimated_yield_rate);
  
  // Update run with final plan
  await serviceClient.from("signal_runs").update({
    status: "planned",
    plan_phase: "plan_validated",
    estimated_cost: estimation.totalCredits,
    estimated_leads: estimation.totalEstimatedLeads,
    updated_at: new Date().toISOString(),
  }).eq("id", run.id);

  const testRuns = run.plan_test_runs || [];
  const warnings = validatePipelinePlan(plan, run.signal_query);

  return new Response(JSON.stringify({
    run_id: run.id,
    status: "planned",
    phase: "plan_validated",
    plan: plan,
    estimation: {
      estimated_rows: estimation.totalEstimatedRows,
      estimated_leads: estimation.totalEstimatedLeads,
      credits_to_charge: estimation.totalCredits,
      cost_per_lead: estimation.totalEstimatedLeads > 0
        ? `$${(estimation.totalCredits / estimation.totalEstimatedLeads * 0.20).toFixed(2)}`
        : "$0.00",
      source_label: deriveSourceLabel(pipeline),
      stage_funnel: estimation.stageFunnel,
      yield_rate: estimation.yieldRate,
      yield_label: estimation.yieldLabel,
      yield_guidance: estimation.yieldGuidance,
    },
    test_results: testRuns,
    warnings: warnings.length > 0 ? warnings : undefined,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ── Build micro test input for a stage ──

async function buildMicroTestInput(
  actor: ActorEntry, stageDef: any, stageNum: number, run: any, plan: any, token: string
): Promise<Record<string, any>> {
  const params = stageDef.params || {};
  
  if (stageNum === 1 || !stageDef.input_from) {
    // Stage 1: build from search query
    const intent = {
      roles: stageDef.role_filter || [],
      industry: stageDef.role_filter ? (stageDef.search_query || "") : "",
      location: params.location || params.searchLocation || "United States",
      dateRange: "r604800",
    };

    const platform = (() => {
      const id = actor.actorId.toLowerCase();
      const sub = ((actor as any).subCategory || "").toLowerCase();
      if (id.includes("linkedin") || sub.includes("linkedin")) return "linkedin" as const;
      if (id.includes("indeed") || sub.includes("indeed")) return "indeed" as const;
      if (id.includes("glassdoor") || sub.includes("glassdoor")) return "glassdoor" as const;
      if (id.includes("google-places") || sub.includes("google_maps")) return "google_maps" as const;
      if (id.includes("yelp") || sub.includes("yelp")) return "yelp" as const;
      if (id.includes("google-search") || sub.includes("web_search")) return "google_search" as const;
      return "generic" as const;
    })();

    let combinedKeyword = "";
    if (intent.roles.length > 0 && intent.industry) {
      combinedKeyword = platform === "linkedin" ? intent.roles.join(" OR ") : `${intent.roles.join(" OR ")} ${intent.industry}`;
    } else if (intent.roles.length > 0) {
      combinedKeyword = intent.roles.join(" OR ");
    } else if (intent.industry) {
      combinedKeyword = intent.industry;
    } else {
      combinedKeyword = stageDef.search_query || run.signal_query || "";
    }

    const testInput: Record<string, any> = { ...params, maxItems: 5 };
    
    switch (platform) {
      case "linkedin": {
        const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(combinedKeyword)}&location=${encodeURIComponent(intent.location)}&f_TPR=r604800`;
        testInput.urls = [url];
        testInput.startUrls = [{ url }];
        testInput.maxItems = 5;
        testInput.splitByLocation = false;
        break;
      }
      case "indeed":
        testInput.position = combinedKeyword;
        testInput.title = combinedKeyword;
        testInput.location = intent.location;
        testInput.maxItems = 5;
        break;
      case "google_maps":
        testInput.searchStringsArray = [combinedKeyword];
        testInput.maxCrawledPlacesPerSearch = 5;
        break;
      default:
        testInput.search = combinedKeyword;
        testInput.query = combinedKeyword;
        testInput.maxItems = 5;
        testInput.maxResults = 5;
    }

    return normalizeInputToSchema(actor, buildGenericInput(actor, testInput));
  } else {
    // Enrichment stage — use sample output from previous stage
    const prevStageOutputs = (run.plan_stage_outputs || {})[stageNum - 1] || [];
    const inputField = stageDef.input_from;
    
    const testInput: Record<string, any> = { ...params, maxItems: 5 };
    
    if (prevStageOutputs.length > 0 && inputField) {
      // Extract input values from previous stage's test output
      const inputValues = prevStageOutputs
        .map((item: any) => item[inputField])
        .filter((v: any) => v !== null && v !== undefined && v !== "")
        .slice(0, 5);
      
      if (inputValues.length > 0) {
        const looksLikeUrls = typeof inputValues[0] === "string" && inputValues[0].startsWith("http");
        if (looksLikeUrls) {
          testInput.startUrls = inputValues.map((url: string) => ({ url }));
          testInput.urls = inputValues;
        } else {
          testInput.queries = inputValues;
          testInput.searchStringsArray = inputValues;
        }
      }
    }

    return normalizeInputToSchema(actor, buildGenericInput(actor, testInput));
  }
}
// Helper to normalize schema for micro test input
function normalizeInputToSchema(actor: ActorEntry, input: Record<string, any>): Record<string, any> {
  if (!actor.inputSchema || Object.keys(actor.inputSchema).length === 0) return input;
  const result = { ...input };
  for (const [field, schema] of Object.entries(actor.inputSchema)) {
    if (result[field] === undefined) continue;
    const value = result[field];
    if (schema.type === "string[]" && Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
      const first = value[0];
      const stringProp = Object.keys(first).find(k => typeof first[k] === "string");
      if (stringProp) result[field] = value.map((item: any) => typeof item === "object" ? item[stringProp] : String(item));
    } else if (schema.type === "string[]" && typeof value === "string") {
      result[field] = [value];
    } else if (schema.type === "object[]" && Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
      result[field] = value.map((item: string) => ({ url: item }));
    } else if (schema.type === "number" && typeof value === "string") {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) result[field] = parsed;
    }
  }
  return result;
}

// Helper to build plan status response
function respondPlanStatus(runId: string, status: string, phase: string, pipeline: any[], testRuns: any[]) {
  const stages = pipeline.map((s: any) => {
    const testResult = testRuns?.find((t: any) => t.stage === s.stage);
    let stageStatus = "pending";
    if (testResult) {
      stageStatus = testResult.status; // testing, validated, failed, auto_validated, skipped
    }
    // Mark stages after current phase as pending
    const phaseMatch = phase.match(/plan_(?:validating|testing)_stage_(\d+)/);
    if (phaseMatch) {
      const currentStage = parseInt(phaseMatch[1], 10);
      if (s.stage > currentStage) stageStatus = "pending";
      if (s.stage === currentStage && !testResult) stageStatus = phase.includes("validating") ? "discovering" : "testing";
    }
    return {
      stage: s.stage, name: s.name, type: s.type, status: stageStatus,
      actor_label: testResult?.actor_label, chain_warning: testResult?.chain_warning,
    };
  });

  return new Response(JSON.stringify({
    run_id: runId, status, phase, stages, test_results: testRuns,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ════════════════════════════════════════════════════════════════
// ██  DRY RUN — Simulate actor inputs without executing
// ════════════════════════════════════════════════════════════════

function dryRunDetectPlatform(actor: ActorEntry): "linkedin" | "indeed" | "glassdoor" | "google_maps" | "yelp" | "google_search" | "generic" {
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

function dryRunSplitCompoundKeywords(keyword: string): string[] {
  if (!keyword) return [keyword || ""];
  if (/\s+OR\s+/i.test(keyword)) return keyword.split(/\s+OR\s+/i).map(k => k.replace(/^['"]|['"]$/g, "").trim()).filter(k => k.length > 0);
  if (keyword.includes(",") && !keyword.startsWith("http")) return keyword.split(",").map(k => k.replace(/^['"]|['"]$/g, "").trim()).filter(k => k.length > 0);
  return [keyword.replace(/^['"]|['"]$/g, "").trim()];
}

interface DryRunSearchIntent {
  roles: string[];
  industry: string;
  location: string;
  dateRange?: string;
}

function dryRunParseSearchIntent(stageDef: any): DryRunSearchIntent {
  const roleFilter: string[] | null = stageDef.role_filter || null;
  const searchQuery: string = stageDef.search_query || "";
  let location = "United States";
  const paramsPerActor = stageDef.params_per_actor || {};
  for (const [, actorParams] of Object.entries(paramsPerActor)) {
    const ap = actorParams as Record<string, any>;
    if (ap?.location) { location = ap.location; break; }
    if (ap?.searchLocation) { location = ap.searchLocation; break; }
  }
  if (stageDef.params?.location) location = stageDef.params.location;
  if (stageDef.params?.searchLocation) location = stageDef.params.searchLocation;
  return { roles: roleFilter || [], industry: roleFilter ? searchQuery : "", location, dateRange: "r604800" };
}

function dryRunBuildPlatformSearchQuery(
  platform: string,
  intent: DryRunSearchIntent,
  existingParams: Record<string, any>
): { url?: string; params: Record<string, any> } {
  const location = existingParams.location || existingParams.searchLocation || intent.location || "United States";
  let combinedKeyword: string;
  if (intent.roles.length > 0 && intent.industry) {
    combinedKeyword = platform === "linkedin" ? intent.roles.join(" OR ") : `${intent.roles.join(" OR ")} ${intent.industry}`;
  } else if (intent.roles.length > 0) {
    combinedKeyword = intent.roles.join(" OR ");
  } else if (intent.industry) {
    combinedKeyword = intent.industry;
  } else {
    combinedKeyword = existingParams.search_query || existingParams.keyword || "";
  }

  switch (platform) {
    case "linkedin": {
      const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(combinedKeyword)}&location=${encodeURIComponent(location)}&f_TPR=${intent.dateRange || "r604800"}`;
      return { url, params: { ...existingParams, urls: [url], startUrls: [{ url }], splitByLocation: false } };
    }
    case "indeed": return { params: { ...existingParams, position: combinedKeyword, title: combinedKeyword, location } };
    case "glassdoor": return { params: { ...existingParams, keyword: combinedKeyword, location } };
    case "google_maps": {
      const searchTerms = intent.industry
        ? dryRunSplitCompoundKeywords(intent.industry).map(term => `${term} ${location}`)
        : [combinedKeyword];
      return { params: { ...existingParams, searchStringsArray: searchTerms } };
    }
    case "yelp": return { params: { ...existingParams, searchTerms: dryRunSplitCompoundKeywords(intent.industry || combinedKeyword), location } };
    case "google_search": return { params: { ...existingParams, queries: combinedKeyword } };
    default: return { params: { ...existingParams, search: combinedKeyword, query: combinedKeyword, keyword: combinedKeyword, location } };
  }
}

async function handleDryRun(
  body: { run_id: string; workspace_id: string },
  serviceClient: any
) {
  const { run_id, workspace_id } = body;
  if (!run_id || !workspace_id) {
    return new Response(JSON.stringify({ error: "run_id and workspace_id are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: run, error: fetchErr } = await serviceClient
    .from("signal_runs").select("*").eq("id", run_id).eq("workspace_id", workspace_id).single();
  if (fetchErr || !run) {
    return new Response(JSON.stringify({ error: "Signal run not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const plan = run.signal_plan;
  if (!plan || !plan.pipeline) {
    return new Response(JSON.stringify({ error: "No pipeline plan found on this run" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load actor registry from plan
  const actorRegistry = new Map<string, ActorEntry>();
  const registry = plan.actor_registry || {};
  for (const [key, config] of Object.entries(registry)) {
    const actor = config as ActorEntry;
    if (!actor.key) actor.key = key;
    actorRegistry.set(key, actor);
  }

  const stages: any[] = [];
  const KNOWN_LIMIT_FIELDS = ["maxItems", "limit", "count", "maxResults", "max_results", "rows", "numResults", "maxCrawledPlacesPerSearch"];

  for (const stageDef of plan.pipeline) {
    if (stageDef.type !== "scrape") {
      stages.push({
        stage: stageDef.stage,
        name: stageDef.name,
        type: stageDef.type,
        note: "AI filter stage — no actor input to simulate",
        prompt: stageDef.prompt || null,
        input_fields: stageDef.input_fields || null,
      });
      continue;
    }

    const actors = stageDef.actors || [];
    const stageResult: any = {
      stage: stageDef.stage,
      name: stageDef.name,
      type: "scrape",
      stage_category: stageDef.stage_category || null,
      actor_inputs: [],
    };

    for (const actorKey of actors) {
      const actor = actorRegistry.get(actorKey);
      if (!actor) {
        stageResult.actor_inputs.push({ actor_key: actorKey, error: "Actor not found in registry" });
        continue;
      }

      const actorInfo: any = {
        actor_key: actorKey,
        actor_id: actor.actorId,
        label: actor.label,
        monthly_users: actor.monthlyUsers || 0,
        total_runs: actor.totalRuns || 0,
        rating: actor.rating || 0,
        input_schema_fields: Object.keys(actor.inputSchema || {}),
      };

      if (stageDef.stage === 1 || !stageDef.input_from) {
        // Stage 1: build full platform query
        const actorParams = stageDef.params_per_actor?.[actorKey] || stageDef.params || {};
        const intent = dryRunParseSearchIntent(stageDef);
        const platform = dryRunDetectPlatform(actor);
        intent.location = actorParams.location || actorParams.searchLocation || intent.location;

        const platformQuery = dryRunBuildPlatformSearchQuery(platform, intent, actorParams);
        const input = { ...platformQuery.params };

        // Apply limit fields
        const hasExistingLimit = KNOWN_LIMIT_FIELDS.some(f => input[f] !== undefined);
        if (!hasExistingLimit) {
          const schemaKeys = Object.keys(actor.inputSchema || {});
          const maxField = schemaKeys.find(f => f.toLowerCase().includes("max") || f === "count" || f === "limit");
          if (maxField) input[maxField] = actor.inputSchema[maxField]?.default || 500;
          else input.maxResults = 500;
        }

        const finalInput = buildGenericInput(actor, input);
        if (!finalInput.proxyConfiguration) finalInput.proxyConfiguration = { useApifyProxy: true };

        actorInfo.detected_platform = platform;
        actorInfo.search_intent = intent;
        actorInfo.platform_url = platformQuery.url || null;
        actorInfo.final_input = finalInput;
      } else if (stageDef.input_transform === "linkedin_url_discovery") {
        actorInfo.note = "LinkedIn URL discovery — input is dynamically built from existing leads' company_name";
        actorInfo.sample_query_pattern = '"[company_name]" site:linkedin.com/company';
        actorInfo.batch_size = 20;
        actorInfo.base_params = stageDef.params_per_actor?.[actorKey] || {};
      } else {
        // Enrichment / later stages
        const inputField = stageDef.input_from;
        actorInfo.input_from = inputField;
        actorInfo.note = `Enrichment stage — input values come from leads' "${inputField}" field`;
        actorInfo.search_titles = stageDef.search_titles || null;

        // Show sample input structure
        const actorParams = stageDef.params_per_actor?.[actorKey] || {};
        const sampleInput = buildGenericInput(actor, actorParams);
        if (!sampleInput.proxyConfiguration) sampleInput.proxyConfiguration = { useApifyProxy: true };
        actorInfo.base_params = sampleInput;

        const batchSize = actor.category === "people_data" ? 50 : actor.category === "company_data" ? 100 : 50;
        actorInfo.batch_size = batchSize;
      }

      stageResult.actor_inputs.push(actorInfo);
    }

    stages.push(stageResult);
  }

  const result = {
    dry_run: true,
    run_id,
    signal_name: plan.signal_name || run.signal_name,
    signal_query: run.signal_query,
    pipeline_stages: stages,
    actor_registry_summary: Object.fromEntries(
      [...actorRegistry.entries()].map(([k, v]) => [k, {
        actorId: v.actorId,
        label: v.label,
        category: v.category,
        monthlyUsers: v.monthlyUsers,
        totalRuns: v.totalRuns,
        rating: v.rating,
        is_backup: !!(v as any)._isBackup,
      }])
    ),
  };

  return new Response(JSON.stringify(result), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

  // Inject advanced settings as explicit user constraints
  if (advanced_settings) {
    const scrapeVolume = advanced_settings.scrape_volume || advanced_settings.max_results_per_source || 1000;
    const maxResults = advanced_settings.max_results_per_source || scrapeVolume;
    const dateRange = advanced_settings.date_range || "past_week";
    const strictness = advanced_settings.ai_strictness || "medium";
    const location = advanced_settings.location || "";
    const companySize = advanced_settings.company_size || "any";
    const decisionMakerTitles = advanced_settings.decision_maker_titles || "";

    const dateMap: Record<string, string> = {
      past_24h: "past 24 hours only", past_week: "past week",
      past_2_weeks: "past 2 weeks", past_month: "past month",
    };
    const strictnessMap: Record<string, string> = {
      low: "Be lenient — accept borderline matches. expected_pass_rate: 0.30-0.50.",
      medium: "Balanced filtering. expected_pass_rate: 0.15-0.30.",
      high: "Very strict — only strong matches. expected_pass_rate: 0.05-0.15.",
    };
    const companySizeMap: Record<string, string> = {
      any: "Any company size",
      "1-10": "1-10 employees (very small / micro businesses)",
      "11-50": "11-50 employees (small businesses)",
      "51-200": "51-200 employees (mid-market)",
      "200+": "200+ employees (enterprise)",
    };

    systemPrompt += `\n\n## USER PREFERENCES (OVERRIDE DEFAULTS — these are EXPLICIT user constraints)\n`;
    systemPrompt += `- Scrape volume: ${scrapeVolume} records. Set Stage 1 maxItems/maxCrawledPlacesPerSearch to ${maxResults}. This directly controls how many records to scrape.\n`;
    systemPrompt += `- Date range: ${dateMap[dateRange] || "past week"}\n`;
    systemPrompt += `- Filtering strictness: ${strictnessMap[strictness] || strictnessMap.medium}\n`;
    
    if (location) {
      systemPrompt += `- LOCATION CONSTRAINT (CRITICAL): "${location}" — ALL stage 1 params MUST include location="${location}". LinkedIn URLs must encode this location. Do NOT default to United States.\n`;
    }
    
    if (companySize !== "any") {
      systemPrompt += `- COMPANY SIZE CONSTRAINT: Only target companies with ${companySizeMap[companySize]}. Your ai_filter prompt MUST explicitly reject companies outside this size range.\n`;
    }
    
    if (decisionMakerTitles) {
      systemPrompt += `- DECISION MAKER TITLES (OVERRIDE): Use these exact titles for people_data search: ${decisionMakerTitles}. Add as search_titles on the people_data stage.\n`;
    }
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
    if (plan_override.refinement_context) {
      const rc = plan_override.refinement_context;
      const typeDescriptions: Record<string, string> = {
        wrong_industry: "Results contained companies from the wrong industry/vertical. The AI filter must be MORE aggressive at rejecting irrelevant industries.",
        too_large: "Results contained too many large enterprises. Strictly filter companies with >200 employees. Prefer smaller businesses.",
        too_small: "Results contained too many micro businesses. Filter out companies with <10 employees.",
        wrong_location: "Results were from the wrong geographic location. Ensure location parameters are set correctly in ALL stages.",
        wrong_titles: "The decision maker titles found were not relevant. Adjust search_titles to better match the user's intent.",
        other: "General quality issue.",
      };
      systemPrompt += `\n## REFINEMENT CONTEXT (CRITICAL — the previous run had issues)\n`;
      systemPrompt += `- Issue type: ${typeDescriptions[rc.type] || rc.type}\n`;
      if (rc.reason) {
        systemPrompt += `- User feedback: "${rc.reason}"\n`;
      }
      systemPrompt += `- Original query: "${rc.original_query}"\n`;
      systemPrompt += `- ACTION REQUIRED: Adjust the pipeline to address this feedback. Make the ai_filter prompt stricter about this specific issue.\n`;
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

  // Step 2: AI generates logical pipeline with stage_categories (with retry)
  let planText = "";
  let parsedPlan: any;
  const MAX_AI_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_AI_RETRIES; attempt++) {
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
    planText = aiResult.choices?.[0]?.message?.content || "";
    planText = planText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = planText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) planText = jsonMatch[1];

    if (!planText) {
      console.warn(`AI returned empty response (attempt ${attempt + 1}/${MAX_AI_RETRIES + 1})`);
      if (attempt < MAX_AI_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw new Error("AI returned an empty response after retries. Please try again.");
    }

    try {
      parsedPlan = JSON.parse(planText);
      break; // Success
    } catch (parseErr) {
      console.error(`Failed to parse AI plan response (attempt ${attempt + 1}):`, planText.slice(0, 1000));
      if (attempt < MAX_AI_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw new Error("AI returned invalid plan. Please try rephrasing your query.");
    }
  }

  if (parsedPlan.infeasible_reason) {
    return new Response(
      JSON.stringify({ error: `This search isn't possible: ${parsedPlan.infeasible_reason}` }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ════════════════════════════════════════════════════════════════
  // ██  STRICT PLAN SCHEMA VALIDATION — Catch bad plans before execution
  // ════════════════════════════════════════════════════════════════

  const planValidationErrors = validatePlanSchema(parsedPlan, query);
  if (planValidationErrors.critical.length > 0) {
    console.error("Plan failed schema validation:", planValidationErrors.critical);
    // Auto-fix what we can
    parsedPlan = autoFixPlan(parsedPlan, query, planValidationErrors);
    // Re-validate after fixes
    const recheck = validatePlanSchema(parsedPlan, query);
    if (recheck.critical.length > 0) {
      return new Response(
        JSON.stringify({ error: `AI generated an invalid plan: ${recheck.critical.join("; ")}. Please rephrase your query.` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
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

  // Step 3: Apply advanced settings caps to Stage 1 (pre-actor resolution)
  const maxCap = advanced_settings?.max_results_per_source || null;
  for (const stage of parsedPlan.pipeline) {
    if (stage.stage === 1 && stage.type === "scrape") {
      stage.expected_output_count = maxCap || stage.expected_output_count || 500;
    }
  }

  // Step 4: Validate data flow and auto-fix
  const dataFlowResult = validateDataFlow(parsedPlan.pipeline);
  if (!dataFlowResult.valid) {
    console.log("Data flow issues detected and fixed:", dataFlowResult.issues);
    parsedPlan.pipeline = dataFlowResult.fixedPipeline;
  }

  // Step 5: Validate plan (without actor-dependent checks)
  const warnings = validatePipelinePlan(parsedPlan, query);

  // Step 6: Store advanced_settings in plan for later use
  parsedPlan.advanced_settings = advanced_settings || {};

  // Step 7: Save skeleton to database with plan_phase
  const totalStages = parsedPlan.pipeline.length;
  const firstStage = parsedPlan.pipeline[0]?.stage || 1;

  const { data: insertData, error: insertError } = await serviceClient
    .from("signal_runs")
    .insert({
      workspace_id,
      user_id: userId,
      signal_query: query,
      signal_name: parsedPlan.signal_name || "Signal Search",
      signal_plan: parsedPlan,
      status: "planning",
      estimated_cost: 0,
      pipeline_stage_count: totalStages,
      plan_phase: `plan_validating_stage_${firstStage}`,
      plan_test_runs: [],
      plan_stage_outputs: {},
    })
    .select()
    .single();

  if (insertError) throw insertError;

  console.log(`Plan skeleton saved: ${insertData.id} — ${totalStages} stages, starting validation at stage ${firstStage}`);

  return new Response(
    JSON.stringify({
      run_id: insertData.id,
      status: "planning",
      phase: `plan_validating_stage_${firstStage}`,
      signal_name: parsedPlan.signal_name || "Signal Search",
      total_stages: totalStages,
      warnings: warnings.length > 0 ? warnings : undefined,
      data_flow_fixes: dataFlowResult.issues.length > 0 ? dataFlowResult.issues : undefined,
      stages: parsedPlan.pipeline.map((s: any) => ({
        stage: s.stage, name: s.name, type: s.type, status: "pending",
      })),
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function deriveSourceLabel(pipeline: any[]): string {
  if (!Array.isArray(pipeline)) return "Signal Search";
  const firstScrape = pipeline.find((s: any) => s.type === "scrape" && s.stage_category);
  if (firstScrape) {
    const cat = STAGE_CATEGORIES[firstScrape.stage_category];
    if (cat) return cat.label;
    return firstScrape.name || "Signal Search";
  }
  return "Signal Search";
}

// ════════════════════════════════════════════════════════════════
// ██  PLAN SCHEMA VALIDATION
// ════════════════════════════════════════════════════════════════

interface PlanValidation {
  critical: string[];
  warnings: string[];
}

function validatePlanSchema(plan: any, userQuery: string): PlanValidation {
  const critical: string[] = [];
  const warnings: string[] = [];

  const pipeline = plan.pipeline || [];
  if (!Array.isArray(pipeline) || pipeline.length === 0) {
    critical.push("Pipeline is empty or not an array");
    return { critical, warnings };
  }

  // Validate stage numbering
  for (let i = 0; i < pipeline.length; i++) {
    if (pipeline[i].stage !== i + 1) {
      warnings.push(`Stage numbering gap at index ${i}: expected ${i + 1}, got ${pipeline[i].stage}`);
    }
  }

  // Validate each stage
  for (const stage of pipeline) {
    if (stage.type === "scrape") {
      if (!stage.stage_category) {
        critical.push(`Stage ${stage.stage} is a scrape stage without stage_category`);
      }
    } else if (stage.type === "ai_filter") {
      if (!stage.prompt) {
        warnings.push(`Stage ${stage.stage} is an ai_filter without prompt`);
      }
    }
  }

  // Check for hiring_intent stages that should have search_query when using role_filter
  for (const stage of pipeline) {
    if (stage.stage_category?.startsWith("hiring_intent") && stage.role_filter?.length > 0 && !stage.search_query) {
      critical.push(`Stage ${stage.stage}: hiring_intent with role_filter but no search_query (industry context missing)`);
    }
  }

  return { critical, warnings };
}

function autoFixPlan(plan: any, userQuery: string, validation: PlanValidation): any {
  const fixed = JSON.parse(JSON.stringify(plan));
  const pipeline = fixed.pipeline || [];

  // Fix stage numbering
  for (let i = 0; i < pipeline.length; i++) {
    pipeline[i].stage = i + 1;
  }

  // Fix missing industry context in hiring_intent search_query
  const stage1 = pipeline[0];
  if (stage1?.stage_category?.startsWith("hiring_intent") && stage1.role_filter?.length > 0 && !stage1.search_query) {
    // Extract industry terms from user query
    const industries = inferQueryIndustry(userQuery);
    if (industries.length > 0) {
      stage1.search_query = industries.join(" OR ");
      console.log(`Auto-fix: Set search_query to "${stage1.search_query}" from user query industry`);
    } else {
      // Use the full user query minus role-like words as industry context
      const roleWords = new Set((stage1.role_filter || []).flatMap((r: string) => r.toLowerCase().split(/\s+/)));
      const queryWords = userQuery.split(/\s+/).filter(w => !roleWords.has(w.toLowerCase()) && w.length > 2);
      stage1.search_query = queryWords.join(" ");
      console.log(`Auto-fix: Derived search_query "${stage1.search_query}" from user query`);
    }
  }

  // Fix missing ai_filter prompts
  for (const stage of pipeline) {
    if (stage.type === "ai_filter" && !stage.prompt) {
      stage.prompt = `Does this company match the user's search: "${userQuery}"? Only accept if clearly relevant.`;
    }
  }

  fixed.pipeline = pipeline;
  return fixed;
}

// ════════════════════════════════════════════════════════════════
// ██  HELPER FUNCTIONS — Query parsing, actor discovery, validation
// ════════════════════════════════════════════════════════════════

const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  "marketing": ["marketing", "advertising", "digital marketing", "media agency", "ad agency", "creative agency"],
  "saas": ["saas", "software", "software-as-a-service", "tech company", "cloud software"],
  "healthcare": ["healthcare", "medical", "health", "hospital", "clinic", "pharma", "pharmaceutical"],
  "fintech": ["fintech", "financial technology", "banking", "payments", "lending"],
  "real_estate": ["real estate", "property", "realty", "mortgage", "brokerage"],
  "ecommerce": ["ecommerce", "e-commerce", "online store", "retail", "shopify"],
  "construction": ["construction", "contractor", "building", "renovation", "plumbing", "hvac", "roofing", "electrical"],
  "legal": ["legal", "law firm", "attorney", "lawyer"],
  "accounting": ["accounting", "cpa", "bookkeeping", "tax"],
  "insurance": ["insurance", "insurer", "underwriting"],
  "education": ["education", "edtech", "school", "university", "training"],
  "consulting": ["consulting", "consultancy", "advisory"],
  "logistics": ["logistics", "shipping", "freight", "supply chain", "trucking"],
  "manufacturing": ["manufacturing", "factory", "production"],
  "restaurant": ["restaurant", "food", "dining", "catering", "cafe"],
  "automotive": ["automotive", "car dealership", "auto repair"],
};

function inferQueryIndustry(query: string): string[] {
  const lower = query.toLowerCase();
  const matches: string[] = [];
  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      matches.push(industry);
    }
  }
  return matches;
}

const GEO_PATTERNS = [
  // US states
  /\b(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\b/gi,
  // US state abbreviations with comma before (e.g., "Austin, TX")
  /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/gi,
  // Major US cities
  /\b(New York|Los Angeles|Chicago|Houston|Phoenix|Philadelphia|San Antonio|San Diego|Dallas|San Jose|Austin|Jacksonville|Fort Worth|Columbus|Charlotte|Indianapolis|San Francisco|Seattle|Denver|Nashville|Boston|Miami|Atlanta|Portland|Las Vegas|Memphis|Louisville|Baltimore|Milwaukee|Albuquerque|Tucson|Sacramento|Kansas City|Mesa|Omaha|Raleigh|Cleveland|Tampa|Minneapolis|Pittsburgh|Cincinnati|Orlando|St\.?\s*Louis|Detroit)\b/gi,
  // Countries
  /\b(United States|USA|US|UK|United Kingdom|Canada|Australia|Germany|France|India|Brazil|Mexico|Japan|China|South Korea|Netherlands|Spain|Italy|Sweden|Norway|Denmark|Finland|Ireland|Israel|Singapore|UAE|Dubai)\b/gi,
  // Generic geo terms
  /\b(in|near|around|based in|located in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
];

function extractGeography(query: string): string[] {
  const geos = new Set<string>();
  for (const pattern of GEO_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(query)) !== null) {
      const geo = (match[2] || match[1] || match[0]).trim();
      if (geo.length > 1 && !["in", "near", "around", "based", "located"].includes(geo.toLowerCase())) {
        geos.add(geo);
      }
    }
  }
  return [...geos];
}

const SIGNAL_CLASSIFIERS: Record<string, RegExp[]> = {
  "hiring_intent": [/hiring|recruit|job|career|open position|talent|vacancy|looking for|SDR|BDR|sales rep/i],
  "local_business": [/local|near me|google maps|yelp|directory|plumber|contractor|restaurant|shop|store|clinic/i],
  "funded_companies": [/funded|raised|series [a-d]|seed round|venture|investment|vc backed|funding/i],
  "poor_reviews": [/bad review|poor rating|negative review|1 star|2 star|complaint|unhappy customer/i],
  "new_business": [/new business|newly registered|startup|recently founded|just opened|new company/i],
  "expansion": [/expanding|new office|new location|growth|scaling|opening new/i],
  "technology": [/using|technology|tech stack|tool|platform|software|integration/i],
};

function classifySignalType(query: string): string | null {
  for (const [signalType, patterns] of Object.entries(SIGNAL_CLASSIFIERS)) {
    if (patterns.some(p => p.test(query))) return signalType;
  }
  return null;
}

// ── Dynamic Actor Discovery via Apify Store API ──

async function discoverActors(searchTerm: string, serviceClient: any): Promise<ActorEntry[]> {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) return [];

  // Check cache first (7-day TTL) — table stores individual actor rows with category column
  const categoryKey = searchTerm.toLowerCase().trim();
  const ttlThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: cachedActors } = await serviceClient
    .from("signal_actor_cache")
    .select("*")
    .eq("category", categoryKey)
    .gte("cached_at", ttlThreshold)
    .order("monthly_users", { ascending: false })
    .limit(10);

  if (cachedActors && cachedActors.length > 0) {
    console.log(`Actor cache HIT for "${searchTerm}": ${cachedActors.length} actors`);
    const actors = cachedActors.map((row: any) => ({
      key: row.actor_key || row.actor_id.replace(/[^a-zA-Z0-9]/g, "_"),
      actorId: row.actor_id,
      label: row.label || row.actor_id,
      category: row.category || searchTerm,
      description: row.description || "",
      inputSchema: row.input_schema || {},
      outputFields: row.output_fields || {},
      monthlyUsers: row.monthly_users || 0,
      totalRuns: row.total_runs || 0,
      rating: row.rating || 0,
    }));
    // Sort by composite quality score
    actors.sort((a: ActorEntry, b: ActorEntry) => {
      const scoreA = (a.monthlyUsers || 0) * 0.4 + (a.totalRuns || 0) * 0.0003 + (a.rating || 0) * 200;
      const scoreB = (b.monthlyUsers || 0) * 0.4 + (b.totalRuns || 0) * 0.0003 + (b.rating || 0) * 200;
      return scoreB - scoreA;
    });
    return actors;
  }

  // Search Apify Store
  console.log(`Discovering actors for: "${searchTerm}"`);
  try {
    const resp = await fetch(
      `https://api.apify.com/v2/store?token=${APIFY_API_TOKEN}&search=${encodeURIComponent(searchTerm)}&limit=10&sortBy=popularity`,
      { method: "GET" }
    );
    if (!resp.ok) {
      console.warn(`Apify Store search failed (${resp.status})`);
      return [];
    }
    const data = await resp.json();
    const items = data.data?.items || data.items || [];

    const actors: ActorEntry[] = [];
    for (const item of items.slice(0, 5)) {
      const actorId = item.username && item.name ? `${item.username}/${item.name}` : item.id || "";
      if (!actorId) continue;

      // Fetch input schema
      let inputSchema: Record<string, InputField> = {};
      try {
        const actorIdEncoded = actorId.replace("/", "~");
        const schemaResp = await fetch(
          `https://api.apify.com/v2/acts/${actorIdEncoded}/input-schema?token=${APIFY_API_TOKEN}`,
          { method: "GET" }
        );
        if (schemaResp.ok) {
          const schemaData = await schemaResp.json();
          const props = schemaData.properties || schemaData.data?.properties ||
            schemaData.schema?.properties || {};
          for (const [key, val] of Object.entries(props as Record<string, any>)) {
            const type = val.type === "array"
              ? (val.items?.type === "object" || val.items?.properties ? "object[]" : "string[]")
              : (val.type === "integer" ? "number" : (val.type || "string"));
            inputSchema[key] = {
              type: type as any,
              required: val.required || false,
              default: val.default,
              description: (val.description || key).slice(0, 200),
            };
          }
        }
      } catch { /* proceed without schema */ }

      const actorKey = actorId.replace(/[^a-zA-Z0-9]/g, "_");
      const monthlyUsers = item.stats?.totalUsers30Days || item.monthlyUsers || 0;
      const totalRuns = item.stats?.totalRuns || item.totalRuns || 0;
      const rating = item.stats?.rating || 0;

      actors.push({
        key: actorKey,
        actorId,
        label: item.title || item.name || actorId,
        category: categoryKey,
        description: (item.description || item.title || "").slice(0, 300),
        inputSchema,
        outputFields: {},
        monthlyUsers,
        totalRuns,
        rating,
      });

      // Cache each actor as a separate row
      try {
        await serviceClient.from("signal_actor_cache").upsert({
          actor_id: actorId,
          actor_key: actorKey,
          label: item.title || item.name || actorId,
          category: categoryKey,
          description: (item.description || item.title || "").slice(0, 300),
          input_schema: inputSchema,
          output_fields: {},
          monthly_users: monthlyUsers,
          total_runs: totalRuns,
          rating,
          cached_at: new Date().toISOString(),
        }, { onConflict: "actor_id" });
      } catch (cacheErr) {
        console.warn(`Cache write failed for ${actorId}:`, cacheErr);
      }
    }

    // Sort by composite quality score (users * 0.4 + totalRuns * 0.0003 + rating * 200)
    actors.sort((a, b) => {
      const scoreA = (a.monthlyUsers || 0) * 0.4 + (a.totalRuns || 0) * 0.0003 + (a.rating || 0) * 200;
      const scoreB = (b.monthlyUsers || 0) * 0.4 + (b.totalRuns || 0) * 0.0003 + (b.rating || 0) * 200;
      return scoreB - scoreA;
    });
    console.log(`Discovered ${actors.length} actors for "${searchTerm}" (sorted by quality score)`);
    return actors;
  } catch (err) {
    console.error(`Actor discovery error for "${searchTerm}":`, err);
    return [];
  }
}

// ── Pipeline Validation ──

function validatePipelinePlan(plan: any, query: string): string[] {
  const warnings: string[] = [];
  const pipeline = plan.pipeline || [];

  if (pipeline.length === 0) {
    warnings.push("Pipeline has no stages");
    return warnings;
  }

  // Check stage 1 is a scrape with no input_from
  const stage1 = pipeline[0];
  if (stage1.type !== "scrape") {
    warnings.push("Stage 1 should be a scrape stage (discovery)");
  }
  if (stage1.input_from) {
    warnings.push("Stage 1 should not have input_from (it's the initial discovery)");
  }

  // Check for mandatory output fields coverage using STAGE_CATEGORIES
  const mandatoryFields = ["contact_name", "industry", "website", "company_linkedin_url", "linkedin_profile_url", "employee_count"];
  const producedFields = new Set<string>();
  for (const stage of pipeline) {
    if (stage.type === "scrape" && stage.stage_category) {
      const cat = STAGE_CATEGORIES[stage.stage_category];
      if (cat) {
        for (const field of cat.expectedOutputs) {
          producedFields.add(field);
        }
      }
    }
    if (stage.updates_fields) {
      stage.updates_fields.forEach((f: string) => producedFields.add(f));
    }
  }

  // Map aliases
  if (producedFields.has("linkedin")) producedFields.add("company_linkedin_url");
  if (producedFields.has("linkedin_profile")) producedFields.add("linkedin_profile_url");

  const missing = mandatoryFields.filter(f => !producedFields.has(f));
  if (missing.length > 0) {
    warnings.push(`Pipeline may not produce mandatory fields: ${missing.join(", ")}. Consider adding enrichment stages.`);
  }

  // Check for people enrichment stage
  const hasPeopleStage = pipeline.some((s: any) =>
    s.stage_category?.startsWith("people_data") ||
    s.name?.toLowerCase().includes("decision maker") ||
    s.name?.toLowerCase().includes("people")
  );
  if (!hasPeopleStage) {
    warnings.push("Pipeline has no people enrichment stage — contact_name and linkedin_profile_url may be missing");
  }

  return warnings;
}

// ── Cost Estimation ──

function estimatePipelineCost(pipeline: any[], aiYieldRate?: number | null): {
  totalCredits: number;
  totalEstimatedRows: number;
  totalEstimatedLeads: number;
  stageFunnel: any;
  yieldRate: number;
  yieldLabel: string;
  yieldGuidance: string | null;
} {
  let totalEstimatedRows = 0;
  let currentRowCount = 0;
  let totalCredits = 0;
  let discoveryRowCount = 0;
  const stageFunnel: any[] = [];
  let compoundPassRate = 1.0;

  for (const stage of pipeline) {
    if (stage.type === "scrape") {
      if (stage.stage === 1) {
        const expectedCount = stage.expected_output_count || 500;
        currentRowCount = expectedCount;
        discoveryRowCount = expectedCount;
        totalEstimatedRows = discoveryRowCount;
      } else {
        const expectedCount = stage.expected_output_count || currentRowCount;
        currentRowCount = Math.min(currentRowCount, expectedCount);
      }
      const stageCost = Math.ceil(currentRowCount * 0.1);
      totalCredits += stageCost;
      stageFunnel.push({
        stage: stage.stage,
        name: stage.name,
        type: "scrape",
        estimatedRows: currentRowCount,
        estimatedCost: stageCost,
      });
    } else if (stage.type === "ai_filter") {
      const passRate = stage.expected_pass_rate || 0.3;
      compoundPassRate *= passRate;
      const inputRows = currentRowCount;
      currentRowCount = Math.ceil(inputRows * passRate);
      const filterCost = Math.ceil(inputRows * 0.05);
      totalCredits += filterCost;
      stageFunnel.push({
        stage: stage.stage,
        name: stage.name,
        type: "ai_filter",
        inputRows,
        outputRows: currentRowCount,
        passRate,
        estimatedCost: filterCost,
      });
    }
  }

  // Use AI yield rate if provided, otherwise fall back to compound pass rate
  const yieldRate = aiYieldRate && aiYieldRate > 0 && aiYieldRate <= 1
    ? aiYieldRate
    : compoundPassRate;

  const totalEstimatedLeads = aiYieldRate && aiYieldRate > 0 && aiYieldRate <= 1
    ? Math.ceil(discoveryRowCount * aiYieldRate)
    : currentRowCount;

  // Yield label and guidance
  let yieldLabel: string;
  let yieldGuidance: string | null;
  if (yieldRate < 0.05) {
    yieldLabel = "Niche";
    yieldGuidance = "Niche search — increase scrape volume for more results";
  } else if (yieldRate < 0.20) {
    yieldLabel = "Moderate";
    yieldGuidance = null;
  } else {
    yieldLabel = "Broad";
    yieldGuidance = "Broad search — you can reduce volume to save credits";
  }

  totalCredits = Math.max(1, totalCredits);

  return { totalCredits, totalEstimatedRows, totalEstimatedLeads, stageFunnel, yieldRate, yieldLabel, yieldGuidance };
}

const ROW_CAP_KEYS = [
  "maxItems", "maxResults", "maxCrawledPlacesPerSearch",
  "count", "limit", "max_items", "max_results", "rows", "numResults",
  "maxPagesPerQuery", "resultsPerPage", "maxRequestsPerStartUrl",
];
function inferRowCapFromParams(params: any): number | null {
  for (const key of ROW_CAP_KEYS) {
    if (params[key] !== undefined) {
      const val = typeof params[key] === "number" ? params[key] : parseInt(String(params[key]), 10);
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}
