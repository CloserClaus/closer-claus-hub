

## Problem

Two broken actors causing zero results:

1. **Indeed Jobs**: Actor `curious_coder/indeed-scraper` returns 404 — it's been removed from Apify
2. **LinkedIn Jobs**: Actor `AtsAgajsFjMVfxXJZ` returns 0 rows for all keywords — likely deprecated or broken

## Fix: Replace both actors with verified working alternatives

### Indeed Jobs — Replace with `consummate_mandala/indeed-job-listings-scraper`
- **New actorId**: `consummate_mandala/indeed-job-listings-scraper`
- **Input change**: Uses `keywords` (string array) instead of `keyword` (string), and `maxResults` instead of `maxItems`. No `datePosted` enum — it doesn't have that filter.
- Update `inputSchema` accordingly:
  - `keywords`: `{ type: "string[]", required: true }` — the `buildGenericInput` auto-fill for `string[]` will populate from `search_query`
  - `location`: `{ type: "string", default: "United States" }`
  - `maxResults`: `{ type: "number", default: 100 }`

### LinkedIn Jobs — Replace with `sovereigntaylor/linkedin-jobs-scraper`
- **New actorId**: `sovereigntaylor/linkedin-jobs-scraper`
- **Input schema is identical** to current: `keyword` (string), `location`, `timePosted` with same enum values, so no schema changes needed — just the actorId swap.

### Files to change

| File | Changes |
|------|---------|
| `supabase/functions/signal-planner/index.ts` | Update `actorId` for `linkedin_jobs` and `indeed_jobs`, update Indeed's `inputSchema` |
| `supabase/functions/process-daily-signals/index.ts` | Update `ACTOR_REGISTRY` with new actorIds for both |

