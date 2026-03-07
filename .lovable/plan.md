

## Plan: Fix Signal Scraper Credit Charging

### Problem

The **estimation** (in `signal-planner`) correctly accounts for scrape cost + AI filtering cost across all stages. But the **actual charging** (in `process-signal-queue`) only calculates cost based on final lead count — it ignores the scrape volume processed in Stage 1 and the AI filtering cost entirely. For 57 leads from a run that scraped ~2500 results, only 5 credits were charged instead of ~25-35.

### New Formula

Per the user's requirement:

```
actual_credits = (scrape_cost + ai_cost + operational_cost) * 5

where:
  scrape_cost = (total_scraped_rows / 1000) * $1.00
  ai_cost     = total_ai_filtered_rows * $0.001
  operational = 50% of scrape_cost + 50% of ai_cost
```

This means `operational = 0.5 * scrape_cost + 0.5 * ai_cost`, so the full formula simplifies to:

```
total_usd = 1.5 * scrape_cost + 1.5 * ai_cost
credits   = Math.max(5, Math.ceil(total_usd * 5))
```

### Changes

**File: `supabase/functions/process-signal-queue/index.ts`**

1. **Track actual row counts during pipeline execution.** Add two counters to the pipeline finalization: `totalScrapedRows` (rows collected in all scrape stages) and `totalAiFilteredRows` (rows processed by AI filter stages). These can be derived from the `signal_leads` count at each stage transition, or tracked inline.

2. **Replace the final credit calculation** (lines ~1119-1124) from:
   ```
   scrapeCostUsd = (leadsCount / 1000) * 1.0
   chargedPriceUsd = scrapeCostUsd * 4
   actualCredits = Math.max(5, Math.ceil(chargedPriceUsd * 5))
   ```
   To the new formula using actual pipeline stage data from `run.signal_plan.pipeline` and the actual row counts observed during execution. The simplest approach: read the `signal_plan.pipeline` stage definitions, query the `signal_leads` table for row counts at key stages, and compute cost accordingly.

3. **Same fix for the legacy finalization** (lines ~1430-1435).

**File: `supabase/functions/signal-planner/index.ts`**

4. **Update `estimatePipelineCost`** to use the same formula for consistency between estimate and actual charge:
   - Scrape stages: `(count / 1000) * 1.0` (same)
   - AI stages: `count * 0.001` (same)  
   - Add 50% operational markup on both
   - Remove the old `* 4` markup, replace with `* 1.5` on each component

### Files to modify
- `supabase/functions/process-signal-queue/index.ts` — New credit calculation based on actual scrape + AI volumes
- `supabase/functions/signal-planner/index.ts` — Align `estimatePipelineCost` with the same formula

