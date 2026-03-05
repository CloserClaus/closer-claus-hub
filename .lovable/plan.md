

## Why the Search Went Stale

The logs show run `1f1a96af` has been stuck in the `scraping` phase for many polling cycles. With `maxResults` raised to 500, each Apify actor run takes significantly longer to complete (minutes instead of seconds). The system has two problems:

### Problem 1: Longer Apify Runs + 30-Minute Hard Ceiling

With 10 keyword×actor jobs each requesting 500 results, the Apify runs take much longer. The `HARD_CEILING_MS` is 30 minutes. If the total scraping time exceeds that, the run gets marked stale, reset to queued, retried, and eventually fails after 3 attempts.

### Problem 2: Collecting Phase Will Timeout

Even if scraping completes, `phaseCollecting` processes **everything in a single edge function invocation**: fetches all datasets (up to 10 HTTP calls), normalizes thousands of rows, runs AI classification in batches of 20 (dozens of API calls), then stores. Edge functions have a ~60s execution limit. With 500 results × 10 jobs, collection alone will timeout.

### Fix Plan

**File: `supabase/functions/process-signal-queue/index.ts`**

1. **Increase hard ceiling** from 30 minutes to 60 minutes — larger scrapes legitimately take longer
2. **Split collecting into incremental sub-phases** — process one dataset per invocation instead of all at once:
   - Track which dataset refs have been collected via a `collected_refs` index on the run
   - Each invocation of `phaseCollecting` processes the next unprocessed dataset: fetch, normalize, store leads immediately
   - After all datasets are processed, run dedup + AI classification as a final "finalizing" sub-phase
3. **Save leads incrementally** after each dataset is processed (per the stack overflow pattern), so partial progress survives timeouts
4. **Paginate large datasets** — if a dataset has >500 items, fetch in pages of 500 using Apify's `offset` parameter

| File | Change |
|------|--------|
| `supabase/functions/process-signal-queue/index.ts` | Increase hard ceiling to 60min, split collecting into per-dataset incremental processing, save leads after each dataset, paginate large dataset fetches |

