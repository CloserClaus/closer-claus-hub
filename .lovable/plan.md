

## Tuning Issues — Why Results Are Near Zero

Three distinct problems visible in the logs:

### Problem 1: LinkedIn Jobs Actor Returns 0 Rows

The actor `sovereigntaylor/linkedin-jobs-scraper` returned 0 items for 3 keywords and FAILED for 2. The proxy config only sets `useApifyProxy: true` without specifying residential proxy groups. LinkedIn aggressively blocks datacenter proxies. The fix is to add `proxyCountry` and `proxyGroups` to the proxy configuration:

```typescript
actorInput.proxyConfiguration = { 
  useApifyProxy: true, 
  apifyProxyGroups: ["RESIDENTIAL"],
  apifyProxyCountry: "US"
};
```

Additionally, the actor may expect different input field names than what we're sending. We need to verify the actual input schema by checking the Apify actor page or testing a direct API call.

### Problem 2: Indeed Actor Returns Only 1 Row Per Keyword

5 keywords, 1 result each = the `maxResults` param is likely being ignored because the actor uses a different field name (e.g., `maxItems`, `limit`, or `maxCrawledItems`). The `inputSchema` in our catalog says `maxResults` but the actual Apify actor for Indeed (`consummate_mandala/indeed-job-listings-scraper`) may not recognize that param. Need to verify the correct param name and update the catalog.

### Problem 3: Cross-Keyword Dedup Too Aggressive for Job Boards

The dedup key is `domain || company::title`. For job scraping, one company might post 4 identical-title jobs across keywords (e.g., "SDR" and "BDR" at the same company). After dedup, 4 → 1. This is correct behavior for lead generation (you only need one entry per company), but combined with problems 1 and 2, it leaves almost nothing.

### Fix Plan

**File: `supabase/functions/process-signal-queue/index.ts`**

1. **Fix LinkedIn proxy config** (line ~598): Add residential proxy group and country code
2. **Verify and fix actor input schemas**: Check the actual Apify actor pages for `sovereigntaylor/linkedin-jobs-scraper` and `consummate_mandala/indeed-job-listings-scraper` to confirm correct input field names — update the `ACTOR_CATALOG` in both `process-signal-queue` and `signal-planner` if any field names are wrong

**File: `supabase/functions/signal-planner/index.ts`**

3. **Same catalog fixes** — keep catalogs in sync

### Investigation Step

Before changing code, I need to verify the actual input schemas for these two Apify actors by checking their documentation. This determines whether the field name mismatches are the root cause or if it's purely a proxy issue.

| File | Change |
|------|--------|
| `supabase/functions/process-signal-queue/index.ts` | Fix proxy config, fix actor input field names |
| `supabase/functions/signal-planner/index.ts` | Mirror catalog fixes |

Shall I investigate the actual Apify actor schemas first, or proceed with the proxy fix and test?

