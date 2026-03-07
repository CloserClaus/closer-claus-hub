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

// Runtime map — populated fresh from Apify Store on every plan generation
let discoveredActorMap: Map<string, ActorEntry> = new Map();
function getActor(key: string): ActorEntry | undefined { return discoveredActorMap.get(key); }

// ════════════════════════════════════════════════════════════════
// ██  OUTPUT FIELD INFERENCE — infer likely outputs by actor category
// ════════════════════════════════════════════════════════════════

function inferOutputFields(category: string): Record<string, string[]> {
  const base: Record<string, string[]> = {
    company_name: ["company", "companyName", "name", "title", "employer.name", "businessName", "organization"],
    website: ["website", "url", "companyUrl", "companyWebsite", "link", "homepageUrl", "domain", "href"],
    description: ["description", "descriptionHtml", "snippet", "text", "body", "tagline", "categoryName"],
  };
  switch (category) {
    case "hiring_intent":
      return { ...base,
        title: ["title", "jobTitle", "position", "positionName"],
        location: ["location", "jobLocation", "place", "address"],
        city: ["city", "location.city"], state: ["state", "location.state"],
        country: ["country", "countryCode", "location.countryName"],
        industry: ["industry", "industries", "companyIndustry", "employer.industry"],
        employee_count: ["employeeCount", "companyEmployeesCount", "companySize", "employer.employeesCount"],
        linkedin: ["companyLinkedinUrl", "companyUrl", "linkedinUrl"],
        email: ["email", "contactEmail"], phone: [],
        salary: ["salary", "salaryInfo", "baseSalary"],
        apply_link: ["link", "applyLink", "url"],
      };
    case "local_business":
      return { ...base,
        phone: ["phone", "telephone", "phoneNumber", "displayPhone"],
        email: ["email", "emails"],
        location: ["address", "fullAddress", "neighborhood"],
        city: ["city"], state: ["state"], country: ["country", "countryCode"],
        industry: ["category", "categories", "categoryName"],
        linkedin: [], employee_count: [],
      };
    case "company_data":
      return { ...base,
        employee_count: ["employeeCount", "staffCount", "employeesOnLinkedIn", "numberOfEmployees"],
        industry: ["industry", "industries"],
        linkedin: ["linkedinUrl", "url"],
        location: ["headquarters", "location"],
        city: ["city", "headquartersCity"], state: ["state"],
        country: ["country", "headquartersCountry"],
        phone: ["phone"], email: ["email"],
      };
    case "people_data":
      return { ...base,
        contact_name: ["fullName", "name", "firstName"],
        title: ["headline", "title", "currentPositions.title"],
        linkedin_profile: ["profileUrl", "url", "linkedinUrl"],
        location: ["location", "geoLocation"],
        city: ["city"], country: ["country"],
      };
    case "enrichment":
      return { ...base,
        email: ["emails", "email", "emailAddresses"],
        phone: ["phones", "phone", "phoneNumbers"],
        linkedin: ["linkedIn", "linkedin", "linkedInUrl"],
        location: ["address", "location"],
        city: ["city"], state: ["state"], country: ["country"],
      };
    case "web_search":
      return { ...base, linkedin: [] };
    default:
      return { ...base, phone: ["phone"], email: ["email"], linkedin: [] };
  }
}

// ════════════════════════════════════════════════════════════════
// ██  DYNAMIC ACTOR DISCOVERY — Apify Store API (ONLY source)
// ════════════════════════════════════════════════════════════════

async function discoverActors(query: string, serviceClient: any): Promise<ActorEntry[]> {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured — cannot discover actors from Apify Store");

  const discovered: ActorEntry[] = [];
  const seenActorIds = new Set<string>();

  // 1. Check cache (7-day TTL)
  const cacheThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: cached } = await serviceClient
    .from("signal_actor_cache")
    .select("*")
    .gte("cached_at", cacheThreshold)
    .limit(100);

  for (const c of (cached || [])) {
    const actor: ActorEntry = {
      key: c.actor_key || c.actor_id.replace(/[^a-zA-Z0-9]/g, "_"),
      actorId: c.actor_id,
      label: c.label || "",
      category: c.category || "other",
      description: c.description || "",
      inputSchema: c.input_schema || {},
      outputFields: c.output_sample || inferOutputFields(c.category || "other"),
      monthlyUsers: c.monthly_users || 0,
      totalRuns: c.total_runs || 0,
      rating: c.rating || 0,
    };
    discovered.push(actor);
    seenActorIds.add(c.actor_id);
  }

  // 2. Build comprehensive search terms from the user's query + essential categories
  const searchTerms = extractComprehensiveSearchTerms(query);
  console.log(`Actor discovery: searching Apify Store with terms: ${searchTerms.join(", ")}`);

  for (const term of searchTerms) {
    try {
      const resp = await fetch(
        `https://api.apify.com/v2/store?search=${encodeURIComponent(term)}&limit=8&sortBy=popularity&token=${APIFY_API_TOKEN}`,
        { method: "GET" }
      );
      if (!resp.ok) { console.warn(`Apify Store search failed for "${term}": ${resp.status}`); continue; }
      const data = await resp.json();

      for (const item of (data.data?.items || [])) {
        const actorId = item.username ? `${item.username}/${item.name}` : item.id;
        if (seenActorIds.has(actorId)) continue;
        seenActorIds.add(actorId);

        // Quality gate: skip very low-quality actors
        if ((item.stats?.totalUsers || 0) < 20 && (item.stats?.totalRuns || 0) < 500) continue;

        // Fetch input schema — try multiple endpoints
        let inputSchema: Record<string, InputField> = {};
        const actorIdEncoded = actorId.replace("/", "~");
        
        // Attempt 1: defaultRunInput from actor details
        try {
          const schemaResp = await fetch(
            `https://api.apify.com/v2/acts/${actorIdEncoded}?token=${APIFY_API_TOKEN}`,
            { method: "GET" }
          );
          if (schemaResp.ok) {
            const actorData = await schemaResp.json();
            const rawSchema = actorData.data?.defaultRunInput?.body || {};
            if (rawSchema.properties && Object.keys(rawSchema.properties).length > 0) {
              for (const [key, val] of Object.entries(rawSchema.properties as Record<string, any>)) {
                const type = val.type === "array" ? "string[]" : (val.type === "integer" ? "number" : (val.type || "string"));
                inputSchema[key] = {
                  type: type as any,
                  required: (rawSchema.required || []).includes(key),
                  default: val.default,
                  description: (val.description || key).slice(0, 200),
                };
              }
            }
          }
        } catch (e) { console.warn(`Schema attempt 1 failed for ${actorId}:`, e); }

        // Attempt 2: dedicated input-schema endpoint (fallback)
        if (Object.keys(inputSchema).length === 0) {
          try {
            const schemaResp2 = await fetch(
              `https://api.apify.com/v2/acts/${actorIdEncoded}/input-schema?token=${APIFY_API_TOKEN}`,
              { method: "GET" }
            );
            if (schemaResp2.ok) {
              const schemaData = await schemaResp2.json();
              const props = schemaData.properties || schemaData.data?.properties || {};
              if (Object.keys(props).length > 0) {
                for (const [key, val] of Object.entries(props as Record<string, any>)) {
                  const type = val.type === "array" ? "string[]" : (val.type === "integer" ? "number" : (val.type || "string"));
                  inputSchema[key] = {
                    type: type as any,
                    required: (schemaData.required || []).includes(key),
                    default: val.default,
                    description: (val.description || val.title || key).slice(0, 200),
                  };
                }
              }
            }
          } catch (e) { console.warn(`Schema attempt 2 (input-schema) failed for ${actorId}:`, e); }
        }

        if (Object.keys(inputSchema).length === 0) {
          console.warn(`No inputSchema found for ${actorId} — actor params will be passed through directly at runtime`);
        }

        const category = categorizeActor(item.title || "", item.description || "");
        const outputFields = inferOutputFields(category);

        const actor: ActorEntry = {
          key: actorId.replace(/[^a-zA-Z0-9]/g, "_"),
          actorId,
          label: item.title || item.name || actorId,
          category,
          description: (item.description || "").slice(0, 500),
          inputSchema,
          outputFields,
          monthlyUsers: item.stats?.totalUsers || 0,
          totalRuns: item.stats?.totalRuns || 0,
          rating: item.stats?.publicStarVotes?.average || 0,
        };

        discovered.push(actor);

        // Cache it
        try {
          await serviceClient.from("signal_actor_cache").upsert({
            actor_id: actorId,
            actor_key: actor.key,
            label: actor.label,
            category,
            description: actor.description,
            input_schema: inputSchema,
            output_sample: outputFields,
            monthly_users: actor.monthlyUsers,
            total_runs: actor.totalRuns,
            rating: actor.rating,
            cached_at: new Date().toISOString(),
          }, { onConflict: "actor_id" });
        } catch { /* non-critical */ }
      }
    } catch (err) {
      console.warn(`Actor discovery for "${term}" failed:`, err);
    }
  }

  // Sort by popularity (most users first)
  discovered.sort((a, b) => (b.monthlyUsers || 0) - (a.monthlyUsers || 0));

  console.log(`Actor discovery complete: ${discovered.length} actors found`);

  if (discovered.length === 0) {
    throw new Error("No suitable actors found on Apify Store. Check your APIFY_API_TOKEN or try a different query.");
  }

  return discovered;
}

function extractComprehensiveSearchTerms(query: string): string[] {
  const terms = new Set<string>();
  const lower = query.toLowerCase();

  // Query-specific terms
  if (lower.includes("job") || lower.includes("hiring") || lower.includes("recruit") || lower.includes("vacancy") || lower.includes("sales rep")) {
    terms.add("job scraper"); terms.add("indeed scraper"); terms.add("linkedin jobs scraper");
  }
  if (lower.includes("linkedin")) terms.add("linkedin scraper");
  if (lower.includes("company") || lower.includes("business") || lower.includes("agency") || lower.includes("firm")) {
    terms.add("company scraper"); terms.add("business directory");
  }
  if (lower.includes("google") || lower.includes("maps") || lower.includes("local")) terms.add("google maps scraper");
  if (lower.includes("yelp")) terms.add("yelp scraper");
  if (lower.includes("website") || lower.includes("crawl")) terms.add("website crawler");
  if (lower.includes("people") || lower.includes("person") || lower.includes("founder") || lower.includes("ceo") || lower.includes("owner") || lower.includes("decision maker")) {
    terms.add("linkedin people scraper"); terms.add("people finder");
  }
  if (lower.includes("email") || lower.includes("contact")) terms.add("email finder");
  if (lower.includes("phone")) terms.add("phone number finder");
  if (lower.includes("review")) terms.add("review scraper");
  if (lower.includes("glassdoor")) terms.add("glassdoor scraper");
  if (lower.includes("yellow pages")) terms.add("yellow pages scraper");
  if (lower.includes("facebook") || lower.includes("instagram") || lower.includes("social")) terms.add("social media scraper");
  if (lower.includes("crunchbase")) terms.add("crunchbase scraper");
  if (lower.includes("amazon")) terms.add("amazon scraper");

  // ALWAYS include essential categories needed for most lead gen pipelines
  terms.add("contact email extractor");
  terms.add("linkedin people search");
  terms.add("google search scraper");
  terms.add("linkedin company scraper");

  // If very few terms, add generic
  if (terms.size < 4) terms.add("lead generation scraper");

  return [...terms].slice(0, 10); // Cap at 10 searches
}

function categorizeActor(title: string, desc: string): string {
  const text = `${title} ${desc}`.toLowerCase();
  if (text.includes("indeed") || (text.includes("job") && (text.includes("scraper") || text.includes("search")))) return "hiring_intent";
  if (text.includes("linkedin job")) return "hiring_intent";
  if (text.includes("google maps") || text.includes("yelp") || text.includes("yellow pages") || text.includes("local business")) return "local_business";
  if (text.includes("linkedin company") || text.includes("linkedin profile") || text.includes("company data") || text.includes("company scraper")) return "company_data";
  if (text.includes("linkedin people") || text.includes("people search") || text.includes("people finder") || text.includes("person")) return "people_data";
  if (text.includes("email") || text.includes("contact") || text.includes("enrich") || text.includes("phone")) return "enrichment";
  if (text.includes("website") || text.includes("crawl") || text.includes("content")) return "website_data";
  if (text.includes("google search") || text.includes("search engine") || text.includes("serp")) return "web_search";
  return "other";
}

// ════════════════════════════════════════════════════════════════
// ██  BUILD PIPELINE PLANNER PROMPT — Logic-first, dynamic actors only
// ════════════════════════════════════════════════════════════════

function buildPipelinePlannerPrompt(discoveredActors: ActorEntry[]): string {
  const catalogDescription = discoveredActors.map((actor, idx) => {
    const params = Object.entries(actor.inputSchema)
      .slice(0, 8) // Limit params shown to keep prompt manageable
      .map(([name, s]) => {
        let desc = `${name} (${s.type}${s.required ? ", REQUIRED" : ""})`;
        if (s.default !== undefined) desc += ` [default: ${JSON.stringify(s.default)}]`;
        desc += ` — ${s.description}`;
        return `     ${desc}`;
      })
      .join("\n");
    const outputs = Object.entries(actor.outputFields)
      .map(([key, paths]) => {
        const status = paths.length === 0 ? "NOT AVAILABLE" : paths.slice(0, 3).join(" | ");
        return `     ${key} ← ${status}`;
      })
      .join("\n");
    const popularity = `(${actor.monthlyUsers || 0} users, ${actor.totalRuns || 0} runs, rating: ${actor.rating || "N/A"})`;
    return `${idx + 1}. key: "${actor.key}" — ${actor.label} [${actor.category}] ${popularity}
   Actor ID: ${actor.actorId}
   ${actor.description}
   Input params:
${params}
   Output fields:
${outputs}`;
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

### Step 3: ACTOR SELECTION — Map actors to stages
For each scrape stage, select the BEST actor from the AVAILABLE ACTORS list below.

CRITICAL ACTOR SELECTION RULES:
- ONLY use actors from the list below. Do NOT invent actor keys.
- If NO actor fits a planned stage → REDESIGN the flow to skip it or use a different approach
- If the flow can't work at all → REDESIGN the logic entirely
- If the goal is truly IMPOSSIBLE with available actors → include "infeasible_reason" explaining why
- PREFER actors with more users, more runs, and higher ratings (they're more reliable)
- When two actors do similar things, pick the one with better stats

## AVAILABLE ACTORS (discovered from Apify Store — these are your ONLY options)

${catalogDescription}

## PIPELINE STAGE SCHEMA

For "scrape" stages:
{
  "stage": <number>,
  "name": "<human-readable stage name>",
  "type": "scrape",
  "actors": ["<actor_key>"],
  "params_per_actor": { "<actor_key>": { <input params> } },
  "input_from": "<field_name>" | null,
  "search_titles": ["CEO", "Founder"],  // only for people search actors
  "dedup_after": true|false,
  "updates_fields": ["field1", "field2"],
  "search_query": "keyword OR keyword2",
  "expected_output_count": <number>,
  "input_transform": "linkedin_url_discovery" // special: for Google Search to find LinkedIn URLs
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

## DATA FLOW RULES (CRITICAL)

Before designing each stage, check what data PREVIOUS stages actually produce:

1. Check each actor's output fields. Fields with "NOT AVAILABLE" (empty []) mean that actor does NOT output that data.
2. NEVER use input_from with a field that won't be populated by a preceding stage.
3. If a required field isn't available, INSERT an intermediate stage:
   - Missing LinkedIn URLs: Add a web_search actor stage with queries like "COMPANY_NAME site:linkedin.com/company" using input_transform: "linkedin_url_discovery"
   - Missing websites: Add a web_search actor stage with company name queries
4. Map out which fields each stage produces and which each subsequent stage needs. NO GAPS.
5. People search actors can work with company_name — the processor builds LinkedIn search URLs from company names. Use input_from: "company_name".

## COST EFFECTIVENESS RULES

- Each actor run costs ~$0.001 per result scraped
- AI filtering costs ~$0.001 per lead evaluated
- ALWAYS start with the most CONSTRAINED source (fewest results that are most relevant)
- ALWAYS filter aggressively BEFORE expensive enrichment stages
- PREFER actors with higher popularity scores (more reliable)
- Total pipeline cost should be MINIMIZED while achieving the goal

## PIPELINE DESIGN RULES

1. Start with the NARROWEST source — the one that gives the most relevant, smallest dataset
2. AI filter stages come after discovery — narrow by company type/industry BEFORE enrichment
3. Company enrichment comes AFTER filtering
4. Person-finding is near-last — only on qualified companies
5. Contact enrichment is ALWAYS the last scrape stage
6. input_from tells the processor which field from existing leads to use as actor input:
   - "company_linkedin_url" → uses LinkedIn company URLs
   - "website" → uses website URLs
   - "company_name" → uses company names
   - null for stage 1 (uses search_query directly)
7. search_query supports OR syntax: "SDR OR BDR OR Sales Rep"
8. Set reasonable limits in stage 1 params
9. NEVER set splitByLocation: true for any LinkedIn actor
10. For hiring intent, try to use multiple job board actors in stage 1 for broader coverage
11. Include dedup_after: true for stage 1

## DECISION MAKER SELECTION

When finding people, select titles based on target company size:
- Small (1-20 employees): CEO, Founder, Owner, Managing Director
- Medium (20-200): VP/Director of relevant department
- Large (200+): C-suite or VP in the relevant department

## OUTPUT FORMAT

Return ONLY a valid JSON object:
{
  "signal_name": "<short descriptive name>",
  "logic_reasoning": "<1-2 sentences explaining why this approach is most cost-effective>",
  "pipeline": [ <array of stage objects> ],
  "infeasible_reason": null | "<explanation if the goal can't be achieved>"
}

No markdown, no explanation, just the JSON.`;
}

// ════════════════════════════════════════════════════════════════
// ██  POST-GENERATION VALIDATION — Data Flow Check
// ════════════════════════════════════════════════════════════════

function validateDataFlow(pipeline: any[]): { valid: boolean; issues: string[]; fixedPipeline: any[] } {
  const issues: string[] = [];
  let fixedPipeline = [...pipeline];

  // Track which fields are populated after each stage
  // PESSIMISTIC: a field is only "reliably populated" if ALL actors in the stage output it
  const populatedFields = new Set<string>();

  const stage1 = pipeline[0];
  if (stage1?.type === "scrape" && stage1.actors) {
    const fieldsByActor: Map<string, Set<string>> = new Map();
    for (const actorKey of stage1.actors) {
      const actor = getActor(actorKey);
      if (!actor) continue;
      const actorFields = new Set<string>();
      for (const [field, paths] of Object.entries(actor.outputFields)) {
        if (paths.length > 0) actorFields.add(field);
      }
      fieldsByActor.set(actorKey, actorFields);
    }

    if (fieldsByActor.size > 0) {
      if (fieldsByActor.size === 1) {
        const [, fields] = [...fieldsByActor.entries()][0];
        fields.forEach(f => populatedFields.add(f));
      } else {
        // Only fields ALL actors output are reliably available
        const allActorFields = [...fieldsByActor.values()];
        const firstActorFields = allActorFields[0];
        for (const field of firstActorFields) {
          if (allActorFields.every(af => af.has(field))) {
            populatedFields.add(field);
          }
        }
      }
    }
  }

  for (let i = 1; i < fixedPipeline.length; i++) {
    const stage = fixedPipeline[i];

    if (stage.type === "scrape" && stage.input_from) {
      const requiredField = stage.input_from;

      if (requiredField === "company_linkedin_url" && !populatedFields.has("linkedin")) {
        const alreadyHasDiscovery = fixedPipeline.some(
          (s: any, j: number) => j < i && s.input_transform === "linkedin_url_discovery"
        );

        if (!alreadyHasDiscovery) {
          // Find a web_search actor in discovered actors
          const searchActor = [...discoveredActorMap.values()].find(a => a.category === "web_search");
          const searchActorKey = searchActor?.key || "google_search";

          issues.push(`Stage ${stage.stage} needs company_linkedin_url but no previous stage provides it. Injecting LinkedIn URL discovery stage.`);

          const discoveryStage = {
            stage: stage.stage,
            name: "Discover LinkedIn URLs via Google Search",
            type: "scrape",
            actors: [searchActorKey],
            params_per_actor: { [searchActorKey]: { maxPagesPerQuery: 1, resultsPerPage: 3 } },
            input_from: "company_name",
            input_transform: "linkedin_url_discovery",
            updates_fields: ["company_linkedin_url"],
            expected_output_count: stage.expected_output_count || 100,
          };

          fixedPipeline.splice(i, 0, discoveryStage);
          fixedPipeline = fixedPipeline.map((s: any, idx: number) => ({ ...s, stage: idx + 1 }));
          populatedFields.add("linkedin");
          i++;
        }
      }

      for (const actorKey of (stage.actors || [])) {
        const actor = getActor(actorKey);
        if (!actor) continue;
        for (const [field, paths] of Object.entries(actor.outputFields)) {
          if (paths.length > 0) populatedFields.add(field);
        }
      }
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

  // Check for data flow issues
  const dataFlowCheck = validateDataFlow(pipeline);
  for (const issue of dataFlowCheck.issues) {
    warnings.push(`🔗 ${issue}`);
  }

  // Check for splitByLocation: true (known to fail)
  for (const stage of pipeline) {
    const params = stage.params_per_actor || {};
    for (const actorParams of Object.values(params)) {
      if ((actorParams as any)?.splitByLocation === true) {
        warnings.push("⚠️ splitByLocation is enabled on a LinkedIn actor — this often returns 0 results.");
      }
    }
  }

  // Check for unknown actors
  for (const stage of pipeline) {
    if (stage.type === "scrape" && stage.actors) {
      for (const actorKey of stage.actors) {
        if (!getActor(actorKey)) {
          warnings.push(`⚠️ Actor "${actorKey}" not found in discovered actors — it may fail at runtime.`);
        }
      }
    }
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
        currentCount = stage.expected_output_count || 1000;
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

  // Step 1: Discover relevant actors from Apify Store (ONLY source — no fallback catalog)
  let discoveredActors: ActorEntry[] = [];
  try {
    discoveredActors = await discoverActors(query, serviceClient);
    console.log(`Discovered ${discoveredActors.length} actors from Apify Store`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `Actor discovery failed: ${errMsg}. Cannot plan without actors.` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Populate the global actor map so validateDataFlow and other functions can use it
  discoveredActorMap = new Map(discoveredActors.map(a => [a.key, a]));

  let systemPrompt = buildPipelinePlannerPrompt(discoveredActors);

  // Inject advanced settings
  if (advanced_settings) {
    const maxResults = advanced_settings.max_results_per_source || 2500;
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

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
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
    if (status === 429) return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

  // Handle infeasible response
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
          actors: [p.source || p.actors?.[0]], params_per_actor: p.params_per_actor || {},
          input_from: null, search_query: p.search_query, dedup_after: true,
          expected_output_count: p.expected_output_count || 1000,
        })),
      };
    } else {
      throw new Error("AI returned unexpected format. Please try again.");
    }
  }

  // Validate actor keys — must exist in discovered actors
  for (const stage of parsedPlan.pipeline) {
    if (stage.type === "scrape" && stage.actors) {
      stage.actors = stage.actors.filter((key: string) => {
        if (discoveredActorMap.has(key)) return true;
        console.warn(`Unknown actor "${key}" removed from pipeline — not in discovered actors`);
        return false;
      });
      if (stage.actors.length === 0) {
        // Try to find a similar actor in discovered set
        const fallbackActor = [...discoveredActorMap.values()].find(a => a.category === "web_search");
        if (fallbackActor) {
          console.warn(`Stage ${stage.stage} had no valid actors, using ${fallbackActor.key} as fallback`);
          stage.actors = [fallbackActor.key];
        }
      }
    }
  }

  // Force disable splitByLocation on any actor
  for (const stage of parsedPlan.pipeline) {
    const params = stage.params_per_actor || {};
    for (const actorKey of Object.keys(params)) {
      if (params[actorKey]?.splitByLocation === true) {
        params[actorKey].splitByLocation = false;
        delete params[actorKey].splitCountry;
      }
    }
  }

  // Apply advanced settings caps
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
      }
    }
  }

  // Validate data flow and auto-fix
  const dataFlowResult = validateDataFlow(parsedPlan.pipeline);
  if (!dataFlowResult.valid) {
    console.log("Data flow issues detected and fixed:", dataFlowResult.issues);
    parsedPlan.pipeline = dataFlowResult.fixedPipeline;
  }

  // Build actor_registry — embed full actor details in the plan for the processor
  const usedActorKeys = new Set<string>();
  for (const stage of parsedPlan.pipeline) {
    if (stage.actors) stage.actors.forEach((a: string) => usedActorKeys.add(a));
  }
  const actorRegistry: Record<string, ActorEntry> = {};
  for (const key of usedActorKeys) {
    const actor = discoveredActorMap.get(key);
    if (actor) actorRegistry[key] = actor;
  }
  parsedPlan.actor_registry = actorRegistry;

  // Validate and warn
  const warnings = validatePipelinePlan(parsedPlan, query);

  // Cost estimation
  const { totalCredits, totalEstimatedRows, totalEstimatedLeads, stageFunnel } = estimatePipelineCost(parsedPlan.pipeline);
  const costPerLead = totalEstimatedLeads > 0 ? (totalCredits / totalEstimatedLeads).toFixed(1) : "N/A";

  const signalName = parsedPlan.signal_name || "Signal";
  const pipelineStageCount = parsedPlan.pipeline.length;

  const sourceLabels = [...usedActorKeys].map(k => discoveredActorMap.get(k)?.label || k);

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
      logic_reasoning: parsedPlan.logic_reasoning || null,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
