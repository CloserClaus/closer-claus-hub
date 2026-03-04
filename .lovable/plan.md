

## Fix: Apify Actor URL Escaping + LinkedIn Companies Input

### Root Cause

All 404 errors stem from a single issue: actor IDs with slashes (e.g., `sovereigntaylor/linkedin-jobs-scraper`) create broken URLs. The Apify API requires a tilde (`~`) instead of `/` for slug-format actor IDs.

The LinkedIn Companies 400 error is a separate issue: the actor requires `profileUrls` as input, but the catalog schema uses `urls` and `searchQuery`, neither of which match.

### Changes

**1. `supabase/functions/signal-planner/index.ts`** (line 760)

Replace the Apify fetch URL to escape `/` → `~`:
```typescript
const safeActorId = actor.actorId.replace("/", "~");
`https://api.apify.com/v2/acts/${safeActorId}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`
```

Update `linkedin_companies` inputSchema to use `profileUrls` instead of `urls`, matching what the actor actually requires. Remove `searchQuery` since the actor doesn't support text search — it only accepts LinkedIn company URLs.

**2. `supabase/functions/process-daily-signals/index.ts`** (line 158)

Same URL escaping fix:
```typescript
const safeActorId = actorInfo.actorId.replace("/", "~");
```

These are two small, surgical fixes. The URL escaping is backward-compatible since hash-based IDs like `nwua9Gu5YrADL7ZDj` contain no `/`.

