

# Fix: Reconfiguration Pipeline Uses Unresolved Actor Names

## Problem
`reconfigurePipeline` in `process-signal-queue/index.ts` (lines 495-606) tells the AI to use actors like `"linkedin_people"`, `"contact_enrichment"` — these are not real actor keys. When the reconfigured stages try to execute, `getActor(actorKey)` returns `undefined` because these keys were never registered in the plan's `actor_registry`.

## Fix

Update `reconfigurePipeline` to use `stage_category` format (matching the new planner architecture), then run the reconfigured stages through a lightweight actor resolution step before saving.

### Changes in `process-signal-queue/index.ts`

1. **Update the reconfiguration AI prompt** (line 542-551) to output `stage_category` instead of `actors[]`:
   - Replace actor names with known categories: `"people_data:linkedin"`, `"company_data:linkedin"`, `"enrichment:contact"`, `"web_search:google"`
   - Ask the AI to output `stage_category` per stage instead of `actors`

2. **Add inline actor resolution for reconfigured stages** — after the AI returns new stages, map each `stage_category` to verified actors from the `VERIFIED_ACTORS` catalog (import it or duplicate the minimal lookup). For each reconfigured scrape stage:
   - Look up `stage_category` in a local verified actor map
   - Set `stage.actors = [actorEntry.key]` and `stage.params_per_actor = { [actorEntry.key]: stage.params }`
   - Register the actor in `planActorRegistry` so `getActor()` finds it at execution time

3. **Import the VERIFIED_ACTORS catalog** — since edge functions are separate, duplicate the minimal verified actor lookup map (just the `actorId`, `key`, `subCategory`, `inputSchema`, `outputFields` per category) at the top of `process-signal-queue/index.ts`. This is ~50 lines.

4. **Update the plan's `actor_registry`** in the saved `signal_plan` after reconfiguration so newly resolved actors persist across cron cycles.

### Files Modified
- `supabase/functions/process-signal-queue/index.ts` — reconfiguration prompt rewrite + inline resolution + verified actor map

### Estimated size
~80 lines changed/added

