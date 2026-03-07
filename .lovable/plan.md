

## Plan: Handle Apify Actor Rental Failures with Automatic Fallback

### Problem
Dynamic actor discovery selects actors by popularity, but has no knowledge of which actors the Apify account can actually run. Both selected actors returned 403 "actor-is-not-rented", killing the entire stage.

### Solution: Two-Layer Defense

**Layer 1 — Pre-flight access check in `discoverActors()` (signal-planner)**

After discovering candidate actors from the Apify Store, call Apify to verify each actor is runnable before including it in the plan:

```
GET https://api.apify.com/v2/acts/{actorId}?token=...
```

Check the response for rental/access status. If an actor isn't accessible, exclude it from candidates. If no accessible actors remain for a required category, try broader search terms. If still nothing, mark the plan as infeasible with a clear reason ("No accessible job board scrapers available on your Apify account").

**Layer 2 — Runtime 403 fallback in `pipelineScrapeStarting()` (process-signal-queue)**

When `startApifyRun` gets a 403 "actor-is-not-rented" error:
1. Log the failure but don't count it as a permanent failure yet
2. Check if the plan's `actor_registry` has alternative actors for the same category
3. If not, query the Apify Store in real-time for free/accessible alternatives in the same category
4. Attempt to start the alternative actor with the same params
5. Only fail the stage if ALL alternatives are exhausted

Additionally, store backup actor candidates in the plan's `actor_registry` (2-3 per category) so the processor has immediate fallbacks without needing to re-query the store.

### Changes

**File: `supabase/functions/signal-planner/index.ts`**
- In `discoverActors()`: after fetching actor details, call `GET /v2/acts/{actorId}` to check if the actor is accessible (look for `isPublic`, `isDeprecated`, or attempt a dry-run check)
- Store top 3 actors per category in `actor_registry` instead of just 1, marking the primary and backups
- If all candidates for a category fail access checks, try alternative search queries before declaring infeasible

**File: `supabase/functions/process-signal-queue/index.ts`**
- In `pipelineScrapeStarting()`: catch 403 "actor-is-not-rented" errors specifically
- When caught, look up backup actors from the plan's `actor_registry` for the same category
- Attempt to start backup actors sequentially until one succeeds
- Only fail the stage if all primary + backup actors fail
- Log which actor was swapped for debugging

### Estimated scope
~100 lines changed across 2 files. No DB migration needed.

