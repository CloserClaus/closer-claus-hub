

## Diagnosis: Why Signal Scraper Returns 0 Leads

### Root Cause: Wrong Apify Actor Input Format

The execution engine sends the **same input format for every actor** (Google Maps style), regardless of which actor is actually being called. Specifically:

```text
Current code (line 286-291):
  actorInput = {
    searchStringsArray: [plan.search_query],    // <-- Google Maps format
    maxCrawledPlacesPerSearch: ...,              // <-- Google Maps param
    language: "en",
    ...plan.search_params                       // <-- AI-hallucinated params
  }
```

The LinkedIn Jobs Scraper (`hMvNSpz3JnHgl5jkh`) expects `keyword`, `location`, `timePosted`, `maxResults` -- not `searchStringsArray`. So Apify receives unrecognized parameters and returns an empty dataset. Credits are still charged (minimum 5).

Additionally, the AI planner generates `search_params` with made-up field names (e.g., `datePosted`, `f_C`, `f_TP`) that don't match any actor's actual API. The planner prompt has zero knowledge of each actor's real input schema.

### Second Problem: Single-Source Pipeline

The user's use case requires a **multi-step pipeline**:
1. Search LinkedIn Jobs for sales hiring signals
2. Get company data (size, industry) from the hiring company
3. Find the founder/CEO of that company

The current system only supports a single Apify actor per run. It cannot chain actors together (Jobs -> Companies -> People).

### Third Problem: No Logging/Debugging

When Apify returns 0 results, there's no visibility. The function silently stores 0 leads and charges credits. Users have no idea what went wrong.

---

## Proposed Fix (Implementation Plan)

### 1. Actor-Specific Input Builders

Replace the generic `actorInput` construction with per-actor input builders that use each actor's real API schema:

```text
function buildActorInput(source, plan) {
  switch(source) {
    case "linkedin_jobs":
      return { keyword: plan.search_query, location: ..., timePosted: ..., maxResults: ... }
    case "google_maps":
      return { searchStringsArray: [...], maxCrawledPlacesPerSearch: ... }
    case "google_search":
      return { queries: [...], maxPagesPerQuery: ... }
    // etc.
  }
}
```

Each builder maps the AI plan's intent to the actor's real parameter names.

### 2. Teach the AI Planner Each Actor's Real Schema

Update the system prompt to include the **exact input parameters** for each actor so the AI generates valid `search_params`. Instead of letting it hallucinate field names, constrain it to known parameters.

### 3. Multi-Step Pipeline Support

Add a `steps` array to the plan schema so the AI can chain actors:

```text
{
  "steps": [
    { "source": "linkedin_jobs", "purpose": "find_hiring_signals", ... },
    { "source": "linkedin_companies", "purpose": "enrich_company_data", ... }
  ],
  "ai_classification": "Filter to marketing agencies with <10 employees, extract founder"
}
```

The execution engine processes steps sequentially, feeding output from step N as input context for step N+1.

### 4. Detailed Run Logging

Add a `run_log` JSONB column to `signal_runs` that captures:
- Raw Apify response count
- Filter pass/fail counts
- AI classification results
- Dedup removals

This gives users (and us) visibility into what happened.

### 5. Don't Charge Credits on 0 Results

If no leads are discovered, don't deduct credits (or refund them). Users shouldn't pay for empty runs caused by misconfigured actors.

### 6. Closer Claus-Specific Improvements

- **Pre-built signal templates**: "Marketing agencies hiring sales reps" as a one-click signal with pre-configured, tested parameters
- **Intent signal library**: Curated list of hiring signals (sales roles, BDR roles) mapped to specific actor configurations that are known to work
- **Founder finder step**: After identifying companies, automatically attempt to find the founder via LinkedIn Companies or Google Search as a second enrichment step

### Files to Change

| File | Change |
|------|--------|
| `supabase/functions/signal-planner/index.ts` | Actor-specific input builders, updated AI prompt with real schemas, multi-step pipeline execution, run logging, zero-result credit protection |
| `supabase/migrations/` | Add `run_log` column to `signal_runs`, add `signal_templates` table |
| `src/components/leads/SignalScraperTab.tsx` | Show run log details, add template quick-picks, show step-by-step progress |

