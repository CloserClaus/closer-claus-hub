

## Why the Search Returned 0 Leads

### Root Cause

The LinkedIn Jobs actor (`sovereigntaylor/linkedin-jobs-scraper`) has **never returned any data** — zero cached results across all runs. The Apify runs finish with status `SUCCEEDED` but produce empty datasets. This means the actor accepts our input without error but doesn't find anything because our field names likely don't match its expected input schema.

Our catalog sends: `{ keyword: "Sales Representative", location: "United States", maxResults: 500, timePosted: "pastWeek", scrapeJobDetails: true }`

But common LinkedIn job scraper actors on Apify typically expect fields like `searchUrl`, `queries`, `searchQueries`, or `title` — not `keyword`. The actor silently ignores unrecognized fields, runs with no search criteria, and returns an empty dataset.

Additionally, all 3 Indeed jobs timed out, so the backup source also produced nothing.

### Fix Plan

**Step 1: Verify correct input fields for both actors**

Call the Apify API from an edge function to fetch the actual input schema for:
- `sovereigntaylor/linkedin-jobs-scraper` (LinkedIn)
- `consummate_mandala/indeed-job-listings-scraper` (Indeed — timing out consistently suggests input issues too)

**Step 2: Update the Actor Catalog**

File: `supabase/functions/process-signal-queue/index.ts` and `supabase/functions/signal-planner/index.ts`

- Fix `inputSchema` field names to match what the actors actually expect
- This is the only change needed — the rest of the pipeline (normalisation, dedup, AI classification) works correctly; it just has no data to process

**Step 3: Add actor validation logging**

File: `supabase/functions/process-signal-queue/index.ts`

- In `phaseCollectingIncremental`, when a SUCCEEDED dataset returns 0 items, log a warning: "Actor returned SUCCEEDED but 0 results — possible input schema mismatch"
- This makes future silent failures immediately visible

### Implementation

1. Create a one-off diagnostic edge function (or use `curl_edge_functions`) to call `GET https://api.apify.com/v2/acts/sovereigntaylor~linkedin-jobs-scraper?token=APIFY_API_TOKEN` and inspect `data.defaultRunInput` / `data.inputSchema` for the correct field names
2. Update the `ACTOR_CATALOG` entries for `linkedin_jobs` and `indeed_jobs` with the correct field mappings
3. Add a zero-result warning log in the collecting phase

| File | Change |
|------|--------|
| `supabase/functions/process-signal-queue/index.ts` | Fix actor catalog input fields, add 0-result warning |
| `supabase/functions/signal-planner/index.ts` | Sync actor catalog if duplicated there |

