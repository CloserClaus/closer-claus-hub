

# Problems in the Signal Search Prompt & System

## 1. Dry-run pre-flight is wasteful and dangerous
**Location:** `signal-planner/index.ts` lines 219-256

Every discovered actor gets a real Apify run started just to check if it's accessible, then immediately aborted. With 8 search terms × 8 actors each = potentially 64 dry runs per plan generation. This burns Apify compute credits, adds latency (each HTTP roundtrip), and the abort may not always succeed — leaving ghost runs consuming resources. A simple GET to the actor details endpoint checking `isDeprecated` or the actor's access status would suffice without starting actual runs.

## 2. Actor discovery is unbounded and slow
**Location:** `signal-planner/index.ts` lines 109-309

The system searches up to 10 terms × 8 actors per term = 80 actors from the Apify Store, then for EACH one fetches the input schema (1-2 API calls) AND does a dry-run (another API call). That's potentially 80 × 3-4 = 240-320 API calls just for discovery. Combined with a 7-day cache, if the cache is cold this will be extremely slow and may timeout the edge function.

## 3. `extractComprehensiveSearchTerms` always adds 4 mandatory terms
**Location:** `signal-planner/index.ts` lines 339-344

Every query, regardless of intent, always searches for "contact email extractor", "linkedin people search", "google search scraper", and "linkedin company scraper". If the user just wants Google Maps data, the system still discovers job board actors, email finders, etc. — bloating the actor catalog passed to the AI, increasing prompt token cost, and confusing the planner model with irrelevant options.

## 4. The planner prompt is enormous and unfocused
**Location:** `buildPipelinePlannerPrompt` lines 381-558

The prompt includes full input schemas (up to 8 params per actor) and output field maps for potentially 30+ actors. This creates a massive system prompt that:
- Costs significant tokens per plan generation
- Dilutes the AI's attention — critical rules like "Stage 1 Query Precision" get buried among dozens of actors the planner won't use
- Contains conflicting instructions (e.g., "start with the NARROWEST source" vs the extensive catalog encouraging broad selection)

## 5. No feedback loop from the user query to the AI prompt
**Location:** `handleGeneratePlan` lines 1010-1020

The user's query is sent as a single user message with zero context enrichment. The planner doesn't receive:
- Parsed industry terms (already computed by `inferQueryIndustry` but never passed to the AI)
- Geography extracted from the query
- Signal type classification (hiring intent vs local business vs company research)

The AI has to re-derive all of this from the raw query, which is why it often gets it wrong.

## 6. `inferQueryIndustry` auto-fix is naive and can break queries
**Location:** `validatePipelinePlan` lines 765-788

When industry terms are missing from Stage 1, the code blindly prepends the first matched industry term to search queries: `p[sfk] = "${industryPrefix} ${p[sfk]}"`. This can produce broken queries like `"marketing SDR OR BDR OR Sales Representative"` — where "marketing" only applies to the first keyword. It should wrap each OR-separated term with the industry qualifier.

## 7. Quality check samples only 15 leads — statistically meaningless for large datasets
**Location:** `process-signal-queue/index.ts` lines 319-324

For a dataset of 2500 records, sampling 15 leads gives a 0.6% sample rate. The quality assessment could be wildly off. The sample should scale with dataset size (e.g., min(50, dataset_size * 0.05)).

## 8. `collectApifyResults` uses `currentStageDef` which may be undefined
**Location:** `process-signal-queue/index.ts` line 1356

The variable `currentStageDef` is referenced but may not be defined in this scope — it should be `stageDef` (the parameter). This could cause the max items cap to silently not apply during collection.

## 9. The `reconfigurePipeline` function is called but its output may never be applied
**Location:** `process-signal-queue/index.ts` lines 458-467

When quality is LOW, `reconfigurePipeline` is called and its result returned as `reconfiguredPipeline`. But the caller of `pipelineQualityCheck` needs to actually apply this reconfigured pipeline to the run — need to verify the caller handles this.

## 10. Cost estimation is detached from reality
**Location:** `signal-planner/index.ts` lines 830-875

The cost model uses flat rates (`$0.001 per result`, `$0.001 per AI evaluation`) that don't account for:
- Actors with different pricing tiers on Apify
- Multi-keyword Stage 1 runs (each keyword spawns a separate actor run, multiplying cost)
- The backup actor system that may double runs on fallback

## Recommended Priority Fixes

1. **Remove dry-run pre-flight** — replace with a simple GET check for actor accessibility (highest impact on latency and cost)
2. **Pass parsed context to the AI** — inject `inferQueryIndustry` results, geography, and signal type into the prompt so the model doesn't have to guess
3. **Fix the OR-query auto-fix** — apply industry prefix to each OR-separated term, not just the beginning
4. **Scale quality check sample size** — use `min(50, ceil(totalCount * 0.05))` instead of hardcoded 15
5. **Fix `currentStageDef` reference** — should be `stageDef`
6. **Trim the actor catalog in the prompt** — only include actors relevant to the classified signal type, not the full 30+ catalog

