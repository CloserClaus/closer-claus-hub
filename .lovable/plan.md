

# Bug: "Records to scan" ignores max_results_per_source setting

## Root Cause

The `estimated_rows` shown in the UI is `totalEstimatedRows`, which is the **sum of estimated rows across ALL stages**, not just Stage 1. The estimator in `estimatePipelineCost` adds `currentRowCount` for every scrape stage:

```
totalEstimatedRows += currentRowCount;  // line 1434 — accumulates across all stages
```

For a 6-stage pipeline with max_results_per_source=100, the math works out roughly as:
- Stage 1 (Google Maps): 100 rows → totalEstimatedRows = 100
- Stage 2 (AI Filter): not a scrape, skipped
- Stage 3 (Google Search): 100 rows → totalEstimatedRows = 200
- Stage 4 (LinkedIn Company): 100 rows → totalEstimatedRows = 300
- Stage 5 (LinkedIn People): 100 rows → totalEstimatedRows = 400
- Stage 6 (Contact Enrichment): 100 rows → totalEstimatedRows = 500

But a second problem amplifies this: the AI planner often sets `expected_output_count` on later stages to high values (500 default), and Step 4 (the cap enforcement at line 1056-1083) **only caps Stage 1**. Later scrape stages keep their AI-assigned `expected_output_count` values uncapped.

So in practice: Stage 1 = 100, but stages 3-6 might each show 500, giving ~1600 total.

## Fix

Two changes:

### 1. `estimatePipelineCost` — show only Stage 1 row count as "Records to scan"
The "Records to scan" label implies how many source records are fetched initially. Enrichment stages process existing leads, not new ones. Change `totalEstimatedRows` to reflect only the initial discovery count (Stage 1), not the cumulative sum.

### 2. Cap enrichment stages to the current pipeline row count
Later scrape stages (enrichment) should never show more rows than what's flowing through the pipeline. Their `expected_output_count` should be clamped to `currentRowCount` from the previous stage, which is already partially done at line 1432 but the `expected_output_count` defaults to 500 if not set.

## Files Modified
- `supabase/functions/signal-planner/index.ts` — ~5 lines in `estimatePipelineCost`

## Changes

In `estimatePipelineCost`:
- Only set `totalEstimatedRows` from Stage 1 discovery stages (not accumulated from enrichment stages)
- Ensure enrichment stage `expectedCount` defaults to `currentRowCount` instead of 500

```typescript
// Before (line 1425):
const expectedCount = stage.expected_output_count || 500;

// After:
const expectedCount = stage.expected_output_count || (stage.stage === 1 ? 500 : currentRowCount);
```

```typescript
// Before (line 1434):
totalEstimatedRows += currentRowCount;

// After — only count Stage 1 as "records to scan":
if (stage.stage === 1 || !stage.input_from) {
  totalEstimatedRows = currentRowCount; // set, don't accumulate
}
```

This ensures "Records to scan" reflects the actual source query volume (respecting the user's cap), not the sum of all stage processing.

