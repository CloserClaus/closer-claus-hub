

## Plan: Rebuild Signal Scraper as an Adaptive, Output-Aware Pipeline

### The Core Problem

The planner blindly chains stages without checking whether the chosen actors' outputs contain the data the next stage needs. Example: Indeed outputs no `company_linkedin_url`, but the pipeline chains `linkedin_companies` with `input_from: "company_linkedin_url"` -- guaranteed to produce 0 results. The hardcoded 14-actor catalog also limits the AI from finding better-suited actors.

### Architecture Overhaul — Three Changes

---

### Change 1: Dynamic Actor Discovery via Apify Store API

**Instead of** a hardcoded `ACTOR_CATALOG`, the planner will:

1. **Search Apify's Store API** during planning to find actors relevant to the task:
   ```
   GET https://api.apify.com/v2/store?search=<query>&limit=10&sortBy=popularity
   ```
2. **Fetch input schemas** for top candidates:
   ```
   GET https://api.apify.com/v2/acts/<actorId>/input-schema
   ```
3. **Rank by** monthly users, total runs, and user rating
4. **Cache** discovered actors in a `signal_actor_cache` DB table (TTL: 7 days) so we don't re-query the store on every planning call
5. **Keep the current catalog as a fallback/seed** — if the store API is down or returns nothing, use the known actors

The AI planner receives both the cached catalog AND freshly discovered actors, with metadata (user count, rating, description, input schema). It picks the best actor for each stage.

**Edge case**: Unknown actors may have unpredictable output formats. Mitigation: the quality check in Change 3 catches this — if a dynamically-selected actor returns garbage, the pipeline adapts or aborts.

**File**: `supabase/functions/signal-planner/index.ts` — add `discoverActors(taskDescription)` function, update `handleGeneratePlan` to call it before AI planning.

**New migration**: Create `signal_actor_cache` table (actor_id, metadata JSON, input_schema JSON, output_sample JSON, cached_at timestamp).

---

### Change 2: Output-Aware Flow Planning

The planner prompt must enforce a **data dependency chain**. Currently it says "use `input_from: company_linkedin_url`" without checking if that field will exist.

New rules injected into the planner prompt:

```
## DATA FLOW RULES (CRITICAL)

Before designing each stage, check what data the PREVIOUS stages actually produce:

1. For each actor you plan to use, check its OUTPUT FIELDS.
2. For each subsequent stage, verify that its `input_from` field will be 
   populated by a preceding stage's actor outputs.
3. If a required field won't be available (e.g., Indeed doesn't output 
   linkedin URLs), you MUST insert an intermediate stage that discovers 
   that data. Options:
   - google_search with "site:linkedin.com/company <company_name>" to find LinkedIn URLs
   - website_crawler to extract LinkedIn links from company websites
4. NEVER chain a stage that requires `input_from: "company_linkedin_url"` 
   unless a previous stage's actor has `linkedin` in its outputFields 
   with non-empty paths, OR you've added a discovery stage.
5. Prefer actors whose OUTPUTS match what downstream stages NEED.
```

Add a **post-generation validation** step in `handleGeneratePlan` that programmatically checks the data flow:
- For each stage with `input_from`, verify the field is in the output of at least one actor from a previous scrape stage
- If not, inject a LinkedIn URL discovery stage automatically (google_search with `site:linkedin.com/company`)

**File**: `supabase/functions/signal-planner/index.ts` — update prompt, add `validateDataFlow(pipeline)` function.

---

### Change 3: Inter-Stage Quality Validation (Adaptive Pipeline)

After each scrape stage completes and data is collected, **before advancing to the next stage**, the processor:

1. **Samples 15 results** from the collected data
2. **Sends them to AI** with the original user query and asks:
   - "Does this data look relevant to the user's goal?"
   - "Does this data contain the fields needed for the next stage?"
   - "Rate quality: HIGH / MEDIUM / LOW / USELESS"
3. **Three outcomes**:
   - **HIGH/MEDIUM**: Continue to next stage as planned
   - **LOW**: Data is salvageable but downstream flow needs adjustment → AI generates a revised pipeline for remaining stages, updates `signal_plan` in DB, continues
   - **USELESS**: Data is not useful → abort this branch. If this is stage 1, mark run as failed with a human-readable explanation. If stage 2+, try alternative actors for the current stage (if available from the original plan)

4. **Infeasibility detection**: If the AI determines the goal cannot be achieved with available scrapers, the run is marked `failed` with a clear user-facing message (e.g., "Could not find marketing agencies from the job board results — most results were unrelated industries").

New sub-phase in the pipeline processor: `stage_N_validating` (runs between `collecting` and advancing to next stage).

**File**: `supabase/functions/process-signal-queue/index.ts` — add `pipelineQualityCheck()` function, add `stage_N_validating` phase handling.

**New DB column**: `signal_runs.pipeline_adjustments` (JSONB, tracks mid-run flow changes for debugging).

---

### Edge Cases Handled

1. **Apify Store API down**: Falls back to the existing hardcoded catalog
2. **Dynamic actor returns unexpected format**: Quality check catches it at stage validation; pipeline adapts or aborts
3. **Infinite retry loops**: Max 1 flow reconfiguration per stage, max 1 full restart per run
4. **Quality check is too strict/lenient**: Uses `ai_strictness` setting from advanced settings to calibrate
5. **Cost spiral from restarts**: Track total credits consumed across retries; abort if > 2x estimated cost
6. **Stage 1 returns 0 results**: Immediately fail with explanation instead of running empty downstream stages
7. **All actors for a task are paid/premium**: Flag in the planning response so user can decide

### Migration

```sql
-- Cache for dynamically discovered Apify actors
CREATE TABLE public.signal_actor_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text NOT NULL UNIQUE,
  actor_key text,
  label text,
  category text,
  description text,
  input_schema jsonb DEFAULT '{}',
  output_sample jsonb DEFAULT '{}',
  monthly_users integer DEFAULT 0,
  total_runs integer DEFAULT 0,
  rating numeric(3,2),
  cached_at timestamptz DEFAULT now()
);

-- Track mid-run pipeline adjustments  
ALTER TABLE public.signal_runs 
  ADD COLUMN IF NOT EXISTS pipeline_adjustments jsonb DEFAULT '[]';
```

### Files to Modify

1. **`supabase/functions/signal-planner/index.ts`** — Dynamic actor discovery, output-aware prompt rules, data flow validation, expanded catalog
2. **`supabase/functions/process-signal-queue/index.ts`** — Inter-stage quality validation, adaptive pipeline reconfiguration, zero-result handling

### What This Solves

- **Wrong companies**: Quality check after stage 1 catches irrelevant results early
- **Missing names**: Data flow validation ensures LinkedIn People stage only runs when LinkedIn URLs exist (or inserts a discovery stage to find them)
- **Wrong company sizes**: Quality check validates size data is present before advancing
- **Wasted credits on bad data**: Early abort + adaptive flow prevents processing garbage through 6 stages
- **Limited actor selection**: Dynamic discovery finds the best actor for each task from Apify's full catalog

