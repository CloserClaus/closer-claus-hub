

# Plan: Remove Hardcoded Actor Catalog — Full Dynamic Discovery

## Summary
Remove all hardcoded actor catalogs (`VERIFIED_ACTORS`, `VERIFIED_ACTOR_CATALOG`) from both edge functions. Replace with a `STAGE_CATEGORIES` registry that describes **what each category does** (search terms, expected inputs/outputs) without specifying actor IDs. All actor resolution becomes dynamic via Apify Store search, sorted by users/reviews/rating. Also applies the three previously planned fixes (min-dataset AI filter guard, LinkedIn URL construction, low-yield recovery threshold).

## Changes

### File 1: `supabase/functions/signal-planner/index.ts`

**A. Replace `VERIFIED_ACTORS` + `VerifiedActor` interface + `verifiedToActorEntry()` (lines 39-261) with `STAGE_CATEGORIES`**

New `STAGE_CATEGORIES` structure — no `actorId`, just metadata about what each category provides:
```typescript
interface StageCategory {
  category: string;
  subCategory: string;
  label: string;
  searchTerms: string[];        // Terms to search Apify Store
  expectedInputs: Record<string, string>;  // field → description (for AI prompt)
  expectedOutputs: string[];    // fields this category typically produces
}
```

Nine categories (same as current): `local_business:google_maps`, `local_business:yelp`, `hiring_intent:indeed`, `hiring_intent:linkedin`, `hiring_intent:glassdoor`, `people_data:linkedin`, `company_data:linkedin`, `web_search:google`, `enrichment:contact`.

Each category gets `searchTerms` like `["linkedin jobs scraper", "linkedin job search"]` — used to query the Apify Store. The `expectedOutputs` list the fields users should expect (e.g., `["company_name", "website", "industry"]`).

**B. Update `buildPipelinePlannerPrompt()` (line 271-473)**

Instead of iterating `VERIFIED_ACTORS` and showing inputSchema/outputFields, iterate `STAGE_CATEGORIES` and show:
- Category label and expected outputs (as ✓/✗)
- Generic input parameter descriptions from `expectedInputs`
- The prompt no longer references specific actor IDs or precise schemas

**C. Update `inferProducedFields()` (line 495-522)**

Replace `VERIFIED_ACTORS[stage.stage_category]` lookup with `STAGE_CATEGORIES[stage.stage_category]?.expectedOutputs`. Convert the string array to field set.

**D. Update `resolveActorsForPipeline()` (lines 603-713) — ALL categories go through dynamic discovery**

Remove the `if (verified)` fast-path (lines 622-632). ALL stage categories now:
1. Look up `STAGE_CATEGORIES[category].searchTerms` 
2. Call `discoverActors()` with those search terms
3. Sort discovered actors by `monthlyUsers * 0.4 + totalRuns * 0.3 + rating * 0.3` (weighted score favoring popular, well-reviewed actors)
4. Pre-flight validate top 3 candidates (existing logic, now runs for ALL)
5. Add remaining as backups

Remove lines 694-713 (backup resolution from VERIFIED_ACTORS) — backups now come from discovery results naturally.

**E. Update `discoverActors()` (lines 1519-1636) — sort by composite quality score**

After fetching from Apify Store, sort actors by:
```typescript
actors.sort((a, b) => {
  const scoreA = (a.monthlyUsers || 0) * 0.4 + (a.totalRuns || 0) * 0.0003 + (a.rating || 0) * 200;
  const scoreB = (b.monthlyUsers || 0) * 0.4 + (b.totalRuns || 0) * 0.0003 + (b.rating || 0) * 200;
  return scoreB - scoreA;
});
```

This ensures actors with most users, reviews, and success rates are prioritized.

**F. Update `validatePipelinePlan()` (lines 1640-1695)**

Replace `VERIFIED_ACTORS[stage.stage_category]` lookups with `STAGE_CATEGORIES[stage.stage_category]?.expectedOutputs` for field coverage checks.

### File 2: `supabase/functions/process-signal-queue/index.ts`

**A. Remove `VERIFIED_ACTOR_CATALOG` (lines 53-64) entirely**

**B. Remove `resolveVerifiedActor()` function (lines 162-180)**

**C. Update `reconfigurePipeline()` (lines 1038-1207)**

Replace all `resolveVerifiedActor(stage.stage_category)` calls (lines 1128, 1152, 1184) with resolution from `planActorRegistry` first, then inline dynamic discovery if not found:
```typescript
function resolveActorForCategory(stageCategory: string): ActorEntry | null {
  // First: check plan's actor registry (loaded from the plan that was generated)
  for (const [key, actor] of planActorRegistry.entries()) {
    if ((actor as any).subCategory === stageCategory || actor.category === stageCategory.split(":")[0]) {
      return actor;
    }
  }
  return null; // Stage will use dynamic discovery at execution time
}
```

For person-enrichment re-injection (line 1184), use the actor from `planActorRegistry` that matches `people_data:linkedin` category, or fall back to the first people_data actor found in the registry.

**D. Apply previously planned fixes:**

1. **Min-dataset AI filter guard** — In `pipelineAiFilter()` (line 2396), before the classification loop:
   ```typescript
   if (leads.length < 5) {
     console.log(`Stage ${stageNum} AI filter: SKIPPED — only ${leads.length} leads (min 5 for reliable classification)`);
     // Skip directly to validation
     await serviceClient.from("signal_runs").update({
       processing_phase: `stage_${stageNum}_validating`,
     }).eq("id", run.id);
     return;
   }
   ```

2. **LinkedIn URL construction fix** — In `buildPlatformSearchQuery()` case `"linkedin"` (line 297-300), when both roles and industry exist, use ONLY roles as keywords (industry is too broad for LinkedIn keyword field):
   ```typescript
   if (intent.roles.length > 0 && intent.industry) {
     combinedKeyword = intent.roles.join(" OR ");
     // Industry context is handled by AI filter stage, not LinkedIn search
   }
   ```

3. **Low-yield auto-broadening** — In `pipelineScrapeCollecting()` zero-result recovery (line 1908), extend the threshold from `leadCount === 0` to `leadCount < 10` for Stage 1 only, to trigger diagnostic + backup recovery earlier.

## What stays the same
- `UNIVERSAL_OUTPUT_PATHS` — unchanged
- `normaliseGenericResults()` — unchanged
- `normalizeInputToSchema()` — unchanged (with confidence-aware coercion)
- `fetchAndMergeRuntimeSchema()` — unchanged (multi-strategy resolution)
- `flipStartUrlsShape()` — unchanged
- `signal_actor_cache` table — unchanged
- All pipeline phases (starting, scraping, collecting, validating, finalize) — unchanged
- Pre-flight validation logic — unchanged (just now runs for ALL categories)
- `buildPlatformSearchQuery()` for non-LinkedIn platforms — unchanged

## Risk assessment
- **Slower plan generation**: Each scrape stage now requires Apify Store search + pre-flight (~45s each). Acceptable.
- **No actors found**: If Store returns 0 results, plan fails at plan time with clear error (not silently at execution).
- **Reconfiguration**: `reconfigurePipeline()` currently uses `resolveVerifiedActor()` — replaced with registry lookup, which works because the plan's `actor_registry` was already populated during planning.

