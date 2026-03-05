

## Remove Artificial Scraping Limits

### The Problem

There are two places where max results get capped, causing the scraper to miss companies:

1. **ACTOR_CATALOG defaults are too low** — Both `signal-planner` and `process-signal-queue` default `maxResults` to 100 for LinkedIn/Indeed and 200 for Google Maps/Yelp. For a broad "SDR hiring" search, LinkedIn alone could have 1,000+ postings. Capping at 100 means 90% of hiring companies are never even seen by the pipeline.

2. **Multi-keyword splitting divides the cap** — Lines 589-594 of `process-signal-queue` find the `max` field and, when there are multiple keywords, *divide* it by the keyword count:
   ```typescript
   iterPlan.search_params[maxField] = Math.max(50, Math.ceil(iterPlan.search_params[maxField] / keywords.length));
   ```
   With 5 keywords and `maxResults=100`, each keyword only scrapes **20 results**. That's where most of the data loss happens — before any filtering even starts.

### The Fix

**File: `supabase/functions/signal-planner/index.ts`**
- Raise default `maxResults` from 100 → 500 for `linkedin_jobs`, `indeed_jobs`, and `linkedin_companies`
- Raise default `maxItems` from 200 → 500 for `google_maps` and `yelp`
- Add a line to the planner system prompt instructing the AI to set `maxResults` high (e.g., 500+) because downstream filtering is aggressive

**File: `supabase/functions/process-signal-queue/index.ts`**
- Same catalog default changes (keep in sync)
- **Remove the per-keyword division logic** (lines 589-594). Each keyword should get the full `maxResults` value independently — the dedup step already handles overlapping results. Replace with a simple fallback that sets the max field to 500 if not already specified:
  ```typescript
  const maxField = Object.keys(actor.inputSchema).find(f => f.toLowerCase().includes("max"));
  if (maxField && !iterPlan.search_params[maxField]) {
    iterPlan.search_params[maxField] = 500;
  }
  ```

### Why This Is Safe

- Credit charging is based on *final* leads stored, not raw scrape volume — scraping more costs the user nothing extra
- Dedup, static filters, and AI classification all run after collection, so junk doesn't make it through
- Apify charges by compute time, not result count, and these actors are lightweight scrapers
- The zero-result protection still applies — no leads = no credits charged

### Files

| File | Change |
|------|--------|
| `supabase/functions/signal-planner/index.ts` | Raise catalog defaults to 500, update system prompt |
| `supabase/functions/process-signal-queue/index.ts` | Raise catalog defaults to 500, remove per-keyword max division |

