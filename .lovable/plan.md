

# Option C: Verified Actor Catalog + Individual Pre-flight Validation

## Core Design Principle

The planner designs the **logical flow first** (stages, data dependencies, field requirements) without being constrained by which actors exist. Then a resolution layer maps each stage to either a verified actor or a dynamically-discovered one. Non-verified actors go through individual pre-flight validation before the pipeline executes.

## Architecture

```text
User Query
  ↓
AI Planner → Logical Pipeline (stage types + required I/O fields, NO actor keys)
  ↓
Actor Resolution Layer
  ├─ Stage needs "google_maps" scrape → Check VERIFIED_ACTORS → Found → Use directly
  ├─ Stage needs "people_data" scrape → Check VERIFIED_ACTORS → Found → Use directly
  └─ Stage needs "crunchbase" scrape → Not in catalog → Dynamic discovery → Pre-flight test
  ↓
Pre-flight Validator (per-actor, NOT end-to-end)
  ├─ Actor A: Run maxItems:1 → Got results? → Map output fields → Passes?
  ├─ Actor B: Run maxItems:1 → Got results? → Map output fields → Passes?
  └─ Actor C: Failed pre-flight → Try backup → Backup passed → Use backup
  ↓
Execute Pipeline (same process-signal-queue logic)
```

## Changes

### 1. `signal-planner/index.ts` — Verified Actor Catalog + Two-Phase Planning

**Add `VERIFIED_ACTORS` constant** (~15 actors with hardcoded schemas and output mappings):

```typescript
const VERIFIED_ACTORS: Record<string, VerifiedActor> = {
  // Google Maps
  "compass/crawler-google-places": {
    actorId: "compass/crawler-google-places",
    category: "local_business",
    subCategory: "local_business:google_maps",
    label: "Google Maps Places Scraper",
    inputSchema: {
      searchStringsArray: { type: "string[]", required: true, description: "Search queries" },
      maxCrawledPlacesPerSearch: { type: "number", required: false, default: 100, description: "Max results per search" },
      language: { type: "string", required: false, default: "en" },
      // ... complete known schema
    },
    outputFields: { company_name: ["title"], website: ["website"], phone: ["phone"], ... },
    inputBuilder: (keyword, params) => ({ searchStringsArray: [keyword], ...params }),
  },
  // Indeed Jobs
  "hMvNSpz3JnHgl5jkh": { ... },
  // LinkedIn Jobs  
  "BHzefUZlZRKWxkTck": { ... },
  // LinkedIn People Search
  "2SyF0bVxmgQr8SsLY": { ... },
  // LinkedIn Company Scraper
  "voyager/linkedin-company-scraper": { ... },
  // Google Search
  "nFJndFXA5OrgE5r0M": { ... },
  // Apollo People Enrichment (if accessible)
  // Glassdoor
  // Yelp
  // ... etc
};
```

**Modify the AI planner prompt** to produce a **logical pipeline** with `stage_category` instead of actor keys:

The planner will output stages like:
```json
{
  "stage": 1,
  "type": "scrape",
  "stage_category": "local_business:google_maps",
  "required_input_fields": [],
  "expected_output_fields": ["company_name", "website", "phone", "location"],
  "params": { "searchStringsArray": ["plumbing companies Austin TX"], "maxCrawledPlacesPerSearch": 100 }
}
```

**Add Actor Resolution Layer** — after AI generates the logical plan:
1. For each `scrape` stage, look up `stage_category` in `VERIFIED_ACTORS`
2. If found → assign the verified actor directly (no discovery needed)
3. If not found → search dynamic actor library (existing `discoverActors`) for that category
4. If dynamic actor found → mark it for pre-flight validation
5. If nothing found → fail the stage with actionable error

**Only discover actors dynamically for stages that need them** — verified actors skip the Apify Store API entirely, saving time and avoiding schema fetch failures.

### 2. `signal-planner/index.ts` — Per-Actor Pre-flight Validation

**Add `preflightValidateActor` function** that runs BEFORE the pipeline is saved:

For each non-verified actor in the resolved pipeline:
1. Start an Apify run with `maxItems: 1` using the stage's actual params
2. Wait for completion (with 30s timeout)
3. Collect the single result
4. Map the result through `normaliseGenericResults` using `UNIVERSAL_OUTPUT_PATHS`
5. Check which of the stage's `expected_output_fields` are populated in the normalized result
6. **Cross-check against next stage's `required_input_fields`** — if the next stage needs `company_linkedin_url` and this actor's output doesn't produce it, the pre-flight fails

The pre-flight does NOT flow data through the full pipeline. Each actor is tested individually:
- Actor A tested with real input → output fields checked against what Stage 2 needs
- Actor B tested with its own test input → output fields checked against what Stage 3 needs
- If Actor A pre-flight fails → try next dynamic actor in same category → if that passes, swap it in

**Pre-flight does NOT fail if the 1-item result gets filtered** — it only validates that the actor can:
1. Start successfully (not rental-blocked)
2. Return at least 1 result
3. Produce output fields that map to what downstream stages need

### 3. `process-signal-queue/index.ts` — Use Verified Actor Input Builders

**Add verified actor awareness to `pipelineScrapeStarting`**:

When building input for a stage, check if the actor is in `VERIFIED_ACTORS`:
- If yes → use the `inputBuilder` function to construct params deterministically (no schema guessing)
- If no → use existing `buildGenericInput` logic (dynamic)

This eliminates the schema-fetch-at-runtime problem for the ~15 most common actors.

### 4. Planner Prompt Changes

The key change: the AI prompt will describe **stage categories** with their expected I/O, not specific actor keys. The prompt will say:

```
Design a pipeline using these STAGE TYPES:
- local_business:google_maps → Inputs: search query. Outputs: company_name, website, phone, location, email
- hiring_intent:indeed → Inputs: job title, location. Outputs: company_name, title, location, industry
- hiring_intent:linkedin → Inputs: search URL. Outputs: company_name, title, location, linkedin
- people_data:linkedin → Inputs: company_name OR company_linkedin_url. Outputs: contact_name, linkedin_profile, title
- company_data:linkedin → Inputs: company_linkedin_url. Outputs: industry, employee_count, website
- web_search:google → Inputs: search queries. Outputs: website, description
- enrichment:contact → Inputs: website OR domain. Outputs: email, phone
```

The AI picks stage categories. The resolution layer maps them to real actors. This means the AI can't hallucinate actor keys — it can only pick from known stage categories, and the system handles actor selection.

## Files Modified

1. **`supabase/functions/signal-planner/index.ts`** — Major changes:
   - Add `VERIFIED_ACTORS` catalog (~200 lines)
   - Rewrite planner prompt to use stage categories
   - Add actor resolution layer
   - Add `preflightValidateActor` function
   - Keep dynamic discovery as fallback only

2. **`supabase/functions/process-signal-queue/index.ts`** — Minor changes:
   - Import and use verified actor input builders in `pipelineScrapeStarting`
   - Skip runtime schema fetch for verified actors

## What This Solves

- **Schema failures**: Verified actors have hardcoded schemas — no runtime fetch needed
- **Actor hallucination**: AI picks categories, not keys — impossible to hallucinate
- **New flow failures**: Dynamic actors get pre-flight tested before credits are spent
- **Pre-flight false failures**: Each actor tested individually, not as a chain — a filtered-out result at stage 2 doesn't fail stage 1's pre-flight

## Estimated Size

- `VERIFIED_ACTORS` catalog: ~250 lines
- Planner prompt rewrite: ~100 lines changed
- Actor resolution layer: ~80 lines
- Pre-flight validator: ~100 lines
- Process-signal-queue changes: ~30 lines

