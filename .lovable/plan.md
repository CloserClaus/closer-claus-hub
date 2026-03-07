

## Signal Run `f3cda2d7` — Full Autopsy

### Timeline

| Time | Event |
|------|-------|
| 18:50:03 | Run created with `planned` status |
| 18:52:01 | Run queued and started — phase: `stage_1_starting` |
| 18:52:01 | Two actors launched: `curious_coder_linkedin_jobs_search_scraper` and `borderline_indeed_scraper` |
| 18:52:01 | LinkedIn Jobs actor **failed to start** (empty runId) |
| 18:52:01 | Indeed actor started (runId: `jhCkV6qkj5UGKwQeK`) then **FAILED** |
| ~18:53:xx | Polling detected both actors FAILED → moved to `stage_1_collecting` |
| 18:54:03 | `Stage 1: ZERO RESULTS — aborting pipeline` logged |
| 18:54:02 | DB update attempted but status still shows `running` |

### The Plan (Generated Correctly)

```text
Stage 1: Scrape — Job Boards (LinkedIn Jobs + Indeed)
  → "Sales Representative" OR "Account Executive"
Stage 2: AI Filter — Is this a marketing/branding/SEO agency?
Stage 3: Scrape — Find Decision Makers (LinkedIn Profile Search)
  → input_from: company_name
Stage 4: Scrape — Contact Discovery (Leads Finder)
  → input_from: linkedin
```

Dynamic actor discovery worked. 4 actors selected from Apify Store. Data flow validation passed (no `company_linkedin_url` dependency — uses `company_name` instead). The plan itself is sound.

### Root Cause: `buildGenericInput` Strips All Params When inputSchema Is Empty

This is the critical bug. Here's the chain:

1. `discoverActors()` fetches actor details from Apify. It tries to extract `inputSchema` from `actorData.data.defaultRunInput.body.properties`, but this endpoint often returns a different structure or empty data. The catch block silently swallows errors, so `inputSchema` stays `{}`.

2. The plan's `actor_registry` stores all 4 actors with `"inputSchema": {}`.

3. When `process-signal-queue` runs the actors, it builds params like `{ search_query: "Sales Representative", location: "United States", max_results: 100 }` from `params_per_actor`.

4. It then calls `buildGenericInput(actor, input)` (line 786) which does:
   ```typescript
   for (const [field, schema] of Object.entries(actor.inputSchema)) {
     // inputSchema is {} → this loop runs ZERO times
   }
   return {}; // EMPTY — all params discarded
   ```

5. The actor receives `{ proxyConfiguration: { useApifyProxy: true } }` and nothing else. No search query, no location, no limit. Both actors fail because they have no input.

6. Additionally, the old hardcoded actor key checks (`actorKey === "linkedin_jobs"`, `actorKey === "indeed_jobs"`) at lines 761/771 don't match the dynamic keys (`curious_coder_linkedin_jobs_search_scraper`, `borderline_indeed_scraper`), so the special URL-building logic is skipped entirely.

### Secondary Bug: Abort Didn't Update Status

The zero-result abort ran at 18:54:03 and logged correctly, but the DB still shows `status: "running"`. The `serviceClient.from("signal_runs").update(...)` call may have failed silently (no error check on the update result), or there's a race condition with concurrent polling invocations re-writing the status.

### Fixes Required

**Fix 1: `buildGenericInput` must pass through all params when inputSchema is empty**

In `process-signal-queue/index.ts`, the function should fall back to passing all provided params directly when the actor has no known inputSchema, instead of discarding everything.

**Fix 2: Remove hardcoded actor key checks in `pipelineScrapeStarting`**

The `if (actorKey === "linkedin_jobs")` and `if (actorKey === "indeed_jobs")` checks (lines 761, 771) are dead code now that actors are dynamically discovered. Replace with category-based logic: check `actor.category === "hiring_intent"` and look at the actor's inputSchema to determine which param names to use (e.g., `searchQuery`, `queries`, `title`, `keywords`).

**Fix 3: Improve inputSchema extraction in `discoverActors`**

The Apify API has multiple schema locations. Try `defaultRunInput.body.properties` first, then fall back to fetching the actor's `inputSchema` endpoint (`/v2/acts/{id}/input-schema`). If both fail, at minimum pass through all user-provided params rather than filtering against an empty whitelist.

**Fix 4: Add error checking on abort DB update**

After the zero-result abort update, check if it succeeded. If not, retry once or throw so the error handler catches it.

### Files to Modify

1. **`supabase/functions/process-signal-queue/index.ts`** — Fix `buildGenericInput` to pass through params when inputSchema is empty; replace hardcoded actor key checks with category-based logic; add abort update error handling
2. **`supabase/functions/signal-planner/index.ts`** — Improve inputSchema extraction with fallback endpoints

