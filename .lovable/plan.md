

## Why It Shows "Running" with 7/7 ✓

The run is **not stuck** — it's working as designed but the UI is misleading.

### What's happening

All 7 Apify scraper jobs finished successfully (hence 7/7 ✓). But the system is now in the **collecting phase** — downloading and storing results from each dataset one at a time (one per cron cycle, every ~2 minutes). It has processed 2 of 7 datasets so far. After all 7 are collected, it moves to **finalizing** (dedup + AI classification), then marks as "completed."

So the run will finish on its own within ~10-15 more minutes.

### The real problem: only 1 result per LinkedIn search

Each of the 7 datasets returned only **1 item**. This means the `curious_coder/linkedin-jobs-scraper` actor is not actually delivering bulk results — it's effectively broken for our use case. This is the same pattern as the previous actors: the scrape "succeeds" but returns near-zero data.

### Fixes needed

**1. Show processing phase in the UI**

File: `src/components/leads/SignalScraperTab.tsx`

When all jobs are ✓ but status is still "running", show the current phase (e.g., "Collecting results 2/7..." or "Finalizing...") instead of just the job breakdown. This prevents user confusion when scrapers finished but post-processing is ongoing.

Read `processing_phase` and `collected_dataset_index` from the run data and display them.

**2. Investigate LinkedIn actor output**

The `curious_coder/linkedin-jobs-scraper` is returning 1 result per search URL despite `count: 2500`. Need to:
- Check whether this actor expects `startUrls` (objects with `url` field) instead of a flat `urls` string array
- Verify the input format matches the actor's actual schema by fetching its README/input schema from Apify
- If this actor also doesn't work, evaluate alternatives (e.g., `apify/linkedin-jobs-scraper` or `bebity/linkedin-jobs-scraper`)

**3. Add phase display to SignalRun type**

File: `src/hooks/useSignalScraper.ts`

Add `processing_phase` and `collected_dataset_index` to the `SignalRun` interface so they're available in the UI.

### File changes

| File | Change |
|------|--------|
| `src/hooks/useSignalScraper.ts` | Add `processing_phase`, `collected_dataset_index` to `SignalRun` |
| `src/components/leads/SignalScraperTab.tsx` | Show phase progress when all jobs succeeded but run is still processing |
| `supabase/functions/process-signal-queue/index.ts` | Fix LinkedIn actor input format (pending schema verification) |

### Recommended next step

Before changing the LinkedIn actor again, I should fetch the actual Apify actor page for `curious_coder/linkedin-jobs-scraper` to verify the correct input format. Want me to do that first, or proceed with the UI fix and actor investigation together?

