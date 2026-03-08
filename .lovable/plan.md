

## Plan: Fix Quality Validation Logic and Stage 1 Precision Enforcement

### Problem Summary
The system treats "no relevant signals found in 100 records" as a failure and aborts. In reality, for niche queries (e.g., "marketing agencies hiring SDRs"), 100 records from a job board may contain zero marketing agencies — that's expected, not a bug. The system should tell the user: "Your dataset cap is too small for this niche. Consider increasing max results per source."

Additionally, the planner's Stage 1 Query Precision prompt isn't being followed — the AI still generates broad role-only queries. This needs stronger enforcement.

### Root Cause Analysis
1. **Quality validation doesn't consider dataset cap vs query specificity** — it blindly rates 0 relevant results as "USELESS" and aborts
2. **Zero-result abort in collecting phase is too aggressive** — 0 results from a 100-record cap with no industry filter is a "too small dataset" scenario, not a "bad search" scenario
3. **The planner prompt instructs the AI to use industry filters but doesn't enforce it structurally** — the AI model ignores soft instructions

### Changes

#### File: `supabase/functions/process-signal-queue/index.ts`

**1. Rewrite quality validation to differentiate between "bad search" and "small dataset"**

In `pipelineQualityCheck` (lines 309-434), update the system prompt to include:
- The user's `max_results_per_source` setting (from `run.advanced_settings`)
- The actual Stage 1 actor params (to check if industry filters were applied)
- Explicit instructions: if Stage 1 used the correct filters and the dataset is small, rate as MEDIUM with guidance "increase max results", NOT USELESS

Update the USELESS handling logic:
```
If quality is USELESS:
  1. Check if Stage 1 had industry filters applied (from params_per_actor or search_query)
  2. If YES (filters were applied correctly) AND dataset is small (≤ 500):
     → Don't abort. Rate as "LOW" with message: "The dataset is too small for this niche. 
        Consider increasing max results per source to capture more signals."
     → suggestedAction: "continue" (let downstream stages try to extract value)
  3. If NO (filters were NOT applied) AND dataset is large:
     → This is the real failure case. Abort with message about search terms being too broad.
```

**2. Remove the hard zero-result abort for discovery stages when the cap is low**

In `pipelineScrapeCollecting` (lines 1195-1236), when Stage 1 produces 0 leads:
- Check if this is because all actor runs returned 0, or because actors ran but the cap was very low
- If all actors ran successfully (SUCCEEDED status) but returned 0 items: this is genuinely empty, keep the abort
- The current logic is fine for true zero results — no change needed here

**3. Make the quality check prompt aware of the search configuration**

Pass the following context into the quality check AI prompt:
- `advanced_settings.max_results_per_source` 
- Whether Stage 1 search_query contains industry keywords
- Whether Stage 1 params_per_actor contain industry filter fields
- This lets the AI distinguish "narrow search + small cap = expected low relevance" from "broad search + large cap = bad search"

#### File: `supabase/functions/signal-planner/index.ts`

**4. Add post-generation validation to enforce Stage 1 industry precision**

In `validatePipelinePlan` (lines 657-704), add a new check:
- Extract industry/vertical keywords from the user's query (e.g., "marketing", "SaaS", "healthcare")
- Check if Stage 1's `search_query` contains any of these industry keywords
- Check if Stage 1's `params_per_actor` contains industry filter fields
- If NEITHER contains industry terms but the query clearly specifies one → add a warning AND auto-fix the search_query by prepending the industry term

This is structural enforcement, not prompt-dependent — it catches cases where the AI ignores the prompt instructions.

**5. Add `inferQueryIndustry` helper function**

A simple function that extracts industry/vertical terms from the user's natural language query using keyword matching (not AI). Returns terms like `["marketing agency", "advertising"]` that can be checked against Stage 1 params.

### Summary

| File | Change | Purpose |
|------|--------|---------|
| `process-signal-queue/index.ts` | Quality check understands small-cap context | Stop aborting when small dataset + correct filters |
| `process-signal-queue/index.ts` | Pass search config to quality AI prompt | Let AI distinguish "small cap" from "bad search" |
| `signal-planner/index.ts` | Post-generation industry keyword validation | Structurally enforce industry terms in Stage 1 |
| `signal-planner/index.ts` | `inferQueryIndustry` helper | Extract industry terms from user query for validation |

No database migrations needed. Two files modified.

