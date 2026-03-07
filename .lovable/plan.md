

## Signal Scraper Fixes — Run `9d34437f` Autopsy & Plan

### What Happened

| Time | Event |
|------|-------|
| 19:22:21 | Run created, status `planned` |
| 19:24:03 | Stage 1 started: `curious_coder_linkedin_jobs_search_scraper` + `borderline_indeed_scraper` |
| 19:24:03 | LinkedIn Jobs actor failed (403 not-rented) → fallback tried `bebity_linkedin_jobs_scraper` (also failed) → **fell through to `compass_crawler_google_places`** (Google Maps — wrong category!) |
| 19:24:03 | Indeed scraper started but FAILED (likely wrong input params) |
| 19:28:02 | Both actors polled as FAILED |
| 19:28:03 | Zero-result abort triggered correctly, status set to `failed` with `processing_phase: aborted` |

### Root Causes

**Bug 1: Fallback selects wrong-category actors.** When all `hiring_intent` backups fail, `startApifyRunWithFallback` doesn't throw — it somehow falls through and an actor from the wrong category gets used. The `compass_crawler_google_places` (a Google Maps scraper) was used as a "backup" for a LinkedIn Jobs scraper. A Google Maps scraper cannot search for job listings.

**Bug 2: Pre-flight access check is unreliable.** The check at lines 218-244 in `signal-planner/index.ts` tests `externallyUsable === false`, but Apify's API often doesn't return this field for paid actors that require rental. All three hiring actors (`curious_coder`, `bebity`, `borderline`) passed the pre-flight check but failed at runtime with 403.

**Bug 3: Indeed scraper gets wrong params.** The category-based input construction (lines 845-854 in `process-signal-queue`) sends `title` and `position` fields, but the `borderline_indeed_scraper` (a pay-per-result actor) likely expects different field names. With empty `inputSchema`, the fallback pass-through sends generic field names that the actor doesn't recognize.

### Fixes

**Fix 1: Strict category matching in fallback (process-signal-queue)**
- `findBackupActors` must ONLY return actors that match BOTH the category AND the actor "type" (e.g., job board backups must also be job board scrapers, not Google Maps)
- Add a sub-category or "actor_type" tag: `linkedin_jobs`, `indeed_jobs`, `google_maps`, `linkedin_people`, etc. derived from `actorId` or `label`
- When all same-category backups fail, throw immediately instead of silently proceeding with wrong actors

**Fix 2: Pre-flight access check via dry-run (signal-planner)**
- Replace the unreliable `externallyUsable` field check with an actual **test run**: start the actor with `{ test: true }` or minimal input and a 1-item limit, then immediately abort
- If the start returns 403, mark the actor as inaccessible
- Alternatively: try `POST /v2/acts/{id}/runs?token=...` with empty body — if it returns 403 "not rented", skip it. Abort immediately if it succeeds.

**Fix 3: Runtime schema fetch for unknown actors (process-signal-queue)**
- When `inputSchema` is empty at runtime, fetch the actor's actual input schema from Apify (`GET /v2/acts/{id}/input-schema`) before building params
- Cache the fetched schema in the plan's actor_registry for subsequent uses
- This ensures field names match what the actor actually expects

**Fix 4: Smarter actor sub-typing in categorization (signal-planner)**
- Enhance `categorizeActor` to return a more specific type: `hiring_intent:linkedin`, `hiring_intent:indeed`, `hiring_intent:glassdoor`, `local_business:google_maps`, etc.
- Backup selection matches on the full sub-type, not just the broad category
- This prevents Google Maps from ever being a backup for LinkedIn Jobs

### Files to Modify

1. **`supabase/functions/signal-planner/index.ts`**
   - Add sub-type to `categorizeActor` return value (e.g., `hiring_intent:linkedin`)
   - Replace `externallyUsable` check with actual dry-run test
   - Store `subCategory` in actor registry entries

2. **`supabase/functions/process-signal-queue/index.ts`**
   - Update `findBackupActors` to match on sub-category when available
   - Add runtime schema fetch when `inputSchema` is empty
   - Ensure fallback throws when no valid same-type backups exist (no cross-category fallback)

### Scope
~120 lines changed across 2 files. No DB migration needed.

