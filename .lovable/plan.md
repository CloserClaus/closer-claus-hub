

# System Viability Assessment & Renovation Plan

## Verdict

The core architecture (Apify + AI planner + multi-stage pipeline + quality checks + auto-retry) is **sound and sufficient** for the intended purpose. You do NOT need additional third-party services. However, the system has **5 structural gaps** that will cause repeated failures across diverse prompts, and the Advanced Settings are oriented around system internals rather than what users actually care about.

---

## Gap Analysis

### 1. Location is hardcoded — the biggest silent failure source

`parseSearchIntent()` in `process-signal-queue/index.ts` line 165 hardcodes `location: "United States"`. Geography IS extracted by the planner (`extractGeography()`), but it's embedded in the AI plan's `params` — and then the Query Normalization Engine **overwrites it** with `intent.location` which defaults to "United States". A user searching "marketing agencies in London" gets US results.

### 2. No user-facing location/company-size controls

Users think in terms of: "I want **50 leads** of **CEOs** at **10-50 employee** companies in the **marketing industry** in **Texas**." The current Advanced Settings expose scraper internals (`max_results_per_source`, `date_range`, `ai_strictness`) instead of user intent. The AI prompt has to infer all of this from free text, which is unreliable.

### 3. People-search match rate is structurally low

The scored matching system (lines 1946-2012) matches person results to companies by domain/name. But LinkedIn People Search returns results where `companyName` is the person's *current* company, which may differ from the lead's company name. Match rates below 20% are common and logged but not fixed. The system should use Apollo (already integrated elsewhere in the platform) as a reliable fallback for person enrichment.

### 4. No feedback from completed runs

When a run completes with poor results, the user can only rerun the exact same query. There's no mechanism to say "results were wrong industry" or "too many large companies" and have the system adjust.

### 5. Credit estimation drifts from actuals

Credits are deducted upfront at plan time (line 967-969 in planner), then recalculated at finalization (lines 2383-2406 in worker). But the recalculation uses `expected_output_count` from the plan — not actual Apify usage. If the actual run scraped 2000 rows but the plan said 500, the user is undercharged. If the run scraped 50 but the plan said 500, they're overcharged. Neither case is reconciled.

---

## Renovation Plan

### A. Fix location passthrough (Critical — 1 file)

**`supabase/functions/process-signal-queue/index.ts`**

Update `parseSearchIntent()` to extract location from `stageDef.params` or `stageDef.params_per_actor` instead of hardcoding "United States". The planner already puts location in actor params — the normalization engine just ignores it.

Also update `buildPlatformSearchQuery()` to use `existingParams.location` as the primary source, not `intent.location`.

### B. Restructure Advanced Settings to match user mental model (2 files)

**`src/components/leads/SignalScraperTab.tsx`** — Replace current settings with:

```text
Current (system-oriented):         Proposed (user-oriented):
─────────────────────────          ─────────────────────────
Max results per source: 2500       Target leads: 50 / 100 / 250 / 500
Date range: past_week              Location: [text input, optional]
AI strictness: medium              Company size: Any / 1-10 / 11-50 / 51-200 / 200+
                                   Decision maker titles: [multi-select or text]
                                   Date range: past_week  (keep)
                                   Quality: Standard / High  (simplified strictness)
```

The system translates user intent into scraper settings internally:
- "Target leads: 100" → `max_results_per_source` = 100 * 5 (assuming ~20% pass rate)
- "Company size: 11-50" → injected into AI filter prompt
- "Location: Texas" → passed to query normalization engine
- "Decision maker titles: CEO, Founder" → `search_titles` override

**`supabase/functions/signal-planner/index.ts`** — Update the advanced settings injection (lines 1019-1039) to receive and apply the new structured fields.

### C. Use Apollo as person-enrichment fallback (1 file)

**`supabase/functions/process-signal-queue/index.ts`**

After the LinkedIn people search stage, if match rate is below 30%, trigger an Apollo enrichment batch using the existing `apollo-enrich` edge function. The platform already has Apollo integration — this is just wiring it into the pipeline as a fallback. This addresses the structural weakness in LinkedIn people matching without replacing it.

### D. Reconcile credit actuals (1 file)

**`supabase/functions/process-signal-queue/index.ts`** — In `pipelineFinalize()`, calculate actual credits from real Apify dataset sizes (already available from `collectApifyResults` counts stored in refs) instead of plan estimates. Refund or charge the delta against the upfront deduction.

### E. Add "refine results" action (2 files)

**`src/components/leads/SignalSc

<lov-plan>

# System Viability Assessment & Renovation Plan

## Verdict

The core architecture (Apify + AI planner + multi-stage pipeline + quality checks + auto-retry) is **sound and sufficient** for the intended purpose. You do NOT need additional third-party services. However, the system has **5 structural gaps** that will cause repeated failures across diverse prompts, and the Advanced Settings are oriented around system internals rather than what users actually care about.

---

## Gap Analysis

### 1. Location is hardcoded — the biggest silent failure source

`parseSearchIntent()` in `process-signal-queue/index.ts` line 165 hardcodes `location: "United States"`. Geography IS extracted by the planner (`extractGeography()`), but it's embedded in the AI plan's `params` — and then the Query Normalization Engine **overwrites it** with `intent.location` which defaults to "United States". A user searching "marketing agencies in London" gets US results.

### 2. No user-facing location/company-size controls

Users think in terms of: "I want **50 leads** of **CEOs** at **10-50 employee** companies in the **marketing industry** in **Texas**." The current Advanced Settings expose scraper internals (`max_results_per_source`, `date_range`, `ai_strictness`) instead of user intent. The AI prompt has to infer all of this from free text, which is unreliable.

### 3. People-search match rate is structurally low

The scored matching system (lines 1946-2012) matches person results to companies by domain/name. But LinkedIn People Search returns results where `companyName` is the person's *current* company, which may differ from the lead's company name. Match rates below 20% are common and logged but not fixed. The system should use Apollo (already integrated elsewhere in the platform) as a reliable fallback for person enrichment.

### 4. No feedback from completed runs

When a run completes with poor results, the user can only rerun the exact same query. There's no mechanism to say "results were wrong industry" or "too many large companies" and have the system adjust.

### 5. Credit estimation drifts from actuals

Credits are deducted upfront at plan time (line 967-969 in planner), then recalculated at finalization (lines 2383-2406 in worker). But the recalculation uses `expected_output_count` from the plan — not actual Apify usage. If the actual run scraped 2000 rows but the plan said 500, the user is undercharged. If the run scraped 50 but the plan said 500, they're overcharged. Neither case is reconciled.

---

## Renovation Plan

### A. Fix location passthrough (Critical — 1 file)

**`supabase/functions/process-signal-queue/index.ts`**

Update `parseSearchIntent()` to extract location from `stageDef.params` or `stageDef.params_per_actor` instead of hardcoding "United States". The planner already puts location in actor params — the normalization engine just ignores it.

Also update `buildPlatformSearchQuery()` to use `existingParams.location` as the primary source, not `intent.location`.

### B. Restructure Advanced Settings to match user mental model (2 files)

**`src/components/leads/SignalScraperTab.tsx`** — Replace current settings with:

```text
Current (system-oriented):         Proposed (user-oriented):
─────────────────────────          ─────────────────────────
Max results per source: 2500       Target leads: 50 / 100 / 250 / 500
Date range: past_week              Location: [text input, optional]
AI strictness: medium              Company size: Any / 1-10 / 11-50 / 51-200 / 200+
                                   Decision maker titles: [multi-select or text]
                                   Date range: past_week  (keep)
                                   Quality: Standard / High  (simplified strictness)
```

The system translates user intent into scraper settings internally:
- "Target leads: 100" → `max_results_per_source` = 100 * 5 (assuming ~20% pass rate)
- "Company size: 11-50" → injected into AI filter prompt
- "Location: Texas" → passed to query normalization engine directly
- "Decision maker titles: CEO, Founder" → `search_titles` override

**`supabase/functions/signal-planner/index.ts`** — Update the advanced settings injection (lines 1019-1039) to receive and apply the new structured fields as explicit constraints rather than hints to the AI.

### C. Use Apollo as person-enrichment fallback (1 file)

**`supabase/functions/process-signal-queue/index.ts`**

After the LinkedIn people search stage, if match rate is below 30%, trigger an Apollo enrichment batch using the existing `apollo-enrich` edge function. The platform already has Apollo integration and `APIFY_API_TOKEN` configured — this is just wiring it into the pipeline as a fallback after low-confidence LinkedIn people matching.

### D. Reconcile credit actuals (1 file)

**`supabase/functions/process-signal-queue/index.ts`** — In `pipelineFinalize()`, calculate actual credits from real Apify dataset sizes (track actual collected row counts per stage during collection) instead of plan estimates. Compute the delta against the upfront deduction and refund or charge accordingly.

### E. Add "refine results" action (2 files)

**`src/components/leads/SignalScraperTab.tsx`** — Add a "Refine" button on completed runs that opens a mini-form: "What was wrong?" (wrong industry / too large / wrong location / other). This creates a `refinement_context` object stored on the run.

**`supabase/functions/signal-planner/index.ts`** — When `refinement_context` is present on a rerun, inject it into the AI planner prompt as negative constraints: "The previous run returned too many large enterprises. Ensure ai_filter strictly rejects companies with >200 employees."

---

## Priority Order

1. **A (location fix)** — Highest impact, smallest change. Every non-US search is broken today.
2. **B (settings restructure)** — Eliminates the largest class of "AI misinterpreted my query" bugs by making intent explicit.
3. **C (Apollo fallback)** — Fixes the structurally low person match rates that reduce lead quality.
4. **D (credit reconciliation)** — Fairness fix, prevents user complaints.
5. **E (refine action)** — Quality-of-life improvement that compounds over time.

### Summary

No new external services needed. The Apify + AI combination is viable. The gaps are all in **how user intent flows through the system** — location gets lost, company size is guessed, person matching has no fallback, and credits don't reconcile. Fixing these 5 items transforms this from a system that works for specific prompts into one that works reliably across diverse prompts.

