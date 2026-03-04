
## Root Cause Analysis

Three compounding issues are causing 0 results:

### 1. Wrong Apify Actor ID
The actor ID `hMvNSpz3JnHgl5jkh` for `linkedin_jobs` does not correspond to an actor that accepts `keyword`/`location`/`timePosted` parameters. The correct actor is `sovereigntaylor/linkedin-jobs-scraper` with ID **`AtsAgajsFjMVfxXJZ`**, which accepts exactly those parameters plus `maxResults`, `scrapeJobDetails`, `jobType`, etc.

### 2. Wrong Parameter Name
The input builder sends `rows` but the correct actor expects `maxResults`. So even if the actor ID were correct, it would ignore the limit parameter.

### 3. Error Responses Are Being Cached
The cache currently contains: `[{"error":"Scraper didn't find any jobs"}]` — a single error object mistakenly cached as "1 row of data." Every subsequent run with similar params hits this bad cache and processes the error object as if it were a lead, which AI classification then rightfully rejects, yielding 0 leads.

### Evidence from Database
```text
signal_dataset_cache: row_count=1, dataset=[{"error":"Scraper didn't find any jobs"}]
Latest run_log: cache_hit (rows: 1) → normalised (1) → ai_classification (passed: 0) → 0 leads
```

---

## Fix Plan

### A. Fix Actor ID and Input Builder (`signal-planner/index.ts`)
- Change `linkedin_jobs` actor ID from `hMvNSpz3JnHgl5jkh` to `AtsAgajsFjMVfxXJZ`
- Change `rows` → `maxResults` in the input builder
- Add `scrapeJobDetails: true` to get full job descriptions (needed for AI classification)

### B. Prevent Caching Error Responses (`signal-planner/index.ts`)
- Before caching, validate that results are actual data (not error objects)
- Check: `rawResults.length > 0 && !rawResults[0]?.error`

### C. Clear Stale Cache (SQL Migration)
- Delete all existing `signal_dataset_cache` entries for `linkedin_jobs` source since they all contain error data

### D. Update Result Normalizer
- Map the new actor's output fields correctly (the `sovereigntaylor` actor returns `jobTitle`, `company`, `companyLink`, `jobLocation`, `salary`, `jobDescription`, `applyLink`)

### Files to Change
| File | Change |
|------|--------|
| `supabase/functions/signal-planner/index.ts` | Fix actor ID, input builder params, cache validation, result normalization |
| SQL migration | Clear bad cache entries |
